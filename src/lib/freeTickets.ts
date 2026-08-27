/**
 * How many free tickets one event may hand out, by organizer plan.
 *
 * A free ticket carries **no** service fee — `serviceFeePerTicketCents` returns
 * 0 for a price of 0, and a free event skips Stripe entirely. It is not free to
 * deliver, though: every one of them is a Bubblegum mint, a Helius lookup, a
 * Resend confirmation mail and a row in three tables. Per ticket that is
 * fractions of a cent; what makes it worth bounding is that nothing bounded it
 * before. An unlimited zero-revenue path is also the shape an abuser looks for
 * — Passly as a free mass-mint and mass-mail service.
 *
 * Three decisions worth keeping:
 *
 * - **Per event, not per month.** A rolling monthly quota needs its own counter
 *   table and a reset, and an organizer cannot tell from their own screen how
 *   much of it is left. A per-event ceiling is decided in the same request that
 *   writes the event. What it does not bound is an organizer creating many free
 *   events; the manual approval gate on `/become-organizer` is what bounds that.
 *
 * - **Checked when the event is written, never at checkout.** A guest must not
 *   be the one who discovers the limit — being turned away at the buy button
 *   for a rule aimed at the organizer is the worst possible place to enforce it.
 *   The organizer finds out while creating, when it is still cheap to change.
 *
 * - **Existing events are grandfathered.** An event already above the ceiling
 *   stays editable as long as its free capacity does not grow (see
 *   `freeCapacityExceeded`'s `previousFreeCapacity`). Locking someone out of
 *   fixing a typo, under a rule that did not exist when they created the event,
 *   would be a punishment rather than a limit.
 *
 * Client-safe: imported by the event editor to warn before the request is sent.
 */

/**
 * Free plan: enough for a club night, a members' meeting or a reading — the
 * events an organizer uses to try Passly before running real money through it.
 * That trial path is worth more than the ~2 € it costs, so it stays open to
 * everyone, and there is deliberately no setup fee on a free event.
 */
export const FREE_TICKET_CAP_FREE_PLAN = 500;

/**
 * Pro: the same ceiling the event capacity itself has, i.e. **Pro adds no
 * second limit** — past 500 free tickets the subscription is the price, and
 * once paid nothing else stands in the way. A separate, lower Pro ceiling would
 * be a rule nobody was told about at the moment they paid.
 *
 * Coupled to the `totalCapacity > 10000` check in `/api/events/create` and
 * `/api/events/update`: raising this above that ceiling would be dead code,
 * lowering it would reintroduce the second limit.
 */
export const FREE_TICKET_CAP_PRO = 10_000;

export function freeTicketCapFor(plan: string | null | undefined): number {
  return plan === "pro" ? FREE_TICKET_CAP_PRO : FREE_TICKET_CAP_FREE_PLAN;
}

/** Only the shape both the API routes and the editor can supply. */
export interface FreeCapacityTier {
  /** Unit price in cents; 0 means a free tier. */
  price_eur: number;
  capacity: number;
}

/** Seats across all tiers that cost nothing. */
export function freeCapacityOf(tiers: readonly FreeCapacityTier[]): number {
  return tiers.reduce((sum, t) => (t.price_eur === 0 ? sum + t.capacity : sum), 0);
}

export interface FreeCapacityViolation {
  /** Free seats the caller asked for. */
  requested: number;
  /** Ceiling that applies to their plan. */
  cap: number;
}

/**
 * The violation to report, or null when the event may be written.
 *
 * `previousFreeCapacity` grandfathers an edit: pass what the event has today
 * and an already-oversized event stays saveable while it does not grow. Omit it
 * when creating, where there is nothing to grandfather.
 */
export function freeCapacityExceeded(params: {
  tiers: readonly FreeCapacityTier[];
  plan: string | null | undefined;
  previousFreeCapacity?: number;
}): FreeCapacityViolation | null {
  const { tiers, plan, previousFreeCapacity } = params;
  const requested = freeCapacityOf(tiers);
  const cap = freeTicketCapFor(plan);
  if (requested <= cap) return null;
  // Already over the ceiling and not getting worse: let it through.
  if (previousFreeCapacity !== undefined && requested <= previousFreeCapacity) return null;
  return { requested, cap };
}
