'use client';

import { useCallback, useState } from 'react';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import type { Metric, EventLocation } from '@/app/api/admin/overview/route';
import { GlobeCard } from './GlobeCard';
import { OrganizersTab } from './OrganizersTab';
import { PayoutsTab } from './PayoutsTab';

type Tab = 'overview' | 'organizers' | 'payouts';

interface OverviewData {
  kpis: {
    ticketsSold: Metric;
    grossVolumeCents: Metric;
    platformFeeCents: Metric;
    netTransferredCents: Metric;
    totalUsers: Metric;
  };
  eventLocations: EventLocation[];
  windowDays: number;
}

const PAGE_CSS = `
  .table-scroll { overflow-x: auto; }
  .org-table { min-width: 900px; }
  .ticket-table { min-width: 960px; }
  .reason { font-size: 11.5px; color: var(--ink-3); line-height: 1.5; max-width: 260px; }
  .cell-sub { font-family: var(--mono); font-size: 10.5px; color: var(--ink-4); margin-top: 2px; word-break: break-all; }

  .admin-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--surface-3, #ece9f5); margin: 4px 0 24px; flex-wrap: wrap; }
  .admin-tab { appearance: none; background: none; border: none; cursor: pointer; padding: 10px 14px; font: inherit; font-size: 14px; font-weight: 500; color: var(--ink-3); border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .admin-tab:hover { color: var(--ink-1); }
  .admin-tab.active { color: var(--accent-ink); border-bottom-color: var(--accent); }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 28px; }
  .kpi { padding: 18px 18px 16px; }
  .kpi-label { font-size: 12.5px; color: var(--ink-3); font-weight: 500; }
  .kpi-value { font-size: 30px; font-weight: 650; letter-spacing: -0.02em; margin-top: 6px; font-variant-numeric: tabular-nums; }
  .kpi-foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; color: var(--ink-4); }
  .growth { display: inline-flex; align-items: center; gap: 3px; font-weight: 600; padding: 2px 7px; border-radius: 999px; font-size: 11.5px; }
  .growth.up { color: var(--ok, #157a4a); background: color-mix(in oklab, var(--ok, #157a4a) 12%, transparent); }
  .growth.down { color: var(--bad, #c0392b); background: var(--bad-wash, #fdeceb); }
  .growth.flat { color: var(--ink-4); background: var(--surface-2, #f5f3fb); }
`;

function eur(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}
function num(n: number): string {
  return n.toLocaleString('de-DE');
}

export default function AdminDashboard() {
  const [secret, setSecret] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  // Deep links: /admin?tab=organizers|payouts. Tabs only render after unlock,
  // so this never affects the initial (server) HTML → no hydration mismatch.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'overview';
    const t = new URLSearchParams(window.location.search).get('tab');
    return t === 'organizers' || t === 'payouts' ? t : 'overview';
  });
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async (currentSecret: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/overview', { headers: { 'x-admin-secret': currentSecret }, cache: 'no-store' });
      if (res.status === 401) {
        setError('Falsches Admin-Secret.');
        setUnlocked(false);
        return;
      }
      const data = (await res.json()) as OverviewData & { error?: string };
      if (!res.ok || !data.kpis) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setOverview(data);
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übersicht konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">
        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="topbar-right">
              <span className="chip"><span className="d" />Admin</span>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="container">
            <div className="hero" style={{ padding: '36px 0 24px', marginBottom: 8 }}>
              <h1 style={{ fontSize: 30 }}>Admin-Dashboard</h1>
              <p className="lead" style={{ fontSize: 14 }}>
                Plattform-Kennzahlen, Veranstalter-Freigaben und Auszahlungen an einem Ort.
              </p>
            </div>

            {!unlocked && (
              <form
                className="row gap-2"
                style={{ maxWidth: 420 }}
                onSubmit={(e) => { e.preventDefault(); void loadOverview(secret); }}
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
                <div className="admin-tabs" role="tablist">
                  <button className={`admin-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Übersicht</button>
                  <button className={`admin-tab ${tab === 'organizers' ? 'active' : ''}`} onClick={() => setTab('organizers')}>Veranstalter</button>
                  <button className={`admin-tab ${tab === 'payouts' ? 'active' : ''}`} onClick={() => setTab('payouts')}>Auszahlungen</button>
                </div>

                {tab === 'overview' && overview && (
                  <OverviewTab data={overview} loading={loading} onRefresh={() => void loadOverview(secret)} />
                )}
                {tab === 'organizers' && <OrganizersTab secret={secret} />}
                {tab === 'payouts' && <PayoutsTab secret={secret} />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function OverviewTab({ data, loading, onRefresh }: { data: OverviewData; loading: boolean; onRefresh: () => void }) {
  const { kpis, windowDays } = data;
  return (
    <>
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div>
          <h2>Kennzahlen</h2>
          <div className="sub">Wachstum: letzte {windowDays} Tage ggü. den {windowDays} Tagen davor</div>
        </div>
        <button type="button" className="btn ghost sm" onClick={onRefresh} disabled={loading}>
          {loading ? 'Aktualisiert …' : 'Aktualisieren'}
        </button>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Verkaufte Tickets" value={num(kpis.ticketsSold.total)} metric={kpis.ticketsSold} fmt={num} />
        <KpiCard label="Über Passly bewegt" value={eur(kpis.grossVolumeCents.total)} metric={kpis.grossVolumeCents} fmt={eur} />
        <KpiCard label="Dein Cut (Gebühren)" value={eur(kpis.platformFeeCents.total)} metric={kpis.platformFeeCents} fmt={eur} highlight />
        <KpiCard label="An Veranstalter ausgezahlt" value={eur(kpis.netTransferredCents.total)} metric={kpis.netTransferredCents} fmt={eur} />
        <KpiCard label="Nutzer gesamt" value={num(kpis.totalUsers.total)} metric={kpis.totalUsers} fmt={num} />
      </div>

      <div className="section-head" style={{ marginBottom: 12 }}>
        <div>
          <h2>Event-Standorte weltweit</h2>
          <div className="sub">{data.eventLocations.length} Standort{data.eventLocations.length !== 1 ? 'e' : ''} · Punktgröße nach Andrang</div>
        </div>
      </div>
      <div className="card" style={{ padding: 8 }}>
        <GlobeCard locations={data.eventLocations} />
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  metric,
  fmt,
  highlight,
}: {
  label: string;
  value: string;
  metric: Metric;
  fmt: (n: number) => string;
  highlight?: boolean;
}) {
  return (
    <div className="card kpi" style={highlight ? { borderColor: 'var(--accent-line)', background: 'var(--accent-wash)' } : undefined}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={highlight ? { color: 'var(--accent-ink)' } : undefined}>{value}</div>
      <div className="kpi-foot">
        <GrowthChip metric={metric} />
        <span>+{fmt(metric.currentPeriod)} zuletzt</span>
      </div>
    </div>
  );
}

function GrowthChip({ metric }: { metric: Metric }) {
  if (metric.growthPct === null) {
    return <span className="growth flat">{metric.currentPeriod > 0 ? 'neu' : '–'}</span>;
  }
  const up = metric.growthPct >= 0;
  return (
    <span className={`growth ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(metric.growthPct)}%
    </span>
  );
}
