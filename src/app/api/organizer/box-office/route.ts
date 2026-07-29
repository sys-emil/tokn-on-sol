import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestMayWorkTheDoor } from "@/lib/doorAccess";
import { getOperatorWalletAddress } from "@/lib/transfer";
import { processMintJobs } from "@/lib/mintJobs";
import { ensureGuestOrder } from "@/lib/guestOrders";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // after() mints the ticket once the response is out

/**
 * Box office: recording a sale at the door, paid in cash.
 *
 * Capacity goes through the same `reserve_tickets` / `finalize_ticket_sale`
 * pair as an online purchase, using a synthetic `box_<uuid>` session id. That
 * deliberately reuses the atomic counting rather than adding a second path that
 * could oversell.
 *
 * **No money moves through Passly here.** The cash stays with the organizer, so
 * there is no Stripe session, no `payouts` row and no service fee. These sales
 * are marked `source = 'box_office'` so revenue reporting can tell them apart
 * from card sales.
 *
 * Gated by `requestMayWorkTheDoor`, so staff holding a door link can sell
 * without the organizer's login — the same people who already scan tickets.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    eventId?: string;
    tierId?: string;
    quantity?: number;
    admitNow?: boolean;
    email?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const eventId = (body.eventId ?? "").trim();
  const quantity = Math.max(1, Math.min(10, Math.floor(body.quantity ?? 1)));
  const email = (body.email ?? "").trim().toLowerCase() || null;
  const admitNow = body.admitNow === true;
  if (!eventId) {
    return NextResponse.json({ success: false, error: "eventId is required" }, { status: 400 });
  }

  // A sale that neither admits the guest nor has a delivery address would
  // leave them with nothing: the ticket sits in escrow and no link to it
  // exists. Refuse rather than take the money.
  if (!admitNow && !email) {
    return NextResponse.json(
      {
        success: false,
        error: "Ohne Einlass brauchen wir eine E-Mail-Adresse, sonst bekommt der Gast sein Ticket nicht.",
      },
      { status: 400 },
    );
  }

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, organizer_wallet, name, date, cancelled_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
  }
  if (event.cancelled_at) {
    return NextResponse.json({ success: false, error: "Das Event wurde abgesagt." }, { status: 410 });
  }

  if (!(await requestMayWorkTheDoor(req, eventId, event.organizer_wallet as string))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Tier: explicit, or the only one the event has.
  const { data: tiers } = await supabaseAdmin
    .from("ticket_tiers")
    .select("id, name, price_eur")
    .eq("event_id", eventId)
    .order("sort")
    .order("created_at");
  const tierList = (tiers ?? []) as { id: string; name: string; price_eur: number }[];
  const tier = body.tierId
    ? tierList.find((t) => t.id === body.tierId)
    : tierList.length === 1
    ? tierList[0]
    : undefined;
  if (!tier) {
    return NextResponse.json(
      { success: false, error: body.tierId ? "Unknown ticket tier" : "tierId is required" },
      { status: 400 },
    );
  }

  // Same capacity gate as online: the SQL function is the overselling authority.
  const sessionId = `box_${randomUUID()}`;
  const { data: reserved, error: reserveError } = await supabaseAdmin.rpc("reserve_tickets", {
    p_event_id: eventId,
    p_quantity: quantity,
    p_tier_id: tier.id,
  });
  if (reserveError) {
    return NextResponse.json({ success: false, error: reserveError.message }, { status: 500 });
  }
  if (!reserved) {
    return NextResponse.json(
      { success: false, error: "Nicht genug Tickets übrig." },
      { status: 409 },
    );
  }

  const { error: finalizeError } = await supabaseAdmin.rpc("finalize_ticket_sale", {
    p_session_id: sessionId,
    p_event_id: eventId,
    p_quantity: quantity,
    p_tier_id: tier.id,
  });
  if (finalizeError) {
    // Give the seats back rather than leave them stuck in "reserved".
    await supabaseAdmin.rpc("unreserve_tickets", {
      p_event_id: eventId,
      p_quantity: quantity,
      p_tier_id: tier.id,
    });
    return NextResponse.json({ success: false, error: finalizeError.message }, { status: 500 });
  }

  // Minted to operator escrow like a guest purchase, regardless of whether an
  // e-mail was given: the ticket has to exist for the count and the record.
  // The e-mail only decides whether the buyer is told about it.
  const { error: jobError } = await supabaseAdmin.from("mint_jobs").insert({
    stripe_session_id: sessionId,
    event_id: eventId,
    tier_id: tier.id,
    buyer_wallet: getOperatorWalletAddress(),
    buyer_email: email,
    quantity,
    source: "box_office",
    admit_immediately: admitNow,
  });
  if (jobError) {
    return NextResponse.json({ success: false, error: jobError.message }, { status: 500 });
  }

  // Always recorded, even for a walk-up who was let straight in: the token is
  // the only handle anyone has on an escrowed ticket, and without it a later
  // support request ("I did buy at the door") is unanswerable.
  let orderToken: string | null = null;
  try {
    const order = await ensureGuestOrder({ stripeSessionId: sessionId, eventId, email });
    orderToken = order?.token ?? null;
  } catch (err) {
    // The sale itself is already booked; a missing order link is recoverable
    // by hand and must not fail the door.
    console.error("Box office guest order failed:", err);
  }

  after(async () => {
    try {
      await processMintJobs(3);
    } catch (err) {
      console.error("Box office mint kick failed:", err);
    }
  });

  return NextResponse.json({
    success: true,
    sessionId,
    quantity,
    tierName: tier.name,
    priceCents: tier.price_eur,
    totalCents: tier.price_eur * quantity,
    admitted: admitNow,
    orderToken,
  });
}
