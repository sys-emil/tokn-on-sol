'use client';

import { useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon, Spark } from '@/app/components/passlyUi';

interface AnalyticsEvent {
  id: string;
  name: string;
  date: string;
  capacity: number;
  ticketsSold: number;
  cancelled: boolean;
  revenueCents: number;
  redeemed: number;
  redemptionPct: number;
}

interface TopCustomer {
  wallet: string;
  email: string | null;
  purchases: number;
  redeemed: number;
  attendedEvents: number;
  stammgast: boolean;
}

interface AnalyticsData {
  events: AnalyticsEvent[];
  salesByDay: { date: string; sold: number }[];
  repeat: { customers: number; repeatCustomers: number; repeatShare: number };
  topCustomers: TopCustomer[];
}

interface LoyaltyProgram {
  id: string;
  threshold: number;
  benefit_title: string;
  benefit_description: string | null;
  active: boolean;
}

interface LoyaltyClaim {
  id: string;
  wallet_address: string;
  code: string;
  claimed_at: string;
  redeemed_at: string | null;
}

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
const shortWallet = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

export default function ProAnalytics() {
  const router = useRouter();
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();
  const wallet = solanaWallets[0]?.address;

  const [orgStatus, setOrgStatus] = useState<'loading' | 'none' | 'approved'>('loading');
  const [plan, setPlan] = useState<'loading' | 'free' | 'pro'>('loading');
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [claims, setClaims] = useState<LoyaltyClaim[]>([]);
  const [qualifiedCount, setQualifiedCount] = useState(0);
  const [loyaltyLoaded, setLoyaltyLoaded] = useState(false);
  const [benefitTitle, setBenefitTitle] = useState('');
  const [benefitDescription, setBenefitDescription] = useState('');
  const [threshold, setThreshold] = useState(3);
  const [programActive, setProgramActive] = useState(true);
  const [savingProgram, setSavingProgram] = useState(false);
  const [loyaltyMsg, setLoyaltyMsg] = useState<string | null>(null);

  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!wallet) return;
    async function check(): Promise<void> {
      const res = await fetch(`/api/organizers/status?walletAddress=${wallet}`);
      if (!res.ok) { setOrgStatus('none'); return; }
      const data = (await res.json()) as { status: string; plan?: string };
      setOrgStatus(data.status === 'approved' ? 'approved' : 'none');
      setPlan(data.plan === 'pro' ? 'pro' : 'free');
    }
    void check();
  }, [wallet]);

  useEffect(() => {
    if (orgStatus === 'none') router.push('/dashboard');
  }, [orgStatus, router]);

  useEffect(() => {
    if (!wallet || plan !== 'pro') return;
    async function load(): Promise<void> {
      const token = await getAccessToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [aRes, lRes] = await Promise.all([
        fetch(`/api/organizer/analytics?walletAddress=${wallet}`, { headers }),
        fetch(`/api/organizer/loyalty?walletAddress=${wallet}`, { headers }),
      ]);
      if (aRes.ok) setAnalytics((await aRes.json()) as AnalyticsData);
      if (lRes.ok) {
        const data = (await lRes.json()) as { program: LoyaltyProgram | null; qualifiedCount: number; claims: LoyaltyClaim[] };
        setProgram(data.program);
        setQualifiedCount(data.qualifiedCount);
        setClaims(data.claims);
        if (data.program) {
          setBenefitTitle(data.program.benefit_title);
          setBenefitDescription(data.program.benefit_description ?? '');
          setThreshold(data.program.threshold);
          setProgramActive(data.program.active);
        }
      }
      setLoyaltyLoaded(true);
    }
    void load();
  }, [wallet, plan, getAccessToken]);

  async function handleUpgrade(): Promise<void> {
    if (!wallet || billingBusy) return;
    setBillingError(null);
    const token = await getAccessToken();
    if (!token) return;
    setBillingBusy(true);
    try {
      const res = await fetch('/api/organizer/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: wallet }),
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) window.location.href = data.url;
      else setBillingError(data.error ?? 'Upgrade konnte nicht gestartet werden.');
    } finally {
      setBillingBusy(false);
    }
  }

  async function saveProgram(): Promise<void> {
    if (!wallet || savingProgram) return;
    setLoyaltyMsg(null);
    const token = await getAccessToken();
    if (!token) return;
    setSavingProgram(true);
    try {
      const res = await fetch('/api/organizer/loyalty', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: wallet, threshold, benefitTitle, benefitDescription, active: programActive }),
      });
      const data = (await res.json()) as { success: boolean; program?: LoyaltyProgram; error?: string };
      if (data.success && data.program) {
        setProgram(data.program);
        setLoyaltyMsg('Gespeichert.');
      } else {
        setLoyaltyMsg(data.error ?? 'Speichern fehlgeschlagen.');
      }
    } finally {
      setSavingProgram(false);
    }
  }

  async function redeemLoyaltyCode(): Promise<void> {
    if (!wallet || redeeming || !redeemCode.trim()) return;
    setRedeemResult(null);
    const token = await getAccessToken();
    if (!token) return;
    setRedeeming(true);
    try {
      const res = await fetch('/api/organizer/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: wallet, code: redeemCode }),
      });
      const data = (await res.json()) as { success: boolean; benefitTitle?: string; error?: string; redeemedAt?: string };
      if (data.success) {
        setRedeemResult({ ok: true, text: `Eingelöst: ${data.benefitTitle ?? 'Vorteil'}` });
        setRedeemCode('');
        setClaims((prev) => prev.map((c) => c.code === redeemCode.trim().toUpperCase() ? { ...c, redeemed_at: new Date().toISOString() } : c));
      } else if (data.error === 'already_redeemed') {
        setRedeemResult({ ok: false, text: 'Dieser Code wurde bereits eingelöst.' });
      } else if (data.error === 'unknown_code') {
        setRedeemResult({ ok: false, text: 'Unbekannter Code.' });
      } else {
        setRedeemResult({ ok: false, text: data.error ?? 'Einlösen fehlgeschlagen.' });
      }
    } finally {
      setRedeeming(false);
    }
  }

  if (!ready || orgStatus === 'loading') return null;

  const email = user?.email?.address ?? '';
  const initials = (email ? email.split('@')[0] : 'PA').slice(0, 2).toUpperCase();
  const totalRevenue = analytics?.events.reduce((sum, e) => sum + e.revenueCents, 0) ?? 0;
  const sparkData = analytics?.salesByDay.map((d) => d.sold) ?? [];

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} />
          <div className="nav">
            <Link href="/dashboard">Übersicht</Link>
            <Link href="/dashboard/analytics" className="active">Pro</Link>
            <Link href="/events">Events</Link>
            <Link href="/my-tickets">Meine Tickets</Link>
          </div>
          <div className="topbar-right">
            <button className="btn subtle sm" onClick={() => logout()}>Abmelden</button>
            <div className="avatar" title={email}>{initials}</div>
          </div>
        </div>
      </div>

      <div className="main">
        <div className="aurora" />
        <div className="container">

          <div className="hero">
            <div className="eyebrow"><span className="pulse" /> Passly Pro</div>
            <h1>Deine Gäste, <br />richtig verstanden.</h1>
            <p className="lead">
              Analytics über alle Events, Stammkunden auf einen Blick und dein eigenes Treueprogramm.
            </p>
          </div>

          {plan === 'free' && (
            <section>
              <div className="card" style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: 'var(--accent)' }}>
                  <Icon name="sparkle" size={20} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>Passly Pro freischalten</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                  Wiederkehrer-Statistiken, Top-Kunden mit Kontakt, Nachrichten an alle Ticketinhaber
                  und ein Treueprogramm, das deine Stammgäste belohnt.
                </div>
                <div className="row gap-3" style={{ justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
                  {['Umsatz & Einlösequote je Event', 'Stammkunden-Anteil', 'Gäste-Nachrichten', 'Treueprogramm'].map((f) => (
                    <span key={f} className="chip accent"><span className="d" />{f}</span>
                  ))}
                </div>
                {billingError && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 12 }}>{billingError}</div>}
                <button className="btn primary lg" style={{ marginTop: 20 }} onClick={() => void handleUpgrade()} disabled={billingBusy}>
                  {billingBusy ? 'Weiterleitung …' : 'Pro werden'}
                </button>
              </div>
            </section>
          )}

          {plan === 'pro' && (
            <>
              <section>
                <div className="section-head">
                  <div>
                    <h2>Über alle Events</h2>
                    <div className="sub">Letzte 30 Tage</div>
                  </div>
                </div>
                <div className="kpis">
                  <div className="kpi">
                    <div className="label">Ausgezahlter Umsatz</div>
                    <div className="value">{eur(totalRevenue)}</div>
                    {sparkData.length > 1 && <div className="spark"><Spark data={sparkData} color="var(--ok)" /></div>}
                  </div>
                  <div className="kpi">
                    <div className="label">Kunden</div>
                    <div className="value">{analytics?.repeat.customers ?? 0}</div>
                    <div className="delta" style={{ color: 'var(--ink-3)' }}>eindeutige Käufer</div>
                  </div>
                  <div className="kpi">
                    <div className="label">Wiederkehrer</div>
                    <div className="value">{analytics?.repeat.repeatShare ?? 0} %</div>
                    <div className="delta" style={{ color: 'var(--ink-3)' }}>
                      {analytics?.repeat.repeatCustomers ?? 0} Kunden bei ≥ 2 Events
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="label">Treue-Vorteile</div>
                    <div className="value">{claims.length}</div>
                    <div className="delta" style={{ color: 'var(--ink-3)' }}>
                      {claims.filter((c) => c.redeemed_at).length} eingelöst
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="section-head">
                  <div>
                    <h2>Events im Vergleich</h2>
                    <div className="sub">Umsatz und Einlösequote</div>
                  </div>
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {!analytics || analytics.events.length === 0 ? (
                    <div className="empty" style={{ padding: 28 }}>Noch keine Events.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <th style={{ padding: '12px 18px', fontWeight: 600 }}>Event</th>
                            <th style={{ padding: '12px 10px', fontWeight: 600 }}>Datum</th>
                            <th style={{ padding: '12px 10px', fontWeight: 600 }}>Verkauft</th>
                            <th style={{ padding: '12px 10px', fontWeight: 600 }}>Umsatz</th>
                            <th style={{ padding: '12px 18px', fontWeight: 600 }}>Einlösequote</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.events.map((e) => (
                            <tr key={e.id} style={{ borderTop: '1px solid var(--line)' }}>
                              <td style={{ padding: '12px 18px', fontWeight: 500 }}>
                                <Link href={`/dashboard/events/${e.id}`} style={{ color: 'var(--ink)' }}>{e.name}</Link>
                                {e.cancelled && <span className="chip" style={{ marginLeft: 8 }}>Abgesagt</span>}
                              </td>
                              <td style={{ padding: '12px 10px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{shortDate(e.date)}</td>
                              <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>{e.ticketsSold} / {e.capacity}</td>
                              <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>{eur(e.revenueCents)}</td>
                              <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>{e.redemptionPct} %</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="section-head">
                  <div>
                    <h2>Top-Kunden</h2>
                    <div className="sub">Nach gekauften Tickets</div>
                  </div>
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {!analytics || analytics.topCustomers.length === 0 ? (
                    <div className="empty" style={{ padding: 28 }}>Noch keine Kunden.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <th style={{ padding: '12px 18px', fontWeight: 600 }}>Kunde</th>
                            <th style={{ padding: '12px 10px', fontWeight: 600 }}>Tickets</th>
                            <th style={{ padding: '12px 10px', fontWeight: 600 }}>Events besucht</th>
                            <th style={{ padding: '12px 18px', fontWeight: 600 }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.topCustomers.map((c) => (
                            <tr key={c.wallet} style={{ borderTop: '1px solid var(--line)' }}>
                              <td style={{ padding: '12px 18px' }}>
                                <div style={{ fontWeight: 500 }}>{c.email ?? shortWallet(c.wallet)}</div>
                                {c.email && <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{shortWallet(c.wallet)}</div>}
                              </td>
                              <td style={{ padding: '12px 10px' }}>{c.purchases}</td>
                              <td style={{ padding: '12px 10px' }}>{c.attendedEvents}</td>
                              <td style={{ padding: '12px 18px' }}>
                                {c.stammgast ? <span className="chip accent"><span className="d" />Stammgast</span> : <span className="chip"><span className="d" />Gast</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="section-head">
                  <div>
                    <h2>Treueprogramm</h2>
                    <div className="sub">Belohne Gäste, die immer wieder kommen</div>
                  </div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  {!loyaltyLoaded ? (
                    <div className="empty">Lade …</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
                        <div className="field">
                          <label>Vorteil (z. B. „1 Freigetränk am Einlass“)</label>
                          <input className="input" value={benefitTitle} maxLength={80} onChange={(e) => setBenefitTitle(e.target.value)} placeholder="1 Freigetränk am Einlass" />
                        </div>
                        <div className="field">
                          <label>Beschreibung (optional)</label>
                          <input className="input" value={benefitDescription} maxLength={300} onChange={(e) => setBenefitDescription(e.target.value)} placeholder="Einlösbar bei jedem unserer Events" />
                        </div>
                        <div className="field">
                          <label>Ab wie vielen besuchten Events?</label>
                          <input className="input" type="number" min={2} max={20} value={threshold} onChange={(e) => setThreshold(Math.max(2, Math.min(20, Number(e.target.value) || 3)))} style={{ maxWidth: 120 }} />
                        </div>
                        <label className="row gap-2" style={{ fontSize: 13, alignItems: 'center', cursor: 'pointer' }}>
                          <input type="checkbox" checked={programActive} onChange={(e) => setProgramActive(e.target.checked)} />
                          Programm aktiv
                        </label>
                        <div className="row gap-2" style={{ alignItems: 'center' }}>
                          <button className="btn primary" onClick={() => void saveProgram()} disabled={savingProgram || !benefitTitle.trim()}>
                            {savingProgram ? 'Speichern …' : program ? 'Aktualisieren' : 'Programm starten'}
                          </button>
                          {loyaltyMsg && <span style={{ fontSize: 12.5, color: loyaltyMsg === 'Gespeichert.' ? 'var(--ok)' : 'var(--bad)' }}>{loyaltyMsg}</span>}
                        </div>
                      </div>
                      {program && (
                        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
                          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                            <b style={{ color: 'var(--ink)' }}>{qualifiedCount}</b> Kunde{qualifiedCount !== 1 ? 'n' : ''} qualifiziert ·{' '}
                            <b style={{ color: 'var(--ink)' }}>{claims.length}</b> Vorteil{claims.length !== 1 ? 'e' : ''} abgeholt ·{' '}
                            <b style={{ color: 'var(--ink)' }}>{claims.filter((c) => c.redeemed_at).length}</b> eingelöst
                          </div>
                          <div className="row gap-2" style={{ marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              className="input mono"
                              placeholder="Code einlösen, z. B. A3K7XM"
                              value={redeemCode}
                              maxLength={6}
                              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                              style={{ maxWidth: 220, textTransform: 'uppercase' }}
                            />
                            <button className="btn ghost" onClick={() => void redeemLoyaltyCode()} disabled={redeeming || redeemCode.trim().length < 6}>
                              {redeeming ? 'Prüfe …' : 'Einlösen'}
                            </button>
                            {redeemResult && (
                              <span className={`chip ${redeemResult.ok ? 'ok' : ''}`} style={!redeemResult.ok ? { color: 'var(--bad)' } : undefined}>
                                <span className="d" />{redeemResult.text}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </>
          )}

          <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />
        </div>
      </div>
    </div>
  );
}
