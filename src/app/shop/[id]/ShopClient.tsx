'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { serviceFeePerTicketCents } from '@/lib/fees';
import { track } from '@/lib/track';

export interface TierView {
  id: string;
  name: string;
  priceEur: number;
  available: number;
}

interface Props {
  eventId: string;
  tiers: TierView[];
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function ShopClient({ eventId, tiers }: Props) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [tierId, setTierId] = useState<string>(
    () => (tiers.find((t) => t.available > 0) ?? tiers[0])?.id ?? '',
  );
  const pendingCheckout = useRef(false);

  const walletAddress = solanaWallets[0]?.address;
  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];
  const soldOut = tiers.every((t) => t.available <= 0);
  const tierSoldOut = !tier || tier.available <= 0;
  const maxQty = tier ? Math.min(10, Math.max(1, tier.available)) : 1;
  const feePerTicket = tier ? serviceFeePerTicketCents(tier.priceEur) : 0;
  const feeTotal = feePerTicket * quantity;
  const grandTotal = tier ? (tier.priceEur + feePerTicket) * quantity : 0;

  function selectTier(id: string) {
    setTierId(id);
    setError(null);
    const next = tiers.find((t) => t.id === id);
    if (next) setQuantity((q) => Math.min(q, Math.min(10, Math.max(1, next.available))));
  }

  useEffect(() => {
    if (!pendingCheckout.current) return;
    if (!authenticated || !walletAddress) return;
    pendingCheckout.current = false;
    void startCheckout(walletAddress);
  }, [authenticated, walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startCheckout(wallet: string) {
    setLoading(true);
    setError(null);
    track('checkout_started', { eventId, quantity });
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, buyerWallet: wallet, quantity, tierId: tier?.id }),
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (!res.ok || !data.success || !data.url) {
        setError(data.error ?? 'Der Kauf konnte nicht gestartet werden. Bitte versuch es erneut.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy() {
    if (soldOut || tierSoldOut || loading) return;
    if (!ready) return;

    if (!authenticated) {
      pendingCheckout.current = true;
      login();
      return;
    }

    if (!walletAddress) {
      setError('Dein Konto wird noch eingerichtet. Warte einen Moment und versuch es dann erneut.');
      return;
    }

    await startCheckout(walletAddress);
  }

  return (
    <>
      <style>{`
        .tier-list {
          display: flex; flex-direction: column; gap: 8px;
          margin-bottom: 16px;
        }
        .tier-option {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 12px 14px;
          background: var(--surface);
          border: 1px solid var(--line-2); border-radius: 10px;
          box-shadow: var(--shadow-sm);
          text-align: left;
          transition: border-color 0.12s, box-shadow 0.12s;
          width: 100%;
        }
        .tier-option[aria-checked="true"] {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent), var(--shadow-sm);
        }
        .tier-option:disabled { opacity: 0.55; cursor: default; }
        .tier-option .t-name { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
        .tier-option .t-left { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
        .tier-option .t-price {
          font-size: 14px; font-weight: 600; white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        .qty-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-bottom: 14px;
        }
        .qty-label { font-size: 13px; font-weight: 500; color: var(--ink-2); }
        .qty-controls {
          display: inline-flex; align-items: center;
          background: var(--surface);
          border: 1px solid var(--line-2); border-radius: 8px;
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .qty-btn {
          width: 34px; height: 34px;
          display: grid; place-items: center;
          font-size: 16px; color: var(--ink-2);
          transition: background 0.12s;
        }
        .qty-btn:hover:not(:disabled) { background: var(--surface-2); }
        .qty-btn:disabled { color: var(--ink-4); cursor: default; }
        .qty-num {
          min-width: 34px; text-align: center;
          font-size: 14px; font-weight: 600;
          font-variant-numeric: tabular-nums;
          border-left: 1px solid var(--line); border-right: 1px solid var(--line);
          line-height: 34px;
        }
        .fee-summary {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 12px; margin-bottom: 14px;
        }
        .fee-summary .label { font-size: 12px; color: var(--ink-3); }
        .fee-summary .total {
          font-size: 17px; font-weight: 600; letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .buy-error {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--bad-wash);
          border: 1px solid oklch(0.86 0.10 25);
          font-size: 12.5px; color: var(--bad); line-height: 1.5;
        }
      `}</style>

      {!soldOut && tiers.length > 1 && (
        <div className="tier-list" role="radiogroup" aria-label="Ticketkategorie">
          {tiers.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === tier?.id}
              className="tier-option"
              disabled={t.available <= 0 || loading}
              onClick={() => selectTier(t.id)}
            >
              <span>
                <span className="t-name">{t.name}</span>
                <span className="t-left" style={{ display: 'block' }}>
                  {t.available <= 0
                    ? 'Ausverkauft'
                    : t.available <= 10
                    ? `Nur noch ${t.available}`
                    : 'Verfügbar'}
                </span>
              </span>
              <span className="t-price">{t.priceEur === 0 ? 'Kostenlos' : formatPrice(t.priceEur)}</span>
            </button>
          ))}
        </div>
      )}

      {!soldOut && !tierSoldOut && (
        <div className="qty-row">
          <div className="qty-label">Anzahl</div>
          <div className="qty-controls">
            <button
              className="qty-btn"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || loading}
              aria-label="Weniger Tickets"
            >
              −
            </button>
            <div className="qty-num">{quantity}</div>
            <button
              className="qty-btn"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty || loading}
              aria-label="Mehr Tickets"
            >
              +
            </button>
          </div>
        </div>
      )}

      {!soldOut && !tierSoldOut && tier && tier.priceEur > 0 && (
        <div className="fee-summary">
          <div className="label">Gesamt · inkl. {formatPrice(feeTotal)} Servicegebühr</div>
          <div className="total">{formatPrice(grandTotal)}</div>
        </div>
      )}

      <button
        className="btn primary lg"
        style={{ width: '100%', justifyContent: 'center' }}
        disabled={soldOut || tierSoldOut || loading || !ready}
        onClick={() => void handleBuy()}
      >
        {soldOut
          ? 'Ausverkauft'
          : tierSoldOut
          ? 'Kategorie ausverkauft'
          : loading
          ? 'Weiterleitung …'
          : quantity > 1
          ? `${quantity} Tickets kaufen`
          : 'Ticket kaufen'}
      </button>

      {error && <div className="buy-error">{error}</div>}

      {!soldOut && (
        <p
          style={{
            marginTop: 12,
            fontSize: 11.5,
            lineHeight: 1.55,
            color: 'var(--ink-3)',
          }}
        >
          Mit dem Kauf akzeptierst du die <Link href="/agb" style={{ color: 'var(--accent)', fontWeight: 500 }}>AGB</Link>.
          Der Vertrag kommt mit dem Veranstalter zustande. Für Tickets zu
          termingebundenen Veranstaltungen besteht kein Widerrufsrecht
          (§&nbsp;312g Abs.&nbsp;2 Nr.&nbsp;9 BGB) — jeder Kauf ist verbindlich.
          Hinweise zur Datenverarbeitung: <Link href="/datenschutz" style={{ color: 'var(--accent)', fontWeight: 500 }}>Datenschutzerklärung</Link>.
        </p>
      )}
    </>
  );
}
