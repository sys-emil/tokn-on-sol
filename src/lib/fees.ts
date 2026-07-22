/**
 * Buyer-side service fee: €1.00 + 4% per ticket, added on top of the face
 * price at checkout. The organizer receives 100% of the face price.
 *
 * Why base + percentage: Stripe's processing cost is fixed-plus-percentage
 * (~€0.25 + 1.5–2.9%), so a pure percentage loses money on cheap tickets
 * (backlog #13 — a €5 ticket at the old organizer-side 3% lost ~€0.18).
 * €1.00 + 4% clears Stripe cost plus VAT on the fee at every price point.
 *
 * Free tickets (price 0) carry no fee — free events skip Stripe entirely.
 *
 * This module is imported by client components (shop page fee display) —
 * keep it dependency-free and side-effect-free.
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
 * Resale (secondary market) fee — borne by the SELLER, deducted from the sale
 * price. The seller receives (listPrice − fee) as Passly credit.
 *
 * The percentage RISES with the markup over the ticket's face value (its tier's
 * original price) to make scalping unattractive:
 *   - markup < 10%           → 8%
 *   - markup ≥ 10%           → 12%
 *   - each further +5% markup → +2%   (15%→14%, 20%→16%, 25%→18%, …)
 * Selling at or below face value (markup ≤ 0) stays at the 8% base.
 *
 * On top of the percentage there is a flat €1.00 base charge. Percentages are
 * applied to the resale list price. Kept dependency-free — imported by the
 * seller-facing listing UI to preview the net proceeds live.
 */
export const RESALE_FEE_BASE_CENTS = 100; // €1.00 flat
export const RESALE_FEE_BASE_BPS = 800; // 8% baseline

/** Fee percentage (in basis points) for a given markup over face value (bps). */
export function resaleFeeBps(markupBps: number): number {
  if (markupBps < 1_000) return RESALE_FEE_BASE_BPS; // < 10% markup → 8%
  const steps = Math.floor((markupBps - 1_000) / 500); // each additional 5%
  return 1_200 + steps * 200; // 10% → 12%, then +2% per 5%
}

/**
 * Seller-side resale fee in cents for a ticket listed at `listPriceCents` whose
 * original face value is `faceValueCents`. Flat €1 + a markup-scaled percentage
 * of the list price.
 */
export function resaleFeeCents(listPriceCents: number, faceValueCents: number): number {
  if (!Number.isInteger(listPriceCents) || listPriceCents <= 0) {
    throw new Error(`listPriceCents must be a positive integer, got ${listPriceCents}`);
  }
  if (!Number.isInteger(faceValueCents) || faceValueCents < 0) {
    throw new Error(`faceValueCents must be a non-negative integer, got ${faceValueCents}`);
  }
  // Markup relative to face value; clamped at 0 so selling below face never
  // yields a negative (fee-reducing) markup.
  const markupBps = faceValueCents > 0
    ? Math.max(0, Math.round(((listPriceCents - faceValueCents) / faceValueCents) * 10_000))
    : 0;
  const bps = resaleFeeBps(markupBps);
  return RESALE_FEE_BASE_CENTS + Math.round((listPriceCents * bps) / 10_000);
}

/** Net proceeds the seller receives as credit: list price minus the resale fee. */
export function resaleNetProceedsCents(listPriceCents: number, faceValueCents: number): number {
  return Math.max(0, listPriceCents - resaleFeeCents(listPriceCents, faceValueCents));
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
