'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useEffect, useRef, useState } from 'react';

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
        setError(data.error ?? 'Could not create checkout session.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Network error. Please try again.');
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
      setError('Wallet not ready yet. Please wait a moment and try again.');
      return;
    }

    await startCheckout(walletAddress);
  }

  return (
    <>
      <style>{`
        .qty-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          gap: 12px;
        }
        .qty-label {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }
        .qty-controls {
          display: flex;
          align-items: center;
          gap: 0;
          border: 1px solid var(--color-border);
        }
        .qty-btn {
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          color: var(--color-text);
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s ease;
          flex-shrink: 0;
        }
        .qty-btn:hover:not(:disabled) { background: var(--color-border); }
        .qty-btn:disabled { color: var(--color-text-muted); cursor: default; }
        .qty-num {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text);
          min-width: 28px;
          text-align: center;
        }
        .qty-total {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-accent);
          letter-spacing: 0.02em;
        }
        .btn-buy {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 14px 24px;
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: oklch(0.10 0.014 258);
          background: var(--color-accent);
          border: none;
          cursor: pointer;
          transition: opacity 0.15s ease;
          box-sizing: border-box;
        }
        .btn-buy:hover:not(:disabled) { opacity: 0.88; }
        .btn-buy:disabled {
          background: var(--color-border);
          color: var(--color-text-muted);
          cursor: not-allowed;
        }
        .buy-error {
          margin-top: 12px;
          font-family: var(--font-body);
          font-size: 12px;
          color: oklch(0.62 0.18 28);
          line-height: 1.5;
        }
      `}</style>

      {!soldOut && (
        <div className="qty-row">
          <div className="qty-label">Quantity</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="qty-controls">
              <button
                className="qty-btn"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || loading}
              >
                −
              </button>
              <div className="qty-num">{quantity}</div>
              <button
                className="qty-btn"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty || loading}
              >
                +
              </button>
            </div>
            {quantity > 1 && (
              <div className="qty-total">{formatPrice(priceEur * quantity)}</div>
            )}
          </div>
        </div>
      )}

      <button
        className="btn-buy"
        disabled={soldOut || loading || !ready}
        onClick={() => void handleBuy()}
      >
        {soldOut ? 'Sold Out' : loading ? 'Redirecting...' : quantity > 1 ? `Buy ${quantity} Tickets` : 'Buy Ticket'}
      </button>

      {error && <div className="buy-error">{error}</div>}
    </>
  );
}
