import { Icon } from '@/app/components/passlyUi';

/**
 * Nachbau der Kaufseite /shop/[id].
 *
 * Liegt hier wie `EventCard` und `ShowcaseHero`, damit dieselbe Karte an
 * beiden Stellen steht, an denen sie gezeigt wird: in der Live-Vorschau des
 * Event-Editors und im Showcase der Startseite. Zwei Nachbauten waeren zwei
 * Wahrheiten — und die auf der Startseite wuerde als erste veralten.
 *
 * Reine Darstellung: Preis, Datum und Gebuehrenzeile kommen fertig formatiert
 * herein, genau wie bei `ShowcaseHero`. Die Beschriftungen sind deutsch, weil
 * beide Aufrufstellen es sind (Dashboard und Startseite); die echte Kaufseite
 * ist uebersetzt und benutzt diese Komponente nicht.
 */

export interface ShopCardProps {
  name: string;
  /** Bildflaeche, absolut positioniert. Fehlt sie, entfaellt der Bildbereich. */
  art?: React.ReactNode;
  /** Datums-Chip links neben dem Titel, z. B. { month: 'SEP', day: '5' }. */
  dateChip: { month: string; day: string };
  /** Ausgeschriebenes Datum, z. B. "Freitag, 5. September · 20:00 Uhr". */
  whenLabel: string;
  venue?: string | null;
  description?: string | null;
  /** Fertig formatiert, z. B. "ab 12,00 €" oder "Kostenlos". */
  priceLabel: string;
  /** Zeile unter „Ticketpreis“; `null` blendet sie aus. */
  feeNote?: string | null;
  soldOut?: boolean;
  tiers: { name: string; priceLabel: string }[];
  ctaLabel: string;
}

export function ShopCard({
  name,
  art,
  dateChip,
  whenLabel,
  venue,
  description,
  priceLabel,
  feeNote,
  soldOut = false,
  tiers,
  ctaLabel,
}: ShopCardProps) {
  return (
    <div className="psc">
      {art && <div className="psc-art">{art}</div>}

      <div className="psc-head">
        <div className="psc-datechip">
          <div className="m">{dateChip.month}</div>
          <div className="d">{dateChip.day}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{name}</h3>
          <div className="when">
            <span><Icon name="calendar" size={13} /> {whenLabel}</span>
            {venue && <span><Icon name="location" size={13} /> {venue}</span>}
          </div>
        </div>
      </div>

      {description && <div className="psc-desc">{description}</div>}

      <div className="psc-rows">
        <div className="psc-row">
          <span className="k">
            Ticketpreis
            {feeNote && <span className="sub">{feeNote}</span>}
          </span>
          <span className="v big">{priceLabel}</span>
        </div>
        <div className="psc-row">
          <span className="k">Verfügbarkeit</span>
          {soldOut
            ? <span className="chip bad"><span className="d" />Ausverkauft</span>
            : <span className="chip ok"><span className="d" />Verfügbar</span>}
        </div>
      </div>

      <div className="psc-foot">
        {tiers.map((tier, i) => (
          <div key={i} className="psc-tierrow">
            <span>{tier.name}</span>
            <b>{tier.priceLabel}</b>
          </div>
        ))}
        <div className="psc-cta">{ctaLabel}</div>
      </div>
    </div>
  );
}

export const SHOP_CARD_CSS = `
  .psc {
    width: 100%; max-width: 420px; margin: 0 auto;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden;
  }
  .psc-art { aspect-ratio: 2 / 1; position: relative; overflow: hidden; border-bottom: 1px solid var(--line); background: var(--surface-3); }
  .psc-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .psc-head { padding: 20px 22px 18px; display: flex; gap: 14px; align-items: flex-start; }
  .psc-head h3 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
  .psc-head .when { font-size: 12.5px; color: var(--ink-3); margin-top: 5px; display: flex; flex-direction: column; gap: 3px; }
  .psc-head .when span { display: inline-flex; align-items: center; gap: 6px; }
  .psc-datechip {
    width: 52px; flex-shrink: 0; border: 1px solid var(--line);
    border-radius: 9px; overflow: hidden; text-align: center; background: var(--surface);
  }
  .psc-datechip .m {
    font-size: 9.5px; letter-spacing: 0.1em; color: #fff; text-transform: uppercase;
    font-weight: 600; background: var(--accent); padding: 3px 0;
  }
  .psc-datechip .d { font-size: 20px; font-weight: 600; padding: 4px 0 5px; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .psc-desc { padding: 0 22px 18px; font-size: 13px; color: var(--ink-2); line-height: 1.6; white-space: pre-line; }
  .psc-rows { border-top: 1px solid var(--line); padding: 16px 22px; display: flex; flex-direction: column; gap: 12px; }
  .psc-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13.5px; flex-wrap: wrap; }
  .psc-row .k { color: var(--ink-3); min-width: 0; }
  .psc-row .k .sub { display: block; font-size: 11px; color: var(--ink-4); margin-top: 2px; }
  .psc-row .v { font-weight: 600; font-variant-numeric: tabular-nums; min-width: 0; }
  .psc-row .v.big { font-size: 19px; letter-spacing: -0.01em; }
  .psc-foot { border-top: 1px solid var(--line); padding: 18px 22px 20px; background: var(--surface-2); display: flex; flex-direction: column; gap: 8px; }
  .psc-tierrow { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--ink-2); }
  .psc-tierrow b { font-variant-numeric: tabular-nums; }
  .psc-cta {
    margin-top: 8px; height: 42px; border-radius: 10px;
    background: var(--accent); color: #fff; display: grid; place-items: center;
    font-size: 14px; font-weight: 600; opacity: 0.75;
  }
`;
