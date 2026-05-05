import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { mintTicket } from "@/lib/mint";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const siteUrl = process.env.APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Webhook signature failed: ${message}` }, { status: 400 });
  }

  if (stripeEvent.type !== "checkout.session.completed") {
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
    .select("name, date, tickets_sold")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Return 200 to Stripe immediately — minting runs in the background.
  // This prevents webhook timeouts on slow Solana confirmations.
  after(async () => {
    try {
      const mintResults = await Promise.all(
        Array.from({ length: quantity }, () =>
          mintTicket({
            eventName: event.name,
            eventDate: event.date,
            ownerWallet: buyerWallet,
            baseUrl: siteUrl,
          }),
        ),
      );

      await supabaseAdmin.from("purchases").insert(
        mintResults.map(({ assetId, signature }) => ({
          event_id: eventId,
          buyer_wallet: buyerWallet,
          asset_id: assetId,
          signature,
          stripe_session_id: session.id,
        })),
      );

      await supabaseAdmin
        .from("events")
        .update({ tickets_sold: event.tickets_sold + quantity })
        .eq("id", eventId);
    } catch {
      // Stripe will retry the webhook if it doesn't receive a 200,
      // but we already returned 200. Failures here are silent —
      // the success page will time out and show the session ID for support.
    }
  });

  return NextResponse.json({ received: true });
}
