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
 * Live-Vorschau im Event-Editor. Die zwei Geräte der Tür-Szene liegen in
 * `DoorScene`, weil sie ihre eigene Scroll-Steuerung mitbringen.
 */

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

  /* ── Belege unter der Tuer-Szene ─────────────────────────────
     Vier Zeilen statt vier Stichpunkte neben einem Bild: die Szene hat den
     Platz daneben schon verbraucht. */
  .scn-facts {
    list-style: none; display: grid; gap: 10px 26px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 30px auto 0; max-width: 780px;
  }
  .scn-facts li {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 13.5px; color: var(--ink-2); line-height: 1.55;
  }
  .scn-facts svg { color: var(--accent); flex-shrink: 0; margin-top: 3px; }
  @media (max-width: 700px) { .scn-facts { grid-template-columns: minmax(0, 1fr); margin-top: 22px; } }

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
