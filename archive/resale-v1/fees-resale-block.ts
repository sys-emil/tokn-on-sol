// Aus src/lib/fees.ts herausgeloest (Stand resale-v1). Die 50/50-Gebuehrenstaffel
// des alten C2C-Weiterverkaufs inkl. Markup-Rampe. Siehe README.md.

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
