import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";
import { buildReceiptPdf, loadReceiptInput } from "@/lib/receipt";

export const dynamic = "force-dynamic";

/**
 * Purchase receipt ("Beleg") for one order, as a PDF.
 *
 * Two ways in, matching the two ways a buyer can hold a ticket:
 * - `assetId` — the caller must prove ownership of the buying wallet
 *   (`requestOwnsWallet`), since the receipt carries the buyer's e-mail.
 * - `orderToken` — a guest order; the token IS the credential, exactly as on
 *   /order/[token], and it was mailed to the buyer's own address.
 *
 * Free tickets and box-office cash sales have no `payouts` row and therefore
 * no receipt; see loadReceiptInput for why that is deliberate.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { assetId?: string; orderToken?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  let sessionId: string | null = null;

  if (body.orderToken) {
    const { data: order } = await supabaseAdmin
      .from("guest_orders")
      .select("stripe_session_id")
      .eq("token", body.orderToken)
      .maybeSingle();
    if (!order) {
      return NextResponse.json({ success: false, error: "Bestellung nicht gefunden." }, { status: 404 });
    }
    sessionId = order.stripe_session_id as string;
  } else if (body.assetId) {
    const { data: purchase } = await supabaseAdmin
      .from("purchases")
      .select("buyer_wallet, stripe_session_id")
      .eq("asset_id", body.assetId)
      .maybeSingle();
    if (!purchase?.stripe_session_id) {
      return NextResponse.json(
        { success: false, error: "Für diesen Kauf gibt es keinen Beleg." },
        { status: 404 },
      );
    }
    if (!(await requestOwnsWallet(req, purchase.buyer_wallet as string))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    sessionId = purchase.stripe_session_id as string;
  } else {
    return NextResponse.json(
      { success: false, error: "assetId oder orderToken erforderlich." },
      { status: 400 },
    );
  }

  const input = await loadReceiptInput(sessionId);
  if (!input) {
    return NextResponse.json(
      { success: false, error: "Für diesen Kauf gibt es keinen Beleg; er war kostenlos oder wurde an der Abendkasse bezahlt." },
      { status: 404 },
    );
  }

  const pdf = await buildReceiptPdf(input);
  return NextResponse.json({
    success: true,
    receiptNo: input.receiptNo,
    pdfBase64: Buffer.from(pdf).toString("base64"),
  });
}
