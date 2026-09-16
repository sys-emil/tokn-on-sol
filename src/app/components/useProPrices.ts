'use client';

import { useEffect, useState } from 'react';
import { FALLBACK_MONTHLY_CENTS, type ProPrices } from '@/lib/proPricing';

interface PriceResponse {
  available: boolean;
  prices?: Partial<ProPrices>;
}

/**
 * The Pro prices from Stripe, shared by /preise, the landing page and the two
 * upsells in the dashboard. Stripe always wins; the monthly fallback only
 * covers the window before STRIPE_PRO_PRICE_ID exists (the route then answers
 * `available: false`). There is deliberately no fallback for the yearly
 * price: without a Stripe Price the yearly plan does not exist, and a page
 * must not advertise it.
 *
 * `null` while loading.
 */
export function useProPrices(): ProPrices | null {
  const [prices, setPrices] = useState<ProPrices | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fallback: ProPrices = { month: { unitAmount: FALLBACK_MONTHLY_CENTS, currency: 'eur' }, year: null };
    fetch('/api/organizer/billing/price')
      .then((r) => r.json())
      .then((data: PriceResponse) => {
        if (cancelled) return;
        if (data.available && data.prices?.month) {
          setPrices({ month: data.prices.month, year: data.prices.year ?? null });
        } else {
          setPrices(fallback);
        }
      })
      .catch(() => {
        if (!cancelled) setPrices(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return prices;
}
