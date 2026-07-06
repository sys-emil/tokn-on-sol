import React from 'react';
import { Spark } from 'tokn-on-sol';

const VERKAUF_12_TAGE = [2, 3, 3, 5, 4, 7, 9, 8, 12, 14, 13, 18];
const RUHIGE_WOCHE = [4, 4, 5, 4, 4, 5, 4];

export const Verkaufstrend = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <Spark data={VERKAUF_12_TAGE} />
    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Ticketverkäufe, letzte 12 Tage</span>
  </div>
);

export const ImKpi = () => (
  <div className="kpis" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 460 }}>
    <div className="kpi">
      <div className="spark"><Spark data={VERKAUF_12_TAGE} /></div>
      <div className="label">Verkaufte Tickets</div>
      <div className="value">148</div>
      <div className="delta">▲ +21 diese Woche</div>
    </div>
    <div className="kpi">
      <div className="spark"><Spark data={RUHIGE_WOCHE} color="var(--ink-4)" /></div>
      <div className="label">Umsatz</div>
      <div className="value">3.552&nbsp;€</div>
      <div className="delta neg">▼ −4 % zur Vorwoche</div>
    </div>
  </div>
);

export const Farbvarianten = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Spark data={VERKAUF_12_TAGE} color="var(--accent)" width={140} height={32} />
    <Spark data={VERKAUF_12_TAGE} color="var(--ok)" width={140} height={32} />
    <Spark data={VERKAUF_12_TAGE} color="var(--ink-4)" width={140} height={32} />
  </div>
);
