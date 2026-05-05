import { PrivyClient } from "@privy-io/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { transferCnft, getOperatorWalletAddress } from "@/lib/transfer";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

interface ClaimRow {
  asset_id: string;
  seller_wallet: string;
  claimed_at: string | null;
  claimer_wallet: string | null;
  purchases: {
    event_id: string;
    redeemed_at: string | null;
    events: { name: string; date: string } | null;
  } | null;
}

// GET /api/claims/[token] — public preview
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  const { data: claim } = await supabaseAdmin
    .from("claims")
    .select("asset_id, seller_wallet, claimed_at, claimer_wallet, purchases(event_id, redeemed_at, events(name, date))")
    .eq("token", token)
    .maybeSingle();

  if (!claim) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  const row = claim as unknown as ClaimRow;
  const event = Array.isArray(row.purchases?.events) ? row.purchases?.events[0] : row.purchases?.events;

  return NextResponse.json({
    found: true,
    assetId: row.asset_id,
    eventName: event?.name ?? "",
    eventDate: event?.date ?? "",
    claimed: !!row.claimed_at,
    claimedAt: row.claimed_at ?? null,
  });
}

// POST /api/claims/[token]/redeem — authenticated claim
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let claimerWallet: string;
  try {
    const verified = await privy.verifyAuthToken(authToken);
    const privyUser = await privy.getUser(verified.userId);
    const solanaAccount = privyUser.linkedAccounts.find(
      (acc): acc is Extract<typeof acc, { type: "wallet" }> =>
        acc.type === "wallet" && "chainType" in acc && (acc as { chainType: string }).chainType === "solana",
    );
    if (!solanaAccount || !("address" in solanaAccount)) {
      return NextResponse.json({ success: false, error: "No Solana wallet found" }, { status: 403 });
    }
    claimerWallet = (solanaAccount as { address: string }).address;
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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
