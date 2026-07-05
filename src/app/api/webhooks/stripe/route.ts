import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { buildPayoutRow, claimWebhookEvent } from "@/lib/payouts";
import { processMintJobs } from "@/lib/mintJobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds — minting continues in after() once the response is sent

// Two endpoints deliver to this route: the platform endpoint (checkout,
// disputes) and the Connect endpoint (account.updated, payout.* on connected
// accounts). Each Stripe endpoint has its own signing secret, so signature
// verification tries both.
const webhookSecrets = [
  process.env.STRIPE_WEBHOOK_SECRET,
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
].filter((s): s is string => !!s);

const siteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let stripeEvent: Stripe.Event | null = null;
  let lastError = "no webhook secret configured";
  for (const secret of webhookSecrets) {
    try {
      stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, secret);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  if (!stripeEvent) {
    return NextResponse.json({ error: `Webhook signature failed: ${lastError}` }, { status: 400 });
  }

  // Idempotency gate: every relevant event ID is claimed exactly once via a
  // primary-key insert. Stripe retries deliveries and Connect events can arrive
  // on multiple endpoints — a second delivery is acknowledged without reprocessing.
  const handledTypes = new Set<string>([
    "checkout.session.completed",
    "checkout.session.expired",
    "account.updated",
    "payout.paid",
    "payout.failed",
    "charge.dispute.created",
  ]);
  if (!handledTypes.has(stripeEvent.type)) {
    return NextResponse.json({ received: true });
  }

  let claimed: boolean;
  try {
    claimed = await claimWebhookEvent(supabaseAdmin, {
      id: stripeEvent.id,
      type: stripeEvent.type,
      account: stripeEvent.account,
    });
  } catch (err) {
    // If we can't record the event, tell Stripe to retry rather than risking
    // an unprocessed event slipping through.
    console.error("Webhook idempotency check failed:", err);
    return NextResponse.json({ error: "Idempotency check failed" }, { status: 500 });
  }
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Abandoned checkout: free the capacity that was reserved at session creation.
  if (stripeEvent.type === "checkout.session.expired") {
    const expiredSession = stripeEvent.data.object as Stripe.Checkout.Session;
    const { error: releaseError } = await supabaseAdmin.rpc("release_reservation", {
      p_session_id: expiredSession.id,
    });
    if (releaseError) {
      console.error(`Failed to release reservation for session ${expiredSession.id}:`, releaseError.message);
      await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
      return NextResponse.json({ error: "Failed to release reservation" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (stripeEvent.type === "account.updated") {
    const account = stripeEvent.data.object as Stripe.Account;
    await supabaseAdmin
      .from("organizers")
      .update({
        stripe_charges_enabled: account.charges_enabled ?? false,
        stripe_payouts_enabled: account.payouts_enabled ?? false,
      })
      .eq("stripe_account_id", account.id);
    return NextResponse.json({ received: true });
  }

  // Connect-account payout lifecycle (event.account = connected account).
  // Money already left the platform via Transfer; these track the organizer's
  // bank payout. A failed bank payout is logged for the admin view but needs
  // no balance action — Stripe returns funds to the connected account balance.
  if (stripeEvent.type === "payout.paid" || stripeEvent.type === "payout.failed") {
    const payout = stripeEvent.data.object as Stripe.Payout;
    if (stripeEvent.type === "payout.failed") {
      console.error(
        `Connect payout failed for account ${stripeEvent.account}: ${payout.id} (${payout.failure_message ?? payout.failure_code ?? "unknown"})`,
      );
      // Surface on held/failed transfers list: flag any still-pending payouts
      // for this organizer so the cron pauses transfers until resolved.
      if (stripeEvent.account) {
        await supabaseAdmin
          .from("payouts")
          .update({
            status: "held",
            failure_reason: `Bank payout ${payout.id} failed on connected account: ${payout.failure_message ?? payout.failure_code ?? "unknown"}`,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_account_id", stripeEvent.account)
          .eq("status", "pending");
      }
    }
    return NextResponse.json({ received: true });
  }

  // A chargeback on a platform charge: block the organizer transfer if it has
  // not happened yet; if funds were already transferred, flag for manual review.
  if (stripeEvent.type === "charge.dispute.created") {
    const dispute = stripeEvent.data.object as Stripe.Dispute;
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;

    const { data: payout } = await supabaseAdmin
      .from("payouts")
      .select("id, status")
      .eq("charge_id", chargeId)
      .maybeSingle();

    if (payout) {
      const update: Record<string, string> = {
        dispute_id: dispute.id,
        updated_at: new Date().toISOString(),
      };
      if (payout.status === "pending" || payout.status === "held") {
        update.status = "disputed";
        update.failure_reason = `Chargeback ${dispute.id} — transfer blocked`;
      } else {
        update.failure_reason = `Chargeback ${dispute.id} received AFTER transfer — manual recovery needed`;
      }
      await supabaseAdmin.from("payouts").update(update).eq("id", payout.id);
    } else {
      console.error(`Dispute ${dispute.id} for unknown charge ${chargeId}`);
    }
    return NextResponse.json({ received: true });
  }

  const session = stripeEvent.data.object as Stripe.Checkout.Session;
  const { eventId, buyerWallet, quantity: quantityStr } = session.metadata ?? {};
  const quantity = Math.max(1, Math.min(10, parseInt(quantityStr ?? "1", 10) || 1));

  if (!eventId || !buyerWallet) {
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("name, date, organizer_wallet, payout_hold_days")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Convert the checkout reservation into a sale — atomic and idempotent, so a
  // webhook retry (partial mint) can never double-count. Capacity is accounted
  // by payment, independent of mint success.
  const { error: finalizeError } = await supabaseAdmin.rpc("finalize_ticket_sale", {
    p_session_id: session.id,
    p_event_id: eventId,
    p_quantity: quantity,
  });
  if (finalizeError) {
    console.error(`Failed to finalize ticket sale for session ${session.id}:`, finalizeError.message);
    await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
    return NextResponse.json({ error: "Failed to finalize ticket sale" }, { status: 500 });
  }

  // Record the payout obligation before minting — money accounting must exist
  // even if on-chain minting fails. Unique on stripe_session_id, so a webhook
  // retry after a partial mint can never create a second payout row.
  if ((session.amount_total ?? 0) > 0) {
    try {
      let chargeId: string | null = null;
      if (typeof session.payment_intent === "string") {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
        chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null;
      }

      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("stripe_account_id")
        .eq("wallet_address", event.organizer_wallet)
        .maybeSingle();

      const payoutRow = buildPayoutRow({
        session,
        chargeId,
        eventId,
        eventDate: event.date,
        organizerWallet: event.organizer_wallet,
        stripeAccountId: (organizer?.stripe_account_id as string | null) ?? null,
        holdDays: event.payout_hold_days ?? 0,
      });
      if (payoutRow) {
        const { error: payoutError } = await supabaseAdmin
          .from("payouts")
          .upsert(payoutRow, { onConflict: "stripe_session_id", ignoreDuplicates: true });
        if (payoutError) throw new Error(payoutError.message);
      }
    } catch (err) {
      // Without a payout row the organizer would never be paid — release the
      // idempotency claim and let Stripe retry the whole event.
      console.error(`Failed to record payout for session ${session.id}:`, err);
      await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
      return NextResponse.json({ error: "Failed to record payout" }, { status: 500 });
    }
  }

  // Enqueue the mint instead of minting inline — 10 tickets à 10-15 s would
  // blow Stripe's webhook timeout and risk endpoint deactivation. The job is
  // processed right after the response via after(); the minute cron
  // (/api/cron/mint) retries anything that crashed or only partially minted.
  const { error: jobError } = await supabaseAdmin.from("mint_jobs").upsert(
    {
      stripe_session_id: session.id,
      event_id: eventId,
      buyer_wallet: buyerWallet,
      buyer_email: session.customer_details?.email ?? null,
      quantity,
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  if (jobError) {
    console.error(`Failed to enqueue mint job for session ${session.id}:`, jobError.message);
    await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
    return NextResponse.json({ error: "Failed to enqueue mint job" }, { status: 500 });
  }

  after(async () => {
    try {
      await processMintJobs(3, siteUrl);
    } catch (err) {
      console.error("Post-response mint processing failed:", err);
    }
  });

  return NextResponse.json({ received: true });
}
