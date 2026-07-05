import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

interface CheckoutBody {
  eventId: string;
  buyerWallet: string;
  quantity?: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CheckoutBody;

  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId, buyerWallet, quantity: rawQty } = body;
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

  // Paid tickets require completed Connect onboarding — the KYC gate. Organizers
  // can create events without Stripe, but nobody can pay them until onboarding
  // is done. Free events pass through unconditionally.
  //
  // The charge itself is a plain platform charge (Separate Charges & Transfers,
  // NOT a destination charge) — see the rationale in src/lib/payouts.ts. The
  // webhook records a payouts row; a daily cron transfers the organizer's share
  // once the event's payout hold period has elapsed.
  if (event.price_eur > 0) {
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
  // function only increments tickets_reserved when sold + reserved + quantity
  // still fits, so concurrent checkouts can never oversell. The reservation is
  // converted to a sale by the webhook (checkout.session.completed) or freed
  // again when the session expires (checkout.session.expired, 30 min).
  const { data: reserved, error: reserveError } = await supabaseAdmin.rpc("reserve_tickets", {
    p_event_id: eventId,
    p_quantity: quantity,
  });
  if (reserveError) {
    return NextResponse.json({ success: false, error: reserveError.message }, { status: 500 });
  }
  if (!reserved) {
    const available = Math.max(0, event.capacity - event.tickets_sold - (event.tickets_reserved ?? 0));
    return NextResponse.json(
      {
        success: false,
        error: available <= 0
          ? "Event is sold out"
          : `Only ${available} ticket${available === 1 ? "" : "s"} remaining`,
      },
      { status: 409 }
    );
  }

  const releaseClaim = async (): Promise<void> => {
    await supabaseAdmin.rpc("unreserve_tickets", { p_event_id: eventId, p_quantity: quantity });
  };

  const host = req.headers.get("host") ?? "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60; // Stripe minimum session lifetime

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: expiresAt,
      line_items: [
        {
          quantity,
          price_data: {
            currency: "eur",
            unit_amount: event.price_eur,
            product_data: { name: event.name, description: `Ticket for ${event.date}` },
          },
        },
      ],
      success_url: `${origin}/shop/${eventId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop/${eventId}`,
      metadata: { eventId, buyerWallet, quantity: String(quantity) },
    });

    // Persist the reservation under the session ID so the webhook can convert
    // (completed) or free (expired) it idempotently. Without this row the claim
    // would leak, so a failed insert aborts the checkout.
    const { error: reservationError } = await supabaseAdmin.from("ticket_reservations").insert({
      stripe_session_id: session.id,
      event_id: eventId,
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
