import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

// LEGACY: organizer-side 3% fee. Only used for checkout sessions created
// before the buyer-side service fee existed (no serviceFeeCents in the session
// metadata). New sessions: see src/lib/fees.ts for the current degressive
// schedule and `events.fee_payer` for who carries it.
export const PLATFORM_FEE_BPS = 300;

/*
 * Payout architecture: Separate Charges & Transfers (NOT Destination Charges).
 *
 * Why:
 * - Payout timing; Destination Charges move funds to the connected account at
 *   charge time; delaying them requires manipulating the connected account's
 *   payout schedule, which is global per account, not per event. With Separate
 *   Charges & Transfers the money stays on the platform balance and we create
 *   the Transfer ourselves once `available_at` (event date + per-event hold
 *   period) has passed; exactly the per-event configurability we need.
 * - Disputes/chargebacks; with Destination Charges a chargeback debits the
 *   connected account, which for small organizers is often empty → negative
 *   balances Stripe recovers from the *platform* anyway. Keeping the charge on
 *   the platform account means disputes debit us directly and, crucially, we
 *   can simply *not transfer* funds for a disputed charge (status 'disputed'
 *   blocks the cron transfer) instead of clawing money back from an organizer.
 * - Each Transfer uses `source_transaction` (the original charge) so it only
 *   executes once that charge's funds are actually available; no platform
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
  /**
   * The buyer's share of `fee_cents` (the rest was carried by the organizer,
   * see `events.fee_payer`). NULL on rows written before that setting existed,
   * which means the buyer paid all of it.
   */
  buyer_fee_cents: number | null;
  net_cents: number;
  currency: string;
  available_at: string;
  status: PayoutStatus;
  transfer_id: string | null;
  dispute_id: string | null;
  failure_reason: string | null;
  /** Stripe payment_method_details.type of the funding charge; NULL on legacy rows. */
  payment_method: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * LEGACY split: 3% organizer-side fee on the gross amount. Fallback for
 * sessions without serviceFeeCents metadata; also the historical ratio baked
 * into old payout rows. Fee is rounded; net + fee always equals gross.
 */
export function computeFeeSplit(grossCents: number): { feeCents: number; netCents: number } {
  if (!Number.isInteger(grossCents) || grossCents < 0) {
    throw new Error(`grossCents must be a non-negative integer, got ${grossCents}`);
  }
  const feeCents = Math.round((grossCents * PLATFORM_FEE_BPS) / 10_000);
  return { feeCents, netCents: grossCents - feeCents };
}

/**
 * Plattform-Mindestpuffer, ab dem eine Auszahlung frühestens fließt. Der
 * Veranstalter darf über `payout_hold_days` nur nach OBEN abweichen.
 *
 * Warum überhaupt ein Boden: Bei Separate Charges & Transfers ist Passly
 * Merchant of Record, ein Chargeback belastet also die Plattform-Balance, und
 * eine Transfer-Reversal gibt es in diesem System nicht. Vorher stand der
 * Regler auf 0 und wurde von genau der Person gesetzt, vor der er schützt.
 *
 * Warum 1 und nicht 0 im Normalfall: `events.date` ist ein reines Datum ohne
 * Uhrzeit und der Payout-Cron läuft um 03:00 UTC — ein Puffer von 0 Tagen
 * würde am Morgen *des* Eventtags auszahlen. Ein Tag ist der erste Zeitpunkt,
 * der eindeutig nach dem Event liegt.
 */
export const MIN_HOLD_DAYS_AFTER_EVENT = 1;

/**
 * Puffer bis zur allerersten Auszahlung eines Veranstalters. Danach greift
 * `MIN_HOLD_DAYS_AFTER_EVENT`: wessen erstes Event sauber durchgelaufen und
 * abgerechnet ist, hat den teuersten Betrugsfall hinter sich.
 */
export const FIRST_EVENT_HOLD_DAYS = 3;

/**
 * Der tatsächlich geltende Puffer: der größere von Plattform-Boden und dem
 * Wunsch des Veranstalters. Serverseitig beim Schreiben der payouts-Zeile
 * angewandt, nicht im Editor — der Boden darf nicht umgehbar sein.
 */
export function effectiveHoldDays(organizerHoldDays: number, isFirstPayout: boolean): number {
  const own = Number.isInteger(organizerHoldDays) && organizerHoldDays > 0 ? organizerHoldDays : 0;
  return Math.max(own, isFirstPayout ? FIRST_EVENT_HOLD_DAYS : MIN_HOLD_DAYS_AFTER_EVENT);
}

/**
 * When funds for a purchase become transferable to the organizer: midnight UTC
 * `holdDays` days after the event date, never earlier than `now`.
 *
 * The anchor is ALWAYS the event date — with `effectiveHoldDays` there is no
 * zero-hold case any more, and the ticket-return path depends on it: a return
 * is rejected from the event day onwards precisely so the original payout is
 * still `pending` and can be un-booked (see `unbookOrganizerShare`).
 *
 * If the event date can't be parsed, fall back to `now` as the hold anchor. A
 * season pass passes "" deliberately: it spans many dates, so its hold is
 * anchored on the purchase instead.
 */
export function computeAvailableAt(eventDate: string, holdDays: number, now: Date = new Date()): Date {
  if (!Number.isInteger(holdDays) || holdDays < 0) {
    throw new Error(`holdDays must be a non-negative integer, got ${holdDays}`);
  }

  const parsed = new Date(`${eventDate}T00:00:00Z`);
  const anchor = Number.isNaN(parsed.getTime()) ? now : parsed;
  const available = new Date(anchor.getTime() + holdDays * 24 * 60 * 60 * 1000);
  // Never release before "now + hold" if the event is already in the past relative
  // to purchase time; the hold is a chargeback window, not just an event offset.
  return available.getTime() < now.getTime() ? now : available;
}

/**
 * Decide what the platform keeps from a paid session.
 *
 * `serviceFeeCents` is the **full** service fee recorded in the session
 * metadata at checkout creation, regardless of who paid it: the organizer's
 * share is already missing from `grossCents`, so `net = gross − fee` holds in
 * every `events.fee_payer` mode.
 *
 * Three outcomes, and the distinction matters:
 * - `legacy` — no usable metadata, i.e. a session created before the buyer-side
 *   fee existed. Only then is the old organizer-side 3% split correct.
 * - `clamped` — metadata says the fee exceeds the gross. `splitServiceFee`
 *   makes that structurally impossible, so it signals a bug; the fee is capped
 *   at the gross rather than reinterpreted. Reinterpreting it as 3% would be a
 *   real money error under an absorbed fee: the gross excludes the fee there,
 *   so the organizer would be handed 97% *and* Passly would pay the fee itself.
 * - `metadata` — the normal path.
 */
export function resolveFeeCents(
  grossCents: number,
  serviceFeeCents?: number | null,
): { feeCents: number; source: "metadata" | "clamped" | "legacy" } {
  const usable = typeof serviceFeeCents === "number"
    && Number.isInteger(serviceFeeCents)
    && serviceFeeCents >= 0;
  if (!usable) return { feeCents: computeFeeSplit(grossCents).feeCents, source: "legacy" };
  if (serviceFeeCents > grossCents) return { feeCents: grossCents, source: "clamped" };
  return { feeCents: serviceFeeCents, source: "metadata" };
}

/**
 * Build the payouts-table row for a completed, paid checkout session.
 * Returns null for free sessions (nothing to pay out).
 *
 * `serviceFeeCents` is the full platform take from the session metadata and
 * `buyerFeeCents` the buyer's share of it; see `resolveFeeCents` above.
 */
export function buildPayoutRow(params: {
  session: Pick<Stripe.Checkout.Session, "id" | "amount_total" | "currency" | "payment_intent">;
  chargeId: string | null;
  eventId: string;
  eventDate: string;
  organizerWallet: string;
  stripeAccountId: string | null;
  holdDays: number;
  serviceFeeCents?: number | null;
  buyerFeeCents?: number | null;
  paymentMethod?: string | null;
  now?: Date;
}): Omit<PayoutRow, "id" | "created_at" | "updated_at" | "transfer_id" | "dispute_id" | "failure_reason" | "status"> | null {
  const { session, chargeId, eventId, eventDate, organizerWallet, stripeAccountId, holdDays, serviceFeeCents, buyerFeeCents, paymentMethod, now } = params;
  const grossCents = session.amount_total ?? 0;
  if (grossCents <= 0) return null;

  const { feeCents } = resolveFeeCents(grossCents, serviceFeeCents);
  const netCents = grossCents - feeCents;
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
    buyer_fee_cents: typeof buyerFeeCents === "number" && Number.isInteger(buyerFeeCents)
      ? Math.min(Math.max(0, buyerFeeCents), feeCents)
      : null,
    net_cents: netCents,
    currency: session.currency ?? "eur",
    available_at: computeAvailableAt(eventDate, holdDays, now).toISOString(),
    payment_method: paymentMethod ?? null,
  };
}

/**
 * Idempotency gate for Stripe webhooks: atomically claim an event ID.
 * Returns true if this call claimed the event (process it), false if it was
 * already processed (skip). Uses an INSERT with a primary-key conflict as the
 * atomic check; two concurrent deliveries can never both claim the event.
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

/**
 * Stripe's net fee on a dispute, in the dispute's own currency.
 *
 * Stripe charges a flat dispute fee the moment a chargeback opens and adds a
 * second, compensating balance transaction if the dispute is later **won**.
 * Summing `fee` across all of them therefore answers the only question the
 * bookkeeping has: what did this dispute actually cost, once decided. A lost
 * dispute yields the flat fee, a won one yields zero.
 *
 * Lives here rather than next to `bookChargebackFee` so it stays free of the
 * Supabase client and can be unit-tested; same reason as `resolveFeeCents`.
 */
export function disputeFeeCents(
  balanceTransactions: readonly { fee?: number | null }[] | null | undefined,
): number {
  if (!balanceTransactions?.length) return 0;
  const total = balanceTransactions.reduce((sum, bt) => sum + (bt.fee ?? 0), 0);
  // A negative sum would mean Stripe refunded more than it charged; nothing to
  // pass on either way, and a negative due would credit the organizer.
  return Math.max(0, total);
}
