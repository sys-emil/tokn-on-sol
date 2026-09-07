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
   eingelöst, Einnahmen. Nichts davon ist Pro.

   Die Werte sind Voreinstellungen, keine festen Zahlen: die Nischenseiten
   zeigen dieselbe Fläche mit ihrem eigenen Abend. Voreingestellt ist der
   Zustand der Startseite. Die Auslastung wird aus verkauft/Kapazität
   gerechnet, damit Balken und Zahlen gar nicht erst auseinanderlaufen
   können. */
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

  return (
    <div className="dbm">
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
          <div className="v">{sold}<span className="of"> / {capacity}</span></div>
        </div>
        <div className="dbm-kpi">
          <div className="l">Eingelöst</div>
          <div className="v">{redeemed}</div>
        </div>
        <div className="dbm-kpi">
          <div className="l">Einnahmen</div>
          <div className="v">{revenueLabel}</div>
        </div>
      </div>

      <div className="dbm-bar">
        <div className="dbm-barhead">
          <span>Auslastung</span>
          <span className="mono">{occupancy} %</span>
        </div>
        <div className="progress"><span style={{ width: `${occupancy}%` }} /></div>
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

/* ── Kapitel „Deine Dauerkarte“ ───────────────────────────────────────
   Nachbau der Verkaufsseite /pass/[id] und der Terminliste, die der Gast auf
   seinem Ticket sieht. Nur was es gibt: ein Preis, ein eigenes Kontingent,
   die Termine der Serie und je Termin ein Einlass — genau das, was
   `season_pass_events` und `pass_redemptions` abbilden. Kein Sitzplatz, kein
   Mitgliedsausweis, keine Saisonstatistik. */
export interface SeasonPassMockProps {
  eyebrow?: string;
  name?: string;
  priceLabel?: string;
  feeNote?: string;
  validForLabel?: string;
  datesHead?: string;
  dates?: { month: string; day: string; label: string; done?: boolean }[];
  /** Zeile unter der Liste, z. B. „+ 8 weitere Termine“. */
  moreLabel?: string;
  ctaLabel?: string;
}

export function SeasonPassMock({
  eyebrow = 'Saisonpass',
  name = 'Dauerkarte Saison 26/27',
  priceLabel = '70,00 €',
  feeNote = 'zzgl. Servicegebühr',
  validForLabel = '11 Heimspiele',
  datesHead = 'Termine',
  dates = [
    { month: 'Sep', day: '20', label: 'gegen TuS Bergheim', done: true },
    { month: 'Okt', day: '11', label: 'gegen SV Nordstadt' },
    { month: 'Okt', day: '25', label: 'gegen SG Talbach' },
  ],
  moreLabel = '+ 8 weitere Termine',
  ctaLabel = 'Dauerkarte kaufen',
}: SeasonPassMockProps = {}) {
  return (
    <div className="spm">
      <div className="spm-head">
        <div className="spm-eyebrow">{eyebrow}</div>
        <div className="spm-title">{name}</div>
      </div>

      <div className="spm-rows">
        <div className="spm-row">
          <span className="k">
            Preis
            {feeNote && <span className="sub">{feeNote}</span>}
          </span>
          <span className="v big">{priceLabel}</span>
        </div>
        <div className="spm-row">
          <span className="k">Gültig für</span>
          <span className="v">{validForLabel}</span>
        </div>
        <div className="spm-row">
          <span className="k">Verfügbarkeit</span>
          <span className="chip ok"><span className="d" />Verfügbar</span>
        </div>
      </div>

      <div className="spm-dates">
        <div className="spm-dates-head">{datesHead}</div>
        {dates.map((d, i) => (
          <div key={i} className="spm-date">
            <div className="spm-cal">
              <div className="m">{d.month}</div>
              <div className="d">{d.day}</div>
            </div>
            <div className="spm-txt">{d.label}</div>
            {d.done
              ? <span className="chip ok"><span className="d" />Eingelöst</span>
              : <span className="chip"><span className="d" />Offen</span>}
          </div>
        ))}
        {moreLabel && <div className="spm-more">{moreLabel}</div>}
      </div>

      <div className="spm-foot">
        <div className="spm-cta">{ctaLabel}</div>
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
  /* Sichtbare Zaesur zwischen den Kapiteln: ohne sie liefen Bild, Belege und
     naechste Ueberschrift zu einem Block zusammen. */
  .sc-chapter + .sc-chapter,
  .scn-facts + .sc-chapter { margin-top: 104px; padding-top: 104px; border-top: 1px solid var(--line); }
  .sc-chapter + .scn { margin-top: 96px; }
  .sc-chapter.flip .sc-media { order: -1; }
  /* Die drei Kapitelnamen sind Unterueberschriften, keine Eyebrows: sie
     wiederholen die drei Teile der Kopfzeile und gliedern damit die Seite.
     Als 11,5px-Versalzeile waren sie zu leise, um als Abschnittsmarke gelesen
     zu werden, und der Aufbau wirkte unuebersichtlich. */
  .sc-eyebrow {
    display: block; font-size: clamp(22px, 2.4vw, 27px); font-weight: 650;
    letter-spacing: -0.025em; line-height: 1.2; color: var(--accent-ink);
    margin-bottom: 8px;
  }
  .sc-copy h3 {
    font-size: clamp(16.5px, 1.7vw, 19px); font-weight: 560;
    letter-spacing: -0.02em; line-height: 1.3; color: var(--ink);
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
    .sc-chapter + .sc-chapter,
    .scn-facts + .sc-chapter { margin-top: 64px; padding-top: 64px; }
    .sc-chapter + .scn { margin-top: 56px; }
    /* Gestapelt steht der Text immer zuerst; die Reihenfolge von der
       Breitansicht wuerde hier nur die Lesefolge zerreissen. */
    .sc-chapter.flip .sc-media { order: 0; }
  }

  /* ── Belege unter der Tuer-Szene ─────────────────────────────
     Vier Zeilen statt vier Stichpunkte neben einem Bild: die Szene hat den
     Platz daneben schon verbraucht. Als abgesetzte Karte, weil sie sonst
     ohne Halt zwischen Szene und naechstem Kapitel schwebten. */
  .scn-facts {
    list-style: none; display: grid; gap: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 44px auto 0; max-width: 820px;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-lg); box-shadow: var(--shadow);
    overflow: hidden;
  }
  .scn-facts li {
    display: flex; gap: 11px; align-items: flex-start;
    padding: 16px 20px;
    font-size: 13.5px; color: var(--ink-2); line-height: 1.5;
    border-right: 1px solid var(--line); border-bottom: 1px solid var(--line);
  }
  .scn-facts li:nth-child(2n) { border-right: none; }
  .scn-facts li:nth-last-child(-n+2) { border-bottom: none; }
  .scn-facts svg { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
  @media (max-width: 700px) {
    .scn-facts { grid-template-columns: minmax(0, 1fr); }
    .scn-facts li { border-right: none; }
    .scn-facts li:nth-last-child(-n+2) { border-bottom: 1px solid var(--line); }
    .scn-facts li:last-child { border-bottom: none; }
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

  /* ── Dauerkarte: Nachbau von /pass/[id] ──────────────────── */
  .spm {
    width: 100%; max-width: 420px; margin: 0 auto;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden;
  }
  .spm-head { padding: 20px 22px 16px; }
  .spm-eyebrow {
    font-size: 11px; font-weight: 600; color: var(--accent-ink);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .spm-title { font-size: 19px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; margin-top: 6px; }
  .spm-rows { border-top: 1px solid var(--line); padding: 16px 22px; display: flex; flex-direction: column; gap: 12px; }
  .spm-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13.5px; flex-wrap: wrap; }
  .spm-row .k { color: var(--ink-3); min-width: 0; }
  .spm-row .k .sub { display: block; font-size: 11px; color: var(--ink-4); margin-top: 2px; }
  .spm-row .v { font-weight: 600; font-variant-numeric: tabular-nums; min-width: 0; }
  .spm-row .v.big { font-size: 19px; letter-spacing: -0.01em; }
  .spm-dates { border-top: 1px solid var(--line); padding: 14px 22px 4px; }
  .spm-dates-head {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--ink-3); font-weight: 500; margin-bottom: 10px;
  }
  .spm-date { display: flex; align-items: center; gap: 11px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .spm-date:last-of-type { border-bottom: none; }
  .spm-cal {
    width: 40px; flex-shrink: 0; border: 1px solid var(--line);
    border-radius: 8px; overflow: hidden; text-align: center; background: var(--surface);
  }
  .spm-cal .m {
    font-size: 8.5px; letter-spacing: 0.08em; color: #fff; text-transform: uppercase;
    font-weight: 600; background: var(--accent); padding: 2px 0;
  }
  .spm-cal .d { font-size: 15px; font-weight: 600; padding: 3px 0 4px; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .spm-txt { flex: 1; min-width: 0; font-size: 13px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .spm-more { font-size: 12px; color: var(--ink-4); padding: 10px 0 12px; }
  .spm-foot { border-top: 1px solid var(--line); padding: 16px 22px 20px; background: var(--surface-2); }
  .spm-cta {
    height: 42px; border-radius: 10px;
    background: var(--accent); color: #fff; display: grid; place-items: center;
    font-size: 14px; font-weight: 600; opacity: 0.75;
  }
`;
