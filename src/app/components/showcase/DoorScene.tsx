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
              </div>
              <div className="scn-tk-code">
                <div className="scn-qr">
                  <QrMark variant={0} />
                  <QrMark variant={1} />
                  <QrMark variant={2} />
                </div>
                {/* Derselbe Ablaufbalken wie auf dem echten Ticket. Er macht
                    den Zeitraffer ehrlich: der Betrachter sieht den
                    Mechanismus, der Text daneben nennt die echte Minute. */}
                <div className="scn-tk-drain"><span /></div>
              </div>
              <div className="scn-tk-hint">Zeig den Code am Einlass</div>
              <div className="scn-tk-rows">
                <div><span>Kategorie</span><b>Frühbucher</b></div>
                <div><span>Ort</span><b>Halle 7</b></div>
              </div>
              <div className="scn-tk-foot">
                <span>Einlass 20:00</span>
                <span className="mono">#PSL-K4X2</span>
              </div>
            </div>
          </div>

          {/* Telefon des Einlassers — kommt zum Ticket. */}
          <div className="scn-phone scn-door">
            <div className="scn-screen scn-door-screen">
              <div className="scn-door-bar">
                <span className="scn-door-dot" />
                Einlass · Halle 7
              </div>

              {/* Der Sucher ist ein echtes Loch: darunter liegt das Ticket und
                  scheint durch. Kein zweiter QR-Code, der sich verschieben
                  oder auseinanderlaufen könnte. */}
              <div className="scn-viewport">
                <div className="scn-tint" />
                <div className="scn-beam" />
                <div className="scn-corner tl" /><div className="scn-corner tr" />
                <div className="scn-corner bl" /><div className="scn-corner br" />
              </div>

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
          </div>
        </div>

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
     seine Höhe minus einem Bildschirm — daraus rechnet das JS \`--p\`. */
  .scn { height: 240vh; position: relative; }
  .scn-stage {
    position: sticky; top: 0; height: 100vh; height: 100dvh;
    display: grid; place-items: center;
    --p: 0;

    /* Abschnittsweiser Fortschritt, jeweils 0→1 im eigenen Fenster.
       Danach durch Smoothstep (t²·(3−2t)) geschickt: eine lineare
       Zuordnung von Scroll zu Weg ist die auffälligste Verräterin einer
       schnell gebauten Szene — echte Dinge beschleunigen und setzen sich. */
    --t-doortext: clamp(0, calc((var(--p) - 0.00) / 0.14), 1);
    --t-in:       clamp(0, calc((var(--p) - 0.14) / 0.16), 1);
    --t-out:      clamp(0, calc((var(--p) - 0.42) / 0.08), 1);
    --t-lock:     clamp(0, calc((var(--p) - 0.50) / 0.12), 1);
    --t-door:     clamp(0, calc((var(--p) - 0.62) / 0.22), 1);

    --e-in:   calc(var(--t-in) * var(--t-in) * (3 - 2 * var(--t-in)));
    --e-lock: calc(var(--t-lock) * var(--t-lock) * (3 - 2 * var(--t-lock)));
    --e-door: calc(var(--t-door) * var(--t-door) * (3 - 2 * var(--t-door)));

    /* Ruhelagen im Textabschnitt, danach Weg auf null. Desktop: das Ticket
       kommt von rechts, der Türsteher von links oben. */
    --rest-tx:  170px;   --rest-ty:  0px;
    --enter-tx: 260px;   --enter-ty: 0px;
    --rest-dx: -170px;   --rest-dy: -60px;
    --scale: 1;
  }

  .scn-phones { position: relative; width: 100%; height: 100%; }

  .scn-phone {
    position: absolute; left: 50%; top: calc(50% + 22px); width: 195px;
    border-radius: 26px; padding: 7px;
    background: linear-gradient(160deg, oklch(0.32 0.03 285), oklch(0.20 0.02 285));
    box-shadow: 0 22px 50px -14px rgba(17, 20, 45, 0.42), 0 4px 12px rgba(17, 20, 45, 0.14);
    will-change: transform;
  }
  .scn-screen {
    /* position: relative ist tragend. Ohne es beziehen sich die absolut
       gesetzten Kinder (Sucher, Ergebnis) auf das ganze Geraet statt auf den
       Bildschirm — das gruene Feld lief dann ueber den Rahmen hinaus und
       bekam eckige Ecken, weil overflow: hidden es gar nicht erfasste. */
    position: relative;
    border-radius: 20px; overflow: hidden; background: var(--surface);
    aspect-ratio: 9 / 19.5; display: flex; flex-direction: column;
  }

  /* Ticket: erst herein, dann in die Mitte. Beide Wege addieren sich, damit
     eine einzige Transformation genügt. */
  .scn-ticket {
    transform:
      translate(
        calc(-50% + 18px + var(--rest-tx) * (1 - var(--e-lock)) + var(--enter-tx) * (1 - var(--e-in))),
        calc(-50% + 30px + var(--rest-ty) * (1 - var(--e-lock)) + var(--enter-ty) * (1 - var(--e-in)))
      )
      rotate(-3deg) scale(var(--scale));
    opacity: var(--t-in);
  }
  /* Türsteher: sitzt von Anfang an da und kommt zum Ticket.
     Sein Rahmen ist bewusst ungefuellt und wird als innerer Ring gezeichnet —
     sonst liegt hinter dem Sucherloch sein eigenes Gehaeuse statt des
     Tickets, und der ganze Durchblick ist keiner. */
  .scn-door {
    z-index: 2;
    background: none;
    box-shadow:
      inset 0 0 0 7px oklch(0.24 0.025 285),
      0 22px 50px -14px rgba(17, 20, 45, 0.42),
      0 4px 12px rgba(17, 20, 45, 0.14);
    transform:
      translate(
        calc(-50% - 6px + var(--rest-dx) * (1 - var(--e-door))),
        calc(-50% - 52px + var(--rest-dy) * (1 - var(--e-door)))
      )
      rotate(2.5deg) scale(var(--scale));
  }

  /* Nach dem Einrasten schiebt \`--p: 1\` den Rest des Anflugs zu Ende — dieser
     letzte Zentimeter gehört zum Moment und nicht mehr zum Finger. */
  .scn-stage[data-state="scanned"] .scn-phone {
    transition: transform 0.55s cubic-bezier(.16, 1, .3, 1);
  }

  /* ── Texte ───────────────────────────────────────────────────────── */
  .scn-text {
    position: absolute; width: 264px; max-width: 34vw;
    will-change: transform, opacity;
  }
  .scn-text h3 { font-size: 21px; font-weight: 620; letter-spacing: -0.03em; line-height: 1.2; }
  .scn-text p { font-size: 13.5px; color: var(--ink-3); line-height: 1.6; margin-top: 10px; }
  .scn-text-door {
    left: 0; top: 34%;
    opacity: calc(var(--t-doortext) * (1 - var(--t-out)));
    transform: translateY(calc(-50% + (1 - var(--t-doortext)) * 16px - var(--t-out) * 14px));
  }
  .scn-text-ticket {
    right: 0; top: 62%; text-align: right;
    opacity: calc(var(--t-in) * (1 - var(--t-out)));
    transform: translateY(calc(-50% + (1 - var(--t-in)) * 16px - var(--t-out) * 14px));
  }

  /* ── Ticketfläche ────────────────────────────────────────────────── */
  .scn-tk-top { padding: 16px 14px 10px; }
  .scn-tk-kicker {
    font-size: 8.5px; font-weight: 600; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--ink-4);
  }
  .scn-tk-name { font-size: 13px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.25; margin-top: 5px; }
  .scn-tk-code {
    margin: 0 14px; padding: 14px; border-radius: 14px;
    background: var(--accent-wash); border: 1px solid var(--accent-line);
    display: flex; flex-direction: column; align-items: center; gap: 9px;
  }
  .scn-qr {
    position: relative; width: 104px; height: 104px; color: oklch(0.30 0.05 285);
    animation: scnQrTick 4s cubic-bezier(.16, 1, .3, 1) infinite;
  }
  .scn-qr-mark { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; }
  /* Drei Muster teilen sich einen 12-Sekunden-Takt, jedes vier Sekunden.
     Negative Verzögerungen setzen sie versetzt in denselben Takt. */
  .scn-qr-mark { animation: scnQrShow 12s step-end infinite; }
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

  /* Ohne diese zwei Bloecke klaffte unter dem Code eine leere weisse Flaeche;
     beides steht so auch auf der echten Ticketseite. */
  .scn-tk-hint {
    text-align: center; margin-top: 10px;
    font-size: 8.5px; font-weight: 500; color: var(--accent-ink);
  }
  .scn-tk-rows {
    padding: 12px 14px 0; display: flex; flex-direction: column; gap: 6px;
    font-size: 8.5px; color: var(--ink-3);
  }
  .scn-tk-rows > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .scn-tk-rows b { font-weight: 600; color: var(--ink-2); }
  .scn-tk-foot {
    margin-top: auto; padding: 12px 14px 16px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 9.5px; color: var(--ink-3);
  }
  .scn-tk-foot .mono { font-family: var(--mono); }

  /* ── Türfläche ───────────────────────────────────────────────────── */
  /* Bewusst ohne eigenen Hintergrund: die dunkle Flaeche kommt vom Sucher
     als riesiger Schlagschatten, damit in seiner Mitte ein echtes Loch
     bleibt, durch das das Ticket darunter zu sehen ist. */
  .scn-door-screen { background: transparent; }
  .scn-door-bar {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 6px;
    padding: 12px 14px 10px; font-size: 9.5px; font-weight: 500;
    color: rgba(255, 255, 255, 0.72);
  }
  .scn-door-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--ok); }
  .scn-viewport {
    position: relative; margin: 0 12px 12px; flex: 1;
    border-radius: 12px;
    box-shadow: 0 0 0 999px oklch(0.20 0.02 275);
  }
  /* Kamerabild: das durchscheinende Ticket wird abgedunkelt, damit es wie ein
     Sucher wirkt und nicht wie ein Loch im Bildschirm. */
  .scn-tint { position: absolute; inset: 0; border-radius: 12px; background: rgba(12, 10, 22, 0.42); }
  .scn-corner { position: absolute; z-index: 2; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.82); }
  .scn-corner.tl { top: 10px; left: 10px; border-right: none; border-bottom: none; border-radius: 4px 0 0 0; }
  .scn-corner.tr { top: 10px; right: 10px; border-left: none; border-bottom: none; border-radius: 0 4px 0 0; }
  .scn-corner.bl { bottom: 10px; left: 10px; border-right: none; border-top: none; border-radius: 0 0 0 4px; }
  .scn-corner.br { bottom: 10px; right: 10px; border-left: none; border-top: none; border-radius: 0 0 4px 0; }

  .scn-beam {
    position: absolute; z-index: 2; left: 0; right: 0; height: 2px; top: 0; opacity: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.95), transparent);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.55);
  }
  .scn-stage[data-state="scanned"] .scn-beam {
    animation: scnBeam 0.6s cubic-bezier(.4, 0, .2, 1) forwards;
  }
  @keyframes scnBeam {
    0%   { opacity: 0; top: 6%; }
    12%  { opacity: 1; }
    82%  { opacity: 1; }
    100% { opacity: 0; top: 94%; }
  }

  /* ── Der Moment ──────────────────────────────────────────────────── */
  .scn-result {
    position: absolute; inset: 0; z-index: 3;
    background: oklch(0.40 0.14 150);
    display: grid; place-content: center; place-items: center;
    color: #fff; text-align: center; padding: 14px;
    /* Der Kreis wäscht von der Mitte nach außen ein. */
    clip-path: circle(0% at 50% 45%);
  }
  .scn-stage[data-state="scanned"] .scn-result {
    animation: scnWash 0.28s cubic-bezier(.16, 1, .3, 1) 0.9s forwards;
  }
  @keyframes scnWash { to { clip-path: circle(140% at 50% 45%); } }

  .scn-check {
    width: 52px; height: 52px; border-radius: 50%;
    background: #fff; color: var(--ok);
    display: grid; place-items: center; margin-bottom: 9px;
    transform: scale(0.4); opacity: 0;
  }
  .scn-check svg { width: 26px; height: 26px; }
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

  .scn-welcome { font-size: 15px; font-weight: 600; letter-spacing: -0.02em; opacity: 0; }
  .scn-admit {
    font-size: 9px; margin-top: 4px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; opacity: 0;
  }
  .scn-stage[data-state="scanned"] .scn-welcome { animation: scnRise 0.34s cubic-bezier(.16, 1, .3, 1) 1.5s forwards; }
  .scn-stage[data-state="scanned"] .scn-admit   { animation: scnRise 0.34s cubic-bezier(.16, 1, .3, 1) 1.6s forwards; }
  @keyframes scnRise { from { opacity: 0; transform: translateY(5px); } to { opacity: 0.9; transform: none; } }

  /* ── Mobil: hochkant untereinander ───────────────────────────────────
     Zwei hochkante Geräte in voller Größe passen vertikal nicht (2 × 420 px
     in einer 740-px-Bühne). Während der Textphase stehen sie deshalb auf
     0,72 und wachsen beim Einrasten auf volle Größe — genau dann, wenn das
     Ticket zum Hauptdarsteller wird. */
  @media (max-width: 900px) {
    .scn { height: 300vh; }
    .scn-stage {
      --rest-tx: 0px;    --rest-ty: 140px;
      --enter-tx: 0px;   --enter-ty: 120px;
      --rest-dx: 0px;    --rest-dy: -120px;
      --scale: calc(0.66 + 0.34 * var(--e-lock));
    }
    .scn-text { width: 172px; max-width: 48vw; left: 0; right: auto; text-align: left; }
    .scn-text h3 { font-size: 16px; letter-spacing: -0.02em; }
    /* Auf dem kleinen Schirm trägt das Bild, nicht der Satz: neben einem
       140-px-Gerät bleiben rund 21 Zeichen pro Zeile. */
    .scn-text p { display: none; }
    .scn-text-door   { top: 27%; transform: translateY(calc((1 - var(--t-doortext)) * 12px - var(--t-out) * 10px)); }
    .scn-text-ticket { top: 68%; transform: translateY(calc((1 - var(--t-in)) * 12px - var(--t-out) * 10px)); }
    .scn-phones { margin-left: 26%; width: 74%; }
  }
  @media (max-width: 420px) {
    .scn-phone { width: 172px; }
    .scn-qr { width: 88px; height: 88px; }
  }

  /* Ohne Bewegung: Endzustand. Die Geschichte liest sich auch als Standbild. */
  @media (prefers-reduced-motion: reduce) {
    .scn { height: auto; }
    .scn-stage { position: static; height: 480px; }
    .scn-qr, .scn-qr-mark, .scn-tk-drain > span,
    .scn-beam, .scn-result, .scn-check, .scn-check path,
    .scn-welcome, .scn-admit { animation: none !important; }
    .scn-qr-mark[data-variant="0"] { opacity: 1; }
    .scn-result { clip-path: none; }
    .scn-check { transform: none; opacity: 1; }
    .scn-check path { stroke-dashoffset: 0; }
    .scn-welcome, .scn-admit { opacity: 0.9; }
    .scn-phone { transition: none !important; }
  }
`;
