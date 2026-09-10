'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Das Dashboard-Bild des Kapitels „Deine Zahlen“ — mit einer einmaligen,
 * scrollausgelösten Bewegung.
 *
 * Warum überhaupt Bewegung: die Fläche behauptet „so siehst du, wie der Abend
 * steht“. Ein Standbild behauptet das nur, ein Abend, der einläuft, zeigt es.
 * Deshalb liegt diese Komponente — wie `DoorScene` — in einer eigenen
 * Client-Datei; die übrigen Bilder in `ShowcaseMocks` bleiben serverseitig.
 *
 * Drei Regeln, an denen die Fassung hängt:
 *
 *  1. **Der Endzustand ist exakt das frühere Standbild.** Die Zahlen enden auf
 *     ihren Zielwerten, der Balken auf `scaleX(1)` einer Fläche, die schon
 *     immer `width: {Auslastung}%` breit war, und die Liste auf
 *     `translateY(0)`. Nichts an Inhalt, Farbe oder Maß ist neu.
 *  2. **Der Ausgangszustand steht schon im ersten Render**, also auch im HTML
 *     vom Server: Zahlen auf 0, Balken leer, Liste leer. Sonst blitzte beim
 *     Laden der Endzustand auf, und genau der soll ja erst entstehen.
 *  3. **Die Kartenhöhe bewegt sich nie.** Die Liste ist immer vollständig
 *     gerendert und wird nur verschoben; sichtbar wird sie durch einen
 *     Beschnitt (`overflow: hidden`) genau an der Oberkante der ersten Zeile.
 *     Eine Zeile, die „hereinkommt“, kommt damit hinter dem Auslastungsblock
 *     hervor — ohne dass irgendetwas nachrutscht.
 *
 * Die Liste ist ein einziges `translateY` auf dem Zeilenstapel, kein Ein- und
 * Ausblenden einzelner Zeilen: Stufe 3 steht auf 0 (alle drei sichtbar),
 * Stufe 2 eine Zeilenhöhe darüber, Stufe 1 zwei. Eine neue Zeile oben und das
 * Nachrutschen der bestehenden sind dadurch dieselbe Bewegung und können gar
 * nicht auseinanderlaufen. Die Verschiebung wird gemessen statt gerechnet,
 * weil die letzte Zeile keine Trennlinie hat und deshalb einen Pixel niedriger
 * ist als die beiden darüber.
 *
 * Keine Bibliothek: das sind ein Beobachter, ein `requestAnimationFrame` über
 * 1,4 s und drei Zeitgeber. Ein Animationspaket im Bundle wäre auf einer
 * Landingpage, die ihren Traffic aus einem Instagram-Link zieht, der teurere
 * Teil (dieselbe Abwägung wie in `DoorScene`).
 */

/* Der Server ruft keine Effekte auf; die Layout-Variante hätte dort nur eine
   Warnung übrig. Auf dem Client läuft sie vor dem ersten Paint — das ist der
   Grund für die Unterscheidung: Wer `prefers-reduced-motion` gesetzt hat,
   bekommt den Endzustand, ohne dass die Null davor je zu sehen war. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Dauer des Hochzählens; Balken und Zahlen teilen sie sich. */
const COUNT_MS = 1400;
/** Wann die drei Gäste eintreffen, gemessen ab dem Auslöser. */
const ROW_DELAYS_MS = [400, 1000, 1600];
/** Anteil der Karte, der im Bild stehen muss, damit es losgeht. */
const TRIGGER_RATIO = 0.4;

/** Sanftes Auslaufen statt abruptem Stopp. */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const NUM_DE = new Intl.NumberFormat('de-DE');

/**
 * Die Einnahmen kommen fertig formatiert herein („1.044 €“), gezählt werden
 * muss aber eine Zahl. Scheitert das Lesen, wird schlicht nicht gezählt und
 * die Beschriftung steht von Anfang an — lieber keine Bewegung als eine
 * falsche Zahl.
 */
function parseAmount(label: string): number | null {
  const m = label.match(/\d[\d.]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/\./g, ''));
  return Number.isFinite(n) ? n : null;
}

/* Die Gästeliste. Reihenfolge wie im Endzustand, von oben nach unten; sie
   erscheinen von unten nach oben, jede neue schiebt sich über die vorige. */
const ROWS = [
  { initials: 'MK', email: 'm•••@example.de', redeemed: true },
  { initials: 'JS', email: 'j•••@example.de', redeemed: true },
  { initials: 'AB', email: 'a•••@example.de', redeemed: false },
];

export interface DashboardMockProps {
  kicker?: string;
  title?: string;
  sold?: number;
  capacity?: number;
  redeemed?: number;
  /** Fertig formatiert, z. B. „1.044 €“. */
  revenueLabel?: string;
}

export function DashboardMock({
  kicker = 'Freitag, 5. September',
  title = 'Die beste Nacht des Jahres',
  sold = 87,
  capacity = 120,
  redeemed = 79,
  revenueLabel = '1.044 €',
}: DashboardMockProps = {}) {
  const occupancy = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
  const revenueTarget = parseAmount(revenueLabel);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  /** Fortschritt des Hochzählens, 0…1, bereits geglättet. */
  const [progress, setProgress] = useState(0);
  /** Wie viele Gäste stehen schon in der Liste, 0…3. */
  const [step, setStep] = useState(0);
  /**
   * Oberkanten der Zeilen relativ zum Stapel, plus dessen Gesamthöhe. Vor der
   * Messung verschiebt `-100%` den Stapel vollständig aus dem Beschnitt — das
   * ist derselbe Zustand, nur ohne Zahl, und deshalb auch das, was der Server
   * ausliefert.
   */
  const [offsets, setOffsets] = useState<number[] | null>(null);

  useIsoLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const base = list.getBoundingClientRect().top;
    setOffsets([
      ...rowRefs.current.map((el) => (el ? el.getBoundingClientRect().top - base : 0)),
      list.offsetHeight,
    ]);
  }, []);

  useIsoLayoutEffect(() => {
    const node = cardRef.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    /* Ohne Bewegung, ohne Beobachter oder ohne Karte: sofort der Endzustand.
       Nichts an dieser Fläche ist Information, die nur die Bewegung trägt. */
    if (reduce || typeof IntersectionObserver === 'undefined' || !node) {
      setProgress(1);
      setStep(ROWS.length);
      return;
    }

    let raf = 0;
    const timers: number[] = [];

    const start = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / COUNT_MS);
        setProgress(easeOutCubic(t));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      ROW_DELAYS_MS.forEach((delay, i) => {
        timers.push(window.setTimeout(() => setStep(i + 1), delay));
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          /* `isIntersecting` allein reicht nicht: der erste Rückruf kommt
             sofort und meldet auch 10 % als Schnitt. Gemeint sind 40 %. */
          if (entry.isIntersecting && entry.intersectionRatio >= TRIGGER_RATIO - 0.001) {
            io.disconnect();
            start();
            return;
          }
        }
      },
      { threshold: TRIGGER_RATIO },
    );
    io.observe(node);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, []);

  const done = progress >= 1;
  const soldNow = Math.round(progress * sold);
  const redeemedNow = Math.round(progress * redeemed);
  const occupancyNow = Math.round(progress * occupancy);
  const revenueNow =
    revenueTarget == null || done
      ? revenueLabel
      : `${NUM_DE.format(Math.round(progress * revenueTarget))} €`;

  /* Die Liste sitzt so, dass die zuletzt eingetroffene Zeile oben am
     Beschnitt steht: Stufe 3 = Zeile 0 oben = keine Verschiebung. */
  const listShift = offsets ? `${-offsets[ROWS.length - step]}px` : '-100%';

  return (
    <div className="dbm" ref={cardRef}>
      <div className="dbm-head">
        <div>
          <div className="dbm-kicker">{kicker}</div>
          <div className="dbm-title">{title}</div>
        </div>
        <span className="chip ok"><span className="d" />Läuft</span>
      </div>

      <div className="dbm-kpis">
        <div className="dbm-kpi">
          <div className="l">Verkauft</div>
          <div className="v">
            <span aria-hidden="true">{soldNow}</span>
            <span className="dbm-sr">{sold}</span>
            <span className="of"> / {capacity}</span>
          </div>
        </div>
        <div className="dbm-kpi">
          <div className="l">Eingelöst</div>
          <div className="v">
            <span aria-hidden="true">{redeemedNow}</span>
            <span className="dbm-sr">{redeemed}</span>
          </div>
        </div>
        <div className="dbm-kpi">
          <div className="l">Einnahmen</div>
          <div className="v">
            <span aria-hidden="true">{revenueNow}</span>
            <span className="dbm-sr">{revenueLabel}</span>
          </div>
        </div>
      </div>

      <div className="dbm-bar">
        <div className="dbm-barhead">
          <span>Auslastung</span>
          <span className="mono">
            <span aria-hidden="true">{occupancyNow}</span>
            <span className="dbm-sr">{occupancy}</span> %
          </span>
        </div>
        {/* Die Breite ist der Zielwert wie zuvor; gefüllt wird über `scaleX`,
            damit pro Bild nur der Compositor arbeitet. */}
        <div className="progress dbm-progress">
          <span style={{ width: `${occupancy}%`, transform: `scaleX(${progress})` }} />
        </div>
      </div>

      <div className="dbm-rows">
        <div className="dbm-rows-clip">
          <div className="dbm-rows-list" ref={listRef} style={{ transform: `translateY(${listShift})` }}>
            {ROWS.map((row, i) => (
              <div
                key={row.initials}
                className="dbm-row"
                ref={(el) => { rowRefs.current[i] = el; }}
                style={{ opacity: i >= ROWS.length - step ? 1 : 0 }}
              >
                <span className="dbm-av">{row.initials}</span>
                <span className="dbm-who">{row.email}</span>
                {row.redeemed
                  ? <span className="chip ok"><span className="d" />Eingelöst</span>
                  : <span className="chip"><span className="d" />Offen</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
