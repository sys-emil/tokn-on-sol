import { requestUser } from "@/lib/sessionUser";
import { supabaseAdmin } from "@/lib/supabase";
import { transferCnft, getOperatorWalletAddress } from "@/lib/transfer";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/claims/[token]; public preview
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  const { data: claim } = await supabaseAdmin
    .from("claims")
    .select("asset_id, claimed_at")
    .eq("token", token)
    .maybeSingle();

  if (!claim) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  const assetId = claim.asset_id as string;

  // Fetch event info via purchases
  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("event_id")
    .eq("asset_id", assetId)
    .maybeSingle();

  const { data: event } = purchase?.event_id
    ? await supabaseAdmin
        .from("events")
        .select("name, date")
        .eq("id", purchase.event_id)
        .maybeSingle()
    : { data: null };

  return NextResponse.json({
    found: true,
    assetId,
    eventName: (event?.name ?? "") as string,
    eventDate: (event?.date ?? "") as string,
    claimed: !!(claim.claimed_at as string | null),
    claimedAt: (claim.claimed_at as string | null) ?? null,
  });
}

// POST /api/claims/[token]/redeem; authenticated claim
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  // Das Ziel der Einloesung ist die abgeleitete Adresse der Sitzung. Der Token
  // im Link ist der Anspruch, die Anmeldung sagt, wem er zugutekommt.
  const user = await requestUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const claimerWallet = user.walletAddress;

  // Atomic claim: update only if unclaimed
  const now = new Date().toISOString();
  const { data: updated } = await supabaseAdmin
    .from("claims")
    .update({ claimed_at: now, claimer_wallet: claimerWallet })
    .eq("token", token)
    .is("claimed_at", null)
    .select("asset_id, seller_wallet");

  if (!updated || updated.length === 0) {
    // Check if it simply doesn't exist vs already claimed
    const { data: existing } = await supabaseAdmin
      .from("claims")
      .select("claimed_at")
      .eq("token", token)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ success: false, error: "Link not found" }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: "Already claimed" }, { status: 409 });
  }

  const { asset_id: assetId } = updated[0] as { asset_id: string; seller_wallet: string };
  const operatorWallet = getOperatorWalletAddress();

  // Transfer cNFT from operator escrow to claimer
  try {
    await transferCnft({ assetId, fromWallet: operatorWallet, toWallet: claimerWallet });
  } catch (err) {
    // Roll back the claim
    await supabaseAdmin
      .from("claims")
      .update({ claimed_at: null, claimer_wallet: null })
      .eq("token", token);
    const message = err instanceof Error ? err.message : "Transfer failed";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }

  // Update purchases.buyer_wallet so the ticket appears on the claimer's /my-tickets
  await supabaseAdmin
    .from("purchases")
    .update({ buyer_wallet: claimerWallet })
    .eq("asset_id", assetId);

  return NextResponse.json({ success: true, assetId });
}
