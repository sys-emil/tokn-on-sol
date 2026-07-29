import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadGuestOrder } from "@/lib/guestOrders";
import { getOperatorWalletAddress, transferCnft } from "@/lib/transfer";
import { getAssetOwner } from "@/lib/resale";
import { requestOwnsWallet } from "@/lib/privyServer";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // one on-chain transfer per ticket

/**
 * Moves every ticket of a guest order out of operator escrow into the wallet of
 * the now-signed-in buyer.
 *
 * Two credentials are required together: the order token (proves possession of
 * the mail) and a Privy session owning the target wallet (proves where the
 * tickets should go). The token alone must not be enough to send tickets to an
 * arbitrary address.
 *
 * Partial success is real: each ticket is its own on-chain transfer. Tickets
 * that moved stay moved and are reported; the order is only marked claimed once
 * nothing is left in escrow, so a retry picks up the remainder.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`guest-claim:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { token?: string; claimerWallet?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const claimerWallet = (body.claimerWallet ?? "").trim();
  if (!token || !claimerWallet) {
    return NextResponse.json(
      { success: false, error: "token and claimerWallet are required" },
      { status: 400 },
    );
  }

  if (!(await requestOwnsWallet(req, claimerWallet))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const order = await loadGuestOrder(token);
  if (!order) {
    return NextResponse.json({ success: false, error: "Bestellung nicht gefunden." }, { status: 404 });
  }
  if (order.claimed_at) {
    return NextResponse.json(
      { success: false, error: "Diese Tickets wurden bereits übernommen." },
      { status: 409 },
    );
  }

  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("asset_id, revoked_at")
    .eq("stripe_session_id", order.stripe_session_id);

  const assets = ((purchases ?? []) as { asset_id: string; revoked_at: string | null }[])
    .filter((p) => !p.revoked_at)
    .map((p) => p.asset_id);
  if (assets.length === 0) {
    return NextResponse.json(
      { success: false, error: "Zu dieser Bestellung gibt es keine gültigen Tickets." },
      { status: 409 },
    );
  }

  const operator = getOperatorWalletAddress();
  const moved: string[] = [];
  const failed: string[] = [];

  for (const assetId of assets) {
    try {
      // Skip anything already out of escrow (a retry after a partial run).
      const owner = await getAssetOwner(assetId);
      if (owner && owner !== operator) {
        if (owner === claimerWallet) moved.push(assetId);
        else failed.push(assetId);
        continue;
      }
      await transferCnft({ assetId, fromWallet: operator, toWallet: claimerWallet });
      await supabaseAdmin
        .from("purchases")
        .update({ buyer_wallet: claimerWallet })
        .eq("asset_id", assetId);
      moved.push(assetId);
    } catch (err) {
      console.error(`Guest claim transfer failed for ${assetId}:`, err);
      failed.push(assetId);
    }
  }

  if (failed.length === 0) {
    await supabaseAdmin
      .from("guest_orders")
      .update({ claimed_at: new Date().toISOString(), claimer_wallet: claimerWallet })
      .eq("id", order.id)
      .is("claimed_at", null);
  }

  return NextResponse.json({
    success: moved.length > 0,
    claimed: moved.length,
    failed: failed.length,
    ...(failed.length > 0
      ? { error: `${failed.length} Ticket(s) konnten nicht übernommen werden. Bitte versuch es gleich noch einmal.` }
      : {}),
  });
}
