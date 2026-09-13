import { supabaseAdmin } from "@/lib/supabase";
import { bookCancellationFee } from "@/lib/platformFees";

/**
 * Einzelerstattung durch den Veranstalter (seit 2026-09-13).
 *
 * „Ich kann doch nicht kommen, bitte Geld zurueck" ist die haeufigste
 * Support-Anfrage im Ticketing. Vorher gab es dafuer nur „Event absagen"
 * (alle Kaeufer) oder den Umweg ueber den Passly-Support und das
 * Stripe-Dashboard. Jetzt erstattet der Veranstalter ein einzelnes Ticket auf
 * der Event-Detailseite.
 *
 * Das Modell ist die Rueckgabe (`src/lib/resaleReturn.ts`), nicht die Absage:
 * die Buchung passiert **hier**, und der `charge.refunded`-Webhook ueberspringt
 * die Charge, wenn eine `organizer_refunds`-Zeile mit `refund_id` darauf
 * zeigt. Der Webhook koennte eine Teilerstattung zwar proportional
 * umrechnen, aber weder das Ticket widerrufen noch den Sitz freigeben — und
 * bei der letzten Karte eines Kaufs wuerde `refund_ticket_sale` die volle
 * Reservierungsmenge freigeben, obwohl die frueheren Karten schon einzeln
 * freigegeben wurden. Ein Ort fuer die Buchung, keine zwei.
 *
 * Erstattet wird der **Anteil dieses Tickets am aktuellen Brutto** der
 * `payouts`-Zeile (`gross / lebende Tickets der Session`), also das, was der
 * Gast fuer genau diese Karte inklusive seines Gebuehrenanteils bezahlt hat —
 * auch nach einem Rabattcode korrekt, weil die Zeile den echten Betrag traegt.
 * Servicegebuehr inklusive, wie bei der Absage: der Veranstalter loest die
 * Erstattung aus, der Gast bekommt sein Geld ganz zurueck. Die Gebuehr, die
 * Stripe einbehaelt, wird wie bei der Absage als `platform_fees_due`
 * (`source = 'cancellation'`) gebucht und von der naechsten Auszahlung
 * abgezogen; der Betrag wird aus der Balance-Transaction gelesen, nie geschaetzt.
 *
 * Nur solange die Auszahlung `pending` ist. `paid`/`held`/`disputed` sind
 * Faelle fuer einen Menschen (`/admin/payouts`), und bis zum Eventtag ist die
 * Zeile dank `effectiveHoldDays` immer noch `pending`.
 */

export type RefundIneligible =
  | "not_found"
  | "not_owner"
  | "season_pass"
  | "box_office"
  | "free_ticket"
  | "revoked"
  | "redeemed"
  | "event_cancelled"
  | "payout_not_pending"
  | "no_payment_reference"
  | "already_refunded";

export interface RefundQuote {
  purchaseId: string;
  assetId: string;
  eventId: string;
  tierId: string | null;
  sessionId: string;
  organizerWallet: string;
  currency: string;
  /** Was der Gast fuer dieses Ticket zurueckbekommt. */
  refundCents: number;
  /** Letztes lebendes Ticket des Kaufs: Stripe erstattet den ganzen Rest. */
  fullRefund: boolean;
  /** Netto-Anteil, der dem Veranstalter aus der Auszahlung genommen wird. */
  netShareCents: number;
  liveCount: number;
  paymentIntentId: string | null;
  chargeId: string | null;
  payoutId: string;
  payout: { gross_cents: number; fee_cents: number; buyer_fee_cents: number | null; net_cents: number };
}

export async function quoteOrganizerRefund(
  assetId: string,
  organizerWallet: string,
): Promise<{ ok: true; quote: RefundQuote } | { ok: false; reason: RefundIneligible }> {
  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("id, asset_id, event_id, tier_id, stripe_session_id, source, season_pass_id, redeemed_at, revoked_at")
    .eq("asset_id", assetId)
    .maybeSingle();
  if (!purchase) return { ok: false, reason: "not_found" };
  if (purchase.season_pass_id || !purchase.event_id) return { ok: false, reason: "season_pass" };
  if ((purchase.source as string | null) === "box_office") return { ok: false, reason: "box_office" };
  if (!purchase.stripe_session_id) return { ok: false, reason: "free_ticket" };
  if (purchase.revoked_at) return { ok: false, reason: "revoked" };
  if (purchase.redeemed_at) return { ok: false, reason: "redeemed" };

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, organizer_wallet, cancelled_at")
    .eq("id", purchase.event_id as string)
    .maybeSingle();
  if (!event) return { ok: false, reason: "not_found" };
  if ((event.organizer_wallet as string) !== organizerWallet) return { ok: false, reason: "not_owner" };
  if (event.cancelled_at) return { ok: false, reason: "event_cancelled" };

  const { data: existing } = await supabaseAdmin
    .from("organizer_refunds")
    .select("id")
    .eq("purchase_id", purchase.id as string)
    .maybeSingle();
  if (existing) return { ok: false, reason: "already_refunded" };

  const sessionId = purchase.stripe_session_id as string;
  const { data: payout } = await supabaseAdmin
    .from("payouts")
    .select("id, status, currency, gross_cents, fee_cents, buyer_fee_cents, net_cents, payment_intent_id, charge_id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  // Freitickets haben keine payouts-Zeile; es gibt nichts zu erstatten.
  if (!payout) return { ok: false, reason: "free_ticket" };
  if (payout.status !== "pending") return { ok: false, reason: "payout_not_pending" };
  if (!payout.payment_intent_id && !payout.charge_id) return { ok: false, reason: "no_payment_reference" };

  const { count } = await supabaseAdmin
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("stripe_session_id", sessionId)
    .is("revoked_at", null);
  const liveCount = Math.max(1, count ?? 1);

  const gross = payout.gross_cents as number;
  const net = payout.net_cents as number;
  const fullRefund = liveCount === 1;
  const refundCents = fullRefund ? gross : Math.round(gross / liveCount);
  const netShareCents = fullRefund ? net : Math.round(net / liveCount);
  if (refundCents <= 0) return { ok: false, reason: "free_ticket" };

  return {
    ok: true,
    quote: {
      purchaseId: purchase.id as string,
      assetId,
      eventId: event.id as string,
      tierId: (purchase.tier_id as string | null) ?? null,
      sessionId,
      organizerWallet,
      currency: (payout.currency as string) ?? "eur",
      refundCents,
      fullRefund,
      netShareCents,
      liveCount,
      paymentIntentId: (payout.payment_intent_id as string | null) ?? null,
      chargeId: (payout.charge_id as string | null) ?? null,
      payoutId: payout.id as string,
      payout: {
        gross_cents: gross,
        fee_cents: payout.fee_cents as number,
        buyer_fee_cents: (payout.buyer_fee_cents as number | null) ?? null,
        net_cents: net,
      },
    },
  };
}

export interface RefundOutcome {
  refundId: string;
  refundCents: number;
  fullRefund: boolean;
  /** Stripe-Gebuehr, die dem Veranstalter weiterbelastet wird; null = unbekannt. */
  stripeFeeCents: number | null;
}

/**
 * Fuehrt die Erstattung aus. Reihenfolge und Rueckabwicklung wie bei der
 * Rueckgabe: erst das Ticket widerrufen (Compare-and-swap auf `revoked_at`,
 * das ist der Mutex), dann die Audit-Zeile, dann Stripe, dann Sitz und
 * Auszahlungszeile. Scheitert Stripe, werden Widerruf und Zeile zurueckgenommen.
 */
export async function executeOrganizerRefund(quote: RefundQuote): Promise<RefundOutcome> {
  const now = new Date().toISOString();

  const { data: revoked } = await supabaseAdmin
    .from("purchases")
    .update({ revoked_at: now })
    .eq("id", quote.purchaseId)
    .is("revoked_at", null)
    .is("redeemed_at", null)
    .select("id");
  if (!revoked || revoked.length === 0) {
    throw new RefundError("Dieses Ticket ist inzwischen eingelöst oder bereits storniert.", 409);
  }

  const { data: logRow, error: logError } = await supabaseAdmin
    .from("organizer_refunds")
    .insert({
      purchase_id: quote.purchaseId,
      asset_id: quote.assetId,
      event_id: quote.eventId,
      organizer_wallet: quote.organizerWallet,
      stripe_session_id: quote.sessionId,
      charge_id: quote.chargeId,
      payment_intent_id: quote.paymentIntentId,
      refund_cents: quote.refundCents,
      currency: quote.currency,
      full_refund: quote.fullRefund,
    })
    .select("id")
    .single();
  if (logError || !logRow) {
    await supabaseAdmin.from("purchases").update({ revoked_at: null }).eq("id", quote.purchaseId);
    throw new RefundError(logError?.code === "23505" ? "Dieses Ticket wurde bereits erstattet." : (logError?.message ?? "Erstattung konnte nicht vorgemerkt werden."), 409);
  }

  const { stripe } = await import("@/lib/stripe");
  let refundId: string;
  let chargeIdFromRefund: string | null = null;
  let stripeFeeCents: number | null = null;
  try {
    const refund = await stripe.refunds.create(
      {
        ...(quote.paymentIntentId
          ? { payment_intent: quote.paymentIntentId }
          : { charge: quote.chargeId as string }),
        // Beim letzten Ticket erstattet Stripe ohne `amount` den ganzen Rest;
        // so kann eine Rundungsdifferenz aus frueheren Teilbetraegen nie einen
        // Cent auf der Charge zuruecklassen.
        ...(quote.fullRefund ? {} : { amount: quote.refundCents }),
        metadata: { organizer_refund_id: logRow.id as string, asset_id: quote.assetId, cause: "organizer_refund" },
        expand: ["charge.balance_transaction"],
      },
      { idempotencyKey: `organizer-refund-${logRow.id as string}` },
    );
    refundId = refund.id;

    // Die einbehaltene Stripe-Gebuehr faellt auf die ganze Charge an; bei einer
    // Teilerstattung wird der Anteil dieses Tickets weiterbelastet. Gelesen,
    // nicht geschaetzt — fehlt die Expansion, wird nichts gebucht.
    const charge = typeof refund.charge === "object" && refund.charge !== null ? refund.charge : null;
    chargeIdFromRefund = charge?.id ?? (typeof refund.charge === "string" ? refund.charge : null);
    const bt = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
    if (bt && charge && charge.amount > 0) {
      stripeFeeCents = Math.round((bt.fee * quote.refundCents) / charge.amount);
    }
  } catch (err) {
    await supabaseAdmin.from("organizer_refunds").delete().eq("id", logRow.id as string);
    await supabaseAdmin.from("purchases").update({ revoked_at: null }).eq("id", quote.purchaseId);
    throw new RefundError(err instanceof Error ? err.message : "Stripe-Erstattung fehlgeschlagen.", 502);
  }

  // Charge-ID nachtragen, falls die Zeile nur die Payment-Intent kannte: der
  // Webhook erkennt die Erstattung an einem von beiden.
  await supabaseAdmin
    .from("organizer_refunds")
    .update({ refund_id: refundId, charge_id: chargeIdFromRefund ?? quote.chargeId })
    .eq("id", logRow.id as string);

  // Sitz freigeben, damit der normale Checkout ihn wieder verkaufen kann.
  const { error: seatError } = await supabaseAdmin.rpc("release_sold_seats", {
    p_event_id: quote.eventId,
    p_quantity: 1,
    p_tier_id: quote.tierId,
  });
  if (seatError) console.error(`release_sold_seats failed after organizer refund ${logRow.id as string}:`, seatError.message);

  // Auszahlungszeile: Invariante net = gross − fee bleibt erhalten.
  if (quote.fullRefund) {
    await supabaseAdmin
      .from("payouts")
      .update({
        status: "refunded",
        gross_cents: 0,
        fee_cents: 0,
        buyer_fee_cents: quote.payout.buyer_fee_cents == null ? null : 0,
        net_cents: 0,
        failure_reason: "Vom Veranstalter vollständig erstattet",
        updated_at: now,
      })
      .eq("id", quote.payoutId);
    // Kein Ticket mehr zu liefern.
    await supabaseAdmin
      .from("mint_jobs")
      .update({ status: "failed", last_error: "Organizer refunded every ticket", updated_at: now })
      .eq("stripe_session_id", quote.sessionId)
      .eq("status", "queued");
  } else {
    const p = quote.payout;
    const gross = Math.max(0, p.gross_cents - quote.refundCents);
    const net = Math.max(0, p.net_cents - quote.netShareCents);
    const fee = Math.max(0, gross - net);
    const buyerFee = p.buyer_fee_cents == null
      ? null
      : Math.min(fee, Math.round((gross * p.buyer_fee_cents) / Math.max(1, p.gross_cents)));
    await supabaseAdmin
      .from("payouts")
      .update({
        gross_cents: gross,
        fee_cents: fee,
        buyer_fee_cents: buyerFee,
        net_cents: net,
        failure_reason: `Vom Veranstalter teilerstattet (${quote.refundCents} ${quote.currency})`,
        updated_at: now,
      })
      .eq("id", quote.payoutId);
  }

  if (stripeFeeCents && stripeFeeCents > 0) {
    await bookCancellationFee({
      organizerWallet: quote.organizerWallet,
      eventId: quote.eventId,
      sessionId: `rf_${logRow.id as string}`,
      quantity: 1,
      feeCents: stripeFeeCents,
      currency: quote.currency,
    });
  }

  return { refundId, refundCents: quote.refundCents, fullRefund: quote.fullRefund, stripeFeeCents };
}

export class RefundError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const REFUND_REASON_TEXT: Record<RefundIneligible, string> = {
  not_found: "Ticket nicht gefunden.",
  not_owner: "Dieses Ticket gehört nicht zu deiner Veranstaltung.",
  season_pass: "Saisonpässe können nicht einzeln erstattet werden.",
  box_office: "Abendkassen-Verkäufe laufen nicht über Passly und können hier nicht erstattet werden.",
  free_ticket: "Für dieses Ticket wurde nichts bezahlt.",
  revoked: "Dieses Ticket ist bereits storniert.",
  redeemed: "Dieses Ticket wurde bereits eingelöst.",
  event_cancelled: "Das Event ist abgesagt; die Erstattung läuft bereits.",
  payout_not_pending: "Die Zahlung ist bereits ausgezahlt oder in Klärung. Wende dich an den Support.",
  no_payment_reference: "Zu dieser Zahlung fehlt die Referenz. Wende dich an den Support.",
  already_refunded: "Dieses Ticket wurde bereits erstattet.",
};
