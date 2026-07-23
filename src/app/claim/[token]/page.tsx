'use client';

import { usePrivy, getAccessToken } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';

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
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const PAGE_CSS = `
  .claim-page {
    min-height: 100vh;
    background: radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2);
    display: flex; flex-direction: column; align-items: center;
    padding: 32px 20px 56px;
  }
  .claim-card {
    width: 100%; max-width: 420px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: 26px 26px 24px;
    display: flex; flex-direction: column; gap: 16px;
    margin-top: 28px;
  }
  .claim-card h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
  .claim-event {
    border: 1px solid var(--accent-line);
    background: var(--accent-wash);
    border-radius: var(--radius);
    padding: 14px 16px;
  }
  .claim-event .name { font-size: 15.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--accent-ink); }
  .claim-event .date { font-size: 13px; color: var(--ink-3); margin-top: 3px; }
  .claim-text { font-size: 13.5px; color: var(--ink-3); line-height: 1.6; }
  .claim-spinner {
    width: 22px; height: 22px;
    border: 2px solid var(--line-2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 8px auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .claim-spinner { animation-duration: 1.6s; } }
  .claim-success-icon {
    width: 44px; height: 44px; border-radius: 50%;
    background: var(--ok); color: white;
    display: grid; place-items: center;
    margin: 4px auto 0;
  }
`;

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
        setPhase({ tag: 'error', message: data.error ?? 'Etwas ist schiefgelaufen.' });
      }
    } catch {
      setPhase({ tag: 'error', message: 'Netzwerkfehler. Bitte versuch es erneut.' });
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
      <style>{PAGE_CSS}</style>
      <div className="claim-page">
        <PasslyLogo height={24} />

        <div className="claim-card">
          <span className="chip accent" style={{ alignSelf: 'flex-start' }}>
            <span className="d" />Ticket übernehmen
          </span>

          {phase.tag === 'loading' && <div className="claim-spinner" />}

          {phase.tag === 'not-found' && (
            <>
              <h1>Link nicht gefunden</h1>
              <p className="claim-text">Dieser Link ist ungültig oder abgelaufen.</p>
              <Link href="/" className="btn ghost" style={{ justifyContent: 'center' }}>Zur Startseite</Link>
            </>
          )}

          {phase.tag === 'already-claimed' && (
            <>
              <h1>Schon übernommen</h1>
              <p className="claim-text">
                Dieses Ticket wurde bereits übernommen{phase.claimedAt ? ` (um ${formatTime(phase.claimedAt)} Uhr)` : ''}.
              </p>
              <Link href="/" className="btn ghost" style={{ justifyContent: 'center' }}>Zur Startseite</Link>
            </>
          )}

          {phase.tag === 'ready' && preview && (
            <>
              <h1>Ein Ticket für dich</h1>
              <div className="claim-event">
                <div className="name">{preview.eventName}</div>
                <div className="date">{formatDate(preview.eventDate ?? '')}</div>
              </div>
              <p className="claim-text">
                Übernimm dieses Ticket in dein Passly-Konto. Danach gehört es dir, der ursprüngliche Link wird ungültig.
              </p>
              <button className="btn primary lg" style={{ justifyContent: 'center' }} onClick={handleClaimClick}>
                Ticket übernehmen
              </button>
            </>
          )}

          {phase.tag === 'claiming' && (
            <>
              <div className="claim-spinner" />
              <p className="claim-text" style={{ textAlign: 'center' }}>Das Ticket wird auf dein Konto übertragen …</p>
            </>
          )}

          {phase.tag === 'success' && (
            <>
              <div className="claim-success-icon"><Icon name="check" size={20} strokeWidth={2.4} /></div>
              <h1 style={{ textAlign: 'center' }}>Das Ticket gehört jetzt dir</h1>
              <p className="claim-text" style={{ textAlign: 'center' }}>
                Du findest es ab sofort in deiner Ticketübersicht.
              </p>
              <Link href="/my-tickets" className="btn primary lg" style={{ justifyContent: 'center' }}>
                Zu meinen Tickets
              </Link>
            </>
          )}

          {phase.tag === 'error' && (
            <>
              <h1>Etwas ist schiefgelaufen</h1>
              <p className="claim-text">{phase.message}</p>
              <button className="btn ghost" style={{ justifyContent: 'center' }} onClick={handleClaimClick}>
                Erneut versuchen
              </button>
            </>
          )}
        </div>
        <LegalLinks style={{ marginTop: 22 }} />
      </div>
    </>
  );
}
