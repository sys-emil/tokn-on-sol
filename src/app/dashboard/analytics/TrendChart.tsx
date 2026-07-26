'use client';

import { useState } from 'react';
import { dayLabel } from './proFormat';

const W = 1000;
const H = 250;
const TOP = 14;
const BOT = 18;

/**
 * Daily trend line with the previous period as a dashed reference and a
 * hover tooltip. Drawn by hand rather than pulled in as a chart library: it is
 * one series plus a comparison, and the SVG inherits the page's design tokens.
 */
export function TrendChart({
  days, current, previous, compare, format,
}: {
  days: string[];
  current: number[];
  previous: number[];
  compare: boolean;
  format: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (current.length < 2) {
    return <div className="empty" style={{ padding: 40 }}>Noch keine Verkäufe in diesem Zeitraum.</div>;
  }

  const all = compare ? current.concat(previous) : current;
  const max = Math.max(...all, 1) * 1.12;
  const x = (i: number) => (i / (current.length - 1)) * W;
  const y = (v: number) => TOP + (1 - v / max) * (H - TOP - BOT);
  const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line(current)} L ${W} ${H - BOT} L 0 ${H - BOT} Z`;

  const point = hover != null ? {
    day: days[hover],
    value: current[hover],
    prev: previous[hover] ?? 0,
  } : null;
  const delta = point && point.prev > 0
    ? Math.round(((point.value - point.prev) / point.prev) * 100)
    : null;

  const labelIdx = [0, 0.2, 0.4, 0.6, 0.8, 1]
    .map((t) => Math.round(t * (days.length - 1)))
    .filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div className="trend">
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="trend-svg" role="img"
             aria-label="Entwicklung im gewählten Zeitraum">
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line key={t} x1={0} x2={W} y1={TOP + t * (H - TOP - BOT)} y2={TOP + t * (H - TOP - BOT)}
                  stroke="var(--line)" strokeWidth={1} />
          ))}
          <path d={area} fill="url(#trendFill)" />
          {compare && (
            <path d={line(previous)} fill="none" stroke="var(--ink-4)" strokeWidth={1.5}
                  strokeDasharray="4 5" opacity={0.85} />
          )}
          <path d={line(current)} fill="none" stroke="var(--accent)" strokeWidth={2.4}
                strokeLinejoin="round" strokeLinecap="round" />
          {hover != null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={H - BOT} stroke="var(--accent)" strokeWidth={1} opacity={0.5} />
              <circle cx={x(hover)} cy={y(current[hover])} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2.5} />
            </>
          )}
          <g>
            {current.map((_, i) => (
              <rect key={i} x={x(i) - W / (current.length * 2)} y={0} width={W / current.length} height={H}
                    fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            ))}
          </g>
        </svg>

        {point && (
          <div
            className="trend-tip"
            style={{
              left: `${(hover! / (current.length - 1)) * 100}%`,
              transform: hover! > current.length * 0.7 ? 'translate(-108%, 0)' : 'translate(8%, 0)',
            }}
          >
            <div className="tip-day">{dayLabel(point.day)}</div>
            <div className="tip-value">{format(point.value)}</div>
            {compare && (
              <>
                <div className="tip-prev"><span className="tip-dash" />Vorperiode {format(point.prev)}</div>
                {delta != null && (
                  <div className="tip-delta" style={{ color: delta >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                    {delta >= 0 ? '+' : '−'}{Math.abs(delta)} % vs. Vorperiode
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="trend-axis">
        {labelIdx.map((i) => <span key={i}>{dayLabel(days[i])}</span>)}
      </div>
    </div>
  );
}
