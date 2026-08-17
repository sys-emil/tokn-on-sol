import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { releaseOfferBackToSeller } from "@/lib/resaleReturn";
import { requestOwnsWallet } from "@/lib/privyServer";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { isBot, botDenied } from "@/lib/botCheck";

export const dynamic = "force-dynamic";

interface WithdrawBody {
  offerId: string;
  sellerWallet: string;
}

/**
 * Take a ticket back off the market: the purchase becomes valid again and the
 * seat is re-claimed.
 *
 * The status transition is the gate. `active` → `withdrawn` is an atomic
 * conditional update, so a withdrawal that races the buyer who just took the
 * offer loses and the seller is told it already sold — rather than both sides
 * believing they got the ticket.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`resale-withdraw:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  if (await isBot()) return botDenied();

  let body: WithdrawBody;
  try {
    body = (await req.json()) as WithdrawBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const offerId = (body.offerId ?? "").trim();
  const sellerWallet = (body.sellerWallet ?? "").trim();
  if (!offerId || !sellerWallet) {
    return NextResponse.json(
      { success: false, error: "offerId and sellerWallet are required" },
      { status: 400 },
    );
  }

  if (!(await requestOwnsWallet(req, sellerWallet))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: offer } = await supabaseAdmin
    .from("resale_offers")
    .select("id, purchase_id, event_id, tier_id, seller_wallet, status")
    .eq("id", offerId)
    .maybeSingle();

  if (!offer || offer.seller_wallet !== sellerWallet) {
    return NextResponse.json({ success: false, error: "Angebot nicht gefunden." }, { status: 404 });
  }
  if (offer.status !== "active") {
    return NextResponse.json(
      {
        success: false,
        error: offer.status === "sold"
          ? "Dieses Ticket wurde bereits verkauft, die Erstattung ist unterwegs."
          : "Dieses Angebot ist nicht mehr offen.",
      },
      { status: 409 },
    );
  }

  // The status flip inside releaseOfferBackToSeller is the atomic claim; a
  // withdrawal that lost the race to a buyer returns false here.
  const won = await releaseOfferBackToSeller(
    {
      id: offer.id as string,
      purchase_id: offer.purchase_id as string,
      event_id: offer.event_id as string,
      tier_id: (offer.tier_id as string | null) ?? null,
    },
    "withdrawn",
  );

  if (!won) {
    return NextResponse.json(
      { success: false, error: "Dieses Ticket wurde gerade verkauft." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
