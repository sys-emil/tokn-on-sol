import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkOfferEligibility } from "@/lib/resaleReturn";
import { requestUser } from "@/lib/sessionUser";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { isBot, botDenied } from "@/lib/botCheck";

export const dynamic = "force-dynamic";

interface OfferBody {
  assetId: string;
  /** Without this the route only prices the return; nothing is changed. */
  confirm?: boolean;
}

/**
 * Offer a ticket back ("Rückgabe & Neuverkauf", see src/lib/resaleReturn.ts).
 *
 * Nothing moves on-chain. The purchase is revoked so the seller cannot use the
 * ticket while it is on offer, and the seat is released so somebody else can buy
 * it through the ordinary checkout. The refund follows once the seat actually
 * sells — the seller carries no risk of losing the ticket for nothing, because
 * an unsold offer is handed back by the payout cron.
 *
 * `confirm: false` (the default) is a pure price preview: the UI needs to show
 * the exact refund before the seller commits, and only the payouts row can say
 * what they really paid.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`resale-offer:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  if (await isBot()) return botDenied();

  let body: OfferBody;
  try {
    body = (await req.json()) as OfferBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const assetId = (body.assetId ?? "").trim();
  if (!assetId) {
    return NextResponse.json(
      { success: false, error: "assetId is required" },
      { status: 400 },
    );
  }

  // Adresse aus der Sitzung statt aus dem Request: sie wird aus der Nutzer-ID
  // abgeleitet und laesst sich nicht mehr behaupten.
  const user = await requestUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const sellerWallet = user.walletAddress;

  const eligibility = await checkOfferEligibility(assetId, sellerWallet);
  if (!eligibility.ok) {
    return NextResponse.json(
      { success: false, error: eligibility.error },
      { status: eligibility.status },
    );
  }
  const data = eligibility.data;

  // Preview only: tell the seller what they would get, change nothing.
  if (body.confirm !== true) {
    return NextResponse.json({
      success: true,
      preview: true,
      eventName: data.eventName,
      eventDate: data.eventDate,
      currency: data.currency,
      ...data.breakdown,
      // The seller printed an offline ticket; that sheet dies with the return
      // and they have to be told before they commit, not after.
      backupIssued: data.backupIssued,
    });
  }

  // Claim the ticket for this offer. The partial unique index on
  // (asset_id) WHERE status = 'active' is the real gate against a double offer;
  // a 23505 here means a concurrent request won.
  const { data: offer, error: insertError } = await supabaseAdmin
    .from("resale_offers")
    .insert({
      purchase_id: data.purchaseId,
      asset_id: assetId,
      event_id: data.eventId,
      tier_id: data.tierId,
      seller_wallet: sellerWallet,
      origin_session_id: data.originSessionId,
      origin_charge_id: data.originChargeId,
      origin_payment_intent_id: data.originPaymentIntentId,
      paid_cents: data.breakdown.paidCents,
      return_fee_cents: data.breakdown.returnFeeCents,
      refund_cents: data.breakdown.refundCents,
      currency: data.currency,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { success: false, error: "Dieses Ticket ist bereits zur Rückgabe angeboten." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  const now = new Date().toISOString();

  // Revoke the ticket: while it is on offer the seller must not be able to walk
  // in with it. Scoped to a still-valid row so a concurrent redemption at the
  // door wins instead of being overwritten.
  const { data: revoked } = await supabaseAdmin
    .from("purchases")
    .update({ revoked_at: now })
    .eq("id", data.purchaseId)
    .is("revoked_at", null)
    .is("redeemed_at", null)
    .select("id");

  if (!revoked || revoked.length === 0) {
    // Someone got admitted (or the ticket was revoked) between the eligibility
    // check and here. Roll the offer back rather than leave a claim on a ticket
    // that is already spent.
    await supabaseAdmin.from("resale_offers").delete().eq("id", offer?.id as string);
    return NextResponse.json(
      { success: false, error: "Dieses Ticket ist inzwischen nicht mehr gültig." },
      { status: 409 },
    );
  }

  // Free the seat so the ordinary checkout can sell it again.
  const { error: seatError } = await supabaseAdmin.rpc("release_sold_seats", {
    p_event_id: data.eventId,
    p_quantity: 1,
    p_tier_id: data.tierId,
  });
  if (seatError) {
    // Undo both previous steps; a claimed offer whose seat was never released
    // would quietly shrink the event's capacity.
    await supabaseAdmin.from("purchases").update({ revoked_at: null }).eq("id", data.purchaseId);
    await supabaseAdmin.from("resale_offers").delete().eq("id", offer?.id as string);
    return NextResponse.json({ success: false, error: seatError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    offerId: offer?.id ?? null,
    currency: data.currency,
    ...data.breakdown,
  });
}
