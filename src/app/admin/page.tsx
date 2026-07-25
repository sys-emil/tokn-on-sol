'use client';

import { useCallback, useEffect, useState } from 'react';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import type { Metric, EventLocation } from '@/app/api/admin/overview/route';
import type { SolanaBalance } from '@/app/api/admin/solana-balance/route';
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

  .bal-card { padding: 18px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 20px 28px; margin-bottom: 28px; }
  .bal-main { display: flex; flex-direction: column; gap: 4px; }
  .bal-label { font-size: 12.5px; color: var(--ink-3); font-weight: 500; display: flex; align-items: center; gap: 8px; }
  .bal-value { font-size: 30px; font-weight: 650; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .bal-stat { display: flex; flex-direction: column; gap: 2px; }
  .bal-stat .k { font-size: 11.5px; color: var(--ink-4); font-weight: 500; }
  .bal-stat .v { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .bal-addr { font-family: var(--mono); font-size: 11px; color: var(--ink-4); word-break: break-all; }
  .bal-spacer { flex: 1 1 auto; }
  .bal-net { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 999px; background: var(--surface-2, #f5f3fb); color: var(--ink-3); }
  .bal-card.low { border-color: oklch(0.86 0.10 25); background: var(--bad-wash, #fdeceb); }
  .bal-warn { font-size: 12px; font-weight: 600; color: var(--bad, #c0392b); }

  .bal-wrap { display: flex; flex-direction: column; gap: 18px; }
  .bal-trees { border-top: 1px solid var(--surface-3, #ece9f5); padding-top: 16px; }
  .bal-trees-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .bal-trees-head .k { font-size: 12.5px; color: var(--ink-3); font-weight: 500; }
  .bal-trees-head .v { font-size: 13px; font-variant-numeric: tabular-nums; }
  .bal-trees-head .v b { font-weight: 650; }
  .cap-bar { height: 10px; border-radius: 999px; background: var(--surface-2, #f5f3fb); overflow: hidden; }
  .cap-fill { height: 100%; border-radius: 999px; background: var(--accent, #7c5cff); transition: width .3s ease; }
  .cap-fill.warn { background: var(--bad, #c0392b); }
  .tree-list { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .tree-row { display: flex; align-items: center; gap: 10px; font-size: 11.5px; }
  .tree-row .addr { font-family: var(--mono); color: var(--ink-4); }
  .tree-row .cnt { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--ink-3); }
  .tree-row.err .cnt { color: var(--bad, #c0392b); }
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
                  <OverviewTab data={overview} loading={loading} onRefresh={() => void loadOverview(secret)} secret={secret} />
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

function OverviewTab({ data, loading, onRefresh, secret }: { data: OverviewData; loading: boolean; onRefresh: () => void; secret: string }) {
  const { kpis, windowDays } = data;
  return (
    <>
      <SolanaBalanceCard secret={secret} />

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

function SolanaBalanceCard({ secret }: { secret: string }) {
  const [bal, setBal] = useState<SolanaBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/solana-balance', { headers: { 'x-admin-secret': secret }, cache: 'no-store' });
      const data = (await res.json()) as SolanaBalance & { error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setBal(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Balance konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  // Defer past the synchronous effect body so the first setState in load()
  // doesn't trip react-hooks/set-state-in-effect.
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const sol = bal ? bal.sol.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 4 }) : '–';
  const mints = bal ? bal.estMintsRemaining.toLocaleString('de-DE') : '–';

  const usedPct = bal && bal.treeCapacity > 0 ? (bal.treeMinted / bal.treeCapacity) * 100 : 0;
  const capWarn = usedPct >= 90;

  return (
    <div className={`card bal-card ${bal?.low ? 'low' : ''}`}>
      <div className="bal-wrap" style={{ width: '100%' }}>
        {/* Top row: operator SOL balance + fee-based headroom */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px 28px' }}>
          <div className="bal-main">
            <div className="bal-label">
              Operator-Wallet · SOL-Guthaben
              {bal && <span className="bal-net">{bal.network === 'devnet' ? 'Devnet' : 'Mainnet'}</span>}
            </div>
            <div className="bal-value">{loading && !bal ? 'Lädt …' : `${sol} SOL`}</div>
            {bal && <div className="bal-addr">{bal.address}</div>}
          </div>

          <div className="bal-stat">
            <span className="k">Gebühren reichen für ~</span>
            <span className="v">{mints} Mints</span>
          </div>

          <div className="bal-spacer" />

          <div className="bal-stat" style={{ alignItems: 'flex-end' }}>
            {bal?.low && <span className="bal-warn">⚠ Guthaben niedrig – aufladen</span>}
            {error && <span className="bal-warn">{error}</span>}
            <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading} style={{ marginTop: 6 }}>
              {loading ? 'Aktualisiert …' : 'Aktualisieren'}
            </button>
          </div>
        </div>

        {/* Tree capacity: the hard ceiling on mintable tickets */}
        {bal && bal.trees.length > 0 && (
          <div className="bal-trees">
            <div className="bal-trees-head">
              <span className="k">
                Tree-Kapazität · {bal.trees.length} Tree{bal.trees.length !== 1 ? 's' : ''}
              </span>
              <span className="v">
                <b>{bal.treeRemaining.toLocaleString('de-DE')}</b> frei ·{' '}
                {bal.treeMinted.toLocaleString('de-DE')} von {bal.treeCapacity.toLocaleString('de-DE')} belegt
              </span>
            </div>
            <div className="cap-bar">
              <div className={`cap-fill ${capWarn ? 'warn' : ''}`} style={{ width: `${Math.min(100, usedPct)}%` }} />
            </div>
            {capWarn && (
              <div className="bal-warn" style={{ marginTop: 8 }}>
                ⚠ Trees zu über 90 % belegt – neuen Tree bereitstellen (npm run create-tree)
              </div>
            )}
            {bal.trees.length > 1 && (
              <div className="tree-list">
                {bal.trees.map((t) => (
                  <div key={t.address} className={`tree-row ${t.error ? 'err' : ''}`}>
                    <span className="addr">{t.address.slice(0, 4)}…{t.address.slice(-4)}</span>
                    <span className="cnt">
                      {t.error
                        ? 'Fehler beim Lesen'
                        : `${t.remaining.toLocaleString('de-DE')} frei · ${t.minted.toLocaleString('de-DE')}/${t.capacity.toLocaleString('de-DE')} (Depth ${t.maxDepth})`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
