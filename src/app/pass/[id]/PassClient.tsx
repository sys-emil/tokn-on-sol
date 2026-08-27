'use client';

import { getAccessToken, useAuth, useWallets } from '@/lib/auth';

import { useState } from 'react';
import { serviceFeePerTicketCents } from '@/lib/fees';
import { useT } from '@/app/components/LangProvider';

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
  const t = useT();
  const { ready, authenticated, login } = useAuth();
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
      const token = await getAccessToken();
      const res = await fetch('/api/checkout/pass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ passId, quantity }),
      });
      const json = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (!json.success || !json.url) {
        setError(json.error ?? 'Der Kauf konnte nicht gestartet werden.');
        return;
      }
      window.location.href = json.url;
    } catch {
      setError(t('common.retry'));
    } finally {
      setLoading(false);
    }
  }

  if (soldOut) {
    return (
      <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
        {t('pass.soldOutText')}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>{t('buy.quantity')}</span>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <button
            className="btn ghost sm"
            aria-label="-"
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
            aria-label="+"
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
            <span style={{ color: 'var(--ink-3)' }}>{quantity} × {t('pass.eyebrow')}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(priceCents * quantity)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ink-3)' }}>{t('buy.serviceFee')}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(feePerPass * quantity)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontWeight: 600, fontSize: 15, marginTop: 2 }}>
            <span>{t('buy.total')}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(total)}</span>
          </div>
        </div>
      )}

      {!ready ? (
        <button className="btn primary lg" style={{ width: '100%', justifyContent: 'center' }} disabled>{t('common.loading')}</button>
      ) : !authenticated ? (
        <>
          <button className="btn primary lg" style={{ width: '100%', justifyContent: 'center' }} onClick={() => login()}>{t('pass.signInAndBuy')}</button>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.55 }}>
            {t('pass.accountNote')}
          </div>
        </>
      ) : !walletAddress ? (
        <button className="btn primary lg" style={{ width: '100%', justifyContent: 'center' }} disabled>{t('buy.preparingAccount')}</button>
      ) : (
        <button className="btn primary lg" style={{ width: '100%', justifyContent: 'center' }} onClick={() => void buy()} disabled={loading}>
          {loading ? t('buy.redirecting') : priceCents > 0 ? t('pass.buy', { total: eur(total) }) : t('pass.secure')}
        </button>
      )}

      {error && (
        <div style={{ fontSize: 12.5, color: 'var(--bad)', textAlign: 'center', lineHeight: 1.5 }}>{error}</div>
      )}
    </div>
  );
}
