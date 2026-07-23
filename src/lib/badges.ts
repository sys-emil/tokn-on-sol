import { supabaseAdmin } from "@/lib/supabase";
import { mintBadge } from "@/lib/mint";
import { sendBadgeProgressEmail } from "@/lib/email";
import {
  BADGE_META,
  MILESTONES,
  STAMMGAST_THRESHOLD,
  EARLY_BIRD_WINDOW_MS,
  type BadgeType,
} from "@/lib/badgeMeta";

/**
 * Badge engine. Two award moments:
 *  - redemption (doorman scan / offline sync): attendance milestones,
 *    Stammgast (per organizer), sold-out show
 *  - mint time (purchase delivered): first ticket, early bird
 *
 * Awards are deduplicated by the partial unique indexes on badges
 * (wallet+type globally, wallet+type+organizer for Stammgast); concurrent
 * award paths lose the insert race with error 23505 and skip silently.
 */

interface AwardBadgeParams {
  wallet: string;
  type: BadgeType;
  eventId: string;
  organizerWallet?: string;
  baseUrl: string;
}

async function awardBadge({ wallet, type, eventId, organizerWallet, baseUrl }: AwardBadgeParams): Promise<void> {
  const { data: inserted, error } = await supabaseAdmin
    .from("badges")
    .insert({
      wallet_address: wallet,
      badge_type: type,
      event_id: eventId,
      organizer_wallet: organizerWallet ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = already earned (unique index), the expected dedupe outcome.
    if (error.code !== "23505") {
      console.error(`Badge insert failed (${type} for ${wallet}):`, error.message);
    }
    return;
  }
  if (!inserted) return;

  const badgeId = (inserted as { id: string }).id;

  // Fire-and-forget: badge record exists immediately; cNFT arrives in wallet shortly after
  mintBadge({ badgeType: type, badgeName: BADGE_META[type].name, ownerWallet: wallet, baseUrl })
    .then(({ assetId }) =>
      supabaseAdmin.from("badges").update({ asset_id: assetId }).eq("id", badgeId),
    )
    .catch(() => {
      // Badge row exists; assetId can be backfilled manually if needed
    });
}

/** Awards attendance-based badges after a ticket was redeemed. */
export async function checkRedemptionBadges(
  walletAddress: string,
  eventId: string,
  baseUrl: string,
): Promise<void> {
  const [{ count: attendedCount }, { data: eventRow }] = await Promise.all([
    supabaseAdmin
      .from("purchases")
      .select("*", { count: "exact", head: true })
      .eq("buyer_wallet", walletAddress)
      .not("redeemed_at", "is", null),
    supabaseAdmin
      .from("events")
      .select("organizer_wallet, tickets_sold, capacity")
      .eq("id", eventId)
      .single(),
  ]);

  const awards: Promise<void>[] = [];

  for (const { type, threshold } of MILESTONES) {
    if ((attendedCount ?? 0) >= threshold) {
      awards.push(awardBadge({ wallet: walletAddress, type, eventId, baseUrl }));
    }
  }

  if (eventRow && (eventRow.tickets_sold as number) >= (eventRow.capacity as number)) {
    awards.push(awardBadge({ wallet: walletAddress, type: "sold_out_show", eventId, baseUrl }));
  }

  // Stammgast: distinct redeemed events at this event's organizer.
  const organizerWallet = eventRow?.organizer_wallet as string | undefined;
  let distinctOrganizerEvents = 0;
  if (organizerWallet) {
    const { data: orgEvents } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("organizer_wallet", organizerWallet);
    const orgEventIds = (orgEvents ?? []).map((e: { id: string }) => e.id);

    if (orgEventIds.length > 0) {
      const { data: redeemedRows } = await supabaseAdmin
        .from("purchases")
        .select("event_id")
        .eq("buyer_wallet", walletAddress)
        .in("event_id", orgEventIds)
        .not("redeemed_at", "is", null);

      const distinctEvents = new Set((redeemedRows ?? []).map((r: { event_id: string }) => r.event_id));
      distinctOrganizerEvents = distinctEvents.size;
      if (distinctEvents.size >= STAMMGAST_THRESHOLD) {
        awards.push(
          awardBadge({ wallet: walletAddress, type: "loyal_organizer", eventId, organizerWallet, baseUrl }),
        );
      }
    }
  }

  await Promise.all(awards);

  // Retention nudge: "one more event until the next badge". Must never fail
  // the redemption path; the whole block is best-effort.
  try {
    await maybeSendBadgeNudge({
      wallet: walletAddress,
      eventId,
      attendedCount: attendedCount ?? 0,
      organizerWallet,
      distinctOrganizerEvents,
      baseUrl,
    });
  } catch (err) {
    console.error("Badge nudge failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * E-mails the guest right after check-in when they are exactly one event away
 * from the Stammgast badge at this organizer or from the next attendance
 * milestone. Fires only on the wallet's first redeemed ticket at this event,
 * a second scanned ticket of the same purchase changes no progress and must
 * not re-send the mail.
 */
async function maybeSendBadgeNudge({
  wallet,
  eventId,
  attendedCount,
  organizerWallet,
  distinctOrganizerEvents,
  baseUrl,
}: {
  wallet: string;
  eventId: string;
  attendedCount: number;
  organizerWallet?: string;
  distinctOrganizerEvents: number;
  baseUrl: string;
}): Promise<void> {
  const stammgastNudge =
    Boolean(organizerWallet) && STAMMGAST_THRESHOLD - distinctOrganizerEvents === 1;
  const nextMilestone = MILESTONES.find((m) => m.threshold > attendedCount);
  const milestoneNudge = nextMilestone ? nextMilestone.threshold - attendedCount === 1 : false;
  if (!stammgastNudge && !milestoneNudge) return;

  // First redemption at this event for this wallet?
  const { count: redeemedHere } = await supabaseAdmin
    .from("purchases")
    .select("*", { count: "exact", head: true })
    .eq("buyer_wallet", wallet)
    .eq("event_id", eventId)
    .not("redeemed_at", "is", null);
  if ((redeemedHere ?? 0) !== 1) return;

  // Recipient: the buyer e-mail behind this wallet's purchase at this event.
  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("stripe_session_id")
    .eq("buyer_wallet", wallet)
    .eq("event_id", eventId)
    .not("stripe_session_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!purchase?.stripe_session_id) return;
  const { data: job } = await supabaseAdmin
    .from("mint_jobs")
    .select("buyer_email")
    .eq("stripe_session_id", purchase.stripe_session_id as string)
    .maybeSingle();
  const to = job?.buyer_email as string | undefined;
  if (!to) return;

  // The Stammgast nudge is the more personal one; it wins when both apply.
  if (stammgastNudge && organizerWallet) {
    const { data: organizer } = await supabaseAdmin
      .from("organizers")
      .select("name, business_name")
      .eq("wallet_address", organizerWallet)
      .maybeSingle();
    const organizerName = (organizer?.business_name ?? organizer?.name ?? "diesem Veranstalter") as string;
    await sendBadgeProgressEmail({
      to,
      headline: `Noch 1 Event bis zu deinem Stammgast-Abzeichen`,
      detail: `Schön, dass du da warst! Du hast jetzt ${distinctOrganizerEvents} Events von ${organizerName} besucht, noch eins, und du bekommst das Stammgast-Abzeichen „${BADGE_META.loyal_organizer.name}“.`,
      baseUrl,
    });
    return;
  }

  if (milestoneNudge && nextMilestone) {
    await sendBadgeProgressEmail({
      to,
      headline: `Noch 1 Event bis zum Abzeichen „${BADGE_META[nextMilestone.type].name}“`,
      detail: `Schön, dass du da warst! Das war dein ${attendedCount}. Event auf Passly, noch eins, und das Abzeichen „${BADGE_META[nextMilestone.type].name}“ gehört dir.`,
      baseUrl,
    });
  }
}

/** Awards purchase-based badges once a mint job has delivered its tickets. */
export async function checkPurchaseBadges(
  walletAddress: string,
  eventId: string,
  baseUrl: string,
): Promise<void> {
  const [{ count: purchaseCount }, { data: eventRow }, { data: firstPurchase }] = await Promise.all([
    supabaseAdmin
      .from("purchases")
      .select("*", { count: "exact", head: true })
      .eq("buyer_wallet", walletAddress),
    supabaseAdmin
      .from("events")
      .select("created_at")
      .eq("id", eventId)
      .single(),
    supabaseAdmin
      .from("purchases")
      .select("created_at")
      .eq("buyer_wallet", walletAddress)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const awards: Promise<void>[] = [];

  if ((purchaseCount ?? 0) >= 1) {
    awards.push(awardBadge({ wallet: walletAddress, type: "first_ticket", eventId, baseUrl }));
  }

  if (eventRow?.created_at && firstPurchase?.created_at) {
    const saleStart = Date.parse(eventRow.created_at as string);
    const purchasedAt = Date.parse(firstPurchase.created_at as string);
    if (purchasedAt - saleStart <= EARLY_BIRD_WINDOW_MS) {
      awards.push(awardBadge({ wallet: walletAddress, type: "early_bird", eventId, baseUrl }));
    }
  }

  await Promise.all(awards);
}
