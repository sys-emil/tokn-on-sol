import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendAdminAlert } from "@/lib/email";
import { sendDueEventReminders } from "@/lib/reminders";
import { sweepWaitlists } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  // Safety net for missed resale-checkout expiry webhooks: re-open listings
  // whose buyer hold elapsed without a completed payment.
  const { error: resaleSweepError } = await supabaseAdmin.rpc("release_expired_resale_listings");
  if (resaleSweepError) {
    console.error("Failed to release expired resale listings:", resaleSweepError.message);
  }

  const { data: due, error } = await supabaseAdmin
    .from("payouts")
    .select("id, stripe_session_id, charge_id, organizer_wallet, stripe_account_id, net_cents, currency, skip_source_transaction")
    .eq("status", "pending")
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let paid = 0;
  let held = 0;
  const heldDetails: string[] = [];

  for (const payout of due ?? []) {
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

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: payout.net_cents,
          currency: payout.currency ?? "eur",
          destination: accountId,
          // Credit-funded payouts draw from the platform balance (the card
          // charge is smaller than the organizer's net); no source_transaction.
          ...(payout.charge_id && !payout.skip_source_transaction ? { source_transaction: payout.charge_id } : {}),
          metadata: { payout_id: payout.id, stripe_session_id: payout.stripe_session_id },
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
    } catch (err) {
      // Restricted/disabled account, missing transfer capability, etc.
      // funds remain on the platform balance, row goes to 'held' for the
      // admin view. A retry from the admin panel resets it to 'pending'.
      const message = err instanceof Stripe.errors.StripeError
        ? `${err.code ?? err.type}: ${err.message}`
        : err instanceof Error ? err.message : String(err);
      console.error(`Transfer failed for payout ${payout.id}:`, message);

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
      heldDetails.push(`${payout.id} (${payout.net_cents} ${payout.currency ?? "eur"} → ${payout.organizer_wallet}): ${message}`);
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
    processed: (due ?? []).length,
    paid,
    held,
    releasedReservations: (releasedReservations as number | null) ?? 0,
    reminders,
    waitlistMails,
  });
}
