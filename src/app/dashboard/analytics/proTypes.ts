/** Wire types of the Pro dashboard APIs (analytics, customers, loyalty). */

export interface AnalyticsEventRow {
  id: string;
  name: string;
  date: string;
  capacity: number;
  ticketsSold: number;
  cancelled: boolean;
  revenueCents: number;
  redeemed: number;
  redemptionPct: number | null;
  avgPriceCents: number;
}

export interface AnalyticsData {
  range: number;
  kpis: {
    revenueCents: number; revenuePrevCents: number; revenueDelta: number | null;
    tickets: number; ticketsPrev: number; ticketsDelta: number | null;
    avgPriceCents: number; avgPricePrevCents: number;
    customers: number; customersPrev: number;
    repeatShare: number; repeatSharePrev: number;
    conversion: number; conversionPrev: number;
    views: number;
  };
  series: {
    days: string[]; prevDays: string[];
    revenue: number[]; revenuePrev: number[];
    tickets: number[]; ticketsPrev: number[];
    buyers: number[]; buyersPrev: number[];
  };
  bestDay: { date: string; revenueCents: number } | null;
  funnel: { key: string; label: string; count: number }[];
  channels: {
    name: string; visitors: number; buyers: number;
    revenueCents: number; sharePct: number; conversionPct: number;
  }[];
  forecasts: {
    id: string; name: string; date: string; daysLeft: number;
    sold: number; capacity: number; forecastPct: number;
    sellOutDate: string | null; pacePerDay: number;
    kind: 'ok' | 'warn' | 'neutral';
  }[];
  benchmark: {
    comparableEvents: number;
    comparableOrganizers: number;
    percentile: number | null;
    rows: { label: string; you: number; market: number; unit: 'eur' | 'pct' }[];
  } | null;
  events: AnalyticsEventRow[];
  /**
   * Revenue that exists but is deliberately outside the KPIs: box-office cash
   * (tickets counted, money never touched Passly) and season passes (belong to
   * no single date). Shown as "davon"-lines so the gap reads as a decision,
   * not a bug.
   */
  offBook?: {
    boxOffice: { tickets: number; revenueCents: number };
    seasonPass: { tickets: number; revenueCents: number };
  };
}

export type SegmentId = 'stamm' | 'risk' | 'neu' | 'vip';

export interface CustomerRow {
  wallet: string;
  email: string | null;
  tickets: number;
  events: number;
  redeemedEvents: number;
  spendCents: number;
  firstPurchase: string;
  lastPurchase: string;
  daysSinceFirst: number;
  daysSinceLast: number;
  tier: string | null;
  returnedWithin90: boolean;
}

export interface CustomersData {
  total: number;
  reachable: number;
  rules: { stammMinEvents: number; riskDays: number; neuDays: number; vipSpendCents: number };
  segments: { id: SegmentId; label: string; count: number; newThisWeek: number }[];
  cohorts: { month: string; label: string; size: number; cells: (number | null)[] }[];
  cohortWidth: number;
  customers: CustomerRow[];
}

export interface LoyaltyTier {
  id: string;
  name: string;
  badge: string;
  threshold: number;
  benefitTitle: string;
  benefitDescription: string | null;
  active: boolean;
  sort: number;
  members: number;
  claimed: number;
  redeemed: number;
  redeemRate: number;
}

export interface LoyaltyData {
  tiers: LoyaltyTier[];
  maxTiers: number;
  qualifiedCount: number;
  redemptions: {
    code: string; wallet: string; email: string | null;
    benefitTitle: string; tierName: string | null; redeemedAt: string;
  }[];
  impact: {
    memberCount: number;
    otherCount: number;
    rows: { label: string; unit: 'count' | 'eur' | 'pct'; member: number; other: number }[];
  };
}
