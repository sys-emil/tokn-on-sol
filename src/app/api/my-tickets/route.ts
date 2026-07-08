import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { MILESTONES, STAMMGAST_THRESHOLD } from "@/lib/badgeMeta";

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
      .select("badge_type, asset_id, earned_at, organizer_wallet")
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
    const baseUrl = process.env.APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
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

  const badgeRows = (badgesResult.data ?? []) as {
    badge_type: string;
    asset_id: string | null;
    earned_at: string;
    organizer_wallet: string | null;
  }[];

  const badges = badgeRows.map((b) => ({
    badgeType: b.badge_type,
    assetId: b.asset_id,
    earnedAt: b.earned_at,
  }));

  // Progress toward the next badges — the hook that brings buyers back.
  const redeemedRows = (data ?? []).filter((row) => row.redeemed_at);
  const attendedCount = redeemedRows.length;
  const nextMilestone = MILESTONES.find((m) => attendedCount < m.threshold) ?? null;

  // Best Stammgast candidate: distinct redeemed events per organizer, skipping
  // organizers where the badge is already earned. Shown by name, never wallet.
  let topOrganizer: { name: string; attendedEvents: number; threshold: number } | null = null;
  const redeemedEventIds = [...new Set(redeemedRows.map((row) => row.event_id as string))];
  if (redeemedEventIds.length > 0) {
    const { data: eventOwners } = await supabaseAdmin
      .from("events")
      .select("id, organizer_wallet")
      .in("id", redeemedEventIds);

    const stammgastEarned = new Set(
      badgeRows
        .filter((b) => b.badge_type === "loyal_organizer" && b.organizer_wallet)
        .map((b) => b.organizer_wallet as string),
    );

    const perOrganizer = new Map<string, number>();
    for (const ev of (eventOwners ?? []) as { id: string; organizer_wallet: string }[]) {
      if (stammgastEarned.has(ev.organizer_wallet)) continue;
      perOrganizer.set(ev.organizer_wallet, (perOrganizer.get(ev.organizer_wallet) ?? 0) + 1);
    }

    const best = [...perOrganizer.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0 && best[1] < STAMMGAST_THRESHOLD) {
      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("name, business_name")
        .eq("wallet_address", best[0])
        .maybeSingle();
      const displayName = (organizer?.business_name ?? organizer?.name ?? "") as string;
      if (displayName) {
        topOrganizer = { name: displayName, attendedEvents: best[1], threshold: STAMMGAST_THRESHOLD };
      }
    }
  }

  const progress = { attendedCount, nextMilestone, topOrganizer };

  return NextResponse.json({ tickets, badges, progress });
}
