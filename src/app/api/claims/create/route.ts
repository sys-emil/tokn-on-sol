import { PrivyClient } from "@privy-io/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { transferCnft, getOperatorWalletAddress } from "@/lib/transfer";
import { NextRequest, NextResponse } from "next/server";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

interface CreateBody {
  assetId: string;
}

interface DasAsset {
  result?: { ownership?: { owner?: string; delegate?: string } };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let sellerWallet: string;
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
    sellerWallet = (solanaAccount as { address: string }).address;
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { assetId } = body;
  if (!assetId || typeof assetId !== "string") {
    return NextResponse.json({ success: false, error: "assetId is required" }, { status: 400 });
  }

  // Verify on-chain ownership
  const heliusApiKey = process.env.HELIUS_API_KEY ?? "";
  const assetRes = await fetch(`https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "verify-owner", method: "getAsset", params: { id: assetId } }),
    cache: "no-store",
  });

  if (!assetRes.ok) {
    return NextResponse.json({ success: false, error: "Ownership check failed" }, { status: 502 });
  }

  const assetJson = (await assetRes.json()) as DasAsset;
  const onChainOwner = assetJson.result?.ownership?.owner;
  const onChainDelegate = assetJson.result?.ownership?.delegate;
  const operatorWallet = getOperatorWalletAddress();

  if (onChainOwner !== sellerWallet) {
    return NextResponse.json({ success: false, error: "Wallet does not own this ticket" }, { status: 403 });
  }

  // Verify operator is the delegate (ticket was minted with claim-link support)
  if (onChainDelegate !== operatorWallet) {
    return NextResponse.json({ success: false, error: "not_delegated" }, { status: 400 });
  }

  // Verify ticket has not been redeemed at the door
  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("redeemed_at")
    .eq("asset_id", assetId)
    .single();

  if (purchase?.redeemed_at) {
    return NextResponse.json({ success: false, error: "Ticket has already been redeemed" }, { status: 409 });
  }

  // Check for existing active claim
  const { data: existingClaim } = await supabaseAdmin
    .from("claims")
    .select("token, claimed_at")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (existingClaim && !existingClaim.claimed_at) {
    // Return existing unclaimed link
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    return NextResponse.json({ success: true, url: `${baseUrl}/claim/${existingClaim.token as string}` });
  }

  // Generate claim token
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");

  // Insert claim row
  const { error: insertError } = await supabaseAdmin
    .from("claims")
    .insert({ asset_id: assetId, token, seller_wallet: sellerWallet });

  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  // Transfer cNFT to operator escrow
  try {
    await transferCnft({ assetId, fromWallet: sellerWallet, toWallet: operatorWallet });
  } catch (err) {
    // Roll back the claim row on transfer failure
    await supabaseAdmin.from("claims").delete().eq("token", token);
    const message = err instanceof Error ? err.message : "Transfer failed";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  return NextResponse.json({ success: true, url: `${baseUrl}/claim/${token}` });
}
