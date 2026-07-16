'use client';

import { useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountMenu } from '@/app/components/AccountMenu';
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
  funnel: { views: number; checkouts: number; purchases: number };
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

const PAGE_CSS = `
  /* ── Pro-Bereich: invertiertes, dunkles Theme (Pitch-Deck-Optik) ──
     Die Seite überschreibt die globalen Tokens; sämtliche Komponenten-CSS
     (topbar, card, kpi, chip, input …) folgt automatisch. Der Style-Tag
     lebt nur solange diese Seite gemountet ist. */
  :root {
    color-scheme: dark;
    --ink:        oklch(0.955 0.005 290);
    --ink-2:      oklch(0.86 0.012 290);
    --ink-3:      oklch(0.67 0.02 290);
    --ink-4:      oklch(0.52 0.02 290);
    --line:       oklch(0.285 0.022 290);
    --line-2:     oklch(0.35 0.028 290);
    --surface:    oklch(0.205 0.026 290);
    --surface-2:  oklch(0.155 0.02 292);
    --surface-3:  oklch(0.26 0.03 290);
    --accent:     oklch(0.74 0.145 290);
    --accent-2:   oklch(0.80 0.125 290);
    --accent-ink: oklch(0.86 0.08 290);
    --accent-wash:oklch(0.26 0.055 290);
    --accent-line:oklch(0.40 0.08 290);
    --ok:         oklch(0.75 0.14 150);
    --ok-wash:    oklch(0.27 0.05 150);
    --warn:       oklch(0.78 0.14 70);
    --warn-wash:  oklch(0.27 0.05 70);
    --bad:        oklch(0.70 0.17 25);
    --bad-wash:   oklch(0.27 0.05 25);
    --shadow-sm:  0 1px 0 rgba(0,0,0,0.35);
    --shadow:     0 1px 2px rgba(0,0,0,0.35), 0 4px 18px rgba(0,0,0,0.30);
    --shadow-lg:  0 12px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.30);
  }
  input[type="checkbox"] { accent-color: var(--accent); }

  /* Topbar verschmilzt mit dem dunklen Hintergrund */
  .topbar {
    background: color-mix(in oklab, var(--surface-2) 80%, transparent);
    border-bottom-color: rgba(255,255,255,0.07);
  }

  /* Karten: dunkle Flächen mit feiner heller Kante wie in der Vorlage */
  .card, .kpis {
    background: linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0) 42%), var(--surface);
    border-color: rgba(255,255,255,0.09);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,0.35);
  }
  .kpi { border-right-color: rgba(255,255,255,0.07); }
  @media (max-width: 860px) { .kpi:nth-child(-n+2) { border-bottom-color: rgba(255,255,255,0.07); } }

  /* Aurora: tiefvioletter Schein oben rechts, magenta Rest unten links */
  .aurora { opacity: 0.55; filter: blur(85px) saturate(1.15); }
  .aurora::before {
    left: auto; right: -6%; top: -22%;
    width: 760px; height: 760px;
    background: radial-gradient(circle at 62% 30%, oklch(0.44 0.21 292) 0%, transparent 62%);
  }
  .aurora::after {
    right: auto; left: -12%; top: 55%;
    width: 560px; height: 560px;
    background: radial-gradient(circle at 40% 60%, oklch(0.34 0.15 330) 0%, transparent 58%);
  }

  /* Hero: Mono-Kicker statt Pill, fette weiße Headline, Akzentzeile */
  .hero .eyebrow, .hero .eyebrow.pro-eyebrow {
    background: transparent; border: none; padding: 0;
    font-family: var(--mono); font-size: 11.5px; font-weight: 500;
    letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--accent);
  }
  .hero h1 { font-weight: 700; font-size: 46px; letter-spacing: -0.035em; color: #fff; }
  .hero h1 .accent-line { color: var(--accent); }
  @media (max-width: 640px) { .hero h1 { font-size: 36px; } }

  /* Mono-Ziffern & -Labels wie im Deck */
  .kpi .label { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.14em; }
  .kpi .value { font-family: var(--mono); font-weight: 600; letter-spacing: -0.01em; }
  .section-head h2 { color: #fff; }

  /* Heller Akzent-Button braucht dunkle Schrift */
  .btn.primary {
    color: oklch(0.17 0.04 290);
    box-shadow: 0 1px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 14px oklch(0.74 0.14 290 / 0.30);
  }
  .btn.ghost { background: var(--surface-3); border-color: rgba(255,255,255,0.12); }
  .btn.ghost:hover { background: oklch(0.30 0.03 290); }

  /* Chips: helle Schrift auf dunklen Washes */
  .chip { background: var(--surface-3); color: var(--ink-2); border-color: rgba(255,255,255,0.10); }
  .chip.ok { color: oklch(0.82 0.10 150); border-color: oklch(0.40 0.07 150); }
  .chip.warn { color: oklch(0.84 0.10 70); border-color: oklch(0.42 0.08 70); }
  .chip.bad { color: oklch(0.80 0.11 25); border-color: oklch(0.42 0.09 25); }
  .chip.accent { color: var(--accent-ink); border-color: var(--accent-line); }

  /* Premium-Signale für den Pro-Bereich */
  .pro-kpis { position: relative; }
  .pro-kpis::before {
    content: "";
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--accent), oklch(0.70 0.16 calc(var(--hue) + 50)), transparent 85%);
    z-index: 1;
  }
  .pro-kpis .kpi:first-child {
    background: linear-gradient(180deg, oklch(0.28 0.07 290 / 0.60), transparent 80%);
  }
  .kpi .value.grad {
    background: linear-gradient(115deg, #fff, var(--accent));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  /* Upsell: Pro als greifbares Produkt */
  .pro-medal {
    width: 56px; height: 56px; border-radius: 50%;
    margin: 0 auto 16px;
    display: grid; place-items: center;
    color: white;
    background: radial-gradient(circle at 32% 28%,
      oklch(0.78 0.14 var(--hue)),
      oklch(0.56 0.22 var(--hue)) 58%,
      oklch(0.42 0.20 var(--hue)));
    border: 2px solid oklch(0.88 0.06 var(--hue));
    box-shadow:
      0 6px 20px oklch(0.52 0.20 var(--hue) / 0.45),
      inset 0 1px 2px rgba(255,255,255,0.5),
      inset 0 -3px 6px oklch(0.38 0.18 var(--hue) / 0.45);
    animation: proMedalGlow 3s ease-in-out infinite;
  }
  @keyframes proMedalGlow {
    0%, 100% { box-shadow: 0 6px 20px oklch(0.52 0.20 var(--hue) / 0.35), inset 0 1px 2px rgba(255,255,255,0.5), inset 0 -3px 6px oklch(0.38 0.18 var(--hue) / 0.45); }
    50%      { box-shadow: 0 6px 30px oklch(0.52 0.20 var(--hue) / 0.60), inset 0 1px 2px rgba(255,255,255,0.5), inset 0 -3px 6px oklch(0.38 0.18 var(--hue) / 0.45); }
  }
  .pro-features {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    max-width: 560px; margin: 22px auto 0;
    text-align: left;
  }
  @media (max-width: 560px) { .pro-features { grid-template-columns: 1fr; } }
  .pro-feature {
    display: flex; gap: 11px; align-items: flex-start;
    padding: 13px 14px;
    border: 1px solid var(--accent-line);
    border-radius: var(--radius);
    background: var(--accent-wash);
  }
  .pro-feature .ic {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    display: grid; place-items: center;
    background: var(--surface); color: var(--accent);
    border: 1px solid var(--accent-line);
  }
  .pro-feature b { display: block; font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
  .pro-feature span { font-size: 12px; color: var(--ink-3); line-height: 1.5; margin-top: 2px; display: block; }
  @media (prefers-reduced-motion: reduce) { .pro-medal { animation: none; } }
`;

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
  const [proPrice, setProPrice] = useState<{ unitAmount: number; currency: string; interval: string | null } | null>(null);

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
    async function loadPrice(): Promise<void> {
      const res = await fetch('/api/organizer/billing/price');
      if (!res.ok) return;
      const data = (await res.json()) as { available: boolean; unitAmount?: number; currency?: string; interval?: string | null };
      if (data.available && data.unitAmount != null && data.currency) {
        setProPrice({ unitAmount: data.unitAmount, currency: data.currency, interval: data.interval ?? null });
      }
    }
    void loadPrice();
  }, []);

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
  const totalRevenue = analytics?.events.reduce((sum, e) => sum + e.revenueCents, 0) ?? 0;
  const sparkData = analytics?.salesByDay.map((d) => d.sold) ?? [];

  return (
    <div className="app">
      <style>{PAGE_CSS}</style>
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} variant="on-accent" />
          <div className="nav">
            <Link href="/dashboard">Übersicht</Link>
            <Link href="/dashboard/payouts">Auszahlungen</Link>
            <Link href="/dashboard/analytics" className="active">Pro</Link>
            <Link href="/events">Events</Link>
            <Link href="/my-tickets">Meine Tickets</Link>
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
            <div className={`eyebrow${plan === 'pro' ? ' pro-eyebrow' : ''}`}><span className="pulse" /> Passly Pro</div>
            <h1>Deine Gäste, <br /><span className="accent-line">richtig verstanden.</span></h1>
            <p className="lead">
              Analytics über alle Events, Stammkunden auf einen Blick und dein eigenes Treueprogramm.
            </p>
          </div>

          {plan === 'free' && (
            <section>
              <div className="card pro-outline" style={{ padding: '34px 28px 30px', textAlign: 'center' }}>
                <div className="pro-medal">
                  <Icon name="sparkle" size={22} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em' }}>Schalte Passly Pro frei</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.6, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                  Deine Gäste kommen wieder — Pro zeigt dir, wer sie sind, und gibt dir
                  die Werkzeuge, sie zu halten.
                </div>
                <div className="pro-features">
                  <div className="pro-feature">
                    <div className="ic"><Icon name="euro" size={14} /></div>
                    <div>
                      <b>Alle Events im Blick</b>
                      <span>Umsatz, Einlösequote und Verkaufstrends über dein gesamtes Programm.</span>
                    </div>
                  </div>
                  <div className="pro-feature">
                    <div className="ic"><Icon name="users" size={14} /></div>
                    <div>
                      <b>Stammkunden erkennen</b>
                      <span>Top-Kunden mit Kontakt und Wiederkehrer-Anteil auf einen Blick.</span>
                    </div>
                  </div>
                  <div className="pro-feature">
                    <div className="ic"><Icon name="mail" size={14} /></div>
                    <div>
                      <b>Gäste erreichen</b>
                      <span>Nachrichten an alle Ticketinhaber eines Events — direkt aus dem Dashboard.</span>
                    </div>
                  </div>
                  <div className="pro-feature">
                    <div className="ic"><Icon name="sparkle" size={14} /></div>
                    <div>
                      <b>Treue belohnen</b>
                      <span>Dein eigenes Treueprogramm mit Vorteilen für Gäste, die immer wieder kommen.</span>
                    </div>
                  </div>
                </div>
                {proPrice && (
                  <div style={{ marginTop: 22, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>
                    {(proPrice.unitAmount / 100).toLocaleString('de-DE', { style: 'currency', currency: proPrice.currency.toUpperCase() })}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}> / {proPrice.interval === 'year' ? 'Jahr' : 'Monat'}</span>
                  </div>
                )}
                {billingError && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 14 }}>{billingError}</div>}
                <button className="btn primary lg btn-shine" style={{ marginTop: proPrice ? 16 : 24 }} onClick={() => void handleUpgrade()} disabled={billingBusy}>
                  {billingBusy ? 'Weiterleitung …' : 'Jetzt Pro werden'} <Icon name="arrow" size={14} />
                </button>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 12 }}>
                  Monatlich · jederzeit kündbar · sichere Abrechnung über Stripe
                </div>
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
                <div className="kpis pro-kpis">
                  <div className="kpi">
                    <div className="label">Ausgezahlter Umsatz</div>
                    <div className="value grad">{eur(totalRevenue)}</div>
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
                    <h2>Conversion-Funnel</h2>
                    <div className="sub">Vom Shop-Besuch zum Kauf · nur Besucher mit Cookie-Einwilligung</div>
                  </div>
                </div>
                <div className="card" style={{ padding: 22 }}>
                  {(() => {
                    const funnel = analytics?.funnel ?? { views: 0, checkouts: 0, purchases: 0 };
                    const base = Math.max(funnel.views, funnel.checkouts, funnel.purchases);
                    const stages = [
                      { label: 'Shop besucht', value: funnel.views },
                      { label: 'Checkout gestartet', value: funnel.checkouts },
                      { label: 'Kauf abgeschlossen', value: funnel.purchases },
                    ];
                    if (base === 0) {
                      return (
                        <div className="empty">
                          Noch keine Daten — der Funnel füllt sich, sobald Besucher mit
                          Cookie-Einwilligung deine Shop-Seiten öffnen.
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'grid', gap: 14 }}>
                        {stages.map((s, i) => {
                          const pct = Math.round((s.value / base) * 100);
                          const conv = i > 0 && stages[i - 1].value > 0
                            ? Math.round((s.value / stages[i - 1].value) * 100)
                            : null;
                          return (
                            <div key={s.label}>
                              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                <span style={{ fontWeight: 500 }}>{s.label}</span>
                                <span style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                                  {s.value}{conv !== null ? ` · ${conv} % vom vorherigen Schritt` : ' Besucher'}
                                </span>
                              </div>
                              <div className="progress"><span style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
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
