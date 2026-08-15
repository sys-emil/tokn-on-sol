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

/*
 * Feature lists as data, not markup: the two columns must stay comparable,
 * and every line has to correspond to something that actually ships. Pro is
 * deliberately the longer list — but only with real features (see the Pro
 * gates in CLAUDE.md); padding it with restated free features would be the
 * easy way to make the column look fuller and a lie to the reader.
 */
const FREE_FEATURES = [
  'Unbegrenzt Events, öffentlich oder privat per Link',
  'Bis zu fünf Preiskategorien je Event',
  'Öffentliche Markenseite unter getpassly.de/@deinname',
  'Einlass-Scanner im Browser, auch ohne Empfang',
  'Türlinks fürs Personal, ohne eigenen Zugang',
  'Abendkasse für Barverkauf an der Tür',
  'Weiterverkauf mit eigener Preisobergrenze',
  'Saisonpässe für ganze Reihen',
  'Auszahlungen einzeln nachvollziehbar',
];

const PRO_FEATURES = [
  'Kundenübersicht mit allen Gästen deiner Events',
  'Segmente: Stammgäste, Neue, Gefährdete, VIP',
  'Kohorten-Analyse: wer kommt wieder?',
  'E-Mail-Kampagnen an ein ganzes Segment',
  'Nachricht an alle Käufer eines Events',
  'Treueprogramm mit bis zu fünf Stufen',
  'Rabattcodes für Aktionen und Partner',
  'Gästeliste über 100-%-Codes',
  'Warteliste, sobald ein Event ausverkauft ist',
  'Umsatzprognose für die nächsten Wochen',
  'Kanal-Auswertung: woher deine Käufer kommen',
  'Vergleich mit ähnlichen Veranstaltern',
  'CSV-Export von Events und Kundenliste',
  'Akzentfarbe deiner Profilseite frei wählbar',
  'Hervorgehobenes Event ganz oben auf dem Profil',
  'Eigener Kartenstil für deine Events',
];

export const metadata: Metadata = {
  title: 'Preise · Passly',
  description:
    'Passly kostet Veranstalter keine Grundgebühr: 1 € + 4 % Servicegebühr pro Ticket, und du entscheidest je Event, ob sie der Gast trägt, ihr sie teilt oder du sie übernimmst. Pro-Funktionen optional.',
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

  /* ── Plan-Vergleich ──────────────────────────────────────────
     Bewusst asymmetrisch: Pro bekommt mehr Breite, mehr Tiefe und die
     einzige Bewegung auf der Seite. Der kostenlose Plan bleibt vollwertig
     lesbar — er soll nicht schlecht aussehen, nur ruhiger. */
  .plan-wrap { position: relative; }
  /* Weicher Akzent-Schein hinter der Pro-Spalte */
  .plan-wrap::before {
    content: "";
    position: absolute;
    right: -6%; top: -12%;
    width: 62%; height: 124%;
    background: radial-gradient(circle at 60% 40%, oklch(0.76 0.20 var(--hue) / 0.16) 0%, transparent 68%);
    filter: blur(60px);
    pointer-events: none;
    z-index: 0;
    animation: planGlow 16s ease-in-out infinite alternate;
  }
  @keyframes planGlow {
    from { transform: translate3d(0, 0, 0) scale(1); }
    to   { transform: translate3d(-24px, 18px, 0) scale(1.07); }
  }
  .plan-grid {
    position: relative; z-index: 1;
    display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    gap: 16px; align-items: stretch;
  }
  @media (max-width: 940px) { .plan-grid { grid-template-columns: 1fr; } }
  .plan {
    padding: 30px;
    display: flex; flex-direction: column; gap: 18px;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s, border-color 0.25s;
  }
  @media (max-width: 640px) { .plan { padding: 24px 20px; } }
  .plan.free .amount .big { color: var(--ink-2); }
  .plan.pro {
    position: relative;
    overflow: hidden;
    border-color: var(--accent-line);
    box-shadow: var(--shadow);
    background:
      radial-gradient(620px 240px at 12% -25%, var(--accent-wash), transparent 70%),
      var(--surface);
  }
  .plan.pro:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--accent); }
  /* Langsamer Lichtstreifen, gleiche Idee wie .btn-shine, nur ruhiger */
  .plan.pro::after {
    content: "";
    position: absolute; inset: 0;
    background: linear-gradient(105deg, transparent 42%, oklch(0.72 0.18 var(--hue) / 0.10) 50%, transparent 58%);
    transform: translateX(-130%);
    animation: planShine 7s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes planShine {
    0%, 62%   { transform: translateX(-130%); }
    92%, 100% { transform: translateX(130%); }
  }
  .plan-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .plan .tag {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 11px; font-weight: 600; color: var(--accent-ink);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .plan.free .tag { color: var(--ink-3); }
  /* Eckig, kein Pill: 6px wie .chip */
  .plan .recommend {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 9px; border-radius: 6px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
    background: var(--accent); color: white;
    box-shadow: 0 2px 8px oklch(0.56 0.22 var(--hue) / 0.35);
  }
  .plan h2 { font-size: 21px; font-weight: 600; letter-spacing: -0.025em; }
  .plan .amount { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .plan .amount .big { font-size: 38px; font-weight: 600; letter-spacing: -0.035em; line-height: 1; }
  .plan .amount .unit { font-size: 14px; color: var(--ink-3); }
  .plan .what { font-size: 13.5px; color: var(--ink-3); line-height: 1.6; }
  .plan .listhead {
    font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--ink-4);
    padding-bottom: 2px;
  }
  .plan.pro .listhead { color: var(--accent-ink); }
  .plan ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .plan li {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 13.5px; color: var(--ink-2); line-height: 1.55;
  }
  .plan li svg { flex-shrink: 0; margin-top: 3px; }
  .plan.free li svg { color: var(--ink-4); }
  .plan.pro li svg { color: var(--accent); }
  /* Pro-Liste zweispaltig, sobald Platz da ist: die Länge ist das Argument,
     eine endlose Kolonne wäre nur anstrengend. */
  .plan.pro ul { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 22px; }
  @media (max-width: 1080px) { .plan.pro ul { grid-template-columns: 1fr; } }
  .plan .foot { margin-top: auto; padding-top: 8px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .plan .foot .fine { font-size: 12px; color: var(--ink-4); }

  @media (prefers-reduced-motion: reduce) {
    .plan-wrap::before, .plan.pro::after { animation: none; }
    .plan.pro:hover { transform: none; }
  }

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
                Passly nimmt keine Grundgebühr und keinen Anteil vom Ticketpreis.
                Es gibt eine Servicegebühr pro Ticket, und du entscheidest je Event,
                wer sie trägt. Keine Einrichtungskosten, keine Mindestlaufzeit.
              </p>
            </section>

            {/* Die zwei Pläne */}
            <section>
              <div className="plan-wrap">
                <div className="plan-grid">
                  <div className="card plan free" data-reveal>
                    <div className="plan-head">
                      <span className="tag"><Icon name="ticket" size={12} /> Kostenlos</span>
                    </div>
                    <h2>Alles, was ein Event braucht</h2>
                    <div className="amount">
                      <span className="big">0 €</span>
                      <span className="unit">für dich, dauerhaft</span>
                    </div>
                    <p className="what">
                      Pro Ticket 1&nbsp;€ + 4&nbsp;% Servicegebühr. Standardmäßig zahlt
                      der Gast sie obendrauf; du kannst sie je Event auch teilen oder
                      selbst übernehmen. Kostenlose Tickets sind komplett gebührenfrei.
                    </p>
                    <div className="listhead">Enthalten</div>
                    <ul>
                      {FREE_FEATURES.map((feature, i) => (
                        <li key={feature} data-reveal style={{ '--reveal-delay': `${120 + i * 40}ms` } as React.CSSProperties}>
                          <Icon name="check" size={14} /> {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="foot">
                      <Link href="/become-organizer" className="btn subtle">
                        Event anlegen <Icon name="arrow" size={13} />
                      </Link>
                    </div>
                  </div>

                  <div className="card plan pro" data-reveal style={{ '--reveal-delay': '110ms' } as React.CSSProperties}>
                    <div className="plan-head">
                      <span className="tag"><Icon name="sparkle" size={12} /> Passly Pro</span>
                      <span className="recommend"><Icon name="sparkle" size={11} /> Empfohlen</span>
                    </div>
                    <h2>Wenn aus Abenden ein Publikum wird</h2>
                    <div className="amount">
                      <ProPrice />
                      <span className="unit">monatlich kündbar</span>
                    </div>
                    <p className="what">
                      Ein volles Haus ist schön. Gäste, die beim nächsten Mal wiederkommen,
                      sind das Geschäft. Pro gibt dir die Werkzeuge dafür — an der
                      Servicegebühr ändert sich dadurch nichts.
                    </p>
                    <div className="listhead">Alles aus Kostenlos, plus</div>
                    <ul>
                      {PRO_FEATURES.map((feature, i) => (
                        <li key={feature} data-reveal style={{ '--reveal-delay': `${200 + i * 35}ms` } as React.CSSProperties}>
                          <Icon name="check" size={14} /> {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="foot">
                      <Link href="/become-organizer" className="btn primary btn-shine">
                        Mit Pro starten <Icon name="arrow" size={13} />
                      </Link>
                      <span className="fine">Keine Mindestlaufzeit</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="price-note" data-reveal>
                <Icon name="shield" size={16} />
                <div>
                  Die Servicegebühr deckt Zahlungsabwicklung, Betrieb und Support.
                  Zahlt sie dein Gast, wird sie im Warenkorb getrennt vom Ticketpreis
                  ausgewiesen, damit er weiß, wofür er zahlt. Übernimmst du sie, ist dein
                  Ticketpreis der Endpreis und im Warenkorb steht keine Gebühr mehr.
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
                    monatliche Gebühr und keinen prozentualen Anteil am Ticketpreis. Passly
                    verdient an der Servicegebühr pro Ticket — standardmäßig zahlt die dein
                    Gast, du kannst sie aber je Event auch übernehmen.
                  </p>
                </div>
                <div className="card faq-item" data-reveal>
                  <h3>Wer zahlt die Servicegebühr?</h3>
                  <p>
                    Das entscheidest du je Event. Standard ist „Gast zahlt&ldquo;: die Gebühr
                    kommt im Warenkorb sichtbar auf den Ticketpreis obendrauf, und du
                    bekommst den Nennwert vollständig. Du kannst sie auch mit deinem Gast
                    teilen oder ganz übernehmen — dann ist dein Ticketpreis der Endpreis,
                    und wir ziehen die Gebühr von deiner Auszahlung ab. Das ist vor allem
                    dann praktisch, wenn du runde Eintrittspreise plakatierst.
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
