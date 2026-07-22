import { supabaseAdmin } from "@/lib/supabase";
import { heliusRpcUrl } from "@/lib/solana";
import { getOperatorWalletAddress } from "@/lib/transfer";
import { maxResalePriceCents } from "@/lib/fees";

/**
 * How long a resale listing is held for a buyer while their checkout session is
 * open. Matches Stripe's 30-minute minimum session lifetime; the expiry webhook
 * and the cron sweep re-open the listing if the buyer abandons.
 */
export const RESALE_HOLD_MINUTES = 30;

export interface ResaleEligibility {
  faceValueCents: number;
  eventId: string;
  tierId: string | null;
  eventName: string;
  eventDate: string;
  maxMarkupPct: number;
  maxPriceCents: number;
}

export type ResaleEligibilityResult =
  | { ok: true; data: ResaleEligibility }
  | { ok: false; status: number; error: string };

interface DasAsset {
  result?: { ownership?: { owner?: string; delegate?: string } };
}

/**
 * Current on-chain owner of a cNFT (via Helius DAS), or null if unavailable.
 * Used by the resale webhook to make the operator→buyer transfer idempotent: if
 * a retry finds the buyer already owns the ticket, the transfer already ran.
 */
export async function getAssetOwner(assetId: string): Promise<string | null> {
  const res = await fetch(heliusRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "resale-owner-check", method: "getAsset", params: { id: assetId } }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as DasAsset;
  return json.result?.ownership?.owner ?? null;
}

/** True if the event's calendar date is today or later (resale of past events is pointless). */
function eventNotPast(eventDate: string): boolean {
  // Dates are stored as "YYYY-MM-DD" text. Compare date-only in the server's TZ.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsed = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return true; // never block on an unparseable date
  return parsed.getTime() >= today.getTime();
}

/**
 * Verifies that `sellerWallet` may list `assetId` for resale and returns the
 * ticket's face value + the event's markup cap. Reused by the listing route and
 * the price-preview path. Mirrors the ownership/redemption guards of the
 * claim-link flow (src/app/api/claims/create/route.ts).
 */
export async function checkResaleEligibility(
  assetId: string,
  sellerWallet: string,
): Promise<ResaleEligibilityResult> {
  // 1) On-chain ownership: seller must own the ticket and the operator must be
  //    its delegate (so we can move it into escrow without the seller signing).
  //    A ticket already in claim- or resale-escrow is owned by the operator here
  //    and therefore correctly rejected.
  const assetRes = await fetch(heliusRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "resale-owner", method: "getAsset", params: { id: assetId } }),
    cache: "no-store",
  });
  if (!assetRes.ok) {
    return { ok: false, status: 502, error: "Besitz konnte nicht geprüft werden." };
  }
  const assetJson = (await assetRes.json()) as DasAsset;
  const onChainOwner = assetJson.result?.ownership?.owner;
  const onChainDelegate = assetJson.result?.ownership?.delegate;
  const operatorWallet = getOperatorWalletAddress();
  if (onChainOwner !== sellerWallet) {
    return { ok: false, status: 403, error: "Dieses Ticket gehört nicht zu deinem Konto." };
  }
  if (onChainDelegate !== operatorWallet) {
    return { ok: false, status: 400, error: "not_delegated" };
  }

  // 2) Purchase record: must not be redeemed (scanned) or revoked (refunded).
  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("event_id, tier_id, redeemed_at, revoked_at")
    .eq("asset_id", assetId)
    .maybeSingle();
  if (!purchase) {
    return { ok: false, status: 404, error: "Ticket nicht gefunden." };
  }
  if (purchase.redeemed_at) {
    return { ok: false, status: 409, error: "Dieses Ticket wurde bereits eingelöst." };
  }
  if (purchase.revoked_at) {
    return { ok: false, status: 409, error: "Dieses Ticket ist nicht mehr gültig." };
  }

  // 3) Event: must exist, not be cancelled, not be in the past, and have resale on.
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, name, date, cancelled_at, resale_max_markup_pct")
    .eq("id", purchase.event_id)
    .maybeSingle();
  if (!event) {
    return { ok: false, status: 404, error: "Event nicht gefunden." };
  }
  if (event.cancelled_at) {
    return { ok: false, status: 410, error: "Das Event wurde abgesagt." };
  }
  if (event.resale_max_markup_pct == null) {
    return { ok: false, status: 403, error: "Für dieses Event ist der Weiterverkauf nicht freigeschaltet." };
  }
  if (!eventNotPast(event.date as string)) {
    return { ok: false, status: 410, error: "Das Event liegt in der Vergangenheit." };
  }

  // 4) Face value = the ticket's tier price (the price authority); fall back to
  //    the event's aggregate "from" price for legacy tier-less purchases.
  let faceValueCents: number | null = null;
  if (purchase.tier_id) {
    const { data: tier } = await supabaseAdmin
      .from("ticket_tiers")
      .select("price_eur")
      .eq("id", purchase.tier_id)
      .maybeSingle();
    faceValueCents = (tier?.price_eur as number | undefined) ?? null;
  }
  if (faceValueCents == null) {
    const { data: ev2 } = await supabaseAdmin
      .from("events")
      .select("price_eur")
      .eq("id", purchase.event_id)
      .maybeSingle();
    faceValueCents = (ev2?.price_eur as number | undefined) ?? 0;
  }

  const maxMarkupPct = event.resale_max_markup_pct as number;
  return {
    ok: true,
    data: {
      faceValueCents,
      eventId: event.id as string,
      tierId: (purchase.tier_id as string | null) ?? null,
      eventName: event.name as string,
      eventDate: event.date as string,
      maxMarkupPct,
      maxPriceCents: maxResalePriceCents(faceValueCents, maxMarkupPct),
    },
  };
}
