import { NextRequest, NextResponse } from "next/server";
import { findValidDiscount } from "@/lib/discounts";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Public preview check for a discount code — the shop UI shows the reduced
 * total before redirecting. The checkout session re-validates with the same
 * logic; this endpoint is convenience, never authority.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`validate-code:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { valid: false, error: "Zu viele Versuche. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const quantity = Math.max(1, Math.min(4, parseInt(url.searchParams.get("quantity") ?? "1", 10) || 1));
  if (!eventId || !code) {
    return NextResponse.json({ valid: false, error: "eventId und code sind erforderlich" }, { status: 400 });
  }

  const result = await findValidDiscount(eventId, code, quantity);
  if (!result.ok) return NextResponse.json({ valid: false, error: result.error });
  return NextResponse.json({ valid: true, percentOff: result.discount.percentOff });
}
