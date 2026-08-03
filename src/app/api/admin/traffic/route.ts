import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";
import {
  DAY_MS,
  channelFromReferrer,
  dayKey,
  dayKeys,
  parseRange,
  pctChange,
  share,
  startOfDay,
  type Channel,
} from "@/lib/proAnalytics";

export const dynamic = "force-dynamic";

/**
 * Platform-wide web traffic for the admin dashboard, built from the
 * consent-gated `analytics_events` table (see /api/track).
 *
 * Important caveat, surfaced in the UI: only visitors who accepted the cookie
 * banner are counted, so every number here is a lower bound on real traffic.
 *
 * Gated by ADMIN_SECRET via the x-admin-secret header, same as the other
 * /api/admin/* routes. Row volume is tiny (one row per tracked interaction),
 * so the aggregation runs in-process instead of in SQL.
 */
/** Hard ceiling so a traffic spike can never blow up the response. */
const MAX_ROWS = 100_000;

/** Gap after which a visitor's next hit starts a new session. */
const SESSION_GAP_MS = 30 * 60 * 1000;

const RECENT_LIMIT = 25;

/**
 * Funnel stages, in order. Der Besuch ist zweistufig (Showcase /event/<id> →
 * Kaufseite /shop/<id>); beide senden `page_view` und werden am Pfad getrennt.
 * Muss mit FUNNEL_STAGES in /api/organizer/analytics deckungsgleich bleiben.
 */
const FUNNEL_STAGES = [
  { key: "event_view", label: "Event-Seite besucht" },
  { key: "shop_view", label: "Kaufseite besucht" },
  { key: "ticket_selected", label: "Ticket ausgewählt" },
  { key: "checkout_started", label: "Checkout gestartet" },
  { key: "purchase_completed", label: "Kauf abgeschlossen" },
] as const;

/** Stufe eines Ereignisses; NULL, wenn der Pfad zu keiner Stufe gehört. */
function stageKeyOf(name: string, path: string | null): string | null {
  if (name !== "page_view") return name;
  if (path?.startsWith("/event/")) return "event_view";
  if (path?.startsWith("/shop/")) return "shop_view";
  return null;
}

export type TrafficMetric = {
  current: number;
  previous: number;
  /** Percentage change vs. the previous period; null when there is no base. */
  changePct: number | null;
};

export type TrafficPage = { path: string; views: number; visitors: number };
export type TrafficEventPage = { eventId: string; name: string; views: number; visitors: number };
export type TrafficChannel = { channel: Channel; visitors: number; views: number; sharePct: number };
export type TrafficReferrer = { host: string; views: number; visitors: number };
export type TrafficFunnelStage = { key: string; label: string; count: number };
export type TrafficHit = { name: string; path: string | null; source: string; createdAt: string };

export type TrafficPayload = {
  rangeDays: number;
  /** True when MAX_ROWS clipped the read; the numbers are then incomplete. */
  truncated: boolean;
  kpis: {
    pageViews: TrafficMetric;
    visitors: TrafficMetric;
    sessions: TrafficMetric;
    /** Page views per session, one decimal. */
    viewsPerSession: TrafficMetric;
    /** Share of sessions with a single page view, in percent. */
    bounceRatePct: TrafficMetric;
  };
  series: { days: string[]; views: number[]; visitors: number[]; previousViews: number[] };
  topPages: TrafficPage[];
  topEvents: TrafficEventPage[];
  channels: TrafficChannel[];
  topReferrers: TrafficReferrer[];
  funnel: TrafficFunnelStage[];
  recent: TrafficHit[];
};

interface Row {
  name: string;
  path: string | null;
  cid: string;
  referrer: string | null;
  created_at: string;
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Collapses id-bearing paths into their route pattern so "/shop/<uuid>" hits
 * aggregate into one row. Handles (/@name) stay concrete — the handle is the
 * interesting part there.
 */
function normalizePath(path: string | null): string {
  if (!path) return "(unbekannt)";
  const parts = path.split("/");
  const mapped = parts.map((part, i) => {
    if (i === 0 || !part) return part;
    if (UUID_RE.test(part)) return "[id]";
    if (BASE58_RE.test(part)) return "[id]";
    return part;
  });
  return mapped.join("/") || "/";
}

/** Display host of a referrer; empty string for direct traffic. */
function referrerHost(referrer: string | null): string {
  if (!referrer) return "";
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Counts sessions and single-view (bounce) sessions per visitor from their
 * page-view timestamps: a gap longer than SESSION_GAP_MS starts a new session.
 */
function sessionStats(hits: Map<string, number[]>): { sessions: number; bounces: number } {
  let sessions = 0;
  let bounces = 0;
  for (const stamps of hits.values()) {
    stamps.sort((a, b) => a - b);
    let inSession = 0;
    let last = -Infinity;
    for (const ts of stamps) {
      if (ts - last > SESSION_GAP_MS) {
        if (inSession === 1) bounces++;
        sessions++;
        inSession = 0;
      }
      inSession++;
      last = ts;
    }
    if (inSession === 1) bounces++;
  }
  return { sessions, bounces };
}

function metric(current: number, previous: number): TrafficMetric {
  return { current, previous, changePct: pctChange(current, previous) };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const range = parseRange(new URL(req.url).searchParams.get("range"));
  const today = startOfDay(new Date());
  const periodStart = new Date(today.getTime() - (range - 1) * DAY_MS);
  const prevStart = new Date(periodStart.getTime() - range * DAY_MS);

  // Newest first, so hitting the cap drops the oldest rows rather than the
  // ones the admin is most likely looking at.
  const { data, error } = await supabaseAdmin
    .from("analytics_events")
    .select("name, path, cid, referrer, created_at")
    .gte("created_at", prevStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const host = appHost();

  const currentKeys = dayKeys(range, today);
  const prevKeys = dayKeys(range, new Date(periodStart.getTime() - DAY_MS));
  const curIndex = new Map(currentKeys.map((k, i) => [k, i]));
  const prevIndex = new Map(prevKeys.map((k, i) => [k, i]));

  const viewsByDay = new Array<number>(range).fill(0);
  const prevViewsByDay = new Array<number>(range).fill(0);
  const visitorsByDay = Array.from({ length: range }, () => new Set<string>());

  let viewsCurrent = 0;
  let viewsPrevious = 0;
  const visitorsCurrent = new Set<string>();
  const visitorsPrevious = new Set<string>();
  const hitsCurrent = new Map<string, number[]>();
  const hitsPrevious = new Map<string, number[]>();

  const pageAgg = new Map<string, { views: number; visitors: Set<string> }>();
  const eventAgg = new Map<string, { views: number; visitors: Set<string> }>();
  const referrerAgg = new Map<string, { views: number; visitors: Set<string> }>();
  const channelAgg = new Map<Channel, { visitors: number; views: number }>();
  // First referrer wins per visitor: the entry point is the acquisition
  // source; later same-site hops would just dilute it.
  const channelByCid = new Map<string, Channel>();

  const stageCids: Record<string, Set<string>> = {};
  for (const s of FUNNEL_STAGES) stageCids[s.key] = new Set();

  const bump = (map: Map<string, { views: number; visitors: Set<string> }>, key: string, cid: string): void => {
    const entry = map.get(key) ?? { views: 0, visitors: new Set<string>() };
    entry.views += 1;
    entry.visitors.add(cid);
    map.set(key, entry);
  };

  // Oldest first, so the first-touch channel per visitor is the actual first one.
  for (const row of [...rows].reverse()) {
    const at = new Date(row.created_at);
    const key = dayKey(at);
    const isCurrent = at >= periodStart;
    const isPageView = row.name === "page_view";

    if (!isCurrent) {
      visitorsPrevious.add(row.cid);
      if (isPageView) {
        viewsPrevious++;
        const stamps = hitsPrevious.get(row.cid);
        if (stamps) stamps.push(at.getTime());
        else hitsPrevious.set(row.cid, [at.getTime()]);
        const pi = prevIndex.get(key);
        if (pi !== undefined) prevViewsByDay[pi] += 1;
      }
      continue;
    }

    visitorsCurrent.add(row.cid);

    let channel = channelByCid.get(row.cid);
    if (!channel) {
      channel = channelFromReferrer(row.referrer, host);
      channelByCid.set(row.cid, channel);
      const entry = channelAgg.get(channel) ?? { visitors: 0, views: 0 };
      entry.visitors += 1;
      channelAgg.set(channel, entry);
    }

    if (isPageView) {
      viewsCurrent++;
      channelAgg.get(channel)!.views += 1;
      const stamps = hitsCurrent.get(row.cid);
      if (stamps) stamps.push(at.getTime());
      else hitsCurrent.set(row.cid, [at.getTime()]);

      const ci = curIndex.get(key);
      if (ci !== undefined) {
        viewsByDay[ci] += 1;
        visitorsByDay[ci].add(row.cid);
      }

      bump(pageAgg, normalizePath(row.path), row.cid);

      const rHost = referrerHost(row.referrer);
      if (rHost && !(host && (rHost === host || rHost.endsWith(`.${host}`)))) {
        bump(referrerAgg, rHost, row.cid);
      }

      // Event landing pages, keyed by event id. Showcase und Kaufseite zaehlen
      // auf dieselbe ID ein (ignoriert /shop/<id>/success).
      const segments = (row.path ?? "").split("/");
      if (segments.length === 3 && (segments[1] === "shop" || segments[1] === "event") && UUID_RE.test(segments[2])) {
        bump(eventAgg, segments[2], row.cid);
      }
    }

    // Funnel: nur Event- und Kaufseiten, damit er die Definition des
    // Pro-Dashboards spiegelt.
    const stage = stageKeyOf(row.name, row.path);
    if (stage && stageCids[stage]
        && (row.path?.startsWith("/shop/") || row.path?.startsWith("/event/"))) {
      stageCids[stage].add(row.cid);
    }
  }

  const curSessions = sessionStats(hitsCurrent);
  const prevSessions = sessionStats(hitsPrevious);

  // Resolve event names for the shop pages that actually got traffic.
  const eventIds = [...eventAgg.entries()]
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 10)
    .map(([id]) => id);
  const nameById = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: eventRows } = await supabaseAdmin.from("events").select("id, name").in("id", eventIds);
    for (const e of (eventRows ?? []) as { id: string; name: string }[]) nameById.set(e.id, e.name);
  }

  const payload: TrafficPayload = {
    rangeDays: range,
    truncated: rows.length >= MAX_ROWS,
    kpis: {
      pageViews: metric(viewsCurrent, viewsPrevious),
      visitors: metric(visitorsCurrent.size, visitorsPrevious.size),
      sessions: metric(curSessions.sessions, prevSessions.sessions),
      viewsPerSession: metric(
        round1(curSessions.sessions ? viewsCurrent / curSessions.sessions : 0),
        round1(prevSessions.sessions ? viewsPrevious / prevSessions.sessions : 0),
      ),
      bounceRatePct: metric(
        share(curSessions.bounces, curSessions.sessions),
        share(prevSessions.bounces, prevSessions.sessions),
      ),
    },
    series: {
      days: currentKeys,
      views: viewsByDay,
      visitors: visitorsByDay.map((s) => s.size),
      previousViews: prevViewsByDay,
    },
    topPages: [...pageAgg.entries()]
      .map(([path, v]) => ({ path, views: v.views, visitors: v.visitors.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15),
    topEvents: eventIds.map((id) => ({
      eventId: id,
      name: nameById.get(id) ?? "Gelöschtes Event",
      views: eventAgg.get(id)!.views,
      visitors: eventAgg.get(id)!.visitors.size,
    })),
    channels: [...channelAgg.entries()]
      .map(([channel, v]) => ({
        channel,
        visitors: v.visitors,
        views: v.views,
        sharePct: share(v.visitors, visitorsCurrent.size),
      }))
      .sort((a, b) => b.visitors - a.visitors),
    topReferrers: [...referrerAgg.entries()]
      .map(([host_, v]) => ({ host: host_, views: v.views, visitors: v.visitors.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    funnel: FUNNEL_STAGES.map((s) => ({ key: s.key, label: s.label, count: stageCids[s.key].size })),
    recent: rows.slice(0, RECENT_LIMIT).map((r) => ({
      name: r.name,
      path: r.path,
      source: referrerHost(r.referrer) || "direkt",
      createdAt: r.created_at,
    })),
  };

  return NextResponse.json(payload);
}
