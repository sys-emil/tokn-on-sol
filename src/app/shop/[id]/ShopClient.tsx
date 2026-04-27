'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useEffect, useRef, useState } from 'react';

interface Props {
  eventId: string;
  soldOut: boolean;
}

export default function ShopClient({ eventId, soldOut }: Props) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingCheckout = useRef(false);

  const walletAddress = solanaWallets[0]?.address;

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
        body: JSON.stringify({ eventId, buyerWallet: wallet }),
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

      <button
        className="btn-buy"
        disabled={soldOut || loading || !ready}
        onClick={() => void handleBuy()}
      >
        {soldOut ? 'Sold Out' : loading ? 'Redirecting...' : 'Buy Ticket'}
      </button>

      {error && <div className="buy-error">{error}</div>}
    </>
  );
}
