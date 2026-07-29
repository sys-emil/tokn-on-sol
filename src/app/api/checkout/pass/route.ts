import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import type { SeasonPass } from "@/lib/supabase";
import { serviceFeePerTicketCents } from "@/lib/fees";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { isBot, botDenied } from "@/lib/botCheck";

/**
 * Checkout for a season pass (one ticket, many dates).
 *
 * Kept apart from /api/checkout/create on purpose: that route is the hot
 * ticket path with tiers, discount codes, credit, the waiting room and guest
 * escrow woven together, and a pass shares none of it. What it does share is
 * the shape — reserve capacity atomically first, then create the Stripe
 * session, then persist the reservation under the session ID so the webhook
 * can convert or free it.
 *
 * v1 deliberately omits: guest checkout (the pass needs an account to reach
 * its dates), discount codes, Passly credit and the waiting room.
 */

interface PassCheckoutBody {
  passId: string;
  buyerWallet: string;
  quantity?: number;
}

/** Stripe's minimum checkout-session lifetime. */
const SESSION_MINUTES = 30;
/** What the buyer is promised; the shop countdown uses this, not the session. */
const HOLD_MINUTES = 5;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`checkout-pass:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  if (await isBot()) return botDenied();

  let body: PassCheckoutBody;
  try {
    body = (await req.json()) as PassCheckoutBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { passId, buyerWallet } = body;
  const quantity = Math.max(1, Math.min(4, Math.floor(body.quantity ?? 1)));
  if (!passId || !buyerWallet) {
    return NextResponse.json(
      { success: false, error: "passId and buyerWallet are required" },
      { status: 400 },
    );
  }

  const { data: passRow, error: passError } = await supabaseAdmin
    .from("season_passes")
    .select("*")
    .eq("id", passId)
    .maybeSingle();
  if (passError || !passRow) {
    return NextResponse.json({ success: false, error: "Pass not found" }, { status: 404 });
  }
  const pass = passRow as SeasonPass;

  if (!pass.active) {
    return NextResponse.json(
      { success: false, error: "Dieser Saisonpass wird nicht mehr verkauft." },
      { status: 410 },
    );
  }

  // A pass without dates admits to nothing; refuse rather than sell an empty
  // promise. Cancelled events don't count.
  const { data: links } = await supabaseAdmin
    .from("season_pass_events")
    .select("event_id, events(cancelled_at)")
    .eq("pass_id", passId);
  const liveDates = ((links ?? []) as { events: { cancelled_at: string | null } | { cancelled_at: string | null }[] | null }[])
    .filter((l) => {
      const ev = Array.isArray(l.events) ? l.events[0] : l.events;
      return ev && !ev.cancelled_at;
    }).length;
  if (liveDates === 0) {
    return NextResponse.json(
      { success: false, error: "Für diesen Pass sind derzeit keine Termine hinterlegt." },
      { status: 409 },
    );
  }

  // KYC gate, same rule as paid event tickets: no payouts onboarding, no sale.
  if (pass.price_eur > 0) {
    const { data: organizer } = await supabaseAdmin
      .from("organizers")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("wallet_address", pass.organizer_wallet)
      .maybeSingle();
    if (!organizer?.stripe_account_id || !organizer.stripe_charges_enabled) {
      return NextResponse.json(
        { success: false, error: "Der Verkauf ist noch nicht freigeschaltet." },
        { status: 503 },
      );
    }
  }

  // Claim capacity from the pass's own pot before creating the session.
  const { data: reserved, error: reserveError } = await supabaseAdmin.rpc("reserve_pass", {
    p_pass_id: passId,
    p_quantity: quantity,
  });
  if (reserveError) {
    return NextResponse.json({ success: false, error: reserveError.message }, { status: 500 });
  }
  if (!reserved) {
    const available = Math.max(0, pass.capacity - pass.tickets_sold - pass.tickets_reserved);
    return NextResponse.json(
      {
        success: false,
        error: available <= 0
          ? "Der Saisonpass ist ausverkauft."
          : `Nur noch ${available} Pass${available === 1 ? "" : "e"} verfügbar.`,
      },
      { status: 409 },
    );
  }

  const releaseClaim = async (): Promise<void> => {
    await supabaseAdmin.rpc("unreserve_pass", { p_pass_id: passId, p_quantity: quantity });
  };

  const host = req.headers.get("host") ?? "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60;

  const feePerPass = serviceFeePerTicketCents(pass.price_eur);

  try {
    // `payment_method_types` stays unset here too; see /api/checkout/create.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: expiresAt,
      line_items: [
        {
          quantity,
          price_data: {
            currency: "eur",
            unit_amount: pass.price_eur,
            product_data: {
              name: pass.name,
              description: `Saisonpass für ${liveDates} Termine`,
            },
          },
        },
        ...(feePerPass > 0
          ? [
              {
                quantity,
                price_data: {
                  currency: "eur" as const,
                  unit_amount: feePerPass,
                  product_data: { name: "Service fee", description: "Pro Pass" },
                },
              },
            ]
          : []),
      ],
      success_url: `${origin}/pass/${passId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pass/${passId}`,
      metadata: {
        purpose: "season_pass",
        passId,
        buyerWallet,
        quantity: String(quantity),
        serviceFeeCents: String(feePerPass * quantity),
      },
    });

    const { error: reservationError } = await supabaseAdmin.from("ticket_reservations").insert({
      stripe_session_id: session.id,
      season_pass_id: passId,
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

    return NextResponse.json({
      success: true,
      url: session.url,
      expiresAt: Date.now() + HOLD_MINUTES * 60_000,
    });
  } catch (err) {
    await releaseClaim();
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
