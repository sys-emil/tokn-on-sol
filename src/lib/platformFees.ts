import { supabaseAdmin } from "@/lib/supabase";

/**
 * Amounts the organizer owes Passly, settled by deducting them from their next
 * online payout transfer rather than by building a second money rail.
 *
 * Two sources (`platform_fees_due.source`):
 * - `box_office` — the guest pays the same total as online (face price +
 *   buyer-side service fee) and the whole amount stays in the organizer's till,
 *   because no money passes through Passly at the door.
 * - `cancellation` — the organizer cancelled an event, every guest was refunded
 *   in full including the service fee, and Stripe **keeps its processing fee on
 *   a refund**. That is a real euro Passly paid out for a sale that no longer
 *   exists. Only the amount Stripe actually withheld is passed on, never
 *   Passly's own margin: reclaiming a fee for a service that was not delivered
 *   would be a penalty, while passing through a payment-provider cost the
 *   organizer caused is what the terms cover (AGB § 4).
 *
 * Design decisions worth keeping:
 * - **Whole rows only.** A due is either subtracted from a payout in full or
 *   left pending for the next one. Partially settled dues would need their own
 *   remaining-amount bookkeeping for no practical gain.
 * - **A transfer never shrinks below `MIN_TRANSFER_CENTS`.** A €0 transfer is
 *   rejected by Stripe, and a payout that arrives as a few cents reads as a
 *   bug to the organizer. Leftovers roll forward.
 * - **Claim before transferring, release on failure.** The dues are marked
 *   against the payout id first; if Stripe then rejects the transfer they go
 *   back to pending. A crash between transfer and bookkeeping is covered by
 *   `claimOffsetForPayout` re-collecting dues already stamped with this payout
 *   id, so a retry recomputes the *same* amount — which matters, because the
 *   Stripe idempotency key is derived from the payout id and a differing amount
 *   under the same key is an error.
 */

/** Never transfer less than this after deducting dues (Stripe rejects €0). */
export const MIN_TRANSFER_CENTS = 100;

export type PlatformFeeDue = {
  id: string;
  fee_cents: number;
  session_id: string;
};

export type FeeOffset = {
  /** Dues subtracted from this payout. */
  dues: PlatformFeeDue[];
  /** Their total; subtract from `net_cents` to get the transfer amount. */
  offsetCents: number;
};

/**
 * Reserve outstanding dues of an organizer against one payout and return how
 * much to subtract. Safe to call twice for the same payout: dues already
 * stamped with this payout id are picked up again instead of double-counted.
 */
export async function claimOffsetForPayout(params: {
  payoutId: string;
  organizerWallet: string;
  netCents: number;
  currency: string;
}): Promise<FeeOffset> {
  const { payoutId, organizerWallet, netCents, currency } = params;

  // Anything a previous (crashed or retried) run already attached to this
  // payout. Including it keeps the transfer amount stable across attempts.
  const { data: alreadyClaimed } = await supabaseAdmin
    .from("platform_fees_due")
    .select("id, fee_cents, session_id")
    .eq("settled_payout_id", payoutId)
    .eq("status", "settled");
  const claimed = (alreadyClaimed ?? []) as PlatformFeeDue[];
  let offsetCents = claimed.reduce((sum, d) => sum + d.fee_cents, 0);

  const { data: pending } = await supabaseAdmin
    .from("platform_fees_due")
    .select("id, fee_cents, session_id")
    .eq("organizer_wallet", organizerWallet)
    .eq("status", "pending")
    .eq("currency", currency)
    .order("created_at", { ascending: true })
    .limit(200);

  // Oldest first, only while the payout stays meaningfully above zero.
  const wanted: PlatformFeeDue[] = [];
  for (const due of (pending ?? []) as PlatformFeeDue[]) {
    if (netCents - offsetCents - due.fee_cents < MIN_TRANSFER_CENTS) continue;
    wanted.push(due);
    offsetCents += due.fee_cents;
  }
  if (wanted.length === 0) return { dues: claimed, offsetCents };

  // The conditional update is the claim: a concurrent run that got there first
  // simply won't have its rows returned here.
  const { data: settled } = await supabaseAdmin
    .from("platform_fees_due")
    .update({
      status: "settled",
      settled_payout_id: payoutId,
      settled_at: new Date().toISOString(),
    })
    .in("id", wanted.map((d) => d.id))
    .eq("status", "pending")
    .select("id, fee_cents, session_id");

  const won = (settled ?? []) as PlatformFeeDue[];
  const dues = [...claimed, ...won];
  return { dues, offsetCents: dues.reduce((sum, d) => sum + d.fee_cents, 0) };
}

/** Give claimed dues back after a failed transfer, so a later payout takes them. */
export async function releaseOffset(dues: PlatformFeeDue[]): Promise<void> {
  if (dues.length === 0) return;
  const { error } = await supabaseAdmin
    .from("platform_fees_due")
    .update({ status: "pending", settled_payout_id: null, settled_at: null })
    .in("id", dues.map((d) => d.id));
  if (error) console.error("Failed to release platform fee dues:", error.message);
}

export type OutstandingFees = {
  totalCents: number;
  /** Service fees collected in cash at the door. */
  boxOfficeCents: number;
  /** Stripe's processing fees on refunds after a cancelled event. */
  cancellationCents: number;
};

/**
 * What an organizer still owes; shown on their payout page. Split by source
 * because the two mean very different things to the reader — one is money they
 * are holding, the other is a cost they caused.
 */
export async function outstandingFees(organizerWallet: string): Promise<OutstandingFees> {
  const { data } = await supabaseAdmin
    .from("platform_fees_due")
    .select("fee_cents, source")
    .eq("organizer_wallet", organizerWallet)
    .eq("status", "pending");
  const rows = (data ?? []) as { fee_cents: number; source: string | null }[];
  const sumWhere = (match: (source: string | null) => boolean) =>
    rows.filter((r) => match(r.source)).reduce((sum, r) => sum + r.fee_cents, 0);
  return {
    totalCents: rows.reduce((sum, r) => sum + r.fee_cents, 0),
    cancellationCents: sumWhere((source) => source === "cancellation"),
    // Anything not explicitly a cancellation is a door sale, including rows
    // written before `source` was ever set to something else.
    boxOfficeCents: sumWhere((source) => source !== "cancellation"),
  };
}

/**
 * Book Stripe's non-refundable processing fee on a cancellation refund.
 *
 * `session_id` is UNIQUE on the table, which makes this idempotent for free: a
 * re-run of the cancellation loop (or a retried request) cannot book the same
 * refund twice. A duplicate is success, not an error.
 *
 * Never throws. The refund has already gone out at this point, and failing here
 * would only risk the caller retrying a loop that issues money. An uncollected
 * fee is revenue we miss; a double refund would be a real loss.
 */
export async function bookCancellationFee(params: {
  organizerWallet: string;
  eventId: string;
  sessionId: string;
  quantity: number;
  feeCents: number;
  currency: string;
}): Promise<"booked" | "duplicate" | "skipped" | "failed"> {
  const { organizerWallet, eventId, sessionId, quantity, feeCents, currency } = params;
  if (!Number.isInteger(feeCents) || feeCents <= 0) return "skipped";

  const { error } = await supabaseAdmin.from("platform_fees_due").insert({
    organizer_wallet: organizerWallet,
    event_id: eventId,
    session_id: sessionId,
    source: "cancellation",
    quantity: Math.max(1, quantity),
    fee_cents: feeCents,
    currency,
  });
  if (!error) return "booked";
  if (error.code === "23505") return "duplicate"; // already booked
  console.error("Failed to book cancellation fee:", error.message);
  return "failed";
}
