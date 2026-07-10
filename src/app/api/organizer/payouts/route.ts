import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

export const dynamic = "force-dynamic";

/**
 * Payout transparency for organizers (free feature — trust in the money flow
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
    .select("id, event_id, gross_cents, net_cents, status, available_at, updated_at, created_at, failure_reason")
    .eq("organizer_wallet", walletAddress)
    .order("created_at", { ascending: false })
    .limit(200);

  const payouts = (rows ?? []) as {
    id: string;
    event_id: string;
    gross_cents: number;
    net_cents: number;
    status: string;
    available_at: string;
    updated_at: string | null;
    created_at: string;
    failure_reason: string | null;
  }[];

  const eventIds = [...new Set(payouts.map((p) => p.event_id))];
  const eventNames = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: events } = await supabaseAdmin
      .from("events")
      .select("id, name")
      .in("id", eventIds);
    for (const e of (events ?? []) as { id: string; name: string }[]) eventNames.set(e.id, e.name);
  }

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

  return NextResponse.json({
    summary: { pendingCents, paidCents, heldCount, nextAvailableAt },
    payouts: payouts.map((p) => ({
      id: p.id,
      eventName: eventNames.get(p.event_id) ?? "—",
      netCents: p.net_cents,
      status: p.status,
      availableAt: p.available_at,
      createdAt: p.created_at,
    })),
  });
}
