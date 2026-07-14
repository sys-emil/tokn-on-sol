/*
 * Passly UI kit — Icon + Spark components for the "Tokn Based" light theme.
 * The shared component CSS lives in src/app/globals.css since the full
 * template migration (2026-07-06); pages only add page-specific <style> blocks.
 */
type IconName =
  | 'plus' | 'calendar' | 'users' | 'ticket' | 'check' | 'doublecheck' | 'arrow'
  | 'download' | 'share' | 'x' | 'search' | 'dots' | 'qr' | 'scan' | 'clock'
  | 'euro' | 'mail' | 'location' | 'shield' | 'sparkle' | 'camera' | 'refresh'
  | 'chevronRight' | 'chevronLeft' | 'settings' | 'wifi' | 'bell' | 'edit' | 'lock';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18"/><path d="M8 3v3"/><path d="M16 3v3"/></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M17 3.13A4 4 0 0 1 17 11"/></>,
  ticket: <><path d="M2 9a3 3 0 1 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 1 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/></>,
  check: <><path d="M20 6L9 17l-5-5"/></>,
  doublecheck: <><path d="M16 6 7 15l-3-3"/><path d="m20 10-7.5 7.5"/></>,
  arrow: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>,
  share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/></>,
  x: <><path d="M18 6 6 18"/><path d="M6 6l12 12"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  dots: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M19 14h2"/><path d="M14 19h3"/><path d="M19 19v2"/></>,
  scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  euro: <><path d="M18 7a6.5 6.5 0 1 0 0 10"/><path d="M3 10h9"/><path d="M3 14h9"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  location: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/></>,
  sparkle: <><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m5.6 5.6 2.8 2.8"/><path d="m15.6 15.6 2.8 2.8"/><path d="m5.6 18.4 2.8-2.8"/><path d="m15.6 8.4 2.8-2.8"/></>,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
  refresh: <><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 21v-5h5"/><path d="M21 3v5h-5"/></>,
  chevronRight: <><path d="m9 18 6-6-6-6"/></>,
  chevronLeft: <><path d="m15 18-6-6 6-6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  wifi: <><path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M8.5 15.55a7 7 0 0 1 7 0"/><path d="M12 19.55v0"/></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  edit: <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></>,
  lock: <><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></>,
};

// Purely decorative by default — every use sits next to a text label or
// inside a button that itself needs the accessible name (aria-label on the
// button), so the glyph stays out of the accessibility tree.
export function Icon({ name, size = 16, strokeWidth = 1.7 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"
         stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}

// Curated palette — same oklch chroma/lightness formula as --accent, just a
// fixed hue, so every choice stays inside the design system's saturation.
const ACCENT_HUES: { hue: number | null; name: string }[] = [
  { hue: null, name: 'Violett (Standard)' },
  { hue: 345, name: 'Rose' },
  { hue: 45, name: 'Amber' },
  { hue: 150, name: 'Smaragd' },
  { hue: 195, name: 'Türkis' },
  { hue: 230, name: 'Blau' },
];

const BORDER_PRESETS: { value: string | null; name: string }[] = [
  { value: null, name: 'Standard' },
  { value: 'gold', name: 'Gold' },
  { value: 'chrome', name: 'Chrome' },
  { value: 'aurora', name: 'Aurora' },
  { value: 'neon', name: 'Neon' },
];

/**
 * Event color-scheme (free, all organizers) + card-border preset (Pro-only)
 * pickers, shared between the create and edit event forms.
 */
export function EventStyleFields({
  accentHue, onAccentHueChange, borderStyle, onBorderStyleChange, isPro, disabled,
}: {
  accentHue: number | null;
  onAccentHueChange: (hue: number | null) => void;
  borderStyle: string | null;
  onBorderStyleChange: (style: string | null) => void;
  isPro: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="field">
        <label>Farbschema</label>
        <div className="swatch-row" role="radiogroup" aria-label="Farbschema">
          {ACCENT_HUES.map((c) => (
            <button
              key={c.name}
              type="button"
              className="swatch"
              role="radio"
              aria-checked={accentHue === c.hue}
              title={c.name}
              style={{ background: `oklch(0.58 0.20 ${c.hue ?? 285})` }}
              onClick={() => onAccentHueChange(c.hue)}
              disabled={disabled}
            />
          ))}
        </div>
        <span className="hint">Färbt Ticketkarten und Datumschip in der Übersicht deiner Gäste.</span>
      </div>
      <div className="field">
        <label>
          Kartenrand
          {!isPro && <span className="chip pro" style={{ marginLeft: 8, fontSize: 10, padding: '2px 7px' }}>Pro</span>}
        </label>
        <div className="preset-row" role="radiogroup" aria-label="Kartenrand">
          {BORDER_PRESETS.map((p) => {
            const locked = !isPro && p.value !== null;
            const checked = borderStyle === p.value;
            return (
              <button
                key={p.name}
                type="button"
                className={`preset-chip${checked ? ' active' : ''}${locked ? ' locked' : ''}`}
                role="radio"
                aria-checked={checked}
                onClick={() => { if (!locked) onBorderStyleChange(p.value); }}
                disabled={disabled || locked}
              >
                {locked && <Icon name="lock" size={11} />}
                {p.name}
              </button>
            );
          })}
        </div>
        <span className="hint">
          {isPro
            ? 'Besonderer Rand-Effekt auf den Ticketkarten deiner Gäste.'
            : 'Mit Passly Pro: besondere Rand-Effekte für deine Ticketkarten.'}
        </span>
      </div>
    </>
  );
}

export function Spark({ data, color = 'var(--accent)', width = 80, height = 28 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height}>
      <polyline fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}
