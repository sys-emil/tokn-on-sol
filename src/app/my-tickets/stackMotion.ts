'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bewegung des Brieftaschen-Stapels auf /my-tickets.
 *
 * Warum hier ueberhaupt Code steht, wo vorher vier CSS-Transitions genuegten:
 *
 *  - Ein aufgefaecherter Kartenstapel ist das koerperlichste Ding der ganzen
 *    App. Er setzt die Erwartung, angefasst zu werden, und konnte bisher nur
 *    angeklickt werden.
 *  - CSS-Transitions sind nicht unterbrechbar. Waehrend der 340 ms, die das
 *    Auf- und Zuklappen brauchte, liess sich keine Karte greifen, und ein
 *    zweiter Klick startete die Gegenbewegung vom Zielwert statt vom Wert auf
 *    dem Bildschirm — sichtbar als Sprung.
 *  - Sie animierten `top`/`left`, also Layout-Eigenschaften: pro Karte und
 *    Bild ein Layout- und Paint-Durchgang. Hier laeuft alles ueber `transform`
 *    und damit ueber den Compositor.
 *
 * Federn statt Kurven, weil eine Feder immer vom aktuellen Wert aus rechnet:
 * Unterbrechen, Umlenken und die Uebergabe der Wischgeschwindigkeit sind damit
 * kostenlos, waehrend sie mit `transition` gar nicht gehen.
 *
 * Bewusst ohne Bibliothek — dieselbe Entscheidung wie bei der Tuerszene auf
 * der Landingpage (siehe docs/apple-design-plan.md).
 */

/** Apples Parameterpaar statt Masse/Steifigkeit/Daempfung. */
interface SpringParams {
  /** 1.0 = kritisch gedaempft, kein Ueberschwingen. < 1 federt nach. */
  damping: number;
  /** Sekunden bis zum Ziel. Keine Dauer — eine Feder hat keine. */
  response: number;
}

/** Umpositionieren; Apples Werte fuer „Move" (Bild-in-Bild). */
const MOVE: SpringParams = { damping: 1.0, response: 0.4 };
/** Nach einem Wisch darf es minimal nachfedern, weil ein Impuls voranging. */
const FLICK: SpringParams = { damping: 0.82, response: 0.34 };

/** Ab hier gilt eine Feder als angekommen und der Lauf darf enden. */
const REST_V = 0.4;
const REST_D = 0.08;

/** Bewegung, ab der aus einem Tippen ein Ziehen wird (§10). */
const HYSTERESIS = 10;

/**
 * Apples Projektion aus dem „Designing Fluid Interfaces"-Beispielcode: wohin
 * die Bewegung ausliefe, wenn man sie ausrollen liesse. Nicht die
 * Lehrbuchformel v²/(2a) — die ist es ausdruecklich nicht.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/**
 * Fortschreitender Widerstand jenseits einer Grenze, statt hart zu stoppen.
 * Ein harter Anschlag liest sich als „eingefroren"; nachlassender Widerstand
 * liest sich als „reagiert, aber hier ist nichts mehr".
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  const o = Math.abs(overshoot);
  return Math.sign(overshoot) * (o * dimension * constant) / (dimension + constant * o);
}

class Axis {
  value = 0;
  velocity = 0;
  target = 0;
  /** Solange gehalten, rechnet niemand — der Finger bestimmt den Wert. */
  held = false;

  constructor(initial = 0) { this.value = initial; this.target = initial; }

  step(dt: number, p: SpringParams): boolean {
    if (this.held) return true;
    const omega = (2 * Math.PI) / p.response;
    const k = omega * omega;
    const c = 2 * p.damping * omega;
    const d = this.value - this.target;
    // Semi-implizites Euler: erst die Geschwindigkeit, dann die Lage. Stabiler
    // als explizites Euler bei den kurzen Antwortzeiten hier.
    this.velocity += (-k * d - c * this.velocity) * dt;
    this.value += this.velocity * dt;
    if (Math.abs(this.velocity) < REST_V && Math.abs(this.value - this.target) < REST_D) {
      this.value = this.target;
      this.velocity = 0;
      return false;
    }
    return true;
  }

  snap(to: number) { this.value = to; this.target = to; this.velocity = 0; }
}

interface Card {
  el: HTMLElement | null;
  x: Axis;
  y: Axis;
  tilt: Axis;
  z: number;
  /** Nach einem Wisch federt die Karte leicht nach, sonst nicht (§4). */
  mode: SpringParams;
}

export interface CardTarget { x: number; y: number; tilt: number; z: number }

interface Options {
  /** Karten-IDs, vorderste zuerst. */
  order: string[];
  /** Ziel je Karte; wird bei jedem Layoutwechsel neu gelesen. */
  targets: Record<string, CardTarget>;
  /** Breite einer Karte — Massstab fuer Schwelle und Gummiband. */
  cardWidth: number;
  /** Wischen erlaubt (mehr als eine Karte im Stapel). */
  canAdvance: boolean;
  /** Der Wisch ist durchgegangen: die vorderste Karte wandert nach hinten. */
  onAdvance: () => void;
  /** Kein Ziehen, nur ein Tippen. */
  onTap: (id: string) => void;
  /** Systemeinstellung „Bewegung reduzieren": Ziele sofort einnehmen. */
  reducedMotion: boolean;
}

/**
 * Haelt die Karten in Bewegung und nimmt den Zeigerkontakt entgegen.
 *
 * React rendert die Karten ohne jede Positionsangabe; Lage, Neigung, Stapel-
 * ordnung und Deckkraft schreibt der Lauf direkt auf die Knoten. Ein Ziehen
 * loest deshalb kein einziges Rendern aus.
 */
export function useStackMotion(opts: Options) {
  const cards = useRef(new Map<string, Card>());
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  // Der Lauf und die Zeigerhandler lesen immer den jeweils neuesten Stand,
  // ohne dass ein neuer Stand den Lauf abreissen liesse.
  const o = useRef(opts);
  useEffect(() => { o.current = opts; });

  /** Zustand einer laufenden Zeigergeste. */
  const drag = useRef<{
    id: string; pointerId: number;
    startX: number; startY: number;
    baseX: number;
    moved: boolean;
    /** Kurze Historie fuer die Geschwindigkeit bei Loslassen (§5). */
    hist: { x: number; t: number }[];
  } | null>(null);

  const write = useCallback(() => {
    for (const c of cards.current.values()) {
      if (!c.el) continue;
      c.el.style.transform =
        `translate3d(${c.x.value.toFixed(2)}px, ${c.y.value.toFixed(2)}px, 0) ` +
        `rotate(${c.tilt.value.toFixed(3)}deg) scale(var(--press, 1))`;
      c.el.style.zIndex = String(c.z);
    }
  }, []);

  /** Ein Bild rechnen. Gibt zurueck, ob es weitergehen muss. */
  const tick = useCallback((now: number) => {
    const dt = Math.min((now - last.current) / 1000, 1 / 30);
    last.current = now;
    let busy = false;
    const dragging = drag.current;
    for (const c of cards.current.values()) {
      const moving = c.x.step(dt, c.mode);
      const moved2 = c.y.step(dt, MOVE);
      const moved3 = c.tilt.step(dt, MOVE);
      if (moving || moved2 || moved3) busy = true;
      // Angekommen faellt sie in die ruhige Grundfeder zurueck, damit die
      // naechste Bewegung ohne Anlass nicht nachschwingt.
      else if (c.mode !== MOVE) c.mode = MOVE;
    }
    write();
    return busy || !!dragging;
  }, [write]);

  const tickRef = useRef<((now: number) => boolean) | null>(null);
  useEffect(() => { tickRef.current = tick; }, [tick]);

  /**
   * Startet den Lauf, falls er steht. Er haelt von selbst an, sobald alle
   * Federn sitzen und kein Finger mehr auf der Karte liegt — ein dauerhaft
   * laufendes requestAnimationFrame waere auf einer Seite, die meistens still
   * steht, reine Verschwendung.
   */
  const kick = useCallback(() => {
    if (raf.current != null) return;
    last.current = performance.now();
    const step = (now: number) => {
      const busy = tickRef.current?.(now) ?? false;
      raf.current = busy ? requestAnimationFrame(step) : null;
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  /** Neue Ziele uebernehmen, ohne die laufende Bewegung abzuschneiden. */
  const { targets, reducedMotion } = opts;
  useEffect(() => {
    for (const id of Object.keys(targets)) {
      const t = targets[id];
      let c = cards.current.get(id);
      if (!c) {
        // Neu im Stapel: dort anfangen, wo sie hingehoert, statt aus 0/0
        // hereinzufahren.
        c = { el: null, x: new Axis(t.x), y: new Axis(t.y), tilt: new Axis(t.tilt), z: t.z, mode: MOVE };
        cards.current.set(id, c);
      }
      c.z = t.z;
      if (reducedMotion) { c.x.snap(t.x); c.y.snap(t.y); c.tilt.snap(t.tilt); }
      else {
        c.x.target = t.x;
        c.y.target = t.y;
        c.tilt.target = t.tilt;
      }
    }
    for (const id of [...cards.current.keys()]) {
      if (!(id in targets)) cards.current.delete(id);
    }
    write();
    if (!reducedMotion) kick();
  }, [targets, reducedMotion, write, kick]);

  /**
   * Der abgebrochene Frame muss die Ref mit zurueckgeben. Ohne das zweite
   * `raf.current = null` blieb ein toter Handle stehen, und weil `kick()` bei
   * belegter Ref sofort umkehrt, sprang der Lauf nie wieder an — unter React
   * StrictMode (in der Entwicklung laeuft jeder Effekt doppelt: aufbauen,
   * abraeumen, aufbauen) hiess das: kein einziges Bild, die Karten sprangen
   * nur noch beim Rendern auf ihre Ziele.
   */
  useEffect(() => () => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  const setNode = useCallback((id: string, el: HTMLElement | null) => {
    const c = cards.current.get(id);
    if (c) { c.el = el; if (el) write(); }
  }, [write]);

  const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    // Nur die vorderste Karte laesst sich ziehen; die anderen liegen darunter
    // und haben ihre eigene Bedeutung (nach vorn holen).
    if (e.button !== 0 || id !== o.current.order[0]) return;
    const c = cards.current.get(id);
    if (!c) return;
    // Der Fang haelt die Spur, auch wenn der Finger die Karte verlaesst. Er
    // wirft, wenn der Zeiger nicht (mehr) aktiv ist — die Geste darf daran
    // nicht scheitern, sie laeuft dann eben ohne Fang weiter.
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* kein Fang noetig */ }
    drag.current = {
      id, pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      baseX: c.x.value,
      moved: false,
      hist: [{ x: e.clientX, t: performance.now() }],
    };
    kick();
  }, [kick]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      // Erst ab der Hysterese wird daraus ein Ziehen. Ueberwiegt die
      // Senkrechte, gehoert die Geste dem Scrollen — Finger weg.
      if (Math.abs(dx) < HYSTERESIS && Math.abs(dy) < HYSTERESIS) return;
      if (Math.abs(dy) > Math.abs(dx)) { drag.current = null; return; }
      d.moved = true;
    }
    const c = cards.current.get(d.id);
    if (!c) return;
    d.hist.push({ x: e.clientX, t: performance.now() });
    if (d.hist.length > 6) d.hist.shift();

    // 1:1 unter dem Finger. Gibt es nichts, wohin die Karte weichen koennte,
    // wird der Weg zunehmend zaeh statt hart begrenzt (§9).
    const free = o.current.canAdvance;
    const offset = free ? dx : rubberband(dx, o.current.cardWidth);
    c.x.held = true;
    c.x.value = d.baseX + offset;
    c.x.velocity = 0;
    // Die Neigung zeigt in die Richtung, in die es geht (§8).
    c.tilt.held = true;
    c.tilt.value = c.tilt.target + Math.max(-7, Math.min(7, offset / 26));
  }, []);

  const endDrag = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    const c = cards.current.get(d.id);
    if (!c) return;
    c.x.held = false;
    c.tilt.held = false;

    if (!d.moved) { o.current.onTap(d.id); return; }

    // Geschwindigkeit aus der Historie, nicht aus dem letzten Ereignispaar:
    // ein einzelnes Paar mit ~0 ms Abstand liefert Unsinn.
    const hist = d.hist;
    const first = hist[0];
    const lastP = hist[hist.length - 1];
    const dtMs = Math.max(1, lastP.t - first.t);
    const velocity = ((lastP.x - first.x) / dtMs) * 1000;

    const travelled = c.x.value - c.x.target;
    // Nicht vom Loslasspunkt aus entscheiden, sondern von dort, wo die
    // Bewegung auslaufen wuerde — das macht aus einem kurzen Schnipser eine
    // grosse Wirkung (§6).
    const projected = travelled + project(velocity);
    const threshold = o.current.cardWidth * 0.38;

    // In beiden Faellen bekommt die Feder die Fingergeschwindigkeit als
    // Anfangswert: zwischen Ziehen und Weiterlaufen darf keine Naht stehen
    // (§5). Sie federt jetzt leicht nach, weil ein Impuls voranging (§4).
    c.x.velocity = velocity;
    c.mode = FLICK;
    if (o.current.canAdvance && Math.abs(projected) > threshold) {
      // Durchgewischt. Das neue Ziel liefert die geaenderte Reihenfolge, nicht
      // dieser Aufruf — die Karte laeuft also ohne Bruch von ihrer aktuellen
      // Lage an ihren neuen Platz hinten im Stapel.
      o.current.onAdvance();
    }
    kick();
  }, [kick]);

  return { setNode, onPointerDown, onPointerMove, onPointerUp: endDrag };
}


/**
 * Systemeinstellung „Bewegung reduzieren", als Wert statt als Media-Query im
 * CSS — der Stapel bewegt sich in JavaScript, also muss die Abfrage dort
 * ankommen. Startet bewusst mit `false`: der Server kennt die Einstellung
 * nicht, und ein Umschalten nach dem ersten Bild ist harmloser als eine
 * Abweichung zwischen Server- und Client-Markup.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return reduced;
}
