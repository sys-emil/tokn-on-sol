import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import type { TicketTier } from "@/lib/supabase";
import { serviceFeePerTicketCents } from "@/lib/fees";

interface CheckoutBody {
  eventId: string;
  buyerWallet: string;
  quantity?: number;
  tierId?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CheckoutBody;

  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId, buyerWallet, quantity: rawQty, tierId } = body;
  const quantity = Math.max(1, Math.min(10, Math.floor(rawQty ?? 1)));

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
  // events). The tier is the price authority — the client only sends an ID,
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

  // Paid tickets require completed Connect onboarding — the KYC gate. Organizers
  // can create events without Stripe, but nobody can pay them until onboarding
  // is done. Free tiers pass through unconditionally.
  //
  // The charge itself is a plain platform charge (Separate Charges & Transfers,
  // NOT a destination charge) — see the rationale in src/lib/payouts.ts. The
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
        { success: false, error: "Ticket sales are not active yet — the organizer has not completed payout onboarding." },
        { status: 503 }
      );
    }
  }

  // Claim capacity atomically before creating the Stripe session — the SQL
  // function claims the tier first and the event-level total as the hard
  // overselling gate, so concurrent checkouts can never oversell either. The
  // reservation is converted to a sale by the webhook (checkout.session.completed)
  // or freed again when the session expires (checkout.session.expired, 30 min).
  const { data: reserved, error: reserveError } = await supabaseAdmin.rpc("reserve_tickets", {
    p_event_id: eventId,
    p_quantity: quantity,
    p_tier_id: tier.id,
  });
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
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60; // Stripe minimum session lifetime

  // Buyer-side service fee (€1 + 4% per ticket, src/lib/fees.ts) as its own
  // line item — the organizer nets 100% of the face price. The total is stored
  // in the session metadata so the webhook books fee_cents/net_cents from what
  // the buyer actually agreed to, not from a re-computation that could drift.
  const feePerTicket = serviceFeePerTicketCents(tier.price_eur);
  const lineItemName = tiers.length > 1 ? `${event.name} — ${tier.name}` : event.name;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: expiresAt,
      line_items: [
        {
          quantity,
          price_data: {
            currency: "eur",
            unit_amount: tier.price_eur,
            product_data: { name: lineItemName, description: `Ticket for ${event.date}` },
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
        // best effort — the session dies on its own after 30 minutes
      }
      return NextResponse.json({ success: false, error: reservationError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    await releaseClaim();
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
