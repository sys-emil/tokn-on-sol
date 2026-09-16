'use client';

import { useState } from 'react';
import { ProIntervalSwitch } from './ProIntervalSwitch';
import { useProPrices } from './useProPrices';
import { formatCents, yearlyPerMonthCents, type ProInterval } from '@/lib/proPricing';

/**
 * The Pro subscription price, read from Stripe via the public price route so
 * the marketing page can never quote a price Checkout doesn't charge (see
 * `useProPrices` for the fallback rule).
 *
 * Compact by default: the monthly amount, as on the landing page. With
 * `picker`, the Monatlich/Jährlich switch sits above it and the amount follows
 * the choice — that is the /preise variant. Monthly is preselected on
 * purpose: the yearly price is the reward, not the default, and whoever sees
 * 290 € before 29 € is gone.
 */
export function ProPrice({ picker = false }: { picker?: boolean }) {
  const prices = useProPrices();
  const [interval, setInterval] = useState<ProInterval>('month');

  if (!prices?.month) {
    return <span style={{ color: 'var(--ink-4)' }}>…</span>;
  }

  const month = prices.month;
  const year = picker ? prices.year : null;
  const yearly = interval === 'year' && year;
  const perMonth = yearly ? yearlyPerMonthCents(year.unitAmount) : month.unitAmount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: picker ? 14 : 0 }}>
      {picker && <ProIntervalSwitch prices={prices} value={interval} onChange={setInterval} />}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: picker ? 38 : 34, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {formatCents(perMonth, month.currency)}
        </span>
        <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>/ Monat</span>
      </div>
      {picker && (
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: -4 }}>
          {yearly
            ? `${formatCents(year.unitAmount, year.currency)} im Jahr, jährlich abgerechnet`
            : 'monatlich kündbar'}
        </div>
      )}
    </div>
  );
}
