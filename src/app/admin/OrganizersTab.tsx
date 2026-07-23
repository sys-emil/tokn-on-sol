'use client';

import { useCallback, useEffect, useState } from 'react';

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

const STATUS_ORDER: Record<OrganizerRow['status'], number> = { pending: 0, approved: 1, rejected: 2 };

const STATUS_CHIP: Record<OrganizerRow['status'], { cls: string; label: string }> = {
  pending: { cls: 'warn', label: 'Wartet auf Freigabe' },
  approved: { cls: 'ok', label: 'Freigegeben' },
  rejected: { cls: 'bad', label: 'Abgelehnt' },
};

export function OrganizersTab({ secret }: { secret: string }) {
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyWallet, setBusyWallet] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/organizers', { headers: { 'x-admin-secret': secret }, cache: 'no-store' });
      const data = (await res.json()) as { organizers?: OrganizerRow[]; error?: string };
      if (!res.ok || !data.organizers) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const sorted = [...data.organizers].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.created_at.localeCompare(a.created_at),
      );
      setOrganizers(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bewerbungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => { void load(); }, [load]);

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setBusyWallet(null);
    }
  }

  const pending = organizers.filter((o) => o.status === 'pending');

  return (
    <>
      {error && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 20, maxWidth: 640, fontSize: 13, color: 'var(--bad)', border: '1px solid oklch(0.86 0.10 25)', background: 'var(--bad-wash)' }}>
          {error}
        </div>
      )}

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
          <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading}>
            {loading ? 'Aktualisiert …' : 'Aktualisieren'}
          </button>
        </div>
        <OrganizerTable rows={organizers} busyWallet={busyWallet} onAction={act} emptyText="Noch keine Bewerbungen." />
      </section>
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
