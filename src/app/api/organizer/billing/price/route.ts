import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// Without this the handler (no request APIs used) would be prerendered at
// build time, freezing the Stripe price — or a build-time failure — forever.
// Freshness/caching is handled by the Cache-Control header instead.
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated: the Pro subscription's price, read straight from
 * Stripe so the upsell UI never drifts from what Checkout actually charges.
 * No wallet/organizer data involved — safe to expose and cache briefly.
 */
export async function GET(): Promise<NextResponse> {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ available: false });
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    return NextResponse.json(
      {
        available: true,
        unitAmount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (err) {
    console.error("Failed to load Pro price:", err instanceof Error ? err.message : err);
    return NextResponse.json({ available: false });
  }
}
