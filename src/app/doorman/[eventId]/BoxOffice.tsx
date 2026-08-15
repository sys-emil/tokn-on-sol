'use client';

import { useState } from 'react';
import { serviceFeePerTicketCents } from '@/lib/fees';
import type { SnapshotTier } from './offline';

interface Props {
  eventId: string;
  tiers: SnapshotTier[];
  authHeaders: () => Promise<Record<string, string>>;
  onSold: () => void;
}

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/**
 * Box office at the door: record a cash sale and, in the same step, let the
 * guest in.
 *
 * The money does not go through Passly — the cash stays with the organizer.
 * What this does is claim capacity (so the door can't oversell), mint the
 * ticket for the record, and optionally mark it as checked in right away,
 * because the guest is standing there and scanning a code you just handed them
 * would be theatre.
 *
 * The amount to collect is the **online total**: face price plus the same
 * service fee an online buyer pays. A cheaper door would slowly move the whole
 * sale to the evening. The fee share is subtracted from the organizer's next
 * online payout, which is why it's shown as its own line rather than folded
 * silently into the price.
 *
 * Needs connectivity: capacity and minting are server-side. Offline scanning
 * keeps working, only selling doesn't.
 */
export function BoxOffice({ eventId, tiers, authHeaders, onSold }: Props) {
  const [open, setOpen] = useState(false);
  const [tierId, setTierId] = useState(tiers[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [admitNow, setAdmitNow] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];
  const faceTotal = tier ? tier.priceCents * quantity : 0;
  const feeTotal = tier ? serviceFeePerTicketCents(tier.priceCents) * quantity : 0;
  const total = faceTotal + feeTotal;

  async function sell(): Promise<void> {
    if (!tier || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch('/api/organizer/box-office', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          eventId,
          tierId: tier.id,
          quantity,
          admitNow,
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { success: boolean; error?: string; admitted?: boolean };
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Verkauf fehlgeschlagen.');
        return;
      }
      setDone(
        data.admitted
          ? `${quantity}× verkauft und eingelassen · ${eur(total)} bar kassieren`
          : `${quantity}× verkauft · ${eur(total)} bar kassieren`,
      );
      setEmail('');
      setQuantity(1);
      onSold();
    } catch {
      setError('Keine Verbindung. Verkaufen geht nur online.');
    } finally {
      setBusy(false);
    }
  }

  if (tiers.length === 0) return null;

  return (
    <div className="bo">
      {!open ? (
        <button type="button" className="bo-toggle" onClick={() => setOpen(true)}>
          Abendkasse
        </button>
      ) : (
        <div className="bo-panel">
          <div className="bo-head">
            <span>Abendkasse · Barverkauf</span>
            <button type="button" className="bo-x" onClick={() => { setOpen(false); setDone(null); setError(null); }}>
              Schließen
            </button>
          </div>

          {tiers.length > 1 && (
            <select className="bo-select" value={tierId} onChange={(e) => setTierId(e.target.value)} disabled={busy}>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {eur(t.priceCents)}</option>
              ))}
            </select>
          )}

          <div className="bo-qty">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={busy || quantity <= 1}>−</button>
            <span>{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => Math.min(10, q + 1))} disabled={busy || quantity >= 10}>+</button>
          </div>

          {feeTotal > 0 && (
            <div className="bo-sum">
              <div className="bo-row">
                <span>{quantity}× Ticket</span>
                <span>{eur(faceTotal)}</span>
              </div>
              <div className="bo-row">
                <span>Servicegebühr (wie online)</span>
                <span>{eur(feeTotal)}</span>
              </div>
              <div className="bo-row bo-row-total">
                <span>Bar kassieren</span>
                <span>{eur(total)}</span>
              </div>
              <div className="bo-hint">
                Gleicher Preis wie im Onlineshop. Die Servicegebühr ziehen wir von
                der nächsten Auszahlung ab.
              </div>
            </div>
          )}

          <label className="bo-check">
            <input type="checkbox" checked={admitNow} onChange={(e) => setAdmitNow(e.target.checked)} disabled={busy} />
            Direkt einlassen
          </label>

          <input
            className="bo-input"
            type="email"
            inputMode="email"
            placeholder={admitNow ? 'E-Mail für Beleg (optional)' : 'E-Mail für das Ticket (nötig)'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          {!admitNow && !email.trim() && (
            <div className="bo-hint">
              Ohne Einlass geht das Ticket per E-Mail raus. Ohne Adresse hätte der Gast
              keinen Weg, es zu bekommen.
            </div>
          )}

          <button
            type="button"
            className="bo-sell"
            onClick={() => void sell()}
            disabled={busy || !tier || (!admitNow && !email.trim())}
          >
            {busy ? 'Wird gebucht …' : `${eur(total)} kassieren`}
          </button>

          {done && <div className="bo-done">{done}</div>}
          {error && <div className="bo-error">{error}</div>}
        </div>
      )}

      <style>{`
        /* The doorman page runs on the light surface (--surface-2), like the
           rest of the app. Everything here uses the shared tokens; an earlier
           version was styled for a dark background and rendered white on
           white: clickable but invisible. */
        .bo { padding: 12px 20px 0; }
        .bo-toggle {
          width: 100%; appearance: none; cursor: pointer;
          background: var(--surface); color: var(--ink);
          border: 1px solid var(--line); border-radius: 10px;
          padding: 12px 14px; font: inherit; font-size: 14px; font-weight: 550;
        }
        .bo-toggle:hover { border-color: var(--accent); color: var(--accent-ink); }
        .bo-panel {
          border: 1px solid var(--line); border-radius: 12px;
          padding: 14px; background: var(--surface);
          display: flex; flex-direction: column; gap: 10px;
        }
        .bo-head {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 12.5px; font-weight: 600; color: var(--ink);
        }
        .bo-x {
          appearance: none; background: none; border: none; cursor: pointer;
          font: inherit; font-size: 12px; color: var(--ink-3); text-decoration: underline;
        }
        .bo-x:hover { color: var(--ink); }
        .bo-select, .bo-input {
          width: 100%; box-sizing: border-box;
          background: var(--surface-2); color: var(--ink);
          border: 1px solid var(--line); border-radius: 9px;
          padding: 11px 12px; font: inherit; font-size: 15px;
        }
        .bo-select:focus, .bo-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
        .bo-qty { display: flex; align-items: center; justify-content: center; gap: 18px; }
        .bo-qty button {
          width: 44px; height: 44px; border-radius: 10px; cursor: pointer;
          background: var(--surface-2); color: var(--ink);
          border: 1px solid var(--line);
          font-size: 22px; line-height: 1;
        }
        .bo-qty button:disabled { opacity: 0.4; cursor: not-allowed; }
        .bo-qty span {
          font-size: 20px; font-weight: 650; min-width: 32px; text-align: center;
          font-variant-numeric: tabular-nums; color: var(--ink);
        }
        .bo-check {
          display: flex; align-items: center; gap: 9px;
          font-size: 13.5px; color: var(--ink-2); cursor: pointer;
        }
        .bo-check input { width: 20px; height: 20px; accent-color: var(--accent); }
        .bo-sell {
          width: 100%; appearance: none; cursor: pointer;
          background: var(--accent); color: #fff; border: none; border-radius: 10px;
          padding: 15px; font: inherit; font-size: 16px; font-weight: 650;
          font-variant-numeric: tabular-nums;
        }
        .bo-sell:disabled { opacity: 0.5; cursor: not-allowed; }
        .bo-hint { font-size: 11.5px; color: var(--ink-3); line-height: 1.5; margin-top: -4px; }
        .bo-sum {
          display: grid; gap: 6px;
          padding: 11px 12px; border-radius: 9px;
          background: var(--surface-2); border: 1px solid var(--line);
        }
        .bo-row {
          display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
          font-size: 13.5px; color: var(--ink-2); font-variant-numeric: tabular-nums;
        }
        .bo-row-total {
          font-size: 15px; font-weight: 650; color: var(--ink);
          border-top: 1px solid var(--line); padding-top: 6px; margin-top: 2px;
        }
        .bo-sum .bo-hint { margin-top: 2px; }
        .bo-done {
          font-size: 13px; line-height: 1.5; padding: 10px 12px; border-radius: 9px;
          background: var(--ok-wash); color: oklch(0.38 0.12 150);
        }
        .bo-error {
          font-size: 13px; line-height: 1.5; padding: 10px 12px; border-radius: 9px;
          background: var(--bad-wash); color: var(--bad);
        }
      `}</style>
    </div>
  );
}
