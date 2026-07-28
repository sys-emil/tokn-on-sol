'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TrafficMetric, TrafficPayload } from '@/app/api/admin/traffic/route';

const RANGES = [7, 30, 90, 365] as const;

const RANGE_LABEL: Record<(typeof RANGES)[number], string> = {
  7: '7 Tage',
  30: '30 Tage',
  90: '90 Tage',
  365: '1 Jahr',
};

const EVENT_LABEL: Record<string, string> = {
  page_view: 'Seitenaufruf',
  ticket_selected: 'Ticket gewählt',
  checkout_started: 'Checkout gestartet',
  purchase_completed: 'Kauf abgeschlossen',
  ticket_viewed: 'Ticket angesehen',
};

function num(n: number): string {
  return n.toLocaleString('de-DE');
}
function dec(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function shortDay(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} T.`;
}

export function TrafficTab({ secret }: { secret: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<TrafficPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/traffic?range=${range}`, {
        headers: { 'x-admin-secret': secret },
        cache: 'no-store',
      });
      const payload = (await res.json()) as TrafficPayload & { error?: string };
      if (!res.ok || !payload.kpis) {
        setError(payload.error ?? `HTTP ${res.status}`);
        return;
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Traffic konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [secret, range]);

  // Deferred so the first setState doesn't run in the effect body.
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  return (
    <>
      {error && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 20, maxWidth: 640, fontSize: 13, color: 'var(--bad)', border: '1px solid oklch(0.86 0.10 25)', background: 'var(--bad-wash)' }}>
          {error}
        </div>
      )}

      <div className="section-head" style={{ marginBottom: 14 }}>
        <div>
          <h2>Web-Traffic</h2>
          <div className="sub">
            Nur Besucher mit Cookie-Zustimmung werden gezählt – die echten Zahlen liegen darüber.
          </div>
        </div>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <div className="range-picker">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`range-btn ${range === r ? 'active' : ''}`}
                onClick={() => setRange(r)}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
          <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading}>
            {loading ? 'Aktualisiert …' : 'Aktualisieren'}
          </button>
        </div>
      </div>

      {!data && <div className="card"><div className="empty">{loading ? 'Lädt …' : 'Keine Daten.'}</div></div>}

      {data && (
        <>
          {data.truncated && (
            <div className="card" style={{ padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--ink-3)' }}>
              Sehr viele Ereignisse im Zeitraum – die ältesten wurden abgeschnitten.
            </div>
          )}

          <div className="kpi-grid">
            <TrafficKpi label="Seitenaufrufe" metric={data.kpis.pageViews} fmt={num} />
            <TrafficKpi label="Besucher" metric={data.kpis.visitors} fmt={num} highlight />
            <TrafficKpi label="Sitzungen" metric={data.kpis.sessions} fmt={num} />
            <TrafficKpi label="Seiten / Sitzung" metric={data.kpis.viewsPerSession} fmt={dec} />
            <TrafficKpi label="Absprungrate" metric={data.kpis.bounceRatePct} fmt={(n) => `${dec(n)} %`} lowerIsBetter />
          </div>

          <div className="card" style={{ padding: '18px 20px 12px', marginBottom: 24 }}>
            <div className="chart-head">
              <span className="chart-title">Seitenaufrufe pro Tag</span>
              <span className="legend"><i className="dot cur" />Aktueller Zeitraum</span>
              <span className="legend"><i className="dot prev" />Vorperiode</span>
            </div>
            <TrendChart days={data.series.days} views={data.series.views} previous={data.series.previousViews} />
          </div>

          <div className="traffic-cols">
            <section className="card panel">
              <h3 className="panel-title">Meistbesuchte Seiten</h3>
              <BarList
                rows={data.topPages.map((p) => ({ key: p.path, label: p.path, value: p.views, sub: `${num(p.visitors)} Besucher` }))}
                empty="Keine Seitenaufrufe im Zeitraum."
                mono
              />
            </section>

            <section className="card panel">
              <h3 className="panel-title">Woher die Besucher kommen</h3>
              <BarList
                rows={data.channels.map((c) => ({ key: c.channel, label: c.channel, value: c.visitors, sub: `${dec(c.sharePct)} %` }))}
                empty="Keine Besucher im Zeitraum."
              />
            </section>

            <section className="card panel">
              <h3 className="panel-title">Verweisende Seiten</h3>
              <BarList
                rows={data.topReferrers.map((r) => ({ key: r.host, label: r.host, value: r.views, sub: `${num(r.visitors)} Besucher` }))}
                empty="Kein externer Referrer – aller Traffic kommt direkt."
                mono
              />
            </section>

            <section className="card panel">
              <h3 className="panel-title">Beliebteste Event-Seiten</h3>
              <BarList
                rows={data.topEvents.map((e) => ({ key: e.eventId, label: e.name, value: e.views, sub: `${num(e.visitors)} Besucher` }))}
                empty="Keine Shop-Aufrufe im Zeitraum."
              />
            </section>
          </div>

          <section style={{ marginTop: 24 }}>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div>
                <h2>Shop-Funnel</h2>
                <div className="sub">Besucher pro Stufe, plattformweit über alle Event-Shops</div>
              </div>
            </div>
            <div className="card panel">
              <Funnel stages={data.funnel} />
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div>
                <h2>Letzte Aktivität</h2>
                <div className="sub">Die {data.recent.length} jüngsten Ereignisse</div>
              </div>
            </div>
            <div className="card panel">
              {data.recent.length === 0 ? (
                <div className="empty">Noch keine Ereignisse.</div>
              ) : (
                <div className="feed">
                  {data.recent.map((hit, i) => (
                    <div key={`${hit.createdAt}-${i}`} className="feed-row">
                      <span className={`tag ${hit.name === 'purchase_completed' ? 'ok' : ''}`}>
                        {EVENT_LABEL[hit.name] ?? hit.name}
                      </span>
                      <span className="feed-path">{hit.path ?? '–'}</span>
                      <span className="feed-src">{hit.source}</span>
                      <span className="feed-time">{relTime(hit.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function TrafficKpi({
  label, metric, fmt, highlight, lowerIsBetter,
}: {
  label: string;
  metric: TrafficMetric;
  fmt: (n: number) => string;
  highlight?: boolean;
  lowerIsBetter?: boolean;
}) {
  const { changePct } = metric;
  const good = changePct === null ? null : lowerIsBetter ? changePct <= 0 : changePct >= 0;
  return (
    <div className="card kpi" style={highlight ? { borderColor: 'var(--accent-line)', background: 'var(--accent-wash)' } : undefined}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={highlight ? { color: 'var(--accent-ink)' } : undefined}>{fmt(metric.current)}</div>
      <div className="kpi-foot">
        {changePct === null ? (
          <span className="growth flat">{metric.current > 0 ? 'neu' : '–'}</span>
        ) : (
          <span className={`growth ${changePct === 0 ? 'flat' : good ? 'up' : 'down'}`}>
            {changePct === 0 ? '±' : changePct > 0 ? '▲' : '▼'} {Math.abs(changePct)}%
          </span>
        )}
        <span>zuvor {fmt(metric.previous)}</span>
      </div>
    </div>
  );
}

/** Line chart: current period filled, previous period as a dashed line. */
function TrendChart({ days, views, previous }: { days: string[]; views: number[]; previous: number[] }) {
  const W = 720;
  const H = 180;
  const TOP = 12;
  const BOTTOM = 24;
  const max = Math.max(1, ...views, ...previous);
  const n = days.length;

  const x = (i: number): number => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number): number => H - BOTTOM - (v / max) * (H - TOP - BOTTOM);
  const line = (vals: number[]): string => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line(views)} L${x(n - 1).toFixed(1)},${H - BOTTOM} L${x(0).toFixed(1)},${H - BOTTOM} Z`;

  const labelAt = [0, Math.floor((n - 1) / 2), n - 1].filter((i, idx, arr) => i >= 0 && arr.indexOf(i) === idx);

  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Seitenaufrufe pro Tag">
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line x1="0" y1={H - BOTTOM} x2={W} y2={H - BOTTOM} className="axis" />
      <line x1="0" y1={y(max)} x2={W} y2={y(max)} className="axis dashed" />
      <text x="4" y={y(max) - 4} className="tick">{num(max)}</text>

      <path d={area} fill="url(#trend-fill)" />
      <path d={line(previous)} className="ln prev" />
      <path d={line(views)} className="ln cur" />

      {labelAt.map((i) => (
        <text key={i} x={Math.min(W - 30, Math.max(2, x(i)))} y={H - 6} className="tick" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
          {shortDay(days[i])}
        </text>
      ))}

      {days.map((d, i) => (
        <rect key={d} x={x(i) - W / (2 * Math.max(1, n))} y={0} width={W / Math.max(1, n)} height={H - BOTTOM} fill="transparent">
          <title>{`${shortDay(d)}: ${num(views[i])} Aufrufe`}</title>
        </rect>
      ))}
    </svg>
  );
}

function BarList({
  rows, empty, mono,
}: {
  rows: { key: string; label: string; value: number; sub: string }[];
  empty: string;
  mono?: boolean;
}) {
  if (rows.length === 0) return <div className="empty">{empty}</div>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.key} className="bar-row">
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <span className={`bar-label ${mono ? 'mono' : ''}`} title={r.label}>{r.label}</span>
          <span className="bar-value">{num(r.value)}</span>
          <span className="bar-sub">{r.sub}</span>
        </div>
      ))}
    </div>
  );
}

function Funnel({ stages }: { stages: { key: string; label: string; count: number }[] }) {
  const first = stages[0]?.count ?? 0;
  if (first === 0) return <div className="empty">Noch keine Shop-Besuche mit Zustimmung im Zeitraum.</div>;
  return (
    <div className="funnel">
      {stages.map((s, i) => {
        const pct = (s.count / first) * 100;
        const prev = i > 0 ? stages[i - 1].count : null;
        return (
          <div key={s.key} className="funnel-row">
            <span className="funnel-label">{s.label}</span>
            <div className="funnel-track"><div className="funnel-fill" style={{ width: `${Math.max(pct, 1.5)}%` }} /></div>
            <span className="funnel-count">{num(s.count)}</span>
            <span className="funnel-pct">
              {i === 0 ? '100 %' : `${dec(pct)} % gesamt`}
              {prev !== null && prev > 0 && ` · ${dec((s.count / prev) * 100)} % Schritt`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
