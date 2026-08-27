import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { buildPayoutRow, claimWebhookEvent, computeAvailableAt, computeFeeSplit, disputeFeeCents, resolveFeeCents } from "@/lib/payouts";
import { subscriptionPlanFromStatus } from "@/lib/subscription";
import { processMintJobs } from "@/lib/mintJobs";
import { sendAdminAlert } from "@/lib/email";
import { notifyWaitlistIfSeats } from "@/lib/waitlist";
import { ensureGuestOrder } from "@/lib/guestOrders";
import { bookChargebackFee } from "@/lib/platformFees";

function appBaseUrl(): string {
  return process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

// Fire-and-forget admin alert; webhook latency must not depend on Resend.
function alertAdmin(subject: string, text: string): void {
  void sendAdminAlert({ subject, text }).catch((err) => console.error("Admin alert failed:", err));
}

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds; minting continues in after() once the response is sent

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
  // on multiple endpoints; a second delivery is acknowledged without reprocessing.
  const handledTypes = new Set<string>([
    "checkout.session.completed",
    "checkout.session.expired",
    "account.updated",
    "payout.paid",
    "payout.failed",
    "charge.dispute.created",
    "charge.dispute.closed",
    "charge.refunded",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
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

  // Pro-subscription checkout sessions must never reach the ticket path below;
  // they carry no reservation and no ticket metadata, so falling through would
  // mean bogus release_reservation calls or 400-retry loops from Stripe.
  if (stripeEvent.type === "checkout.session.completed" || stripeEvent.type === "checkout.session.expired") {
    const s = stripeEvent.data.object as Stripe.Checkout.Session;
    if (s.mode === "subscription" || s.metadata?.purpose === "pro_subscription") {
      if (stripeEvent.type === "checkout.session.completed") {
        const organizerWallet = s.metadata?.organizerWallet;
        if (organizerWallet) {
          const subscriptionId = typeof s.subscription === "string"
            ? s.subscription
            : s.subscription?.id ?? null;
          await supabaseAdmin
            .from("organizers")
            .update({ plan: "pro", stripe_subscription_id: subscriptionId })
            .eq("wallet_address", organizerWallet);
        } else {
          console.error(`Subscription checkout ${s.id} without organizerWallet metadata`);
        }
      }
      return NextResponse.json({ received: true });
    }
  }

  // Season-pass sessions (metadata.purpose === 'season_pass') book against the
  // pass's own capacity pot and belong to no single event, so they must branch
  // out before the primary ticket path, which resolves an eventId. Expiry falls
  // through to the generic release_reservation below; that SQL function reads
  // the reservation row and handles pass rows itself.
  if (stripeEvent.type === "checkout.session.completed") {
    const s = stripeEvent.data.object as Stripe.Checkout.Session;
    if (s.metadata?.purpose === "season_pass") {
      try {
        await handlePassCompleted(s);
      } catch (err) {
        console.error(`Failed to settle season pass for session ${s.id}:`, err);
        alertAdmin(
          `Saisonpass-Abwicklung fehlgeschlagen; Session ${s.id}`,
          `checkout.session.completed (Saisonpass) schlug fehl; Stripe stellt erneut zu.\n`
            + `Fehler: ${err instanceof Error ? err.message : String(err)}`,
        );
        await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
        return NextResponse.json({ error: "Failed to settle season pass" }, { status: 500 });
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
  }

  // Pro-subscription lifecycle: created/updated set the plan from the current
  // status (past_due/canceled/unpaid downgrade automatically), deleted resets
  // to free. Organizer resolved via subscription metadata, customer as fallback.
  if (
    stripeEvent.type === "customer.subscription.created"
    || stripeEvent.type === "customer.subscription.updated"
    || stripeEvent.type === "customer.subscription.deleted"
  ) {
    const sub = stripeEvent.data.object as Stripe.Subscription;
    const deleted = stripeEvent.type === "customer.subscription.deleted";
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const periodEnd = sub.items?.data?.[0]?.current_period_end ?? null;

    const update = {
      plan: deleted ? "free" : subscriptionPlanFromStatus(sub.status),
      stripe_subscription_id: deleted ? null : sub.id,
      plan_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      plan_cancel_at_period_end: deleted ? false : (sub.cancel_at_period_end ?? false),
    };

    const organizerWallet = sub.metadata?.organizerWallet;
    const query = supabaseAdmin.from("organizers").update(update);
    const { data: updatedRows, error: subError } = await (organizerWallet
      ? query.eq("wallet_address", organizerWallet)
      : query.eq("stripe_customer_id", customerId)
    ).select("id");

    if (subError) {
      console.error(`Failed to apply subscription ${sub.id} to organizer:`, subError.message);
      await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
      return NextResponse.json({ error: "Failed to update organizer plan" }, { status: 500 });
    }
    if (!updatedRows || updatedRows.length === 0) {
      console.error(`Subscription ${sub.id}: no organizer matched (wallet=${organizerWallet ?? "-"}, customer=${customerId})`);
      alertAdmin(
        `Abo-Webhook ohne passenden Organizer; ${sub.id}`,
        `customer.subscription.${deleted ? "deleted" : "updated"} konnte keinem Organizer zugeordnet werden.\n`
          + `Wallet-Metadata: ${organizerWallet ?? "fehlt"}, Stripe-Customer: ${customerId}.`,
      );
    }
    return NextResponse.json({ received: true });
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
    // Freed seats may unlock waitlisted buyers; best-effort, never blocks the ack.
    const expiredEventId = expiredSession.metadata?.eventId;
    if (expiredEventId) {
      void notifyWaitlistIfSeats(expiredEventId, appBaseUrl()).catch((err) =>
        console.error("Waitlist notify (expired) failed:", err),
      );
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
  // no balance action; Stripe returns funds to the connected account balance.
  if (stripeEvent.type === "payout.paid" || stripeEvent.type === "payout.failed") {
    const payout = stripeEvent.data.object as Stripe.Payout;
    if (stripeEvent.type === "payout.failed") {
      console.error(
        `Connect payout failed for account ${stripeEvent.account}: ${payout.id} (${payout.failure_message ?? payout.failure_code ?? "unknown"})`,
      );
      alertAdmin(
        `Bank-Auszahlung eines Organizers fehlgeschlagen; ${payout.id}`,
        `Connected Account ${stripeEvent.account ?? "?"}: ${payout.failure_message ?? payout.failure_code ?? "unknown"}.\n`
          + `Weitere Transfers an diesen Organizer wurden auf 'held' gesetzt.`,
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

  // A refund on a platform charge. Fires for partial and full refunds alike;
  // amount_refunded is cumulative, so reprocessing is idempotent.
  // - full refund before transfer → payout 'refunded', tickets revoked, seats freed
  // - partial refund before transfer → organizer share recomputed from the remainder
  // - refund after transfer → flag for manual recovery (money already left)
  if (stripeEvent.type === "charge.refunded") {
    const charge = stripeEvent.data.object as Stripe.Charge;

    // A ticket return ("Rückgabe & Neuverkauf") refunds the seller off their
    // ORIGINAL charge — and must not run the bookkeeping below. The seat was
    // sold again, so the organizer keeps every cent of their original payout;
    // rescaling fee/net here would take money off them for a sale that stands,
    // and revoking would hit a purchase row that is already revoked by design.
    //
    // Detected against our own table rather than the refund's Stripe metadata:
    // `charge.refunds` is not reliably expanded on a webhook payload.
    const { data: returnOffer } = await supabaseAdmin
      .from("resale_offers")
      .select("id")
      .eq("origin_charge_id", charge.id)
      .not("refund_id", "is", null)
      .maybeSingle();
    if (returnOffer) {
      return NextResponse.json({ received: true, resaleReturn: true });
    }

    const { data: payout } = await supabaseAdmin
      .from("payouts")
      .select("id, status, stripe_session_id, event_id, currency, gross_cents, fee_cents, buyer_fee_cents")
      .eq("charge_id", charge.id)
      .maybeSingle();

    if (!payout) {
      console.error(`Refund on charge ${charge.id} with no payout row and no return offer`);
      return NextResponse.json({ received: true });
    }

    try {
      const remainingCents = Math.max(0, charge.amount - charge.amount_refunded);
      const fullyRefunded = charge.refunded || remainingCents <= 0;
      const now = new Date().toISOString();

      if (payout.status === "paid") {
        await supabaseAdmin
          .from("payouts")
          .update({
            failure_reason: `Refund of ${charge.amount_refunded} ${payout.currency} received AFTER transfer; manual recovery needed`,
            updated_at: now,
          })
          .eq("id", payout.id);
        alertAdmin(
          `Refund NACH Auszahlung; manuelle Klärung (Session ${payout.stripe_session_id})`,
          `Charge ${charge.id} wurde um ${charge.amount_refunded} ${payout.currency} erstattet, `
            + `aber der Organizer-Transfer ist bereits gelaufen. Betrag muss manuell zurückgeholt werden.\n`
            + `Payout-Row: ${payout.id}`,
        );
      } else if (fullyRefunded) {
        const { error: payoutError } = await supabaseAdmin
          .from("payouts")
          .update({
            status: "refunded",
            net_cents: 0,
            failure_reason: `Fully refunded; transfer cancelled`,
            updated_at: now,
          })
          .eq("id", payout.id);
        if (payoutError) throw new Error(payoutError.message);

        // Revoke the session's tickets (rejected at the door) and free the seats.
        await supabaseAdmin
          .from("purchases")
          .update({ revoked_at: now })
          .eq("stripe_session_id", payout.stripe_session_id)
          .is("revoked_at", null);
        const { error: seatError } = await supabaseAdmin.rpc("refund_ticket_sale", {
          p_session_id: payout.stripe_session_id,
        });
        if (seatError) throw new Error(seatError.message);

        // Freed seats may unlock waitlisted buyers; best-effort.
        if (payout.event_id) {
          void notifyWaitlistIfSeats(payout.event_id as string, appBaseUrl()).catch((err) =>
            console.error("Waitlist notify (refund) failed:", err),
          );
        }

        // Stop a not-yet-minted job; no point delivering revoked tickets.
        await supabaseAdmin
          .from("mint_jobs")
          .update({ status: "failed", last_error: "Charge fully refunded", updated_at: now })
          .eq("stripe_session_id", payout.stripe_session_id)
          .eq("status", "queued");
      } else {
        // Scale fee and net by the row's own fee ratio so the split survives
        // both fee models (legacy 3% rows and buyer-side service-fee rows) and
        // successive partial refunds. Falls back to the legacy split if the
        // row has no usable ratio.
        const { feeCents, netCents } = payout.gross_cents > 0 && payout.fee_cents >= 0
          ? (() => {
              const fee = Math.min(
                remainingCents,
                Math.round((remainingCents * payout.fee_cents) / payout.gross_cents),
              );
              return { feeCents: fee, netCents: remainingCents - fee };
            })()
          : computeFeeSplit(remainingCents);
        // The buyer's share has to shrink with the same ratio, or the receipt
        // would derive a wrong ticket price from `gross − buyer_fee_cents`.
        const buyerFeeCents = payout.buyer_fee_cents == null
          ? null
          : payout.gross_cents > 0
            ? Math.min(feeCents, Math.round((remainingCents * payout.buyer_fee_cents) / payout.gross_cents))
            : 0;
        const { error: payoutError } = await supabaseAdmin
          .from("payouts")
          .update({
            gross_cents: remainingCents,
            fee_cents: feeCents,
            buyer_fee_cents: buyerFeeCents,
            net_cents: netCents,
            failure_reason: `Partially refunded (${charge.amount_refunded} of ${charge.amount} ${payout.currency})`,
            updated_at: now,
          })
          .eq("id", payout.id);
        if (payoutError) throw new Error(payoutError.message);
      }
    } catch (err) {
      console.error(`Failed to process refund for charge ${charge.id}:`, err);
      alertAdmin(
        `Refund-Verarbeitung fehlgeschlagen; Charge ${charge.id}`,
        `Der charge.refunded-Webhook ist fehlgeschlagen und wird von Stripe erneut zugestellt.\n`
          + `Fehler: ${err instanceof Error ? err.message : String(err)}`,
      );
      await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
      return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
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
        update.failure_reason = `Chargeback ${dispute.id}; transfer blocked`;
      } else {
        update.failure_reason = `Chargeback ${dispute.id} received AFTER transfer; manual recovery needed`;
      }
      await supabaseAdmin.from("payouts").update(update).eq("id", payout.id);
      alertAdmin(
        `Chargeback eingegangen; ${dispute.id}`,
        `Dispute über ${dispute.amount} ${dispute.currency} auf Charge ${chargeId}.\n`
          + (update.status === "disputed"
            ? `Der Organizer-Transfer wurde blockiert (Payout ${payout.id}).`
            : `ACHTUNG: Der Transfer ist bereits gelaufen; manuelle Klärung nötig (Payout ${payout.id}).`)
          + `\nFrist & Evidence im Stripe-Dashboard.`,
      );
    } else {
      // Every charge Passly takes now belongs to a payout row; a chargeback
      // without one means the money and the sale have drifted apart.
      console.error(`Dispute ${dispute.id} for charge ${chargeId} with no payout row`);
      alertAdmin(
        `Chargeback ohne Payout-Zeile; ${dispute.id}`,
        `Dispute über ${dispute.amount} ${dispute.currency} auf Charge ${chargeId}, `
          + `zu der sich keine Zahlung zuordnen liess. Manuell im Stripe-Dashboard prüfen.`,
      );
    }
    return NextResponse.json({ received: true });
  }

  // The dispute is decided. Stripe's flat dispute fee is only really gone when
  // the dispute was lost — a won one carries a compensating balance transaction
  // — so the outcome, not the opening, is the moment to pass the cost on.
  if (stripeEvent.type === "charge.dispute.closed") {
    const dispute = stripeEvent.data.object as Stripe.Dispute;
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
    const feeCents = disputeFeeCents(dispute.balance_transactions);

    const { data: payout } = await supabaseAdmin
      .from("payouts")
      .select("id, status, organizer_wallet, event_id, season_pass_id")
      .eq("charge_id", chargeId)
      .maybeSingle();

    if (!payout) {
      console.error(`Closed dispute ${dispute.id} for charge ${chargeId} with no payout row`);
      alertAdmin(
        `Chargeback abgeschlossen ohne Payout-Zeile; ${dispute.id}`,
        `Dispute ${dispute.id} auf Charge ${chargeId} wurde mit Status ${dispute.status} `
          + `geschlossen, liess sich aber keiner Zahlung zuordnen. Manuell pruefen.`,
      );
      return NextResponse.json({ received: true });
    }

    // Only the amount Stripe actually withheld, mirroring the cancellation
    // path. `bookChargebackFee` skips a zero, so a won dispute books nothing.
    const outcome = await bookChargebackFee({
      organizerWallet: payout.organizer_wallet as string,
      eventId: (payout.event_id as string | null) ?? null,
      seasonPassId: (payout.season_pass_id as string | null) ?? null,
      disputeId: dispute.id,
      feeCents,
      currency: dispute.currency ?? "eur",
    });

    // The payout status is deliberately NOT changed here. Releasing money is a
    // human decision in this system (/admin/payouts); a webhook that quietly
    // un-blocks a transfer would be the one place where it isn't.
    alertAdmin(
      `Chargeback ${dispute.status}; ${dispute.id}`,
      `Dispute ${dispute.id} auf Charge ${chargeId} wurde als "${dispute.status}" geschlossen `
        + `(Payout ${payout.id}, Status ${payout.status}).\n`
        + (dispute.status === "won"
          ? `Der Betrag kann im Admin freigegeben werden.`
          : dispute.status === "lost"
            ? `Der Betrag ist verloren; der Transfer bleibt blockiert.`
            // warning_closed u. a.: kein Geld bewegt, aber der Payout haengt
            // seit charge.dispute.created auf "disputed" und braucht eine Hand.
            : `Kein Geldfluss, der Payout steht aber weiter auf "disputed".`)
        + `\nStripe-Gebuehr: ${(feeCents / 100).toFixed(2)} ${(dispute.currency ?? "eur").toUpperCase()} `
        + `(Weiterbelastung: ${outcome}).`,
    );
    return NextResponse.json({ received: true });
  }

  const session = stripeEvent.data.object as Stripe.Checkout.Session;
  const { eventId, buyerWallet, quantity: quantityStr, tierId } = session.metadata ?? {};
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

  // Convert the checkout reservation into a sale; atomic and idempotent, so a
  // webhook retry (partial mint) can never double-count. Capacity is accounted
  // by payment, independent of mint success.
  const { error: finalizeError } = await supabaseAdmin.rpc("finalize_ticket_sale", {
    p_session_id: session.id,
    p_event_id: eventId,
    p_quantity: quantity,
    p_tier_id: tierId ?? null,
  });
  if (finalizeError) {
    console.error(`Failed to finalize ticket sale for session ${session.id}:`, finalizeError.message);
    await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
    return NextResponse.json({ error: "Failed to finalize ticket sale" }, { status: 500 });
  }

  // Book the discount-code use (idempotent at the Stripe-event level; the
  // webhook claim above already deduplicates retries). Best-effort: a failed
  // counter must never fail the sale.
  const discountCodeId = session.metadata?.discountCodeId;
  if (discountCodeId) {
    void supabaseAdmin
      .rpc("increment_discount_uses", { p_code_id: discountCodeId, p_quantity: quantity })
      .then(({ error: incError }) => {
        if (incError) console.error(`Discount use increment failed for ${discountCodeId}:`, incError.message);
      });
  }

  // Record the payout obligation before minting; money accounting must exist
  // even if on-chain minting fails. Unique on stripe_session_id, so a webhook
  // retry after a partial mint can never create a second payout row.
  const grossCents = session.amount_total ?? 0;
  if (grossCents > 0) {
    try {
      // Expanding latest_charge costs nothing extra and yields the payment
      // method actually used. Settlement timing and dispute handling differ
      // per method (PayPal, Klarna and SEPA are not cards), so a held payout
      // has to be attributable to one.
      let chargeId: string | null = null;
      let paymentMethod: string | null = null;
      if (typeof session.payment_intent === "string") {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
          expand: ["latest_charge"],
        });
        const latest = pi.latest_charge;
        if (typeof latest === "string") {
          chargeId = latest;
        } else if (latest) {
          chargeId = latest.id;
          paymentMethod = latest.payment_method_details?.type ?? null;
        }
        if (!paymentMethod) paymentMethod = pi.payment_method_types?.[0] ?? null;
      }

      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("stripe_account_id")
        .eq("wallet_address", event.organizer_wallet)
        .maybeSingle();

      // Service fee recorded at checkout creation: `serviceFeeCents` is the
      // full platform take, `buyerFeeCents` the share contained in the charge
      // (the rest came out of the organizer's price, see events.fee_payer).
      // Both absent on sessions from before their time → legacy 3% split.
      const serviceFeeRaw = session.metadata?.serviceFeeCents;
      const serviceFeeCents = serviceFeeRaw != null && /^\d+$/.test(serviceFeeRaw)
        ? parseInt(serviceFeeRaw, 10)
        : null;
      const buyerFeeRaw = session.metadata?.buyerFeeCents;
      const buyerFeeCents = buyerFeeRaw != null && /^\d+$/.test(buyerFeeRaw)
        ? parseInt(buyerFeeRaw, 10)
        : null;

      const payoutRow = buildPayoutRow({
        session,
        chargeId,
        paymentMethod,
        eventId,
        eventDate: event.date,
        organizerWallet: event.organizer_wallet,
        stripeAccountId: (organizer?.stripe_account_id as string | null) ?? null,
        holdDays: event.payout_hold_days ?? 0,
        serviceFeeCents,
        buyerFeeCents,
      });
      if (payoutRow) {
        const { error: payoutError } = await supabaseAdmin
          .from("payouts")
          .upsert(payoutRow, { onConflict: "stripe_session_id", ignoreDuplicates: true });
        if (payoutError) throw new Error(payoutError.message);
      }
    } catch (err) {
      // Without a payout row the organizer would never be paid; release the
      // idempotency claim and let Stripe retry the whole event.
      console.error(`Failed to record payout for session ${session.id}:`, err);
      alertAdmin(
        `Payout-Row konnte nicht geschrieben werden; Session ${session.id}`,
        `checkout.session.completed schlug beim Anlegen der Payout-Zeile fehl; Stripe stellt erneut zu.\n`
          + `Fehler: ${err instanceof Error ? err.message : String(err)}`,
      );
      await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
      return NextResponse.json({ error: "Failed to record payout" }, { status: 500 });
    }
  }

  // Guest checkout: record the order before the mint job, so the token exists
  // by the time the confirmation mail goes out. Failing here would leave the
  // buyer without any way to reach their ticket, so it aborts like the payout
  // row does and lets Stripe redeliver.
  if (session.metadata?.guest === "1") {
    try {
      await ensureGuestOrder({
        stripeSessionId: session.id,
        eventId,
        email: session.customer_details?.email ?? null,
        lang: session.metadata?.lang === "en" ? "en" : "de",
      });
    } catch (err) {
      console.error(`Failed to record guest order for session ${session.id}:`, err);
      alertAdmin(
        `Gast-Bestellung konnte nicht angelegt werden; Session ${session.id}`,
        `Ohne diese Zeile erreicht der Gast sein Ticket nicht; Stripe stellt erneut zu.\n`
          + `Fehler: ${err instanceof Error ? err.message : String(err)}`,
      );
      await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", stripeEvent.id);
      return NextResponse.json({ error: "Failed to record guest order" }, { status: 500 });
    }
  }

  // Enqueue the mint instead of minting inline; 10 tickets à 10-15 s would
  // blow Stripe's webhook timeout and risk endpoint deactivation. The job is
  // processed right after the response via after(); the minute cron
  // (/api/cron/mint) retries anything that crashed or only partially minted.
  const { error: jobError } = await supabaseAdmin.from("mint_jobs").upsert(
    {
      stripe_session_id: session.id,
      event_id: eventId,
      tier_id: tierId ?? null,
      buyer_wallet: buyerWallet,
      buyer_email: session.customer_details?.email ?? null,
      quantity,
      lang: session.metadata?.lang === "en" ? "en" : "de",
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

/**
 * Settle a completed season-pass checkout. Same three steps as the ticket path
 * — convert the reservation, record the payout obligation, enqueue the mint —
 * but against the pass instead of an event.
 *
 * The payout hold is anchored on the purchase date, not an event date: a pass
 * spans many dates, and holding the organizer's money until the last one would
 * turn a season sale into a season-long loan. Throws on a genuine failure so
 * the caller releases the idempotency claim and Stripe retries.
 */
async function handlePassCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const passId = session.metadata?.passId;
  const buyerWallet = session.metadata?.buyerWallet;
  const quantity = Math.max(1, Math.min(10, parseInt(session.metadata?.quantity ?? "1", 10) || 1));
  if (!passId || !buyerWallet) {
    // Nothing we can do without the linkage; a retry wouldn't help.
    console.error(`Season-pass session ${session.id} missing metadata`);
    return;
  }

  const { data: pass, error: passError } = await supabaseAdmin
    .from("season_passes")
    .select("id, name, organizer_wallet, payout_hold_days")
    .eq("id", passId)
    .single();
  if (passError || !pass) throw new Error(`Season pass ${passId} not found`);

  const { error: finalizeError } = await supabaseAdmin.rpc("finalize_pass_sale", {
    p_session_id: session.id,
    p_pass_id: passId,
    p_quantity: quantity,
  });
  if (finalizeError) throw new Error(`finalize_pass_sale: ${finalizeError.message}`);

  const grossCents = session.amount_total ?? 0;
  if (grossCents > 0) {
    let chargeId: string | null = null;
    let paymentMethod: string | null = null;
    if (typeof session.payment_intent === "string") {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
        expand: ["latest_charge"],
      });
      const latest = pi.latest_charge;
      if (typeof latest === "string") {
        chargeId = latest;
      } else if (latest) {
        chargeId = latest.id;
        paymentMethod = latest.payment_method_details?.type ?? null;
      }
      if (!paymentMethod) paymentMethod = pi.payment_method_types?.[0] ?? null;
    }

    const { data: organizer } = await supabaseAdmin
      .from("organizers")
      .select("stripe_account_id")
      .eq("wallet_address", pass.organizer_wallet)
      .maybeSingle();

    const serviceFeeRaw = session.metadata?.serviceFeeCents;
    const parsedFee = serviceFeeRaw != null && /^\d+$/.test(serviceFeeRaw)
      ? parseInt(serviceFeeRaw, 10)
      : null;
    // A season pass has no event, so `events.fee_payer` does not apply to it:
    // the buyer always carries the whole fee here (v1).
    const { feeCents } = resolveFeeCents(grossCents, parsedFee);

    const { error: payoutError } = await supabaseAdmin.from("payouts").upsert(
      {
        stripe_session_id: session.id,
        payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        charge_id: chargeId,
        event_id: null,
        season_pass_id: passId,
        organizer_wallet: pass.organizer_wallet,
        stripe_account_id: (organizer?.stripe_account_id as string | null) ?? null,
        gross_cents: grossCents,
        fee_cents: feeCents,
        net_cents: grossCents - feeCents,
        currency: session.currency ?? "eur",
        // Empty date → computeAvailableAt anchors the hold on now (purchase time).
        available_at: computeAvailableAt("", (pass.payout_hold_days as number) ?? 0).toISOString(),
        payment_method: paymentMethod,
      },
      { onConflict: "stripe_session_id", ignoreDuplicates: true },
    );
    if (payoutError) throw new Error(`payout row: ${payoutError.message}`);
  }

  const { error: jobError } = await supabaseAdmin.from("mint_jobs").upsert(
    {
      stripe_session_id: session.id,
      event_id: null,
      season_pass_id: passId,
      tier_id: null,
      buyer_wallet: buyerWallet,
      buyer_email: session.customer_details?.email ?? null,
      quantity,
      lang: session.metadata?.lang === "en" ? "en" : "de",
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  if (jobError) throw new Error(`mint job: ${jobError.message}`);
}
