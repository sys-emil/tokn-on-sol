import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { RESALE_HOLD_MINUTES } from "@/lib/resale";
import { rateLimit, clientIp } from "@/lib/rateLimit";

interface ResaleCheckoutBody {
  listingId: string;
  buyerWallet: string;
}

/** Stripe's minimum checkout-session lifetime. */
const SESSION_MINUTES = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`resale-checkout:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: ResaleCheckoutBody;
  try {
    body = (await req.json()) as ResaleCheckoutBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const { listingId, buyerWallet } = body;
  if (!listingId || !buyerWallet) {
    return NextResponse.json({ success: false, error: "listingId and buyerWallet are required" }, { status: 400 });
  }

  // Load the listing and its event; only an active listing is purchasable.
  const { data: listing } = await supabaseAdmin
    .from("resale_listings")
    .select("id, asset_id, event_id, seller_wallet, list_price_cents, fee_cents, net_cents, currency, status")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.status !== "active") {
    return NextResponse.json(
      { success: false, error: "Dieses Angebot ist nicht mehr verfügbar." },
      { status: 409 },
    );
  }

  // Own-purchase guard: a seller buying back their own listing would credit
  // themselves the net while paying the full price — block it.
  if (listing.seller_wallet === buyerWallet) {
    return NextResponse.json(
      { success: false, error: "Du kannst dein eigenes Angebot nicht kaufen." },
      { status: 400 },
    );
  }

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("name, date")
    .eq("id", listing.event_id)
    .maybeSingle();

  const host = req.headers.get("host") ?? "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: expiresAt,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (listing.currency as string) ?? "eur",
            unit_amount: listing.list_price_cents as number,
            product_data: {
              name: `${(event?.name as string) ?? "Ticket"} — Weiterverkauf`,
              description: `Ticket für ${(event?.date as string) ?? ""}`,
            },
          },
        },
      ],
      success_url: `${origin}/my-tickets?resale=bought`,
      cancel_url: `${origin}/shop/${listing.event_id}`,
      metadata: {
        purpose: "resale",
        listingId: listing.id as string,
        assetId: listing.asset_id as string,
        eventId: listing.event_id as string,
        buyerWallet,
        sellerWallet: listing.seller_wallet as string,
        feeCents: String(listing.fee_cents),
        netCents: String(listing.net_cents),
      },
    });

    // Reserve the listing under this session; if a concurrent buyer reserved it
    // first, abandon our session and report it as gone.
    const { data: reserved, error: reserveError } = await supabaseAdmin.rpc("reserve_resale_listing", {
      p_listing_id: listing.id,
      p_session_id: session.id,
      p_hold_minutes: RESALE_HOLD_MINUTES,
    });
    if (reserveError || !reserved) {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        // best effort — the session dies on its own after 30 minutes
      }
      return NextResponse.json(
        { success: false, error: "Dieses Angebot ist nicht mehr verfügbar." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
