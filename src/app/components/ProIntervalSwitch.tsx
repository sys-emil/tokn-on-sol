'use client';

import type { ProInterval, ProPrices } from '@/lib/proPricing';
import { yearlySaving, yearlySavingLabel } from '@/lib/proPricing';

interface Props {
  prices: ProPrices;
  value: ProInterval;
  onChange: (interval: ProInterval) => void;
}

/**
 * Monatlich · Jährlich. The `.seg` control from globals.css, so it follows the
 * tokens of whatever card it sits in (the Pro card is dark). Renders nothing
 * at all while there is no yearly Price — then there is nothing to switch.
 * The saving next to it is computed from the two Stripe amounts.
 */
export function ProIntervalSwitch({ prices, value, onChange }: Props) {
  if (!prices.month || !prices.year) return null;
  const label = yearlySavingLabel(yearlySaving(prices.month.unitAmount, prices.year.unitAmount));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div className="seg" role="group" aria-label="Abrechnung">
        <button type="button" className={value === 'month' ? 'active' : ''} aria-pressed={value === 'month'} onClick={() => onChange('month')}>
          Monatlich
        </button>
        <button type="button" className={value === 'year' ? 'active' : ''} aria-pressed={value === 'year'} onClick={() => onChange('year')}>
          Jährlich
        </button>
      </div>
      {label && (
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-ink)', letterSpacing: '0.01em' }}>
          {label}
        </span>
      )}
    </div>
  );
}
