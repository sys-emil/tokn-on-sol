import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PLATFORM_FEE_BPS = 300; // 3 % platform fee

/*
 * Payout architecture: Separate Charges & Transfers (NOT Destination Charges).
 *
 * Why:
 * - Payout timing — Destination Charges move funds to the connected account at
 *   charge time; delaying them requires manipulating the connected account's
 *   payout schedule, which is global per account, not per event. With Separate
 *   Charges & Transfers the money stays on the platform balance and we create
 *   the Transfer ourselves once `available_at` (event date + per-event hold
 *   period) has passed — exactly the per-event configurability we need.
 * - Disputes/chargebacks — with Destination Charges a chargeback debits the
 *   connected account, which for small organizers is often empty → negative
 *   balances Stripe recovers from the *platform* anyway. Keeping the charge on
 *   the platform account means disputes debit us directly and, crucially, we
 *   can simply *not transfer* funds for a disputed charge (status 'disputed'
 *   blocks the cron transfer) instead of clawing money back from an organizer.
 * - Each Transfer uses `source_transaction` (the original charge) so it only
 *   executes once that charge's funds are actually available — no platform
 *   balance-timing races.
 *
 * Trade-off: the platform is merchant of record and carries dispute liability,
 * which is precisely why the configurable hold period exists.
 */

export type PayoutStatus = "pending" | "paid" | "held" | "disputed" | "failed" | "refunded";

export type PayoutRow = {
  id: string;
  stripe_session_id: string;
  payment_intent_id: string | null;
  charge_id: string | null;
  event_id: string | null;
  organizer_wallet: string;
  stripe_account_id: string | null;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  available_at: string;
  status: PayoutStatus;
  transfer_id: string | null;
  dispute_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Split a gross amount (cents) into platform fee and organizer net.
 * Fee is rounded to the nearest cent; net + fee always equals gross.
 */
export function computeFeeSplit(grossCents: number): { feeCents: number; netCents: number } {
  if (!Number.isInteger(grossCents) || grossCents < 0) {
    throw new Error(`grossCents must be a non-negative integer, got ${grossCents}`);
  }
  const feeCents = Math.round((grossCents * PLATFORM_FEE_BPS) / 10_000);
  return { feeCents, netCents: grossCents - feeCents };
}

/**
 * When funds for a purchase become transferable to the organizer.
 *
 * - holdDays = 0 → available immediately (transferred by the next daily cron run,
 *   i.e. the default "automatic daily payout" behaviour).
 * - holdDays > 0 → held until midnight UTC `holdDays` days after the event date,
 *   as chargeback protection.
 *
 * If the event date can't be parsed, fall back to `now` as the hold anchor so a
 * malformed date never accelerates a payout past its hold period.
 */
export function computeAvailableAt(eventDate: string, holdDays: number, now: Date = new Date()): Date {
  if (!Number.isInteger(holdDays) || holdDays < 0) {
    throw new Error(`holdDays must be a non-negative integer, got ${holdDays}`);
  }
  if (holdDays === 0) return now;

  const parsed = new Date(`${eventDate}T00:00:00Z`);
  const anchor = Number.isNaN(parsed.getTime()) ? now : parsed;
  const available = new Date(anchor.getTime() + holdDays * 24 * 60 * 60 * 1000);
  // Never release before "now + hold" if the event is already in the past relative
  // to purchase time — the hold is a chargeback window, not just an event offset.
  return available.getTime() < now.getTime() ? now : available;
}

/**
 * Build the payouts-table row for a completed, paid checkout session.
 * Returns null for free sessions (nothing to pay out).
 */
export function buildPayoutRow(params: {
  session: Pick<Stripe.Checkout.Session, "id" | "amount_total" | "currency" | "payment_intent">;
  chargeId: string | null;
  eventId: string;
  eventDate: string;
  organizerWallet: string;
  stripeAccountId: string | null;
  holdDays: number;
  now?: Date;
}): Omit<PayoutRow, "id" | "created_at" | "updated_at" | "transfer_id" | "dispute_id" | "failure_reason" | "status"> | null {
  const { session, chargeId, eventId, eventDate, organizerWallet, stripeAccountId, holdDays, now } = params;
  const grossCents = session.amount_total ?? 0;
  if (grossCents <= 0) return null;

  const { feeCents, netCents } = computeFeeSplit(grossCents);
  return {
    stripe_session_id: session.id,
    payment_intent_id: typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null,
    charge_id: chargeId,
    event_id: eventId,
    organizer_wallet: organizerWallet,
    stripe_account_id: stripeAccountId,
    gross_cents: grossCents,
    fee_cents: feeCents,
    net_cents: netCents,
    currency: session.currency ?? "eur",
    available_at: computeAvailableAt(eventDate, holdDays, now).toISOString(),
  };
}

/**
 * Idempotency gate for Stripe webhooks: atomically claim an event ID.
 * Returns true if this call claimed the event (process it), false if it was
 * already processed (skip). Uses an INSERT with a primary-key conflict as the
 * atomic check — two concurrent deliveries can never both claim the event.
 */
export async function claimWebhookEvent(
  db: SupabaseClient,
  event: { id: string; type: string; account?: string },
): Promise<boolean> {
  const { error } = await db.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
    account: event.account ?? null,
  });
  if (!error) return true;
  // 23505 = unique_violation → already processed.
  if (error.code === "23505") return false;
  throw new Error(`Failed to record webhook event ${event.id}: ${error.message}`);
}
