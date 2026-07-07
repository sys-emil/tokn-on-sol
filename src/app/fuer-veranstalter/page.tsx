import Link from 'next/link';
import type { Metadata } from 'next';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { ScrollReveal } from '@/app/components/ScrollReveal';

export const metadata: Metadata = {
  title: 'Für Veranstalter — Passly',
  description:
    'Event anlegen, fälschungssichere Tickets verkaufen, mit dem Handy einlassen — und 100 % des Ticketpreises behalten. So funktioniert Passly für Veranstalter.',
};

const PAGE_CSS = `
  .info-hero {
    max-width: 680px;
    padding: 56px 0 48px;
  }
  .info-hero h1 {
    font-size: clamp(32px, 4.6vw, 48px);
    letter-spacing: -0.035em;
    font-weight: 600;
    line-height: 1.08;
  }
  .info-hero h1 .accent { color: var(--accent); }
  .info-hero .lead {
    margin-top: 16px;
    font-size: 16px; line-height: 1.65;
    color: var(--ink-3);
    max-width: 54ch;
  }
  .info-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 500;
    color: var(--accent-ink);
    background: var(--accent-wash);
    border: 1px solid var(--accent-line);
    padding: 4px 10px; border-radius: 999px;
    margin-bottom: 18px;
  }
  .hero-ctas { margin-top: 26px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

  /* ── Vertical flow ───────────────────────────────────────── */
  .flow { max-width: 720px; display: flex; flex-direction: column; }
  .flow-step {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 20px;
    position: relative;
    padding-bottom: 40px;
  }
  .flow-step:last-child { padding-bottom: 0; }
  .flow-step::before {
    content: "";
    position: absolute;
    left: 21.5px; top: 48px; bottom: 8px;
    width: 1px;
    background: var(--line-2);
  }
  .flow-step:last-child::before { display: none; }
  .flow-num {
    width: 44px; height: 44px; border-radius: 13px;
    background: var(--accent-wash);
    border: 1px solid var(--accent-line);
    color: var(--accent);
    display: grid; place-items: center;
    position: relative; z-index: 1;
  }
  .flow-body h3 {
    font-size: 17px; font-weight: 600; letter-spacing: -0.02em;
    padding-top: 10px;
  }
  .flow-body p {
    margin-top: 8px;
    font-size: 14.5px; line-height: 1.65;
    color: var(--ink-3);
    max-width: 58ch;
  }
  .flow-hint {
    margin-top: 12px;
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 12.5px; color: var(--ink-2);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 5px 12px;
    box-shadow: var(--shadow-sm);
  }
  .flow-hint svg { color: var(--accent); flex-shrink: 0; }

  /* ── Pricing panel ───────────────────────────────────────── */
  .pricing {
    max-width: 720px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  }
  @media (max-width: 720px) { .pricing { grid-template-columns: 1fr; } }
  .pricing-main { padding: 28px; }
  .pricing-main .big {
    font-size: clamp(38px, 5vw, 52px);
    font-weight: 600; letter-spacing: -0.04em; line-height: 1;
    color: var(--accent);
  }
  .pricing-main .big-sub {
    font-size: 15px; font-weight: 600; letter-spacing: -0.015em;
    margin-top: 8px;
  }
  .pricing-main p {
    margin-top: 12px;
    font-size: 13.5px; line-height: 1.65; color: var(--ink-3);
    max-width: 44ch;
  }
  .pricing-example {
    background: var(--accent-wash);
    padding: 28px;
    display: flex; flex-direction: column; justify-content: center; gap: 10px;
  }
  @media (max-width: 720px) { .pricing-example { border-top: 1px dashed var(--accent-line); } }
  @media (min-width: 721px) { .pricing-example { border-left: 1px dashed var(--accent-line); } }
  .pricing-example .cap {
    font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--accent-ink);
  }
  .pricing-example .row {
    display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
    font-size: 13.5px; color: var(--ink-2);
  }
  .pricing-example .row .val {
    font-family: var(--mono); font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .pricing-example .row.total {
    padding-top: 10px;
    border-top: 1px solid var(--accent-line);
    font-weight: 600; color: var(--ink);
  }
  .pricing-example .row.total .val { color: var(--accent-ink); }

  /* ── Dashboard features ──────────────────────────────────── */
  .feat-list {
    max-width: 720px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  @media (max-width: 640px) { .feat-list { grid-template-columns: 1fr; } }
  .feat {
    padding: 20px 22px;
    display: flex; gap: 14px; align-items: flex-start;
  }
  .feat + .feat { border-top: 1px solid var(--line); }
  @media (min-width: 641px) {
    .feat + .feat { border-top: none; }
    .feat:nth-child(n+3) { border-top: 1px solid var(--line); }
    .feat:nth-child(even) { border-left: 1px solid var(--line); }
  }
  .feat svg { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
  .feat h3 { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
  .feat p { font-size: 13px; color: var(--ink-3); line-height: 1.6; margin-top: 3px; }

  /* ── FAQ ─────────────────────────────────────────────────── */
  .faq { max-width: 720px; display: flex; flex-direction: column; gap: 10px; }
  .faq details {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .faq details[open] { border-color: var(--line-2); box-shadow: var(--shadow); }
  .faq summary {
    list-style: none;
    cursor: pointer;
    padding: 15px 18px;
    font-size: 14.5px; font-weight: 500; letter-spacing: -0.01em;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary .faq-chev { color: var(--ink-4); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); flex-shrink: 0; }
  .faq details[open] summary .faq-chev { transform: rotate(90deg); }
  .faq .faq-a {
    padding: 0 18px 16px;
    font-size: 13.5px; line-height: 1.65;
    color: var(--ink-3);
    max-width: 62ch;
  }

  /* ── Closing CTA ─────────────────────────────────────────── */
  .cta-banner {
    max-width: 720px;
    background: linear-gradient(135deg, var(--accent), oklch(0.48 0.22 calc(var(--hue) + 30)));
    border-radius: var(--radius-lg);
    padding: 44px 32px;
    text-align: center;
    color: white;
    box-shadow: var(--shadow-lg);
    position: relative;
    overflow: hidden;
  }
  .cta-banner::before {
    content: "";
    position: absolute; inset: 0;
    background: radial-gradient(600px 300px at 70% -20%, rgba(255,255,255,0.22), transparent 70%);
    pointer-events: none;
  }
  .cta-banner h2 {
    font-size: clamp(22px, 3vw, 30px);
    font-weight: 600; letter-spacing: -0.03em; line-height: 1.15;
    position: relative;
  }
  .cta-banner p { font-size: 14px; opacity: 0.85; margin-top: 10px; position: relative; }
  .cta-banner .btn {
    margin-top: 22px;
    background: white; color: var(--accent-ink);
    position: relative;
  }
  .cta-banner .btn:hover { background: oklch(0.96 0.01 var(--hue)); }

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

  @media (prefers-reduced-motion: reduce) {
    .faq summary .faq-chev { transition: none; }
  }
`;

export default function FuerVeranstalterPage() {
  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events">Events</Link>
              <Link href="/so-funktionierts">Für Gäste</Link>
            </div>
            <div className="topbar-right">
              <Link href="/become-organizer" className="btn primary sm">
                Event anlegen <Icon name="arrow" size={13} />
              </Link>
            </div>
          </div>
        </div>

        <div className="main">
          <ScrollReveal />
          <div className="aurora" aria-hidden="true" />
          <div className="container">

            <section className="info-hero" data-reveal>
              <div className="info-eyebrow">
                <Icon name="calendar" size={13} /> Für Veranstalter
              </div>
              <h1>
                Dein Event. Deine Gäste.<br />
                <span className="accent">100&nbsp;% deines Ticketpreises.</span>
              </h1>
              <p className="lead">
                Passly ist dein komplettes Ticketsystem: Event anlegen, Tickets
                verkaufen, Einlass mit dem Handy — fälschungssicher und ohne
                Fixkosten. Die Servicegebühr zahlen deine Gäste transparent
                obendrauf, nicht du.
              </p>
              <div className="hero-ctas">
                <Link href="/become-organizer" className="btn primary lg">
                  Kostenlos starten <Icon name="arrow" size={14} />
                </Link>
                <Link href="/events" className="btn ghost lg">Events ansehen</Link>
              </div>
            </section>

            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>So läuft dein Event mit Passly</h2>
                  <div className="sub">Vom ersten Klick bis zur Auszahlung</div>
                </div>
              </div>
              <div className="flow">
                <div className="flow-step" data-reveal>
                  <div className="flow-num"><Icon name="calendar" size={18} /></div>
                  <div className="flow-body">
                    <h3>Event anlegen — in wenigen Minuten</h3>
                    <p>
                      Du meldest dich mit deiner E-Mail-Adresse an und legst dein Event
                      an: Name, Datum, Ort, Preis, Kapazität, Bild. Danach ist es sofort
                      verkaufsbereit — öffentlich auf Passly oder als privates Event,
                      das nur über deinen Direktlink erreichbar ist.
                    </p>
                    <span className="flow-hint">
                      <Icon name="check" size={13} /> Keine Einrichtungskosten, kein Vertrag, keine Technik-Kenntnisse nötig
                    </span>
                  </div>
                </div>

                <div className="flow-step" data-reveal>
                  <div className="flow-num"><Icon name="ticket" size={18} /></div>
                  <div className="flow-body">
                    <h3>Tickets verkaufen — einfach per Link</h3>
                    <p>
                      Du teilst deinen Event-Link, deine Gäste zahlen mit Karte. Jedes
                      verkaufte Ticket ist ein einzigartiges, fälschungssicheres
                      Original. Die Kapazität hält Passly automatisch ein — überverkauft
                      wird nie, auch wenn viele gleichzeitig kaufen.
                    </p>
                  </div>
                </div>

                <div className="flow-step" data-reveal>
                  <div className="flow-num"><Icon name="scan" size={18} /></div>
                  <div className="flow-body">
                    <h3>Einlass mit dem Handy deines Teams</h3>
                    <p>
                      Für den Einlass öffnet dein Team einfach die Scanner-Seite deines
                      Events im Browser — ohne App, auf beliebig vielen Handys
                      gleichzeitig. Jeder Scan prüft Echtheit und Besitz in Echtzeit und
                      löst das Ticket genau einmal ein. Screenshots, Kopien und doppelter
                      Einlass sind damit ausgeschlossen.
                    </p>
                    <span className="flow-hint">
                      <Icon name="doublecheck" size={13} /> Geprüft und eingelöst in unter einer Sekunde
                    </span>
                  </div>
                </div>

                <div className="flow-step" data-reveal>
                  <div className="flow-num"><Icon name="euro" size={18} /></div>
                  <div className="flow-body">
                    <h3>Auszahlung — automatisch aufs Bankkonto</h3>
                    <p>
                      Dein Ticketumsatz wird automatisch auf dein Bankkonto überwiesen —
                      abgewickelt über unseren Zahlungspartner Stripe. Dafür verifizierst
                      du einmalig dein Auszahlungskonto (gesetzlich vorgeschrieben,
                      dauert nur ein paar Minuten). Auf Wunsch kannst du pro Event eine
                      Haltefrist einstellen und dir das Geld erst nach dem Event
                      auszahlen lassen.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Was es kostet</h2>
                  <div className="sub">Kurz gesagt: dich nichts</div>
                </div>
              </div>
              <div className="pricing" data-reveal>
                <div className="pricing-main">
                  <div className="big">100&nbsp;%</div>
                  <div className="big-sub">des Ticketpreises gehören dir</div>
                  <p>
                    Keine Einrichtungskosten, keine monatliche Gebühr, kein Abzug vom
                    Ticketpreis. Deine Gäste zahlen pro Ticket eine Servicegebühr von
                    1&nbsp;€ plus 4&nbsp;% — transparent im Warenkorb ausgewiesen.
                    Kostenlose Events sind komplett kostenlos, für alle.
                  </p>
                </div>
                <div className="pricing-example" aria-label="Beispielrechnung">
                  <div className="cap">Beispiel: Ticket für 20 €</div>
                  <div className="row">
                    <span>Dein Ticketpreis</span>
                    <span className="val">20,00&nbsp;€</span>
                  </div>
                  <div className="row">
                    <span>Servicegebühr (Gast)</span>
                    <span className="val">+&nbsp;1,80&nbsp;€</span>
                  </div>
                  <div className="row">
                    <span>Dein Gast zahlt</span>
                    <span className="val">21,80&nbsp;€</span>
                  </div>
                  <div className="row total">
                    <span>Du erhältst</span>
                    <span className="val">20,00&nbsp;€</span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Dein Dashboard</h2>
                  <div className="sub">Alles im Blick — vor, während und nach dem Event</div>
                </div>
              </div>
              <div className="feat-list" data-reveal>
                <div className="feat">
                  <Icon name="sparkle" size={16} />
                  <div>
                    <h3>Verkäufe live verfolgen</h3>
                    <p>Verkaufte Tickets, Umsatz und Restkapazität in Echtzeit — für jedes deiner Events.</p>
                  </div>
                </div>
                <div className="feat">
                  <Icon name="users" size={16} />
                  <div>
                    <h3>Gästeliste &amp; Einlass-Status</h3>
                    <p>Wer hat ein Ticket, wer ist schon drin — jede Einlösung erscheint sofort.</p>
                  </div>
                </div>
                <div className="feat">
                  <Icon name="shield" size={16} />
                  <div>
                    <h3>Private Events</h3>
                    <p>Auf Wunsch taucht dein Event nicht in der öffentlichen Liste auf — nur wer den Link hat, kann kaufen.</p>
                  </div>
                </div>
                <div className="feat">
                  <Icon name="scan" size={16} />
                  <div>
                    <h3>Scanner für dein ganzes Team</h3>
                    <p>Beliebig viele Einlass-Handys gleichzeitig, ohne App und ohne Extra-Kosten.</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Häufige Fragen</h2>
                  <div className="sub">Von Veranstaltern, kurz beantwortet</div>
                </div>
              </div>
              <div className="faq" data-reveal>
                <details>
                  <summary>
                    Was brauche ich, um loszulegen?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Nur eine E-Mail-Adresse. Damit legst du dein Konto und dein erstes
                    Event an. Für die Auszahlung verifizierst du einmalig dein
                    Bankkonto über unseren Zahlungspartner Stripe — Events anlegen
                    kannst du aber sofort.
                  </div>
                </details>
                <details>
                  <summary>
                    Wann bekomme ich mein Geld?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Standardmäßig wird dein Umsatz laufend automatisch überwiesen — in
                    der Regel innerhalb eines Tages nach dem Verkauf. Optional kannst du
                    pro Event eine Haltefrist einstellen, sodass die Auszahlung erst
                    einige Tage nach dem Event erfolgt.
                  </div>
                </details>
                <details>
                  <summary>
                    Können private Feiern Passly nutzen — oder nur Unternehmen?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Beides. Bei der Anmeldung gibst du an, ob du privat oder als
                    Unternehmen veranstaltest. Vom Hausparty-Ticket für 5&nbsp;€ bis zum
                    Konzert — das System ist dasselbe.
                  </div>
                </details>
                <details>
                  <summary>
                    Wie verhindert Passly gefälschte Tickets?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Jedes Ticket ist ein einzigartiges digitales Original, das eindeutig
                    einem Gast gehört. Der QR-Code erneuert sich jede Minute, jeder Scan
                    prüft Echtheit und Besitz in Echtzeit, und jedes Ticket lässt sich
                    nur genau einmal einlösen. Weitergegebene Screenshots oder kopierte
                    Codes kommen am Einlass nicht durch.
                  </div>
                </details>
                <details>
                  <summary>
                    Was kostet der Einlass-Scanner?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Nichts. Der Scanner läuft im Browser auf jedem Handy mit Kamera —
                    keine App, keine Geräte-Miete, keine Begrenzung, wie viele Personen
                    gleichzeitig scannen.
                  </div>
                </details>
              </div>
            </section>

            <section>
              <div className="cta-banner" data-reveal>
                <h2>Leg dein erstes Event an — kostenlos.</h2>
                <p>In wenigen Minuten verkaufsbereit. Ohne Fixkosten, ohne Risiko.</p>
                <Link href="/become-organizer" className="btn lg">
                  Jetzt Event anlegen <Icon name="arrow" size={14} />
                </Link>
              </div>
            </section>

            <footer className="footer">
              <div>© 2026 Passly · Digitale Tickets</div>
              <div className="links">
                <Link href="/events">Events</Link>
                <Link href="/so-funktionierts">Für Gäste</Link>
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
