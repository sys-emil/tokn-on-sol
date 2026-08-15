/**
 * Service fee: €1.00 + 4% per ticket. Who pays it is a per-event decision
 * (`events.fee_payer`, see `splitServiceFee` below); by default the buyer does,
 * on top of the face price, and the organizer receives 100% of it.
 *
 * Why base plus percentage: Stripe's processing cost is fixed-plus-percentage
 * (about €0.25 plus 1.5 to 2.9%), so a pure percentage loses money on cheap
 * tickets (backlog #13: a €5 ticket at the old organizer-side 3% lost ~€0.18).
 * €1.00 + 4% clears Stripe cost plus VAT on the fee at every price point.
 *
 * Free tickets (price 0) carry no fee, since free events skip Stripe entirely.
 *
 * This module is imported by client components (shop page fee display), so it
 * must stay dependency-free and side-effect-free.
 */

export const SERVICE_FEE_BASE_CENTS = 100; // €1.00 per ticket
export const SERVICE_FEE_BPS = 400; // + 4% of the face price

export function serviceFeePerTicketCents(unitPriceCents: number): number {
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new Error(`unitPriceCents must be a non-negative integer, got ${unitPriceCents}`);
  }
  if (unitPriceCents === 0) return 0;
  return SERVICE_FEE_BASE_CENTS + Math.round((unitPriceCents * SERVICE_FEE_BPS) / 10_000);
}

export function serviceFeeTotalCents(unitPriceCents: number, quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`quantity must be a positive integer, got ${quantity}`);
  }
  return serviceFeePerTicketCents(unitPriceCents) * quantity;
}

/**
 * Who carries the service fee, decided per event by the organizer.
 *
 * - `buyer` — added on top of the face price (the default and the historical
 *   behaviour; the organizer nets the full face price).
 * - `split` — half each. The buyer's half is rounded down, so the odd cent
 *   falls to the organizer.
 * - `organizer` — the face price is the final price; the fee comes out of the
 *   organizer's proceeds. This exists for organizers who advertise a round
 *   door price and would rather calculate the fee into it.
 */
export type FeePayer = "buyer" | "split" | "organizer";

export const FEE_PAYERS: readonly FeePayer[] = ["buyer", "split", "organizer"];

export function isFeePayer(value: unknown): value is FeePayer {
  return typeof value === "string" && (FEE_PAYERS as readonly string[]).includes(value);
}

export interface ServiceFeeSplit {
  /** Added on top of the face price; what the buyer pays beyond the ticket. */
  buyerCents: number;
  /** Deducted from the organizer's proceeds. */
  organizerCents: number;
  /** The platform's take, always `serviceFeePerTicketCents(unitPriceCents)`. */
  totalCents: number;
}

/**
 * Split one ticket's service fee between buyer and organizer.
 *
 * The platform's take never changes with the mode — only who brings it. That
 * is what keeps `payouts.net_cents = gross_cents − fee_cents` true in all three
 * modes: gross is `unitPrice + buyerCents`, so `gross − total = unitPrice −
 * organizerCents`, which is exactly what the organizer earns.
 *
 * **The organizer's share rolls over to the buyer when it would exceed the
 * ticket price** (reachable through a deep discount code, since the fee is
 * computed on the discounted price). Capping it without rolling over would
 * either push the organizer's net below zero or make Passly eat the shortfall
 * — i.e. fund somebody's guest list. Rolling over instead makes
 * `unitPrice + buyerCents >= totalCents` structurally true, so a payout row can
 * never book a fee larger than its gross.
 */
export function splitServiceFee(unitPriceCents: number, payer: FeePayer): ServiceFeeSplit {
  const totalCents = serviceFeePerTicketCents(unitPriceCents);
  if (totalCents === 0) return { buyerCents: 0, organizerCents: 0, totalCents: 0 };

  const rawOrganizer = payer === "organizer"
    ? totalCents
    : payer === "split"
      ? totalCents - Math.floor(totalCents / 2) // buyer floors, organizer carries the odd cent
      : 0;
  const organizerCents = Math.min(rawOrganizer, unitPriceCents);
  return { buyerCents: totalCents - organizerCents, organizerCents, totalCents };
}

/**
 * The organizer must keep at least this much per ticket. A zero-net payout row
 * would mean a €0 Stripe transfer, which Stripe rejects.
 */
export const MIN_ORGANIZER_NET_CENTS = 1;

/**
 * Cheapest ticket price that still leaves the organizer something under the
 * given mode: 0 for `buyer`, 52 cents for `split`, 105 cents for `organizer`.
 *
 * Searched rather than hardcoded so the numbers can't drift away from the fee
 * formula if the fee ever changes.
 */
export function minUnitPriceCentsFor(payer: FeePayer): number {
  if (payer === "buyer") return 0;
  for (let price = 1; price <= 10_000; price++) {
    const { organizerCents } = splitServiceFee(price, payer);
    if (price - organizerCents >= MIN_ORGANIZER_NET_CENTS) return price;
  }
  // Unreachable for any sane fee schedule; better than returning a wrong floor.
  throw new Error(`No viable minimum price for fee payer '${payer}'`);
}

/**
 * First ticket price that is too cheap to carry its share of the fee under
 * `payer`, or null when every price works. Free tiers are exempt (no fee).
 *
 * Shared by the event editor (German message) and the create/update routes
 * (English message) so both refuse exactly the same events.
 */
export function tooCheapForFeePayer(pricesCents: number[], payer: FeePayer): number | null {
  const floor = minUnitPriceCentsFor(payer);
  if (floor === 0) return null;
  return pricesCents.find((price) => price > 0 && price < floor) ?? null;
}

/**
 * Resale (secondary market) fee, split 50/50 between buyer and seller.
 *
 * The percentage of the list price is a gentle ramp: an 8% base when selling at
 * or below face value, rising by 1 percentage point per 5% of markup over the
 * ticket's face value, capped at 15%. Scalping is bounded by the organizer's
 * markup cap, not by this fee, hence the ramp stays mild.
 *
 * A minimum fee of €0.50 floors the percentage so a cheap resale still covers
 * Stripe's fixed per-charge cost (~€0.25): below roughly €4 the 8% alone would
 * leave the platform underwater on Stripe fees. The floor kicks in only there;
 * at normal prices the percentage dominates.
 *
 * The buyer pays the seller's list price plus their half of the fee; the
 * seller's half is deducted from their proceeds (paid out as Passly credit).
 * Kept dependency-free, since the seller and buyer UI import it to preview the
 * split live.
 */
export const RESALE_FEE_BASE_BPS = 800; // 8% baseline at or below face value
export const RESALE_FEE_MAX_BPS = 1_500; // capped at 15%
export const RESALE_MARKUP_STEP_BPS = 500; // each 5% of markup
export const RESALE_FEE_STEP_BPS = 100; // adds 1 percentage point
export const RESALE_FEE_MIN_CENTS = 50; // €0.50 floor to cover Stripe's fixed cost

/** Fee percentage (in basis points) for a given markup over face value (bps). */
export function resaleFeeBps(markupBps: number): number {
  const steps = Math.floor(Math.max(0, markupBps) / RESALE_MARKUP_STEP_BPS);
  return Math.min(RESALE_FEE_MAX_BPS, RESALE_FEE_BASE_BPS + steps * RESALE_FEE_STEP_BPS);
}

export interface ResaleFeeBreakdown {
  /** Total platform fee in cents (buyer half plus seller half). */
  totalFeeCents: number;
  /** Buyer's half, added on top of the list price. */
  buyerFeeCents: number;
  /** Seller's half, deducted from their proceeds. */
  sellerFeeCents: number;
  /** Credit the seller receives: list price minus their half of the fee. */
  sellerNetCents: number;
  /** What the buyer actually pays: list price plus their half of the fee. */
  buyerTotalCents: number;
}

/**
 * Full split for a ticket listed at `listPriceCents` whose original face value
 * is `faceValueCents`. Money is conserved: buyerTotal = sellerNet + totalFee.
 */
export function resaleFeeBreakdown(listPriceCents: number, faceValueCents: number): ResaleFeeBreakdown {
  if (!Number.isInteger(listPriceCents) || listPriceCents <= 0) {
    throw new Error(`listPriceCents must be a positive integer, got ${listPriceCents}`);
  }
  if (!Number.isInteger(faceValueCents) || faceValueCents < 0) {
    throw new Error(`faceValueCents must be a non-negative integer, got ${faceValueCents}`);
  }
  // Markup relative to face value, clamped at 0 so selling below face never
  // yields a negative (fee-reducing) markup.
  const markupBps = faceValueCents > 0
    ? Math.max(0, Math.round(((listPriceCents - faceValueCents) / faceValueCents) * 10_000))
    : 0;
  const bps = resaleFeeBps(markupBps);
  const percentageFee = Math.round((listPriceCents * bps) / 10_000);
  // Floor at the minimum so cheap resales still cover Stripe's fixed per-charge cost.
  const totalFeeCents = Math.max(percentageFee, RESALE_FEE_MIN_CENTS);
  const buyerFeeCents = Math.round(totalFeeCents / 2);
  const sellerFeeCents = totalFeeCents - buyerFeeCents;
  return {
    totalFeeCents,
    buyerFeeCents,
    sellerFeeCents,
    sellerNetCents: Math.max(0, listPriceCents - sellerFeeCents),
    buyerTotalCents: listPriceCents + buyerFeeCents,
  };
}

/** Total platform fee (both halves) for a resale at the given list and face value. */
export function resaleFeeCents(listPriceCents: number, faceValueCents: number): number {
  return resaleFeeBreakdown(listPriceCents, faceValueCents).totalFeeCents;
}

/** Net proceeds the seller receives as credit (list price minus their half of the fee). */
export function resaleNetProceedsCents(listPriceCents: number, faceValueCents: number): number {
  return resaleFeeBreakdown(listPriceCents, faceValueCents).sellerNetCents;
}

/** Highest list price the organizer's markup cap allows for a given face value. */
export function maxResalePriceCents(faceValueCents: number, maxMarkupPct: number): number {
  if (!Number.isInteger(faceValueCents) || faceValueCents < 0) {
    throw new Error(`faceValueCents must be a non-negative integer, got ${faceValueCents}`);
  }
  if (!Number.isInteger(maxMarkupPct) || maxMarkupPct < 0) {
    throw new Error(`maxMarkupPct must be a non-negative integer, got ${maxMarkupPct}`);
  }
  return faceValueCents + Math.floor((faceValueCents * maxMarkupPct) / 100);
}
