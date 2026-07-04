import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { mintTicket } from "@/lib/mint";
import { sendTicketConfirmation } from "@/lib/email";
import { buildPayoutRow, claimWebhookEvent } from "@/lib/payouts";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds — multi-ticket minting (each mint ~10-15s, up to 10 tickets)

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
    .select("name, date, tickets_sold, organizer_wallet, payout_hold_days")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
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

  // Idempotency: count tickets already minted for this session (Stripe may retry).
  const { data: existing } = await supabaseAdmin
    .from("purchases")
    .select("asset_id")
    .eq("stripe_session_id", session.id);
  const alreadyMinted = existing?.length ?? 0;
  const toMint = quantity - alreadyMinted;

  // Mint sequentially — Bubblegum appends one leaf at a time; parallel transactions
  // to the same tree conflict. Retry each mint up to 3 times and pause between
  // tickets to let the tree state propagate on the RPC.
  let minted = 0;
  const newAssetIds: string[] = [];
  for (let i = 0; i < toMint; i++) {
    const ticketNum = alreadyMinted + i + 1;

    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
      try {
        const { assetId, signature } = await mintTicket({
          eventName: event.name,
          eventDate: event.date,
          ownerWallet: buyerWallet,
          baseUrl: siteUrl,
        });

        await supabaseAdmin.from("purchases").insert({
          event_id: eventId,
          buyer_wallet: buyerWallet,
          asset_id: assetId,
          signature,
          stripe_session_id: session.id,
        });

        console.info(`Ticket ${ticketNum}/${quantity} minted → assetId=${assetId} sig=${signature}`);
        newAssetIds.push(assetId);
        minted++;
        success = true;
        break;
      } catch (err) {
        console.error(`Ticket ${ticketNum}/${quantity} attempt ${attempt + 1} failed:`, err);
      }
    }

    if (!success) {
      console.error(`Ticket ${ticketNum}/${quantity} failed after 3 attempts, skipping.`);
    }
  }

  const totalNewlyMinted = alreadyMinted + minted;
  if (minted > 0) {
    await supabaseAdmin
      .from("events")
      .update({ tickets_sold: event.tickets_sold + minted })
      .eq("id", eventId);
  }

  // Partial mint: release the idempotency claim and return 500 so Stripe
  // retries this event — the purchases-count check above ensures the retry
  // only mints the missing tickets, never duplicates.
  if (totalNewlyMinted < quantity) {
    console.error(`Partial mint: ${totalNewlyMinted}/${quantity} tickets for session ${session.id}`);
    await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);

    const buyerEmailPartial = session.customer_details?.email;
    if (buyerEmailPartial && newAssetIds.length > 0) {
      void sendTicketConfirmation({
        to: buyerEmailPartial,
        eventName: event.name,
        eventDate: event.date,
        assetIds: newAssetIds,
        baseUrl: siteUrl,
      }).catch((err) => console.error("Confirmation email failed:", err));
    }
    return NextResponse.json({ error: "Partial mint — retry requested" }, { status: 500 });
  }

  // Send confirmation email if we have a buyer email and at least one new ticket
  const buyerEmail = session.customer_details?.email;
  if (buyerEmail && newAssetIds.length > 0) {
    void sendTicketConfirmation({
      to: buyerEmail,
      eventName: event.name,
      eventDate: event.date,
      assetIds: newAssetIds,
      baseUrl: siteUrl,
    }).catch((err) => console.error("Confirmation email failed:", err));
  }

  return NextResponse.json({ received: true });
}
