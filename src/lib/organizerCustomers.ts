import { supabaseAdmin } from "@/lib/supabase";
import {
  DAY_MS,
  inSegment,
  monthKey,
  startOfDay,
  type CustomerStats,
  type Segment,
} from "@/lib/proAnalytics";

export interface CustomerRow extends CustomerStats {
  wallet: string;
  email: string | null;
  tickets: number;
  lastPurchase: string;
  firstPurchase: string;
  tier: string | null;
  redeemedEvents: number;
  /** Bought again within 90 days of the first purchase. */
  returnedWithin90: boolean;
}

export interface InternalCustomer extends CustomerRow {
  purchaseMonths: Set<string>;
}

/**
 * Builds the per-wallet customer record for one organizer. Exported so the
 * campaign route can resolve a segment to the very same recipient set the
 * dashboard shows.
 */
export async function loadCustomers(organizerWallet: string): Promise<InternalCustomer[]> {
  const { data: eventRows } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("organizer_wallet", organizerWallet);
  const eventIds = ((eventRows ?? []) as { id: string }[]).map((e) => e.id);
  if (eventIds.length === 0) return [];

  const [{ data: purchaseRows }, { data: payoutRows }, { data: tierRows }] = await Promise.all([
    supabaseAdmin
      .from("purchases")
      .select("buyer_wallet, event_id, created_at, redeemed_at, revoked_at, stripe_session_id")
      .in("event_id", eventIds),
    supabaseAdmin
      .from("payouts")
      .select("stripe_session_id, gross_cents")
      .in("event_id", eventIds),
    supabaseAdmin
      .from("loyalty_programs")
      .select("name, threshold, active")
      .eq("organizer_wallet", organizerWallet)
      .eq("active", true)
      .order("threshold", { ascending: false }),
  ]);

  const purchases = ((purchaseRows ?? []) as {
    buyer_wallet: string; event_id: string; created_at: string;
    redeemed_at: string | null; revoked_at: string | null; stripe_session_id: string | null;
  }[]).filter((p) => !p.revoked_at);
  if (purchases.length === 0) return [];

  const grossBySession = new Map<string, number>();
  for (const p of (payoutRows ?? []) as { stripe_session_id: string | null; gross_cents: number }[]) {
    if (p.stripe_session_id) grossBySession.set(p.stripe_session_id, p.gross_cents ?? 0);
  }
  const ticketsPerSession = new Map<string, number>();
  for (const p of purchases) {
    if (p.stripe_session_id) {
      ticketsPerSession.set(p.stripe_session_id, (ticketsPerSession.get(p.stripe_session_id) ?? 0) + 1);
    }
  }

  const tiers = ((tierRows ?? []) as { name: string; threshold: number }[]);
  const now = startOfDay(new Date());

  const byWallet = new Map<string, {
    tickets: number;
    events: Set<string>;
    redeemedEvents: Set<string>;
    spendCents: number;
    months: Set<string>;
    sessions: Set<string>;
    times: number[];
    first: number;
    last: number;
  }>();

  for (const p of purchases) {
    if (!byWallet.has(p.buyer_wallet)) {
      byWallet.set(p.buyer_wallet, {
        tickets: 0, events: new Set(), redeemedEvents: new Set(), spendCents: 0,
        months: new Set(), sessions: new Set(), times: [], first: Infinity, last: 0,
      });
    }
    const c = byWallet.get(p.buyer_wallet)!;
    const at = new Date(p.created_at).getTime();
    c.tickets++;
    c.events.add(p.event_id);
    if (p.redeemed_at) c.redeemedEvents.add(p.event_id);
    c.months.add(monthKey(p.created_at));
    c.times.push(at);
    c.first = Math.min(c.first, at);
    c.last = Math.max(c.last, at);
    if (p.stripe_session_id) {
      c.sessions.add(p.stripe_session_id);
      const gross = grossBySession.get(p.stripe_session_id) ?? 0;
      c.spendCents += gross / (ticketsPerSession.get(p.stripe_session_id) || 1);
    }
  }

  // E-mails live on mint_jobs (the buyer's checkout address), one row per session.
  const allSessions = [...new Set([...byWallet.values()].flatMap((c) => [...c.sessions]))];
  const emailBySession = new Map<string, string>();
  for (let i = 0; i < allSessions.length; i += 500) {
    const { data: jobs } = await supabaseAdmin
      .from("mint_jobs")
      .select("stripe_session_id, buyer_email")
      .in("stripe_session_id", allSessions.slice(i, i + 500));
    for (const j of (jobs ?? []) as { stripe_session_id: string; buyer_email: string | null }[]) {
      if (j.buyer_email) emailBySession.set(j.stripe_session_id, j.buyer_email);
    }
  }

  return [...byWallet.entries()].map(([wallet, c]) => {
    let email: string | null = null;
    for (const s of c.sessions) {
      const found = emailBySession.get(s);
      if (found) { email = found; break; }
    }
    const redeemed = c.redeemedEvents.size;
    // The loyalty tier a guest has actually reached — same signal (distinct
    // redeemed events) the claim route verifies against.
    const tier = tiers.find((t) => redeemed >= t.threshold)?.name ?? null;
    const returnedWithin90 = c.times.some((t) => t > c.first && t - c.first <= 90 * DAY_MS);
    return {
      wallet,
      email,
      tickets: c.tickets,
      events: c.events.size,
      redeemedEvents: redeemed,
      spendCents: Math.round(c.spendCents),
      firstPurchase: new Date(c.first).toISOString(),
      lastPurchase: new Date(c.last).toISOString(),
      daysSinceFirst: Math.floor((now.getTime() - c.first) / DAY_MS),
      daysSinceLast: Math.floor((now.getTime() - c.last) / DAY_MS),
      tier,
      returnedWithin90,
      purchaseMonths: c.months,
    };
  });
}

/** Recipients of a segment campaign: distinct e-mails inside the segment. */
export function segmentRecipients(customers: InternalCustomer[], segment: Segment): string[] {
  return [...new Set(
    customers.filter((c) => inSegment(segment, c)).map((c) => c.email).filter((e): e is string => !!e),
  )];
}
