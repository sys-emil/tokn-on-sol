import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { mintTicket } from "@/lib/mint";
import { sendTicketConfirmation } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds — multi-ticket minting (each mint ~10-15s, up to 10 tickets)

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

  // Mint sequentially — Bubblegum appends one leaf at a time; parallel transactions
  // to the same tree conflict. Retry each mint up to 3 times and pause between
  // tickets to let the tree state propagate on the RPC.
  let minted = 0;
  const newAssetIds: string[] = [];
  for (let i = 0; i < toMint; i++) {
    const ticketNum = alreadyMinted + i + 1;

    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
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

        console.info(`Ticket ${ticketNum}/${quantity} minted → assetId=${assetId} sig=${signature}`);
        newAssetIds.push(assetId);
        minted++;
        success = true;
        break;
      } catch (err) {
        console.error(`Ticket ${ticketNum}/${quantity} attempt ${attempt + 1} failed:`, err);
      }
    }

    if (!success) {
      console.error(`Ticket ${ticketNum}/${quantity} failed after 3 attempts, skipping.`);
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

  // Send confirmation email if we have a buyer email and at least one new ticket
  const buyerEmail = session.customer_details?.email;
  if (buyerEmail && newAssetIds.length > 0) {
    void sendTicketConfirmation({
      to: buyerEmail,
      eventName: event.name,
      eventDate: event.date,
      assetIds: newAssetIds,
      baseUrl: siteUrl,
    }).catch((err) => console.error("Confirmation email failed:", err));
  }

  return NextResponse.json({ received: true });
}
