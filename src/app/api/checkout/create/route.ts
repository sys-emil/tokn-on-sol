import { NextRequest, NextResponse } from "next/server";
import { stripe, PLATFORM_FEE_BPS } from "@/lib/stripe";
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

  const available = event.capacity - event.tickets_sold;
  if (available <= 0) {
    return NextResponse.json({ success: false, error: "Event is sold out" }, { status: 409 });
  }
  if (quantity > available) {
    return NextResponse.json(
      { success: false, error: `Only ${available} ticket${available === 1 ? "" : "s"} remaining` },
      { status: 409 }
    );
  }

  // For paid events, require that the organizer has completed Stripe Connect onboarding.
  let stripeAccountId: string | null = null;
  if (event.price_eur > 0) {
    const { data: organizer } = await supabaseAdmin
      .from("organizers")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("wallet_address", event.organizer_wallet)
      .maybeSingle();

    if (!organizer?.stripe_account_id || !organizer.stripe_charges_enabled) {
      return NextResponse.json(
        { success: false, error: "Organizer has not completed Stripe Connect onboarding" },
        { status: 503 }
      );
    }
    stripeAccountId = organizer.stripe_account_id as string;
  }

  const host = req.headers.get("host") ?? "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
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
      ...(stripeAccountId
        ? {
            payment_intent_data: {
              application_fee_amount: Math.round(event.price_eur * quantity * PLATFORM_FEE_BPS / 10000),
              transfer_data: { destination: stripeAccountId },
            },
          }
        : {}),
      success_url: `${origin}/shop/${eventId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop/${eventId}`,
      metadata: { eventId, buyerWallet, quantity: String(quantity) },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
