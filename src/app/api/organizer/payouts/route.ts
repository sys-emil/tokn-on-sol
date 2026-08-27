import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/sessionUser";
import { outstandingFees } from "@/lib/platformFees";

export const dynamic = "force-dynamic";

/**
 * Payout transparency for organizers (free feature; trust in the money flow
 * shouldn't be paywalled): every payout row of the organizer plus a summary
 * of what's pending, when it arrives, and what already got transferred.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress") ?? "";
  if (!walletAddress || !(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows } = await supabaseAdmin
    .from("payouts")
    .select("id, event_id, season_pass_id, gross_cents, net_cents, status, available_at, updated_at, created_at, failure_reason")
    .eq("organizer_wallet", walletAddress)
    .order("created_at", { ascending: false })
    .limit(200);

  const payouts = (rows ?? []) as {
    id: string;
    event_id: string | null;
    /** Set instead of event_id when the sale was a season pass. */
    season_pass_id: string | null;
    gross_cents: number;
    net_cents: number;
    status: string;
    available_at: string;
    updated_at: string | null;
    created_at: string;
    failure_reason: string | null;
  }[];

  // A payout belongs to either an event or a season pass; both need a name
  // for the list.
  const eventIds = [...new Set(payouts.map((p) => p.event_id).filter((id): id is string => Boolean(id)))];
  const passIds = [...new Set(payouts.map((p) => p.season_pass_id).filter((id): id is string => Boolean(id)))];
  const eventNames = new Map<string, string>();
  const passNames = new Map<string, string>();
  const [{ data: events }, { data: passes }] = await Promise.all([
    eventIds.length > 0
      ? supabaseAdmin.from("events").select("id, name").in("id", eventIds)
      : Promise.resolve({ data: [] }),
    passIds.length > 0
      ? supabaseAdmin.from("season_passes").select("id, name").in("id", passIds)
      : Promise.resolve({ data: [] }),
  ]);
  for (const e of (events ?? []) as { id: string; name: string }[]) eventNames.set(e.id, e.name);
  for (const p of (passes ?? []) as { id: string; name: string }[]) passNames.set(p.id, p.name);

  let pendingCents = 0;
  let paidCents = 0;
  let heldCount = 0;
  let nextAvailableAt: string | null = null;
  for (const p of payouts) {
    if (p.status === "pending") {
      pendingCents += p.net_cents;
      if (!nextAvailableAt || p.available_at < nextAvailableAt) nextAvailableAt = p.available_at;
    } else if (p.status === "paid") {
      paidCents += p.net_cents;
    } else if (p.status === "held" || p.status === "disputed") {
      heldCount++;
    }
  }

  // Service fees collected in cash at the box office. They are deducted from
  // the next transfer, so the organizer has to be able to see them coming;
  // an unexplained shortfall on a payout is exactly the kind of surprise that
  // costs trust.
  const fees = await outstandingFees(walletAddress);

  return NextResponse.json({
    summary: {
      pendingCents, paidCents, heldCount, nextAvailableAt,
      outstandingFees: fees.totalCents,
      outstandingBoxOffice: fees.boxOfficeCents,
      outstandingCancellation: fees.cancellationCents,
      outstandingChargeback: fees.chargebackCents,
    },
    payouts: payouts.map((p) => ({
      id: p.id,
      eventName: (p.event_id ? eventNames.get(p.event_id) : null)
        ?? (p.season_pass_id ? passNames.get(p.season_pass_id) : null)
        ?? "–",
      seasonPass: Boolean(p.season_pass_id),
      netCents: p.net_cents,
      status: p.status,
      availableAt: p.available_at,
      createdAt: p.created_at,
    })),
  });
}
