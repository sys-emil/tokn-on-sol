import { NextRequest, NextResponse } from "next/server";
import { requestUser } from "@/lib/sessionUser";
import { executeOrganizerRefund, quoteOrganizerRefund, RefundError, REFUND_REASON_TEXT } from "@/lib/organizerRefund";

export const dynamic = "force-dynamic";

interface RefundBody {
  assetId: string;
  /** Ohne `confirm` wird nur der Betrag berechnet; nichts wird veraendert. */
  confirm?: boolean;
}

/**
 * Einzelerstattung durch den Veranstalter, siehe `src/lib/organizerRefund.ts`.
 *
 * Der Veranstalter kommt aus der Sitzung; das Ticket muss zu einem seiner
 * Events gehoeren. `confirm: false` liefert den exakten Betrag fuer den
 * Bestaetigungsdialog — nur die `payouts`-Zeile weiss, was der Gast wirklich
 * bezahlt hat.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RefundBody;
  try {
    body = (await req.json()) as RefundBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const assetId = (body.assetId ?? "").trim();
  if (!assetId) return NextResponse.json({ success: false, error: "assetId is required" }, { status: 400 });

  const user = await requestUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const quoted = await quoteOrganizerRefund(assetId, user.walletAddress);
  if (!quoted.ok) {
    const status = quoted.reason === "not_owner" ? 403 : quoted.reason === "not_found" ? 404 : 409;
    return NextResponse.json({ success: false, error: REFUND_REASON_TEXT[quoted.reason], reason: quoted.reason }, { status });
  }
  const { quote } = quoted;

  if (!body.confirm) {
    return NextResponse.json({
      success: true,
      preview: true,
      refundCents: quote.refundCents,
      netShareCents: quote.netShareCents,
      fullRefund: quote.fullRefund,
      liveCount: quote.liveCount,
      currency: quote.currency,
    });
  }

  try {
    const outcome = await executeOrganizerRefund(quote);
    return NextResponse.json({ success: true, ...outcome, currency: quote.currency });
  } catch (err) {
    if (err instanceof RefundError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error("Organizer refund failed:", err);
    return NextResponse.json({ success: false, error: "Erstattung fehlgeschlagen." }, { status: 500 });
  }
}
