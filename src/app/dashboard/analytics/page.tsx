'use client';

import { useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccountMenu } from '@/app/components/AccountMenu';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon, Spark } from '@/app/components/passlyUi';
import { CampaignDrawer, TierDrawer, tierDraftFrom, type TierDraft } from './ProDrawers';
import { TrendChart } from './TrendChart';
import { PRO_CSS } from './proTheme';
import {
  dayLabel, deltaPoints, downloadCsv, eur, eurExact, nf, pct,
  relativeDays, relativeTime, shortDate, shortWallet, signedPct,
} from './proFormat';
import type {
  AnalyticsData, CustomerRow, CustomersData, LoyaltyData, LoyaltyTier, SegmentId,
} from './proTypes';

type Tab = 'overview' | 'customers' | 'loyalty';
type Metric = 'revenue' | 'tickets' | 'buyers';

const RANGES: { value: number; label: string }[] = [
  { value: 7, label: '7 Tage' },
  { value: 30, label: '30 Tage' },
  { value: 90, label: '90 Tage' },
  { value: 365, label: 'Jahr' },
];

const METRICS: { value: Metric; label: string }[] = [
  { value: 'revenue', label: 'Umsatz' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'buyers', label: 'Käufer' },
];

const SEGMENT_ICON: Record<SegmentId, { glyph: string; tone: 'ok' | 'warn' | 'accent'; desc: string }> = {
  stamm: { glyph: '★', tone: 'ok', desc: '3+ Events besucht' },
  risk: { glyph: '!', tone: 'warn', desc: '60+ Tage kein Kauf' },
  neu: { glyph: '+', tone: 'accent', desc: 'Erstkauf in 30 Tagen' },
  vip: { glyph: '♛', tone: 'accent', desc: 'über 500 € Lifetime' },
};

export default function ProDashboard() {
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

  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState(30);
  const [compare, setCompare] = useState(true);
  const [metric, setMetric] = useState<Metric>('revenue');

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [customers, setCustomers] = useState<CustomersData | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [drawer, setDrawer] = useState<'tier' | 'campaign' | null>(null);
  const [tierDraft, setTierDraft] = useState<TierDraft | null>(null);
  const [tierSaving, setTierSaving] = useState(false);
  const [tierError, setTierError] = useState<string | null>(null);
  const [campaignSegment, setCampaignSegment] = useState<SegmentId | 'alle'>('alle');
  const [toast, setToast] = useState<string | null>(null);

  const token = useCallback(() => getAccessToken(), [getAccessToken]);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!wallet) return;
    async function check(): Promise<void> {
      const res = await fetch(`/api/organizers/status?walletAddress=${wallet}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      if (!res.ok) { setOrgStatus('none'); return; }
      const data = (await res.json()) as { status: string; plan?: string };
      setOrgStatus(data.status === 'approved' ? 'approved' : 'none');
      setPlan(data.plan === 'pro' ? 'pro' : 'free');
    }
    void check();
  }, [wallet, token]);

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

  const reloadLoyalty = useCallback(async (): Promise<void> => {
    if (!wallet) return;
    const t = await token();
    if (!t) return;
    const res = await fetch(`/api/organizer/loyalty?walletAddress=${wallet}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.ok) setLoyalty((await res.json()) as LoyaltyData);
  }, [wallet, token]);

  useEffect(() => {
    if (!wallet || plan !== 'pro') return;
    let cancelled = false;
    async function load(): Promise<void> {
      const t = await token();
      if (!t) return;
      const headers = { Authorization: `Bearer ${t}` };
      const [aRes, cRes, lRes] = await Promise.all([
        fetch(`/api/organizer/analytics?walletAddress=${wallet}&range=${range}`, { headers }),
        fetch(`/api/organizer/customers?walletAddress=${wallet}`, { headers }),
        fetch(`/api/organizer/loyalty?walletAddress=${wallet}`, { headers }),
      ]);
      if (cancelled) return;
      if (aRes.ok) setAnalytics((await aRes.json()) as AnalyticsData);
      if (cRes.ok) setCustomers((await cRes.json()) as CustomersData);
      if (lRes.ok) setLoyalty((await lRes.json()) as LoyaltyData);
      setLoadedAt(new Date().toISOString());
    }
    void load();
    return () => { cancelled = true; };
  }, [wallet, plan, range, token]);

  // Keeps the "aktualisiert vor …" label honest without re-fetching.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  async function handleUpgrade(): Promise<void> {
    if (!wallet || billingBusy) return;
    setBillingError(null);
    const t = await token();
    if (!t) return;
    setBillingBusy(true);
    try {
      const res = await fetch('/api/organizer/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ walletAddress: wallet }),
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) window.location.href = data.url;
      else setBillingError(data.error ?? 'Upgrade konnte nicht gestartet werden.');
    } finally {
      setBillingBusy(false);
    }
  }

  async function saveTier(): Promise<void> {
    if (!wallet || !tierDraft) return;
    setTierSaving(true);
    setTierError(null);
    try {
      const t = await token();
      if (!t) return;
      const res = await fetch('/api/organizer/loyalty', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ walletAddress: wallet, ...tierDraft }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!data.success) { setTierError(data.error ?? 'Speichern fehlgeschlagen.'); return; }
      setDrawer(null);
      setTierDraft(null);
      await reloadLoyalty();
    } finally {
      setTierSaving(false);
    }
  }

  async function deleteTier(): Promise<void> {
    if (!wallet || !tierDraft?.id) return;
    setTierSaving(true);
    setTierError(null);
    try {
      const t = await token();
      if (!t) return;
      const res = await fetch(`/api/organizer/loyalty?walletAddress=${wallet}&id=${tierDraft.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!data.success) { setTierError(data.error ?? 'Löschen fehlgeschlagen.'); return; }
      setDrawer(null);
      setTierDraft(null);
      await reloadLoyalty();
    } finally {
      setTierSaving(false);
    }
  }

  if (!ready || orgStatus === 'loading') return null;

  const email = user?.email?.address ?? '';
  const tierCount = loyalty?.tiers.length ?? 0;

  const segmentOptions: { id: SegmentId | 'alle'; label: string; count: number }[] = [
    { id: 'alle', label: 'Alle Kunden', count: customers?.total ?? 0 },
    ...(customers?.segments ?? []).map((s) => ({ id: s.id, label: s.label, count: s.count })),
  ];

  return (
    <div className="app">
      <style>{PRO_CSS}</style>
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
        <div className="container">

          <div className="pro-head">
            <div className="hero">
              <div className="eyebrow"><span className="pulse" /> Passly Pro</div>
              <h1>Deine Gäste, <br /><span className="accent-line">richtig verstanden.</span></h1>
              <p className="lead">
                Analytics über alle Events, Kohorten deiner Stammgäste, Verkaufsprognosen
                und dein eigenes Treueprogramm — alles an einem Ort.
              </p>
            </div>
            {plan === 'pro' && (
              <div className="range-col">
                <div className="pill-group" role="group" aria-label="Zeitraum">
                  {RANGES.map((r) => (
                    <button key={r.value} type="button" className="pill" aria-pressed={range === r.value}
                            onClick={() => setRange(r.value)}>
                      {r.label}
                    </button>
                  ))}
                </div>
                <label className="compare-toggle">
                  <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                  Vergleich mit Vorperiode
                </label>
              </div>
            )}
          </div>

          {plan === 'free' && (
            <section style={{ marginTop: 34 }}>
              <div className="card" style={{ padding: '34px 28px 30px', textAlign: 'center' }}>
                <div className="pro-medal"><Icon name="sparkle" size={22} /></div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em' }}>Schalte Passly Pro frei</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.6, maxWidth: 460, margin: '8px auto 0' }}>
                  Deine Gäste kommen wieder. Pro zeigt dir, wer sie sind, und gibt dir die Werkzeuge, sie zu halten.
                </div>
                <div className="pro-features">
                  <div className="pro-feature">
                    <div className="ic"><Icon name="euro" size={14} /></div>
                    <div><b>Alle Events im Blick</b><span>Umsatz, Auslastung und Verkaufsprognose über dein gesamtes Programm.</span></div>
                  </div>
                  <div className="pro-feature">
                    <div className="ic"><Icon name="users" size={14} /></div>
                    <div><b>Kunden verstehen</b><span>Segmente, Kohorten-Retention und Lifetime-Umsatz pro Gast.</span></div>
                  </div>
                  <div className="pro-feature">
                    <div className="ic"><Icon name="mail" size={14} /></div>
                    <div><b>Gäste erreichen</b><span>Kampagnen an ganze Segmente, direkt aus dem Dashboard.</span></div>
                  </div>
                  <div className="pro-feature">
                    <div className="ic"><Icon name="sparkle" size={14} /></div>
                    <div><b>Treue belohnen</b><span>Mehrstufiges Treueprogramm mit Vorteilen zum Einlösen am Einlass.</span></div>
                  </div>
                </div>
                {proPrice && (
                  <div style={{ marginTop: 22, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>
                    {(proPrice.unitAmount / 100).toLocaleString('de-DE', { style: 'currency', currency: proPrice.currency.toUpperCase() })}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}> / {proPrice.interval === 'year' ? 'Jahr' : 'Monat'}</span>
                  </div>
                )}
                {billingError && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 14 }}>{billingError}</div>}
                <button className="btn primary lg btn-shine" style={{ marginTop: proPrice ? 16 : 24 }}
                        onClick={() => void handleUpgrade()} disabled={billingBusy}>
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
              <div className="pro-tabs" role="tablist" aria-label="Pro-Bereiche">
                <button role="tab" className="pro-tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>
                  Übersicht
                </button>
                <button role="tab" className="pro-tab" aria-selected={tab === 'customers'} onClick={() => setTab('customers')}>
                  Kunden{customers && <span className="count">{nf.format(customers.total)}</span>}
                </button>
                <button role="tab" className="pro-tab" aria-selected={tab === 'loyalty'} onClick={() => setTab('loyalty')}>
                  Treueprogramm{tierCount > 0 && <span className="count">{tierCount} {tierCount === 1 ? 'Stufe' : 'Stufen'}</span>}
                </button>
                {loadedAt && (
                  // `now` ticks every 30 s so the relative label stays current.
                  <div className="live-dot" key={now}><i />Live · aktualisiert {relativeTime(loadedAt)}</div>
                )}
              </div>

              {tab === 'overview' && (
                <OverviewTab
                  data={analytics} compare={compare} metric={metric} onMetric={setMetric} range={range}
                />
              )}
              {tab === 'customers' && (
                <CustomersTab
                  data={customers}
                  onCampaign={(segment) => { setCampaignSegment(segment); setDrawer('campaign'); }}
                />
              )}
              {tab === 'loyalty' && (
                <LoyaltyTab
                  data={loyalty}
                  walletAddress={wallet ?? ''}
                  getToken={token}
                  onEdit={(tier) => {
                    setTierError(null);
                    setTierDraft(tierDraftFrom(tier, (loyalty?.tiers.at(-1)?.threshold ?? 1) + 2));
                    setDrawer('tier');
                  }}
                  onRedeemed={() => void reloadLoyalty()}
                />
              )}
            </>
          )}

          <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />
        </div>
      </div>

      {drawer === 'tier' && tierDraft && (
        <TierDrawer
          draft={tierDraft}
          saving={tierSaving}
          error={tierError}
          canDelete={(loyalty?.tiers.find((t) => t.id === tierDraft.id)?.claimed ?? 0) === 0}
          onChange={setTierDraft}
          onClose={() => { setDrawer(null); setTierDraft(null); }}
          onSave={() => void saveTier()}
          onDelete={() => void deleteTier()}
        />
      )}

      {drawer === 'campaign' && wallet && (
        <CampaignDrawer
          walletAddress={wallet}
          segments={segmentOptions}
          initialSegment={campaignSegment}
          getToken={token}
          onClose={() => setDrawer(null)}
          onSent={(count) => {
            setDrawer(null);
            setToast(`Kampagne an ${nf.format(count)} ${count === 1 ? 'Gast' : 'Gäste'} gesendet.`);
          }}
        />
      )}

      {toast && (
        <div className="chip ok" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, padding: '10px 16px' }}>
          <span className="d" />{toast}
        </div>
      )}
    </div>
  );
}

/* ── Übersicht ───────────────────────────────────────────────────────────── */

function OverviewTab({
  data, compare, metric, onMetric, range,
}: {
  data: AnalyticsData | null;
  compare: boolean;
  metric: Metric;
  onMetric: (m: Metric) => void;
  range: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'revenueCents', dir: -1 });

  const sortedEvents = useMemo(() => {
    const rows = [...(data?.events ?? [])];
    const value = (e: (typeof rows)[number]): string | number => {
      switch (sort.key) {
        case 'name': return e.name;
        case 'date': return e.date;
        case 'sold': return e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
        case 'avgPriceCents': return e.avgPriceCents;
        case 'redemptionPct': return e.redemptionPct ?? -1;
        default: return e.revenueCents;
      }
    };
    return rows.sort((a, b) => {
      const av = value(a); const bv = value(b);
      if (typeof av === 'string' && typeof bv === 'string') return sort.dir * av.localeCompare(bv, 'de');
      return av < bv ? -sort.dir : av > bv ? sort.dir : 0;
    });
  }, [data?.events, sort]);

  if (!data) return <div className="tab-panel"><div className="card" style={{ padding: 28 }}><div className="empty">Lade Auswertung …</div></div></div>;

  const k = data.kpis;
  const series = metric === 'revenue'
    ? { current: data.series.revenue, previous: data.series.revenuePrev, format: eur }
    : metric === 'tickets'
      ? { current: data.series.tickets, previous: data.series.ticketsPrev, format: (v: number) => nf.format(v) }
      : { current: data.series.buyers, previous: data.series.buyersPrev, format: (v: number) => nf.format(v) };

  const kpis = [
    {
      label: 'Umsatz (Auszahlung)', value: eur(k.revenueCents), delta: signedPct(k.revenueDelta),
      positive: (k.revenueDelta ?? 0) >= 0, sub: `vs. ${eur(k.revenuePrevCents)}`, spark: data.series.revenue,
    },
    {
      label: 'Tickets verkauft', value: nf.format(k.tickets), delta: signedPct(k.ticketsDelta),
      positive: (k.ticketsDelta ?? 0) >= 0, sub: `vs. ${nf.format(k.ticketsPrev)}`, spark: data.series.tickets,
    },
    {
      label: 'Ø Ticketpreis', value: eurExact(k.avgPriceCents),
      delta: signedPct(k.avgPricePrevCents > 0 ? ((k.avgPriceCents - k.avgPricePrevCents) / k.avgPricePrevCents) * 100 : null),
      positive: k.avgPriceCents >= k.avgPricePrevCents, sub: `vs. ${eurExact(k.avgPricePrevCents)}`, spark: null,
    },
    {
      label: 'Wiederkehrer', value: pct(k.repeatShare), delta: signedPct(deltaPoints(k.repeatShare, k.repeatSharePrev), 'pp'),
      positive: k.repeatShare >= k.repeatSharePrev, sub: `${nf.format(k.customers)} Gäste`, spark: null,
    },
    {
      label: 'Conversion', value: pct(k.conversion), delta: signedPct(deltaPoints(k.conversion, k.conversionPrev), 'pp'),
      positive: k.conversion >= k.conversionPrev, sub: `${nf.format(k.views)} Besuche`, spark: data.series.buyers,
    },
  ];

  const funnelBase = data.funnel[0]?.count ?? 0;
  const biggestDrop = data.funnel.reduce<{ index: number; loss: number }>((worst, stage, i) => {
    if (i === 0) return worst;
    const before = data.funnel[i - 1].count;
    const loss = before > 0 ? (before - stage.count) / before : 0;
    return loss > worst.loss ? { index: i, loss } : worst;
  }, { index: -1, loss: 0 });

  const topChannel = data.channels[0] ?? null;
  const bestConverting = [...data.channels].sort((a, b) => b.conversionPct - a.conversionPct)[0] ?? null;

  return (
    <div className="tab-panel">
      <div className="card kpi-strip">
        <div className="accent-rule" />
        <div className="kpi-grid">
          {kpis.map((kpi) => (
            <div className="kpi-cell" key={kpi.label}>
              <div className="top">
                <div className="label">{kpi.label}</div>
                {kpi.spark && kpi.spark.length > 1 && (
                  <Spark data={kpi.spark} color={kpi.positive ? 'var(--accent)' : 'var(--bad)'} width={66} height={24} />
                )}
              </div>
              <div className="value">{kpi.value}</div>
              <div className="foot">
                {compare && kpi.delta && (
                  <span className={`delta ${kpi.positive ? 'pos' : 'neg'}`}>{kpi.delta}</span>
                )}
                <span className="sub">{kpi.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card panel">
        <div className="panel-head">
          <div>
            <h3>Entwicklung</h3>
            <p>
              {metric === 'revenue' ? 'Umsatz' : metric === 'tickets' ? 'Verkaufte Tickets' : 'Eindeutige Käufer'}
              {' · letzte '}{range}{' Tage'}
            </p>
          </div>
          <div className="pill-group sm" role="group" aria-label="Kennzahl">
            {METRICS.map((m) => (
              <button key={m.value} type="button" className="pill" aria-pressed={metric === m.value}
                      onClick={() => onMetric(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '18px 24px 0' }}>
          <TrendChart days={data.series.days} current={series.current} previous={series.previous}
                      compare={compare} format={series.format} />
        </div>
        <div className="panel-foot">
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span className="legend-line" />Diese Periode</span>
          {compare && <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span className="legend-dash" />Vorperiode</span>}
          {data.bestDay && (
            <span style={{ marginLeft: 'auto', color: 'var(--ink-4)' }}>
              Bester Tag: <b style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{dayLabel(data.bestDay.date)} · {eur(data.bestDay.revenueCents)}</b>
            </span>
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h3>Conversion-Funnel</h3>
              <p>Vom Shop-Besuch zum Kauf · nur Besucher mit Cookie-Einwilligung</p>
            </div>
          </div>
          <div className="panel-body">
            {funnelBase === 0 ? (
              <div className="empty">
                Noch keine Daten. Der Funnel füllt sich, sobald Besucher mit Cookie-Einwilligung deine Shop-Seiten öffnen.
              </div>
            ) : data.funnel.map((stage, i) => {
              const stepPct = i > 0 && data.funnel[i - 1].count > 0
                ? Math.round((stage.count / data.funnel[i - 1].count) * 100)
                : null;
              return (
                <div className="funnel-row" key={stage.key}>
                  <div className="head">
                    <span className="name">{stage.label}</span>
                    <span className="meta">
                      {nf.format(stage.count)}{stepPct != null ? ` · ${stepPct} % vom vorherigen Schritt` : ' Besucher'}
                    </span>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: `${Math.max((stage.count / funnelBase) * 100, 1.5)}%` }} />
                  </div>
                  {biggestDrop.index === i && biggestDrop.loss > 0.3 && (
                    <div className="note">Größter Absprung — {Math.round(biggestDrop.loss * 100)} % springen hier ab</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <div>
              <h3>Woher deine Käufer kommen</h3>
              <p>Attribution nach erster Quelle im gewählten Zeitraum</p>
            </div>
          </div>
          <div className="panel-body" style={{ paddingTop: 8 }}>
            {data.channels.length === 0 ? (
              <div className="empty">Noch keine Herkunftsdaten für diesen Zeitraum.</div>
            ) : (
              <>
                {data.channels.map((c) => (
                  <div className="channel-row" key={c.name}>
                    <span className="name">{c.name}</span>
                    <div className="bar-track" style={{ height: 7 }}>
                      <span style={{ width: `${Math.max(c.sharePct, 2)}%`, opacity: 0.45 + (c.sharePct / 100) * 0.55 }} />
                    </div>
                    <span className="num">{eur(c.revenueCents)}</span>
                    <span className="num cr" style={{
                      color: c.conversionPct > 8 ? 'var(--ok)' : c.conversionPct < 3.5 ? 'var(--bad)' : 'var(--ink-3)',
                    }}>
                      {pct(c.conversionPct)}
                    </span>
                  </div>
                ))}
                {topChannel && bestConverting && (
                  <div className="insight">
                    <Icon name="sparkle" size={15} />
                    <span>
                      Die meisten Käufe kommen über <b>{topChannel.name}</b>.
                      {bestConverting.name !== topChannel.name && (
                        <> Am besten konvertiert aber <b>{bestConverting.name}</b> mit {pct(bestConverting.conversionPct)} — da lohnt mehr Budget.</>
                      )}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="two-col narrow-right">
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h3>Verkaufsprognose</h3>
              <p>Hochrechnung bis Eventstart, basierend auf deinem Verkaufstempo der letzten 14 Tage</p>
            </div>
          </div>
          <div className="panel-body" style={{ paddingTop: 6 }}>
            {data.forecasts.length === 0 ? (
              <div className="empty">Keine bevorstehenden Events.</div>
            ) : data.forecasts.map((f) => (
              <div className="forecast-row" key={f.id}>
                <div className="top">
                  <div>
                    <div className="name">{f.name}</div>
                    <div className="when">{shortDate(f.date)} · noch {f.daysLeft} {f.daysLeft === 1 ? 'Tag' : 'Tage'}</div>
                  </div>
                  <span className={`chip ${f.kind === 'ok' ? 'ok' : f.kind === 'warn' ? 'warn' : ''}`}>
                    <span className="d" />
                    {f.sellOutDate ? `Ausverkauft am ${dayLabel(f.sellOutDate)}` : `Prognose ${f.forecastPct} %`}
                  </span>
                </div>
                <div className="forecast-bar">
                  <div className="projected" style={{ width: `${f.forecastPct}%` }} />
                  <div className="sold" style={{ width: `${f.capacity > 0 ? (f.sold / f.capacity) * 100 : 0}%` }} />
                </div>
                <div className="foot">
                  <span><b>{nf.format(f.sold)}</b> verkauft von {nf.format(f.capacity)}</span>
                  <span>
                    {f.kind === 'neutral' && f.pacePerDay === 0
                      ? 'Aktuell keine Verkäufe'
                      : `Tempo ${nf.format(f.pacePerDay)} Tickets / Tag`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-head">
            <div>
              <h3>Benchmark</h3>
              <p>
                {data.benchmark
                  ? `Gegen ${nf.format(data.benchmark.comparableEvents)} vergleichbare Events auf Passly`
                  : 'Vergleich mit anderen Events auf Passly'}
              </p>
            </div>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
            {!data.benchmark || data.benchmark.percentile == null ? (
              <div className="empty">Noch zu wenig Vergleichsdaten auf der Plattform.</div>
            ) : (
              <>
                <div className="benchmark-score">
                  <div className="big">Top {Math.max(100 - data.benchmark.percentile, 1)} %</div>
                  <p>Du verkaufst besser als {data.benchmark.percentile} % der Veranstalter auf Passly.</p>
                </div>
                <div className="benchmark-rail"><i style={{ left: `${data.benchmark.percentile}%` }} /></div>
                <div>
                  {data.benchmark.rows.map((row) => {
                    const delta = row.market > 0 ? Math.round(((row.you - row.market) / row.market) * 100) : null;
                    const format = (v: number) => (row.unit === 'eur' ? eurExact(v) : pct(v));
                    return (
                      <div className="benchmark-row" key={row.label}>
                        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{row.label}</span>
                        <span className="vals">
                          <b className="you">{format(row.you)}</b>
                          <span className="market">ø {format(row.market)}</span>
                          {delta != null && (
                            <span className={`delta ${delta >= 0 ? 'pos' : 'neg'}`}>{signedPct(delta)}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card panel" style={{ overflow: 'hidden' }}>
        <div className="panel-head">
          <div>
            <h3>Events im Vergleich</h3>
            <p>Klick auf eine Spalte zum Sortieren</p>
          </div>
          <button className="btn ghost sm" onClick={() => downloadCsv('passly-events.csv', [
            ['Event', 'Datum', 'Verkauft', 'Kapazität', 'Umsatz (EUR)', 'Ø Preis (EUR)', 'Einlösequote (%)'],
            ...sortedEvents.map((e) => [
              e.name, e.date, e.ticketsSold, e.capacity,
              (e.revenueCents / 100).toFixed(2).replace('.', ','),
              (e.avgPriceCents / 100).toFixed(2).replace('.', ','),
              e.redemptionPct ?? '',
            ]),
          ])}>
            <Icon name="download" size={14} />CSV
          </button>
        </div>
        {sortedEvents.length === 0 ? (
          <div className="empty" style={{ padding: 28 }}>Noch keine Events.</div>
        ) : (
          <div className="table-scroll">
            <table className="ticket-table">
              <thead>
                <tr>
                  <SortTh label="Event" col="name" sort={sort} onSort={setSort} />
                  <SortTh label="Datum" col="date" sort={sort} onSort={setSort} />
                  <SortTh label="Verkauft" col="sold" sort={sort} onSort={setSort} />
                  <SortTh label="Umsatz" col="revenueCents" sort={sort} onSort={setSort} right />
                  <SortTh label="Ø Preis" col="avgPriceCents" sort={sort} onSort={setSort} right />
                  <SortTh label="Einlösequote" col="redemptionPct" sort={sort} onSort={setSort} right />
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 520 }}>
                      <Link href={`/dashboard/events/${e.id}`} style={{ color: 'var(--ink)' }}>{e.name}</Link>
                      {e.cancelled && <span className="chip" style={{ marginLeft: 8 }}>Abgesagt</span>}
                    </td>
                    <td style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{shortDate(e.date)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="mini-bar">
                          <span style={{
                            width: `${e.capacity > 0 ? Math.min((e.ticketsSold / e.capacity) * 100, 100) : 0}%`,
                            background: e.capacity > 0 && e.ticketsSold / e.capacity > 0.9 ? 'var(--ok)' : 'var(--accent)',
                          }} />
                        </div>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                          {nf.format(e.ticketsSold)} / {nf.format(e.capacity)}
                        </span>
                      </div>
                    </td>
                    <td className="right" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 560 }}>{eur(e.revenueCents)}</td>
                    <td className="right" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>{eurExact(e.avgPriceCents)}</td>
                    <td className="right">
                      {e.redemptionPct == null ? (
                        <span style={{ color: 'var(--ink-4)', fontSize: 12.5 }}>—</span>
                      ) : (
                        <span className={`delta ${e.redemptionPct >= 90 ? 'pos' : e.redemptionPct >= 70 ? '' : 'neg'}`}>
                          {e.redemptionPct} %
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Kunden ──────────────────────────────────────────────────────────────── */

function CustomersTab({
  data, onCampaign,
}: {
  data: CustomersData | null;
  onCampaign: (segment: SegmentId | 'alle') => void;
}) {
  const [segment, setSegment] = useState<SegmentId | 'alle'>('alle');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'spendCents', dir: -1 });

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    const inSeg = (c: CustomerRow): boolean => {
      switch (segment) {
        case 'stamm': return c.events >= data.rules.stammMinEvents;
        case 'risk': return c.events >= 2 && c.daysSinceLast >= data.rules.riskDays;
        case 'neu': return c.daysSinceFirst <= data.rules.neuDays;
        case 'vip': return c.spendCents >= data.rules.vipSpendCents;
        default: return true;
      }
    };
    const value = (c: CustomerRow): string | number => {
      switch (sort.key) {
        case 'email': return c.email ?? c.wallet;
        case 'tickets': return c.tickets;
        case 'events': return c.events;
        case 'daysSinceLast': return -c.daysSinceLast;
        case 'tier': return c.tier ?? '';
        default: return c.spendCents;
      }
    };
    return data.customers
      .filter(inSeg)
      .filter((c) => !needle || (c.email ?? '').toLowerCase().includes(needle) || c.wallet.toLowerCase().includes(needle))
      .sort((a, b) => {
        const av = value(a); const bv = value(b);
        if (typeof av === 'string' && typeof bv === 'string') return sort.dir * av.localeCompare(bv, 'de');
        return av < bv ? -sort.dir : av > bv ? sort.dir : 0;
      });
  }, [data, segment, query, sort]);

  if (!data) return <div className="tab-panel"><div className="card" style={{ padding: 28 }}><div className="empty">Lade Kundendaten …</div></div></div>;

  const bestCohort = data.cohorts
    .map((c) => ({ label: c.label, value: c.cells[1] }))
    .filter((c): c is { label: string; value: number } => c.value != null && c.value > 0)
    .sort((a, b) => b.value - a.value)[0] ?? null;

  return (
    <div className="tab-panel">
      <div className="segment-grid">
        {data.segments.map((s) => {
          const meta = SEGMENT_ICON[s.id];
          const color = meta.tone === 'ok' ? 'var(--ok)' : meta.tone === 'warn' ? 'var(--warn)' : 'var(--accent)';
          const wash = meta.tone === 'ok' ? 'var(--ok-wash)' : meta.tone === 'warn' ? 'var(--warn-wash)' : 'var(--accent-wash)';
          return (
            <button key={s.id} type="button" className="segment-card" aria-pressed={segment === s.id}
                    onClick={() => setSegment((prev) => (prev === s.id ? 'alle' : s.id))}>
              <div className="top">
                <span className="ic" style={{ background: wash, color }}>{meta.glyph}</span>
                {s.newThisWeek > 0 && <span className="trend">+{s.newThisWeek} diese Woche</span>}
              </div>
              <div className="count">{nf.format(s.count)}</div>
              <div className="name">{s.label}</div>
              <div className="desc">{meta.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="card panel">
        <div className="panel-head">
          <div>
            <h3>Kohorten-Retention</h3>
            <p>Wie viel Prozent einer Monatskohorte später wieder kaufen</p>
          </div>
          <span className="chip"><span className="d" />Erstkauf-Monat</span>
        </div>
        <div className="panel-body" style={{ overflowX: 'auto' }}>
          <div className="cohort-grid" style={{ gridTemplateColumns: `130px repeat(${data.cohortWidth}, 1fr)` }}>
            <div />
            {Array.from({ length: data.cohortWidth }, (_, i) => (
              <div className="cohort-head" key={i}>{i === 0 ? 'Monat 0' : `+${i}`}</div>
            ))}
            {data.cohorts.map((row) => (
              <Cohort key={row.month} row={row} />
            ))}
          </div>
          {bestCohort && (
            <div className="insight">
              <Icon name="sparkle" size={15} />
              <span>
                Die {bestCohort.label}-Kohorte hält mit <b>{bestCohort.value} %</b> im Folgemonat am besten —
                schau dir an, welches Format diese Gäste gebracht hat.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="card panel" style={{ overflow: 'hidden' }}>
        <div className="panel-head">
          <div>
            <h3>Kunden</h3>
            <p>
              {segment === 'alle' ? `Alle ${nf.format(data.total)} Kunden` : `Segment ${data.segments.find((s) => s.id === segment)?.label}`}
              {' · '}{nf.format(data.reachable)} mit E-Mail erreichbar
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="E-Mail suchen…" value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   style={{ width: 200, padding: '7px 11px', fontSize: 12.5 }} />
            <button className="btn ghost sm" onClick={() => downloadCsv('passly-kunden.csv', [
              ['E-Mail', 'Konto', 'Tickets', 'Events', 'Eingelöst', 'Lifetime-Umsatz (EUR)', 'Letzter Kauf', 'Stufe'],
              ...rows.map((c) => [
                c.email ?? '', c.wallet, c.tickets, c.events, c.redeemedEvents,
                (c.spendCents / 100).toFixed(2).replace('.', ','),
                c.lastPurchase.slice(0, 10), c.tier ?? '',
              ]),
            ])}>
              <Icon name="download" size={14} />CSV
            </button>
            <button className="btn primary sm" onClick={() => onCampaign(segment)}>Kampagne senden</button>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="empty" style={{ padding: 28 }}>Keine Kunden in dieser Auswahl.</div>
        ) : (
          <div className="table-scroll">
            <table className="ticket-table">
              <thead>
                <tr>
                  <SortTh label="Kunde" col="email" sort={sort} onSort={setSort} />
                  <SortTh label="Tickets" col="tickets" sort={sort} onSort={setSort} right />
                  <SortTh label="Events" col="events" sort={sort} onSort={setSort} right />
                  <SortTh label="Lifetime-Umsatz" col="spendCents" sort={sort} onSort={setSort} right />
                  <SortTh label="Letzter Kauf" col="daysSinceLast" sort={sort} onSort={setSort} right />
                  <SortTh label="Stufe" col="tier" sort={sort} onSort={setSort} right />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.wallet}>
                    <td>
                      <div className="cust-cell">
                        <div className="cust-av">{(c.email ?? c.wallet).slice(0, 2).toUpperCase()}</div>
                        <div>
                          <div className="cust-mail">{c.email ?? shortWallet(c.wallet)}</div>
                          <div className="cust-id">{shortWallet(c.wallet)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="right" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.tickets}</td>
                    <td className="right" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.events}</td>
                    <td className="right" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 560 }}>{eur(c.spendCents)}</td>
                    <td className="right" style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{relativeDays(c.daysSinceLast)}</td>
                    <td className="right">
                      <span className={`tier-pill${c.tier ? '' : ' none'}`}>{c.tier ?? 'Gast'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Cohort({ row }: { row: CustomersData['cohorts'][number] }) {
  return (
    <>
      <div className="cohort-label">
        <b>{row.label}</b>
        <span>{nf.format(row.size)}</span>
      </div>
      {row.cells.map((cell, i) => (
        cell == null ? (
          <div className="cohort-cell empty-cell" key={i} />
        ) : (
          <div className="cohort-cell" key={i} style={{
            background: `oklch(${0.26 + (cell / 100) * 0.26} ${0.03 + (cell / 100) * 0.13} 285)`,
            color: cell > 55 ? 'oklch(0.16 0.03 285)' : 'var(--ink-2)',
          }}>
            {cell} %
          </div>
        )
      ))}
    </>
  );
}

/* ── Treueprogramm ───────────────────────────────────────────────────────── */

function LoyaltyTab({
  data, walletAddress, getToken, onEdit, onRedeemed,
}: {
  data: LoyaltyData | null;
  walletAddress: string;
  getToken: () => Promise<string | null>;
  onEdit: (tier: LoyaltyTier | null) => void;
  onRedeemed: () => void;
}) {
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function redeem(): Promise<void> {
    if (!code.trim() || redeeming) return;
    setResult(null);
    setRedeeming(true);
    try {
      const t = await getToken();
      if (!t) return;
      const res = await fetch('/api/organizer/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ walletAddress, code }),
      });
      const body = (await res.json()) as { success: boolean; benefitTitle?: string; error?: string };
      if (body.success) {
        setResult({ ok: true, text: `Vorteil eingelöst: ${body.benefitTitle ?? 'Vorteil'}` });
        setCode('');
        onRedeemed();
      } else if (body.error === 'already_redeemed') {
        setResult({ ok: false, text: 'Dieser Code wurde bereits eingelöst.' });
      } else if (body.error === 'unknown_code') {
        setResult({ ok: false, text: 'Unbekannter Code.' });
      } else {
        setResult({ ok: false, text: body.error ?? 'Einlösen fehlgeschlagen.' });
      }
    } finally {
      setRedeeming(false);
    }
  }

  if (!data) return <div className="tab-panel"><div className="card" style={{ padding: 28 }}><div className="empty">Lade Treueprogramm …</div></div></div>;

  const maxImpact = (row: LoyaltyData['impact']['rows'][number]) => Math.max(row.member, row.other, 1);
  const formatImpact = (row: LoyaltyData['impact']['rows'][number], value: number): string =>
    row.unit === 'eur' ? eur(value) : row.unit === 'pct' ? pct(value) : nf.format(value);

  return (
    <div className="tab-panel">
      <div className="tier-grid">
        {data.tiers.map((t) => (
          <div className={`tier-card${t.active ? '' : ' inactive'}`} key={t.id}>
            <div className="ribbon" />
            <div className="body">
              <div className="head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div className="tier-badge">{t.badge}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="tname">{t.name}</div>
                    <div className="tsub">ab {t.threshold} besuchten Events{t.active ? '' : ' · inaktiv'}</div>
                  </div>
                </div>
                <button className="btn subtle sm" style={{ color: 'var(--ink-3)' }} onClick={() => onEdit(t)}>
                  Bearbeiten
                </button>
              </div>
              <div className="tier-benefit">
                <div className="k">Vorteil</div>
                <div className="v">{t.benefitTitle}</div>
              </div>
              <div className="tier-stats">
                <div>
                  <div className="n">{nf.format(t.members)}</div>
                  <div className="k">Mitglieder</div>
                </div>
                <div>
                  <div className="n">{nf.format(t.claimed)}</div>
                  <div className="k">abgeholt</div>
                </div>
                <div>
                  <div className="n" style={{ color: 'var(--ok)' }}>{pct(t.redeemRate)}</div>
                  <div className="k">eingelöst</div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {data.tiers.length < data.maxTiers && (
          <button type="button" className="tier-add" onClick={() => onEdit(null)}>
            <Icon name="plus" size={20} />
            <span style={{ fontSize: 13.5, fontWeight: 550 }}>
              {data.tiers.length === 0 ? 'Erste Stufe anlegen' : 'Stufe hinzufügen'}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)', maxWidth: 220, textAlign: 'center', lineHeight: 1.45 }}>
              Bis zu {data.maxTiers} Stufen, z. B. Bronze / Silber / Gold
            </span>
          </button>
        )}
      </div>

      <div className="two-col">
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h3>Wirkt das Programm?</h3>
              <p>
                {nf.format(data.impact.memberCount)} Mitglieder gegen {nf.format(data.impact.otherCount)} andere Gäste
              </p>
            </div>
          </div>
          <div className="panel-body">
            {data.impact.memberCount === 0 ? (
              <div className="empty">Sobald die ersten Gäste eine Stufe erreichen, siehst du hier den Unterschied.</div>
            ) : data.impact.rows.map((row) => {
              const uplift = row.other > 0 ? Math.round(((row.member - row.other) / row.other) * 100) : null;
              return (
                <div className="impact-row" key={row.label}>
                  <div className="head">
                    <span className="name">{row.label}</span>
                    {uplift != null && (
                      <span className="uplift" style={{ color: uplift >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                        {signedPct(uplift)}
                      </span>
                    )}
                  </div>
                  <div className="impact-bar">
                    <span className="k">Mitglieder</span>
                    <div className="track"><span style={{ width: `${(row.member / maxImpact(row)) * 100}%` }} /></div>
                    <span className="v">{formatImpact(row, row.member)}</span>
                  </div>
                  <div className="impact-bar">
                    <span className="k" style={{ color: 'var(--ink-4)' }}>Andere</span>
                    <div className="track muted"><span style={{ width: `${(row.other / maxImpact(row)) * 100}%` }} /></div>
                    <span className="v" style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{formatImpact(row, row.other)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-head">
            <div>
              <h3>Vorteil einlösen</h3>
              <p>Am Einlass den Code vom Gast eingeben</p>
            </div>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input mono" placeholder="CODE, Z. B. A3K7QP" value={code} maxLength={6}
                     onChange={(e) => setCode(e.target.value.toUpperCase())}
                     onKeyDown={(e) => { if (e.key === 'Enter') void redeem(); }}
                     style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 14, padding: '12px 14px' }} />
              <button className="btn primary" style={{ flex: 'none' }}
                      onClick={() => void redeem()} disabled={redeeming || code.trim().length < 6}>
                {redeeming ? 'Prüfe …' : 'Einlösen'}
              </button>
            </div>
            {result && <div className={`redeem-msg ${result.ok ? 'ok' : 'bad'}`}>{result.text}</div>}

            <div className="subhead" style={{ marginTop: 2 }}>Zuletzt eingelöst</div>
            {data.redemptions.length === 0 ? (
              <div className="empty">Noch keine Vorteile eingelöst.</div>
            ) : (
              <div className="redeem-list">
                {data.redemptions.map((r) => (
                  <div className="redeem-item" key={r.code}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span className="dot" />
                      <div style={{ minWidth: 0 }}>
                        <div className="who">{r.email ?? shortWallet(r.wallet)}</div>
                        <div className="what">{r.tierName ? `${r.tierName} · ` : ''}{r.benefitTitle}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
                      {relativeTime(r.redeemedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sortierbarer Tabellenkopf ───────────────────────────────────────────── */

function SortTh({
  label, col, sort, onSort, right,
}: {
  label: string;
  col: string;
  sort: { key: string; dir: 1 | -1 };
  onSort: (next: { key: string; dir: 1 | -1 }) => void;
  right?: boolean;
}) {
  const active = sort.key === col;
  return (
    <th
      className={`sortable${right ? ' right' : ''}`}
      aria-sort={active ? (sort.dir < 0 ? 'descending' : 'ascending') : undefined}
      onClick={() => onSort({ key: col, dir: active ? (sort.dir === -1 ? 1 : -1) : -1 })}
    >
      {label}{active ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}
    </th>
  );
}
