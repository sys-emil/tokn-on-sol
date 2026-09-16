import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import type { ProPriceInfo, ProPrices } from "@/lib/proPricing";

// Without this the handler (no request APIs used) would be prerendered at
// build time, freezing the Stripe price; or a build-time failure; forever.
// Freshness/caching is handled by the Cache-Control header instead.
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated: the Pro subscription's prices, read straight from
 * Stripe so the upsell UI never drifts from what Checkout actually charges.
 * No wallet/organizer data involved; safe to expose and cache briefly.
 *
 * Two Prices since 2026-09-15: STRIPE_PRO_PRICE_ID (monthly) and the optional
 * STRIPE_PRO_YEARLY_PRICE_ID. `prices.year` is null while the second one is
 * missing, and every consumer then shows only the monthly plan — no switch,
 * no promise. The top-level `unitAmount`/`interval` fields are the monthly
 * price in the shape the route has always had.
 */
export async function GET(): Promise<NextResponse> {
  const monthId = process.env.STRIPE_PRO_PRICE_ID;
  const yearId = process.env.STRIPE_PRO_YEARLY_PRICE_ID;
  if (!monthId) {
    return NextResponse.json({ available: false, prices: { month: null, year: null } satisfies ProPrices });
  }

  const [month, year] = await Promise.all([loadPrice(monthId), yearId ? loadPrice(yearId) : Promise.resolve(null)]);
  if (!month) {
    return NextResponse.json({ available: false, prices: { month: null, year } satisfies ProPrices });
  }

  return NextResponse.json(
    {
      available: true,
      unitAmount: month.unitAmount,
      currency: month.currency,
      interval: "month",
      prices: { month, year } satisfies ProPrices,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}

async function loadPrice(priceId: string): Promise<ProPriceInfo | null> {
  try {
    const price: Stripe.Price = await stripe.prices.retrieve(priceId);
    if (typeof price.unit_amount !== "number") return null;
    return { unitAmount: price.unit_amount, currency: price.currency };
  } catch (err) {
    console.error(`Failed to load Pro price ${priceId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
