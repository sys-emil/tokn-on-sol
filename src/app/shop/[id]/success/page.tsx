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
    max-width: 400px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
    animation: fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) { .success-card { animation: none; } }

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
    font-size: 22px;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--color-text);
    margin: 0;
  }

  .success-body {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--color-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

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

function SuccessInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') ?? '';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sessionId) { setFailed(true); return; }

    let attempt = 0;
    let stopped = false;

    async function poll() {
      while (attempt < 10 && !stopped) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        attempt++;
        try {
          const res = await fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`);
          const data = (await res.json()) as { found: boolean; assetId?: string };
          if (data.found && data.assetId) {
            router.replace(`/tickets/${data.assetId}`);
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

  if (failed) {
    return (
      <div className="success-card">
        <div className="success-eyebrow">Something went wrong</div>
        <h1 className="success-title">Ticket not found</h1>
        <p className="success-body">
          Your payment went through but we couldn't confirm your ticket yet.
          Please contact support with your session ID:<br />
          <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>{sessionId}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="success-card">
      <div className="spinner" />
      <div className="success-eyebrow">Payment confirmed</div>
      <h1 className="success-title">Confirming your ticket...</h1>
      <p className="success-body">Minting your NFT ticket on Solana. This takes a few seconds.</p>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <>
      <style>{CSS}</style>
      <div className={`success-root ${unbounded.variable} ${epilogue.variable}`}>
        <Suspense fallback={<div className="success-card"><div className="spinner" /></div>}>
          <SuccessInner />
        </Suspense>
        <div className="success-brand">Passly<span>.</span></div>
      </div>
    </>
  );
}
