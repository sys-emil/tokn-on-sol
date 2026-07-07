import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { transferCnft, getOperatorWalletAddress } from "@/lib/transfer";
import { heliusRpcUrl } from "@/lib/solana";

export const dynamic = "force-dynamic";

interface ReissueBody {
  assetId: string;
}

interface DasAsset {
  result?: { ownership?: { owner?: string; delegate?: string } };
}

/**
 * Support re-issue: a buyer lost access to their e-mail account (and with it
 * their embedded wallet). This creates a one-time claim link for their ticket
 * — the same escrow flow as buyer-initiated transfers, only initiated by the
 * admin instead of the (unreachable) owner. The buyer opens the link, logs in
 * with their NEW e-mail address, and the ticket moves to the new account.
 *
 * Support process: verify the requester's identity out-of-band first (e.g.
 * Stripe receipt of the purchase, order e-mail), then:
 *   curl -X POST https://getpassly.de/api/admin/reissue \
 *     -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" \
 *     -d '{"assetId":"<asset>"}'
 * and send the returned claim URL to the buyer's new address.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.ADMIN_SECRET || req.headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: ReissueBody;
  try {
    body = (await req.json()) as ReissueBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const { assetId } = body;
  if (!assetId || typeof assetId !== "string") {
    return NextResponse.json({ success: false, error: "assetId is required" }, { status: 400 });
  }

  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("redeemed_at, revoked_at")
    .eq("asset_id", assetId)
    .maybeSingle();
  if (!purchase) {
    return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
  }
  if (purchase.redeemed_at) {
    return NextResponse.json({ success: false, error: "Ticket has already been redeemed" }, { status: 409 });
  }
  if (purchase.revoked_at) {
    return NextResponse.json({ success: false, error: "Ticket is revoked (refunded)" }, { status: 409 });
  }

  const assetRes = await fetch(heliusRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "reissue-owner", method: "getAsset", params: { id: assetId } }),
    cache: "no-store",
  });
  if (!assetRes.ok) {
    return NextResponse.json({ success: false, error: "Ownership check failed" }, { status: 502 });
  }
  const assetJson = (await assetRes.json()) as DasAsset;
  const onChainOwner = assetJson.result?.ownership?.owner;
  const onChainDelegate = assetJson.result?.ownership?.delegate;
  const operatorWallet = getOperatorWalletAddress();

  if (!onChainOwner) {
    return NextResponse.json({ success: false, error: "Asset not found on-chain" }, { status: 404 });
  }
  if (onChainOwner !== operatorWallet && onChainDelegate !== operatorWallet) {
    return NextResponse.json({ success: false, error: "not_delegated — operator cannot move this asset" }, { status: 400 });
  }

  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // An unclaimed link may already exist (e.g. the buyer created one before
  // losing the account, or support ran this twice) — reuse it.
  const { data: existingClaim } = await supabaseAdmin
    .from("claims")
    .select("token, claimed_at")
    .eq("asset_id", assetId)
    .maybeSingle();
  if (existingClaim && !existingClaim.claimed_at) {
    return NextResponse.json({ success: true, url: `${baseUrl}/claim/${existingClaim.token as string}`, reused: true });
  }

  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
  const { error: insertError } = await supabaseAdmin
    .from("claims")
    .insert({ asset_id: assetId, token, seller_wallet: onChainOwner });
  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  // Move the ticket into operator escrow (skipped if a previous claim flow
  // already left it there).
  if (onChainOwner !== operatorWallet) {
    try {
      await transferCnft({ assetId, fromWallet: onChainOwner, toWallet: operatorWallet });
    } catch (err) {
      await supabaseAdmin.from("claims").delete().eq("token", token);
      const message = err instanceof Error ? err.message : "Transfer failed";
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  }

  return NextResponse.json({ success: true, url: `${baseUrl}/claim/${token}` });
}
