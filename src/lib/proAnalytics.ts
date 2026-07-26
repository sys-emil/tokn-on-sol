/**
 * Pure helpers behind the Pro dashboard (analytics, customers, forecast).
 *
 * Everything here is side-effect free so it can be unit-tested and reused by
 * both the analytics and the customers route. The Supabase reads live in the
 * route handlers; this module only turns rows into numbers.
 */

/** Selectable comparison windows in the Pro dashboard. */
export const RANGES = [7, 30, 90, 365] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(raw: string | null): Range {
  const n = Number(raw);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

/**
 * Midnight UTC of the given day. Everything in the Pro dashboard buckets by
 * UTC so the day keys derived from Postgres timestamps and the ones generated
 * here always agree (Vercel runs in UTC; a local dev box must not shift the
 * series by a day).
 */
export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export const DAY_MS = 86_400_000;

export function dayKey(iso: string | Date): string {
  return (typeof iso === "string" ? new Date(iso) : iso).toISOString().slice(0, 10);
}

/** Consecutive day keys, oldest first, ending today. */
export function dayKeys(days: number, end = new Date()): string[] {
  const last = startOfDay(end);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(new Date(last.getTime() - i * DAY_MS)));
  return keys;
}

/** Percentage change, rounded to one decimal. `null` when there is no base. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Share of `part` in `total` as a percentage with one decimal. */
export function share(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/* ── Attribution ─────────────────────────────────────────────────────────── */

export const CHANNELS = [
  "Instagram",
  "TikTok",
  "Direkt / Link",
  "WhatsApp",
  "Google",
  "Facebook",
  "Sonstige",
] as const;
export type Channel = (typeof CHANNELS)[number];

const CHANNEL_HOSTS: { match: RegExp; channel: Channel }[] = [
  { match: /(^|\.)instagram\.com$|(^|\.)ig\.me$|(^|\.)l\.instagram\.com$/, channel: "Instagram" },
  { match: /(^|\.)tiktok\.com$/, channel: "TikTok" },
  { match: /(^|\.)whatsapp\.com$|(^|\.)wa\.me$/, channel: "WhatsApp" },
  { match: /(^|\.)google\.[a-z.]+$/, channel: "Google" },
  { match: /(^|\.)facebook\.com$|(^|\.)fb\.me$|(^|\.)m\.facebook\.com$/, channel: "Facebook" },
];

/**
 * Maps a referrer URL to a marketing channel. Empty referrers are direct
 * traffic (typed link, QR code, WhatsApp/Story link without referrer), which
 * is exactly the "Direkt / Link" bucket organizers care about.
 */
export function channelFromReferrer(referrer: string | null | undefined, selfHost?: string): Channel {
  if (!referrer) return "Direkt / Link";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "Sonstige";
  }
  if (selfHost && (host === selfHost || host.endsWith(`.${selfHost}`))) return "Direkt / Link";
  for (const { match, channel } of CHANNEL_HOSTS) if (match.test(host)) return channel;
  return "Sonstige";
}

/* ── Verkaufsprognose ────────────────────────────────────────────────────── */

export interface ForecastInput {
  sold: number;
  capacity: number;
  /** Tickets sold per day over the recent window, oldest first. */
  recentSales: number[];
  /** Whole days between today and the event date; negative for past events. */
  daysLeft: number;
}

export interface Forecast {
  /** Projected share of capacity sold at event start, 0–100. */
  forecastPct: number;
  /** Days until capacity is reached at the current pace, or null. */
  daysToSellOut: number | null;
  pace: number;
  kind: "ok" | "warn" | "neutral";
}

/**
 * Straight-line projection from the recent selling pace. Deliberately simple
 * and explainable: organizers should be able to redo the maths in their head,
 * and a fancier model would only pretend to a precision the data can't carry.
 * Anything with fewer than a handful of data points stays "neutral".
 */
export function forecastEvent({ sold, capacity, recentSales, daysLeft }: ForecastInput): Forecast {
  const window = recentSales.length || 1;
  const pace = recentSales.reduce((a, b) => a + b, 0) / window;
  const remaining = Math.max(capacity - sold, 0);

  if (daysLeft <= 0 || capacity <= 0) {
    return { forecastPct: capacity > 0 ? Math.round((sold / capacity) * 100) : 0, daysToSellOut: null, pace, kind: "neutral" };
  }

  const projected = Math.min(sold + pace * daysLeft, capacity);
  const forecastPct = Math.round((projected / capacity) * 100);
  const daysToSellOut = pace > 0 && remaining > 0 ? Math.ceil(remaining / pace) : remaining === 0 ? 0 : null;

  // Too little history to say anything: an event that just went on sale looks
  // identical to one that stalled.
  const enoughSignal = recentSales.length >= 5 && sold >= 5;
  const kind: Forecast["kind"] = !enoughSignal
    ? "neutral"
    : forecastPct >= 95
      ? "ok"
      : forecastPct < 70
        ? "warn"
        : "neutral";

  return { forecastPct, daysToSellOut, pace, kind };
}

/* ── Kundensegmente ──────────────────────────────────────────────────────── */

export const SEGMENTS = ["stamm", "risk", "neu", "vip", "alle"] as const;
export type Segment = (typeof SEGMENTS)[number];

export function parseSegment(raw: string | null | undefined): Segment {
  return (SEGMENTS as readonly string[]).includes(raw ?? "") ? (raw as Segment) : "alle";
}

export const SEGMENT_LABEL: Record<Exclude<Segment, "alle">, string> = {
  stamm: "Stammgäste",
  risk: "Gefährdet",
  neu: "Neu",
  vip: "VIP",
};

export interface CustomerStats {
  /** Distinct events with at least one non-revoked ticket. */
  events: number;
  /** Lifetime spend in cents (gross, what the guest paid for tickets). */
  spendCents: number;
  /** Days since the last purchase. */
  daysSinceLast: number;
  /** Days since the first purchase. */
  daysSinceFirst: number;
}

/** Thresholds match the wording on the segment cards. */
export const SEGMENT_RULES = {
  stammMinEvents: 3,
  riskDays: 60,
  neuDays: 30,
  vipSpendCents: 50_000,
} as const;

export function inSegment(segment: Segment, c: CustomerStats): boolean {
  switch (segment) {
    case "stamm":
      return c.events >= SEGMENT_RULES.stammMinEvents;
    case "risk":
      return c.events >= 2 && c.daysSinceLast >= SEGMENT_RULES.riskDays;
    case "neu":
      return c.daysSinceFirst <= SEGMENT_RULES.neuDays;
    case "vip":
      return c.spendCents >= SEGMENT_RULES.vipSpendCents;
    default:
      return true;
  }
}

/* ── Kohorten ────────────────────────────────────────────────────────────── */

export function monthKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Whole months from `from` to `to` (both month keys, `YYYY-MM`). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** The last `count` month keys, oldest first, ending in the month of `end`. */
export function recentMonths(count: number, end = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

export const MONTH_LABEL = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function monthLabel(key: string): string {
  const month = Number(key.split("-")[1]);
  return MONTH_LABEL[month - 1] ?? key;
}

/**
 * Retention matrix: for every cohort (first-purchase month) the share of its
 * members that bought again in month +n. Month 0 is always 100 %; cells in the
 * future are `null` so the UI can render them as "not yet known".
 */
export function buildCohorts(
  buyers: { wallet: string; months: Set<string> }[],
  cohortMonths: string[],
  width: number,
  now = new Date(),
): { month: string; size: number; cells: (number | null)[] }[] {
  const currentMonth = monthKey(now);
  const byCohort = new Map<string, string[][]>();

  for (const buyer of buyers) {
    const months = [...buyer.months].sort();
    const first = months[0];
    if (!first || !cohortMonths.includes(first)) continue;
    if (!byCohort.has(first)) byCohort.set(first, []);
    byCohort.get(first)!.push(months);
  }

  return cohortMonths.map((cohort) => {
    const members = byCohort.get(cohort) ?? [];
    const cells: (number | null)[] = [];
    for (let offset = 0; offset < width; offset++) {
      if (monthsBetween(cohort, currentMonth) < offset) {
        cells.push(null);
        continue;
      }
      if (members.length === 0) {
        cells.push(0);
        continue;
      }
      const active = members.filter((months) =>
        months.some((m) => monthsBetween(cohort, m) === offset),
      ).length;
      cells.push(Math.round((active / members.length) * 100));
    }
    return { month: cohort, size: members.length, cells };
  });
}
