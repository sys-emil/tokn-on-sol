import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const buyerWallet = new URL(req.url).searchParams.get("buyerWallet");

  if (!buyerWallet) {
    return NextResponse.json(
      { error: "buyerWallet is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("asset_id, created_at, event_id, events(name, date)")
    .eq("buyer_wallet", buyerWallet)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assetIds = (data ?? []).map((row) => row.asset_id as string);

  // Fetch which tickets have an active (unclaimed) claim link
  const { data: claimsData } = assetIds.length > 0
    ? await supabaseAdmin
        .from("claims")
        .select("asset_id, token")
        .in("asset_id", assetIds)
        .is("claimed_at", null)
    : { data: [] };

  const claimedAssets = new Map<string, string>(
    (claimsData ?? []).map((c) => [c.asset_id as string, c.token as string]),
  );

  const tickets = (data ?? []).map((row) => {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    const assetId = row.asset_id as string;
    const claimToken = claimedAssets.get(assetId);
    const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
    return {
      assetId,
      eventName: (event?.name ?? "") as string,
      eventDate: (event?.date ?? "") as string,
      purchasedAt: row.created_at as string,
      eventId: row.event_id as string,
      claimUrl: claimToken ? `${baseUrl}/claim/${claimToken}` : null,
    };
  });

  return NextResponse.json({ tickets });
}
