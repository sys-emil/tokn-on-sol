import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { supabaseAdmin } from "@/lib/supabase";
import { buildBackupPdf } from "@/lib/backupTicket";
import { sendBackupTicketEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAME_RE = /^[\p{L}\p{M}' .-]{1,40}$/u;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface BackupItem {
  assetId: string;
  signature: string; // base58, over `passly:backup:<assetId>`
}

interface BackupBody {
  items: BackupItem[];
  firstName: string;
  lastName: string;
  birthDate: string;
}

/**
 * Issues a personalized backup-ticket PDF (static QR for venues without
 * connectivity). Auth is the signatures themselves: only the owner of the
 * buyer wallet can produce them, so no separate session check is needed.
 * The personalization is printed onto the PDF and mailed — never stored.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`backup:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

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

  const items = Array.isArray(body.items) ? body.items.slice(0, 10) : [];
  if (items.length === 0 || items.some((i) => !i.assetId || !i.signature)) {
    return NextResponse.json({ success: false, error: "items are required" }, { status: 400 });
  }

  // All tickets must exist, be unrevoked, and belong to one event.
  const assetIds = items.map((i) => i.assetId);
  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("asset_id, buyer_wallet, event_id, revoked_at, stripe_session_id")
    .in("asset_id", assetIds);
  const byAsset = new Map(
    ((purchases ?? []) as { asset_id: string; buyer_wallet: string; event_id: string; revoked_at: string | null; stripe_session_id: string | null }[])
      .map((p) => [p.asset_id, p]),
  );
  const eventIds = new Set([...byAsset.values()].map((p) => p.event_id));
  if (byAsset.size !== assetIds.length || eventIds.size !== 1) {
    return NextResponse.json({ success: false, error: "Ticket nicht gefunden." }, { status: 404 });
  }
  if ([...byAsset.values()].some((p) => p.revoked_at)) {
    return NextResponse.json({ success: false, error: "Ein Ticket wurde storniert." }, { status: 409 });
  }

  // Verify each signature against the ticket's buyer wallet — that IS the
  // authorization: only the wallet owner can sign the backup challenge.
  for (const item of items) {
    const purchase = byAsset.get(item.assetId)!;
    let ok = false;
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        Uint8Array.from(bs58.decode(purchase.buyer_wallet)),
        "Ed25519",
        false,
        ["verify"],
      );
      ok = await crypto.subtle.verify(
        "Ed25519",
        key,
        Uint8Array.from(bs58.decode(item.signature)),
        new TextEncoder().encode(`passly:backup:${item.assetId}`),
      );
    } catch {
      ok = false;
    }
    if (!ok) {
      return NextResponse.json({ success: false, error: "Signatur ungültig." }, { status: 401 });
    }
  }

  const eventId = [...eventIds][0];
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("name, date, venue, cancelled_at")
    .eq("id", eventId)
    .single();
  if (!event || event.cancelled_at) {
    return NextResponse.json({ success: false, error: "Event nicht gefunden." }, { status: 404 });
  }

  const pdf = await buildBackupPdf({
    eventName: event.name as string,
    eventDate: event.date as string,
    venue: (event.venue ?? null) as string | null,
    person: { firstName, lastName, birthDate },
    tickets: items.map((i) => ({
      assetId: i.assetId,
      qrPayload: JSON.stringify({
        a: i.assetId,
        w: byAsset.get(i.assetId)!.buyer_wallet,
        s: i.signature,
        b: 1,
      }),
    })),
  });

  // Mail goes to the buyer address of the purchase — never to a
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
          eventName: event.name as string,
          pdf,
          baseUrl,
        });
        emailed = true;
      } catch (err) {
        console.error("Backup ticket mail failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    emailed,
    pdfBase64: Buffer.from(pdf).toString("base64"),
  });
}
