'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useState } from 'react';
import { serviceFeePerTicketCents } from '@/lib/fees';

interface Props {
  passId: string;
  priceCents: number;
  available: number;
}

const MAX_QTY = 4;

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/**
 * Buy box for a season pass.
 *
 * Unlike an event ticket, a pass always needs an account: it has to survive
 * across many dates in the buyer's own wallet, so there is no guest-escrow
 * variant to fall back on. The login is therefore the first step, not an
 * afterthought.
 */
export default function PassClient({ passId, priceCents, available }: Props) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const walletAddress = solanaWallets[0]?.address;

  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const soldOut = available <= 0;
  const maxQty = Math.min(MAX_QTY, Math.max(1, available));
  const feePerPass = serviceFeePerTicketCents(priceCents);
  const total = (priceCents + feePerPass) * quantity;

  async function buy(): Promise<void> {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passId, buyerWallet: walletAddress, quantity }),
      });
      const json = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (!json.success || !json.url) {
        setError(json.error ?? 'Der Kauf konnte nicht gestartet werden.');
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  if (soldOut) {
    return (
      <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
        Der Saisonpass ist ausverkauft. Einzeltickets für die Termine gibt es
        weiterhin auf den jeweiligen Eventseiten.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>Anzahl</span>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <button
            className="btn ghost sm"
            aria-label="Weniger"
            disabled={quantity <= 1 || loading}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {quantity}
          </span>
          <button
            className="btn ghost sm"
            aria-label="Mehr"
            disabled={quantity >= maxQty || loading}
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
          >
            +
          </button>
        </div>
      </div>

      {priceCents > 0 && (
        <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ink-3)' }}>{quantity} × Pass</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(priceCents * quantity)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ink-3)' }}>Servicegebühr</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(feePerPass * quantity)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontWeight: 600, fontSize: 15, marginTop: 2 }}>
            <span>Gesamt</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(total)}</span>
          </div>
        </div>
      )}

      {!ready ? (
        <button className="btn" disabled>Lädt …</button>
      ) : !authenticated ? (
        <>
          <button className="btn" onClick={() => login()}>Anmelden und Pass kaufen</button>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.55 }}>
            Ein Saisonpass gehört zu deinem Konto, damit er über die ganze Reihe
            gültig bleibt.
          </div>
        </>
      ) : !walletAddress ? (
        <button className="btn" disabled>Konto wird vorbereitet …</button>
      ) : (
        <button className="btn" onClick={() => void buy()} disabled={loading}>
          {loading ? 'Weiterleitung …' : priceCents > 0 ? `Pass kaufen · ${eur(total)}` : 'Pass sichern'}
        </button>
      )}

      {error && (
        <div style={{ fontSize: 12.5, color: 'var(--bad)', textAlign: 'center', lineHeight: 1.5 }}>{error}</div>
      )}
    </div>
  );
}
