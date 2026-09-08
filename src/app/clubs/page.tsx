import Link from 'next/link';
import type { Metadata } from 'next';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { ScrollReveal } from '@/app/components/ScrollReveal';
import { SiteNav } from '@/app/components/SiteNav';
import { FeeCalculator } from '@/app/components/FeeCalculator';
import { ShopCard, SHOP_CARD_CSS } from '@/app/components/eventSurfaces/ShopCard';
import { DashboardMock, ReturnMock, SHOWCASE_CSS } from '@/app/components/showcase/ShowcaseMocks';
import { DoorScene } from '@/app/components/showcase/DoorScene';
import { NICHE_CLUB } from '@/app/components/showcase/niches';

/*
 * Nischenseite Club — die zweite der drei Türen (Sport · Clubs · Kultur) in
 * dieselbe Marke Passly. Aufbau und Regeln wie /sportvereine, siehe dort.
 *
 * **Was sie vom Verein unterscheidet, ist nicht der Ton, sondern das
 * Produkt.** Ein Club braucht keine Dauerkarte; er braucht einen Vorverkauf,
 * der den Ansturm zum Verkaufsstart aushält (Warteschlange), eine Tür, die
 * im Keller ohne Empfang weiterläuft, einen Wiedereinlass für den Hof — und
 * die Rückgabe, weil sonst der Weiterverkauf auf Instagram stattfindet, wo
 * niemand ihn kontrolliert. Deshalb hat diese Seite ein eigenes
 * Rückgabe-Kapitel an der Stelle, an der die Vereinsseite die Dauerkarte
 * hat.
 *
 * **Kein Kunde auf dieser Seite**, kein Clubname, kein Logo, kein Zitat.
 * Alle Namen in den Mockups sind erfunden, alle Werte plausibel für einen
 * einzelnen Abend.
 *
 * Die Voreinstellungen von `DoorScene` und `DashboardMock` sind bereits die
 * Clubnacht der Startseite — deshalb stehen sie hier ohne Beschriftungen da.
 */

export const metadata: Metadata = {
  title: 'Ticketsystem für Clubs · Passly',
  description:
    'Vorverkauf, der den Verkaufsstart aushält, ein Einlass, der auch ohne Empfang im Keller läuft, und am Sonntag die Zahlen. Ohne Grundgebühr, ohne Vertrag.',
  alternates: { canonical: '/clubs' },
  openGraph: {
    type: 'website',
    title: 'Ticketsystem für Clubs · Passly',
    description:
      'Vorverkauf, der den Verkaufsstart aushält, ein Einlass, der auch ohne Empfang im Keller läuft, und am Sonntag die Zahlen.',
  },
};

/* Wie auf der Vereinsseite: einmal getippt, zweimal benutzt — sichtbar und
   als FAQPage-Auszeichnung. */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Was passiert, wenn beim Verkaufsstart alle gleichzeitig draufgehen?',
    a: 'Dann schaltest du für dieses Event die Warteschlange ein. Wer zuerst da ist, steht vorn und bekommt der Reihe nach einen Platz im Kauf; alle anderen sehen, dass sie warten, statt einer Fehlermeldung. Doppelt verkauft wird dabei nichts: jedes Kontingent wird beim Klick auf „Kaufen" verbindlich reserviert, nicht erst nach der Zahlung. Die Warteschlange kostet nichts extra.',
  },
  {
    q: 'Kommt jemand mit einem weitergeschickten Screenshot rein?',
    a: 'Nein. Der QR-Code auf dem Handy deines Gastes wird jede Minute neu erzeugt, ein Screenshot ist am nächsten Morgen also wertlos. Jedes Ticket lässt sich außerdem nur einmal einlösen — auch wenn zwei Leute mit demselben Code an zwei Türen stehen.',
  },
  {
    q: 'Funktioniert der Einlass im Keller ohne Empfang?',
    a: 'Ja. Die Türseite lädt die Ticketliste vor und prüft danach auf dem Gerät weiter, mit derselben Signatur- und Einmal-Prüfung wie online. Sobald das Handy wieder Netz hat, werden die Scans nachgetragen. Das Einzige, was offline nicht geht: zwei Geräte sehen die Scans des jeweils anderen nicht — an einer Tür mit zwei Handys also besser eins scannen lassen.',
  },
  {
    q: 'Können Gäste zwischendurch raus und wieder rein?',
    a: 'Wenn du den Wiedereinlass einschaltest, ja: derselbe Code checkt beim nächsten Scan aus und beim übernächsten wieder ein. Damit niemand ein Handy an der Schlange entlangreicht, gibt es eine Sperrzeit zwischen zwei Scans, die du selbst festlegst (voreingestellt zwei Minuten). Ist der Wiedereinlass aus, bleibt ein zweiter Scan wie bisher eine abgelehnte Doppelnutzung.',
  },
  {
    q: 'Was ist, wenn jemand doch nicht kann?',
    a: 'Gibst du die Rückgabe für ein Event frei, kann der Gast sein Ticket selbst zurückgeben: sein Platz geht zurück in den Verkauf, und sobald ihn jemand kauft, bekommt er sein Geld auf demselben Weg zurück, auf dem er bezahlt hat — abzüglich 10 %, mindestens 1 €. Zu einem höheren Preis kann dabei niemand weiterverkaufen: erstattet wird immer nur die ursprüngliche Zahlung. Damit findet die Weitergabe bei dir statt und nicht in einer Instagram-Story.',
  },
  {
    q: 'Brauchen meine Türsteher einen Zugang?',
    a: 'Nein. Du erzeugst pro Abend einen Türlink und schickst ihn ans Personal. Wer ihn öffnet, kann scannen und die Abendkasse bedienen — sonst nichts, kein Zugang zu deinen Zahlen oder deinen Events. Der Link läuft nach dem Abend von allein ab, und du kannst ihn jederzeit widerrufen.',
  },
  {
    q: 'Gibt es eine Gästeliste?',
    a: 'Wer verkauft ist und wer schon drin ist, siehst du kostenlos — live an der Tür und danach im Dashboard. Freien Eintritt für einzelne Namen oder Gruppen vergibst du über Rabattcodes bis 100 %; die gehören zum Pro-Tarif.',
  },
];

const PAGE_CSS = `
  .aurora { opacity: 0.3; }

  /* ── Hero ─────────────────────────────────────────────────── */
  .info-hero { max-width: 720px; padding: 56px 0 48px; }
  .info-hero h1 {
    font-size: clamp(32px, 4.6vw, 48px);
    letter-spacing: -0.035em; font-weight: 600; line-height: 1.08;
  }
  .info-hero h1 .accent { color: var(--accent); }
  .info-hero .lead {
    margin-top: 16px;
    font-size: 16px; line-height: 1.65; color: var(--ink-3);
    max-width: 56ch;
  }
  .info-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 11.5px; font-weight: 600; color: var(--accent-ink);
    text-transform: uppercase; letter-spacing: 0.08em;
    margin-bottom: 18px;
  }
  .hero-ctas { margin-top: 26px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

  /* ── Trust-Leiste ────────────────────────────────────────── */
  .trust-bar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  @media (max-width: 820px) { .trust-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .trust-item {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px;
    border: 1px solid var(--line-2); background: var(--surface);
    border-radius: var(--radius);
  }
  .trust-item .ic {
    width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
    display: grid; place-items: center;
    background: var(--accent-wash); color: var(--accent-ink);
  }
  .trust-item .label { font-size: 12.5px; color: var(--ink-2); line-height: 1.4; font-weight: 500; }

  .container > section + section { margin-top: 88px; }
  @media (max-width: 700px) { .container > section + section { margin-top: 56px; } }

  /* ── Gebühren ────────────────────────────────────────────── */
  .fee-section { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 40px; align-items: center; }
  @media (max-width: 900px) { .fee-section { grid-template-columns: 1fr; gap: 24px; } }
  .fee-copy h2 { font-size: clamp(24px, 3.2vw, 32px); font-weight: 600; letter-spacing: -0.03em; line-height: 1.15; }
  .fee-copy p { font-size: 14.5px; color: var(--ink-3); line-height: 1.65; margin-top: 12px; max-width: 46ch; }
  .fee-copy .more { display: inline-flex; align-items: center; gap: 7px; margin-top: 18px; font-size: 13.5px; font-weight: 500; color: var(--accent); }
  .fee-copy .more:hover { color: var(--accent-2); }

  /* ── FAQ ─────────────────────────────────────────────────── */
  .faq { max-width: 760px; display: flex; flex-direction: column; gap: 10px; }
  .faq details {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); box-shadow: var(--shadow-sm); overflow: hidden;
  }
  .faq details[open] { border-color: var(--line-2); box-shadow: var(--shadow); }
  .faq summary {
    list-style: none; cursor: pointer; padding: 15px 18px;
    font-size: 14.5px; font-weight: 500; letter-spacing: -0.01em;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary .faq-chev { color: var(--ink-4); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); flex-shrink: 0; }
  .faq details[open] summary .faq-chev { transform: rotate(90deg); }
  .faq .faq-a { padding: 0 18px 16px; font-size: 13.5px; line-height: 1.65; color: var(--ink-3); max-width: 66ch; }

  /* ── Abschluss ───────────────────────────────────────────── */
  .cta-banner {
    max-width: 760px;
    background: var(--accent);
    border-radius: var(--radius-lg); padding: 44px 32px; text-align: center;
    color: white; box-shadow: var(--shadow-lg); position: relative; overflow: hidden;
  }
  .cta-banner h2 { font-size: clamp(22px, 3vw, 30px); font-weight: 600; letter-spacing: -0.03em; line-height: 1.15; position: relative; }
  .cta-banner p { font-size: 14px; opacity: 0.85; margin-top: 10px; position: relative; }
  .cta-banner .btn { margin-top: 22px; background: white; color: var(--accent-ink); position: relative; }
  .cta-banner .btn:hover { background: oklch(0.96 0.01 var(--hue)); }
  @media (max-width: 640px) { .cta-banner { padding: 40px 22px; } }

  .footer {
    border-top: 1px solid var(--line);
    margin-top: 64px; padding: 28px 0 8px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    font-size: 12.5px; color: var(--ink-3); flex-wrap: wrap;
  }
  .footer .links { display: flex; gap: 14px 18px; flex-wrap: wrap; }
  .footer a:hover { color: var(--ink); }

  @media (prefers-reduced-motion: reduce) {
    .faq summary .faq-chev { transition: none; }
  }
`;

export default function ClubsPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <style>{PAGE_CSS + SHOP_CARD_CSS + SHOWCASE_CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <SiteNav active="organizers" />
            <div className="topbar-right">
              <Link href="/become-organizer" className="btn primary sm">
                Kostenlos starten <Icon name="arrow" size={13} />
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
                <Icon name="sparkle" size={13} /> Für Clubs
              </div>
              <h1>
                Deine Nacht.<br />
                Deine Tür.<br />
                <span className="accent">Deine Abrechnung.</span>
              </h1>
              <p className="lead">
                Ein Vorverkauf, der den Verkaufsstart aushält. Ein Einlass, der auch
                im Keller ohne Empfang weiterläuft. Und am Sonntag steht da, wie viele
                wirklich drin waren. Statt DMs, PayPal an Freunde und einer Liste auf
                Papier.
              </p>
              <div className="hero-ctas">
                <Link href="/become-organizer" className="btn primary lg">
                  Kostenlos starten <Icon name="arrow" size={14} />
                </Link>
                <Link href="/preise" className="btn ghost lg">Was es kostet</Link>
              </div>
            </section>

            <section>
              <div className="trust-bar" data-reveal>
                <div className="trust-item">
                  <div className="ic"><Icon name="euro" size={15} /></div>
                  <div className="label">Keine Grundgebühr, kein Vertrag, keine Mindestlaufzeit</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="users" size={15} /></div>
                  <div className="label">Türlinks fürs Personal, ohne Zugang zu deinen Zahlen</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="wifi" size={15} /></div>
                  <div className="label">Einlass läuft weiter, wenn das Netz wegbricht</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="shield" size={15} /></div>
                  <div className="label">Code erneuert sich jede Minute, einmal einlösbar</div>
                </div>
              </div>
            </section>

            <section>
              {/* Kapitel 1 — Vorverkauf. Der Club-Unterschied steckt im
                  Verkaufsstart, nicht im Verkaufen an sich. */}
              <div className="sc-chapter" data-reveal>
                <div className="sc-copy">
                  <span className="sc-eyebrow">Dein Vorverkauf</span>
                  <h3>Auch wenn alle gleichzeitig kommen.</h3>
                  <p>
                    Du teilst einen Link, und der hält auch, wenn um 20:00 Uhr
                    dreihundert Leute gleichzeitig draufgehen. Wer wartet, sieht seinen
                    Platz in der Schlange statt einer Fehlermeldung — und was verkauft
                    ist, ist verkauft.
                  </p>
                  <ul className="sc-points">
                    <li><Icon name="check" size={14} /> Warteschlange beim Verkaufsstart, der Reihe nach</li>
                    <li><Icon name="check" size={14} /> Frühbucher, Abendkasse, Kontingente je Kategorie</li>
                    <li><Icon name="check" size={14} /> Karte, PayPal, Apple&nbsp;Pay und Google&nbsp;Pay</li>
                    <li><Icon name="check" size={14} /> Kaufen ohne Konto, das legt dein Gast später an</li>
                  </ul>
                </div>
                <div className="sc-media">
                  <ShopCard {...NICHE_CLUB.shopCard} />
                </div>
              </div>

              {/* Kapitel 2 — Tür. Die Voreinstellungen der Szene sind bereits
                  die Clubnacht, deshalb ohne Beschriftungen. */}
              <DoorScene />

              <ul className="scn-facts" data-reveal>
                <li><Icon name="check" size={14} /> Der Code erneuert sich jede Minute, Screenshots sind wertlos</li>
                <li><Icon name="check" size={14} /> Läuft weiter, wenn im Keller das Netz wegbricht</li>
                <li><Icon name="check" size={14} /> Wiedereinlass für den Hof, mit Sperrzeit gegen Weiterreichen</li>
                <li><Icon name="check" size={14} /> Abendkasse für Laufkundschaft, zum selben Preis wie online</li>
              </ul>

              {/* Kapitel 3 — Rückgabe. Steht an der Stelle, an der die
                  Vereinsseite die Dauerkarte hat: das eine Kapitel, das diese
                  Nische wirklich anders braucht. */}
              <div className="sc-chapter flip" data-reveal>
                <div className="sc-copy">
                  <span className="sc-eyebrow">Deine Rückgabe</span>
                  <h3>Der Weiterverkauf findet bei dir statt.</h3>
                  <p>
                    Wer nicht kann, gibt sein Ticket zurück, statt es in einer Story
                    anzubieten. Der Platz geht zurück in den Verkauf, der nächste Gast
                    kauft ihn ganz normal — zum selben Preis, denn erstattet wird immer
                    nur, was bezahlt wurde. Ein Ticket zum Dreifachen gibt es hier gar
                    nicht erst.
                  </p>
                  <ul className="sc-points">
                    <li><Icon name="check" size={14} /> Du gibst die Rückgabe pro Event frei, oder eben nicht</li>
                    <li><Icon name="check" size={14} /> Der freigewordene Platz wird sofort wieder verkauft</li>
                    <li><Icon name="check" size={14} /> Das zurückgegebene Ticket verliert seine Gültigkeit</li>
                    <li><Icon name="check" size={14} /> Für dich ändert sich nichts: du wirst für den Platz einmal bezahlt</li>
                  </ul>
                </div>
                <div className="sc-media">
                  <ReturnMock />
                </div>
              </div>

              {/* Kapitel 4 — Zahlen. Voreinstellung ist bereits die Clubnacht. */}
              <div className="sc-chapter" data-reveal>
                <div className="sc-copy">
                  <span className="sc-eyebrow">Deine Zahlen</span>
                  <h3>Am Freitagabend weißt du, wie die Nacht steht.</h3>
                  <p>
                    Wie viele Tickets weg sind, wie viele wirklich drin waren, was
                    hereingekommen ist. Live an der Tür und am nächsten Tag als
                    Abrechnung — ohne dass jemand mitzählt.
                  </p>
                  <ul className="sc-points">
                    <li><Icon name="check" size={14} /> Verkauft, eingelassen und Einnahmen je Abend</li>
                    <li><Icon name="check" size={14} /> Gästeliste mit Einlassstatus, auch offline geführt</li>
                    <li><Icon name="check" size={14} /> Jede Auszahlung einzeln nachvollziehbar</li>
                    <li><Icon name="check" size={14} /> Export für die Buchhaltung, als CSV</li>
                  </ul>
                </div>
                <div className="sc-media">
                  <DashboardMock />
                </div>
              </div>
            </section>

            <section>
              <div className="fee-section" data-reveal>
                <div className="fee-copy">
                  <h2>Was bleibt dir?</h2>
                  <p>
                    Pro verkauftem Ticket 7,9&nbsp;% Servicegebühr, mindestens 0,99&nbsp;€,
                    und der Satz sinkt, je teurer das Ticket ist. Standardmäßig zahlt sie
                    dein Gast offen ausgewiesen obendrauf, und du bekommst deinen
                    Ticketpreis auf den Cent. Willst du lieber einen runden Endpreis am
                    Tresen, übernimmst du sie. Keine Einrichtungskosten, keine monatliche
                    Gebühr, keine Mindestlaufzeit.
                  </p>
                  <Link href="/preise" className="more">
                    Alle Preise im Detail <Icon name="arrow" size={13} />
                  </Link>
                </div>
                <FeeCalculator initialPrice={NICHE_CLUB.calcStartPriceEur} quantity={200} />
              </div>
            </section>

            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Häufige Fragen aus Clubs</h2>
                  <div className="sub">Kurz beantwortet</div>
                </div>
              </div>
              <div className="faq" data-reveal>
                {FAQ.map((f) => (
                  <details key={f.q}>
                    <summary>
                      {f.q}
                      <span className="faq-chev"><Icon name="chevronRight" size={15} /></span>
                    </summary>
                    <div className="faq-a">{f.a}</div>
                  </details>
                ))}
              </div>
            </section>

            <section>
              <div className="cta-banner" data-reveal>
                <h2>Leg deine erste Nacht an.</h2>
                <p>Kostenlos, ohne Vertrag und ohne Grundgebühr. Anmelden und direkt anlegen.</p>
                <Link href="/become-organizer" className="btn lg">
                  Jetzt starten <Icon name="arrow" size={14} />
                </Link>
              </div>
            </section>

            <footer className="footer">
              <div>© 2026 Passly · Digitale Tickets</div>
              <div className="links">
                <Link href="/fuer-veranstalter">Für Veranstalter</Link>
                <Link href="/sportvereine">Für Sportvereine</Link>
                <Link href="/preise">Preise</Link>
                <Link href="/events">Events</Link>
                <Link href="/so-funktionierts">So funktioniert&rsquo;s</Link>
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
