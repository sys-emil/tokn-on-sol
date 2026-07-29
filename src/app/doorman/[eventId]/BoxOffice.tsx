'use client';

import { useState } from 'react';
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
  const total = tier ? tier.priceCents * quantity : 0;

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

          <label className="bo-check">
            <input type="checkbox" checked={admitNow} onChange={(e) => setAdmitNow(e.target.checked)} disabled={busy} />
            Direkt einlassen
          </label>

          <input
            className="bo-input"
            type="email"
            inputMode="email"
            placeholder="E-Mail für Beleg (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />

          <button type="button" className="bo-sell" onClick={() => void sell()} disabled={busy || !tier}>
            {busy ? 'Wird gebucht …' : `${eur(total)} kassieren`}
          </button>

          {done && <div className="bo-done">{done}</div>}
          {error && <div className="bo-error">{error}</div>}
        </div>
      )}

      <style>{`
        .bo { margin-top: 14px; }
        .bo-toggle {
          width: 100%; appearance: none; cursor: pointer;
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.82);
          border: 1px solid rgba(255,255,255,0.14); border-radius: 10px;
          padding: 11px 14px; font: inherit; font-size: 14px; font-weight: 500;
        }
        .bo-toggle:hover { background: rgba(255,255,255,0.1); }
        .bo-panel {
          border: 1px solid rgba(255,255,255,0.14); border-radius: 12px;
          padding: 14px; background: rgba(255,255,255,0.05);
          display: flex; flex-direction: column; gap: 10px;
        }
        .bo-head {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.85);
        }
        .bo-x {
          appearance: none; background: none; border: none; cursor: pointer;
          font: inherit; font-size: 12px; color: rgba(255,255,255,0.5); text-decoration: underline;
        }
        .bo-select, .bo-input {
          width: 100%; box-sizing: border-box;
          background: rgba(0,0,0,0.25); color: #fff;
          border: 1px solid rgba(255,255,255,0.16); border-radius: 9px;
          padding: 11px 12px; font: inherit; font-size: 15px;
        }
        .bo-qty { display: flex; align-items: center; justify-content: center; gap: 18px; }
        .bo-qty button {
          width: 44px; height: 44px; border-radius: 10px; cursor: pointer;
          background: rgba(255,255,255,0.08); color: #fff;
          border: 1px solid rgba(255,255,255,0.16);
          font-size: 22px; line-height: 1;
        }
        .bo-qty button:disabled { opacity: 0.35; cursor: not-allowed; }
        .bo-qty span { font-size: 20px; font-weight: 650; min-width: 32px; text-align: center; font-variant-numeric: tabular-nums; }
        .bo-check {
          display: flex; align-items: center; gap: 9px;
          font-size: 13.5px; color: rgba(255,255,255,0.8); cursor: pointer;
        }
        .bo-check input { width: 20px; height: 20px; accent-color: #7c5cff; }
        .bo-sell {
          width: 100%; appearance: none; cursor: pointer;
          background: #7c5cff; color: #fff; border: none; border-radius: 10px;
          padding: 15px; font: inherit; font-size: 16px; font-weight: 650;
          font-variant-numeric: tabular-nums;
        }
        .bo-sell:disabled { opacity: 0.5; cursor: not-allowed; }
        .bo-done { font-size: 13px; color: #8ce8b0; line-height: 1.5; }
        .bo-error { font-size: 13px; color: #ff9a9a; line-height: 1.5; }
      `}</style>
    </div>
  );
}
