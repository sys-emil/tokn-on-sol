'use client';

import { useCallback, useEffect, useState } from 'react';
import { VerifiedCheck } from '@/app/components/passlyUi';

interface OrganizerRow {
  id: string;
  wallet_address: string;
  email: string;
  name: string;
  type: 'private' | 'business';
  business_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  handle: string | null;
  public_name: string | null;
  is_verified: boolean;
  verified_label: string | null;
  plan: string | null;
}

interface AdminEventRow {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  is_private: boolean;
  cancelled_at: string | null;
}

type Action = 'approve' | 'reject' | 'verify' | 'unverify';

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
  const [query, setQuery] = useState('');

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

  // load() setzt synchron den Ladezustand — beim ersten Lauf ist das der Zweck.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten holen beim Mounten, ohne Data-Library gibt es dafuer keinen anderen Ort
  useEffect(() => { void load(); }, [load]);

  async function act(walletAddress: string, action: Action): Promise<void> {
    let reason: string | undefined;
    let verifiedLabel: string | undefined;
    if (action === 'reject') {
      reason = window.prompt('Optionaler Grund für die Ablehnung (wird dem Bewerber per E-Mail mitgeteilt):') ?? undefined;
    }
    if (action === 'verify') {
      const label = window.prompt('Text neben dem lila Haken (z. B. „Offizielle Marke“, „Verifizierter Veranstalter“):', 'Offizielle Marke');
      if (!label || !label.trim()) return;
      verifiedLabel = label.trim();
    }
    setBusyWallet(walletAddress);
    setError(null);
    try {
      const res = await fetch('/api/admin/organizers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ walletAddress, action, reason, verifiedLabel }),
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
  const q = query.trim().toLowerCase();
  const filtered = q
    ? organizers.filter((o) =>
        [o.name, o.public_name, o.business_name, o.handle, o.wallet_address, o.email]
          .some((v) => v && v.toLowerCase().includes(q)),
      )
    : organizers;

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
        <OrganizerTable rows={pending} busyWallet={busyWallet} onAction={act} secret={secret} emptyText="Keine offenen Bewerbungen." />
      </section>

      <section>
        <div className="section-head">
          <div>
            <h2>Alle Veranstalter</h2>
            <div className="sub">{filtered.length} {q ? 'Treffer' : 'insgesamt'}</div>
          </div>
          <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading}>
            {loading ? 'Aktualisiert …' : 'Aktualisieren'}
          </button>
        </div>
        <div className="field" style={{ maxWidth: 360, marginBottom: 14 }}>
          <input
            className="input"
            placeholder="Suche: Name, Handle, Wallet, E-Mail …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <OrganizerTable rows={filtered} busyWallet={busyWallet} onAction={act} secret={secret} emptyText="Keine Veranstalter gefunden." />
      </section>
    </>
  );
}

function OrganizerTable({
  rows, busyWallet, onAction, secret, emptyText,
}: {
  rows: OrganizerRow[];
  busyWallet: string | null;
  onAction: (walletAddress: string, action: Action) => Promise<void>;
  secret: string;
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

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
            const shownName = o.public_name?.trim() || o.name;
            const isOpen = expanded === o.wallet_address;
            return (
              <>
                <tr key={o.id}>
                  <td><span className={`chip ${chip.cls}`}><span className="d" />{chip.label}</span></td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {shownName}
                      {o.is_verified && <VerifiedCheck size={14} title={o.verified_label ?? 'Verifiziert'} />}
                    </span>
                    <div className="cell-sub">
                      {o.handle ? `@${o.handle} · ` : ''}{o.wallet_address}
                    </div>
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
                      {o.status === 'approved' && (
                        o.is_verified ? (
                          <button className="btn ghost sm" disabled={busyWallet === o.wallet_address} onClick={() => void onAction(o.wallet_address, 'unverify')}>
                            Verifizierung entfernen
                          </button>
                        ) : (
                          <button
                            className="btn ghost sm"
                            style={{ color: 'var(--accent-ink)', borderColor: 'var(--accent-line)' }}
                            disabled={busyWallet === o.wallet_address}
                            onClick={() => void onAction(o.wallet_address, 'verify')}
                          >
                            Als Marke verifizieren
                          </button>
                        )
                      )}
                      <button className="btn ghost sm" onClick={() => setExpanded(isOpen ? null : o.wallet_address)}>
                        {isOpen ? 'Events ausblenden' : 'Events'}
                      </button>
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${o.id}-events`}>
                    <td colSpan={6} style={{ background: 'var(--surface-2)' }}>
                      <OrganizerEvents wallet={o.wallet_address} secret={secret} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrganizerEvents({ wallet, secret }: { wallet: string; secret: string }) {
  const [events, setEvents] = useState<AdminEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/organizers/events?wallet=${encodeURIComponent(wallet)}`, {
          headers: { 'x-admin-secret': secret }, cache: 'no-store',
        });
        const data = (await res.json()) as { events?: AdminEventRow[]; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.events) { setError(data.error ?? `HTTP ${res.status}`); return; }
        setEvents(data.events);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Fehler');
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [wallet, secret]);

  if (error) return <div style={{ padding: 12, fontSize: 12.5, color: 'var(--bad)' }}>{error}</div>;
  if (!events) return <div style={{ padding: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>Lädt …</div>;
  if (events.length === 0) return <div style={{ padding: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>Keine Events.</div>;

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {events.map((e) => (
        <div key={e.id} className="row gap-2" style={{ fontSize: 12.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)', minWidth: 92 }}>
            {new Date(e.date + 'T00:00:00').toLocaleDateString('de-DE')}
          </span>
          <span style={{ fontWeight: 500 }}>{e.name}</span>
          {e.cancelled_at && <span className="chip bad"><span className="d" />Abgesagt</span>}
          {e.is_private && <span className="chip">Privat</span>}
          <span style={{ color: 'var(--ink-3)' }}>{e.tickets_sold}/{e.capacity} verkauft</span>
          <a href={`/shop/${e.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', marginLeft: 'auto' }}>Shop →</a>
        </div>
      ))}
    </div>
  );
}
