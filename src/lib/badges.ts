import { supabaseAdmin } from "@/lib/supabase";
import type { BadgeType } from "@/lib/supabase";
import { mintBadge } from "@/lib/mint";

const BADGE_META: Record<BadgeType, { name: string }> = {
  first_show: { name: "First Show" },
  show_5: { name: "5 Shows" },
  show_10: { name: "10 Shows" },
  loyal_organizer: { name: "Loyal Fan" },
};

const MILESTONES: { type: BadgeType; threshold: number }[] = [
  { type: "first_show", threshold: 1 },
  { type: "show_5", threshold: 5 },
  { type: "show_10", threshold: 10 },
];

export async function checkAndAwardBadges(
  walletAddress: string,
  eventId: string,
  baseUrl: string,
): Promise<void> {
  const [{ count: attendedCount }, { data: existingBadges }] = await Promise.all([
    supabaseAdmin
      .from("purchases")
      .select("*", { count: "exact", head: true })
      .eq("buyer_wallet", walletAddress)
      .not("redeemed_at", "is", null),
    supabaseAdmin
      .from("badges")
      .select("badge_type")
      .eq("wallet_address", walletAddress),
  ]);

  const earned = new Set(
    (existingBadges ?? []).map((b: { badge_type: string }) => b.badge_type),
  );
  const toAward: BadgeType[] = [];

  for (const { type, threshold } of MILESTONES) {
    if ((attendedCount ?? 0) >= threshold && !earned.has(type)) {
      toAward.push(type);
    }
  }

  if (!earned.has("loyal_organizer")) {
    const { data: eventRow } = await supabaseAdmin
      .from("events")
      .select("organizer_wallet")
      .eq("id", eventId)
      .single();

    if (eventRow?.organizer_wallet) {
      const { data: orgEvents } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("organizer_wallet", eventRow.organizer_wallet as string);

      const orgEventIds = (orgEvents ?? []).map((e: { id: string }) => e.id);

      if (orgEventIds.length >= 3) {
        const { count: loyalCount } = await supabaseAdmin
          .from("purchases")
          .select("*", { count: "exact", head: true })
          .eq("buyer_wallet", walletAddress)
          .in("event_id", orgEventIds)
          .not("redeemed_at", "is", null);

        if ((loyalCount ?? 0) >= 3) {
          toAward.push("loyal_organizer");
        }
      }
    }
  }

  for (const badgeType of toAward) {
    const { data: inserted, error } = await supabaseAdmin
      .from("badges")
      .insert({ wallet_address: walletAddress, badge_type: badgeType, event_id: eventId })
      .select("id")
      .single();

    if (error ?? !inserted) continue;

    const badgeId = (inserted as { id: string }).id;
    const badgeName = BADGE_META[badgeType].name;

    // Fire-and-forget: badge record exists immediately; cNFT arrives in wallet shortly after
    mintBadge({ badgeType, badgeName, ownerWallet: walletAddress, baseUrl })
      .then(({ assetId }) =>
        supabaseAdmin.from("badges").update({ asset_id: assetId }).eq("id", badgeId),
      )
      .catch(() => {
        // Badge row exists; assetId can be backfilled manually if needed
      });
  }
}
