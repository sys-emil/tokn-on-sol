import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildBackupPdf } from "@/lib/backupTicket";
import { backupChallenge } from "@/lib/backupChallenge";
import { passEventDates } from "@/lib/seasonPass";
import { sendBackupTicketEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { isBot, botDenied } from "@/lib/botCheck";
import { requestUser } from "@/lib/sessionUser";
import { signAsUser } from "@/lib/wallet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAME_RE = /^[\p{L}\p{M}' .-]{1,40}$/u;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface BackupBody {
  assetIds: string[];
  firstName: string;
  lastName: string;
  birthDate: string;
}

/**
 * Issues a personalized backup-ticket PDF (static QR for venues without
 * connectivity). Auth is the session plus ownership of every listed ticket:
 * the signatures are now produced here, so they can no longer double as the
 * authorization the way they did while the buyer's key sat in the browser.
 * The personalization is printed onto the PDF and mailed; never stored.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`backup:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  if (await isBot()) return botDenied();

  let body: BackupBody;
  try {
    body = (await req.json()) as BackupBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const birthDate = (body.birthDate ?? "").trim();
  if (!NAME_RE.test(firstName) || !NAME_RE.test(lastName)) {
    return NextResponse.json({ success: false, error: "Bitte gib Vor- und Nachnamen an." }, { status: 400 });
  }
  const birthYear = parseInt(birthDate.slice(0, 4), 10);
  if (!DATE_RE.test(birthDate) || Number.isNaN(Date.parse(birthDate))
    || birthYear < 1900 || Date.parse(birthDate) > Date.now()) {
    return NextResponse.json({ success: false, error: "Bitte gib ein gültiges Geburtsdatum an." }, { status: 400 });
  }

  const assetIds = Array.isArray(body.assetIds)
    ? body.assetIds.filter((a) => typeof a === "string" && a).slice(0, 10)
    : [];
  if (assetIds.length === 0) {
    return NextResponse.json({ success: false, error: "assetIds are required" }, { status: 400 });
  }

  const user = await requestUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Nicht angemeldet." }, { status: 401 });
  }

  // All tickets must exist, be unrevoked, and belong to ONE product; either
  // the same event or the same season pass. Mixing them on one sheet would
  // print a single date over tickets that don't share it.
  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("asset_id, buyer_wallet, event_id, season_pass_id, revoked_at, stripe_session_id")
    .in("asset_id", assetIds);
  const byAsset = new Map(
    ((purchases ?? []) as { asset_id: string; buyer_wallet: string; event_id: string | null; season_pass_id: string | null; revoked_at: string | null; stripe_session_id: string | null }[])
      .map((p) => [p.asset_id, p]),
  );
  const productIds = new Set([...byAsset.values()].map((p) => p.event_id ?? `pass:${p.season_pass_id}`));
  if (byAsset.size !== assetIds.length || productIds.size !== 1) {
    return NextResponse.json({ success: false, error: "Ticket nicht gefunden." }, { status: 404 });
  }
  if ([...byAsset.values()].some((p) => p.revoked_at)) {
    return NextResponse.json({ success: false, error: "Ein Ticket wurde storniert." }, { status: 409 });
  }

  // Every ticket must belong to the signed-in account. This replaces the old
  // check that the caller could produce a valid signature — which stopped being
  // proof of anything the moment the signing key moved to the server.
  if ([...byAsset.values()].some((p) => p.buyer_wallet !== user.walletAddress)) {
    return NextResponse.json({ success: false, error: "Ticket nicht gefunden." }, { status: 404 });
  }

  // The person is bound into the challenge, so the name and birth date the
  // doorman reads come from the signature rather than from the printed sheet,
  // which anyone could edit.
  const items = assetIds.map((assetId) => ({
    assetId,
    signature: signAsUser(
      user.id,
      user.keyVersion,
      new TextEncoder().encode(backupChallenge(assetId, { firstName, lastName, birthDate })),
    ),
  }));

  // A backup pass carries no single date; the printed line names the series
  // instead. At the door the token verifies exactly like a live pass scan
  // (the verify route redeems it per event), so nothing else changes.
  const passId = [...byAsset.values()][0].season_pass_id;
  let headline: { name: string; date: string; venue: string | null };
  if (passId) {
    const [{ data: pass }, dates] = await Promise.all([
      supabaseAdmin.from("season_passes").select("name, active").eq("id", passId).maybeSingle(),
      passEventDates(passId),
    ]);
    if (!pass) {
      return NextResponse.json({ success: false, error: "Saisonpass nicht gefunden." }, { status: 404 });
    }
    headline = {
      name: pass.name as string,
      date: dates[0] ?? "",
      venue: dates.length > 1 ? `Saisonpass · ${dates.length} Termine` : "Saisonpass",
    };
  } else {
    const eventId = [...byAsset.values()][0].event_id as string;
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("name, date, venue, cancelled_at")
      .eq("id", eventId)
      .single();
    if (!event || event.cancelled_at) {
      return NextResponse.json({ success: false, error: "Event nicht gefunden." }, { status: 404 });
    }
    headline = {
      name: event.name as string,
      date: event.date as string,
      venue: (event.venue ?? null) as string | null,
    };
  }

  const pdf = await buildBackupPdf({
    eventName: headline.name,
    eventDate: headline.date,
    venue: headline.venue,
    person: { firstName, lastName, birthDate },
    tickets: items.map((i) => ({
      assetId: i.assetId,
      qrPayload: JSON.stringify({
        a: i.assetId,
        w: byAsset.get(i.assetId)!.buyer_wallet,
        s: i.signature,
        b: 1,
        // Identity bound into the signed challenge above; the door reads it
        // from here, not from the (editable) printed text.
        p: { f: firstName, l: lastName, d: birthDate },
      }),
    })),
  });

  // Mail goes to the buyer address of the purchase; never to a
  // client-supplied recipient.
  let emailed = false;
  const sessionId = [...byAsset.values()].find((p) => p.stripe_session_id)?.stripe_session_id;
  if (sessionId) {
    const { data: job } = await supabaseAdmin
      .from("mint_jobs")
      .select("buyer_email")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (job?.buyer_email) {
      const baseUrl = process.env.APP_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      try {
        await sendBackupTicketEmail({
          to: job.buyer_email as string,
          eventName: headline.name,
          pdf,
          baseUrl,
        });
        emailed = true;
      } catch (err) {
        console.error("Backup ticket mail failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  // Record THAT an offline ticket exists — never the personalization itself,
  // which stays exclusively in the signed QR and on the printout. The flag is
  // what lets the return flow warn precisely the sellers whose printout is
  // about to become worthless, instead of warning everyone about nothing.
  void supabaseAdmin
    .from("purchases")
    .update({ backup_issued_at: new Date().toISOString() })
    .in("asset_id", items.map((i) => i.assetId))
    .is("backup_issued_at", null)
    .then(({ error }) => {
      if (error) console.error("backup_issued_at update failed:", error.message);
    });

  return NextResponse.json({
    success: true,
    emailed,
    pdfBase64: Buffer.from(pdf).toString("base64"),
  });
}
