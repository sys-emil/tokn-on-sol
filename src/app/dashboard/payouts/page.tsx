'use client';

import { useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountMenu } from '@/app/components/AccountMenu';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';

interface PayoutRow {
  id: string;
  eventName: string;
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
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();
  const wallet = solanaWallets[0]?.address;

  const [data, setData] = useState<PayoutData | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  const email = user?.email?.address ?? '';
  const summary = data?.summary;

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} />
          <div className="nav">
            <Link href="/dashboard">Übersicht</Link>
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
            <div className="eyebrow"><span className="pulse" /> Auszahlungen</div>
            <h1>Dein Geld, <br />nachvollziehbar.</h1>
            <p className="lead">
              Jeder Verkauf wird dir automatisch überwiesen, sobald die Schutzfrist
              deines Events abgelaufen ist, hier siehst du den Stand.
            </p>
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
                          <td style={{ padding: '12px 18px', fontWeight: 500 }}>{p.eventName}</td>
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
