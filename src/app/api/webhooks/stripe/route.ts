import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { mintTicket } from "@/lib/mint";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const siteUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

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
  const { eventId, buyerWallet } = session.metadata ?? {};

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

  let assetId: string;
  let signature: string;
  try {
    const result = await mintTicket({
      eventName: event.name,
      eventDate: event.date,
      ownerWallet: buyerWallet,
      baseUrl: siteUrl,
    });
    assetId = result.assetId;
    signature = result.signature;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Mint failed: ${message}` }, { status: 500 });
  }

  await supabaseAdmin.from("purchases").insert({
    event_id: eventId,
    buyer_wallet: buyerWallet,
    asset_id: assetId,
    signature,
    stripe_session_id: session.id,
  });

  await supabaseAdmin
    .from("events")
    .update({ tickets_sold: event.tickets_sold + 1 })
    .eq("id", eventId);

  return NextResponse.json({ received: true });
}
