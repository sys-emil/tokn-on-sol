import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { geocodeVenues } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/**
 * Admin overview API: platform-wide KPIs (with period-over-period growth) plus
 * geocoded event locations for the globe. Gated by ADMIN_SECRET via the
 * x-admin-secret header, same pattern as /api/admin/organizers and
 * /api/admin/payouts.
 *
 * Growth compares the last 30 days against the 30 days before that, using each
 * row's created_at.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

const WINDOW_DAYS = 30;

export type Metric = {
  total: number;
  currentPeriod: number;
  previousPeriod: number;
  /** null when the previous period was 0 (no meaningful percentage). */
  growthPct: number | null;
};

export type EventLocation = {
  lat: number;
  lng: number;
  label: string;
  eventCount: number;
  ticketsSold: number;
};

function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Sum `value` over rows, bucketed by whether created_at falls in the current
 *  or previous window. */
function bucketSum(
  rows: Array<{ created_at: string; value: number }>,
  currentFrom: number,
  previousFrom: number,
): Metric {
  let total = 0;
  let current = 0;
  let previous = 0;
  for (const r of rows) {
    const ts = new Date(r.created_at).getTime();
    total += r.value;
    if (ts >= currentFrom) current += r.value;
    else if (ts >= previousFrom) previous += r.value;
  }
  return { total, currentPeriod: current, previousPeriod: previous, growthPct: growthPct(current, previous) };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const currentFrom = now - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const previousFrom = now - 2 * WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const [purchasesRes, payoutsRes, organizersRes, eventsRes] = await Promise.all([
    supabaseAdmin.from("purchases").select("created_at, revoked_at, buyer_wallet"),
    supabaseAdmin.from("payouts").select("created_at, gross_cents, fee_cents, net_cents"),
    supabaseAdmin.from("organizers").select("created_at, wallet_address"),
    supabaseAdmin.from("events").select("venue, tickets_sold, cancelled_at"),
  ]);

  const firstError = purchasesRes.error || payoutsRes.error || organizersRes.error || eventsRes.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const purchases = (purchasesRes.data ?? []) as Array<{ created_at: string; revoked_at: string | null; buyer_wallet: string }>;
  const payouts = (payoutsRes.data ?? []) as Array<{ created_at: string; gross_cents: number; fee_cents: number; net_cents: number }>;
  const organizers = (organizersRes.data ?? []) as Array<{ created_at: string; wallet_address: string }>;
  const events = (eventsRes.data ?? []) as Array<{ venue: string | null; tickets_sold: number | null; cancelled_at: string | null }>;

  // --- Tickets sold (exclude revoked) ---
  const soldRows = purchases
    .filter((p) => !p.revoked_at)
    .map((p) => ({ created_at: p.created_at, value: 1 }));
  const ticketsSold = bucketSum(soldRows, currentFrom, previousFrom);

  // --- Money (payouts) ---
  const grossVolumeCents = bucketSum(payouts.map((p) => ({ created_at: p.created_at, value: p.gross_cents ?? 0 })), currentFrom, previousFrom);
  const platformFeeCents = bucketSum(payouts.map((p) => ({ created_at: p.created_at, value: p.fee_cents ?? 0 })), currentFrom, previousFrom);
  const netTransferredCents = bucketSum(payouts.map((p) => ({ created_at: p.created_at, value: p.net_cents ?? 0 })), currentFrom, previousFrom);

  // --- Total users: union of buyer + organizer wallets, growth by first-seen ---
  const firstSeen = new Map<string, number>();
  const note = (wallet: string, createdAt: string) => {
    if (!wallet) return;
    const ts = new Date(createdAt).getTime();
    const prev = firstSeen.get(wallet);
    if (prev === undefined || ts < prev) firstSeen.set(wallet, ts);
  };
  for (const p of purchases) note(p.buyer_wallet, p.created_at);
  for (const o of organizers) note(o.wallet_address, o.created_at);

  let usersTotal = 0;
  let usersCurrent = 0;
  let usersPrevious = 0;
  for (const ts of firstSeen.values()) {
    usersTotal += 1;
    if (ts >= currentFrom) usersCurrent += 1;
    else if (ts >= previousFrom) usersPrevious += 1;
  }
  const totalUsers: Metric = {
    total: usersTotal,
    currentPeriod: usersCurrent,
    previousPeriod: usersPrevious,
    growthPct: growthPct(usersCurrent, usersPrevious),
  };

  // --- Event locations (geocoded) ---
  const liveEvents = events.filter((e) => !e.cancelled_at && e.venue && e.venue.trim());
  const geo = await geocodeVenues(liveEvents.map((e) => e.venue as string));

  // Aggregate events by resolved coordinate.
  const byCoord = new Map<string, EventLocation>();
  for (const e of liveEvents) {
    const point = geo.get(e.venue as string);
    if (!point) continue;
    const coordKey = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
    const existing = byCoord.get(coordKey);
    const label = point.displayName?.split(",").slice(0, 2).join(",").trim() || (e.venue as string);
    if (existing) {
      existing.eventCount += 1;
      existing.ticketsSold += e.tickets_sold ?? 0;
    } else {
      byCoord.set(coordKey, {
        lat: point.lat,
        lng: point.lng,
        label,
        eventCount: 1,
        ticketsSold: e.tickets_sold ?? 0,
      });
    }
  }

  return NextResponse.json({
    kpis: { ticketsSold, grossVolumeCents, platformFeeCents, netTransferredCents, totalUsers },
    eventLocations: [...byCoord.values()],
    windowDays: WINDOW_DAYS,
  });
}
