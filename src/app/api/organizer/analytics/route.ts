import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireProOrganizer } from "@/lib/plan";

export const dynamic = "force-dynamic";

/**
 * Pro analytics across all events of an organizer: revenue, sales time
 * series, redemption rates, repeat-customer share, top customers.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress") ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, name, date, capacity, tickets_sold, cancelled_at")
    .eq("organizer_wallet", walletAddress)
    .order("date", { ascending: false });

  const eventIds = (events ?? []).map((e: { id: string }) => e.id);
  if (eventIds.length === 0) {
    return NextResponse.json({
      events: [],
      salesByDay: [],
      repeat: { customers: 0, repeatCustomers: 0, repeatShare: 0 },
      topCustomers: [],
    });
  }

  const [{ data: purchases }, { data: payouts }, { data: stammgastBadges }] = await Promise.all([
    supabaseAdmin
      .from("purchases")
      .select("buyer_wallet, event_id, created_at, redeemed_at, revoked_at, stripe_session_id")
      .in("event_id", eventIds),
    supabaseAdmin
      .from("payouts")
      .select("event_id, net_cents, status")
      .in("event_id", eventIds),
    supabaseAdmin
      .from("badges")
      .select("wallet_address")
      .eq("badge_type", "loyal_organizer")
      .eq("organizer_wallet", walletAddress),
  ]);

  const purchaseRows = (purchases ?? []) as {
    buyer_wallet: string;
    event_id: string;
    created_at: string;
    redeemed_at: string | null;
    revoked_at: string | null;
    stripe_session_id: string | null;
  }[];
  const activePurchases = purchaseRows.filter((p) => !p.revoked_at);

  // Revenue per event from payout rows (net = organizer share); refunded rows
  // already carry net_cents 0.
  const revenueByEvent = new Map<string, number>();
  for (const p of (payouts ?? []) as { event_id: string; net_cents: number }[]) {
    revenueByEvent.set(p.event_id, (revenueByEvent.get(p.event_id) ?? 0) + (p.net_cents ?? 0));
  }

  const perEvent = (events ?? []).map((e) => {
    const rows = activePurchases.filter((p) => p.event_id === e.id);
    const redeemed = rows.filter((p) => p.redeemed_at).length;
    return {
      id: e.id as string,
      name: e.name as string,
      date: e.date as string,
      capacity: e.capacity as number,
      ticketsSold: e.tickets_sold as number,
      cancelled: !!e.cancelled_at,
      revenueCents: revenueByEvent.get(e.id as string) ?? 0,
      redeemed,
      redemptionPct: rows.length > 0 ? Math.round((redeemed / rows.length) * 100) : 0,
    };
  });

  // Sales time series, last 30 days.
  const days = 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const salesByDay: { date: string; sold: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 86400000);
    salesByDay.push({ date: day.toISOString().slice(0, 10), sold: 0 });
  }
  const dayIndex = new Map(salesByDay.map((d, i) => [d.date, i]));
  for (const p of activePurchases) {
    const key = p.created_at.slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx !== undefined) salesByDay[idx].sold++;
  }

  // Repeat customers: wallets with purchases at >= 2 distinct events.
  const eventsPerWallet = new Map<string, Set<string>>();
  const purchasesPerWallet = new Map<string, { purchases: number; redeemed: number; sessions: Set<string> }>();
  for (const p of activePurchases) {
    if (!eventsPerWallet.has(p.buyer_wallet)) eventsPerWallet.set(p.buyer_wallet, new Set());
    eventsPerWallet.get(p.buyer_wallet)!.add(p.event_id);
    if (!purchasesPerWallet.has(p.buyer_wallet)) {
      purchasesPerWallet.set(p.buyer_wallet, { purchases: 0, redeemed: 0, sessions: new Set() });
    }
    const stats = purchasesPerWallet.get(p.buyer_wallet)!;
    stats.purchases++;
    if (p.redeemed_at) stats.redeemed++;
    if (p.stripe_session_id) stats.sessions.add(p.stripe_session_id);
  }
  const customers = eventsPerWallet.size;
  const repeatCustomers = [...eventsPerWallet.values()].filter((s) => s.size >= 2).length;

  // Top customers with e-mail (from mint_jobs) and Stammgast flag.
  const top = [...purchasesPerWallet.entries()]
    .sort((a, b) => b[1].purchases - a[1].purchases)
    .slice(0, 10);
  const topSessions = [...new Set(top.flatMap(([, s]) => [...s.sessions]))];
  const emailBySession = new Map<string, string>();
  if (topSessions.length > 0) {
    const { data: jobs } = await supabaseAdmin
      .from("mint_jobs")
      .select("stripe_session_id, buyer_email")
      .in("stripe_session_id", topSessions);
    for (const j of (jobs ?? []) as { stripe_session_id: string; buyer_email: string | null }[]) {
      if (j.buyer_email) emailBySession.set(j.stripe_session_id, j.buyer_email);
    }
  }
  const stammgastSet = new Set(
    ((stammgastBadges ?? []) as { wallet_address: string }[]).map((b) => b.wallet_address),
  );

  const topCustomers = top.map(([wallet, stats]) => {
    let email: string | null = null;
    for (const session of stats.sessions) {
      const found = emailBySession.get(session);
      if (found) { email = found; break; }
    }
    return {
      wallet,
      email,
      purchases: stats.purchases,
      redeemed: stats.redeemed,
      attendedEvents: eventsPerWallet.get(wallet)?.size ?? 0,
      stammgast: stammgastSet.has(wallet),
    };
  });

  return NextResponse.json({
    events: perEvent,
    salesByDay,
    repeat: {
      customers,
      repeatCustomers,
      repeatShare: customers > 0 ? Math.round((repeatCustomers / customers) * 100) : 0,
    },
    topCustomers,
  });
}
