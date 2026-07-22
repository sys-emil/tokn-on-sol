import { PrivyClient } from "@privy-io/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { transferCnft, getOperatorWalletAddress } from "@/lib/transfer";
import { NextRequest, NextResponse } from "next/server";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

interface CancelBody {
  listingId: string;
}

async function resolveSellerWallet(authToken: string): Promise<string | null> {
  try {
    const verified = await privy.verifyAuthToken(authToken);
    const privyUser = await privy.getUser(verified.userId);
    const solanaAccount = privyUser.linkedAccounts.find(
      (acc): acc is Extract<typeof acc, { type: "wallet" }> =>
        acc.type === "wallet" && "chainType" in acc && (acc as { chainType: string }).chainType === "solana",
    );
    if (!solanaAccount || !("address" in solanaAccount)) return null;
    return (solanaAccount as { address: string }).address;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const sellerWallet = await resolveSellerWallet(authToken);
  if (!sellerWallet) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: CancelBody;
  try {
    body = (await req.json()) as CancelBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
  if (!body.listingId || typeof body.listingId !== "string") {
    return NextResponse.json({ success: false, error: "listingId is required" }, { status: 400 });
  }

  // Atomically pull the listing out of the market before returning the ticket,
  // so a buyer can't reserve it mid-cancel. Only the seller's own ACTIVE listing
  // can be withdrawn — a reserved listing has a buyer in checkout.
  const { data: cancelled } = await supabaseAdmin
    .from("resale_listings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", body.listingId)
    .eq("seller_wallet", sellerWallet)
    .eq("status", "active")
    .select("asset_id")
    .maybeSingle();

  if (!cancelled) {
    return NextResponse.json(
      { success: false, error: "Angebot nicht gefunden oder gerade im Kauf." },
      { status: 409 },
    );
  }

  const assetId = cancelled.asset_id as string;
  try {
    await transferCnft({ assetId, fromWallet: getOperatorWalletAddress(), toWallet: sellerWallet });
  } catch (err) {
    // Return the listing to active so the ticket isn't stranded in escrow.
    await supabaseAdmin
      .from("resale_listings")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", body.listingId);
    const message = err instanceof Error ? err.message : "Transfer failed";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
