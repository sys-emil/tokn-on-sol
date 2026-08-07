'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/app/components/passlyUi';

export interface TabPanel {
  key: string;
  label: string;
  node: ReactNode;
}

/**
 * Grosse Tabs, die man per Pfeil links/rechts durchklickt.
 *
 * Alle Panels liegen gleichzeitig im DOM auf einer horizontalen Spur; der
 * Wechsel ist ein `translateX`. Die Hoehe des Rahmens folgt dem aktiven Panel
 * (ResizeObserver), sonst wuerde die Seite immer auf das laengste Panel
 * aufgeblasen und unter dem kurzen Tab klaffte ein Loch.
 */
export default function EventTabs({
  panels,
  prevLabel,
  nextLabel,
  tablistLabel,
}: {
  panels: TabPanel[];
  prevLabel: string;
  nextLabel: string;
  tablistLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const clamp = (next: number) => Math.max(0, Math.min(panels.length - 1, next));

  const go = useCallback(
    (next: number) => {
      const target = clamp(next);
      setIndex(target);
      // Die Tableiste scrollt auf schmalen Schirmen; ohne das kann der gerade
      // aktivierte Tab ausserhalb des Sichtfelds landen. `block: nearest`
      // haelt die Seite selbst ruhig.
      tabRefs.current[target]?.scrollIntoView({ block: 'nearest', inline: 'center' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp haengt nur an panels.length
    [panels.length],
  );

  // Die Messung passiert im ResizeObserver-Callback (feuert direkt beim
  // observe), nicht im Effect-Rumpf — so bleibt der erste Frame korrekt und
  // spaetere Umbrueche werden mitgenommen.
  //
  // Gemessen wird das Panel selbst, nicht sein Inhalt: .sc-panel traegt
  // vertikales Padding (28px oben, 8px unten), das in der Hoehe des Inhalts
  // nicht steckt. Wurde der Inhalt gemessen, war der Viewport um genau diese
  // 36px zu niedrig und schnitt das Panel unten ab.
  useEffect(() => {
    const el = panelRefs.current[index];
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  // Roving tabindex: nur der aktive Tab ist per Tab erreichbar, also muss der
  // Fokus den Pfeiltasten folgen — sonst sitzt er auf einem Knopf mit
  // tabIndex -1 fest und die naechste Pfeiltaste kommt nie an.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = e.key === 'ArrowRight' ? index + 1 : e.key === 'ArrowLeft' ? index - 1 : null;
    if (next === null) return;
    e.preventDefault();
    go(next);
    tabRefs.current[clamp(next)]?.focus();
  };

  return (
    <div className="sc-tabs">
      <div className="sc-tabbar">
        <button
          type="button"
          className="sc-arrow"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label={prevLabel}
        >
          <Icon name="chevronLeft" size={20} />
        </button>

        <div className="sc-tablist" role="tablist" aria-label={tablistLabel} onKeyDown={onKeyDown}>
          {panels.map((p, i) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              ref={(el) => { tabRefs.current[i] = el; }}
              id={`sc-tab-${p.key}`}
              aria-selected={i === index}
              aria-controls={`sc-panel-${p.key}`}
              tabIndex={i === index ? 0 : -1}
              className={`sc-tab${i === index ? ' active' : ''}`}
              onClick={() => go(i)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="sc-arrow"
          onClick={() => go(index + 1)}
          disabled={index === panels.length - 1}
          aria-label={nextLabel}
        >
          <Icon name="chevronRight" size={20} />
        </button>
      </div>

      <div
        className="sc-viewport"
        style={height ? { height } : undefined}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          const t = e.changedTouches[0];
          touchStart.current = null;
          if (!start || !t) return;
          const dx = t.clientX - start.x;
          // Senkrechte Wischer sind Scrollen, keine Tab-Wechsel.
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(t.clientY - start.y)) return;
          go(dx < 0 ? index + 1 : index - 1);
        }}
      >
        <div className="sc-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {panels.map((p, i) => (
            <div
              key={p.key}
              ref={(el) => { panelRefs.current[i] = el; }}
              className="sc-panel"
              role="tabpanel"
              id={`sc-panel-${p.key}`}
              aria-labelledby={`sc-tab-${p.key}`}
              // Inaktive Panels bleiben im DOM (der Slide braucht sie), aber
              // weder in der Tabreihenfolge noch im Accessibility-Baum.
              inert={i !== index}
            >
              {p.node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Bildergalerie mit denselben Pfeilen wie die Tabs. Eigene Komponente, weil
 * sie nur URLs braucht und damit im Panel des Servers bleiben kann.
 */
export function Gallery({
  images,
  prevLabel,
  nextLabel,
  countTemplate,
  alt,
}: {
  images: string[];
  prevLabel: string;
  nextLabel: string;
  /**
   * Uebersetzte Vorlage "Bild {index} von {total}". Bewusst ein String und
   * keine Funktion: die Server Component kann keine Funktion ueber die
   * RSC-Grenze reichen.
   */
  countTemplate: string;
  alt: string;
}) {
  const [index, setIndex] = useState(0);
  const total = images.length;
  const go = (next: number) => setIndex((next + total) % total);
  const countLabel = (i: number, n: number) =>
    countTemplate.replace('{index}', String(i)).replace('{total}', String(n));

  return (
    <div className="sc-gallery">
      <div className="sc-gallery-stage">
        {/* eslint-disable-next-line @next/next/no-img-element -- storage host is env-dependent, skip next/image remotePatterns */}
        <img src={images[index]} alt={alt} />
        {total > 1 && (
          <>
            <button type="button" className="sc-gallery-nav prev" onClick={() => go(index - 1)} aria-label={prevLabel}>
              <Icon name="chevronLeft" size={20} />
            </button>
            <button type="button" className="sc-gallery-nav next" onClick={() => go(index + 1)} aria-label={nextLabel}>
              <Icon name="chevronRight" size={20} />
            </button>
          </>
        )}
      </div>
      {total > 1 && (
        <>
          <div className="sc-gallery-thumbs">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                className={`sc-thumb${i === index ? ' active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={countLabel(i + 1, total)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <div className="sc-gallery-count">{countLabel(index + 1, total)}</div>
        </>
      )}
    </div>
  );
}
