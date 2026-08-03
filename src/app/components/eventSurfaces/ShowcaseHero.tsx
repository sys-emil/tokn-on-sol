import Link from 'next/link';
import { Icon, VerifiedCheck } from '@/app/components/passlyUi';

/**
 * Der dunkle Kopf der Event-Seite /event/[id].
 *
 * Wie `EventCard` liegt er hier, damit die Live-Vorschau im Event-Editor
 * denselben Hero rendert wie die echte Seite. Reine Darstellung: Preis,
 * Gebuehrenzeile und Datum kommen fertig formatiert herein.
 */

export interface ShowcaseHeroProps {
  name: string;
  /** Bild oder Verlauf, absolut positioniert. */
  art: React.ReactNode;
  /** Kurzform fuer den Datums-Chip, z. B. "SEP 5 · 20:00 Uhr" */
  whenLabel: string;
  venue?: string | null;
  organizerName?: string | null;
  organizerHandle?: string | null;
  organizerVerified?: boolean;
  organizerVerifiedLabel?: string | null;
  verifiedLabel: string;
  priceLabel: string;
  feeLabel?: string | null;
  trustLabel: string;
  backLabel: string;
  ctaLabel: string;
  /** Ziel des CTA; fehlt es, rendert der Knopf als nicht klickbarer Block (Vorschau). */
  ctaHref?: string;
  /** Ausverkauft oder abgesagt: CTA gedimmt. */
  ctaDisabled?: boolean;
  cancelledText?: string | null;
  /** In der Vorschau gibt es kein „Alle Events“. */
  backHref?: string | null;
  /** Ort als Karten-Deeplink. In der Vorschau aus, dort fuehrt kein Link hinaus. */
  venueLink?: boolean;
}

export function ShowcaseHero({
  name,
  art,
  whenLabel,
  venue,
  organizerName,
  organizerHandle,
  organizerVerified = false,
  organizerVerifiedLabel,
  verifiedLabel,
  priceLabel,
  feeLabel,
  trustLabel,
  backLabel,
  ctaLabel,
  ctaHref,
  ctaDisabled = false,
  cancelledText,
  backHref = '/events',
  venueLink = false,
}: ShowcaseHeroProps) {
  const organizerBlock = organizerName && (
    <>
      {organizerName}
      {organizerVerified && <VerifiedCheck size={15} title={organizerVerifiedLabel ?? verifiedLabel} />}
      <span className="sc-hero-chip"><Icon name="shield" size={11} />{verifiedLabel}</span>
    </>
  );

  return (
    <div className="sc-hero">
      <div className="sc-hero-art">{art}</div>
      <div className="sc-hero-scrim" aria-hidden="true" />
      <div className="sc-hero-inner">
        <div className="sc-hero-copy">
          {backHref && (
            <Link href={backHref} className="sc-back"><Icon name="chevronLeft" size={14} />{backLabel}</Link>
          )}
          <span className="sc-when"><Icon name="calendar" size={13} />{whenLabel}</span>
          <h1>{name}</h1>
          <div className="sc-hero-meta">
            {organizerName && (
              organizerHandle ? (
                <Link href={`/@${organizerHandle}`} className="sc-hero-org">{organizerBlock}</Link>
              ) : (
                <span className="sc-hero-org">{organizerBlock}</span>
              )
            )}
            {venue && (
              venueLink ? (
                <a className="sc-venue" href={`https://maps.google.com/?q=${encodeURIComponent(venue)}`} target="_blank" rel="noopener noreferrer">
                  <Icon name="location" size={15} />{venue}
                </a>
              ) : (
                <span><Icon name="location" size={15} />{venue}</span>
              )
            )}
          </div>
        </div>

        <div className="sc-buybox">
          {cancelledText ? (
            <div className="sc-cancelled">{cancelledText}</div>
          ) : (
            <>
              <span className="amount">{priceLabel}</span>
              {feeLabel && <span className="fee">{feeLabel}</span>}
              {ctaHref && !ctaDisabled ? (
                <Link href={ctaHref} className="sc-cta">{ctaLabel} <Icon name="arrow" size={17} /></Link>
              ) : (
                <span className={`sc-cta${ctaDisabled ? ' disabled' : ''}`}>
                  {ctaLabel}{!ctaDisabled && <Icon name="arrow" size={17} />}
                </span>
              )}
              <div className="trust"><Icon name="shield" size={14} />{trustLabel}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hero-CSS, wortgleich aus src/app/event/[id]/page.tsx uebernommen.
 * `.sc-hero-wrap` und die Fokusringe bleiben in der Seite, weil sie zum
 * Seitenlayout gehoeren, nicht zum Hero.
 */
export const SHOWCASE_HERO_CSS = `
  .sc-hero {
    position: relative; border-radius: 24px; overflow: hidden;
    background: var(--ink); color: #fff;
    box-shadow: 0 30px 70px -30px rgba(17, 20, 45, 0.45), 0 2px 8px rgba(17, 20, 45, 0.08);
  }
  .sc-hero-art { position: absolute; inset: 0; }
  .sc-hero-art img, .sc-hero-art .sc-art-bg {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  }
  .sc-hero-scrim {
    position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(100deg, rgba(11, 8, 26, 0.93) 0%, rgba(11, 8, 26, 0.72) 45%, rgba(11, 8, 26, 0.2) 80%),
      linear-gradient(0deg, rgba(11, 8, 26, 0.6), transparent 55%);
  }
  .sc-hero-inner {
    position: relative; display: grid; grid-template-columns: 1.4fr 0.6fr;
    gap: 40px; align-items: end; padding: 44px 40px 40px; min-height: 440px;
  }
  .sc-back {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.72); margin-bottom: 18px;
  }
  .sc-back:hover { color: #fff; }
  .sc-hero-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
  .sc-when {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.13); border: 1px solid rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(10px);
    font-size: 12px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; color: rgba(255, 255, 255, 0.92);
  }
  .sc-hero h1 {
    margin: 0; font-size: 52px; line-height: 1.04; font-weight: 640;
    letter-spacing: -0.04em; color: #fff; text-wrap: balance; max-width: 17ch;
    overflow-wrap: break-word;
  }
  .sc-hero-meta {
    display: flex; flex-wrap: wrap; align-items: center; gap: 20px;
    color: rgba(255, 255, 255, 0.82); font-size: 14.5px;
  }
  .sc-hero-meta span, .sc-hero-meta a { display: inline-flex; align-items: center; gap: 8px; color: inherit; }
  /* Nur der Ortslink wird unterstrichen. Ein pauschaler a-Selektor haette auch
     den Veranstalternamen samt Geprueft-Chip mit einer Linie durchzogen. */
  .sc-venue { text-decoration: underline; text-underline-offset: 3px; }
  .sc-hero-meta a:hover { color: #fff; }
  .sc-hero-org { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; color: inherit; }
  .sc-hero-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px; border-radius: 6px;
    background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.24);
    font-size: 11.5px; font-weight: 500; color: rgba(255, 255, 255, 0.9);
  }

  .sc-buybox {
    padding: 24px; border-radius: 18px;
    background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(22px) saturate(1.3);
    box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.5);
  }
  .sc-buybox .amount {
    display: block; font-size: 32px; font-weight: 640; letter-spacing: -0.035em;
    color: #fff; font-variant-numeric: tabular-nums;
  }
  .sc-buybox .fee { display: block; font-size: 12.5px; color: rgba(255, 255, 255, 0.6); margin-top: 4px; }
  .sc-cta {
    margin-top: 18px; display: flex; align-items: center; justify-content: center; gap: 8px;
    height: 48px; border-radius: 12px; background: #fff; color: var(--ink);
    font-size: 15px; font-weight: 640; transition: transform 0.2s, box-shadow 0.2s;
  }
  .sc-cta:hover { color: var(--ink); transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28); }
  .sc-cta.disabled { background: rgba(255, 255, 255, 0.18); color: rgba(255, 255, 255, 0.72); pointer-events: none; }
  .sc-buybox .trust {
    margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 7px;
    font-size: 12.5px; color: rgba(255, 255, 255, 0.66); text-align: center;
  }
  .sc-cancelled {
    margin-top: 4px; padding: 12px 14px; border-radius: 10px;
    background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.28);
    font-size: 13px; line-height: 1.55; color: rgba(255, 255, 255, 0.92);
  }

  @media (max-width: 780px) {
    .sc-hero { border-radius: 20px; }
    .sc-hero-inner {
      grid-template-columns: 1fr; gap: 18px; padding: 0;
      align-items: end; align-content: end;
      /* Bewusst min-height statt aspect-ratio: die 4:5-Anmutung bleibt, aber
         ein langer Eventname schiebt die Karte auf, statt oben abgeschnitten
         zu werden. */
      min-height: calc((100vw - 32px) * 1.25);
    }
    .sc-hero-scrim {
      background: linear-gradient(0deg, rgba(11, 8, 26, 0.94) 10%, rgba(11, 8, 26, 0.3) 58%, rgba(11, 8, 26, 0.08));
    }
    .sc-hero-copy { gap: 12px; padding: 18px 18px 0; }
    .sc-hero h1 { font-size: 27px; line-height: 1.12; max-width: none; }
    .sc-hero-meta { gap: 12px; font-size: 13px; }
    .sc-back { margin-bottom: 12px; }
    .sc-buybox {
      padding: 0 18px 18px; border: none; background: none;
      box-shadow: none; backdrop-filter: none; border-radius: 0;
    }
    .sc-buybox .amount { font-size: 24px; }
    .sc-buybox .trust { display: none; }
    .sc-cta { margin-top: 12px; height: 46px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sc-cta { transition: none; }
    .sc-cta:hover { transform: none; }
  }
`;

/** Dunkler Verlauf fuer Events ohne Bild — Gegenstueck zu `EventArt` auf hellem Grund. */
export function ShowcaseArt({ name, imageUrl, hue }: { name: string; imageUrl: string | null; hue: number }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- storage host is env-dependent, skip next/image remotePatterns
    return <img src={imageUrl} alt="" />;
  }
  void name;
  return (
    <div
      className="sc-art-bg"
      style={{
        background: `radial-gradient(ellipse at 30% 40%, oklch(0.72 0.15 ${hue}), transparent 60%), radial-gradient(ellipse at 70% 65%, oklch(0.66 0.13 ${(hue + 50) % 360}), transparent 55%), oklch(0.45 0.09 ${hue})`,
      }}
    />
  );
}
