import { Icon } from '@/app/components/passlyUi';

/**
 * Die Produktbilder des Showcase auf der Startseite.
 *
 * Regel für alles hier drin: **es steht nur drauf, was es gibt.** Kein
 * Sitzplan, keine erfundene Wochenstatistik, keine Zahl, die eine Plattform
 * größer aussehen lässt, als sie ist. Erfundene Zahlen auf einem
 * Dashboard-Bild sind dieselbe Kategorie wie erfundene Kundenstimmen — und
 * beim Dashboard ist die Versuchung am größten, weil ein leeres schlecht
 * aussieht. Deshalb: plausible Werte für *einen einzelnen Abend*, nichts
 * über die Plattform.
 *
 * Die Kaufseite ist bewusst nicht hier, sondern in
 * `eventSurfaces/ShopCard` — die teilt sich die Startseite mit der
 * Live-Vorschau im Event-Editor.
 */

/* ── Kapitel „Deine Tür“ ──────────────────────────────────────────────
   Zwei Geräte: rechts (bzw. unten) das Ticket des Gastes, links (bzw. oben)
   das Telefon des Einlassers, das sich darüberlegt. Vorerst als Standbild im
   Endzustand — das ist zugleich die Fassung, die bei
   `prefers-reduced-motion` stehen bleibt, wenn die Szene scrollgesteuert
   wird. Die Positionen hängen an CSS-Variablen, damit der Scroll sie später
   bewegen kann, ohne dass das Markup sich ändert. */
export function DoorPhones() {
  return (
    <div className="dph" role="img" aria-label="Ein Gast hält sein Ticket hin, der Einlasser scannt es mit dem eigenen Handy und bekommt grünes Licht.">
      {/* Ticket des Gastes */}
      <div className="dph-phone dph-ticket">
        <div className="dph-screen">
          <div className="dph-tk-top">
            <span className="dph-tk-kicker">Dein Ticket</span>
            <div className="dph-tk-name">Die beste Nacht des Jahres</div>
          </div>
          <div className="dph-tk-code">
            <QrMark />
            <div className="dph-tk-drain"><span /></div>
          </div>
          <div className="dph-tk-foot">
            <span>Einlass 20:00</span>
            <span className="mono">#PSL-K4X2</span>
          </div>
        </div>
      </div>

      {/* Telefon des Einlassers, darübergelegt */}
      <div className="dph-phone dph-door">
        <div className="dph-screen dph-door-screen">
          <div className="dph-door-bar">
            <span className="dph-door-dot" />
            Einlass · Halle 7
          </div>
          {/* Der Sucher ist ein echtes Loch: darunter liegt das Ticket und
              scheint durch. Kein zweiter QR-Code, der auseinanderlaufen kann. */}
          <div className="dph-viewport">
            <div className="dph-tint" />
            <div className="dph-corner tl" /><div className="dph-corner tr" />
            <div className="dph-corner bl" /><div className="dph-corner br" />
          </div>
          <div className="dph-result">
            <div className="dph-check">
              <Icon name="check" size={26} strokeWidth={3} />
            </div>
            <div className="dph-welcome">Willkommen!</div>
            <div className="dph-admit">Einlass</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dekoratives QR-Zeichen, bewusst kein gültiger Code — sonst hält jemand
    sein Handy an den Monitor und bekommt einen Fehler. */
function QrMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M19 14h2" />
      <path d="M14 19h3" />
      <path d="M19 19v2" />
    </svg>
  );
}

/* ── Kapitel „Deine Zahlen“ ───────────────────────────────────────────
   Ein einzelner Abend, wie ihn das kostenlose Dashboard zeigt: verkauft,
   eingelöst, Einnahmen. Nichts davon ist Pro. */
export function DashboardMock() {
  return (
    <div className="dbm">
      <div className="dbm-head">
        <div>
          <div className="dbm-kicker">Freitag, 5. September</div>
          <div className="dbm-title">Die beste Nacht des Jahres</div>
        </div>
        <span className="chip ok"><span className="d" />Läuft</span>
      </div>

      <div className="dbm-kpis">
        <div className="dbm-kpi">
          <div className="l">Verkauft</div>
          <div className="v">87<span className="of"> / 120</span></div>
        </div>
        <div className="dbm-kpi">
          <div className="l">Eingelöst</div>
          <div className="v">79</div>
        </div>
        <div className="dbm-kpi">
          <div className="l">Einnahmen</div>
          <div className="v">1.044 €</div>
        </div>
      </div>

      <div className="dbm-bar">
        <div className="dbm-barhead">
          <span>Auslastung</span>
          <span className="mono">73 %</span>
        </div>
        <div className="progress"><span style={{ width: '73%' }} /></div>
      </div>

      <div className="dbm-rows">
        <div className="dbm-row">
          <span className="dbm-av">MK</span>
          <span className="dbm-who">m•••@example.de</span>
          <span className="chip ok"><span className="d" />Eingelöst</span>
        </div>
        <div className="dbm-row">
          <span className="dbm-av">JS</span>
          <span className="dbm-who">j•••@example.de</span>
          <span className="chip ok"><span className="d" />Eingelöst</span>
        </div>
        <div className="dbm-row">
          <span className="dbm-av">AB</span>
          <span className="dbm-who">a•••@example.de</span>
          <span className="chip"><span className="d" />Offen</span>
        </div>
      </div>
    </div>
  );
}

export const SHOWCASE_CSS = `
  /* ── Kapitel-Raster ──────────────────────────────────────── */
  .sc-chapter {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 56px; align-items: center;
  }
  .sc-chapter + .sc-chapter { margin-top: 72px; }
  .sc-chapter.flip .sc-media { order: -1; }
  .sc-eyebrow {
    display: block; font-size: 11.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent-ink);
    margin-bottom: 12px;
  }
  .sc-copy h3 {
    font-size: clamp(22px, 2.6vw, 28px); font-weight: 620;
    letter-spacing: -0.03em; line-height: 1.15;
  }
  .sc-copy > p { font-size: 14.5px; color: var(--ink-3); line-height: 1.65; margin-top: 12px; max-width: 46ch; }
  .sc-points { list-style: none; display: flex; flex-direction: column; gap: 9px; margin-top: 20px; }
  .sc-points li {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 13.5px; color: var(--ink-2); line-height: 1.55;
  }
  .sc-points svg { color: var(--accent); flex-shrink: 0; margin-top: 3px; }
  .sc-media { min-width: 0; }
  @media (max-width: 900px) {
    .sc-chapter { grid-template-columns: minmax(0, 1fr); gap: 30px; }
    .sc-chapter + .sc-chapter { margin-top: 56px; }
    /* Gestapelt steht der Text immer zuerst; die Reihenfolge von der
       Breitansicht wuerde hier nur die Lesefolge zerreissen. */
    .sc-chapter.flip .sc-media { order: 0; }
  }

  /* ── Tür: zwei Geräte ────────────────────────────────────── */
  .dph {
    position: relative; margin: 0 auto;
    width: 100%; max-width: 420px; height: 430px;
  }
  .dph-phone {
    position: absolute; width: 195px;
    border-radius: 26px; padding: 7px;
    background: linear-gradient(160deg, oklch(0.32 0.03 285), oklch(0.20 0.02 285));
    box-shadow: 0 22px 50px -14px rgba(17, 20, 45, 0.42), 0 4px 12px rgba(17, 20, 45, 0.14);
  }
  .dph-screen {
    border-radius: 20px; overflow: hidden; background: var(--surface);
    aspect-ratio: 9 / 19.5; display: flex; flex-direction: column;
  }
  /* Ticket liegt still, das Tuerhandy legt sich darueber und laesst die
     Kanten des Tickets sichtbar — sonst versteht niemand, dass es zwei
     Geraete sind. */
  .dph-ticket { left: 50%; top: 50%; transform: translate(-64%, -46%) rotate(-3deg); }
  .dph-door   { left: 50%; top: 50%; transform: translate(-30%, -54%) rotate(2.5deg); z-index: 2; }

  .dph-tk-top { padding: 16px 14px 10px; }
  .dph-tk-kicker {
    font-size: 8.5px; font-weight: 600; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--ink-4);
  }
  .dph-tk-name { font-size: 13px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.25; margin-top: 5px; }
  .dph-tk-code {
    margin: 0 14px; padding: 14px; border-radius: 14px;
    background: var(--accent-wash); border: 1px solid var(--accent-line);
    display: flex; flex-direction: column; align-items: center; gap: 9px;
  }
  .dph-tk-code svg { width: 104px; height: 104px; color: oklch(0.30 0.05 285); }
  .dph-tk-drain { width: 100%; height: 3px; border-radius: 2px; background: color-mix(in oklab, var(--accent) 18%, transparent); overflow: hidden; }
  .dph-tk-drain > span { display: block; height: 100%; width: 62%; border-radius: 2px; background: var(--accent); }
  .dph-tk-foot {
    margin-top: auto; padding: 12px 14px 16px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 9.5px; color: var(--ink-3);
  }
  .dph-tk-foot .mono { font-family: var(--mono); }

  .dph-door-screen { background: oklch(0.20 0.02 275); }
  .dph-door-bar {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 14px 10px; font-size: 9.5px; font-weight: 500;
    color: rgba(255, 255, 255, 0.72);
  }
  .dph-door-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--ok); }
  .dph-viewport {
    position: relative; margin: 0 12px; flex: 1; border-radius: 12px; overflow: hidden;
  }
  /* Kamerabild: das Ticket darunter scheint durch, die Toenung macht daraus
     einen Sucher. */
  .dph-tint { position: absolute; inset: 0; background: rgba(12, 10, 22, 0.34); }
  .dph-corner { position: absolute; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.82); }
  .dph-corner.tl { top: 10px; left: 10px; border-right: none; border-bottom: none; border-radius: 4px 0 0 0; }
  .dph-corner.tr { top: 10px; right: 10px; border-left: none; border-bottom: none; border-radius: 0 4px 0 0; }
  .dph-corner.bl { bottom: 10px; left: 10px; border-right: none; border-top: none; border-radius: 0 0 0 4px; }
  .dph-corner.br { bottom: 10px; right: 10px; border-left: none; border-top: none; border-radius: 0 0 4px 0; }

  /* Der Erfolgsmoment, Pixel für Pixel wie an der echten Tür. */
  .dph-result {
    position: absolute; inset: 0; z-index: 3;
    background: oklch(0.40 0.14 150);
    display: grid; place-content: center; place-items: center;
    color: #fff; text-align: center; padding: 14px;
  }
  .dph-check {
    width: 52px; height: 52px; border-radius: 50%;
    background: #fff; color: var(--ok);
    display: grid; place-items: center; margin-bottom: 9px;
  }
  .dph-welcome { font-size: 15px; font-weight: 600; letter-spacing: -0.02em; }
  .dph-admit {
    font-size: 9px; margin-top: 4px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85;
  }

  @media (max-width: 900px) {
    /* Hochkant bleibt hochkant — auf dem Handy stehen die Geräte
       untereinander statt nebeneinander. */
    .dph { max-width: 300px; height: 400px; }
    .dph-ticket { transform: translate(-52%, -40%) rotate(-2deg); }
    .dph-door   { transform: translate(-46%, -58%) rotate(2deg); }
  }
  @media (max-width: 420px) {
    .dph { height: 360px; }
    .dph-phone { width: 168px; }
    .dph-tk-code svg { width: 88px; height: 88px; }
  }

  /* ── Zahlen: Dashboard ───────────────────────────────────── */
  .dbm {
    width: 100%; max-width: 440px; margin: 0 auto;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden;
  }
  .dbm-head {
    padding: 18px 20px; border-bottom: 1px solid var(--line);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  .dbm-kicker { font-size: 11px; color: var(--ink-3); }
  .dbm-title { font-size: 15px; font-weight: 600; letter-spacing: -0.015em; margin-top: 3px; }
  .dbm-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--line); }
  .dbm-kpi { padding: 15px 16px; border-right: 1px solid var(--line); min-width: 0; }
  .dbm-kpi:last-child { border-right: none; }
  .dbm-kpi .l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-3); font-weight: 500; }
  .dbm-kpi .v { font-size: 21px; font-weight: 620; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; margin-top: 4px; }
  .dbm-kpi .v .of { font-size: 13px; font-weight: 500; color: var(--ink-4); letter-spacing: -0.01em; }
  .dbm-bar { padding: 15px 20px; border-bottom: 1px solid var(--line); }
  .dbm-barhead {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 11.5px; color: var(--ink-3); margin-bottom: 7px;
  }
  .dbm-barhead .mono { font-family: var(--mono); color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .dbm-rows { padding: 6px 20px 16px; display: flex; flex-direction: column; }
  .dbm-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 12.5px;
  }
  .dbm-row:last-child { border-bottom: none; }
  .dbm-av {
    width: 24px; height: 24px; border-radius: 50%; flex: none;
    background: var(--surface-3); color: var(--ink-3);
    display: grid; place-items: center; font-size: 9.5px; font-weight: 600;
  }
  .dbm-who { flex: 1; min-width: 0; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
