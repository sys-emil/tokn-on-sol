'use client';

import { useEffect, useRef } from 'react';

/**
 * Die Tür-Szene auf der Startseite: zwei Geräte, in zwei Schritten.
 *
 * **Zwei Schritte statt einer scrollgebundenen Bewegung.** Vorher hing jede
 * Position am Scrollbalken — das JS schrieb eine Zahl pro Frame, und der
 * Browser musste die Ebenen dabei laufend neu rastern. Das ruckelte auf
 * beiden Seiten. Jetzt löst der Scroll nur noch *aus*:
 *
 *  1. Der erste Auslöser führt die Geräte übereinander.
 *  2. Der zweite scannt.
 *
 * Beides sind CSS-Übergänge, die in ihrem eigenen Takt ablaufen. Damit gibt
 * es während des Scrollens überhaupt keine Arbeit mehr zu tun, und die
 * Bewegung ist so flüssig, wie der Compositor sie zeichnen kann.
 *
 * Ausgelöst wird über zwei unsichtbare Marken im hohen Abschnitt, beobachtet
 * mit einem `IntersectionObserver`. Kein Scroll-Listener, kein
 * `requestAnimationFrame`, keine Bibliothek.
 *
 * **Die Schritte gehen nur vorwärts.** Wer hochscrollt, sieht das Ergebnis
 * stehen bleiben — eine Szene, die zurückspult, ist ein Spielzeug.
 *
 * Die Texte stehen dauerhaft. Sie ein- und wieder auszublenden erzeugte ein
 * Fenster, in dem die Bühne leer war, und sie sind ohnehin die Erklärung zu
 * dem, was daneben passiert.
 *
 * Die Türfläche ist ein Nachbau der echten: hell, mit Kopfzeile, den zwei
 * Zählern und nur dem Sucherfeld dunkel — genau wie /doorman/[eventId].
 * Die Ecken sitzen wie dort bei 14 %, der Strahl ist der violette aus `sweep`.
 */
export function DoorScene() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cue1Ref = useRef<HTMLDivElement | null>(null);
  const cue2Ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const cues = [cue1Ref.current, cue2Ref.current];
    if (!stage || !cues[0] || !cues[1]) return;

    // Wer Bewegung abbestellt hat, bekommt den Endzustand als Standbild.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stage.dataset.step = '2';
      return;
    }

    let step = 0;
    const advance = (to: number): void => {
      if (to <= step) return;
      step = to;
      stage.dataset.step = String(to);
    };

    // Die obere Bildschirmhälfte ist der Beobachtungsbereich: eine Marke
    // löst aus, sobald sie beim Herunterscrollen die Mitte erreicht.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) advance(Number((e.target as HTMLElement).dataset.cue));
        }
      },
      { rootMargin: '0px 0px -50% 0px' },
    );
    cues.forEach((c) => c && io.observe(c));

    return () => io.disconnect();
  }, []);

  return (
    <div className="scn">
      <style>{DOOR_SCENE_CSS}</style>

      <div className="scn-stage" ref={stageRef} data-step="0">

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
          {/* Ticket des Gastes — liegt ab Schritt 1 still. */}
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
    position: sticky; top: 0; height: 100vh; height: 100dvh;
    display: grid; place-items: center;

    /* Ruhe- und Endlage je Gerät. Sie stehen als ganze Transformationen da,
       nicht als Einzelwerte: zwischen zwei fertigen Transformationen kann der
       Browser sauber überblenden, und mehr braucht es nicht mehr. */
    --tk-rest: translate(calc(-50% + 16px + 180px), calc(-50% + 34px)) rotate(-3deg);
    --tk-end:  translate(calc(-50% + 16px),         calc(-50% + 34px)) rotate(-3deg);
    --dr-rest: translate(calc(-50% - 4px - 180px),  calc(-50% - 102px)) rotate(2.5deg);
    --dr-end:  translate(calc(-50% - 4px),          calc(-50% - 77px))  rotate(2.5deg);
  }
  .scn-cue { position: absolute; left: 0; right: 0; height: 1px; pointer-events: none; }

  .scn-phones { position: relative; width: 100%; height: 100%; }

  .scn-phone {
    position: absolute; left: 50%; top: calc(50% + 55px); width: 240px;
    border-radius: 30px; padding: 8px;
    background: linear-gradient(160deg, oklch(0.32 0.03 285), oklch(0.20 0.02 285));
    box-shadow: 0 26px 60px -16px rgba(17, 20, 45, 0.44), 0 5px 14px rgba(17, 20, 45, 0.15);
    /* Nur die Transformation wechselt, und nur zweimal. Kein Wert wird pro
       Frame geschrieben — das ist der ganze Unterschied zur alten Fassung. */
    transition: transform 0.78s cubic-bezier(.16, 1, .3, 1);
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

  .scn-ticket { transform: var(--tk-rest); }
  /* Türsteher: kommt zum Ticket, mit einem Hauch Verzug. Der Versatz ist
     Kausalität, nicht Zierrat — er reagiert auf das hingehaltene Ticket, und
     das liest das Auge als Geschichte statt als zwei bewegte Objekte. */
  .scn-door {
    z-index: 2;
    background: none;
    box-shadow:
      inset 0 0 0 8px oklch(0.24 0.025 285),
      0 26px 60px -16px rgba(17, 20, 45, 0.44),
      0 5px 14px rgba(17, 20, 45, 0.15);
    transform: var(--dr-rest);
    transition-delay: 0.16s;
  }
  .scn-door-screen { background: none; }

  .scn-stage[data-step="1"] .scn-ticket,
  .scn-stage[data-step="2"] .scn-ticket { transform: var(--tk-end); }
  .scn-stage[data-step="1"] .scn-door,
  .scn-stage[data-step="2"] .scn-door { transform: var(--dr-end); }

  /* ── Texte — dauerhaft sichtbar ──────────────────────────────────── */
  .scn-text { position: absolute; width: clamp(200px, 15vw, 240px); }
  .scn-text h3 { font-size: 21px; font-weight: 620; letter-spacing: -0.03em; line-height: 1.2; }
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
      --tk-rest: translate(calc(-50% + 16px), calc(-50% + 34px + 240px)) rotate(-3deg) scale(0.8);
      --tk-end:  translate(calc(-50% + 16px), calc(-50% + 34px))         rotate(-3deg) scale(1);
      --dr-rest: translate(calc(-50% - 4px),  calc(-50% - 77px - 60px))  rotate(2.5deg) scale(0.8);
      --dr-end:  translate(calc(-50% - 4px),  calc(-50% - 77px))         rotate(2.5deg) scale(1);
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
    .scn-text h3 { font-size: 17px; }
    .scn-text p, .scn-text .sc-eyebrow { display: none; }
    .scn-text-door   { top: 74px; transform: translateX(-50%); }
    .scn-text-ticket { top: 104px; transform: translateX(-50%); }
    /* Die Geräte rücken unter die Texte, bleiben aber waagerecht mittig. */
    .scn-phone { top: calc(50% + 109px); }
  }
  @media (max-width: 480px) {
    .scn-text h3 { font-size: 15.5px; }
    .scn-text-ticket { top: 102px; }
  }

  /* Ohne Bewegung: Endzustand. Die Geschichte liest sich auch als Standbild. */
  @media (prefers-reduced-motion: reduce) {
    .scn { height: auto; }
    .scn-stage { position: static; height: 660px; }
    .scn-phone { transition: none; }
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
