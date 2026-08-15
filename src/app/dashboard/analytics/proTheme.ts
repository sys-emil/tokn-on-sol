/*
 * Pro-Bereich: invertiertes, dunkles Theme (Pitch-Deck-Optik).
 * Die Seite überschreibt die globalen Tokens; sämtliche Komponenten-CSS
 * (topbar, card, kpi, chip, input …) folgt automatisch. Der Style-Tag lebt
 * nur solange diese Seite gemountet ist.
 */
export const PRO_CSS = `
  :root {
    color-scheme: dark;
    --ink:        oklch(0.97 0.008 285);
    --ink-2:      oklch(0.82 0.015 285);
    --ink-3:      oklch(0.64 0.018 285);
    --ink-4:      oklch(0.50 0.02 285);
    --line:       oklch(0.30 0.02 285 / 0.55);
    --line-2:     oklch(0.40 0.03 285 / 0.65);
    --surface:    oklch(0.185 0.018 285);
    --surface-2:  oklch(0.135 0.016 285);
    --surface-3:  oklch(0.235 0.022 285);
    --accent:     oklch(0.74 0.16 285);
    --accent-2:   oklch(0.80 0.14 285);
    --accent-ink: oklch(0.88 0.09 285);
    --accent-wash:oklch(0.34 0.10 285 / 0.40);
    --accent-line:oklch(0.48 0.13 285 / 0.55);
    --ok:         oklch(0.78 0.15 155);
    --ok-wash:    oklch(0.36 0.08 155 / 0.35);
    --warn:       oklch(0.82 0.15 78);
    --warn-wash:  oklch(0.38 0.09 78 / 0.35);
    --bad:        oklch(0.70 0.17 22);
    --bad-wash:   oklch(0.38 0.10 22 / 0.35);
    --shadow-sm:  0 1px 0 oklch(0.10 0.02 285 / 0.6);
    --shadow:     0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.28);
    --shadow-lg:  0 24px 60px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.35);
  }
  input[type="checkbox"] { accent-color: var(--accent); }

  .app {
    background:
      radial-gradient(1200px 520px at 12% -8%, oklch(0.32 0.10 285 / 0.30), transparent 62%),
      /* Zweiter Schimmer auf der Magenta-Seite; Hue 240 war hier schlicht blau. */
      radial-gradient(900px 420px at 92% 4%, oklch(0.30 0.08 310 / 0.18), transparent 60%),
      var(--surface-2);
  }
  .topbar {
    background: oklch(0.135 0.016 285 / 0.82);
    backdrop-filter: blur(14px);
    border-bottom-color: var(--line);
  }
  .card {
    background: linear-gradient(180deg, oklch(0.205 0.02 285) 0%, oklch(0.178 0.018 285) 100%);
    border-color: var(--line);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.32);
  }
  .input, .textarea, .select { background: oklch(0.155 0.016 285); color: var(--ink); border-color: var(--line-2); }
  .input::placeholder, .textarea::placeholder { color: var(--ink-4); }
  .btn.primary { color: oklch(0.16 0.03 285); font-weight: 600; }
  .btn.ghost { background: oklch(0.225 0.02 285); color: var(--ink); border-color: var(--line-2); }
  .btn.ghost:hover { background: oklch(0.27 0.025 285); }
  .chip { background: var(--surface-3); color: var(--ink-2); border-color: var(--line-2); }
  .chip.ok { background: var(--ok-wash); color: oklch(0.86 0.13 155); border-color: oklch(0.45 0.10 155 / .6); }
  .chip.warn { background: var(--warn-wash); color: oklch(0.88 0.13 78); border-color: oklch(0.48 0.11 78 / .6); }
  .chip.bad { background: var(--bad-wash); color: oklch(0.82 0.14 22); border-color: oklch(0.46 0.12 22 / .6); }
  .chip.accent { background: var(--accent-wash); color: oklch(0.88 0.10 285); border-color: var(--accent-line); }
  .ticket-table thead th { background: transparent; color: var(--ink-3); }
  .ticket-table tbody tr:hover { background: oklch(0.225 0.022 285); }
  .empty { color: var(--ink-3); }
  ::selection { background: var(--accent-wash); }
  @keyframes riseIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

  /* ── Hero + Zeitraum-Steuerung ──────────────────────────────────────── */
  .pro-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 32px; flex-wrap: wrap; padding-top: 8px;
  }
  .pro-head .hero { max-width: 640px; margin: 0; padding: 44px 0 0; }
  .pro-head .eyebrow {
    background: transparent; border: none; padding: 0; margin-bottom: 14px;
    font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
    color: oklch(0.82 0.10 285);
  }
  .pro-head .hero h1 { font-size: 52px; line-height: 1.02; font-weight: 700; letter-spacing: -0.035em; }
  .pro-head .hero h1 .accent-line { color: var(--accent); }
  .pro-head .lead { font-size: 15.5px; line-height: 1.6; color: var(--ink-3); text-wrap: pretty; }
  @media (max-width: 720px) { .pro-head .hero h1 { font-size: 36px; } }

  .range-col { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
  .pill-group {
    display: flex; gap: 6px; padding: 4px; border-radius: 11px;
    background: var(--surface); border: 1px solid var(--line);
  }
  .pill-group.sm { padding: 3px; border-radius: 9px; background: oklch(0.155 0.016 285); }
  .pill {
    padding: 6px 13px; border-radius: 8px; border: none; cursor: pointer;
    font: inherit; font-size: 12.5px; font-weight: 500; letter-spacing: -0.005em;
    background: transparent; color: var(--ink-3); transition: background .15s, color .15s;
  }
  .pill:hover { color: var(--ink-2); }
  .pill[aria-pressed="true"] {
    background: oklch(0.30 0.05 285); color: var(--ink); font-weight: 600;
    box-shadow: inset 0 1px 0 oklch(0.45 0.08 285 / .5);
  }
  .compare-toggle {
    display: flex; align-items: center; gap: 8px;
    font-size: 12.5px; color: var(--ink-3); cursor: pointer; user-select: none;
  }

  /* ── Tab-Leiste ─────────────────────────────────────────────────────── */
  .pro-tabs {
    /* Bleeds to the container edges so the blurred bar spans the full width;
       61px = topbar height (60px) + its 1px border. */
    position: sticky; top: 61px; z-index: 30; margin: 34px -24px 0;
    padding: 0 24px; display: flex; align-items: center; gap: 4px;
    background: oklch(0.135 0.016 285 / 0.86); backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line); overflow-x: auto; scrollbar-width: none;
  }
  .pro-tabs::-webkit-scrollbar { display: none; }
  .pro-tab {
    position: relative; padding: 15px 4px; margin-right: 22px;
    background: none; border: none; cursor: pointer; white-space: nowrap;
    font: inherit; font-size: 13.5px; font-weight: 500; letter-spacing: -0.01em;
    color: var(--ink-3); display: inline-flex; align-items: center; gap: 8px;
    transition: color .15s;
  }
  .pro-tab:hover { color: var(--ink-2); }
  .pro-tab[aria-selected="true"] { color: var(--ink); font-weight: 600; box-shadow: inset 0 -2px 0 var(--accent); }
  .pro-tab .count {
    font-size: 11px; font-weight: 500; color: var(--ink-4);
    background: oklch(0.25 0.02 285); padding: 2px 6px; border-radius: 5px;
  }
  .live-dot { margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--ink-4); white-space: nowrap; }
  .live-dot i { width: 5px; height: 5px; border-radius: 50%; background: var(--ok); }
  @media (max-width: 720px) { .live-dot { display: none; } }

  .tab-panel { display: flex; flex-direction: column; gap: 22px; animation: riseIn .3s ease-out; padding-top: 28px; }

  /* ── KPI-Leiste ─────────────────────────────────────────────────────── */
  .kpi-strip { padding: 0; overflow: hidden; }
  .kpi-strip .accent-rule { height: 2px; background: linear-gradient(90deg, var(--accent), oklch(0.72 0.14 330), transparent); }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
  .kpi-cell { padding: 20px 22px; min-width: 0; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .kpi-cell .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .kpi-cell .label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); }
  .kpi-cell .value { margin-top: 12px; font-size: 29px; font-weight: 620; letter-spacing: -0.035em; font-variant-numeric: tabular-nums; line-height: 1; }
  .kpi-cell .foot { margin-top: 9px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .kpi-cell .sub { font-size: 11.5px; color: var(--ink-4); }
  /* "davon"-Zeilen unter der KPI-Leiste: Abendkasse und Saisonpaesse. */
  .offbook { padding: 14px 22px 16px; display: grid; gap: 8px; }
  .offbook-row {
    display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
    font-size: 12.5px;
  }
  .offbook-row .k { font-weight: 600; color: var(--ink-2); }
  .offbook-row .v { font-variant-numeric: tabular-nums; color: var(--ink); }
  .offbook-row .h { font-size: 11.5px; color: var(--ink-4); }

  .delta {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11.5px; font-weight: 600; padding: 2px 7px; border-radius: 6px;
    font-variant-numeric: tabular-nums;
    background: oklch(0.26 0.02 285); color: var(--ink-3);
  }
  .delta.pos { background: var(--ok-wash); color: oklch(0.86 0.13 155); }
  .delta.neg { background: var(--bad-wash); color: oklch(0.82 0.14 22); }

  /* ── Karten-Kopfzeilen ──────────────────────────────────────────────── */
  .panel { padding: 0; }
  .panel-head {
    padding: 20px 24px; border-bottom: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  }
  .panel-head h3 { font-size: 15px; font-weight: 600; letter-spacing: -0.015em; }
  .panel-head p { margin-top: 3px; font-size: 12.5px; color: var(--ink-3); }
  .panel-body { padding: 20px 24px; }
  .panel-foot { border-top: 1px solid var(--line); padding: 14px 24px; display: flex; gap: 26px; flex-wrap: wrap; font-size: 12.5px; color: var(--ink-3); }
  .two-col { display: grid; grid-template-columns: 1.15fr 1fr; gap: 22px; }
  .two-col.narrow-right { grid-template-columns: 1fr 0.78fr; }
  @media (max-width: 1000px) { .two-col, .two-col.narrow-right { grid-template-columns: 1fr; } }

  /* ── Trend-Chart ────────────────────────────────────────────────────── */
  .trend-svg { width: 100%; height: 250px; display: block; overflow: visible; }
  .trend-tip {
    position: absolute; top: -6px; min-width: 170px;
    background: oklch(0.24 0.022 285); border: 1px solid var(--line-2); border-radius: 11px;
    padding: 11px 14px; box-shadow: var(--shadow-lg); pointer-events: none; z-index: 5;
  }
  .trend-tip .tip-day { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-4); }
  .trend-tip .tip-value { margin-top: 5px; font-size: 17px; font-weight: 620; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .trend-tip .tip-prev { margin-top: 5px; font-size: 11.5px; color: var(--ink-3); display: flex; align-items: center; gap: 6px; }
  .trend-tip .tip-dash { width: 14px; height: 2px; background: var(--ink-4); border-radius: 2px; }
  .trend-tip .tip-delta { margin-top: 4px; font-size: 11.5px; font-weight: 550; }
  .trend-axis {
    display: flex; justify-content: space-between; padding: 6px 2px 12px;
    font-size: 11px; color: var(--ink-4); font-variant-numeric: tabular-nums;
  }
  .legend-dash { width: 16px; height: 2px; border-radius: 2px; background: repeating-linear-gradient(90deg, var(--ink-4) 0 4px, transparent 4px 8px); }
  .legend-line { width: 16px; height: 3px; border-radius: 2px; background: var(--accent); }

  /* ── Funnel & Kanäle ────────────────────────────────────────────────── */
  .bar-track { height: 9px; border-radius: 99px; background: oklch(0.26 0.02 285); overflow: hidden; }
  .bar-track > span { display: block; height: 100%; border-radius: 99px; background: var(--accent); transition: width .5s cubic-bezier(.2,.8,.2,1); }
  .funnel-row + .funnel-row { margin-top: 18px; }
  .funnel-row .head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
  .funnel-row .name { font-size: 13.5px; font-weight: 520; }
  .funnel-row .meta { font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
  .funnel-row .note { margin-top: 7px; font-size: 11.5px; color: var(--warn); }
  .channel-row {
    display: grid; grid-template-columns: 118px 1fr 78px 62px; align-items: center; gap: 14px;
    padding: 11px 0; border-bottom: 1px solid var(--line);
  }
  .channel-row:last-of-type { border-bottom: none; }
  .channel-row .name { font-size: 13px; font-weight: 520; }
  .channel-row .num { font-size: 12.5px; text-align: right; font-variant-numeric: tabular-nums; color: var(--ink-2); }
  @media (max-width: 560px) { .channel-row { grid-template-columns: 92px 1fr 62px; } .channel-row .cr { display: none; } }
  .insight {
    margin-top: 16px; font-size: 12.5px; color: var(--ink-3); line-height: 1.6;
    display: flex; gap: 10px; align-items: flex-start;
  }
  .insight > svg { color: var(--accent); flex: none; margin-top: 1px; }
  .insight b { color: var(--ink-2); font-weight: 600; }

  /* ── Prognose ───────────────────────────────────────────────────────── */
  .forecast-row { padding: 18px 0; border-bottom: 1px solid var(--line); }
  .forecast-row:last-child { border-bottom: none; }
  .forecast-row .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .forecast-row .name { font-size: 14px; font-weight: 560; letter-spacing: -0.01em; }
  .forecast-row .when { margin-top: 3px; font-size: 12px; color: var(--ink-4); }
  .forecast-bar { margin-top: 12px; position: relative; height: 10px; border-radius: 99px; background: oklch(0.26 0.02 285); overflow: hidden; }
  .forecast-bar .projected {
    position: absolute; inset: 0 auto 0 0; border-radius: 99px;
    background: repeating-linear-gradient(115deg, oklch(0.45 0.10 285) 0 6px, oklch(0.36 0.07 285) 6px 12px);
  }
  .forecast-bar .sold { position: absolute; inset: 0 auto 0 0; border-radius: 99px; background: var(--accent); }
  .forecast-row .foot { margin-top: 9px; display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
  .forecast-row .foot b { color: var(--ink); font-weight: 600; }

  /* ── Benchmark ──────────────────────────────────────────────────────── */
  .benchmark-score { text-align: center; padding: 18px 0 6px; }
  .benchmark-score .big { font-size: 48px; font-weight: 660; letter-spacing: -0.045em; line-height: 1; color: var(--accent); }
  .benchmark-score p { margin-top: 10px; font-size: 13px; color: var(--ink-3); line-height: 1.55; }
  .benchmark-rail { position: relative; height: 8px; border-radius: 99px; background: linear-gradient(90deg, oklch(0.30 0.02 285), var(--accent)); }
  .benchmark-rail i { position: absolute; top: -5px; width: 3px; height: 18px; border-radius: 2px; background: var(--ink); box-shadow: 0 0 0 3px var(--surface-2); }
  .benchmark-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
  .benchmark-row .vals { display: flex; align-items: baseline; gap: 9px; font-variant-numeric: tabular-nums; }
  .benchmark-row .you { font-size: 14.5px; font-weight: 620; }
  .benchmark-row .market { font-size: 12px; color: var(--ink-4); }

  /* ── Sortierbare Tabellen ───────────────────────────────────────────── */
  .ticket-table th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
  .ticket-table th.sortable:hover { color: var(--ink-2); }
  .ticket-table th.sortable[aria-sort] { color: var(--ink-2); }
  .ticket-table th.right, .ticket-table td.right { text-align: right; }
  .mini-bar { width: 64px; height: 6px; border-radius: 99px; background: oklch(0.26 0.02 285); overflow: hidden; flex: none; }
  .mini-bar > span { display: block; height: 100%; border-radius: 99px; background: var(--accent); }
  .table-scroll { overflow-x: auto; }

  /* ── Segmente ───────────────────────────────────────────────────────── */
  .segment-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  @media (max-width: 900px) { .segment-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 480px) { .segment-grid { grid-template-columns: 1fr; } }
  .segment-card {
    padding: 18px 20px; border-radius: 14px; cursor: pointer; text-align: left;
    transition: background .18s, border-color .18s, box-shadow .18s;
    background: linear-gradient(180deg, oklch(0.205 0.02 285), oklch(0.178 0.018 285));
    border: 1px solid var(--line); box-shadow: var(--shadow); font: inherit; color: inherit;
  }
  .segment-card:hover { border-color: var(--line-2); }
  .segment-card[aria-pressed="true"] {
    background: oklch(0.24 0.03 285); border-color: var(--accent-line);
    box-shadow: 0 0 0 3px oklch(0.74 0.16 285 / .12);
  }
  .segment-card .top { display: flex; align-items: center; justify-content: space-between; }
  .segment-card .ic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 13px; font-weight: 700; }
  .segment-card .trend { font-size: 11px; color: var(--ink-4); }
  .segment-card .count { margin-top: 16px; font-size: 26px; font-weight: 640; letter-spacing: -0.035em; font-variant-numeric: tabular-nums; }
  .segment-card .name { margin-top: 4px; font-size: 13px; font-weight: 540; }
  .segment-card .desc { margin-top: 3px; font-size: 11.5px; color: var(--ink-4); line-height: 1.45; }

  /* ── Kohorten ───────────────────────────────────────────────────────── */
  .cohort-grid { display: grid; gap: 6px; min-width: 640px; }
  .cohort-head { font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-4); text-align: center; padding-bottom: 4px; }
  .cohort-label { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--ink-2); }
  .cohort-label b { font-weight: 540; }
  .cohort-label span { font-size: 11px; color: var(--ink-4); font-variant-numeric: tabular-nums; }
  .cohort-cell { height: 38px; border-radius: 7px; display: grid; place-items: center; font-size: 12px; font-weight: 560; font-variant-numeric: tabular-nums; }
  .cohort-cell.empty-cell { background: oklch(0.19 0.015 285); border: 1px dashed var(--line); }

  /* ── Kunden-Tabelle ─────────────────────────────────────────────────── */
  .cust-cell { display: flex; align-items: center; gap: 11px; }
  .cust-av { width: 30px; height: 30px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 11px; font-weight: 600; background: oklch(0.28 0.04 285); color: var(--ink-2); }
  .cust-mail { font-size: 13px; font-weight: 520; }
  .cust-id { font-size: 11px; color: var(--ink-4); font-family: var(--mono); }
  .tier-pill { font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 6px; background: var(--accent-wash); color: var(--accent-ink); }
  .tier-pill.none { background: oklch(0.24 0.02 285); color: var(--ink-4); }

  /* ── Treue-Stufen ───────────────────────────────────────────────────── */
  .tier-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
  .tier-card { border-radius: 16px; overflow: hidden; border: 1px solid var(--line); background: linear-gradient(180deg, oklch(0.21 0.022 285 / .55), oklch(0.178 0.018 285) 55%); box-shadow: var(--shadow); }
  .tier-card.inactive { opacity: 0.6; }
  .tier-card .ribbon { height: 3px; background: linear-gradient(90deg, var(--accent), transparent); }
  .tier-card .body { padding: 22px 22px 20px; }
  .tier-card .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .tier-badge { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font-weight: 700; font-size: 14px; background: var(--accent-wash); color: var(--accent-ink); border: 1px solid var(--accent-line); flex: none; }
  .tier-card .tname { font-size: 15px; font-weight: 620; letter-spacing: -0.015em; }
  .tier-card .tsub { font-size: 11.5px; color: var(--ink-4); }
  .tier-benefit { margin-top: 18px; padding: 14px; border-radius: 10px; background: oklch(0.155 0.016 285); border: 1px solid var(--line); }
  .tier-benefit .k { font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-4); }
  .tier-benefit .v { margin-top: 6px; font-size: 14px; font-weight: 540; line-height: 1.4; }
  .tier-stats { margin-top: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tier-stats .n { font-size: 19px; font-weight: 620; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .tier-stats .k { font-size: 11px; color: var(--ink-4); margin-top: 2px; }
  .tier-add {
    border: 1px dashed var(--line-2); border-radius: 16px; background: transparent; color: var(--ink-3);
    display: grid; place-items: center; gap: 8px; cursor: pointer; font: inherit; min-height: 200px; padding: 24px;
    transition: border-color .15s, color .15s;
  }
  .tier-add:hover { border-color: var(--accent-line); color: var(--accent-ink); }

  /* ── Wirkung + Einlösen ─────────────────────────────────────────────── */
  .impact-row + .impact-row { margin-top: 20px; }
  .impact-row .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 9px; }
  .impact-row .name { font-size: 13.5px; font-weight: 520; }
  .impact-row .uplift { font-size: 12.5px; color: var(--ok); font-weight: 550; }
  .impact-bar { display: flex; align-items: center; gap: 10px; }
  .impact-bar + .impact-bar { margin-top: 6px; }
  .impact-bar .k { width: 96px; font-size: 11.5px; color: var(--ink-3); }
  .impact-bar .track { flex: 1; height: 16px; border-radius: 5px; background: oklch(0.26 0.02 285); overflow: hidden; }
  .impact-bar .track > span { display: block; height: 100%; border-radius: 5px; background: var(--accent); }
  .impact-bar .track.muted > span { background: oklch(0.36 0.03 285); }
  .impact-bar .v { width: 72px; text-align: right; font-size: 12.5px; font-variant-numeric: tabular-nums; font-weight: 560; }
  .redeem-list { display: flex; flex-direction: column; }
  .redeem-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); }
  .redeem-item:last-child { border-bottom: none; }
  .redeem-item .who { font-size: 12.5px; }
  .redeem-item .what { font-size: 11px; color: var(--ink-4); }
  .redeem-item .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); flex: none; }
  .redeem-msg { padding: 11px 14px; border-radius: 10px; font-size: 12.5px; }
  .redeem-msg.ok { background: var(--ok-wash); color: oklch(0.88 0.13 155); }
  .redeem-msg.bad { background: var(--warn-wash); color: oklch(0.88 0.13 78); }
  .subhead { font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-4); }

  /* ── Drawer-Ergänzungen ─────────────────────────────────────────────── */
  .drawer { background: oklch(0.185 0.018 285); border-left: 1px solid var(--line); }
  .drawer-foot { background: oklch(0.165 0.017 285); }
  .drawer-head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .check-row { display: flex; align-items: center; gap: 9px; font-size: 13px; margin-top: 6px; cursor: pointer; }
  .drawer-error { margin-top: 16px; padding: 11px 14px; border-radius: 10px; font-size: 12.5px; background: var(--bad-wash); color: oklch(0.86 0.13 22); }
  .drawer-warn { margin-top: 16px; padding: 11px 14px; border-radius: 10px; font-size: 12.5px; background: var(--warn-wash); color: oklch(0.88 0.13 78); }
  .campaign-note { display: flex; gap: 10px; align-items: flex-start; padding: 14px; border-radius: 10px; background: oklch(0.155 0.016 285); border: 1px solid var(--line); font-size: 12.5px; color: var(--ink-3); line-height: 1.6; }
  .campaign-note > svg { color: var(--accent); flex: none; margin-top: 2px; }
  .campaign-note b { color: var(--ink-2); }
  .tier-preview { margin-top: 22px; padding: 16px; border-radius: 12px; background: oklch(0.155 0.016 285); border: 1px solid var(--line); }
  .tier-preview .preview-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-4); }
  .preview-card { margin-top: 12px; padding: 14px; border-radius: 10px; background: var(--accent-wash); border: 1px solid var(--accent-line); display: flex; align-items: center; gap: 12px; }
  .preview-badge { width: 34px; height: 34px; border-radius: 9px; background: var(--accent); color: oklch(0.16 0.03 285); display: grid; place-items: center; font-weight: 700; font-size: 13px; flex: none; }
  .preview-benefit { font-size: 13.5px; font-weight: 600; }
  .preview-sub { font-size: 11.5px; color: var(--ink-2); margin-top: 2px; }

  /* ── Upsell (Free-Plan) ─────────────────────────────────────────────── */
  .pro-medal {
    width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
    display: grid; place-items: center; color: white;
    background: radial-gradient(circle at 32% 28%, oklch(0.78 0.14 285), oklch(0.56 0.22 285) 58%, oklch(0.42 0.20 285));
    border: 2px solid oklch(0.88 0.06 285);
    box-shadow: 0 6px 20px oklch(0.52 0.20 285 / 0.45), inset 0 1px 2px rgba(255,255,255,0.5);
  }
  .pro-features { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 560px; margin: 22px auto 0; text-align: left; }
  @media (max-width: 560px) { .pro-features { grid-template-columns: 1fr; } }
  .pro-feature { display: flex; gap: 11px; align-items: flex-start; padding: 13px 14px; border: 1px solid var(--accent-line); border-radius: var(--radius); background: var(--accent-wash); }
  .pro-feature .ic { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; background: var(--surface); color: var(--accent); border: 1px solid var(--accent-line); }
  .pro-feature b { display: block; font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
  .pro-feature span { font-size: 12px; color: var(--ink-3); line-height: 1.5; margin-top: 2px; display: block; }

  @media (prefers-reduced-motion: reduce) {
    .tab-panel { animation: none; }
    .bar-track > span, .impact-bar .track > span { transition: none; }
  }
`;
