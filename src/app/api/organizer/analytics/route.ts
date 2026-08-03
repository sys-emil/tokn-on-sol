import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireProOrganizer } from "@/lib/plan";
import {
  DAY_MS,
  channelFromReferrer,
  dayKey,
  dayKeys,
  forecastEvent,
  parseRange,
  pctChange,
  share,
  startOfDay,
  type Channel,
} from "@/lib/proAnalytics";

export const dynamic = "force-dynamic";

/**
 * Consent-gated funnel stages, in order.
 *
 * Der Besuch ist seit der Showcase-Seite **zweistufig**: Gäste landen auf
 * /event/<id> und gehen von dort auf die Kaufseite /shop/<id>. Beide senden
 * dasselbe `page_view`-Ereignis, unterschieden werden sie am Pfad
 * (`stageKeyOf`) — die Stufenschlüssel sind deshalb nicht mehr identisch mit
 * den Ereignisnamen.
 */
const FUNNEL_STAGES = [
  { key: "event_view", label: "Event-Seite besucht" },
  { key: "shop_view", label: "Kaufseite besucht" },
  { key: "ticket_selected", label: "Ticket ausgewählt" },
  { key: "checkout_started", label: "Checkout gestartet" },
  { key: "purchase_completed", label: "Kauf abgeschlossen" },
] as const;

/** Die Ereignisnamen hinter den Stufen (page_view trägt zwei davon). */
const FUNNEL_EVENT_NAMES = [
  "page_view",
  "ticket_selected",
  "checkout_started",
  "purchase_completed",
] as const;

/** Stufe eines Ereignisses; NULL, wenn der Pfad zu keiner Stufe gehört. */
function stageKeyOf(name: string, path: string | null): string | null {
  if (name !== "page_view") return name;
  if (path?.startsWith("/event/")) return "event_view";
  if (path?.startsWith("/shop/")) return "shop_view";
  return null;
}

const MAX_ANALYTICS_ROWS = 100_000;

/** Fewer comparable organizers than this and the benchmark stays hidden. */
const MIN_BENCHMARK_ORGANIZERS = 5;

interface PurchaseRow {
  buyer_wallet: string;
  event_id: string;
  created_at: string;
  redeemed_at: string | null;
  revoked_at: string | null;
  stripe_session_id: string | null;
  source: string | null;
  tier_id: string | null;
}

function appHost(): string | undefined {
  const raw = process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!raw) return undefined;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Pro analytics across all events of an organizer, for a selectable window
 * (7/30/90/365 days) with a previous-period comparison: KPIs, daily series,
 * conversion funnel, channel attribution, sales forecast, platform benchmark
 * and the per-event comparison table.
 *
 * Money comes from `payouts` (the authority on what an organizer actually
 * earns); a session's net is spread evenly across its tickets so the daily
 * series and per-ticket averages line up with the ticket counts.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get("walletAddress") ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const range = parseRange(url.searchParams.get("range"));

  const { data: eventRows } = await supabaseAdmin
    .from("events")
    .select("id, name, date, capacity, tickets_sold, cancelled_at, created_at")
    .eq("organizer_wallet", walletAddress)
    .order("date", { ascending: false });

  const events = (eventRows ?? []) as {
    id: string; name: string; date: string; capacity: number;
    tickets_sold: number; cancelled_at: string | null; created_at: string;
  }[];
  const eventIds = events.map((e) => e.id);

  if (eventIds.length === 0) {
    return NextResponse.json(emptyPayload(range));
  }

  const today = startOfDay(new Date());
  const periodStart = new Date(today.getTime() - (range - 1) * DAY_MS);
  const prevStart = new Date(periodStart.getTime() - range * DAY_MS);

  const [{ data: purchaseRows }, { data: payoutRows }, { data: trackRows }, benchmark] = await Promise.all([
    supabaseAdmin
      .from("purchases")
      .select("buyer_wallet, event_id, created_at, redeemed_at, revoked_at, stripe_session_id, source, tier_id")
      .in("event_id", eventIds),
    supabaseAdmin
      .from("payouts")
      .select("stripe_session_id, event_id, gross_cents, net_cents, status")
      .in("event_id", eventIds),
    supabaseAdmin
      .from("analytics_events")
      .select("name, path, cid, referrer, created_at")
      .in("name", FUNNEL_EVENT_NAMES)
      // Showcase- und Kaufseite; feste Muster, kein Nutzereingabe-String.
      .or("path.like./event/%,path.like./shop/%")
      .gte("created_at", prevStart.toISOString())
      .limit(MAX_ANALYTICS_ROWS),
    loadBenchmark(walletAddress),
  ]);

  const purchases = ((purchaseRows ?? []) as PurchaseRow[]).filter((p) => !p.revoked_at);

  // Net (organizer share) and gross (what the guest paid) per session; refunded
  // payout rows already carry 0, so they drop out of the numbers by themselves.
  const netBySession = new Map<string, number>();
  const grossBySession = new Map<string, number>();
  const netByEvent = new Map<string, number>();
  for (const p of (payoutRows ?? []) as {
    stripe_session_id: string | null; event_id: string; gross_cents: number; net_cents: number;
  }[]) {
    if (p.stripe_session_id) {
      netBySession.set(p.stripe_session_id, p.net_cents ?? 0);
      grossBySession.set(p.stripe_session_id, p.gross_cents ?? 0);
    }
    netByEvent.set(p.event_id, (netByEvent.get(p.event_id) ?? 0) + (p.net_cents ?? 0));
  }
  const ticketsPerSession = new Map<string, number>();
  for (const p of purchases) {
    if (p.stripe_session_id) {
      ticketsPerSession.set(p.stripe_session_id, (ticketsPerSession.get(p.stripe_session_id) ?? 0) + 1);
    }
  }
  const netOf = (p: PurchaseRow): number => {
    if (!p.stripe_session_id) return 0;
    const total = netBySession.get(p.stripe_session_id) ?? 0;
    return total / (ticketsPerSession.get(p.stripe_session_id) || 1);
  };
  const grossOf = (p: PurchaseRow): number => {
    if (!p.stripe_session_id) return 0;
    const total = grossBySession.get(p.stripe_session_id) ?? 0;
    return total / (ticketsPerSession.get(p.stripe_session_id) || 1);
  };

  /* ── Tages-Serien (aktuelle + Vorperiode) ──────────────────────────────── */

  const currentKeys = dayKeys(range, today);
  const prevKeys = dayKeys(range, new Date(periodStart.getTime() - DAY_MS));
  const emptySeries = () => ({
    revenue: new Array<number>(range).fill(0),
    tickets: new Array<number>(range).fill(0),
    buyerSets: Array.from({ length: range }, () => new Set<string>()),
  });
  const cur = emptySeries();
  const prev = emptySeries();
  const curIndex = new Map(currentKeys.map((k, i) => [k, i]));
  const prevIndex = new Map(prevKeys.map((k, i) => [k, i]));

  const walletsCurrent = new Map<string, Set<string>>();
  const walletsPrevious = new Map<string, Set<string>>();
  let ticketsCurrent = 0;
  let ticketsPrevious = 0;
  let revenueCurrent = 0;
  let revenuePrevious = 0;
  let grossCurrent = 0;
  let grossPrevious = 0;

  for (const p of purchases) {
    const key = dayKey(p.created_at);
    const net = netOf(p);
    const gross = grossOf(p);
    const ci = curIndex.get(key);
    if (ci !== undefined) {
      cur.revenue[ci] += net;
      cur.tickets[ci] += 1;
      cur.buyerSets[ci].add(p.buyer_wallet);
      ticketsCurrent++;
      revenueCurrent += net;
      grossCurrent += gross;
      if (!walletsCurrent.has(p.buyer_wallet)) walletsCurrent.set(p.buyer_wallet, new Set());
      walletsCurrent.get(p.buyer_wallet)!.add(p.event_id);
      continue;
    }
    const pi = prevIndex.get(key);
    if (pi !== undefined) {
      prev.revenue[pi] += net;
      prev.tickets[pi] += 1;
      prev.buyerSets[pi].add(p.buyer_wallet);
      ticketsPrevious++;
      revenuePrevious += net;
      grossPrevious += gross;
      if (!walletsPrevious.has(p.buyer_wallet)) walletsPrevious.set(p.buyer_wallet, new Set());
      walletsPrevious.get(p.buyer_wallet)!.add(p.event_id);
    }
  }

  const repeatShareOf = (map: Map<string, Set<string>>): number => {
    if (map.size === 0) return 0;
    const repeat = [...map.values()].filter((s) => s.size >= 2).length;
    return share(repeat, map.size);
  };

  /* ── Funnel + Attribution ──────────────────────────────────────────────── */

  const eventIdSet = new Set(eventIds);
  // /event/<id> (Showcase) und /shop/<id> (Kauf) tragen die Event-ID an
  // derselben Stelle; beide zählen nur für die eigenen Events.
  const isOwnEventPath = (path: string | null): boolean => {
    if (!path?.startsWith("/event/") && !path?.startsWith("/shop/")) return false;
    return eventIdSet.has(path.split("/")[2] ?? "");
  };

  const stageCids: Record<string, Set<string>> = {};
  const stageCidsPrev: Record<string, Set<string>> = {};
  for (const s of FUNNEL_STAGES) {
    stageCids[s.key] = new Set();
    stageCidsPrev[s.key] = new Set();
  }
  // First referrer wins per visitor: the entry point is what the organizer
  // actually bought/posted, later same-site hops are noise.
  const channelByCid = new Map<string, Channel>();
  const host = appHost();

  for (const row of (trackRows ?? []) as {
    name: string; path: string | null; cid: string; referrer: string | null; created_at: string;
  }[]) {
    if (!isOwnEventPath(row.path)) continue;
    const stage = stageKeyOf(row.name, row.path);
    if (!stage) continue;
    const at = new Date(row.created_at);
    const bucket = at >= periodStart ? stageCids : at >= prevStart ? stageCidsPrev : null;
    bucket?.[stage]?.add(row.cid);
    if (at >= periodStart && !channelByCid.has(row.cid)) {
      channelByCid.set(row.cid, channelFromReferrer(row.referrer, host));
    }
  }

  // Besucher = jeder, der eine der beiden Seiten gesehen hat. Nicht jeder
  // kommt über die Showcase herein (Direktlinks, Wiederverkauf, Warteliste),
  // deshalb die Vereinigung statt der ersten Stufe.
  const views = new Set([...stageCids.event_view, ...stageCids.shop_view]).size;
  const buyerCids = stageCids.purchase_completed;
  const funnel = FUNNEL_STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    count: stageCids[s.key].size,
  }));

  const perChannel = new Map<Channel, { visitors: number; buyers: number }>();
  for (const [cid, channel] of channelByCid) {
    if (!perChannel.has(channel)) perChannel.set(channel, { visitors: 0, buyers: 0 });
    const entry = perChannel.get(channel)!;
    entry.visitors++;
    if (buyerCids.has(cid)) entry.buyers++;
  }
  const totalChannelBuyers = [...perChannel.values()].reduce((a, c) => a + c.buyers, 0);
  const channels = [...perChannel.entries()]
    .map(([name, c]) => ({
      name,
      visitors: c.visitors,
      buyers: c.buyers,
      // Revenue is attributed proportionally to a channel's share of buying
      // visitors; the analytics table holds no order value by design.
      revenueCents: totalChannelBuyers > 0 ? Math.round((c.buyers / totalChannelBuyers) * revenueCurrent) : 0,
      sharePct: share(c.buyers, totalChannelBuyers),
      conversionPct: share(c.buyers, c.visitors),
    }))
    .filter((c) => c.visitors > 0)
    .sort((a, b) => b.buyers - a.buyers || b.visitors - a.visitors);

  /* ── Prognose je bevorstehendem Event ──────────────────────────────────── */

  const salesWindow = 14;
  const windowKeys = dayKeys(salesWindow, today);
  const perEventRecent = new Map<string, number[]>();
  for (const e of events) perEventRecent.set(e.id, new Array<number>(salesWindow).fill(0));
  const windowIndex = new Map(windowKeys.map((k, i) => [k, i]));
  for (const p of purchases) {
    const idx = windowIndex.get(dayKey(p.created_at));
    if (idx !== undefined) perEventRecent.get(p.event_id)![idx] += 1;
  }

  const forecasts = events
    .filter((e) => !e.cancelled_at && e.date >= dayKey(today))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
    .map((e) => {
      const daysLeft = Math.max(
        Math.ceil((new Date(`${e.date}T00:00:00Z`).getTime() - today.getTime()) / DAY_MS),
        0,
      );
      const f = forecastEvent({
        sold: e.tickets_sold,
        capacity: e.capacity,
        recentSales: perEventRecent.get(e.id) ?? [],
        daysLeft,
      });
      const sellOutDate = f.daysToSellOut != null && f.daysToSellOut <= daysLeft
        ? dayKey(new Date(today.getTime() + f.daysToSellOut * DAY_MS))
        : null;
      return {
        id: e.id,
        name: e.name,
        date: e.date,
        daysLeft,
        sold: e.tickets_sold,
        capacity: e.capacity,
        forecastPct: f.forecastPct,
        sellOutDate,
        pacePerDay: Math.round(f.pace * 10) / 10,
        kind: f.kind,
      };
    });

  /* ── Event-Tabelle ─────────────────────────────────────────────────────── */

  const perEvent = events.map((e) => {
    const rows = purchases.filter((p) => p.event_id === e.id);
    const redeemed = rows.filter((p) => p.redeemed_at).length;
    const revenueCents = netByEvent.get(e.id) ?? 0;
    return {
      id: e.id,
      name: e.name,
      date: e.date,
      capacity: e.capacity,
      ticketsSold: e.tickets_sold,
      cancelled: !!e.cancelled_at,
      revenueCents,
      redeemed,
      redemptionPct: rows.length > 0 ? Math.round((redeemed / rows.length) * 100) : null,
      avgPriceCents: rows.length > 0 ? Math.round(revenueCents / rows.length) : 0,
    };
  });

  const bestIdx = cur.revenue.reduce((best, v, i) => (v > cur.revenue[best] ? i : best), 0);

  /* ── Umsatz, der oben absichtlich fehlt ────────────────────────────────
     Zwei Quellen, zwei verschiedene Gründe — und beide sehen ohne diese
     Zeilen wie ein Zählfehler aus:
     - Abendkasse: die Tickets zählen oben mit, das Bargeld nicht, denn es
       lief nie über Passly (es gibt keine payouts-Zeile).
     - Saisonpass: gehört zu keinem einzelnen Termin, taucht deshalb weder
       in den Stückzahlen noch im Umsatz auf.                              */
  const offBook = await loadOffBookRevenue(walletAddress, purchases, periodStart);

  return NextResponse.json({
    range,
    kpis: {
      revenueCents: Math.round(revenueCurrent),
      revenuePrevCents: Math.round(revenuePrevious),
      revenueDelta: pctChange(revenueCurrent, revenuePrevious),
      tickets: ticketsCurrent,
      ticketsPrev: ticketsPrevious,
      ticketsDelta: pctChange(ticketsCurrent, ticketsPrevious),
      avgPriceCents: ticketsCurrent > 0 ? Math.round(grossCurrent / ticketsCurrent) : 0,
      avgPricePrevCents: ticketsPrevious > 0 ? Math.round(grossPrevious / ticketsPrevious) : 0,
      customers: walletsCurrent.size,
      customersPrev: walletsPrevious.size,
      repeatShare: repeatShareOf(walletsCurrent),
      repeatSharePrev: repeatShareOf(walletsPrevious),
      conversion: share(buyerCids.size, views),
      conversionPrev: share(stageCidsPrev.purchase_completed.size, stageCidsPrev.page_view.size),
      views,
    },
    series: {
      days: currentKeys,
      prevDays: prevKeys,
      revenue: cur.revenue.map((v) => Math.round(v)),
      revenuePrev: prev.revenue.map((v) => Math.round(v)),
      tickets: cur.tickets,
      ticketsPrev: prev.tickets,
      buyers: cur.buyerSets.map((s) => s.size),
      buyersPrev: prev.buyerSets.map((s) => s.size),
    },
    bestDay: revenueCurrent > 0
      ? { date: currentKeys[bestIdx], revenueCents: Math.round(cur.revenue[bestIdx]) }
      : null,
    funnel,
    channels,
    forecasts,
    benchmark,
    events: perEvent,
    offBook,
  });
}

interface OffBookRevenue {
  boxOffice: { tickets: number; revenueCents: number };
  seasonPass: { tickets: number; revenueCents: number };
}

/**
 * Money the organizer earned in this period that the headline figures above do
 * not (and should not) contain. Surfacing it is the whole point: the numbers
 * are right, they just aren't complete on their own.
 */
async function loadOffBookRevenue(
  walletAddress: string,
  purchases: PurchaseRow[],
  periodStart: Date,
): Promise<OffBookRevenue> {
  const startMs = periodStart.getTime();
  const inPeriod = (iso: string): boolean => Date.parse(iso) >= startMs;

  // Box office: priced from the tier, since no payouts row exists.
  const cashRows = purchases.filter((p) => p.source === "box_office" && inPeriod(p.created_at));
  let cashCents = 0;
  if (cashRows.length > 0) {
    const tierIds = [...new Set(cashRows.map((p) => p.tier_id).filter((id): id is string => Boolean(id)))];
    const { data: tiers } = tierIds.length > 0
      ? await supabaseAdmin.from("ticket_tiers").select("id, price_eur").in("id", tierIds)
      : { data: [] };
    const priceById = new Map(((tiers ?? []) as { id: string; price_eur: number }[]).map((t) => [t.id, t.price_eur]));
    for (const p of cashRows) cashCents += p.tier_id ? priceById.get(p.tier_id) ?? 0 : 0;
  }

  // Season passes: their payouts rows carry season_pass_id instead of event_id,
  // so the event-scoped queries above never see them.
  const { data: passPayouts } = await supabaseAdmin
    .from("payouts")
    .select("stripe_session_id, net_cents, status")
    .eq("organizer_wallet", walletAddress)
    .not("season_pass_id", "is", null)
    .gte("created_at", periodStart.toISOString());

  const passRows = ((passPayouts ?? []) as {
    stripe_session_id: string | null; net_cents: number; status: string;
  }[]).filter((p) => p.status !== "refunded");

  const passSessions = passRows.map((p) => p.stripe_session_id).filter((id): id is string => Boolean(id));
  const { count: passTickets } = passSessions.length > 0
    ? await supabaseAdmin
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .in("stripe_session_id", passSessions)
        .is("revoked_at", null)
    : { count: 0 };

  return {
    boxOffice: { tickets: cashRows.length, revenueCents: cashCents },
    seasonPass: {
      tickets: passTickets ?? 0,
      revenueCents: passRows.reduce((sum, p) => sum + (p.net_cents ?? 0), 0),
    },
  };
}

async function loadBenchmark(walletAddress: string): Promise<unknown> {
  const { data, error } = await supabaseAdmin.rpc("platform_benchmark", { p_wallet: walletAddress });
  if (error || !data) return null;
  const row = (Array.isArray(data) ? data[0] : data) as {
    comparable_events: number; comparable_organizers: number;
    market_avg_price_cents: number | null; market_sell_through: number | null; market_repeat_share: number | null;
    you_avg_price_cents: number | null; you_sell_through: number | null; you_repeat_share: number | null;
    revenue_percentile: number | null;
  } | undefined;
  // A "benchmark" against a handful of organizers says nothing and would
  // out anyone's numbers by subtraction; below that the panel stays empty.
  if (!row || !row.comparable_events || row.comparable_organizers < MIN_BENCHMARK_ORGANIZERS) return null;
  return {
    comparableEvents: row.comparable_events,
    comparableOrganizers: row.comparable_organizers,
    percentile: row.revenue_percentile,
    rows: [
      { label: "Ø Ticketpreis", you: row.you_avg_price_cents, market: row.market_avg_price_cents, unit: "eur" },
      { label: "Auslastung", you: row.you_sell_through, market: row.market_sell_through, unit: "pct" },
      { label: "Wiederkehrer", you: row.you_repeat_share, market: row.market_repeat_share, unit: "pct" },
    ].filter((r) => r.you != null && r.market != null),
  };
}

const zeros = (n: number): number[] => new Array<number>(n).fill(0);

function emptyPayload(range: number) {
  return {
    range,
    kpis: {
      revenueCents: 0, revenuePrevCents: 0, revenueDelta: null,
      tickets: 0, ticketsPrev: 0, ticketsDelta: null,
      avgPriceCents: 0, avgPricePrevCents: 0,
      customers: 0, customersPrev: 0,
      repeatShare: 0, repeatSharePrev: 0,
      conversion: 0, conversionPrev: 0, views: 0,
    },
    series: {
      days: dayKeys(range),
      prevDays: dayKeys(range, new Date(Date.now() - range * DAY_MS)),
      revenue: zeros(range), revenuePrev: zeros(range),
      tickets: zeros(range), ticketsPrev: zeros(range),
      buyers: zeros(range), buyersPrev: zeros(range),
    },
    bestDay: null,
    funnel: FUNNEL_STAGES.map((s) => ({ key: s.key, label: s.label, count: 0 })),
    channels: [],
    forecasts: [],
    benchmark: null,
    events: [],
    offBook: {
      boxOffice: { tickets: 0, revenueCents: 0 },
      seasonPass: { tickets: 0, revenueCents: 0 },
    },
  };
}
