import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendAdminAlert } from "@/lib/email";
import { sendDueEventReminders } from "@/lib/reminders";
import { sweepWaitlists } from "@/lib/waitlist";
import { claimOffsetForPayout, releaseOffset } from "@/lib/platformFees";
import { checkOperatorBalance } from "@/lib/operatorBalance";
import { sweepResaleOffers } from "@/lib/resaleReturn";
import { fetchTreeCapacities } from "@/lib/treeCapacity";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Warn once fewer than this many cNFT leaves are left across all trees. */
const LOW_TREE_CAPACITY = 2_000;

/**
 * Daily payout run (Vercel Cron, see vercel.json).
 *
 * Picks up all payouts whose hold period has elapsed (`available_at <= now`,
 * status 'pending') and transfers the organizer's net share from the platform
 * balance to their Connect account. `source_transaction` ties each Transfer to
 * the original charge so it settles as soon as that charge's funds are
 * available. The Stripe idempotency key is derived from the payout row ID;
 * re-running the cron can never double-transfer.
 *
 * Failure handling: a transfer that fails because the connected account is
 * restricted/disabled moves the row to 'held' (funds stay on the platform
 * balance) and shows up in the admin view for manual resolution.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Safety net for missed checkout.session.expired webhooks: free reserved
  // capacity for reservations that expired more than 15 minutes ago.
  const { data: releasedReservations, error: sweepError } = await supabaseAdmin
    .rpc("release_expired_reservations");
  if (sweepError) {
    console.error("Failed to release expired reservations:", sweepError.message);
  }

  // Rückgabe-Angebote: unverkaufte gehen am Eventtag an den Verkäufer zurück
  // (niemand darf sein Ticket verlieren, nur weil es sich nicht verkauft hat),
  // und hängengebliebene Erstattungen werden erneut versucht.
  let resaleOffers = { expired: 0, refunded: 0 };
  try {
    resaleOffers = await sweepResaleOffers();
  } catch (err) {
    console.error("Resale offer sweep failed:", err instanceof Error ? err.message : err);
  }

  // Waiting-room leftovers: promotion happens on every status poll, so this is
  // pure housekeeping for tokens nobody came back for.
  const { error: queuePurgeError } = await supabaseAdmin.rpc("purge_stale_queue_tokens");
  if (queuePurgeError) {
    console.error("Failed to purge stale queue tokens:", queuePurgeError.message);
  }

  // Drain in batches rather than capping the run at one page. One payout row
  // per checkout session means a single sold-out event can produce more due
  // rows than a page holds, and with a daily cron the remainder would sit
  // there for another 24 h per page — the organizer waiting on money that is
  // already available. Processed rows leave `status = 'pending'`, so re-running
  // the same query naturally returns the next block.
  const BATCH_SIZE = 100;
  const MAX_BATCHES = 10;
  // maxDuration is 300 s; stop early enough that we never get killed midway
  // through a Stripe transfer, which would leave the row 'pending' with the
  // money already moved.
  const TIME_BUDGET_MS = 240_000;
  const startedAt = Date.now();

  let paid = 0;
  let held = 0;
  let offsetCents = 0;
  let processed = 0;
  let batches = 0;
  let remaining = false;
  const heldDetails: string[] = [];

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      remaining = true;
      break;
    }

    const { data: due, error } = await supabaseAdmin
      .from("payouts")
      .select("id, stripe_session_id, charge_id, organizer_wallet, stripe_account_id, net_cents, currency, skip_source_transaction, payment_method")
      .eq("status", "pending")
      .lte("available_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!due || due.length === 0) break;

    batches++;
    processed += due.length;

    for (const payout of due) {
      // Resolve the destination account at transfer time; onboarding may have
      // completed (or the account been restricted) since the purchase.
      let accountId = payout.stripe_account_id as string | null;
      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("stripe_account_id, stripe_payouts_enabled")
        .eq("wallet_address", payout.organizer_wallet)
        .maybeSingle();
      if (organizer?.stripe_account_id) accountId = organizer.stripe_account_id as string;

      if (!accountId) {
        await supabaseAdmin
          .from("payouts")
          .update({
            status: "held",
            failure_reason: "Organizer has no Stripe Connect account",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payout.id);
        held++;
        heldDetails.push(`${payout.id} (${payout.net_cents} ${payout.currency ?? "eur"} → ${payout.organizer_wallet}): no Connect account`);
        continue;
      }

      // Service fees the organizer collected in cash at the box office come off
      // here — that is the only place Passly ever sees that money. Claimed
      // before the transfer and released again if Stripe rejects it.
      const currency = (payout.currency as string | null) ?? "eur";
      const offset = await claimOffsetForPayout({
        payoutId: payout.id as string,
        organizerWallet: payout.organizer_wallet as string,
        netCents: payout.net_cents as number,
        currency,
      });
      const amount = (payout.net_cents as number) - offset.offsetCents;

      // Nothing left to send. Reachable when a deep discount code eats the whole
      // ticket price on an event whose organizer absorbs the service fee. Stripe
      // rejects a €0 transfer, so calling it would only park the row in `held`
      // and alarm an admin about a payout that is genuinely complete.
      if (amount <= 0) {
        await supabaseAdmin
          .from("payouts")
          .update({
            status: "paid",
            stripe_account_id: accountId,
            failure_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payout.id);
        paid++;
        offsetCents += offset.offsetCents;
        continue;
      }

      try {
        const transfer = await stripe.transfers.create(
          {
            amount,
            currency,
            destination: accountId,
            // Credit-funded payouts draw from the platform balance (the card
            // charge is smaller than the organizer's net); no source_transaction.
            ...(payout.charge_id && !payout.skip_source_transaction ? { source_transaction: payout.charge_id } : {}),
            metadata: {
              payout_id: payout.id,
              stripe_session_id: payout.stripe_session_id,
              ...(offset.offsetCents > 0 ? { box_office_fee_offset_cents: String(offset.offsetCents) } : {}),
            },
          },
          { idempotencyKey: `payout-transfer-${payout.id}` },
        );

        await supabaseAdmin
          .from("payouts")
          .update({
            status: "paid",
            transfer_id: transfer.id,
            stripe_account_id: accountId,
            failure_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payout.id);
        paid++;
        offsetCents += offset.offsetCents;
      } catch (err) {
        // Restricted/disabled account, missing transfer capability, etc.
        // funds remain on the platform balance, row goes to 'held' for the
        // admin view. A retry from the admin panel resets it to 'pending'.
        const message = err instanceof Stripe.errors.StripeError
          ? `${err.code ?? err.type}: ${err.message}`
          : err instanceof Error ? err.message : String(err);
        console.error(`Transfer failed for payout ${payout.id}:`, message);

        // No transfer, no deduction: the dues go back into the pool so the next
        // successful payout of this organizer picks them up.
        await releaseOffset(offset.dues);

        await supabaseAdmin
          .from("payouts")
          .update({
            status: "held",
            stripe_account_id: accountId,
            failure_reason: `Transfer failed: ${message}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payout.id);
        held++;
        // The payment method matters here: non-card methods (PayPal, Klarna,
        // SEPA) settle on their own schedule, so a source_transaction transfer
        // can fail simply because the funds are not available yet. Same-day
        // retries from /admin/payouts then usually succeed.
        heldDetails.push(
          `${payout.id} (${payout.net_cents} ${payout.currency ?? "eur"} → ${payout.organizer_wallet}`
            + `${payout.payment_method ? `, ${payout.payment_method}` : ""}): ${message}`,
        );
      }
    }
  }

  // A held transfer means an organizer is waiting for money; that must not
  // sit silently until someone happens to open /admin/payouts.
  if (heldDetails.length > 0) {
    void sendAdminAlert({
      subject: `${heldDetails.length} Auszahlung(en) fehlgeschlagen → held`,
      text: `Der Payout-Cron konnte ${heldDetails.length} Transfer(s) nicht ausführen.\n`
        + `Auflösung unter /admin/payouts (retry / release / cancel).\n\n`
        + heldDetails.join("\n"),
    }).catch((err) => console.error("Admin alert failed:", err));
  }

  // Operator-wallet health. Every mint is signed and paid for by this wallet;
  // once it runs dry, ticket delivery stops for everyone, and the only signal
  // today would be a permanently-failed mint job per order after five attempts
  // each. The Merkle trees are the other hard ceiling — capacity there cannot
  // be topped up, a new tree has to be deployed — so both are checked here.
  // Best-effort: this runs after the transfers and must never fail a payout.
  await reportOperatorHealth();

  // Day-before event reminders piggyback on this cron (both Hobby cron slots
  // are taken). Best-effort; a reminder failure must never fail the payouts.
  let reminders = { events: 0, mails: 0 };
  let waitlistMails = 0;
  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  try {
    reminders = await sendDueEventReminders(baseUrl);
  } catch (err) {
    console.error("Event reminders failed:", err instanceof Error ? err.message : err);
  }
  // Waitlist catch-all: covers seats freed by paths without their own hook
  // (e.g. reservations released by the expiry sweep above).
  try {
    waitlistMails = await sweepWaitlists(baseUrl);
  } catch (err) {
    console.error("Waitlist sweep failed:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({
    success: true,
    processed,
    paid,
    held,
    batches,
    // True when the run hit its batch or time budget; the rest is picked up by
    // the next cron (or a manual call) rather than silently dropped.
    remaining,
    // Box-office service fees recovered by deducting them from transfers.
    offsetCents,
    releasedReservations: (releasedReservations as number | null) ?? 0,
    resaleOffers,
    reminders,
    waitlistMails,
  });
}

/**
 * Alert when the operator wallet is running low on SOL or a Merkle tree is
 * running out of leaves. Both are silent, system-wide mint stoppers, and both
 * are only visible today if somebody happens to open /admin.
 *
 * Swallows its own errors on purpose: an unreachable RPC must not turn a
 * successful payout run into a 500 that Vercel reports as a failed cron.
 */
async function reportOperatorHealth(): Promise<void> {
  try {
    const [balance, trees] = await Promise.all([
      checkOperatorBalance(),
      fetchTreeCapacities(),
    ]);

    const readable = trees.filter((t) => !t.error);
    const treeRemaining = readable.reduce((sum, t) => sum + t.remaining, 0);
    const treesLow = readable.length > 0 && treeRemaining < LOW_TREE_CAPACITY;
    const unreadable = trees.filter((t) => t.error);

    if (!balance.low && !treesLow && unreadable.length === 0) return;

    const lines: string[] = [];
    if (balance.low) {
      lines.push(
        `SOL-Guthaben niedrig: ${balance.sol.toFixed(4)} SOL auf ${balance.address}.`,
        `Reicht noch für ca. ${balance.estMintsRemaining} Mints (${balance.lamportsPerMint} Lamport pro Mint).`,
      );
    }
    if (treesLow) {
      lines.push(
        `Merkle-Tree-Kapazität niedrig: nur noch ${treeRemaining} Blätter über ${readable.length} Tree(s).`,
        `Kapazität lässt sich nicht auffüllen — neuen Tree mit "npm run create-tree" anlegen und an MERKLE_TREE_ADDRESSES anhängen.`,
      );
    }
    for (const tree of unreadable) {
      lines.push(`Tree ${tree.address} nicht lesbar: ${tree.error}`);
    }

    void sendAdminAlert({
      subject: "Operator-Wallet / Merkle-Trees brauchen Aufmerksamkeit",
      text: `${lines.join("\n")}\n\nOhne Guthaben und freie Blätter kann kein Ticket mehr geprägt werden.`,
    }).catch((err) => console.error("Operator health alert failed:", err));
  } catch (err) {
    console.error("Operator health check failed:", err instanceof Error ? err.message : err);
  }
}
