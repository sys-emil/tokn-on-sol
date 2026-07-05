'use client';

import { Epilogue, Unbounded } from 'next/font/google';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { useState } from 'react';

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

interface PayoutRow {
  id: string;
  stripe_session_id: string;
  organizer_wallet: string;
  stripe_account_id: string | null;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  available_at: string;
  status: 'pending' | 'paid' | 'held' | 'disputed' | 'failed' | 'refunded';
  transfer_id: string | null;
  dispute_id: string | null;
  failure_reason: string | null;
  created_at: string;
  events: { name: string; date: string } | null;
}

const STATUS_ORDER: Record<PayoutRow['status'], number> = {
  disputed: 0,
  held: 1,
  failed: 2,
  pending: 3,
  refunded: 4,
  paid: 5,
};

export default function AdminPayouts() {
  const [secret, setSecret] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(currentSecret: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/payouts', {
        headers: { 'x-admin-secret': currentSecret },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setError('Wrong admin secret.');
        setUnlocked(false);
        return;
      }
      const data = (await res.json()) as { payouts?: PayoutRow[]; error?: string };
      if (!res.ok || !data.payouts) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const sorted = [...data.payouts].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.created_at.localeCompare(a.created_at),
      );
      setPayouts(sorted);
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts.');
    } finally {
      setLoading(false);
    }
  }

  async function act(payoutId: string, action: 'retry' | 'release' | 'cancel'): Promise<void> {
    setBusyId(payoutId);
    setError(null);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ payoutId, action }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      await load(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  const attention = payouts.filter((p) => p.status === 'held' || p.status === 'disputed' || p.status === 'failed');

  function eur(cents: number): string {
    return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  }

  return (
    <>
      <style>{`
        :root {
          --color-bg:          oklch(0.09 0.028 305);
          --color-surface:     oklch(0.15 0.024 308);
          --color-border:      oklch(0.26 0.022 305);
          --color-text:        oklch(0.96 0.008 75);
          --color-text-muted:  oklch(0.56 0.012 305);
          --color-accent:      oklch(0.79 0.19 48);
          --color-accent-bg:   oklch(0.18 0.048 48);
          --color-danger:      oklch(0.62 0.18 28);
        }
        html, body { margin: 0; padding: 0; background: var(--color-bg); }
        .admin-root {
          font-family: var(--font-body);
          background: var(--color-bg);
          color: var(--color-text);
          min-height: 100dvh;
          padding: 48px 24px 96px;
          box-sizing: border-box;
        }
        .admin-inner { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; }
        .admin-title {
          font-family: var(--font-display);
          font-size: clamp(22px, 3vw, 32px);
          font-weight: 900;
          margin: 0;
        }
        .admin-sub { font-size: 13px; color: var(--color-text-muted); margin: 4px 0 0; }
        .secret-row { display: flex; gap: 10px; max-width: 420px; }
        .secret-input {
          flex: 1; font-family: var(--font-body); font-size: 14px;
          color: var(--color-text); background: var(--color-surface);
          border: 1px solid var(--color-border); padding: 12px 16px; outline: none;
        }
        .secret-input:focus { border-color: var(--color-accent); }
        .btn {
          font-family: var(--font-display); font-size: 10px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--color-accent); background: transparent;
          border: 1.5px solid var(--color-accent); padding: 10px 18px; cursor: pointer;
          transition: background 0.16s ease, color 0.16s ease;
        }
        .btn:hover:not(:disabled) { background: var(--color-accent); color: oklch(0.09 0.028 305); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost { color: var(--color-text-muted); border-color: var(--color-border); }
        .btn-ghost:hover:not(:disabled) { background: transparent; color: var(--color-text); border-color: oklch(0.42 0.022 305); }
        .btn-danger { color: var(--color-danger); border-color: var(--color-danger); }
        .btn-danger:hover:not(:disabled) { background: var(--color-danger); color: oklch(0.09 0.028 305); }
        .error-box {
          border: 1px solid var(--color-danger); padding: 12px 16px;
          font-size: 13px; color: var(--color-danger); max-width: 640px;
        }
        .section-label {
          font-family: var(--font-display); font-size: 11px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-text-muted);
        }
        .table-wrap { overflow-x: auto; border: 1px solid var(--color-border); }
        table { border-collapse: collapse; width: 100%; min-width: 900px; }
        th {
          font-family: var(--font-display); font-size: 9px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--color-text-muted); text-align: left;
          padding: 10px 14px; border-bottom: 1px solid var(--color-border);
          background: var(--color-surface);
        }
        td {
          font-size: 12.5px; padding: 10px 14px;
          border-bottom: 1px solid var(--color-border);
          vertical-align: top; color: var(--color-text);
        }
        .mono { font-family: var(--font-display); font-size: 10px; letter-spacing: 0.06em; color: var(--color-text-muted); word-break: break-all; }
        .badge {
          display: inline-block; font-family: var(--font-display); font-size: 9px;
          font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
          padding: 3px 8px; border: 1px solid var(--color-border); color: var(--color-text-muted);
        }
        .badge.paid     { color: var(--color-accent); border-color: var(--color-accent); }
        .badge.pending  { color: var(--color-text); }
        .badge.held     { color: oklch(0.75 0.15 85); border-color: oklch(0.75 0.15 85); }
        .badge.disputed { color: var(--color-danger); border-color: var(--color-danger); }
        .badge.failed   { color: var(--color-danger); border-color: var(--color-danger); }
        .reason { font-size: 11px; color: var(--color-text-muted); line-height: 1.5; max-width: 260px; }
        .actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .actions .btn { padding: 6px 10px; font-size: 9px; }
        .empty { padding: 28px; font-size: 13px; color: var(--color-text-muted); }
      `}</style>

      <div className={`admin-root ${unbounded.variable} ${epilogue.variable}`}>
        <div className="admin-inner">
          <div>
            <PasslyLogo />
            <h1 className="admin-title" style={{ marginTop: 24 }}>Payout administration</h1>
            <p className="admin-sub">
              Held, disputed and failed organizer transfers. Retry re-queues a transfer for the next
              payout run; release unblocks a resolved dispute; cancel keeps funds on the platform.
            </p>
          </div>

          {!unlocked && (
            <form
              className="secret-row"
              onSubmit={(e) => { e.preventDefault(); void load(secret); }}
            >
              <input
                type="password"
                className="secret-input"
                placeholder="Admin secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn" disabled={loading || !secret}>
                {loading ? 'Loading…' : 'Unlock'}
              </button>
            </form>
          )}

          {error && <div className="error-box">{error}</div>}

          {unlocked && (
            <>
              <div>
                <div className="section-label" style={{ marginBottom: 12 }}>
                  Needs attention ({attention.length})
                </div>
                <PayoutTable
                  rows={attention}
                  busyId={busyId}
                  onAction={act}
                  eur={eur}
                  emptyText="Nothing needs attention. All payouts are flowing."
                />
              </div>

              <div>
                <div className="section-label" style={{ marginBottom: 12 }}>
                  All payouts ({payouts.length})
                </div>
                <PayoutTable rows={payouts} busyId={busyId} onAction={act} eur={eur} emptyText="No payouts yet." />
              </div>

              <div>
                <button type="button" className="btn btn-ghost" onClick={() => void load(secret)} disabled={loading}>
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PayoutTable({
  rows,
  busyId,
  onAction,
  eur,
  emptyText,
}: {
  rows: PayoutRow[];
  busyId: string | null;
  onAction: (id: string, action: 'retry' | 'release' | 'cancel') => Promise<void>;
  eur: (cents: number) => string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <div className="table-wrap"><div className="empty">{emptyText}</div></div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Event</th>
            <th>Organizer / Account</th>
            <th>Gross</th>
            <th>Fee (3%)</th>
            <th>Net</th>
            <th>Available at</th>
            <th>Reason</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td><span className={`badge ${p.status}`}>{p.status}</span></td>
              <td>
                {p.events?.name ?? '—'}
                <div className="mono">{p.events?.date ?? ''}</div>
              </td>
              <td>
                <div className="mono">{p.organizer_wallet}</div>
                <div className="mono">{p.stripe_account_id ?? 'no Connect account'}</div>
              </td>
              <td>{eur(p.gross_cents)}</td>
              <td>{eur(p.fee_cents)}</td>
              <td>{eur(p.net_cents)}</td>
              <td className="mono">{new Date(p.available_at).toLocaleString('de-DE')}</td>
              <td><div className="reason">{p.failure_reason ?? (p.dispute_id ? `Dispute ${p.dispute_id}` : '—')}</div></td>
              <td>
                <div className="actions">
                  {(p.status === 'held' || p.status === 'failed') && (
                    <button className="btn" disabled={busyId === p.id} onClick={() => void onAction(p.id, 'retry')}>
                      Retry
                    </button>
                  )}
                  {p.status === 'disputed' && (
                    <button className="btn" disabled={busyId === p.id} onClick={() => void onAction(p.id, 'release')}>
                      Release
                    </button>
                  )}
                  {p.status !== 'paid' && p.status !== 'failed' && p.status !== 'refunded' && (
                    <button className="btn btn-danger" disabled={busyId === p.id} onClick={() => void onAction(p.id, 'cancel')}>
                      Cancel
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
