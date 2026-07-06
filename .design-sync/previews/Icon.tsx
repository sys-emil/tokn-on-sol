import React from 'react';
import { Icon } from 'tokn-on-sol';

const ALL_ICONS = [
  'plus', 'calendar', 'users', 'ticket', 'check', 'doublecheck', 'arrow',
  'download', 'share', 'x', 'search', 'dots', 'qr', 'scan', 'clock',
  'euro', 'mail', 'location', 'shield', 'sparkle', 'camera', 'refresh',
  'chevronRight', 'chevronLeft', 'settings', 'wifi', 'bell',
] as const;

export const AlleIcons = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
    {ALL_ICONS.map((n) => (
      <div
        key={n}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          padding: '10px 4px', borderRadius: 8, color: 'var(--ink-2)',
        }}
      >
        <Icon name={n} size={18} />
        <span style={{ fontSize: 9.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{n}</span>
      </div>
    ))}
  </div>
);

export const Groessen = () => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, color: 'var(--ink)' }}>
    {[12, 16, 20, 24, 32].map((s) => (
      <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Icon name="ticket" size={s} />
        <span style={{ fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{s}px</span>
      </div>
    ))}
  </div>
);

export const InKomponenten = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
    <button className="btn primary">
      <Icon name="plus" size={14} /> Event anlegen
    </button>
    <button className="btn ghost sm">
      <Icon name="share" size={12} /> Teilen
    </button>
    <span className="chip ok"><span className="d" />Gültig</span>
    <div
      style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'var(--accent-wash)', border: '1px solid var(--accent-line)',
        display: 'grid', placeItems: 'center', color: 'var(--accent)',
      }}
    >
      <Icon name="shield" size={17} />
    </div>
  </div>
);
