'use client';

import { useEffect, useRef } from 'react';

/**
 * Die Tür-Szene auf der Startseite: zwei Geräte, in zwei Schritten.
 *
 * **Zwei Schritte, von Federn getragen** (seit 2026-09-10; davor CSS-Übergänge,
 * davor eine scrollgebundene Fassung).
 *
 *  1. Der erste Auslöser führt die Geräte übereinander.
 *  2. Der zweite scannt.
 *
 * Die **scrollgebundene** Urfassung schrieb eine Zahl pro Frame über die
 * ganzen 240vh Scrollstrecke und ruckelte auf beiden Seiten. Diese Begründung
 * gilt weiter, und die Szene hängt bis heute nicht am Scrollbalken: der Scroll
 * löst nur aus, über zwei unsichtbare Marken und einen `IntersectionObserver`.
 * Kein Scroll-Listener.
 *
 * Der Schritt zu **Federn** hat einen anderen Grund. Eine CSS-Transition kann
 * ihr Ziel zwar mitten in der Bewegung wechseln, beginnt dann aber eine neue
 * Kurve bei Geschwindigkeit null — es hakt sichtbar. Eine Feder rechnet vom
 * aktuellen Wert *und* Tempo weiter. Das ist der Unterschied zwischen einer
 * abgespielten Aufzeichnung und einer Fläche, die dem Leser folgt (§3:
 * Unterbrechbarkeit ist das wichtigste Prinzip). Der Integrator steht unten,
 * er ist rund zwanzig Zeilen und braucht keine Bibliothek — für eine
 * Landingpage, die ihren kalten Traffic aus einem Instagram-Link bekommt, wäre
 * ein Animationspaket im Bundle der teurere Teil.
 *
 * `requestAnimationFrame` läuft deshalb wieder — aber nur, solange eine Feder
 * unterwegs ist (unter einer Sekunde), und sie schreibt ausschließlich
 * `transform`, also ohne Layout. Das ist nicht die alte Fassung.
 *
 * **Die Schritte gehen jetzt in beide Richtungen.** Wer zurückscrollt, sieht
 * die Geräte wieder auseinandergehen und bekommt die Szene beim nächsten
 * Herunterscrollen neu — vorher stand dort eine tote Bühne. Das ist die
 * Umkehrung einer früheren Entscheidung („eine Szene, die zurückspult, ist ein
 * Spielzeug"), und sie hängt an der Feder: ohne Ziel, das sich ändern darf,
 * hätte die Feder keinen Zweck. Soll es wieder nur vorwärts gehen, ist das
 * eine Zeile — das Ziel unten auf sein Maximum festhalten.
 *
 * Die Texte stehen dauerhaft. Sie ein- und wieder auszublenden erzeugte ein
 * Fenster, in dem die Bühne leer war, und sie sind ohnehin die Erklärung zu
 * dem, was daneben passiert.
 *
 * Die Türfläche ist ein Nachbau der echten: hell, mit Kopfzeile, den zwei
 * Zählern und nur dem Sucherfeld dunkel — genau wie /doorman/[eventId].
 * Die Ecken sitzen wie dort bei 14 %, der Strahl ist der violette aus `sweep`.
 */
export interface DoorSceneProps {
  /** Eventname auf beiden Geraeten. */
  eventName?: string;
  /** Ausgeschriebenes Datum auf dem Ticket, mit Uhrzeit. */
  ticketWhen?: string;
  /** Dasselbe Datum auf der Tuerflaeche, ohne Uhrzeit. */
  doorWhen?: string;
  /** Kategorie- und Ortszeile in den Ticketdetails. */
  tierLabel?: string;
  venue?: string;
  /** Zaehler auf der Tuerflaeche. */
  admittedCount?: string;
  lastScanAt?: string;
  /** Die beiden Textbloecke neben der Buehne. */
  doorHeading?: string;
  doorText?: string;
  ticketHeading?: string;
  ticketText?: string;
}

/**
 * Alle Beschriftungen sind Voreinstellungen, keine festen Werte: die
 * Nischenseiten zeigen dieselbe Szene mit ihrem eigenen Abend (Heimspiel
 * statt Clubnacht). Die Voreinstellung ist der Zustand der Startseite, damit
 * die sich durch die Parametrisierung nicht veraendert. Die Schrittsteuerung
 * bleibt davon unberuehrt.
 */
export function DoorScene({
  eventName = 'Die beste Nacht des Jahres',
  ticketWhen = 'Freitag, 5. September · 20:00 Uhr',
  doorWhen = 'Freitag, 5. September',
  tierLabel = 'Frühbucher',
  venue = 'Halle 7',
  admittedCount = '79',
  lastScanAt = '20:14',
  doorHeading = 'Die Tür ist schon eingebaut.',
  doorText = 'Kein Scanner, keine Hardware, keine Schulung: dein Personal öffnet einen Link und scannt mit dem eigenen Handy.',
  ticketHeading = 'Der Code steht nie still.',
  ticketText = 'Der Code auf dem Handy deines Gastes erneuert sich jede Minute. Ein Screenshot ist an der Tür wertlos.',
}: DoorSceneProps = {}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cue1Ref = useRef<HTMLDivElement | null>(null);
  const cue2Ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const ticket = stage?.querySelector<HTMLElement>('.scn-ticket');
    const door = stage?.querySelector<HTMLElement>('.scn-door');
    const cues = [cue1Ref.current, cue2Ref.current];
    if (!stage || !ticket || !door || !cues[0] || !cues[1]) return;

    // Wer Bewegung abbestellt hat, bekommt den Endzustand als Standbild. Ohne
    // Inline-transform, also genau die Endlage aus der CSS.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stage.dataset.step = '2';
      return;
    }

    /**
     * Ein Geraet und seine Feder. `p` ist der Fortschritt aus der Ruhelage
     * (0) in die Endlage (1); `v` seine Geschwindigkeit, und die ist der
     * ganze Punkt: aendert sich das Ziel mitten in der Bewegung, rechnet die
     * Feder vom aktuellen Wert *und* Tempo weiter, statt eine neue Kurve bei
     * Geschwindigkeit null zu beginnen. Genau das kann eine CSS-Transition
     * nicht, und genau das ist der sichtbare Unterschied beim Umkehren.
     */
    type Dev = {
      el: HTMLElement;
      key: 'tk' | 'dr';
      p: number; v: number;
      /** Restverzoegerung in Sekunden, bevor diese Feder losgeht. */
      wait: number;
      /** Aus der CSS gelesen, weil der 1180px-Zweig sie ueberschreibt. */
      x: number; y: number; rot: string;
      dx: number; dy: number; ds: number;
      delay: number;
    };

    const devs: Dev[] = [
      { el: ticket, key: 'tk', p: 0, v: 0, wait: 0, x: 0, y: 0, rot: '0deg', dx: 0, dy: 0, ds: 0, delay: 0 },
      { el: door, key: 'dr', p: 0, v: 0, wait: 0, x: 0, y: 0, rot: '0deg', dx: 0, dy: 0, ds: 0, delay: 0 },
    ];

    const readParams = () => {
      const cs = getComputedStyle(stage);
      const num = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
      for (const d of devs) {
        d.x = num(`--${d.key}-x`);
        d.y = num(`--${d.key}-y`);
        d.rot = cs.getPropertyValue(`--${d.key}-rot`).trim() || '0deg';
        d.dx = num(`--${d.key}-dx`);
        d.dy = num(`--${d.key}-dy`);
        d.ds = num(`--${d.key}-ds`);
      }
      // Nur der Tuersteher wartet; das Ticket liegt schon da.
      devs[1].delay = num('--dr-delay');
    };
    readParams();

    const paint = (d: Dev) => {
      const q = 1 - d.p;
      if (q < 0.0005) {
        // Am Ziel: den Inline-Stil wegraeumen, damit wieder die CSS-Endlage
        // gilt und nichts Ueberfluessiges auf dem Element stehen bleibt.
        d.el.style.transform = '';
        return;
      }
      // Grundlage und Weg zu je einer Zahl verrechnet: so entsteht kein
      // `calc(-50% + -4px + …)`, dessen Vorzeichenfolge nicht jede Engine mag.
      d.el.style.transform =
        `translate(calc(-50% + ${(d.x + d.dx * q).toFixed(2)}px), ` +
        `calc(-50% + ${(d.y + d.dy * q).toFixed(2)}px)) ` +
        `rotate(${d.rot}) scale(${(1 - d.ds * q).toFixed(4)})`;
    };

    // Einmal die Ruhelage schreiben, bevor irgendetwas scrollt. Ohne das
    // stehen die Geraete auf der CSS-Grundlage — und die ist mit Absicht die
    // *Endlage*, damit die Szene ohne JavaScript ihr Ergebnis zeigt statt
    // ihres Anfangs. Sie stuenden also schon uebereinander, und der erste
    // Frame der ersten Feder setzte sie schlagartig nach aussen, bevor sie
    // wieder zusammengehen. Genau dieser Sprung war zu sehen.
    for (const d of devs) paint(d);

    // Leicht unterdaempft (Daempfungsgrad ~0.9): kommt in gut einer halben
    // Sekunde an, mit einem Hauch Ueberschwingen statt eines harten Halts.
    const STIFFNESS = 170;
    const DAMPING = 24;

    let target = 0;
    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      let moving = false;

      for (const d of devs) {
        if (d.p === target && d.v === 0) continue;
        if (d.wait > 0) { d.wait -= dt; moving = true; continue; }
        d.v += (-STIFFNESS * (d.p - target) - DAMPING * d.v) * dt;
        d.p += d.v * dt;
        if (Math.abs(d.p - target) < 0.001 && Math.abs(d.v) < 0.01) {
          d.p = target; d.v = 0;
        } else {
          moving = true;
        }
        paint(d);
      }

      frame = moving ? requestAnimationFrame(tick) : 0;
    };

    const retarget = (to: number) => {
      if (to === target) return;
      target = to;
      // Der Verzug gilt in beide Richtungen — auch beim Auseinandergehen
      // reagiert der Tuersteher auf das Ticket. Aber nur aus dem Stand: ein
      // Geraet, das schon unterwegs ist, wuerde sonst mitten in der Bewegung
      // einfrieren, statt einfach neu zu zielen.
      for (const d of devs) if (d.v === 0) d.wait = d.delay;
      if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
    };

    // Die obere Bildschirmhälfte ist der Beobachtungsbereich. `passed` gilt in
    // beide Richtungen: eine Marke ist passiert, wenn sie darin liegt *oder*
    // schon oben herausgelaufen ist. Ohne den zweiten Fall meldete der
    // Beobachter beim Hochscrollen dasselbe wie beim Weiterscrollen.
    const passed = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const cue = Number((e.target as HTMLElement).dataset.cue);
          if (e.isIntersecting || e.boundingClientRect.top < 0) passed.add(cue);
          else passed.delete(cue);
        }
        const step = passed.size;
        stage.dataset.step = String(step);
        // Nur Schritt 1 bewegt die Geraete; Schritt 2 ist der Scan und haengt
        // an data-step. Wird er zurueckgenommen, spielt er beim naechsten Mal
        // von vorn — die Szene ist damit eine Flaeche, die dem Leser folgt,
        // und keine Aufzeichnung, die einmal ablaeuft.
        retarget(step >= 1 ? 1 : 0);
      },
      { rootMargin: '0px 0px -50% 0px' },
    );
    cues.forEach((c) => c && io.observe(c));

    const onResize = () => {
      readParams();
      for (const d of devs) paint(d);
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="scn">
      <style>{DOOR_SCENE_CSS}</style>

      <div className="scn-stage" ref={stageRef} data-step="0">

        <div className="scn-text scn-text-door">
          <span className="sc-eyebrow">Deine Tür</span>
          <h3>{doorHeading}</h3>
          <p>{doorText}</p>
        </div>

        <div className="scn-text scn-text-ticket">
          <span className="sc-eyebrow">Das Ticket</span>
          <h3>{ticketHeading}</h3>
          <p>{ticketText}</p>
        </div>

        <div className="scn-phones">
          {/* Ticket des Gastes — liegt ab Schritt 1 still. */}
          <div className="scn-phone scn-ticket">
            <div className="scn-screen">
              <div className="scn-tk-top">
                <span className="scn-tk-kicker">Dein Ticket</span>
                <div className="scn-tk-name">{eventName}</div>
                <div className="scn-tk-when">{ticketWhen}</div>
              </div>
              <div className="scn-tk-code">
                <div className="scn-tk-status">
                  <span className="scn-pill ok"><i />Gültig</span>
                  <span className="scn-tk-serial">#PSL-K4X2</span>
                </div>
                <div className="scn-qr">
                  <QrMark variant={0} />
                  <QrMark variant={1} />
                  <QrMark variant={2} />
                </div>
                {/* Derselbe Ablaufbalken wie auf dem echten Ticket. Er macht
                    den Zeitraffer ehrlich: der Betrachter sieht den
                    Mechanismus, der Text daneben nennt die echte Minute. */}
                <div className="scn-tk-drain"><span /></div>
                <div className="scn-tk-hint">Zeig den Code am Einlass</div>
              </div>
              <div className="scn-tk-rows">
                <div><span>Kategorie</span><b>{tierLabel}</b></div>
                <div><span>Ort</span><b>{venue}</b></div>
                <div><span>Ticket</span><b className="mono">#PSL-K4X2</b></div>
              </div>
              <div className="scn-tk-actions">
                <span>Zum Kalender</span>
                <span>Backup-Ticket</span>
              </div>
            </div>
          </div>

          {/* Telefon des Einlassers — kommt zum Ticket. */}
          <div className="scn-phone scn-door">
            <div className="scn-screen scn-door-screen">
              <div className="scn-door-head">
                <div className="scn-door-who">
                  <div className="k">Einlass</div>
                  <div className="n">{eventName}</div>
                  <div className="w">{doorWhen}</div>
                </div>
                <span className="scn-pill ok"><i />Online</span>
              </div>

              <div className="scn-door-counters">
                <div><div className="l">Eingelassen</div><div className="v">{admittedCount}</div></div>
                <div><div className="l">Letzter Scan</div><div className="v">{lastScanAt}</div></div>
              </div>

              {/* Der Sucher ist ein echtes Loch: die helle Oberfläche ringsum
                  wird vom Schlagschatten des Feldes gemalt, in seiner Mitte
                  bleibt das Ticket darunter sichtbar. Kein zweiter QR-Code,
                  der sich verschieben oder auseinanderlaufen könnte. */}
              <div className="scn-scanner">
                <div className="scn-corner tl" /><div className="scn-corner tr" />
                <div className="scn-corner bl" /><div className="scn-corner br" />
                <div className="scn-beam" />

                {/* Pixel für Pixel der Erfolgsmoment aus dem Doorman. */}
                <div className="scn-result">
                  <div className="scn-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5 L10 17.5 L19 6.5" pathLength={1} />
                    </svg>
                  </div>
                  <div className="scn-welcome">Willkommen!</div>
                  <div className="scn-admit">Einlass</div>
                </div>
              </div>

              <div className="scn-door-foot">Halte den Code vor die Kamera</div>
            </div>
          </div>
        </div>
      </div>

      {/* Unsichtbare Auslöser. Sie liegen im hohen Abschnitt, nicht in der
          klebenden Bühne — sonst wanderten sie beim Scrollen mit. */}
      <div className="scn-cue" data-cue="1" ref={cue1Ref} style={{ top: '40%' }} />
      <div className="scn-cue" data-cue="2" ref={cue2Ref} style={{ top: '57%' }} />
    </div>
  );
}

/**
 * Drei bewusst verschieden gezeichnete QR-Zeichen. Sie wechseln sich ab,
 * damit der Betrachter sieht, was der Text behauptet — sähen sie sich
 * ähnlich, wäre der Wechsel unsichtbar.
 *
 * Keines ist ein gültiger Code, und das bleibt so: sonst hält jemand sein
 * Handy an den Monitor und bekommt einen Fehler.
 */
function QrMark({ variant }: { variant: 0 | 1 | 2 }) {
  const inner = [
    <g key="a">
      <path d="M14 14h3v3h-3z" /><path d="M19 14h2" /><path d="M14 19h3" /><path d="M19 19v2" />
      <path d="M12 3v3" /><path d="M12 9v2" /><path d="M3 12h3" /><path d="M9 12h2" />
    </g>,
    <g key="b">
      <path d="M14 14h2v2h-2z" /><path d="M18 15h3" /><path d="M15 18v3" /><path d="M18.5 18.5h2.5" />
      <path d="M12 3v2" /><path d="M12 8v3" /><path d="M3 12h2" /><path d="M8 12h3" />
    </g>,
    <g key="c">
      <path d="M17 14h3v3h-3z" /><path d="M14 15h1.5" /><path d="M14 19h6" /><path d="M17 21v-1.5" />
      <path d="M12 3v4" /><path d="M12 10v1" /><path d="M3 12h4" /><path d="M10 12h1" />
    </g>,
  ][variant];

  return (
    <svg
      className="scn-qr-mark"
      data-variant={variant}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.05"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      {inner}
    </svg>
  );
}

const DOOR_SCENE_CSS = `
  /* ── Bühne ─────────────────────────────────────────────────────────── */
  .scn { height: 240vh; position: relative; }
  .scn-stage {
    /* svh, nicht dvh: auf iOS aendert das Ein- und Ausfahren der Adressleiste
       dvh *waehrend* des Scrollens, die angeheftete Buehne wuerde also mitten
       in der Geraete-Transition neu vermessen — eine klassische Zitterquelle.
       svh ist der kleinste Zustand und bleibt beim Scrollen konstant; es ist
       genau die Hoehe, mit der die Seite auf iOS ohnehin geladen wird, das
       Layout musste also nie mehr Platz haben als jetzt. Auf dem Desktop sind
       svh, dvh und vh identisch. Die erste Zeile ist der Rueckfall fuer
       Engines ohne die neuen Einheiten. */
    position: sticky; top: 0; height: 100vh; height: 100svh;
    display: grid; place-items: center;

    /* Endlage und Weg dorthin, getrennt. Frueher standen hier zwei fertige
       Transformationen und CSS blendete zwischen ihnen ueber; jetzt federt JS
       zwischen ihnen und braucht die Zahlen einzeln. Sie stehen weiter *hier*,
       weil der 1180px-Zweig sie ueberschreibt — das JS liest sie aus, statt
       sie zu kennen.

       x/y/rot ist die Endlage (das Geraet an seinem Platz), d* der Weg, den
       es aus der Ruhelage dorthin zuruecklegt, ds die Verkleinerung dabei. */
    --tk-x: 16px;  --tk-y: 34px;  --tk-rot: -3deg;
    --tk-dx: 180px; --tk-dy: 0px;  --tk-ds: 0;
    --dr-x: -4px;  --dr-y: -77px; --dr-rot: 2.5deg;
    --dr-dx: -180px; --dr-dy: -25px; --dr-ds: 0;
    /* Der Tuersteher kommt mit einem Hauch Verzug. Der Versatz ist
       Kausalitaet, nicht Zierrat — er reagiert auf das hingehaltene Ticket,
       und das liest das Auge als Geschichte statt als zwei bewegte Objekte. */
    --dr-delay: 0.16;
  }
  .scn-cue { position: absolute; left: 0; right: 0; height: 1px; pointer-events: none; }

  .scn-phones { position: relative; width: 100%; height: 100%; }

  .scn-phone {
    position: absolute; left: 50%; top: calc(50% + 55px); width: 240px;
    border-radius: 30px; padding: 8px;
    background: linear-gradient(160deg, oklch(0.32 0.03 285), oklch(0.20 0.02 285));
    box-shadow: 0 26px 60px -16px rgba(17, 20, 45, 0.44), 0 5px 14px rgba(17, 20, 45, 0.15);
    /* Keine transition mehr: die Bewegung kommt aus der Feder im JS, die
       transform pro Frame schreibt. Das ist nicht die alte scrollgebundene
       Fassung — dort lief eine Schreiboperation pro Frame ueber die ganzen
       240vh Scrollstrecke. Hier laeuft sie nur, solange die Feder unterwegs
       ist (unter einer Sekunde), und schreibt ausschliesslich transform, also
       ohne Layout. */
    will-change: transform;
  }
  .scn-screen {
    /* position: relative ist tragend. Ohne es beziehen sich die absolut
       gesetzten Kinder auf das ganze Geraet statt auf den Bildschirm — das
       gruene Feld lief dann ueber den Rahmen hinaus und bekam eckige Ecken. */
    position: relative;
    border-radius: 23px; overflow: hidden; background: var(--surface);
    aspect-ratio: 9 / 19.5; display: flex; flex-direction: column;
  }

  /* Die Endlage steht in der CSS, nicht im JS: ohne JavaScript und bei
     abbestellter Bewegung zeigt die Szene damit ihr Ergebnis statt ihres
     Anfangs. Solange die Feder laeuft, ueberschreibt ein Inline-transform
     diese Zeile; ist sie am Ziel angekommen, raeumt das JS ihn wieder weg. */
  .scn-ticket {
    transform: translate(calc(-50% + var(--tk-x)), calc(-50% + var(--tk-y))) rotate(var(--tk-rot));
  }
  .scn-door {
    z-index: 2;
    background: none;
    box-shadow:
      inset 0 0 0 8px oklch(0.24 0.025 285),
      0 26px 60px -16px rgba(17, 20, 45, 0.44),
      0 5px 14px rgba(17, 20, 45, 0.15);
    transform: translate(calc(-50% + var(--dr-x)), calc(-50% + var(--dr-y))) rotate(var(--dr-rot));
  }
  .scn-door-screen { background: none; }

  /* ── Texte — dauerhaft sichtbar ──────────────────────────────────── */
  .scn-text { position: absolute; width: clamp(200px, 15vw, 240px); }
  .scn-text h3 { font-size: 18px; font-weight: 560; letter-spacing: -0.02em; line-height: 1.3; }
  .scn-text p { font-size: 13.5px; color: var(--ink-3); line-height: 1.6; margin-top: 10px; }
  .scn-text-door   { left: 0;  top: 32%; transform: translateY(-50%); }
  .scn-text-ticket { right: 0; top: 64%; transform: translateY(-50%); text-align: right; }

  /* ── Ticketfläche ────────────────────────────────────────────────── */
  .scn-tk-top { padding: 18px 16px 12px; }
  .scn-tk-kicker {
    font-size: 9px; font-weight: 600; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--ink-4);
  }
  .scn-tk-name { font-size: 14.5px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.25; margin-top: 5px; }
  .scn-tk-when { font-size: 10px; color: var(--ink-3); margin-top: 4px; }
  .scn-tk-code {
    margin: 0 16px; padding: 12px 12px 14px; border-radius: 16px;
    background: var(--accent-wash); border: 1px solid var(--accent-line);
    display: flex; flex-direction: column; align-items: center; gap: 9px;
  }
  .scn-tk-status { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .scn-tk-serial { font-family: var(--mono); font-size: 9px; color: var(--accent-ink); }
  .scn-qr {
    position: relative; width: 132px; height: 132px; color: oklch(0.30 0.05 285);
    animation: scnQrTick 4s cubic-bezier(.16, 1, .3, 1) infinite;
  }
  .scn-qr-mark {
    position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0;
    animation: scnQrShow 12s step-end infinite;
  }
  /* Drei Muster teilen sich einen 12-Sekunden-Takt, jedes vier Sekunden. */
  .scn-qr-mark[data-variant="1"] { animation-delay: -8s; }
  .scn-qr-mark[data-variant="2"] { animation-delay: -4s; }
  @keyframes scnQrShow { 0% { opacity: 1; } 33.34%, 100% { opacity: 0; } }
  @keyframes scnQrTick { 0% { transform: scale(0.98); } 7%, 100% { transform: scale(1); } }

  .scn-tk-drain {
    width: 100%; height: 3px; border-radius: 2px;
    background: color-mix(in oklab, var(--accent) 18%, transparent); overflow: hidden;
  }
  .scn-tk-drain > span {
    display: block; height: 100%; width: 100%; border-radius: 2px;
    background: var(--accent); transform-origin: left;
    animation: scnDrain 4s linear infinite;
  }
  @keyframes scnDrain { from { transform: scaleX(1); } to { transform: scaleX(0); } }

  .scn-tk-hint { font-size: 9.5px; font-weight: 500; color: var(--accent-ink); }
  .scn-tk-rows {
    padding: 14px 16px 0; display: flex; flex-direction: column; gap: 7px;
    font-size: 9.5px; color: var(--ink-3);
  }
  .scn-tk-rows > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .scn-tk-rows b { font-weight: 600; color: var(--ink-2); }
  .scn-tk-rows .mono { font-family: var(--mono); }
  .scn-tk-actions {
    margin-top: auto; padding: 0 16px 16px;
    display: grid; gap: 6px; font-size: 9.5px; font-weight: 500;
  }
  .scn-tk-actions span {
    padding: 8px 0; text-align: center; border-radius: 8px;
    border: 1px solid var(--line-2); color: var(--ink-2); background: var(--surface);
  }

  /* ── Türfläche: Nachbau von /doorman/[eventId] ───────────────────── */
  .scn-pill {
    display: inline-flex; align-items: center; gap: 4px; flex: none;
    padding: 2px 7px; border-radius: 5px;
    font-size: 8.5px; font-weight: 600;
    border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-3);
  }
  .scn-pill i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
  .scn-pill.ok { background: var(--ok-wash); border-color: oklch(0.86 0.08 150); color: oklch(0.38 0.12 150); }

  .scn-door-head {
    position: relative; z-index: 2;
    padding: 16px 14px 10px;
    display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
  }
  .scn-door-who .k {
    font-size: 8.5px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--ink-3);
  }
  .scn-door-who .n { font-size: 12.5px; font-weight: 600; letter-spacing: -0.01em; margin-top: 3px; line-height: 1.25; }
  .scn-door-who .w { font-size: 9.5px; color: var(--ink-3); margin-top: 2px; }

  .scn-door-counters {
    position: relative; z-index: 2;
    padding: 0 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  }
  .scn-door-counters > div {
    padding: 8px 10px; border-radius: 9px;
    background: var(--surface-2); border: 1px solid var(--line);
  }
  .scn-door-counters .l {
    font-size: 7.5px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-3);
  }
  .scn-door-counters .v {
    font-size: 14px; font-weight: 600; letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums; margin-top: 2px;
  }

  /* Das Sucherfeld malt die helle Oberfläche ringsum als Schlagschatten —
     nur so bleibt in seiner Mitte ein echtes Loch auf das Ticket darunter. */
  .scn-scanner {
    position: relative; flex: 1; margin: 12px 14px; min-height: 0;
    border-radius: 18px;
    background: oklch(0.22 0.02 275 / 0.68);
    box-shadow: 0 0 0 520px var(--surface);
  }
  .scn-corner {
    position: absolute; z-index: 3; width: 22px; height: 22px;
    border: 3px solid #fff; border-radius: 6px;
  }
  .scn-corner.tl { top: 14%; left: 14%; border-right: none; border-bottom: none; }
  .scn-corner.tr { top: 14%; right: 14%; border-left: none; border-bottom: none; }
  .scn-corner.bl { bottom: 14%; left: 14%; border-right: none; border-top: none; }
  .scn-corner.br { bottom: 14%; right: 14%; border-left: none; border-top: none; }

  /* Derselbe violette Strahl wie an der echten Tür, gleiche 2,2 s. */
  .scn-beam {
    position: absolute; z-index: 3; left: 14%; right: 14%; top: 14%; bottom: 14%;
    overflow: hidden; border-radius: 6px;
  }
  .scn-beam::after {
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px;
    background: linear-gradient(90deg, transparent, oklch(0.9 0.2 var(--hue)), transparent);
    box-shadow: 0 0 14px oklch(0.7 0.2 var(--hue));
    animation: scnSweep 2.2s ease-in-out infinite;
  }
  @keyframes scnSweep { 0% { top: 0; } 50% { top: calc(100% - 2px); } 100% { top: 0; } }

  .scn-door-foot {
    position: relative; z-index: 2;
    padding: 0 14px 16px; text-align: center;
    font-size: 9px; color: var(--ink-3);
  }

  /* ── Schritt 2: der Moment ───────────────────────────────────────── */
  .scn-result {
    position: absolute; inset: 0; z-index: 4;
    border-radius: 18px;
    background: oklch(0.40 0.14 150);
    display: grid; place-content: center; place-items: center;
    color: #fff; text-align: center; padding: 14px;
    clip-path: circle(0% at 50% 45%);
  }
  .scn-stage[data-step="2"] .scn-result {
    animation: scnWash 0.28s cubic-bezier(.16, 1, .3, 1) 0.62s forwards;
  }
  @keyframes scnWash { to { clip-path: circle(140% at 50% 45%); } }

  .scn-check {
    width: 56px; height: 56px; border-radius: 50%;
    background: #fff; color: var(--ok);
    display: grid; place-items: center; margin-bottom: 10px;
    transform: scale(0.4); opacity: 0;
  }
  .scn-check svg { width: 28px; height: 28px; }
  .scn-check path { stroke-dasharray: 1; stroke-dashoffset: 1; }
  .scn-stage[data-step="2"] .scn-check {
    animation: scnCheckIn 0.42s cubic-bezier(.2, 1.5, .4, 1) 0.74s forwards;
  }
  .scn-stage[data-step="2"] .scn-check path {
    animation: scnDraw 0.4s cubic-bezier(.16, 1, .3, 1) 0.92s forwards;
  }
  @keyframes scnCheckIn { to { transform: scale(1); opacity: 1; } }
  @keyframes scnDraw { to { stroke-dashoffset: 0; } }

  .scn-welcome { font-size: 16px; font-weight: 600; letter-spacing: -0.02em; opacity: 0; }
  .scn-admit {
    font-size: 9.5px; margin-top: 4px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; opacity: 0;
  }
  .scn-stage[data-step="2"] .scn-welcome { animation: scnRise 0.34s cubic-bezier(.16, 1, .3, 1) 1.2s forwards; }
  .scn-stage[data-step="2"] .scn-admit   { animation: scnRise 0.34s cubic-bezier(.16, 1, .3, 1) 1.3s forwards; }
  @keyframes scnRise { from { opacity: 0; transform: translateY(5px); } to { opacity: 0.9; transform: none; } }

  /* ── Gestapelt: Tablet und Handy ─────────────────────────────────────
     Die dreispaltige Anordnung (Text | Geräte | Text) braucht rund 1180px.
     Darunter stehen beide Texte oben und die Geräte darunter — mittig, damit
     das fertige Bild aus zwei übereinanderliegenden Geräten auch wirklich in
     der Mitte steht und nicht an den Rand gedrückt wird. */
  @media (max-width: 1180px) {
    .scn { height: 260vh; }
    .scn-stage {
      /* Untereinander statt nebeneinander: die Geraete kommen von unten bzw.
         oben und wachsen dabei aus 0.8 auf ihre Groesse. */
      --tk-dx: 0px; --tk-dy: 240px; --tk-ds: 0.2;
      --dr-dx: 0px; --dr-dy: -60px; --dr-ds: 0.2;
    }
    /* Beide Texte stehen oben und mittig, die Geräte darunter — nur so steht
       das fertige Bild aus zwei übereinanderliegenden Geräten wirklich in der
       Mitte und wird nicht von einer Textspalte an den Rand gedrückt.
       Eyebrow und Fliesstext entfallen: das vertikale Budget einer 800px-Bühne
       ist nach Kopfleiste (60) und Endbild (583) fast aufgebraucht, und auf
       dem kleinen Schirm traegt ohnehin das Bild. */
    .scn-text {
      width: min(420px, 88vw); left: 50%; right: auto;
      transform: translateX(-50%); text-align: center;
    }
    .scn-text h3 { font-size: 16px; font-weight: 600; }
    .scn-text p, .scn-text .sc-eyebrow { display: none; }
    .scn-text-door   { top: 74px; transform: translateX(-50%); }
    .scn-text-ticket { top: 104px; transform: translateX(-50%); }
    /* Die Geräte rücken unter die Texte, bleiben aber waagerecht mittig. */
    .scn-phone { top: calc(50% + 109px); }
  }
  @media (max-width: 480px) {
    .scn-text h3 { font-size: 15px; font-weight: 600; }
    .scn-text-ticket { top: 102px; }
  }

  /* Ohne Bewegung: Endzustand. Die Geschichte liest sich auch als Standbild. */
  @media (prefers-reduced-motion: reduce) {
    .scn { height: auto; }
    .scn-stage { position: static; height: 660px; }
    .scn-qr, .scn-qr-mark, .scn-tk-drain > span, .scn-beam::after,
    .scn-result, .scn-check, .scn-check path,
    .scn-welcome, .scn-admit { animation: none !important; }
    .scn-qr-mark[data-variant="0"] { opacity: 1; }
    .scn-result { clip-path: none; }
    .scn-check { transform: none; opacity: 1; }
    .scn-check path { stroke-dashoffset: 0; }
    .scn-welcome, .scn-admit { opacity: 0.9; }
  }
`;
