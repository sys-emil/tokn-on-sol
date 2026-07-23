import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import type { TicketTier } from "@/lib/supabase";
import { serviceFeePerTicketCents } from "@/lib/fees";
import { findValidDiscount, discountedUnitPrice, type ValidDiscount } from "@/lib/discounts";
import { requestOwnsWallet } from "@/lib/privyServer";
import { rateLimit, clientIp } from "@/lib/rateLimit";

interface CheckoutBody {
  eventId: string;
  buyerWallet: string;
  quantity?: number;
  tierId?: string;
  discountCode?: string;
  /** Apply the buyer's Passly credit balance to this purchase (requires auth). */
  useCredit?: boolean;
}

/** Stripe's minimum card charge (€0.50). Never leave a smaller non-zero total. */
const STRIPE_MIN_CHARGE_CENTS = 50;

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
  // Each checkout claims capacity for 30 minutes and creates a Stripe session.
  // Without a limit a loop could reserve an event's whole capacity and lock out
  // real buyers (denial-of-sale). 10 attempts/minute/IP is far above any
  // legitimate purchase cadence.
  const rl = rateLimit(`checkout:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: CheckoutBody;

  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId, buyerWallet, quantity: rawQty, tierId, discountCode } = body;
  const quantity = Math.max(1, Math.min(4, Math.floor(rawQty ?? 1)));

  if (!eventId || !buyerWallet) {
    return NextResponse.json(
      { success: false, error: "eventId and buyerWallet are required" },
      { status: 400 }
    );
  }

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

  // Buyer-side service fee (€1 + 4% per ticket, src/lib/fees.ts) as its own
  // line item; the organizer nets 100% of the face price. The total is stored
  // in the session metadata so the webhook books fee_cents/net_cents from what
  // the buyer actually agreed to, not from a re-computation that could drift.
  const feePerTicket = serviceFeePerTicketCents(unitPrice);
  const lineItemName = tiers.length > 1 ? `${event.name}; ${tier.name}` : event.name;
  const lineItemDescription = discount
    ? `Ticket for ${event.date} · Code ${discount.code} (−${discount.percentOff} %)`
    : `Ticket for ${event.date}`;

  // Passly credit redemption (funded by prior resale proceeds). Held under a
  // hold-id before the session is created so a concurrent checkout of the same
  // wallet can't spend the same balance; redeemed by the completed webhook and
  // released by the expiry webhook. Requires proof of wallet ownership.
  const totalDueCents = unitPrice * quantity + feePerTicket * quantity;
  let creditHoldId: string | null = null;
  let creditAppliedCents = 0;
  if (body.useCredit && totalDueCents > 0) {
    if (!(await requestOwnsWallet(req, buyerWallet))) {
      await releaseClaim();
      return NextResponse.json(
        { success: false, error: "Bitte melde dich an, um dein Guthaben zu verwenden." },
        { status: 401 },
      );
    }
    const { data: cred } = await supabaseAdmin
      .from("user_credits").select("balance_cents").eq("wallet_address", buyerWallet).maybeSingle();
    const { data: holds } = await supabaseAdmin
      .from("credit_holds").select("amount_cents").eq("wallet_address", buyerWallet).eq("status", "active");
    const balance = (cred?.balance_cents as number | undefined) ?? 0;
    const held0 = ((holds ?? []) as { amount_cents: number }[]).reduce((s, h) => s + h.amount_cents, 0);
    const available = Math.max(0, balance - held0);

    let plan = Math.min(available, totalDueCents);
    const remaining = totalDueCents - plan;
    // Never leave a card charge below the Stripe minimum: either cover the whole
    // total, or leave at least €0.50 to charge.
    if (remaining > 0 && remaining < STRIPE_MIN_CHARGE_CENTS) {
      plan = available >= totalDueCents ? totalDueCents : totalDueCents - STRIPE_MIN_CHARGE_CENTS;
    }

    if (plan > 0) {
      const holdId = randomUUID();
      const { data: held } = await supabaseAdmin.rpc("reserve_credit", {
        p_session_id: holdId, p_wallet: buyerWallet, p_cents: plan,
      });
      const heldCents = Math.min(plan, (held as number | null) ?? 0);
      if (heldCents > 0) {
        const rem2 = totalDueCents - heldCents;
        if (rem2 > 0 && rem2 < STRIPE_MIN_CHARGE_CENTS) {
          // A concurrent hold left us a sub-minimum remainder; skip credit.
          await supabaseAdmin.rpc("release_credit", { p_session_id: holdId });
        } else {
          creditHoldId = holdId;
          creditAppliedCents = heldCents;
        }
      }
    }
  }

  const releaseCreditHold = async (): Promise<void> => {
    if (creditHoldId) await supabaseAdmin.rpc("release_credit", { p_session_id: creditHoldId });
  };

  // A one-time Stripe coupon carries the credit as an amount-off discount.
  let creditCouponId: string | null = null;
  if (creditAppliedCents > 0) {
    try {
      const coupon = await stripe.coupons.create({
        amount_off: creditAppliedCents,
        currency: "eur",
        duration: "once",
        max_redemptions: 1,
        name: "Passly-Guthaben",
      });
      creditCouponId = coupon.id;
    } catch (err) {
      await releaseCreditHold();
      await releaseClaim();
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: expiresAt,
      ...(creditCouponId ? { discounts: [{ coupon: creditCouponId }] } : {}),
      line_items: [
        {
          quantity,
          price_data: {
            currency: "eur",
            unit_amount: unitPrice,
            product_data: { name: lineItemName, description: lineItemDescription },
          },
        },
        ...(feePerTicket > 0
          ? [
              {
                quantity,
                price_data: {
                  currency: "eur" as const,
                  unit_amount: feePerTicket,
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
        serviceFeeCents: String(feePerTicket * quantity),
        ...(discount ? { discountCodeId: discount.id, discountPercent: String(discount.percentOff) } : {}),
        ...(creditHoldId ? { creditHoldId, creditAppliedCents: String(creditAppliedCents) } : {}),
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
      await releaseCreditHold();
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
    await releaseCreditHold();
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
