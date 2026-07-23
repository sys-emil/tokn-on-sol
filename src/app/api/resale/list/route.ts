import { PrivyClient } from "@privy-io/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { transferCnft, getOperatorWalletAddress } from "@/lib/transfer";
import { checkResaleEligibility } from "@/lib/resale";
import { resaleFeeBreakdown } from "@/lib/fees";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

interface ListBody {
  assetId: string;
  listPriceCents: number;
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
  // Each listing moves a cNFT into escrow (an on-chain transaction); cap the rate.
  const rl = rateLimit(`resale-list:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const sellerWallet = await resolveSellerWallet(authToken);
  if (!sellerWallet) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: ListBody;
  try {
    body = (await req.json()) as ListBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { assetId, listPriceCents } = body;
  if (!assetId || typeof assetId !== "string") {
    return NextResponse.json({ success: false, error: "assetId is required" }, { status: 400 });
  }
  if (!Number.isInteger(listPriceCents) || listPriceCents <= 0) {
    return NextResponse.json({ success: false, error: "Ungültiger Preis." }, { status: 400 });
  }

  const eligibility = await checkResaleEligibility(assetId, sellerWallet);
  if (!eligibility.ok) {
    return NextResponse.json({ success: false, error: eligibility.error }, { status: eligibility.status });
  }
  const { faceValueCents, eventId, tierId, maxPriceCents } = eligibility.data;

  if (listPriceCents > maxPriceCents) {
    return NextResponse.json(
      { success: false, error: `Der Höchstpreis für dieses Event liegt bei ${(maxPriceCents / 100).toFixed(2)} €.` },
      { status: 400 },
    );
  }

  // fee_cents stores the full platform fee (both halves); net_cents is what the
  // seller receives (list price minus their half). The buyer pays net + fee.
  const { totalFeeCents: feeCents, sellerNetCents: netCents, sellerFeeCents } = resaleFeeBreakdown(listPriceCents, faceValueCents);
  const operatorWallet = getOperatorWalletAddress();

  // Insert the listing first; the partial unique index rejects a second live
  // listing for the same ticket. Roll it back if the escrow transfer fails.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("resale_listings")
    .insert({
      asset_id: assetId,
      event_id: eventId,
      tier_id: tierId,
      seller_wallet: sellerWallet,
      list_price_cents: listPriceCents,
      face_value_cents: faceValueCents,
      fee_cents: feeCents,
      net_cents: netCents,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ success: false, error: "Dieses Ticket steht bereits zum Verkauf." }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  try {
    await transferCnft({ assetId, fromWallet: sellerWallet, toWallet: operatorWallet });
  } catch (err) {
    await supabaseAdmin.from("resale_listings").delete().eq("id", inserted.id);
    const message = err instanceof Error ? err.message : "Transfer failed";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    listing: { id: inserted.id, listPriceCents, sellerFeeCents, netCents, status: "active" },
  });
}
