'use client';

import { useEffect, useRef } from 'react';
import { TodayStamp } from '@/app/components/TodayStamp';

/**
 * Hero ticket mockup — 1:1 aus passly-hero.html übernommen.
 *
 * Client component, weil die Kippbewegung am Zeiger hängt: der Zeiger-Offset
 * zur Kartenmitte wird direkt auf rotateY/rotateX gelegt, beim Verlassen
 * federt die Karte in ihre Ruhelage zurück. Das Datum kommt weiterhin aus
 * <TodayStamp>, damit im Mockup nicht irgendwann ein Datum von gestern steht.
 *
 * **Zeiger, nicht Maus** (seit 2026-09-10). Vorher hingen die Handler an
 * `mousemove`/`mouseleave`, und damit passierte auf dem Telefon bei einer
 * Berührung *gar nichts* — ausgerechnet dort, wo der Großteil des kalten
 * Traffics ankommt. Auf Touch gibt es kein Hover: `pointermove` feuert dort
 * erst während einer Berührung, der Ablauf ist `down → move → up` statt
 * `move → leave`. Deshalb kippt `pointerdown` die Karte sofort in Richtung
 * Finger — das ist die Rückmeldung auf den Druck — und `pointerup` /
 * `pointercancel` lassen sie zurückfedern.
 *
 * Ohne Zeiger kippt die Karte von selbst weiter (`heroTicketIdle`) — dieselbe
 * Bewegung wie unter der Maus, nur langsamer und an Ort und Stelle. Damit wirkt
 * der Hero nicht wie ein Screenshot. Sie ersetzt aber keine Reaktion, sondern
 * nur die Bewegung; die Reaktion kommt seit der Umstellung von den
 * Zeiger-Handlern.
 */

const REST_TRANSFORM = 'rotateY(-8deg) rotateX(4deg) rotate(1.5deg)';

export function HeroTicket() {
  const ref = useRef<HTMLDivElement>(null);

  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Letzte Zeigerposition und -zeit, nur fuer die Geschwindigkeit beim
  // Loslassen. performance.now() statt ev.timeStamp, damit die Rechnung nicht
  // an der Zeitbasis des Events haengt.
  const last = useRef<{ x: number; y: number; t: number } | null>(null);
  const speed = useRef(0);

  // Das Kippen liegt in JS und wurde deshalb von der CSS-Regel, die die
  // Idle-Animation abschaltet, nie erfasst — eine Luecke, die mit dem
  // Touch-Pfad groesser wird: bisher traf sie nur Maus-Nutzer, jetzt jeden.
  // Eine MediaQueryList reicht fuer die Lebensdauer der Komponente, .matches
  // ist immer aktuell.
  const reduceMotion = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)');
    return () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); };
  }, []);

  const motionOff = () => reduceMotion.current?.matches === true;

  /** Die Idle-Animation weichen lassen und die Karte uebernehmen. */
  function beginTilt(el: HTMLDivElement) {
    // Die Idle-Animation muss weichen, nicht nur pausieren: eine laufende
    // CSS-Animation schlaegt im Cascade jede Inline-Transformation, die
    // Karte wuerde dem Zeiger sonst gar nicht folgen.
    if (resumeTimer.current) { clearTimeout(resumeTimer.current); resumeTimer.current = null; }
    el.classList.add('is-tilting');
  }

  /** Kippt die Karte in Richtung eines Punktes im Fenster. */
  function tiltTo(el: HTMLDivElement, clientX: number, clientY: number) {
    const r = el.getBoundingClientRect();
    const dx = (clientX - r.left) / r.width - 0.5;
    const dy = (clientY - r.top) / r.height - 0.5;
    el.style.transition = 'transform 120ms cubic-bezier(.22,.61,.36,1)';
    el.style.transform =
      `rotateY(${-8 + dx * 22}deg) rotateX(${4 - dy * 18}deg) rotate(1.5deg) translateZ(14px)`;
  }

  function handleDown(ev: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || motionOff()) return;
    // Mit Capture folgt die Karte auch, wenn der Finger ueber ihren Rand
    // hinauswandert — und der Browser liefert uns danach zuverlaessig ein
    // pointerup oder pointercancel, worauf die Rueckkehr haengt.
    try { el.setPointerCapture(ev.pointerId); } catch { /* aeltere Engines */ }
    beginTilt(el);
    last.current = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    speed.current = 0;
    tiltTo(el, ev.clientX, ev.clientY);
  }

  function handleMove(ev: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || motionOff()) return;
    const now = performance.now();
    const prev = last.current;
    if (prev && now > prev.t) {
      speed.current = Math.hypot(ev.clientX - prev.x, ev.clientY - prev.y) / (now - prev.t);
    }
    last.current = { x: ev.clientX, y: ev.clientY, t: now };
    beginTilt(el);
    tiltTo(el, ev.clientX, ev.clientY);
  }

  function handleLeave() {
    const el = ref.current;
    // Nur zurueckholen, was ueberhaupt gekippt ist. Fangt nebenbei den
    // Touch-Ablauf ab, bei dem nach pointerup noch ein pointerleave folgt.
    if (!el || !el.classList.contains('is-tilting')) return;
    // Die Zeigergeschwindigkeit geht in die Rueckkehr ein: ein schnelles
    // Wegreissen und ein langsames Verlassen bekamen vorher dieselbe traege
    // 700ms-Kurve, und im Moment des Loslassens brach die Bewegung sichtbar ab.
    // Ueber 1 px/ms (etwa „zuegig") wird nicht weiter verkuerzt. Wurde die
    // Bewegung waehrend einer Beruehrung abgeschaltet, geht es ohne Feder
    // zurueck — sonst bliebe die Karte gekippt stehen.
    const ms = motionOff() ? 0 : Math.round(700 - Math.min(speed.current, 1) * 260);
    el.style.transition = `transform ${ms}ms cubic-bezier(.16,1,.3,1)`;
    el.style.transform = REST_TRANSFORM;
    last.current = null;
    speed.current = 0;
    // Erst zurueckfedern lassen, dann die Drift wieder uebernehmen. Sofort
    // wieder anzuschalten wuerde die Feder ueberspringen, weil die Animation
    // ab ihrem ersten Frame gewinnt. Der Timer folgt deshalb der tatsaechlichen
    // Dauer, nicht mehr einer festen 700.
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      ref.current?.classList.remove('is-tilting');
      resumeTimer.current = null;
    }, ms);
  }

  function handleUp(ev: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    if (el.hasPointerCapture?.(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    // Bei der Maus steht der Zeiger nach dem Loslassen weiter auf der Karte —
    // dort beendet erst pointerleave die Kippbewegung, sonst federte die Karte
    // bei jedem Klick kurz zurueck und wuerde vom naechsten pointermove sofort
    // wieder aufgerichtet. Ein Finger dagegen ist mit dem Loslassen weg.
    if (ev.pointerType !== 'mouse') handleLeave();
  }

  return (
    <div className="hero-v2-mock" aria-hidden="true">
      <style>{HERO_TICKET_CSS}</style>
      <div
        ref={ref}
        className="hero-v2-ticket"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={handleLeave}
        style={{
          position: 'relative',
          flex: 'none',
          width: 352,
          borderRadius: 24,
          overflow: 'hidden',
          // Flaeche und Rahmen stehen in HERO_TICKET_CSS, nicht hier: ein
          // Inline-Style ist fuer @media (prefers-reduced-transparency) nicht
          // erreichbar.
          boxShadow:
            '0 44px 90px -30px rgba(40,20,90,.45), 0 10px 26px rgba(17,20,45,.10), inset 0 1px 0 rgba(255,255,255,.9)',
          transform: REST_TRANSFORM,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 24 }}>
          {/* Breite relativ zur Karte, sonst endet der Sweep bei fester px-Breite
              je nach Kartenbreite an einer anderen Stelle. top/bottom ziehen den
              Streifen über den Rand hinaus, damit die Schräge oben und unten
              nicht als Ecke sichtbar wird. */}
          <div
            className="hero-v2-shimmer"
            style={{
              position: 'absolute',
              top: '-20%',
              bottom: '-20%',
              left: 0,
              width: '22%',
              background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)',
              transform: 'translateX(-140%) skewX(-18deg)',
              willChange: 'transform',
              animation: 'shimmerSweep 6s linear infinite',
            }}
          />
        </div>

        <div
          style={{
            padding: '22px 22px 26px',
            background: 'linear-gradient(150deg, oklch(0.34 0.16 288), oklch(0.26 0.12 300) 62%, oklch(0.30 0.14 260))',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                font: '500 10px var(--font)',
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.62)',
              }}
            >
              Eintritt · 1 Person
            </span>
          </div>
          <div style={{ marginTop: 16, font: '600 21px/1.2 var(--font)', letterSpacing: '-0.03em' }}>
            Die beste Nacht des Jahres
          </div>
          <div style={{ marginTop: 7, font: '400 12.5px var(--font)', color: 'rgba(255,255,255,.66)' }}>
            <TodayStamp suffix=" · Einlass 20:00 · Halle 7" />
          </div>
        </div>

        <div style={{ position: 'relative', height: 22, background: '#fff' }}>
          <div style={{ position: 'absolute', left: -11, top: -11, width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.90 0.06 300)' }} />
          <div style={{ position: 'absolute', right: -11, top: -11, width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.90 0.06 300)' }} />
          <div style={{ position: 'absolute', left: 20, right: 20, top: 10, borderTop: '2px dashed var(--line-2)' }} />
        </div>

        <div style={{ background: '#fff', padding: '8px 24px 24px', display: 'grid', placeItems: 'center' }}>
          <div
            style={{
              width: 206,
              height: 206,
              borderRadius: 20,
              background: 'linear-gradient(180deg,var(--accent-wash),#fff)',
              border: '1px solid var(--accent-line)',
              boxShadow: 'inset 0 1px 0 #fff,0 2px 10px rgba(17,20,45,.06)',
              color: 'var(--accent)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg width="158" height="158" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3z" />
              <path d="M19 14h2" />
              <path d="M14 19h3" />
              <path d="M19 19v2" />
            </svg>
          </div>
          <div
            style={{
              marginTop: 14,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 14,
              borderTop: '1px solid var(--line)',
            }}
          >
            <div>
              <div style={{ font: '500 9.5px var(--font)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>Ticket</div>
              <div style={{ marginTop: 3, font: '500 12.5px var(--mono)', color: 'var(--ink)' }}>#PSL-K4X2</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '500 9.5px var(--font)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>Kategorie</div>
              <div style={{ marginTop: 3, font: '500 12.5px var(--font)', color: 'var(--ink)' }}>Frühbucher</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Alles an der Karte, was eine Regel braucht statt eines Inline-Styles:
   die durchscheinende Flaeche (wegen der Media Query) und die Idle-Bewegung. */
const HERO_TICKET_CSS = `
  /* Kein backdrop-filter: die Kinder decken die Flaeche vollstaendig ab, der
     Blur war unsichtbar — kostete aber pro Shimmer-Frame ein Neuberechnen des
     Hintergrunds und war die Ursache des Ruckelns. Nicht zurueckbauen. */
  .hero-v2-ticket {
    background: rgba(255,255,255,.72);
    border: 1px solid rgba(255,255,255,.85);

    /* pan-y: ein Ziehen quer ueber die Karte kippt sie, ein senkrechtes
       Ziehen scrollt die Seite. Ohne diese Zeile wuerde ein Wisch auf dem
       groessten Element ueber der Falz das Scrollen abwuergen — und der
       Browser bricht unsere Geste sauber mit pointercancel ab, worauf
       handleUp die Karte zurueckfedern laesst.

       user-select: none, weil ein Ziehen mit der Maus sonst den Text im
       Mockup markiert statt die Karte zu kippen. Die Karte ist aria-hidden
       und reine Dekoration; es geht dort nichts zum Kopieren verloren. */
    touch-action: pan-y;
    -webkit-user-select: none; user-select: none;
  }
  /* Die Karte liegt ueber Aurora, Glow und dem Hero-Verlaufsfeld — genau der
     Stapel „helle durchscheinende Flaeche auf heller durchscheinender
     Flaeche". Wer Transparenz abschaltet, bekommt hier eine deckende Karte. */
  @media (prefers-reduced-transparency: reduce) {
    .hero-v2-ticket { background: #fff; border-color: oklch(0.90 0.02 300); }
  }

  /* Dieselbe Bewegung wie unter dem Zeiger, nur von allein: die Karte kippt
     auf beiden Achsen und bleibt dabei an Ort und Stelle — keine Verschiebung,
     kein translateZ. Der Ausschlag liegt bei gut zwei Dritteln dessen, was die
     Maus erreicht (die kommt auf rund +/-11 Grad seitlich) und bleibt damit im
     selben Bereich, den der Zeiger auch abfahren wuerde. rotate(1.5deg)
     bleibt fest, genau wie im Zeiger-Handler: das ist die Schraeglage der
     Karte selbst.

     Vier Stationen im Kreis statt eines Hin und Her, sonst wirkt es wie ein
     Metronom. 0% und 100% tragen REST_TRANSFORM, damit das Ein- und
     Ausschalten der Animation an keiner Stelle springt. */
  .hero-v2-ticket { animation: heroTicketIdle 13s ease-in-out infinite; }
  .hero-v2-ticket.is-tilting { animation: none; }
  @keyframes heroTicketIdle {
    0%   { transform: rotateY(-8deg) rotateX(4deg) rotate(1.5deg); }
    25%  { transform: rotateY(-16deg) rotateX(0deg) rotate(1.5deg); }
    50%  { transform: rotateY(-2deg) rotateX(9deg) rotate(1.5deg); }
    75%  { transform: rotateY(-13deg) rotateX(8deg) rotate(1.5deg); }
    100% { transform: rotateY(-8deg) rotateX(4deg) rotate(1.5deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-v2-ticket { animation: none; }
  }
`;
