'use client';

import { useLogout, useAuth, useWallets as useSolanaWallets } from '@/lib/auth';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountMenu } from '@/app/components/AccountMenu';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';

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

  useEffect(() => {
    if (!wallet) return;
    async function load(): Promise<void> {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/organizer/payouts?walletAddress=${wallet}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (res.ok) setData((await res.json()) as PayoutData);
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [wallet, getAccessToken]);

  if (!ready || !authenticated) return null;

  const email = user?.email ?? '';
  const summary = data?.summary;

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} />
          <div className="nav">
            <Link href="/dashboard">Übersicht</Link>
            <Link href="/dashboard/passes">Saisonpässe</Link>
            <Link href="/dashboard/payouts" className="active">Auszahlungen</Link>
            <Link href="/dashboard/analytics">Pro</Link>
            <Link href="/events">Events</Link>
          </div>
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
                <div className="sub">Ein Eintrag pro Verkauf · Auszahlung täglich, nach Ablauf der Schutzfrist</div>
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
