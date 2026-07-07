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
