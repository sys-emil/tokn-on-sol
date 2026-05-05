import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { mintTicket } from "@/lib/mint";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // seconds — allows multi-ticket minting on Pro plan

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

  // Idempotency: count tickets already minted for this session (Stripe may retry).
  const { data: existing } = await supabaseAdmin
    .from("purchases")
    .select("asset_id")
    .eq("stripe_session_id", session.id);
  const alreadyMinted = existing?.length ?? 0;
  const toMint = quantity - alreadyMinted;

  // Mint sequentially — Bubblegum appends leaves one at a time, parallel
  // transactions to the same tree conflict and one will fail.
  let minted = 0;
  for (let i = 0; i < toMint; i++) {
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

      minted++;
    } catch (err) {
      console.error(`Mint attempt ${alreadyMinted + i + 1} of ${quantity} failed:`, err);
      // Continue to next ticket — don't break; partial delivery is better than none.
    }
  }

  const totalNewlyMinted = alreadyMinted + minted;
  if (minted > 0) {
    await supabaseAdmin
      .from("events")
      .update({ tickets_sold: event.tickets_sold + minted })
      .eq("id", eventId);
  }

  // Log if we couldn't mint everything — helps diagnose partial failures.
  if (totalNewlyMinted < quantity) {
    console.error(`Partial mint: ${totalNewlyMinted}/${quantity} tickets for session ${session.id}`);
  }

  return NextResponse.json({ received: true });
}
