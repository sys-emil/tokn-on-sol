'use client';

import { useEffect, useState } from 'react';

/**
 * The Pro subscription price, read from Stripe via the public price route so
 * the marketing page can never quote a price Checkout doesn't charge.
 *
 * Stripe always wins when a price is configured. The fallback below only
 * covers the window before STRIPE_PRO_PRICE_ID exists (the route then answers
 * `available: false`); it is the price Emil decided on 2026-07-30, not a
 * guess. Create the Stripe Price at the same amount, or change this constant
 * with it.
 */

const FALLBACK_UNIT_AMOUNT = 2900; // 29,00 €
const FALLBACK_INTERVAL = 'month';

interface PriceInfo {
  available: boolean;
  unitAmount?: number | null;
  currency?: string;
  interval?: string | null;
}

const INTERVAL_DE: Record<string, string> = {
  day: 'Tag',
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
};

export function ProPrice() {
  const [price, setPrice] = useState<PriceInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/organizer/billing/price')
      .then((r) => r.json())
      .then((data: PriceInfo) => {
        if (!cancelled) setPrice(data);
      })
      .catch(() => {
        if (!cancelled) setPrice({ available: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!price) {
    return <span style={{ color: 'var(--ink-4)' }}>…</span>;
  }

  const unitAmount = typeof price.unitAmount === 'number' && price.available
    ? price.unitAmount
    : FALLBACK_UNIT_AMOUNT;
  const rawInterval = (price.available && price.interval) || FALLBACK_INTERVAL;

  const amount = (unitAmount / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const interval = INTERVAL_DE[rawInterval] ?? rawInterval;

  return (
    <span>
      <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em' }}>{amount} €</span>
      <span style={{ fontSize: 14, color: 'var(--ink-3)' }}> / {interval}</span>
    </span>
  );
}
