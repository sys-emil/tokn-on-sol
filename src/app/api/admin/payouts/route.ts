import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Admin API for manual payout resolution. Gated by ADMIN_SECRET (constant
 * server-side env value, sent as x-admin-secret header from /admin/payouts).
 *
 * GET  → all payouts needing attention (held / failed / disputed) plus recent rows.
 * POST → { payoutId, action }
 *   - "retry":   held/failed → pending (next cron run re-attempts the transfer)
 *   - "release": disputed → pending (dispute resolved in platform's favour)
 *   - "cancel":  → failed with reason (funds stay on platform, e.g. dispute lost)
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("payouts")
    .select("*, events(name, date)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ payouts: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { payoutId?: string; action?: string };
  try {
    body = (await req.json()) as { payoutId?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { payoutId, action } = body;
  if (!payoutId || !action) {
    return NextResponse.json({ error: "payoutId and action are required" }, { status: 400 });
  }

  const { data: payout } = await supabaseAdmin
    .from("payouts")
    .select("id, status")
    .eq("id", payoutId)
    .maybeSingle();

  if (!payout) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (action === "retry" && (payout.status === "held" || payout.status === "failed")) {
    await supabaseAdmin
      .from("payouts")
      .update({ status: "pending", failure_reason: null, updated_at: now })
      .eq("id", payoutId);
    return NextResponse.json({ success: true, status: "pending" });
  }

  if (action === "release" && payout.status === "disputed") {
    await supabaseAdmin
      .from("payouts")
      .update({ status: "pending", failure_reason: null, updated_at: now })
      .eq("id", payoutId);
    return NextResponse.json({ success: true, status: "pending" });
  }

  // 'refunded' is terminal; the buyer got the money back; nothing to retry,
  // release, or cancel.
  if (action === "cancel" && payout.status !== "paid" && payout.status !== "refunded") {
    await supabaseAdmin
      .from("payouts")
      .update({ status: "failed", failure_reason: "Cancelled by admin", updated_at: now })
      .eq("id", payoutId);
    return NextResponse.json({ success: true, status: "failed" });
  }

  return NextResponse.json(
    { error: `Action "${action}" is not valid for status "${payout.status}"` },
    { status: 409 },
  );
}
