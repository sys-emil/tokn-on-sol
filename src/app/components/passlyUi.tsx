/*
 * Passly UI kit; Icon + Spark components for the "Tokn Based" light theme.
 * The shared component CSS lives in src/app/globals.css since the full
 * template migration (2026-07-06); pages only add page-specific <style> blocks.
 */
type IconName =
  | 'plus' | 'calendar' | 'users' | 'ticket' | 'check' | 'doublecheck' | 'arrow'
  | 'download' | 'share' | 'x' | 'search' | 'dots' | 'qr' | 'scan' | 'clock'
  | 'euro' | 'mail' | 'location' | 'shield' | 'sparkle' | 'camera' | 'refresh'
  | 'chevronRight' | 'chevronLeft' | 'settings' | 'wifi' | 'bell' | 'edit' | 'lock' | 'tag';

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
  tag: <><path d="M20.59 13.41 12 22l-8-8V4h10l6.59 6.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.5"/></>,
};

// Purely decorative by default; every use sits next to a text label or
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

const SEAL_D =
  'M100 4 L119.15 28.52 L148 16.86 L152.33 47.67 L183.14 52 L171.48 80.85 L196 100 ' +
  'L171.48 119.15 L183.14 148 L152.33 152.33 L148 183.14 L119.15 171.48 L100 196 ' +
  'L80.85 171.48 L52 183.14 L47.67 152.33 L16.86 148 L28.52 119.15 L4 100 L28.52 80.85 ' +
  'L16.86 52 L47.67 47.67 L52 16.86 L80.85 28.52 Z';

/**
 * Purple brand-verification seal (like the social-media blue check, in Passly
 * violet): a scalloped seal with a gradient fill, gloss highlight and a white
 * check. Shown next to a verified organizer's name on their profile, the shop
 * page and the dashboard. Decorative when unlabeled; pass `title` for an
 * accessible name / tooltip (e.g. the admin-set "Offizielle Marke").
 *
 * Gradient ids are static: every instance defines identical gradients in a
 * 200-unit user space, so sharing an id across instances renders the same at
 * any size and needs no client-only useId (this also renders in server
 * components: the profile + shop pages).
 */
export function VerifiedCheck({ size = 16, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 200 200" fill="none"
      role="img" aria-label={title ?? 'Verifiziert'}
      style={{
        display: 'inline-block', flexShrink: 0, verticalAlign: 'text-bottom',
        filter: `drop-shadow(0 ${size * 0.05}px ${size * 0.12}px oklch(0.54 0.22 285 / 0.42))`,
      }}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="passlySealFill" x1="30" y1="8" x2="170" y2="192" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.66 0.20 288)" />
          <stop offset="0.48" stopColor="oklch(0.54 0.22 285)" />
          <stop offset="1" stopColor="oklch(0.42 0.22 283)" />
        </linearGradient>
        <linearGradient id="passlySealStroke" x1="30" y1="8" x2="170" y2="192" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.80 0.14 290)" />
          <stop offset="0.5" stopColor="oklch(0.58 0.22 285)" />
          <stop offset="1" stopColor="oklch(0.36 0.18 283)" />
        </linearGradient>
        <radialGradient id="passlySealGloss" cx="0.5" cy="0.28" r="0.65">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={SEAL_D} fill="url(#passlySealFill)" stroke="url(#passlySealStroke)" strokeWidth="5" strokeLinejoin="round" />
      <path d={SEAL_D} fill="url(#passlySealGloss)" />
      <path d="M71 101 L91 121 L131 78" fill="none" stroke="#ffffff" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Curated palette; same oklch chroma/lightness formula as --accent, just a
// fixed hue, so every choice stays inside the design system's saturation.
/**
 * Only hues from the brand's own arc. Passly is violet (`--hue: 285`), and an
 * event card in amber, emerald or turquoise stopped looking like Passly at
 * all — the accent is supposed to let an organizer set a tone inside the
 * brand, not repaint the product. Blau and Rose are the two neighbours of 285
 * that still read as "this is Passly, in a different mood".
 *
 * Don't re-add hues outside roughly 230–345. The card-border presets
 * (BORDER_PRESETS) are the place for genuinely different looks.
 */
export const ACCENT_HUES: { hue: number | null; name: string }[] = [
  { hue: null, name: 'Violett (Standard)' },
  { hue: 230, name: 'Blau' },
  { hue: 345, name: 'Rose' },
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
