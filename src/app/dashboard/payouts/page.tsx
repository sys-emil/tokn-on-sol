'use client';

import { useLogout, useAuth, useWallets as useSolanaWallets } from '@/lib/auth';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AccountMenu } from '@/app/components/AccountMenu';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { DashboardNav } from '@/app/components/DashboardNav';

interface PayoutRow {
  id: string;
  eventName: string;
  /** Season-pass sales have no event; the name is the pass's. */
  seasonPass?: boolean;
  netCents: number;
  status: string;
  availableAt: string;
  createdAt: string;
}

interface PayoutData {
  summary: {
    pendingCents: number;
    paidCents: number;
    heldCount: number;
    nextAvailableAt: string | null;
    /** Amounts still to be deducted from a future transfer, total and by source. */
    outstandingFees: number;
    outstandingBoxOffice: number;
    outstandingCancellation: number;
    outstandingChargeback: number;
  };
  payouts: PayoutRow[];
  /** Events mit noch nicht fälligen Auszahlungen; Grundlage der Sofort-Anfrage. */
  instant: InstantRow[];
}

interface InstantRow {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  netCents: number;
  salesCount: number;
  availableAt: string;
  /** 'none' | 'pending' | 'approved' | 'rejected' */
  requestStatus: string;
}

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const shortStamp = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

function statusChip(status: string) {
  switch (status) {
    case 'paid': return <span className="chip ok"><span className="d" />Ausgezahlt</span>;
    case 'pending': return <span className="chip accent"><span className="d" />Geplant</span>;
    case 'held': return <span className="chip warn"><span className="d" />In Prüfung</span>;
    case 'disputed': return <span className="chip warn"><span className="d" />Reklamation</span>;
    case 'refunded': return <span className="chip"><span className="d" />Erstattet</span>;
    default: return <span className="chip"><span className="d" />{status}</span>;
  }
}

export default function PayoutsPage() {
  const router = useRouter();
  const { ready, authenticated, user, getAccessToken } = useAuth();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();
  const wallet = solanaWallets[0]?.address;

  const [data, setData] = useState<PayoutData | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Sofort-Auszahlung: zweistufig, weil die Anfrage einen Menschen beschäftigt.
  // `askFor` hält das Event, für das gerade das Notizfeld offen steht.
  const [askFor, setAskFor] = useState<string | null>(null);
  const [askNote, setAskNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  // Bookkeeping export. Defaults to the current calendar year, the unit an
  // organizer files in; the route accepts any range.
  const thisYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${thisYear}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);

  async function downloadExport(): Promise<void> {
    if (!wallet) return;
    setExporting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/organizer/export?walletAddress=${wallet}&from=${from}&to=${to}`,
        { headers: { Authorization: `Bearer ${token ?? ''}` } },
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `passly-export-${from}-bis-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  const loadPayouts = useCallback(async (): Promise<void> => {
    if (!wallet) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/organizer/payouts?walletAddress=${wallet}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (res.ok) setData((await res.json()) as PayoutData);
    } finally {
      setLoaded(true);
    }
  }, [wallet, getAccessToken]);

  useEffect(() => { void loadPayouts(); }, [loadPayouts]);

  async function requestInstant(eventId: string): Promise<void> {
    if (!wallet || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/organizer/payout-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ walletAddress: wallet, eventId, note: askNote.trim() || undefined }),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!body.success) {
        setAskError(body.error ?? 'Die Anfrage konnte nicht gesendet werden.');
        return;
      }
      setAskFor(null);
      setAskNote('');
      await loadPayouts();
    } catch {
      setAskError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setAsking(false);
    }
  }

  if (!ready || !authenticated) return null;

  const email = user?.email ?? '';
  const summary = data?.summary;

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} />
          <DashboardNav active="payouts" />
          <div className="topbar-right">
            <AccountMenu email={email} walletAddress={wallet} onLogout={() => logout()} />
          </div>
        </div>
      </div>

      <div className="main">
        <div className="aurora" />
        <div className="container">
          <div className="hero">
            <h1>Auszahlungen</h1>
          </div>

          <section>
            <div className="kpis">
              <div className="kpi">
                <div className="label">Unterwegs zu dir</div>
                <div className="value">{eur(summary?.pendingCents ?? 0)}</div>
                <div className="delta" style={{ color: 'var(--ink-3)' }}>
                  {summary?.nextAvailableAt
                    ? `nächste Auszahlung ab ${shortStamp(summary.nextAvailableAt)}`
                    : 'keine offenen Beträge'}
                </div>
              </div>
              <div className="kpi">
                <div className="label">Bereits ausgezahlt</div>
                <div className="value">{eur(summary?.paidCents ?? 0)}</div>
                <div className="delta" style={{ color: 'var(--ink-3)' }}>an dein Bankkonto überwiesen</div>
              </div>
              {(summary?.outstandingFees ?? 0) > 0 && (
                <div className="kpi">
                  <div className="label">Einbehalt nächste Auszahlung</div>
                  <div className="value">−{eur(summary?.outstandingFees ?? 0)}</div>
                  <div className="delta" style={{ color: 'var(--ink-3)' }}>
                    {/* Jede Quelle benennen: „Servicegebühr" allein wäre bei
                        Absage- und Chargeback-Kosten schlicht falsch. */}
                    {[
                      (summary?.outstandingBoxOffice ?? 0) > 0
                        ? `${eur(summary?.outstandingBoxOffice ?? 0)} Servicegebühr Abendkasse (bar kassiert)`
                        : null,
                      (summary?.outstandingCancellation ?? 0) > 0
                        ? `${eur(summary?.outstandingCancellation ?? 0)} Zahlungsgebühren aus abgesagten Events`
                        : null,
                      (summary?.outstandingChargeback ?? 0) > 0
                        ? `${eur(summary?.outstandingChargeback ?? 0)} Stripe-Gebühren aus verlorenen Chargebacks`
                        : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              )}
              <div className="kpi">
                <div className="label">In Klärung</div>
                <div className="value">{summary?.heldCount ?? 0}</div>
                <div className="delta" style={{ color: 'var(--ink-3)' }}>
                  {summary && summary.heldCount > 0 ? 'wir kümmern uns, kein Handeln nötig' : 'alles sauber'}
                </div>
              </div>
            </div>
          </section>

          {/* Einnahmen fließen nach dem Event. Wer vorher an sie muss, fragt
              hier an; entschieden wird von Hand. Die Sektion erscheint nur,
              wenn es überhaupt etwas vorzuziehen gibt. */}
          {data?.instant && data.instant.length > 0 && (
            <section>
              <div className="section-head">
                <div>
                  <h2>Geld vor dem Event</h2>
                  <div className="sub">
                    Deine Einnahmen überweisen wir nach der Veranstaltung. Brauchst du sie vorher,
                    frag eine Sofort-Auszahlung an — wir schauen sie uns an und geben sie frei.
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 0 }}>
                {data.instant.map((row, i) => (
                  <div
                    key={row.eventId}
                    style={{
                      padding: 18,
                      borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                      display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{row.eventName}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
                        {eur(row.netCents)} aus {row.salesCount} {row.salesCount === 1 ? 'Verkauf' : 'Verkäufen'}
                        {' · geplant ab '}{shortStamp(row.availableAt)}
                      </div>

                      {row.requestStatus === 'pending' && (
                        <div style={{ fontSize: 12.5, color: 'var(--warn)', marginTop: 8 }}>
                          Anfrage läuft. Wir melden uns per E-Mail.
                        </div>
                      )}
                      {row.requestStatus === 'rejected' && (
                        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8 }}>
                          Letzte Anfrage abgelehnt. Die Auszahlung läuft wie geplant nach dem Event.
                        </div>
                      )}
                      {/* Eine Freigabe gilt nur fuer die Verkaeufe, die es zu
                          dem Zeitpunkt gab. Was danach hereinkommt, steht
                          wieder hier — und muss erneut angefragt werden
                          koennen. */}
                      {row.requestStatus === 'approved' && (
                        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8 }}>
                          Diese Verkäufe kamen nach deiner letzten Freigabe herein.
                        </div>
                      )}

                      {askFor === row.eventId && (
                        <div style={{ marginTop: 12 }}>
                          <textarea
                            className="textarea"
                            rows={2}
                            maxLength={500}
                            placeholder="Wofür brauchst du das Geld? (hilft uns bei der Entscheidung)"
                            value={askNote}
                            onChange={(e) => setAskNote(e.target.value)}
                          />
                          {askError && (
                            <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 6 }}>{askError}</div>
                          )}
                          <div className="row gap-2" style={{ marginTop: 10 }}>
                            <button
                              className="btn primary sm"
                              disabled={asking}
                              onClick={() => void requestInstant(row.eventId)}
                            >
                              {asking ? 'Wird gesendet …' : 'Anfrage senden'}
                            </button>
                            <button
                              className="btn subtle sm"
                              disabled={asking}
                              onClick={() => { setAskFor(null); setAskError(null); }}
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {row.requestStatus !== 'pending' && askFor !== row.eventId && (
                      <button
                        className="btn ghost"
                        onClick={() => { setAskFor(row.eventId); setAskNote(''); setAskError(null); }}
                      >
                        Sofort-Auszahlung anfragen
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="section-head">
              <div>
                <h2>Für die Buchhaltung</h2>
                <div className="sub">CSV mit allen Verkäufen eines Zeitraums · inklusive Abendkasse und Saisonpässen</div>
              </div>
            </div>
            <div className="card" style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="exportFrom">Von</label>
                  <input id="exportFrom" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="exportTo">Bis</label>
                  <input id="exportTo" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <button className="btn primary" disabled={exporting} onClick={() => void downloadExport()}>
                  {exporting ? 'Wird erstellt …' : 'CSV herunterladen'}
                </button>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                Eine Zeile pro Bestellung, mit Bruttobetrag, Servicegebühr und dem Betrag,
                der bei dir ankommt. Deine Steuerberatung kann die Spalten direkt zuordnen.
                Wir weisen bewusst keine Umsatzsteuer aus. Welcher Satz für dich gilt,
                weißt nur du.
              </div>
            </div>
          </section>

          <section>
            <div className="section-head">
              <div>
                <h2>Alle Auszahlungen</h2>
                <div className="sub">Ein Eintrag pro Verkauf · überwiesen nach dem Event, beim ersten Event drei Tage danach</div>
              </div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {!loaded ? (
                <div className="empty" style={{ padding: 28 }}>Lade …</div>
              ) : !data || data.payouts.length === 0 ? (
                <div className="empty" style={{ padding: 28 }}>
                  Noch keine Auszahlungen, sie erscheinen hier mit dem ersten Verkauf.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <th style={{ padding: '12px 18px', fontWeight: 600 }}>Event</th>
                        <th style={{ padding: '12px 10px', fontWeight: 600 }}>Verkauf</th>
                        <th style={{ padding: '12px 10px', fontWeight: 600 }}>Auszahlung ab</th>
                        <th style={{ padding: '12px 10px', fontWeight: 600 }}>Betrag</th>
                        <th style={{ padding: '12px 18px', fontWeight: 600 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payouts.map((p) => (
                        <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                          <td style={{ padding: '12px 18px', fontWeight: 500 }}>
                            {p.eventName}
                            {p.seasonPass && (
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, marginTop: 2 }}>Saisonpass</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{shortStamp(p.createdAt)}</td>
                          <td style={{ padding: '12px 10px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{shortStamp(p.availableAt)}</td>
                          <td style={{ padding: '12px 10px', whiteSpace: 'nowrap', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{eur(p.netCents)}</td>
                          <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>{statusChip(p.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />
        </div>
      </div>
    </div>
  );
}
