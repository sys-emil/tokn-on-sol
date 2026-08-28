'use client';

import { useEffect, useRef } from 'react';

/**
 * Die Tür-Szene auf der Startseite: zwei Geräte, scrollgesteuert.
 *
 * Das Tragende ist eine Zuordnung, die sich nicht durch Easing nachrüsten
 * lässt: **die Scrollgeste wird zur Handbewegung des Türstehers.** Man wischt
 * nach unten, das Tür-Handy senkt sich nach unten auf das Ticket. Deshalb
 * liegt das Ticket still und der Türsteher kommt zu ihm — der Gast hält sein
 * Handy hin, der Einlasser bewegt sich.
 *
 * Zwei Steuerungen, bewusst gemischt:
 *  - **Am Scrollbalken** hängt der Anflug. Man schiebt die Geräte zusammen,
 *    das fühlt sich reaktiv an.
 *  - **Ausgelöst** ist der Erfolgsmoment. Er darf nicht davon abhängen, wie
 *    schnell jemand wischt: wer auf dem Handy einmal durchzieht, würde sonst
 *    in drei Frames durch die Pointe rasen.
 *
 * Zwei Regeln, ohne die es kippt:
 *  - **Das Einrasten friert auch den Anflug ein.** Sonst scrollt man hoch,
 *    die Geräte fahren auseinander und das Grün schwebt im Nichts.
 *  - **Einmal pro Seitenaufruf.** Kein Neuabspielen bei jedem Vorbeiscrollen;
 *    das ist der Unterschied zwischen einer Szene und einem Spielzeug.
 *
 * Die Türfläche ist ein Nachbau der echten: **hell**, mit Kopfzeile, den zwei
 * Zählern und nur dem Sucherfeld dunkel — genau wie /doorman/[eventId]. Ein
 * durchgehend dunkles Telefon sah nach Kamera-App aus und nach nichts, was
 * Passly baut. Die Ecken sitzen wie dort bei 14 %, und der Strahl ist der
 * violette aus `sweep`, kein weißer Einmal-Blitz.
 *
 * Beide Geräte stehen von Anfang an da. Nacheinander eingeblendet lasen sie
 * sich wie ein Ladevorgang statt wie eine Szene.
 *
 * Technisch schreibt das JS **eine einzige Zahl pro Frame** (`--p`, 0→1) und
 * sonst nichts. Alle Wege, Maßstäbe und Blenden stehen als `calc()` in CSS.
 * Eine Scroll-Bibliothek für eine einzige Szene wäre 40 KB für das, was hier
 * zwölf Zeilen sind.
 */
export function DoorScene() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    // Wer Bewegung abbestellt hat, bekommt den Endzustand: Geräte beieinander,
    // grün, Haken. Die Geschichte liest sich auch als Standbild.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stage.style.setProperty('--p', '1');
      stage.dataset.state = 'scanned';
      return;
    }

    let frame = 0;
    let latched = false;

    const measure = (): void => {
      frame = 0;
      const travel = section.offsetHeight - window.innerHeight;
      // Ohne Reisestrecke gibt es nichts zu steuern — dann sofort der
      // Endzustand, statt bei --p: 0 mit leerer Buehne stehenzubleiben.
      const p = travel <= 0
        ? 1
        : Math.min(1, Math.max(0, -section.getBoundingClientRect().top / travel));

      if (latched) return;
      stage.style.setProperty('--p', p.toFixed(4));

      // Ab hier läuft alles im eigenen Takt weiter, auch wenn der Finger
      // stehen bleibt oder zurückwischt. `--p: 1` schiebt den Rest des
      // Anflugs zu Ende; die Übergangszeit dafür setzt das CSS.
      if (p >= 0.8) {
        latched = true;
        stage.dataset.state = 'scanned';
        stage.style.setProperty('--p', '1');
      }
    };

    const onScroll = (): void => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="scn" ref={sectionRef}>
      <style>{DOOR_SCENE_CSS}</style>
      <div className="scn-stage" ref={stageRef}>

        <div className="scn-text scn-text-door">
          <span className="sc-eyebrow">Deine Tür</span>
          <h3>Die Tür ist schon eingebaut.</h3>
          <p>
            Kein Scanner, keine Hardware, keine Schulung: dein Personal öffnet
            einen Link und scannt mit dem eigenen Handy.
          </p>
        </div>

        <div className="scn-text scn-text-ticket">
          <span className="sc-eyebrow">Das Ticket</span>
          <h3>Der Code steht nie still.</h3>
          <p>
            Der Code auf dem Handy deines Gastes erneuert sich jede Minute.
            Ein Screenshot ist an der Tür wertlos.
          </p>
        </div>

        <div className="scn-phones">
          {/* Ticket des Gastes — liegt ab dem Einrasten still. */}
          <div className="scn-phone scn-ticket">
            <div className="scn-screen">
              <div className="scn-tk-top">
                <span className="scn-tk-kicker">Dein Ticket</span>
                <div className="scn-tk-name">Die beste Nacht des Jahres</div>
                <div className="scn-tk-when">Freitag, 5. September · 20:00 Uhr</div>
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
                <div><span>Kategorie</span><b>Frühbucher</b></div>
                <div><span>Ort</span><b>Halle 7</b></div>
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
                  <div className="n">Die beste Nacht des Jahres</div>
                  <div className="w">Freitag, 5. September</div>
                </div>
                <span className="scn-pill ok"><i />Online</span>
              </div>

              <div className="scn-door-counters">
                <div><div className="l">Eingelassen</div><div className="v">79</div></div>
                <div><div className="l">Letzter Scan</div><div className="v">20:14</div></div>
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

        {/* Ohne diese Zeile steht die Bühne im Scan-Moment fast leer da: die
            beiden Texte sind ausgeblendet, und die Geräte liegen übereinander. */}
        <div className="scn-caption">Mehr passiert an der Tür nicht.</div>

      </div>
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
  /* ── Bühne ───────────────────────────────────────────────────────────
     Der Abschnitt ist hoch, die Bühne klebt darin. Die Reisestrecke ist
     seine Höhe minus einem Bildschirm — daraus rechnet das JS die eine Zahl. */
  .scn { height: 240vh; position: relative; }
  .scn-stage {
    position: sticky; top: 0; height: 100vh; height: 100dvh;
    display: grid; place-items: center;
    --p: 0;

    /* Abschnittsweiser Fortschritt, jeweils 0→1 im eigenen Fenster. Danach
       durch Smoothstep (t²·(3−2t)): eine lineare Zuordnung von Scroll zu Weg
       ist die auffälligste Verräterin einer schnell gebauten Szene. */
    --t-doortext: clamp(0, calc(var(--p) / 0.06), 1);
    --t-tktext:   clamp(0, calc((var(--p) - 0.09) / 0.07), 1);
    --t-out:      clamp(0, calc((var(--p) - 0.42) / 0.08), 1);
    --t-lock:     clamp(0, calc((var(--p) - 0.46) / 0.14), 1);
    --t-door:     clamp(0, calc((var(--p) - 0.60) / 0.24), 1);

    --e-lock: calc(var(--t-lock) * var(--t-lock) * (3 - 2 * var(--t-lock)));
    --e-door: calc(var(--t-door) * var(--t-door) * (3 - 2 * var(--t-door)));

    /* Ruhelagen im Textabschnitt, danach Weg auf null. */
    --rest-tx:  210px;   --rest-ty:  0px;
    --rest-dx: -210px;   --rest-dy: -34px;
    --scale: 1;
  }

  .scn-phones { position: relative; width: 100%; height: 100%; }

  .scn-phone {
    position: absolute; left: 50%; top: calc(50% + 40px); width: 240px;
    border-radius: 30px; padding: 8px;
    background: linear-gradient(160deg, oklch(0.32 0.03 285), oklch(0.20 0.02 285));
    box-shadow: 0 26px 60px -16px rgba(17, 20, 45, 0.44), 0 5px 14px rgba(17, 20, 45, 0.15);
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

  .scn-ticket {
    transform:
      translate(
        calc(-50% + 16px + var(--rest-tx) * (1 - var(--e-lock))),
        calc(-50% + 34px + var(--rest-ty) * (1 - var(--e-lock)))
      )
      rotate(-3deg) scale(var(--scale));
  }
  /* Türsteher: sitzt von Anfang an da und kommt zum Ticket. Sein Rahmen ist
     bewusst ungefuellt und wird als innerer Ring gezeichnet — sonst liegt
     hinter dem Sucherloch sein eigenes Gehaeuse statt des Tickets. */
  .scn-door {
    z-index: 2;
    background: none;
    box-shadow:
      inset 0 0 0 8px oklch(0.24 0.025 285),
      0 26px 60px -16px rgba(17, 20, 45, 0.44),
      0 5px 14px rgba(17, 20, 45, 0.15);
    transform:
      translate(
        calc(-50% - 4px + var(--rest-dx) * (1 - var(--e-door))),
        calc(-50% - 77px + var(--rest-dy) * (1 - var(--e-door)))
      )
      rotate(2.5deg) scale(var(--scale));
  }
  .scn-door-screen { background: none; }

  /* Nach dem Einrasten schiebt --p: 1 den Rest des Anflugs zu Ende — dieser
     letzte Zentimeter gehört zum Moment und nicht mehr zum Finger. */
  .scn-stage[data-state="scanned"] .scn-phone {
    transition: transform 0.55s cubic-bezier(.16, 1, .3, 1);
  }

  /* ── Texte ───────────────────────────────────────────────────────── */
  .scn-text {
    position: absolute; width: 240px; max-width: 32vw;
    will-change: transform, opacity;
  }
  .scn-text h3 { font-size: 21px; font-weight: 620; letter-spacing: -0.03em; line-height: 1.2; }
  .scn-text p { font-size: 13.5px; color: var(--ink-3); line-height: 1.6; margin-top: 10px; }
  .scn-text-door {
    left: 0; top: 32%;
    opacity: calc(var(--t-doortext) * (1 - var(--t-out)));
    transform: translateY(calc(-50% + (1 - var(--t-doortext)) * 14px - var(--t-out) * 12px));
  }
  .scn-text-ticket {
    right: 0; top: 64%; text-align: right;
    opacity: calc(var(--t-tktext) * (1 - var(--t-out)));
    transform: translateY(calc(-50% + (1 - var(--t-tktext)) * 14px - var(--t-out) * 12px));
  }

  /* Trägt den Scan-Moment, in dem die beiden Texte schon weg sind. */
  .scn-caption {
    position: absolute; bottom: 4%; left: 50%;
    font-size: 14px; font-weight: 500; color: var(--ink-3);
    white-space: nowrap;
    opacity: var(--e-door);
    transform: translateX(-50%) translateY(calc((1 - var(--e-door)) * 8px));
  }

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
  /* Drei Muster teilen sich einen 12-Sekunden-Takt, jedes vier Sekunden.
     Negative Verzögerungen setzen sie versetzt in denselben Takt. */
  .scn-qr-mark[data-variant="1"] { animation-delay: -8s; }
  .scn-qr-mark[data-variant="2"] { animation-delay: -4s; }
  @keyframes scnQrShow { 0% { opacity: 1; } 33.34%, 100% { opacity: 0; } }
  /* Ein Schlag beim Wechsel: harter Austausch sieht nach Fehler aus,
     Überblendung nach Matsch. */
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
  /* Die zwei Knoepfe stehen so auch auf der echten Ticketseite und schliessen
     die Flaeche, die sonst unter den Zeilen leer blieb. */
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
    box-shadow: 0 0 0 999px var(--surface);
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

  /* ── Der Moment ──────────────────────────────────────────────────── */
  .scn-result {
    position: absolute; inset: 0; z-index: 4;
    border-radius: 18px;
    background: oklch(0.40 0.14 150);
    display: grid; place-content: center; place-items: center;
    color: #fff; text-align: center; padding: 14px;
    clip-path: circle(0% at 50% 45%);
  }
  .scn-stage[data-state="scanned"] .scn-result {
    animation: scnWash 0.28s cubic-bezier(.16, 1, .3, 1) 0.9s forwards;
  }
  @keyframes scnWash { to { clip-path: circle(140% at 50% 45%); } }

  .scn-check {
    width: 56px; height: 56px; border-radius: 50%;
    background: #fff; color: var(--ok);
    display: grid; place-items: center; margin-bottom: 10px;
    transform: scale(0.4); opacity: 0;
  }
  .scn-check svg { width: 28px; height: 28px; }
  /* Der Haken zeichnet sich, statt einfach dazustehen. */
  .scn-check path { stroke-dasharray: 1; stroke-dashoffset: 1; }
  .scn-stage[data-state="scanned"] .scn-check {
    animation: scnCheckIn 0.42s cubic-bezier(.2, 1.5, .4, 1) 1.02s forwards;
  }
  .scn-stage[data-state="scanned"] .scn-check path {
    animation: scnDraw 0.4s cubic-bezier(.16, 1, .3, 1) 1.2s forwards;
  }
  @keyframes scnCheckIn { to { transform: scale(1); opacity: 1; } }
  @keyframes scnDraw { to { stroke-dashoffset: 0; } }

  .scn-welcome { font-size: 16px; font-weight: 600; letter-spacing: -0.02em; opacity: 0; }
  .scn-admit {
    font-size: 9.5px; margin-top: 4px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; opacity: 0;
  }
  .scn-stage[data-state="scanned"] .scn-welcome { animation: scnRise 0.34s cubic-bezier(.16, 1, .3, 1) 1.5s forwards; }
  .scn-stage[data-state="scanned"] .scn-admit   { animation: scnRise 0.34s cubic-bezier(.16, 1, .3, 1) 1.6s forwards; }
  @keyframes scnRise { from { opacity: 0; transform: translateY(5px); } to { opacity: 0.9; transform: none; } }

  /* ── Mobil: hochkant untereinander ───────────────────────────────────
     Zwei hochkante Geräte in voller Größe passen vertikal nicht. Während der
     Textphase stehen sie deshalb kleiner und wachsen beim Einrasten auf volle
     Größe — genau dann, wenn das Ticket zum Hauptdarsteller wird. */
  @media (max-width: 900px) {
    .scn { height: 300vh; }
    .scn-stage {
      --rest-tx: 0px;    --rest-ty: 150px;
      --rest-dx: 0px;    --rest-dy: -130px;
      --scale: calc(0.52 + 0.48 * var(--e-lock));
    }
    .scn-text { width: 170px; max-width: 46vw; left: 0; right: auto; text-align: left; }
    .scn-text h3 { font-size: 16px; letter-spacing: -0.02em; }
    /* Auf dem kleinen Schirm trägt das Bild, nicht der Satz. */
    .scn-text p { display: none; }
    .scn-text-door   { top: 26%; transform: translateY(calc((1 - var(--t-doortext)) * 12px - var(--t-out) * 10px)); }
    .scn-text-ticket { top: 68%; transform: translateY(calc((1 - var(--t-tktext)) * 12px - var(--t-out) * 10px)); }
    .scn-phones { margin-left: 26%; width: 74%; }
    .scn-caption { font-size: 12.5px; bottom: 4%; white-space: normal; text-align: center; width: 78%; }
  }

  /* Ohne Bewegung: Endzustand. Die Geschichte liest sich auch als Standbild. */
  @media (prefers-reduced-motion: reduce) {
    .scn { height: auto; }
    .scn-stage { position: static; height: 620px; }
    .scn-qr, .scn-qr-mark, .scn-tk-drain > span, .scn-beam::after,
    .scn-result, .scn-check, .scn-check path,
    .scn-welcome, .scn-admit { animation: none !important; }
    .scn-qr-mark[data-variant="0"] { opacity: 1; }
    .scn-result { clip-path: none; }
    .scn-check { transform: none; opacity: 1; }
    .scn-check path { stroke-dashoffset: 0; }
    .scn-welcome, .scn-admit { opacity: 0.9; }
    .scn-phone { transition: none !important; }
  }
`;
