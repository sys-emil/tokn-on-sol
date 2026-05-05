'use client';

import { usePrivy, getAccessToken } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { Epilogue, Unbounded } from 'next/font/google';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '900'],
  display: 'swap',
});

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500'],
  display: 'swap',
});

interface ClaimPreview {
  found: boolean;
  assetId?: string;
  eventName?: string;
  eventDate?: string;
  claimed?: boolean;
  claimedAt?: string;
}

type Phase =
  | { tag: 'loading' }
  | { tag: 'not-found' }
  | { tag: 'already-claimed'; claimedAt: string }
  | { tag: 'ready'; preview: ClaimPreview }
  | { tag: 'claiming' }
  | { tag: 'success'; assetId: string }
  | { tag: 'error'; message: string };

function formatDate(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ClaimPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';

  const { ready, authenticated, login } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();

  const [phase, setPhase] = useState<Phase>({ tag: 'loading' });
  const pendingClaimRef = useRef(false);

  // Load preview on mount
  useEffect(() => {
    if (!token) return;
    fetch(`/api/claims/${token}`)
      .then((r) => r.json())
      .then((data: ClaimPreview) => {
        if (!data.found) { setPhase({ tag: 'not-found' }); return; }
        if (data.claimed) { setPhase({ tag: 'already-claimed', claimedAt: data.claimedAt ?? '' }); return; }
        setPhase({ tag: 'ready', preview: data });
      })
      .catch(() => setPhase({ tag: 'not-found' }));
  }, [token]);

  // Once authenticated and wallet ready, auto-proceed if user triggered login for claim
  useEffect(() => {
    if (!pendingClaimRef.current || !ready || !authenticated || !solanaWallets[0]?.address) return;
    pendingClaimRef.current = false;
    void executeClaim(solanaWallets[0].address);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, solanaWallets]);

  async function executeClaim(claimerWallet: string): Promise<void> {
    setPhase({ tag: 'claiming' });
    try {
      const authToken = await getAccessToken();
      const res = await fetch(`/api/claims/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ claimerWallet }),
      });
      const data = (await res.json()) as { success: boolean; assetId?: string; error?: string };
      if (data.success && data.assetId) {
        setPhase({ tag: 'success', assetId: data.assetId });
      } else if (data.error === 'Already claimed') {
        setPhase({ tag: 'already-claimed', claimedAt: new Date().toISOString() });
      } else {
        setPhase({ tag: 'error', message: data.error ?? 'Something went wrong.' });
      }
    } catch {
      setPhase({ tag: 'error', message: 'Network error. Please try again.' });
    }
  }

  function handleClaimClick(): void {
    if (!ready) return;
    if (!authenticated) {
      pendingClaimRef.current = true;
      login();
      return;
    }
    const wallet = solanaWallets[0]?.address;
    if (!wallet) {
      pendingClaimRef.current = true;
      return;
    }
    void executeClaim(wallet);
  }

  const preview = phase.tag === 'ready' ? phase.preview : null;

  return (
    <>
      <style>{`
        :root {
          --color-bg:         oklch(0.10 0.014 258);
          --color-surface:    oklch(0.14 0.014 258);
          --color-border:     oklch(0.22 0.016 258);
          --color-text:       oklch(0.96 0.008 95);
          --color-text-muted: oklch(0.48 0.012 250);
          --color-accent:     oklch(0.72 0.118 148);
        }

        html, body {
          margin: 0;
          padding: 0;
          background: var(--color-bg);
        }

        .page {
          font-family: var(--font-body);
          background-color: var(--color-bg);
          background-image: radial-gradient(circle, oklch(0.23 0.014 258 / 0.45) 1px, transparent 1px);
          background-size: 28px 28px;
          color: var(--color-text);
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          box-sizing: border-box;
        }

        .card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          padding: 40px 36px 32px;
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .eyebrow {
          font-family: var(--font-display);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-accent);
        }

        .title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: var(--color-text);
          margin: 0;
        }

        .event-name {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: var(--color-text);
          margin: 0;
        }

        .event-date {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
        }

        .divider {
          height: 1px;
          background: var(--color-border);
        }

        .body-text {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
          line-height: 1.6;
          margin: 0;
        }

        .btn {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 12px 24px;
          cursor: pointer;
          border: none;
          width: 100%;
          transition: background 0.16s ease;
        }

        .btn-primary {
          background: var(--color-accent);
          color: oklch(0.10 0.014 258);
        }

        .btn-primary:hover:not(:disabled) {
          background: oklch(0.80 0.118 148);
        }

        .btn-primary:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .btn-ghost {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .btn-ghost:hover {
          color: var(--color-text);
          border-color: oklch(0.40 0.016 258);
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid var(--color-border);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .success-icon {
          font-size: 40px;
          line-height: 1;
          text-align: center;
        }

        .logo {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          text-decoration: none;
          text-align: center;
        }

        .logo-dot { color: var(--color-accent); }
      `}</style>

      <div className={`page ${unbounded.variable} ${epilogue.variable}`}>
        <div className="card">

          {phase.tag === 'loading' && (
            <>
              <div className="eyebrow">Claim ticket</div>
              <div className="spinner" />
            </>
          )}

          {phase.tag === 'not-found' && (
            <>
              <div className="eyebrow">Claim ticket</div>
              <h1 className="title">Link not found</h1>
              <p className="body-text">This claim link is invalid or has expired.</p>
              <Link href="/" className="btn btn-ghost">Go home</Link>
            </>
          )}

          {phase.tag === 'already-claimed' && (
            <>
              <div className="eyebrow">Claim ticket</div>
              <h1 className="title">Already claimed</h1>
              <p className="body-text">
                This ticket was already claimed{phase.claimedAt ? ` at ${formatTime(phase.claimedAt)}` : ''}.
              </p>
              <Link href="/" className="btn btn-ghost">Go home</Link>
            </>
          )}

          {phase.tag === 'ready' && preview && (
            <>
              <div className="eyebrow">Claim ticket</div>
              <div className="divider" />
              <div>
                <div className="event-name">{preview.eventName}</div>
                <div className="event-date">{formatDate(preview.eventDate ?? '')}</div>
              </div>
              <div className="divider" />
              <p className="body-text">
                Claim this ticket to add it to your Passly wallet. Once claimed, it&apos;s yours — the original link becomes invalid.
              </p>
              <button className="btn btn-primary" onClick={handleClaimClick}>
                Claim this ticket
              </button>
            </>
          )}

          {phase.tag === 'claiming' && (
            <>
              <div className="eyebrow">Claim ticket</div>
              <div className="spinner" />
              <p className="body-text" style={{ textAlign: 'center' }}>Transferring ticket to your wallet…</p>
            </>
          )}

          {phase.tag === 'success' && (
            <>
              <div className="eyebrow">Claim ticket</div>
              <div className="success-icon">✓</div>
              <h1 className="title">Ticket claimed</h1>
              <p className="body-text">The ticket is now in your wallet and will appear on your tickets page.</p>
              <Link href="/my-tickets" className="btn btn-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>
                View my tickets
              </Link>
            </>
          )}

          {phase.tag === 'error' && (
            <>
              <div className="eyebrow">Claim ticket</div>
              <h1 className="title">Something went wrong</h1>
              <p className="body-text">{phase.message}</p>
              <button className="btn btn-ghost" onClick={() => setPhase({ tag: 'ready', preview: {} as ClaimPreview })}>
                Try again
              </button>
            </>
          )}

        </div>

        <Link href="/" className="logo" style={{ marginTop: 24 }}>
          Passly<span className="logo-dot">.</span>
        </Link>
      </div>
    </>
  );
}
