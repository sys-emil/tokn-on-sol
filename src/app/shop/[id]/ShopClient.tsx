'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { serviceFeePerTicketCents } from '@/lib/fees';

interface Props {
  eventId: string;
  soldOut: boolean;
  priceEur: number;
  available: number;
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function ShopClient({ eventId, soldOut, priceEur, available }: Props) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const pendingCheckout = useRef(false);

  const walletAddress = solanaWallets[0]?.address;
  const maxQty = Math.min(10, available);
  const feePerTicket = serviceFeePerTicketCents(priceEur);
  const feeTotal = feePerTicket * quantity;
  const grandTotal = (priceEur + feePerTicket) * quantity;

  useEffect(() => {
    if (!pendingCheckout.current) return;
    if (!authenticated || !walletAddress) return;
    pendingCheckout.current = false;
    void startCheckout(walletAddress);
  }, [authenticated, walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startCheckout(wallet: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, buyerWallet: wallet, quantity }),
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
    if (soldOut || loading) return;
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

      {!soldOut && (
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

      {!soldOut && priceEur > 0 && (
        <div className="fee-summary">
          <div className="label">Gesamt · inkl. {formatPrice(feeTotal)} Servicegebühr</div>
          <div className="total">{formatPrice(grandTotal)}</div>
        </div>
      )}

      <button
        className="btn primary lg"
        style={{ width: '100%', justifyContent: 'center' }}
        disabled={soldOut || loading || !ready}
        onClick={() => void handleBuy()}
      >
        {soldOut
          ? 'Ausverkauft'
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
