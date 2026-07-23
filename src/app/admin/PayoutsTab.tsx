'use client';

import { useCallback, useEffect, useState } from 'react';

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
  disputed: 0, held: 1, failed: 2, pending: 3, refunded: 4, paid: 5,
};

const STATUS_CHIP: Record<PayoutRow['status'], { cls: string; label: string }> = {
  pending: { cls: '', label: 'Ausstehend' },
  paid: { cls: 'ok', label: 'Ausgezahlt' },
  held: { cls: 'warn', label: 'Zurückgehalten' },
  disputed: { cls: 'bad', label: 'Disput' },
  failed: { cls: 'bad', label: 'Fehlgeschlagen' },
  refunded: { cls: 'accent', label: 'Erstattet' },
};

function eur(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function PayoutsTab({ secret }: { secret: string }) {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/payouts', { headers: { 'x-admin-secret': secret }, cache: 'no-store' });
      const data = (await res.json()) as { payouts?: PayoutRow[]; error?: string };
      if (!res.ok || !data.payouts) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const sorted = [...data.payouts].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.created_at.localeCompare(a.created_at),
      );
      setPayouts(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auszahlungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => { void load(); }, [load]);

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  }

  const attention = payouts.filter((p) => p.status === 'held' || p.status === 'disputed' || p.status === 'failed');

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
            <h2>Braucht Aufmerksamkeit</h2>
            <div className="sub">{attention.length} Auszahlung{attention.length !== 1 ? 'en' : ''}</div>
          </div>
        </div>
        <PayoutTable rows={attention} busyId={busyId} onAction={act} emptyText="Nichts zu tun, alle Auszahlungen laufen." />
      </section>

      <section>
        <div className="section-head">
          <div>
            <h2>Alle Auszahlungen</h2>
            <div className="sub">{payouts.length} insgesamt</div>
          </div>
          <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading}>
            {loading ? 'Aktualisiert …' : 'Aktualisieren'}
          </button>
        </div>
        <PayoutTable rows={payouts} busyId={busyId} onAction={act} emptyText="Noch keine Auszahlungen." />
      </section>
    </>
  );
}

function PayoutTable({
  rows,
  busyId,
  onAction,
  emptyText,
}: {
  rows: PayoutRow[];
  busyId: string | null;
  onAction: (id: string, action: 'retry' | 'release' | 'cancel') => Promise<void>;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <div className="card"><div className="empty">{emptyText}</div></div>;
  }
  return (
    <div className="card table-scroll">
      <table className="ticket-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Event</th>
            <th>Veranstalter / Konto</th>
            <th>Brutto</th>
            <th>Gebühr</th>
            <th>Netto</th>
            <th>Verfügbar ab</th>
            <th>Grund</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const chip = STATUS_CHIP[p.status];
            return (
              <tr key={p.id}>
                <td><span className={`chip ${chip.cls}`}><span className="d" />{chip.label}</span></td>
                <td>
                  {p.events?.name ?? '–'}
                  <div className="cell-sub">{p.events?.date ?? ''}</div>
                </td>
                <td>
                  <div className="cell-sub" style={{ marginTop: 0 }}>{p.organizer_wallet}</div>
                  <div className="cell-sub">{p.stripe_account_id ?? 'kein Connect-Konto'}</div>
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(p.gross_cents)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(p.fee_cents)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{eur(p.net_cents)}</td>
                <td className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{new Date(p.available_at).toLocaleString('de-DE')}</td>
                <td><div className="reason">{p.failure_reason ?? (p.dispute_id ? `Disput ${p.dispute_id}` : '–')}</div></td>
                <td>
                  <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                    {(p.status === 'held' || p.status === 'failed') && (
                      <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => void onAction(p.id, 'retry')}>
                        Erneut versuchen
                      </button>
                    )}
                    {p.status === 'disputed' && (
                      <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => void onAction(p.id, 'release')}>
                        Freigeben
                      </button>
                    )}
                    {p.status !== 'paid' && p.status !== 'failed' && p.status !== 'refunded' && (
                      <button
                        className="btn ghost sm"
                        style={{ color: 'var(--bad)', borderColor: 'oklch(0.86 0.10 25)' }}
                        disabled={busyId === p.id}
                        onClick={() => void onAction(p.id, 'cancel')}
                      >
                        Stornieren
                      </button>
                    )}
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
