'use client';

import { Epilogue, Unbounded } from 'next/font/google';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

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

const CSS = `
  :root {
    --color-bg:         oklch(0.10 0.014 258);
    --color-surface:    oklch(0.14 0.014 258);
    --color-border:     oklch(0.22 0.016 258);
    --color-text:       oklch(0.96 0.008 95);
    --color-text-muted: oklch(0.48 0.012 250);
    --color-accent:     oklch(0.72 0.118 148);
    --color-accent-bg:  oklch(0.18 0.04 148);
  }

  html, body { margin: 0; padding: 0; background: var(--color-bg); }

  .success-root {
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

  .success-card {
    width: 100%;
    max-width: 440px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: 36px 32px;
    display: flex;
    flex-direction: column;
    gap: 0;
    animation: fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) { .success-card { animation: none; } }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 28px;
  }

  .success-eyebrow {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .success-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--color-text);
    margin: 0;
  }

  .progress-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--color-text-muted);
    margin-top: 4px;
  }

  .progress-label strong {
    color: var(--color-text);
    font-weight: 500;
  }

  .ticket-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .ticket-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    transition: border-color 0.2s ease;
  }

  .ticket-row.is-minted {
    border-color: oklch(0.72 0.118 148 / 0.35);
    background: var(--color-accent-bg);
  }

  .ticket-num {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: var(--color-text-muted);
    min-width: 20px;
  }

  .ticket-status {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ticket-status-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .ticket-row.is-minted .ticket-status-label {
    color: var(--color-accent);
  }

  .ticket-asset-id {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .ticket-link {
    font-family: var(--font-display);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-accent);
    text-decoration: none;
    padding: 6px 10px;
    border: 1px solid oklch(0.72 0.118 148 / 0.4);
    white-space: nowrap;
    transition: background 0.12s ease;
  }

  .ticket-link:hover { background: oklch(0.72 0.118 148 / 0.12); }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .check-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--color-accent);
  }

  .redirect-notice {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: center;
    padding-top: 4px;
  }

  .btn-manual {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 13px 24px;
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: oklch(0.10 0.014 258);
    background: var(--color-accent);
    border: none;
    cursor: pointer;
    box-sizing: border-box;
    transition: opacity 0.15s ease;
    text-decoration: none;
  }

  .btn-manual:hover { opacity: 0.88; }

  .btn-secondary {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 13px 24px;
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: transparent;
    border: 1px solid var(--color-border);
    cursor: pointer;
    box-sizing: border-box;
    transition: color 0.15s ease, border-color 0.15s ease;
    text-decoration: none;
    margin-top: 8px;
  }

  .btn-secondary:hover {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }

  .error-box {
    padding: 14px 16px;
    border: 1px solid oklch(0.62 0.18 28 / 0.4);
    background: oklch(0.62 0.18 28 / 0.08);
    font-family: var(--font-body);
    font-size: 13px;
    color: oklch(0.72 0.14 28);
    line-height: 1.5;
    margin-bottom: 16px;
  }

  .error-session-id {
    display: block;
    font-size: 10px;
    word-break: break-all;
    margin-top: 8px;
    color: var(--color-text-muted);
  }

  .success-brand {
    margin-top: 28px;
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .success-brand span { color: var(--color-accent); }
`;

interface ConfirmData {
  found: boolean;
  assetIds?: string[];
  quantity?: number;
}

function TicketRow({ index, assetId }: { index: number; assetId: string | null }) {
  const minted = assetId !== null;
  return (
    <div className={`ticket-row${minted ? ' is-minted' : ''}`}>
      <div className="ticket-num">#{index + 1}</div>

      {minted ? (
        <svg className="check-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2.5,8.5 6.5,12.5 13.5,4.5" />
        </svg>
      ) : (
        <div className="spinner" />
      )}

      <div className="ticket-status">
        <div className="ticket-status-label">
          {minted ? 'Minted on Solana' : 'Minting…'}
        </div>
        {minted && assetId && (
          <div className="ticket-asset-id">{assetId.slice(0, 8)}…{assetId.slice(-6)}</div>
        )}
      </div>

      {minted && assetId && (
        <a className="ticket-link" href={`/tickets/${assetId}`}>
          View
        </a>
      )}
    </div>
  );
}

function SuccessInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') ?? '';

  const [failed, setFailed] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const MAX_ATTEMPTS = 35; // ~2 minutes of polling

  useEffect(() => {
    if (!sessionId) { setFailed(true); return; }

    let stopped = false;

    async function poll() {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (stopped) return;
        if (attempt > 0) {
          const delay = attempt < 6 ? 2000 : 3000;
          await new Promise((r) => setTimeout(r, delay));
        }
        if (stopped) return;

        try {
          const res = await fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`);
          const data = await res.json() as ConfirmData;
          const ids = data.assetIds ?? [];
          const qty = data.quantity ?? 1;

          setQuantity(qty);
          setAssetIds(ids);

          if (ids.length >= qty) {
            setAllDone(true);
            setRedirecting(true);
            await new Promise((r) => setTimeout(r, 2200));
            if (!stopped) router.replace('/my-tickets');
            return;
          }
        } catch {
          // network hiccup — keep trying
        }
      }

      if (!stopped) setFailed(true);
    }

    void poll();
    return () => { stopped = true; };
  }, [sessionId, router]);

  const mintedCount = assetIds.length;
  const slots: (string | null)[] = Array.from({ length: quantity }, (_, i) => assetIds[i] ?? null);

  if (failed) {
    return (
      <div className="success-card">
        <div className="card-header">
          <div className="success-eyebrow">Something went wrong</div>
          <h1 className="success-title">Ticket confirmation timed out</h1>
        </div>
        <div className="error-box">
          Your payment went through but we couldn&apos;t confirm all your tickets. They may still be
          minting — check your ticket collection in a few minutes.
          <code className="error-session-id">{sessionId}</code>
        </div>
        <a className="btn-manual" href="/my-tickets">Go to my tickets</a>
      </div>
    );
  }

  const title = allDone
    ? `${quantity === 1 ? 'Ticket' : `All ${quantity} tickets`} minted`
    : quantity === 1
    ? 'Minting your ticket…'
    : `Minting ${quantity} tickets…`;

  return (
    <div className="success-card">
      <div className="card-header">
        <div className="success-eyebrow">Payment confirmed</div>
        <h1 className="success-title">{title}</h1>
        {quantity > 1 && (
          <p className="progress-label">
            <strong>{mintedCount} of {quantity}</strong> tickets minted on Solana
          </p>
        )}
      </div>

      <div className="ticket-list">
        {slots.map((id, i) => (
          <TicketRow key={i} index={i} assetId={id} />
        ))}
      </div>

      {allDone ? (
        <div className="redirect-notice">
          {redirecting ? 'Redirecting to your tickets…' : ''}
        </div>
      ) : (
        <div className="redirect-notice">
          This can take up to a minute. Don&apos;t close this tab.
        </div>
      )}

      {!allDone && mintedCount > 0 && (
        <a className="btn-secondary" href="/my-tickets">
          View partial tickets
        </a>
      )}
    </div>
  );
}

export default function SuccessPage() {
  return (
    <>
      <style>{CSS}</style>
      <div className={`success-root ${unbounded.variable} ${epilogue.variable}`}>
        <Suspense fallback={
          <div className="success-card">
            <div className="card-header">
              <div className="success-eyebrow">Payment confirmed</div>
              <h1 className="success-title">Loading…</h1>
            </div>
          </div>
        }>
          <SuccessInner />
        </Suspense>
        <div className="success-brand">Passly<span>.</span></div>
      </div>
    </>
  );
}
