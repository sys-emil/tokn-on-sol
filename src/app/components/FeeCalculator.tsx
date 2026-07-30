'use client';

import { useState } from 'react';
import { serviceFeePerTicketCents } from '@/lib/fees';

/**
 * Interactive fee breakdown for the landing and pricing pages.
 *
 * Deliberately computed with the same `serviceFeePerTicketCents` the checkout
 * charges, so the marketing number can never drift from the real one. Shows
 * only Passly's own maths: no competitor figures, which we cannot verify and
 * which would be a UWG risk if they were ever out of date.
 */

const CALC_CSS = `
  .fee-calc { padding: 24px; display: grid; gap: 20px; }
  .fee-calc .calc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .fee-calc .calc-head .cap {
    font-size: 11px; font-weight: 600; color: var(--accent-ink);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .fee-calc .calc-head .price { font-size: 22px; font-weight: 600; letter-spacing: -0.03em; }
  .fee-calc input[type="range"] {
    width: 100%; accent-color: var(--accent);
    height: 4px; cursor: pointer;
  }
  .fee-calc .scale {
    display: flex; justify-content: space-between;
    font-size: 11.5px; color: var(--ink-4); margin-top: 6px;
  }
  .fee-rows { display: grid; gap: 2px; }
  .fee-row {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 11px 0;
    font-size: 14px; color: var(--ink-2);
    border-bottom: 1px solid var(--line);
  }
  .fee-row .val { font-variant-numeric: tabular-nums; font-weight: 500; color: var(--ink); }
  .fee-row .hint { font-size: 12px; color: var(--ink-4); font-weight: 400; }
  .fee-row.total {
    border-bottom: none;
    margin-top: 6px; padding-top: 14px;
    border-top: 1px solid var(--line-2);
    font-size: 15px; font-weight: 600; color: var(--ink);
  }
  .fee-row.total .val { font-size: 19px; color: var(--accent); letter-spacing: -0.02em; }
  .fee-note { font-size: 12.5px; color: var(--ink-3); line-height: 1.6; }
`;

const euro = (cents: number): string =>
  (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function FeeCalculator({ quantity = 100 }: { quantity?: number }) {
  const [priceEur, setPriceEur] = useState(20);

  const unitCents = Math.round(priceEur * 100);
  const feeCents = serviceFeePerTicketCents(unitCents);
  const guestPays = unitCents + feeCents;

  return (
    <>
      <style>{CALC_CSS}</style>
      <div className="card fee-calc">
        <div>
          <div className="calc-head">
            <span className="cap">Dein Ticketpreis</span>
            <span className="price">{euro(unitCents)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={150}
            step={1}
            value={priceEur}
            onChange={(e) => setPriceEur(Number(e.target.value))}
            aria-label="Ticketpreis in Euro"
            style={{ marginTop: 14 }}
          />
          <div className="scale">
            <span>kostenlos</span>
            <span>150 €</span>
          </div>
        </div>

        <div className="fee-rows">
          <div className="fee-row">
            <span>
              Servicegebühr <span className="hint">zahlt dein Gast</span>
            </span>
            <span className="val">{unitCents === 0 ? '—' : `+ ${euro(feeCents)}`}</span>
          </div>
          <div className="fee-row">
            <span>Dein Gast zahlt</span>
            <span className="val">{euro(guestPays)}</span>
          </div>
          <div className="fee-row total">
            <span>Du erhältst</span>
            <span className="val">{euro(unitCents)}</span>
          </div>
        </div>

        <div className="fee-note">
          {unitCents === 0 ? (
            <>Kostenlose Events sind komplett kostenlos, für dich und für deine Gäste.</>
          ) : (
            <>
              Bei {quantity} verkauften Tickets bleiben dir{' '}
              <strong style={{ color: 'var(--ink)' }}>{euro(unitCents * quantity)}</strong>. Kein
              Abzug, keine Grundgebühr, keine Einrichtungskosten.
            </>
          )}
        </div>
      </div>
    </>
  );
}
