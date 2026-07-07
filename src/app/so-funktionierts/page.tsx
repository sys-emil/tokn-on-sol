import Link from 'next/link';
import type { Metadata } from 'next';
import CtaButton from '@/app/components/CtaButton';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { ScrollReveal } from '@/app/components/ScrollReveal';

export const metadata: Metadata = {
  title: 'So funktioniert’s — Passly',
  description:
    'Ticket kaufen, per E-Mail anmelden, QR-Code am Einlass zeigen — so einfach funktioniert Passly für Gäste.',
};

const PAGE_CSS = `
  .info-hero {
    max-width: 640px;
    padding: 56px 0 48px;
  }
  .info-hero h1 {
    font-size: clamp(32px, 4.6vw, 48px);
    letter-spacing: -0.035em;
    font-weight: 600;
    line-height: 1.08;
  }
  .info-hero .lead {
    margin-top: 16px;
    font-size: 16px; line-height: 1.65;
    color: var(--ink-3);
    max-width: 52ch;
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
  .info-cta {
    max-width: 720px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    padding: 32px;
    display: flex; align-items: center; justify-content: space-between; gap: 24px;
    flex-wrap: wrap;
  }
  .info-cta h2 { font-size: 20px; font-weight: 600; letter-spacing: -0.025em; }
  .info-cta p { font-size: 13.5px; color: var(--ink-3); margin-top: 4px; }

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

  @media (max-width: 640px) {
    /* "Für Veranstalter" bleibt über Inhalt und Footer erreichbar */
    .topbar .btn.subtle { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .faq summary .faq-chev { transition: none; }
  }
`;

export default function SoFunktioniertsPage() {
  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events">Events</Link>
              <Link href="/my-tickets">Meine Tickets</Link>
            </div>
            <div className="topbar-right">
              <Link href="/fuer-veranstalter" className="btn subtle sm">Für Veranstalter</Link>
              <CtaButton className="btn primary sm" />
            </div>
          </div>
        </div>

        <div className="main">
          <ScrollReveal />
          <div className="aurora" aria-hidden="true" />
          <div className="container">

            <section className="info-hero" data-reveal>
              <div className="info-eyebrow">
                <Icon name="ticket" size={13} /> Für Gäste
              </div>
              <h1>Vom Kauf bis zum Einlass — so einfach geht’s.</h1>
              <p className="lead">
                Keine App, kein Ausdrucken, kein Passwort. Du kaufst dein Ticket mit
                Karte und zeigst am Eingang einfach dein Handy. Alles dazwischen
                erledigt Passly.
              </p>
            </section>

            <section>
              <div className="flow">
                <div className="flow-step" data-reveal>
                  <div className="flow-num"><Icon name="euro" size={18} /></div>
                  <div className="flow-body">
                    <h3>Ticket aussuchen und mit Karte zahlen</h3>
                    <p>
                      Du findest dein Event auf Passly oder bekommst den Link direkt
                      vom Veranstalter. Bezahlt wird ganz normal mit Karte — den
                      Gesamtpreis inklusive Servicegebühr siehst du vor dem Kauf.
                    </p>
                    <span className="flow-hint">
                      <Icon name="check" size={13} /> Kein Konto nötig — es entsteht automatisch mit deiner E-Mail-Adresse
                    </span>
                  </div>
                </div>

                <div className="flow-step" data-reveal>
                  <div className="flow-num"><Icon name="mail" size={18} /></div>
                  <div className="flow-body">
                    <h3>Dein Ticket wartet in deinem Konto</h3>
                    <p>
                      Direkt nach dem Kauf liegt dein Ticket unter „Meine Tickets“.
                      Anmelden geht auf jedem Gerät mit einem Code an deine
                      E-Mail-Adresse — Handy leer oder verloren? Einfach woanders
                      anmelden, dein Ticket ist noch da.
                    </p>
                  </div>
                </div>

                <div className="flow-step" data-reveal>
                  <div className="flow-num"><Icon name="qr" size={18} /></div>
                  <div className="flow-body">
                    <h3>Am Einlass den QR-Code zeigen</h3>
                    <p>
                      Dein Ticket zeigt einen QR-Code, der sich jede Minute erneuert.
                      Das Team am Eingang scannt ihn und du bist drin — geprüft in
                      unter einer Sekunde.
                    </p>
                    <span className="flow-hint">
                      <Icon name="shield" size={13} /> Screenshots und Kopien sind am Einlass wertlos — nur dein echtes Ticket zählt
                    </span>
                  </div>
                </div>

                <div className="flow-step" data-reveal>
                  <div className="flow-num"><Icon name="share" size={18} /></div>
                  <div className="flow-body">
                    <h3>Verhindert? Ticket weitergeben</h3>
                    <p>
                      Du kannst dein Ticket per Link an Freunde weitergeben. Ab der
                      Übergabe gehört es eindeutig der neuen Person — sicher,
                      nachvollziehbar und ohne Zettelwirtschaft.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Gut zu wissen</h2>
                  <div className="sub">Die häufigsten Fragen, kurz beantwortet</div>
                </div>
              </div>
              <div className="faq" data-reveal>
                <details>
                  <summary>
                    Brauche ich eine App?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Nein. Alles läuft im Browser deines Handys — kaufen, aufbewahren,
                    vorzeigen. Es gibt nichts zu installieren.
                  </div>
                </details>
                <details>
                  <summary>
                    Warum kann man Passly-Tickets nicht fälschen?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Jedes Ticket ist ein einzigartiges digitales Original, das eindeutig
                    zu deinem Konto gehört. Der QR-Code erneuert sich jede Minute, und
                    jeder Scan prüft in Echtzeit, ob das Ticket echt ist und wirklich
                    dir gehört. Ein abfotografierter Code ist deshalb nach spätestens
                    einer Minute wertlos — und jedes Ticket lässt sich nur genau einmal
                    einlösen.
                  </div>
                </details>
                <details>
                  <summary>
                    Was kostet mich das?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Zum Ticketpreis kommt eine Servicegebühr von 1&nbsp;€ plus 4&nbsp;%
                    pro Ticket. Die siehst du transparent vor dem Bezahlen — versteckte
                    Kosten gibt es nicht. Kostenlose Events sind komplett kostenlos.
                  </div>
                </details>
                <details>
                  <summary>
                    Mein Handy ist leer oder kaputt — komme ich trotzdem rein?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Ja. Dein Ticket hängt an deinem Konto, nicht an deinem Gerät. Melde
                    dich einfach auf einem anderen Handy mit deiner E-Mail-Adresse an —
                    dein Ticket und der QR-Code sind sofort wieder da.
                  </div>
                </details>
                <details>
                  <summary>
                    Kann ich mein Ticket verkaufen oder verschenken?
                    <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                  </summary>
                  <div className="faq-a">
                    Weitergeben ja: Du schickst einen Übergabe-Link, die andere Person
                    nimmt das Ticket mit ihrer E-Mail-Adresse an. Danach gehört es ihr —
                    dein alter QR-Code funktioniert dann nicht mehr. So bleibt immer
                    eindeutig, wem ein Ticket gehört.
                  </div>
                </details>
              </div>
            </section>

            <section>
              <div className="info-cta" data-reveal>
                <div>
                  <h2>Bereit für dein nächstes Event?</h2>
                  <p>Schau dich um — bezahlt ist in einer Minute.</p>
                </div>
                <Link href="/events" className="btn primary lg">
                  Events entdecken <Icon name="arrow" size={14} />
                </Link>
              </div>
            </section>

            <footer className="footer">
              <div>© 2026 Passly · Digitale Tickets</div>
              <div className="links">
                <Link href="/events">Events</Link>
                <Link href="/fuer-veranstalter">Für Veranstalter</Link>
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
