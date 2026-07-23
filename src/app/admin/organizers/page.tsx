'use client';

import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { useState } from 'react';

interface OrganizerRow {
  id: string;
  wallet_address: string;
  email: string;
  name: string;
  type: 'private' | 'business';
  business_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const STATUS_ORDER: Record<OrganizerRow['status'], number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
};

const STATUS_CHIP: Record<OrganizerRow['status'], { cls: string; label: string }> = {
  pending:  { cls: 'warn', label: 'Wartet auf Freigabe' },
  approved: { cls: 'ok',   label: 'Freigegeben' },
  rejected: { cls: 'bad',  label: 'Abgelehnt' },
};

const PAGE_CSS = `
  .table-scroll { overflow-x: auto; }
  .org-table { min-width: 900px; }
  .cell-sub { font-family: var(--mono); font-size: 10.5px; color: var(--ink-4); margin-top: 2px; word-break: break-all; }
`;

export default function AdminOrganizers() {
  const [secret, setSecret] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyWallet, setBusyWallet] = useState<string | null>(null);

  async function load(currentSecret: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/organizers', {
        headers: { 'x-admin-secret': currentSecret },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setError('Falsches Admin-Secret.');
        setUnlocked(false);
        return;
      }
      const data = (await res.json()) as { organizers?: OrganizerRow[]; error?: string };
      if (!res.ok || !data.organizers) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const sorted = [...data.organizers].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.created_at.localeCompare(a.created_at),
      );
      setOrganizers(sorted);
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bewerbungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function act(walletAddress: string, action: 'approve' | 'reject'): Promise<void> {
    let reason: string | undefined;
    if (action === 'reject') {
      reason = window.prompt('Optionaler Grund für die Ablehnung (wird dem Bewerber per E-Mail mitgeteilt):') ?? undefined;
    }
    setBusyWallet(walletAddress);
    setError(null);
    try {
      const res = await fetch('/api/admin/organizers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ walletAddress, action, reason }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      await load(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setBusyWallet(null);
    }
  }

  const pending = organizers.filter((o) => o.status === 'pending');

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/admin/organizers" style={{ fontWeight: 600 }}>Bewerbungen</Link>
              <Link href="/admin/payouts">Auszahlungen</Link>
            </div>
            <div className="topbar-right">
              <span className="chip"><span className="d" />Admin</span>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="container">

            <div className="hero" style={{ padding: '36px 0 28px', marginBottom: 8 }}>
              <h1 style={{ fontSize: 30 }}>Veranstalter-Bewerbungen</h1>
              <p className="lead" style={{ fontSize: 14 }}>
                Neue Bewerbungen warten hier auf manuelle Freigabe, bevor der Account Events anlegen
                und über Stripe Connect Zahlungen entgegennehmen kann.
              </p>
            </div>

            {!unlocked && (
              <form
                className="row gap-2"
                style={{ maxWidth: 420 }}
                onSubmit={(e) => { e.preventDefault(); void load(secret); }}
              >
                <input
                  type="password"
                  className="input"
                  placeholder="Admin-Secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn primary" disabled={loading || !secret}>
                  {loading ? 'Lädt …' : 'Entsperren'}
                </button>
              </form>
            )}

            {error && (
              <div className="card" style={{ padding: '12px 16px', marginTop: 20, maxWidth: 640, fontSize: 13, color: 'var(--bad)', border: '1px solid oklch(0.86 0.10 25)', background: 'var(--bad-wash)' }}>
                {error}
              </div>
            )}

            {unlocked && (
              <>
                <section>
                  <div className="section-head">
                    <div>
                      <h2>Wartet auf Freigabe</h2>
                      <div className="sub">{pending.length} Bewerbung{pending.length !== 1 ? 'en' : ''}</div>
                    </div>
                  </div>
                  <OrganizerTable rows={pending} busyWallet={busyWallet} onAction={act} emptyText="Keine offenen Bewerbungen." />
                </section>

                <section>
                  <div className="section-head">
                    <div>
                      <h2>Alle Bewerbungen</h2>
                      <div className="sub">{organizers.length} insgesamt</div>
                    </div>
                    <button type="button" className="btn ghost sm" onClick={() => void load(secret)} disabled={loading}>
                      {loading ? 'Aktualisiert …' : 'Aktualisieren'}
                    </button>
                  </div>
                  <OrganizerTable rows={organizers} busyWallet={busyWallet} onAction={act} emptyText="Noch keine Bewerbungen." />
                </section>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

function OrganizerTable({
  rows,
  busyWallet,
  onAction,
  emptyText,
}: {
  rows: OrganizerRow[];
  busyWallet: string | null;
  onAction: (walletAddress: string, action: 'approve' | 'reject') => Promise<void>;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <div className="card"><div className="empty">{emptyText}</div></div>;
  }
  return (
    <div className="card table-scroll">
      <table className="org-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Name / Wallet</th>
            <th>Kontakt</th>
            <th>Typ</th>
            <th>Beworben am</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const chip = STATUS_CHIP[o.status];
            return (
              <tr key={o.id}>
                <td><span className={`chip ${chip.cls}`}><span className="d" />{chip.label}</span></td>
                <td>
                  {o.name}
                  <div className="cell-sub">{o.wallet_address}</div>
                </td>
                <td>{o.email}</td>
                <td>{o.type === 'business' ? (o.business_name ?? 'Unternehmen') : 'Privatperson'}</td>
                <td className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{new Date(o.created_at).toLocaleString('de-DE')}</td>
                <td>
                  <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                    {o.status === 'pending' && (
                      <>
                        <button className="btn ghost sm" disabled={busyWallet === o.wallet_address} onClick={() => void onAction(o.wallet_address, 'approve')}>
                          Freigeben
                        </button>
                        <button
                          className="btn ghost sm"
                          style={{ color: 'var(--bad)', borderColor: 'oklch(0.86 0.10 25)' }}
                          disabled={busyWallet === o.wallet_address}
                          onClick={() => void onAction(o.wallet_address, 'reject')}
                        >
                          Ablehnen
                        </button>
                      </>
                    )}
                    {o.status !== 'pending' && <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>–</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
