'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';

const PAGE_CSS = `
  .success-page {
    min-height: 100vh;
    background: radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2);
    display: flex; flex-direction: column; align-items: center;
    padding: 32px 20px 56px;
  }
  .success-card {
    width: 100%; max-width: 440px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    margin-top: 28px;
  }
  .success-head { padding: 22px 24px 18px; border-bottom: 1px solid var(--line); }
  .success-head h1 { font-size: 19px; font-weight: 600; letter-spacing: -0.02em; margin-top: 10px; }
  .success-head .progress-label { font-size: 13px; color: var(--ink-3); margin-top: 6px; }
  .success-head .progress-label b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
  .success-body { padding: 20px 24px 24px; }
  .ticket-list { display: flex; flex-direction: column; gap: 8px; }
  .ticket-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-2);
    transition: border-color 0.2s, background 0.2s;
  }
  .ticket-row.is-minted { border-color: oklch(0.86 0.08 150); background: var(--ok-wash); }
  .ticket-num { font-size: 11.5px; font-weight: 600; color: var(--ink-3); min-width: 22px; font-variant-numeric: tabular-nums; }
  .ticket-status { flex: 1; min-width: 0; }
  .ticket-status .label { font-size: 13px; color: var(--ink-3); }
  .ticket-row.is-minted .ticket-status .label { color: oklch(0.38 0.12 150); font-weight: 500; }
  .ticket-status .asset {
    font-family: var(--mono); font-size: 10.5px; color: var(--ink-4);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .check-dot {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    background: var(--ok); color: white;
    display: grid; place-items: center;
  }
  .spinner {
    width: 18px; height: 18px; flex-shrink: 0;
    border: 2px solid var(--line-2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 1.6s; } }
  .notice { font-size: 12.5px; color: var(--ink-3); text-align: center; margin-top: 16px; line-height: 1.5; }
  .error-box {
    padding: 14px 16px;
    border-radius: var(--radius);
    border: 1px solid oklch(0.86 0.10 25);
    background: var(--bad-wash);
    font-size: 13px; color: var(--bad); line-height: 1.55;
  }
  .error-box code {
    display: block; font-family: var(--mono); font-size: 10.5px;
    word-break: break-all; margin-top: 8px; color: var(--ink-3);
  }
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
        <div className="check-dot"><Icon name="check" size={12} strokeWidth={2.4} /></div>
      ) : (
        <div className="spinner" />
      )}
      <div className="ticket-status">
        <div className="label">{minted ? 'Bestätigt' : 'Wird vorbereitet …'}</div>
        {minted && assetId && (
          <div className="asset">{assetId.slice(0, 8)}…{assetId.slice(-6)}</div>
        )}
      </div>
      {minted && assetId && (
        <Link href={`/tickets/${assetId}`} className="btn ghost sm">Ansehen</Link>
      )}
    </div>
  );
}

function SuccessInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') ?? '';

  const [failed, setFailed] = useState(!sessionId);
  const [quantity, setQuantity] = useState<number>(1);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const MAX_ATTEMPTS = 35; // ~2 minutes of polling

  useEffect(() => {
    if (!sessionId) return;

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
        <div className="success-head">
          <span className="chip warn"><span className="d" />Dauert länger als gedacht</span>
          <h1>Bestätigung steht noch aus</h1>
        </div>
        <div className="success-body">
          <div className="error-box">
            Deine Zahlung ist eingegangen, aber wir konnten noch nicht alle Tickets bestätigen.
            Sie werden im Hintergrund fertiggestellt — schau in ein paar Minuten in deiner Ticketübersicht nach.
            <code>{sessionId}</code>
          </div>
          <Link href="/my-tickets" className="btn primary lg" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
            Zu meinen Tickets
          </Link>
        </div>
      </div>
    );
  }

  const title = allDone
    ? quantity === 1 ? 'Dein Ticket ist da' : `Alle ${quantity} Tickets sind da`
    : quantity === 1
    ? 'Dein Ticket wird vorbereitet …'
    : 'Deine Tickets werden vorbereitet …';

  return (
    <div className="success-card">
      <div className="success-head">
        <span className={`chip ${allDone ? 'ok' : 'accent'}`}><span className="d" />Zahlung bestätigt</span>
        <h1>{title}</h1>
        {quantity > 1 && (
          <div className="progress-label"><b>{mintedCount} von {quantity}</b> Tickets bestätigt</div>
        )}
      </div>

      <div className="success-body">
        <div className="ticket-list">
          {slots.map((id, i) => (
            <TicketRow key={i} index={i} assetId={id} />
          ))}
        </div>

        {allDone ? (
          <div className="notice">{redirecting ? 'Du wirst zu deinen Tickets weitergeleitet …' : ''}</div>
        ) : (
          <div className="notice">Das kann bis zu einer Minute dauern. Lass den Tab am besten offen.</div>
        )}

        {!allDone && mintedCount > 0 && (
          <Link href="/my-tickets" className="btn ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
            Fertige Tickets ansehen
          </Link>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="success-page">
        <PasslyLogo height={24} />
        <Suspense fallback={
          <div className="success-card">
            <div className="success-head">
              <span className="chip accent"><span className="d" />Zahlung bestätigt</span>
              <h1>Lädt …</h1>
            </div>
          </div>
        }>
          <SuccessInner />
        </Suspense>
        <LegalLinks style={{ marginTop: 22 }} />
      </div>
    </>
  );
}
