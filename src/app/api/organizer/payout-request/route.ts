import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/sessionUser";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { sendAdminAlert } from "@/lib/email";

export const dynamic = "force-dynamic";

const MAX_NOTE = 500;

/**
 * „Sofort-Auszahlung anfragen“: der Weg unter dem Plattform-Puffer hindurch.
 *
 * Einnahmen fließen seit 2026-09-07 frühestens am Tag nach dem Event
 * (`effectiveHoldDays` in src/lib/payouts.ts), beim ersten Event drei Tage
 * danach. Wer das Geld vorher braucht — Anzahlung für die Halle, Gage der Band —
 * fragt hier an, und ein Mensch entscheidet. Genau eine offene Anfrage pro
 * Event (Teil-Index `payout_requests_one_open`).
 *
 * Freigegeben wird pro Event **einmalig**: die Admin-Route stellt nur die in
 * diesem Moment offenen payouts-Zeilen fällig, spätere Verkäufe desselben
 * Events laufen wieder normal.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`payout-request:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { walletAddress?: string; eventId?: string; note?: string };
  try {
    body = (await req.json()) as { walletAddress?: string; eventId?: string; note?: string };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { walletAddress, eventId } = body;
  if (!walletAddress || !eventId) {
    return NextResponse.json({ success: false, error: "walletAddress und eventId sind nötig." }, { status: 400 });
  }
  if (!(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Das Event muss dem Anfragenden gehören; sonst könnte jeder Veranstalter
  // eine Anfrage auf ein fremdes Event schreiben und die Admin-Ansicht fluten.
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, name, organizer_wallet")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.organizer_wallet !== walletAddress) {
    return NextResponse.json({ success: false, error: "Event nicht gefunden." }, { status: 404 });
  }

  // Es muss überhaupt etwas zu beschleunigen geben.
  const { data: dueRows } = await supabaseAdmin
    .from("payouts")
    .select("net_cents")
    .eq("organizer_wallet", walletAddress)
    .eq("event_id", eventId)
    .eq("status", "pending")
    .gt("available_at", new Date().toISOString())
    .limit(2000);

  const rows = (dueRows ?? []) as { net_cents: number }[];
  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Für dieses Event steht gerade keine Auszahlung aus." },
      { status: 409 },
    );
  }
  const totalCents = rows.reduce((sum, r) => sum + r.net_cents, 0);

  const note = (body.note ?? "").trim().slice(0, MAX_NOTE) || null;
  const { error } = await supabaseAdmin.from("payout_requests").insert({
    organizer_wallet: walletAddress,
    event_id: eventId,
    note,
    status: "pending",
  });

  if (error) {
    // 23505 = der Teil-Index: es liegt bereits eine offene Anfrage vor.
    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, error: "Für dieses Event läuft bereits eine Anfrage." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  void sendAdminAlert({
    subject: "Sofort-Auszahlung angefragt",
    text: `${walletAddress} bittet um die vorzeitige Auszahlung von „${event.name}“.\n`
      + `Betrag: ${(totalCents / 100).toFixed(2)} € aus ${rows.length} Verkauf(en).\n`
      + (note ? `Begründung: ${note}\n` : "")
      + `\nEntscheiden unter /admin?tab=payouts`,
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
