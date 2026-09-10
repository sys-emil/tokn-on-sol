import Link from 'next/link';
import { Icon } from '@/app/components/passlyUi';

/**
 * Die Event-Karte der oeffentlichen Liste /events.
 *
 * Liegt hier statt in der Seite, weil die Live-Vorschau im Event-Editor
 * dieselbe Karte zeigen muss. Zwei Kopien waeren zwei Wahrheiten: die Vorschau
 * wuerde irgendwann etwas versprechen, was die Liste nicht haelt.
 *
 * Die Komponente rechnet nichts aus — Badge, Fortschritt und Preis kommen
 * fertig herein (aus `eventCardView` in src/lib/eventCardView.ts plus der
 * Uebersetzung des Aufrufers). Sie ist reine Darstellung.
 */

export interface EventCardProps {
  /** Ziel des Klicks; ohne href rendert die Karte als statischer Block (Vorschau). */
  href?: string;
  name: string;
  /** Bereits formatiert, z. B. "SEP" */
  monthLabel: string;
  dayLabel: number | string;
  /** Zeile unter dem Titel, z. B. "20:00 Uhr · Backstage Halle" */
  subLine?: string | null;
  priceLabel: string;
  /** Bild oder generierter Verlauf — siehe `EventArt`. */
  art: React.ReactNode;
  badge?: string | null;
  progressLabel?: string | null;
  /** 0–100; nur gerendert, wenn progressLabel gesetzt ist. */
  fillPct?: number;
  barColor?: string;
  /** Hebt Fortschritt und Fussnote rot hervor (fast ausverkauft). */
  urgent?: boolean;
  soldOut?: boolean;
  ctaLabel: string;
  /** Ausverkauft: neutraler Knopf statt Accent. */
  ctaMuted?: boolean;
  /** Kurzfassung, die mobil den CTA ersetzt. */
  footNote?: string | null;
  /** Gestaffelte Einblendung in der Liste. */
  animationDelayMs?: number;
}

export function EventCard({
  href,
  name,
  monthLabel,
  dayLabel,
  subLine,
  priceLabel,
  art,
  badge,
  progressLabel,
  fillPct = 0,
  barColor = 'var(--accent)',
  urgent = false,
  soldOut = false,
  ctaLabel,
  ctaMuted = false,
  footNote,
  animationDelayMs,
}: EventCardProps) {
  const urgentStyle = urgent ? { color: 'var(--bad)', fontWeight: 600 } : undefined;

  const inner = (
    <>
      <div className="ev-card-art">
        {art}
        <div className="ev-datebadge">
          <span className="m">{monthLabel}</span>
          <span className="d">{dayLabel}</span>
        </div>
        {badge && <span className="ev-badge">{badge}</span>}
      </div>
      <div className="ev-card-body">
        <div>
          <span className="ev-card-eyebrow">{String(monthLabel).toUpperCase()} {dayLabel}</span>
          <h3>{name}</h3>
          {subLine && <p className="ev-card-sub">{subLine}</p>}
        </div>
        {progressLabel && (
          <div className="ev-progress">
            <div className="ev-track">
              <div className="ev-fill" style={{ width: `${fillPct}%`, background: barColor }} />
            </div>
            <span className="ev-progress-label" style={urgentStyle}>{progressLabel}</span>
          </div>
        )}
        <div className="ev-card-foot">
          <span className="ev-price">{priceLabel}</span>
          <span className={`ev-cta btn ${ctaMuted ? 'ghost' : 'primary'}`}>
            {ctaLabel}
            {!ctaMuted && <Icon name="arrow" size={15} />}
          </span>
          {footNote && <span className="ev-foot-note" style={urgentStyle}>{footNote}</span>}
        </div>
      </div>
    </>
  );

  const className = `ev-card${soldOut ? ' is-soldout' : ''}`;
  const style = animationDelayMs !== undefined ? { animationDelay: `${animationDelayMs}ms` } : undefined;

  // Ausverkaufte Events bleiben anklickbar; die Kaufseite zeigt die Warteliste
  // (Pro-Veranstalter) und alle Details.
  if (!href) return <div className={className} style={style}>{inner}</div>;
  return <Link href={href} className={className} style={style}>{inner}</Link>;
}

/**
 * Generative Optik fuer Events ohne eigenes Bild — ein aus dem Namen
 * abgeleiteter Verlauf, damit die Liste nie graue Luecken zeigt.
 */
export function eventHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function EventArt({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- storage host is env-dependent, skip next/image remotePatterns
    return <img src={imageUrl} alt="" loading="lazy" />;
  }
  const hue = eventHue(name);
  const hue2 = (hue + 50) % 360;
  return (
    <div
      className="art-bg"
      style={{
        background: `radial-gradient(ellipse at 30% 40%, oklch(0.88 0.09 ${hue}), transparent 60%), radial-gradient(ellipse at 70% 65%, oklch(0.90 0.07 ${hue2}), transparent 55%), oklch(0.95 0.02 ${hue})`,
      }}
    />
  );
}

/**
 * Karten-CSS, wortgleich aus src/app/events/page.tsx uebernommen.
 *
 * Die mobilen Regeln liegen im eigenen Media-Block dieser Datei. Die
 * Saisonpass-Karte ueberschreibt einzelne dieser Regeln
 * (`.ev-pass-card .ev-cta`) und gewinnt ueber Spezifitaet, unabhaengig davon,
 * wo dieser Block eingesetzt wird.
 *
 * Setzt `@keyframes ev-rise` voraus; die Seite bringt sie mit.
 */
export const EVENT_CARD_CSS = `
  .ev-card {
    display: flex; flex-direction: column;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 18px; overflow: hidden; box-shadow: var(--shadow);
    color: inherit;
    transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.35s, border-color 0.35s;
    animation: ev-rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .ev-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); border-color: var(--accent-line); }
  .ev-card-art { position: relative; aspect-ratio: 4 / 3; background: var(--surface-3); overflow: hidden; }
  .ev-card-art img, .ev-card-art .art-bg {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .ev-card:hover .ev-card-art img, .ev-card:hover .ev-card-art .art-bg { transform: scale(1.04); }
  .ev-datebadge {
    position: absolute; top: 12px; left: 12px;
    display: flex; flex-direction: column; align-items: center;
    width: 2.75rem; padding: 0.38rem 0 0.44rem; border-radius: 11px;
    background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(8px);
    box-shadow: 0 4px 14px rgba(17, 20, 45, 0.16); pointer-events: none;
  }
  .ev-datebadge .m {
    font-size: 0.59rem; font-weight: 700; letter-spacing: 0.09em;
    color: var(--accent); text-transform: uppercase;
  }
  .ev-datebadge .d { font-size: 1.12rem; font-weight: 640; letter-spacing: -0.03em; line-height: 1.1; color: var(--ink); }
  .ev-badge {
    position: absolute; top: 14px; right: 12px;
    padding: 0.31rem 0.62rem; border-radius: 8px;
    font-size: 0.72rem; font-weight: 600;
    background: rgba(11, 8, 26, 0.62); color: #fff;
    backdrop-filter: blur(8px); pointer-events: none;
  }
  .ev-card-body { display: flex; flex-direction: column; gap: 0.88rem; padding: 1.12rem 1.12rem 1.25rem; flex: 1; }
  .ev-card-eyebrow { display: none; font-size: 0.69rem; font-weight: 700; letter-spacing: 0.08em; color: var(--accent); }
  .ev-card h3 { margin: 0; font-size: 1.06rem; font-weight: 620; letter-spacing: -0.025em; line-height: 1.3; }
  .ev-card-sub { margin: 0.44rem 0 0; font-size: 0.84rem; color: var(--ink-3); }
  .ev-progress { display: flex; flex-direction: column; gap: 0.44rem; margin-top: auto; }
  .ev-track { height: 0.25rem; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
  .ev-fill { height: 100%; border-radius: 999px; transition: width 0.3s; }
  .ev-progress-label { font-size: 0.75rem; color: var(--ink-3); }
  .ev-card-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    padding-top: 0.88rem; border-top: 1px solid var(--line);
  }
  .ev-price { font-size: 1.19rem; font-weight: 640; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  /* Optik kommt aus .btn.primary / .btn.ghost in globals.css — die Karte legt
     nur den Hover der ganzen Karte darueber. Ausverkauft/Warteliste ist
     .btn.ghost, deshalb gibt es hier keine eigene .waitlist-Variante mehr. */
  .ev-cta { gap: 0.44rem; }
  .ev-card:hover .ev-cta.primary { background: var(--accent-2); }
  .ev-card:hover .ev-cta.ghost { background: var(--surface-2); border-color: var(--ink-4); }
  .ev-foot-note { display: none; font-size: 0.75rem; color: var(--ink-3); }
  .ev-card.is-soldout .ev-card-art img, .ev-card.is-soldout .ev-card-art .art-bg { filter: grayscale(0.7); opacity: 0.75; }
  .ev-card.is-soldout .ev-price { color: var(--ink-3); }

  @media (max-width: 48.75em) {
    .ev-card { flex-direction: row; gap: 0.81rem; padding: 0.75rem; border-radius: 16px; }
    .ev-card:hover { transform: none; }
    .ev-card-art {
      width: 5.75rem; height: 5.75rem; flex: none;
      aspect-ratio: auto; border-radius: 12px;
    }
    .ev-datebadge, .ev-badge, .ev-progress { display: none; }
    /* Ueber .ev-card, damit die Regel den .btn-Basisstil sicher schlaegt. */
    .ev-card .ev-cta { display: none; }
    .ev-card-body { padding: 0; gap: 0.38rem; min-width: 0; }
    .ev-card-eyebrow { display: block; }
    .ev-card h3 { font-size: 0.94rem; font-weight: 620; letter-spacing: -0.02em; }
    .ev-card-sub { margin: 0; font-size: 0.78rem; }
    .ev-card-foot { border-top: none; padding-top: 0; margin-top: auto; }
    .ev-price { font-size: 0.94rem; }
    .ev-foot-note { display: block; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ev-card { animation: none; }
    .ev-card, .ev-card-art img, .ev-card-art .art-bg { transition: none; }
    .ev-card:hover { transform: none; }
  }
`;
