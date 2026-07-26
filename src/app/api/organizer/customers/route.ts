import { NextRequest, NextResponse } from "next/server";
import { requireProOrganizer } from "@/lib/plan";
import { loadCustomers } from "@/lib/organizerCustomers";
import {
  SEGMENT_LABEL,
  SEGMENT_RULES,
  buildCohorts,
  inSegment,
  monthLabel,
  recentMonths,
  startOfDay,
} from "@/lib/proAnalytics";

export const dynamic = "force-dynamic";

const COHORT_MONTHS = 6;
const COHORT_WIDTH = 6;
const MAX_CUSTOMERS = 500;

/**
 * Pro "Kunden" tab: segments, cohort retention and the customer list of one
 * organizer. Same money rule as the analytics route — a session's gross is
 * spread over its tickets, so lifetime spend is what the guest actually paid.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress") ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const customers = await loadCustomers(walletAddress);

  const now = startOfDay(new Date());
  const segments = (["stamm", "risk", "neu", "vip"] as const).map((id) => ({
    id,
    label: SEGMENT_LABEL[id],
    count: customers.filter((c) => inSegment(id, c)).length,
    newThisWeek: customers.filter((c) => inSegment(id, c) && c.daysSinceFirst <= 7).length,
  }));

  const cohorts = buildCohorts(
    customers.map((c) => ({ wallet: c.wallet, months: c.purchaseMonths })),
    recentMonths(COHORT_MONTHS, now),
    COHORT_WIDTH,
    now,
  ).map((row) => ({ ...row, label: monthLabel(row.month) }));

  return NextResponse.json({
    total: customers.length,
    rules: SEGMENT_RULES,
    segments,
    cohorts,
    cohortWidth: COHORT_WIDTH,
    reachable: customers.filter((c) => c.email).length,
    customers: customers
      .sort((a, b) => b.spendCents - a.spendCents)
      .slice(0, MAX_CUSTOMERS)
      // purchaseMonths only feeds the cohort matrix above; it never ships.
      .map(({ purchaseMonths, ...row }) => { void purchaseMonths; return row; }),
  });
}
