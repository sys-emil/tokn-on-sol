import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";
import { sendPayoutRequestDecision } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Admin-Entscheidung über angefragte Sofort-Auszahlungen (siehe
 * /api/organizer/payout-request).
 *
 * GET  → offene und kürzlich entschiedene Anfragen, angereichert um Event,
 *        Veranstalter und die Summe, um die es geht.
 * POST → { requestId, action: "approve" | "reject" }
 *
 * Freigabe stellt die **im Moment der Freigabe** offenen payouts-Zeilen dieses
 * Events fällig, nicht das Event auf Dauer. Ausgezahlt wird dann vom normalen
 * Cron-Lauf; hier fließt bewusst kein Geld, damit es genau einen Transferpfad
 * im System gibt.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from("payout_requests")
    .select("id, organizer_wallet, event_id, status, note, released_count, released_cents, created_at, decided_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const requests = (data ?? []) as {
    id: string;
    organizer_wallet: string;
    event_id: string;
    status: string;
    note: string | null;
    released_count: number | null;
    released_cents: number | null;
    created_at: string;
    decided_at: string | null;
  }[];

  const eventIds = [...new Set(requests.map((r) => r.event_id))];
  const wallets = [...new Set(requests.map((r) => r.organizer_wallet))];

  const [{ data: events }, { data: orgs }, { data: pending }] = await Promise.all([
    eventIds.length > 0
      ? supabaseAdmin.from("events").select("id, name, date").in("id", eventIds)
      : Promise.resolve({ data: [] }),
    wallets.length > 0
      ? supabaseAdmin.from("organizers").select("wallet_address, name, email, first_payout_at").in("wallet_address", wallets)
      : Promise.resolve({ data: [] }),
    // Was eine Freigabe gerade auszahlen wuerde.
    eventIds.length > 0
      ? supabaseAdmin
          .from("payouts")
          .select("event_id, net_cents")
          .in("event_id", eventIds)
          .eq("status", "pending")
          .gt("available_at", new Date().toISOString())
          .limit(5000)
      : Promise.resolve({ data: [] }),
  ]);

  const eventMeta = new Map<string, { name: string; date: string }>();
  for (const e of (events ?? []) as { id: string; name: string; date: string }[]) {
    eventMeta.set(e.id, { name: e.name, date: e.date });
  }
  const orgMeta = new Map<string, { name: string; firstPayoutAt: string | null }>();
  for (const o of (orgs ?? []) as { wallet_address: string; name: string; first_payout_at: string | null }[]) {
    orgMeta.set(o.wallet_address, { name: o.name, firstPayoutAt: o.first_payout_at });
  }
  const openCents = new Map<string, number>();
  for (const p of (pending ?? []) as { event_id: string; net_cents: number }[]) {
    openCents.set(p.event_id, (openCents.get(p.event_id) ?? 0) + p.net_cents);
  }

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      organizerWallet: r.organizer_wallet,
      organizerName: orgMeta.get(r.organizer_wallet)?.name ?? "–",
      // Ob der Veranstalter schon einmal ausgezahlt wurde, ist die wichtigste
      // Information fuer diese Entscheidung: beim ersten Mal weiss niemand, ob
      // es das Event ueberhaupt gibt.
      firstEver: !orgMeta.get(r.organizer_wallet)?.firstPayoutAt,
      eventId: r.event_id,
      eventName: eventMeta.get(r.event_id)?.name ?? "–",
      eventDate: eventMeta.get(r.event_id)?.date ?? null,
      status: r.status,
      note: r.note,
      openCents: openCents.get(r.event_id) ?? 0,
      releasedCount: r.released_count,
      releasedCents: r.released_cents,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
    })),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: { requestId?: string; action?: string };
  try {
    body = (await req.json()) as { requestId?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { requestId, action } = body;
  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "requestId and action (approve|reject) are required" }, { status: 400 });
  }

  const { data: request } = await supabaseAdmin
    .from("payout_requests")
    .select("id, organizer_wallet, event_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json(
      { error: `Diese Anfrage ist bereits entschieden (Status "${request.status}")` },
      { status: 409 },
    );
  }

  let releasedCount = 0;
  let releasedCents = 0;

  if (action === "approve") {
    const nowIso = new Date().toISOString();
    // Nur die jetzt offenen Zeilen. `available_at` auf jetzt zu setzen ist der
    // einzige Schreibvorgang auf dieser Spalte nach dem Insert — der Cron
    // nimmt sie damit im naechsten Lauf mit (`status = pending AND
    // available_at <= now()`).
    const { data: released, error: relErr } = await supabaseAdmin
      .from("payouts")
      .update({ available_at: nowIso, updated_at: nowIso })
      .eq("event_id", request.event_id)
      .eq("organizer_wallet", request.organizer_wallet)
      .eq("status", "pending")
      .gt("available_at", nowIso)
      .select("id, net_cents");

    if (relErr) {
      return NextResponse.json({ error: relErr.message }, { status: 500 });
    }
    const rows = (released ?? []) as { id: string; net_cents: number }[];
    releasedCount = rows.length;
    releasedCents = rows.reduce((sum, r) => sum + r.net_cents, 0);
  }

  const { error } = await supabaseAdmin
    .from("payout_requests")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      decided_at: new Date().toISOString(),
      ...(action === "approve" ? { released_count: releasedCount, released_cents: releasedCents } : {}),
    })
    .eq("id", requestId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [{ data: organizer }, { data: event }] = await Promise.all([
    supabaseAdmin.from("organizers").select("email, name").eq("wallet_address", request.organizer_wallet).maybeSingle(),
    supabaseAdmin.from("events").select("name").eq("id", request.event_id).maybeSingle(),
  ]);

  if (organizer?.email) {
    const baseUrl = process.env.APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    void sendPayoutRequestDecision({
      to: organizer.email as string,
      name: (organizer.name as string) ?? "",
      eventName: (event?.name as string) ?? "deine Veranstaltung",
      approved: action === "approve",
      baseUrl,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, releasedCount, releasedCents });
}
