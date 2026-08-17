import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import type { TicketTier } from "@/lib/supabase";
import { isFeePayer, splitServiceFee, type FeePayer } from "@/lib/fees";
import { findValidDiscount, discountedUnitPrice, type ValidDiscount } from "@/lib/discounts";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { getOperatorWalletAddress } from "@/lib/transfer";
import { isBot, botDenied } from "@/lib/botCheck";
import { holdsQueueSlot } from "@/lib/queue";
import { getLang } from "@/lib/i18nServer";

interface CheckoutBody {
  eventId: string;
  /** Omitted for guest checkout; the operator wallet holds the ticket instead. */
  buyerWallet?: string;
  quantity?: number;
  tierId?: string;
  discountCode?: string;
  /** Buy without an account. The ticket is escrowed and reachable via /order/<token>. */
  guest?: boolean;
  /** Waiting-room slot; required when the event has the queue switched on. */
  queueToken?: string;
}

/** How long a buyer's seats are held before others may claim them. */
const HOLD_MINUTES = 5;
/** Stripe's minimum checkout-session lifetime. */
const SESSION_MINUTES = 30;

/**
 * Expires this event's checkout sessions that outlived the 5-minute hold and
 * frees their seats. Only sessions Stripe confirms as expired get released;
 * a session that already completed payment throws on expire and keeps its
 * reservation (the completed-webhook finalizes it). Returns freed count.
 */
async function expireStaleReservations(eventId: string): Promise<number> {
  // expires_at is creation + 30 min, so "older than the hold" means less
  // than (30 - HOLD) minutes of session lifetime left.
  const staleBefore = new Date(Date.now() + (SESSION_MINUTES - HOLD_MINUTES) * 60_000).toISOString();
  const { data: stale } = await supabaseAdmin
    .from("ticket_reservations")
    .select("stripe_session_id")
    .eq("event_id", eventId)
    .eq("status", "reserved")
    .lt("expires_at", staleBefore)
    .limit(10);

  let freed = 0;
  for (const row of (stale ?? []) as { stripe_session_id: string }[]) {
    try {
      await stripe.checkout.sessions.expire(row.stripe_session_id);
    } catch {
      // already completed or already expired-and-released; don't touch it
      continue;
    }
    const { error } = await supabaseAdmin.rpc("release_reservation", {
      p_session_id: row.stripe_session_id,
    });
    if (!error) freed++;
  }
  return freed;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Each checkout claims capacity for 30 minutes and creates a Stripe session,
  // so an unthrottled loop could reserve an event's whole capacity and lock out
  // real buyers (denial-of-sale).
  //
  // The IP bucket is deliberately coarse: a club, a class or a team buying from
  // one venue WLAN shares a single NAT address, and 30 real people must not
  // throttle each other out of a sale. The tight limit lives on the buyer
  // identity below; IP only catches floods from an address with no identity at
  // all. Neither is the primary denial-of-sale defence — that is BotID, the
  // 5-minute hold with `expireStaleReservations`, and the waiting room.
  const ipRl = rateLimit(`checkout:ip:${clientIp(req)}`, 60, 60_000);
  if (!ipRl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfter) } },
    );
  }

  if (await isBot()) return botDenied();

  let body: CheckoutBody;

  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId, quantity: rawQty, tierId, discountCode } = body;
  const quantity = Math.max(1, Math.min(4, Math.floor(rawQty ?? 1)));
  const isGuest = body.guest === true;

  if (!eventId || (!isGuest && !body.buyerWallet)) {
    return NextResponse.json(
      { success: false, error: "eventId and buyerWallet are required" },
      { status: 400 }
    );
  }

  // Per-buyer limit: a queue slot (we issued it) beats a wallet address (the
  // client claims it, and an attacker can invent new ones — which is why the
  // IP cap above still applies to everyone). Guests have neither identifier and
  // are covered by the IP bucket alone.
  const identity = body.queueToken
    ? `q:${body.queueToken}`
    : !isGuest && body.buyerWallet
      ? `w:${body.buyerWallet}`
      : null;
  if (identity) {
    const idRl = rateLimit(`checkout:${identity}`, 8, 60_000);
    if (!idRl.ok) {
      return NextResponse.json(
        { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
        { status: 429, headers: { "Retry-After": String(idRl.retryAfter) } },
      );
    }
  }

  // Guest tickets are minted into operator escrow; the buyer reaches them via
  // the order token that the confirmation mail carries.
  const buyerWallet = isGuest ? getOperatorWalletAddress() : (body.buyerWallet as string);

  const { data: event, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
  }

  if (event.cancelled_at) {
    return NextResponse.json(
      { success: false, error: "Das Event wurde abgesagt." },
      { status: 410 }
    );
  }

  // Guests pay first and unlock the ticket by signing in afterwards. An
  // organizer can require the account up front instead.
  if (isGuest && event.guest_checkout_enabled === false) {
    return NextResponse.json(
      { success: false, error: "Für dieses Event ist ein Konto nötig." },
      { status: 403 }
    );
  }

  // Waiting room: seats may only be reserved by someone currently holding a
  // slot. Checked before the reservation so a queue-jumper never takes
  // capacity away from the people actually in line.
  if (event.queue_enabled === true && !(await holdsQueueSlot(eventId, body.queueToken))) {
    return NextResponse.json(
      { success: false, error: "queue_required" },
      { status: 409 }
    );
  }

  // Every event has at least one tier (backfilled 'Standard' for legacy
  // events). The tier is the price authority; the client only sends an ID,
  // never a price.
  const { data: tiers, error: tiersError } = await supabaseAdmin
    .from("ticket_tiers")
    .select("*")
    .eq("event_id", eventId)
    .order("sort")
    .order("created_at");
  if (tiersError || !tiers || tiers.length === 0) {
    return NextResponse.json(
      { success: false, error: "Event has no ticket tiers" },
      { status: 500 }
    );
  }

  const tier: TicketTier | undefined = tierId
    ? (tiers as TicketTier[]).find((t) => t.id === tierId)
    : tiers.length === 1
    ? (tiers[0] as TicketTier)
    : undefined;
  if (!tier) {
    return NextResponse.json(
      { success: false, error: tierId ? "Unknown ticket tier" : "tierId is required" },
      { status: 400 }
    );
  }

  // Discount code (Pro feature): the tier stays the price authority, the code
  // only scales it. Validated here; never trust a client-side preview.
  let discount: ValidDiscount | null = null;
  if (discountCode) {
    const result = await findValidDiscount(eventId, discountCode, quantity);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    discount = result.discount;
  }
  const unitPrice = discount ? discountedUnitPrice(tier.price_eur, discount.percentOff) : tier.price_eur;

  // Paid tickets require completed Connect onboarding; the KYC gate. Organizers
  // can create events without Stripe, but nobody can pay them until onboarding
  // is done. Free tiers pass through unconditionally.
  //
  // The charge itself is a plain platform charge (Separate Charges & Transfers,
  // NOT a destination charge); see the rationale in src/lib/payouts.ts. The
  // webhook records a payouts row; a daily cron transfers the organizer's share
  // once the event's payout hold period has elapsed.
  if (tier.price_eur > 0) {
    const { data: organizer } = await supabaseAdmin
      .from("organizers")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("wallet_address", event.organizer_wallet)
      .maybeSingle();

    if (!organizer?.stripe_account_id || !organizer.stripe_charges_enabled) {
      return NextResponse.json(
        { success: false, error: "Ticket sales are not active yet, the organizer has not completed payout onboarding." },
        { status: 503 }
      );
    }
  }

  // Claim capacity atomically before creating the Stripe session; the SQL
  // function claims the tier first and the event-level total as the hard
  // overselling gate, so concurrent checkouts can never oversell either. The
  // reservation is converted to a sale by the webhook (checkout.session.completed)
  // or freed again when the session expires (checkout.session.expired).
  //
  // Soft hold: buyers are promised 5 minutes. Stripe won't let a session
  // expire before 30 minutes, so the 5-minute limit is enforced on demand;
  // when capacity is exhausted, sessions older than the hold window are
  // expired and their seats freed before giving up (stops slot-hogging
  // without ever pulling seats from an active, fresh checkout).
  const attemptReserve = async () =>
    supabaseAdmin.rpc("reserve_tickets", {
      p_event_id: eventId,
      p_quantity: quantity,
      p_tier_id: tier.id,
    });

  let { data: reserved, error: reserveError } = await attemptReserve();
  if (!reserveError && !reserved) {
    const freed = await expireStaleReservations(eventId);
    if (freed > 0) {
      ({ data: reserved, error: reserveError } = await attemptReserve());
    }
  }
  if (reserveError) {
    return NextResponse.json({ success: false, error: reserveError.message }, { status: 500 });
  }
  if (!reserved) {
    const available = Math.max(0, tier.capacity - tier.tickets_sold - tier.tickets_reserved);
    return NextResponse.json(
      {
        success: false,
        error: available <= 0
          ? tiers.length > 1
            ? `Kategorie „${tier.name}" ist ausverkauft`
            : "Event is sold out"
          : `Only ${available} ticket${available === 1 ? "" : "s"} remaining`,
      },
      { status: 409 }
    );
  }

  const releaseClaim = async (): Promise<void> => {
    await supabaseAdmin.rpc("unreserve_tickets", {
      p_event_id: eventId,
      p_quantity: quantity,
      p_tier_id: tier.id,
    });
  };

  const host = req.headers.get("host") ?? "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60; // Stripe minimum session lifetime

  // Service fee (€1 + 4% per ticket, src/lib/fees.ts). Who carries it is the
  // organizer's per-event choice; only the buyer's share becomes a line item,
  // the organizer's share is simply missing from the charge and comes off their
  // payout. Both numbers go into the session metadata so the webhook books
  // fee_cents/net_cents from what the buyer actually agreed to, not from a
  // re-computation that could drift.
  //
  // Computed on the DISCOUNTED price, so a deep discount can push the
  // organizer's share above the ticket price; `splitServiceFee` then rolls the
  // excess back onto the buyer rather than letting Passly fund the discount.
  const feePayer: FeePayer = isFeePayer(event.fee_payer) ? event.fee_payer : "buyer";
  const { buyerCents: buyerFeePerTicket, totalCents: feePerTicket } = splitServiceFee(unitPrice, feePayer);
  const lineItemName = tiers.length > 1 ? `${event.name}; ${tier.name}` : event.name;
  const lineItemDescription = discount
    ? `Ticket for ${event.date} · Code ${discount.code} (−${discount.percentOff} %)`
    : `Ticket for ${event.date}`;

  try {
    // NOTE: `payment_method_types` is deliberately NOT set. Omitting it is what
    // enables Stripe's dynamic payment methods, i.e. whatever is switched on in
    // the Stripe Dashboard (card, PayPal, Apple/Google Pay, Klarna) shows up in
    // checkout without a code change. Setting it here would silently pin the
    // checkout back to cards only; don't.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: expiresAt,
      line_items: [
        {
          quantity,
          price_data: {
            currency: "eur",
            unit_amount: unitPrice,
            product_data: { name: lineItemName, description: lineItemDescription },
          },
        },
        ...(buyerFeePerTicket > 0
          ? [
              {
                quantity,
                price_data: {
                  currency: "eur" as const,
                  unit_amount: buyerFeePerTicket,
                  product_data: { name: "Service fee", description: "Per ticket" },
                },
              },
            ]
          : []),
      ],
      success_url: `${origin}/shop/${eventId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop/${eventId}`,
      metadata: {
        eventId,
        buyerWallet,
        quantity: String(quantity),
        tierId: tier.id,
        // The confirmation mail is sent minutes later by the mint worker, long
        // after this request's cookies are gone; the language has to travel.
        lang: await getLang(),
        // The full platform take, regardless of who paid it; `buyerFeeCents`
        // is the part contained in `amount_total`.
        serviceFeeCents: String(feePerTicket * quantity),
        buyerFeeCents: String(buyerFeePerTicket * quantity),
        ...(isGuest ? { guest: "1" } : {}),
        ...(discount ? { discountCodeId: discount.id, discountPercent: String(discount.percentOff) } : {}),
      },
    });

    // Persist the reservation under the session ID so the webhook can convert
    // (completed) or free (expired) it idempotently. Without this row the claim
    // would leak, so a failed insert aborts the checkout.
    const { error: reservationError } = await supabaseAdmin.from("ticket_reservations").insert({
      stripe_session_id: session.id,
      event_id: eventId,
      tier_id: tier.id,
      quantity,
      expires_at: new Date(expiresAt * 1000).toISOString(),
    });
    if (reservationError) {
      await releaseClaim();
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        // best effort; the session dies on its own after 30 minutes
      }
      return NextResponse.json({ success: false, error: reservationError.message }, { status: 500 });
    }

    // The countdown the shop page shows is the 5-minute hold, not the Stripe
    // session lifetime; after the hold, contested seats go to other buyers.
    return NextResponse.json({ success: true, url: session.url, expiresAt: Date.now() + HOLD_MINUTES * 60_000 });
  } catch (err) {
    await releaseClaim();
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
