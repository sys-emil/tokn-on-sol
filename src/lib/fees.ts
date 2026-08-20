/**
 * Service fee per ticket: a **degressive, marginal** schedule with a floor.
 * Who pays it is a per-event decision (`events.fee_payer`, see `splitServiceFee`
 * below); by default the buyer does, on top of the face price.
 *
 *   up to  15 €  →  7.9 %
 *      15 – 50 € →  5.9 %   (on the part above 15 €)
 *      above 50 € →  4.5 %   (on the part above 50 €)
 *   never less than 0.99 € on a paid ticket
 *
 * Why marginal bands rather than one rate per price bracket: a bracket schedule
 * has cliffs, and a cliff points the wrong way — a 15.01 € ticket would carry a
 * *smaller* fee than a 15.00 € one, which is both unexplainable and gameable.
 * Summed marginally the fee is monotone in the price by construction
 * (asserted over the whole range in serviceFeeBands.test.ts).
 *
 * Why degressive at all: the previous 1.00 € + 4 % was regressive — 24 % on a
 * 5 € ticket but 4.8 % on a 120 € one. That is backwards. Cheap tickets are the
 * ones a surcharge scares away, and expensive ones were leaving money behind:
 * the contribution margin used to sit flat at ~0.70 € from 5 € to 300 €, i.e.
 * the platform did not grow with GMV.
 *
 * Why a floor and not a base: Stripe's cost is fixed-plus-percentage (about
 * 0.25 € + 1.5 % on an EEA card, 0.35 € + 2.99 % via PayPal), so a pure
 * percentage loses money on cheap tickets. 0.99 € is the floor measured against
 * PayPal — the most expensive method we accept — not against cards. It stops
 * binding at ~12.50 €, where 7.9 % overtakes it.
 *
 * **Why there is no absolute cap.** A cap in euros looks generous on a 150 €
 * ticket and is a loss: Stripe's percentage runs on uncapped, so past a certain
 * price the fee would be smaller than the cost of collecting it. Degression is
 * expressed as a falling *marginal rate* instead, and the lowest band (4.5 %)
 * stays deliberately above PayPal's 2.99 %. Don't add a cap.
 *
 * The margins above assume Passly is a Kleinunternehmer, i.e. the fee carries
 * no VAT. Should that change, every margin drops by ~16 % and the weakest point
 * (a 10 € ticket paid via PayPal) falls from ~0.31 € to ~0.15 €. Still positive,
 * but that is the moment to revisit the floor.
 *
 * Free tickets (price 0) carry no fee, since free events skip Stripe entirely.
 *
 * This module is imported by client components (shop page fee display, the
 * pricing-page calculator), so it must stay dependency-free and side-effect-free.
 */

export interface ServiceFeeBand {
  /** Upper bound of the band in cents; the last band is open-ended. */
  readonly upToCents: number;
  /** Rate applied to the part of the price that falls inside this band. */
  readonly bps: number;
}

/**
 * Exported so the pricing page can render the schedule from the same constant
 * the checkout charges from — marketing copy and the charge cannot drift apart.
 */
export const SERVICE_FEE_BANDS: readonly ServiceFeeBand[] = [
  { upToCents: 1_500, bps: 790 },
  { upToCents: 5_000, bps: 590 },
  { upToCents: Number.POSITIVE_INFINITY, bps: 450 },
];

/** Smallest fee on a paid ticket. See the floor rationale above. */
export const MIN_SERVICE_FEE_CENTS = 99;

export function serviceFeePerTicketCents(unitPriceCents: number): number {
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new Error(`unitPriceCents must be a non-negative integer, got ${unitPriceCents}`);
  }
  if (unitPriceCents === 0) return 0;

  // Rounded ONCE at the end. Rounding per band would let the sum jump around a
  // band edge and break monotonicity.
  let raw = 0;
  let consumed = 0;
  for (const band of SERVICE_FEE_BANDS) {
    const portion = Math.min(unitPriceCents, band.upToCents) - consumed;
    if (portion <= 0) break;
    raw += (portion * band.bps) / 10_000;
    consumed += portion;
  }
  return Math.max(MIN_SERVICE_FEE_CENTS, Math.round(raw));
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
 * given mode: 0 for `buyer`, 51 cents for `split`, 100 cents for `organizer`.
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
 * Return fee for "Rückgabe & Neuverkauf" (see src/lib/resaleReturn.ts).
 *
 * A gives their ticket back, the organizer sells the seat again, and A is
 * refunded on their ORIGINAL payment minus this fee. That refund is what keeps
 * Passly out of the merchant-of-record role and away from any KYC obligation:
 * money only ever travels back the way it came.
 *
 * The fee is charged against **what the seller actually paid**, not the tier's
 * face value. That is a hard constraint, not a preference — a ticket bought with
 * a 50 % discount code cannot be refunded at face value, because Stripe refuses
 * to refund more than the charge and the difference would be a real loss. For a
 * normally bought ticket the two are identical.
 *
 * The €1 floor covers Stripe's fixed per-refund cost on cheap tickets.
 * Client-safe: the sell UI previews the payout live.
 */
export const RETURN_FEE_BPS = 1_000; // 10 %
export const RETURN_FEE_MIN_CENTS = 100; // €1.00

export interface ReturnBreakdown {
  /** What the seller paid for this one ticket, excluding their service-fee share. */
  paidCents: number;
  /** Passly's cut, deducted from the refund. */
  returnFeeCents: number;
  /** What actually gets refunded to the original payment method. */
  refundCents: number;
}

/**
 * Split a return. Never returns a refund above `paidCents`, and never a
 * negative one: on a ticket cheap enough that the floor would eat all of it,
 * the fee is capped at the full amount and the refund is 0 rather than the
 * seller owing us money.
 */
export function returnBreakdown(paidCents: number): ReturnBreakdown {
  if (!Number.isInteger(paidCents) || paidCents < 0) {
    throw new Error(`paidCents must be a non-negative integer, got ${paidCents}`);
  }
  const percentage = Math.round((paidCents * RETURN_FEE_BPS) / 10_000);
  const returnFeeCents = Math.min(paidCents, Math.max(percentage, RETURN_FEE_MIN_CENTS));
  return { paidCents, returnFeeCents, refundCents: paidCents - returnFeeCents };
}
