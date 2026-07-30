import type { Metadata } from 'next';
import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { ScrollReveal } from '@/app/components/ScrollReveal';
import { FeeCalculator } from '@/app/components/FeeCalculator';
import { ProPrice } from '@/app/components/ProPrice';

/*
 * Canonical pricing page (since 2026-07-30). /fuer-veranstalter links here
 * instead of restating the numbers, so there is one source of truth for what
 * Passly costs — and the fee figures themselves come from `serviceFeePer-
 * TicketCents` via FeeCalculator, i.e. from the code that actually charges.
 *
 * No competitor comparisons: their fee schedules change and a wrong claim in
 * German comparative advertising is an actual legal risk, not just sloppy.
 */

export const metadata: Metadata = {
  title: 'Preise · Passly',
  description:
    'Passly kostet Veranstalter nichts: 100 % des Ticketpreises gehen an dich, die Servicegebühr von 1 € + 4 % zahlt der Gast. Pro-Funktionen optional.',
};

const PAGE_CSS = `
  .price-hero { padding: 56px 0 40px; text-align: center; }
  @media (max-width: 640px) { .price-hero { padding: 36px 0 28px; } }
  .price-hero h1 {
    font-size: clamp(34px, 5vw, 52px);
    font-weight: 600; letter-spacing: -0.04em; line-height: 1.06;
  }
  .price-hero h1 .accent { color: var(--accent); }
  .price-hero .lead {
    margin: 16px auto 0;
    font-size: 16.5px; line-height: 1.6; color: var(--ink-3);
    max-width: 56ch;
  }

  .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: stretch; }
  @media (max-width: 860px) { .plan-grid { grid-template-columns: 1fr; } }
  .plan {
    padding: 30px;
    display: flex; flex-direction: column; gap: 18px;
  }
  @media (max-width: 640px) { .plan { padding: 24px 20px; } }
  .plan.pro {
    border-color: var(--accent-line);
    background:
      radial-gradient(600px 220px at 15% -25%, var(--accent-wash), transparent 70%),
      var(--surface);
  }
  .plan .tag {
    align-self: flex-start;
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 11px; font-weight: 600; color: var(--accent-ink);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .plan h2 { font-size: 21px; font-weight: 600; letter-spacing: -0.025em; }
  .plan .amount { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .plan .amount .big { font-size: 38px; font-weight: 600; letter-spacing: -0.035em; line-height: 1; }
  .plan .amount .unit { font-size: 14px; color: var(--ink-3); }
  .plan .what { font-size: 13.5px; color: var(--ink-3); line-height: 1.6; }
  .plan ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .plan li {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 13.5px; color: var(--ink-2); line-height: 1.55;
  }
  .plan li svg { color: var(--accent); flex-shrink: 0; margin-top: 3px; }
  .plan .foot { margin-top: auto; padding-top: 8px; }

  .price-note {
    display: flex; gap: 12px; align-items: flex-start;
    padding: 16px 18px;
    border: 1px solid var(--line-2);
    background: var(--surface);
    border-radius: var(--radius);
    font-size: 13.5px; color: var(--ink-2); line-height: 1.6;
  }
  .price-note svg { color: var(--accent); flex-shrink: 0; margin-top: 2px; }

  .calc-section { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 40px; align-items: center; }
  @media (max-width: 900px) { .calc-section { grid-template-columns: 1fr; gap: 24px; } }
  .calc-copy h2 { font-size: clamp(23px, 3.2vw, 30px); font-weight: 600; letter-spacing: -0.03em; line-height: 1.18; }
  .calc-copy p { font-size: 14.5px; color: var(--ink-3); line-height: 1.65; margin-top: 12px; max-width: 44ch; }

  .faq-list { display: flex; flex-direction: column; gap: 12px; }
  .faq-item { padding: 20px 22px; }
  .faq-item h3 { font-size: 15px; font-weight: 600; letter-spacing: -0.015em; }
  .faq-item p { font-size: 13.5px; color: var(--ink-3); line-height: 1.65; margin-top: 7px; }

  .price-cta {
    background: linear-gradient(135deg, var(--accent), oklch(0.48 0.22 calc(var(--hue) + 30)));
    border-radius: var(--radius-lg);
    padding: 48px 32px;
    text-align: center;
    color: white;
    box-shadow: var(--shadow-lg);
  }
  @media (max-width: 640px) { .price-cta { padding: 40px 22px; } }
  .price-cta h2 { font-size: clamp(23px, 3.2vw, 32px); font-weight: 600; letter-spacing: -0.03em; }
  .price-cta p { font-size: 14.5px; opacity: 0.85; margin-top: 10px; }
  .price-cta .btn { margin-top: 24px; background: white; color: var(--accent-ink); }
  .price-cta .btn:hover { background: oklch(0.96 0.01 var(--hue)); }

  .footer {
    border-top: 1px solid var(--line);
    margin-top: 64px;
    padding: 28px 0 8px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    font-size: 12.5px; color: var(--ink-3);
    flex-wrap: wrap;
  }
  .footer .links { display: flex; gap: 14px 18px; flex-wrap: wrap; }
  .footer a:hover { color: var(--ink); }
`;

export default function PreisePage() {
  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/fuer-veranstalter">Für Veranstalter</Link>
              <Link href="/preise">Preise</Link>
              <Link href="/events">Events</Link>
            </div>
            <div className="topbar-right">
              <Link href="/become-organizer" className="btn primary sm">Event anlegen</Link>
            </div>
          </div>
        </div>

        <div className="main">
          <ScrollReveal />
          <div className="aurora" aria-hidden="true" />
          <div className="container">

            <section className="price-hero" data-reveal>
              <div className="eyebrow" style={{ fontSize: 11.5, color: 'var(--accent-ink)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                Preise
              </div>
              <h1>
                Für dich kostenlos.<br />
                <span className="accent">Für deine Gäste transparent.</span>
              </h1>
              <p className="lead">
                Passly nimmt dir nichts vom Ticketpreis. Die Servicegebühr zahlt der Gast
                und sieht sie vor dem Kauf. Keine Einrichtungskosten, keine Grundgebühr,
                keine Mindestlaufzeit.
              </p>
            </section>

            {/* Die zwei Pläne */}
            <section>
              <div className="plan-grid">
                <div className="card plan" data-reveal>
                  <span className="tag"><Icon name="ticket" size={12} /> Kostenlos</span>
                  <h2>Alles, was ein Event braucht</h2>
                  <div className="amount">
                    <span className="big">0 €</span>
                    <span className="unit">für dich, dauerhaft</span>
                  </div>
                  <p className="what">
                    Deine Gäste zahlen pro Ticket 1&nbsp;€ + 4&nbsp;% Servicegebühr.
                    Kostenlose Tickets sind komplett gebührenfrei.
                  </p>
                  <ul>
                    <li><Icon name="check" size={14} /> Unbegrenzt Events, öffentlich oder privat per Link</li>
                    <li><Icon name="check" size={14} /> Bis zu fünf Preiskategorien je Event</li>
                    <li><Icon name="check" size={14} /> Öffentliche Markenseite unter getpassly.de/@deinname</li>
                    <li><Icon name="check" size={14} /> Einlass-Scanner im Browser, auch offline</li>
                    <li><Icon name="check" size={14} /> Türlinks fürs Personal, ohne eigenen Zugang</li>
                    <li><Icon name="check" size={14} /> Abendkasse für Barverkauf an der Tür</li>
                    <li><Icon name="check" size={14} /> Weiterverkauf mit eigener Preisobergrenze</li>
                    <li><Icon name="check" size={14} /> Saisonpässe für ganze Reihen</li>
                    <li><Icon name="check" size={14} /> Auszahlungen einzeln nachvollziehbar</li>
                  </ul>
                  <div className="foot">
                    <Link href="/become-organizer" className="btn primary">
                      Event anlegen <Icon name="arrow" size={13} />
                    </Link>
                  </div>
                </div>

                <div className="card plan pro" data-reveal style={{ '--reveal-delay': '110ms' } as React.CSSProperties}>
                  <span className="tag"><Icon name="sparkle" size={12} /> Passly Pro</span>
                  <h2>Wenn aus Abenden ein Publikum wird</h2>
                  <div className="amount">
                    <ProPrice />
                    <span className="unit">monatlich kündbar</span>
                  </div>
                  <p className="what">
                    Alles aus dem kostenlosen Plan, plus die Werkzeuge für die Beziehung
                    zu deinen Gästen. Die Servicegebühr ändert sich dadurch nicht.
                  </p>
                  <ul>
                    <li><Icon name="check" size={14} /> Kundenübersicht mit Segmenten: Stammgäste, Neue, Gefährdete, VIP</li>
                    <li><Icon name="check" size={14} /> E-Mail-Kampagnen an eine Gästegruppe</li>
                    <li><Icon name="check" size={14} /> Nachricht an alle Ticketkäufer eines Events</li>
                    <li><Icon name="check" size={14} /> Mehrstufiges Treueprogramm mit eigenen Vorteilen</li>
                    <li><Icon name="check" size={14} /> Rabattcodes und Gästeliste</li>
                    <li><Icon name="check" size={14} /> Warteliste, sobald ein Event ausverkauft ist</li>
                    <li><Icon name="check" size={14} /> Umsatzprognose, Kanäle und Plattform-Vergleich</li>
                    <li><Icon name="check" size={14} /> Akzentfarbe und Kartenstil für deine Marke</li>
                  </ul>
                  <div className="foot">
                    <Link href="/dashboard/analytics" className="btn ghost">
                      Pro ansehen <Icon name="arrow" size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="price-note" data-reveal>
                <Icon name="shield" size={16} />
                <div>
                  Die Servicegebühr deckt Zahlungsabwicklung, Betrieb und Support. Sie wird
                  im Warenkorb getrennt vom Ticketpreis ausgewiesen, damit deine Gäste
                  wissen, wofür sie zahlen; und damit klar bleibt, dass der Ticketpreis
                  vollständig bei dir landet.
                </div>
              </div>
            </section>

            {/* Rechner */}
            <section>
              <div className="calc-section" data-reveal>
                <div className="calc-copy">
                  <h2>Rechne selbst nach.</h2>
                  <p>
                    Zieh den Regler auf deinen Ticketpreis. Was oben steht, ist genau das,
                    was der Checkout berechnet; die Seite nutzt dieselbe Formel wie die
                    Kasse.
                  </p>
                </div>
                <FeeCalculator />
              </div>
            </section>

            {/* FAQ */}
            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Häufige Fragen zum Preis</h2>
                </div>
              </div>
              <div className="faq-list">
                <div className="card faq-item" data-reveal>
                  <h3>Zahle ich wirklich nichts?</h3>
                  <p>
                    Für den kostenlosen Plan zahlst du keine Einrichtungsgebühr, keine
                    monatliche Gebühr und keinen Anteil am Ticketpreis. Passly verdient an
                    der Servicegebühr, die deine Gäste beim Kauf zahlen.
                  </p>
                </div>
                <div className="card faq-item" data-reveal>
                  <h3>Was kosten kostenlose Tickets?</h3>
                  <p>
                    Nichts, für beide Seiten. Bei einem Ticketpreis von 0&nbsp;€ fällt keine
                    Servicegebühr an, weil gar keine Zahlung abgewickelt wird.
                  </p>
                </div>
                <div className="card faq-item" data-reveal>
                  <h3>Wann bekomme ich mein Geld?</h3>
                  <p>
                    Die Auszahlung läuft automatisch auf dein Bankkonto. Du legst pro Event
                    einen Puffer nach dem Veranstaltungsdatum fest (0 bis 90 Tage); danach
                    wird der Betrag überwiesen. Jede einzelne Auszahlung siehst du im
                    Dashboard.
                  </p>
                </div>
                <div className="card faq-item" data-reveal>
                  <h3>Was passiert bei einer Absage?</h3>
                  <p>
                    Sagst du ein Event ab, werden alle noch nicht ausgezahlten Zahlungen
                    automatisch vollständig zurückerstattet und die Tickets entwertet. Der
                    Verkauf stoppt sofort.
                  </p>
                </div>
                <div className="card faq-item" data-reveal>
                  <h3>Was kostet der Weiterverkauf?</h3>
                  <p>
                    Wenn du ihn für ein Event freischaltest, gilt eine Gebühr ab 8&nbsp;%
                    des Verkaufspreises, die sich Käufer und Verkäufer teilen. Wie weit über
                    dem Originalpreis verkauft werden darf, bestimmst du.
                  </p>
                </div>
                <div className="card faq-item" data-reveal>
                  <h3>Kann ich Pro wieder kündigen?</h3>
                  <p>
                    Ja, monatlich. Nach dem Ende der Laufzeit läuft dein Konto im
                    kostenlosen Plan weiter, deine Events und Verkäufe bleiben bestehen.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="price-cta" data-reveal>
                <h2>Ausprobieren kostet nichts.</h2>
                <p>Leg dein erstes Event an und schau dir das Dashboard in Ruhe an.</p>
                <Link href="/become-organizer" className="btn lg">
                  Event anlegen <Icon name="arrow" size={14} />
                </Link>
              </div>
            </section>

            <footer className="footer">
              <div>© 2026 Passly · Digitale Tickets</div>
              <div className="links">
                <Link href="/">Start</Link>
                <Link href="/fuer-veranstalter">Für Veranstalter</Link>
                <Link href="/events">Events</Link>
                <Link href="/hilfe">Hilfe</Link>
                <Link href="/impressum">Impressum</Link>
                <Link href="/datenschutz">Datenschutz</Link>
                <Link href="/agb">AGB</Link>
              </div>
            </footer>

          </div>
        </div>
      </div>
    </>
  );
}
