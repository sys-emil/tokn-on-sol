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
    .select("asset_id, created_at, event_id, redeemed_at, events(name, date)")
    .eq("buyer_wallet", buyerWallet)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assetIds = (data ?? []).map((row) => row.asset_id as string);

  const [claimsResult, badgesResult] = await Promise.all([
    assetIds.length > 0
      ? supabaseAdmin
          .from("claims")
          .select("asset_id, token")
          .in("asset_id", assetIds)
          .is("claimed_at", null)
      : Promise.resolve({ data: [] }),
    supabaseAdmin
      .from("badges")
      .select("badge_type, asset_id, earned_at")
      .eq("wallet_address", buyerWallet)
      .order("earned_at", { ascending: true }),
  ]);

  const claimedAssets = new Map<string, string>(
    ((claimsResult.data ?? []) as { asset_id: string; token: string }[]).map((c) => [
      c.asset_id,
      c.token,
    ]),
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
      redeemedAt: (row.redeemed_at ?? null) as string | null,
      claimUrl: claimToken ? `${baseUrl}/claim/${claimToken}` : null,
    };
  });

  const badges = ((badgesResult.data ?? []) as {
    badge_type: string;
    asset_id: string | null;
    earned_at: string;
  }[]).map((b) => ({
    badgeType: b.badge_type,
    assetId: b.asset_id,
    earnedAt: b.earned_at,
  }));

  return NextResponse.json({ tickets, badges });
}
