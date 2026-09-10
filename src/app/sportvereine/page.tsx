import Link from 'next/link';
import type { Metadata } from 'next';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { ScrollReveal } from '@/app/components/ScrollReveal';
import { SiteNav } from '@/app/components/SiteNav';
import { SignInButton } from '@/app/components/SignInButton';
import { FeeCalculator } from '@/app/components/FeeCalculator';
import { ShopCard, SHOP_CARD_CSS } from '@/app/components/eventSurfaces/ShopCard';
import { DashboardMock, SeasonPassMock, SHOWCASE_CSS } from '@/app/components/showcase/ShowcaseMocks';
import { DoorScene } from '@/app/components/showcase/DoorScene';
import { NICHE_SPORT } from '@/app/components/showcase/niches';

/*
 * Nischenseite Sportverein — die erste der drei Türen (Sport · Clubs ·
 * Kultur) in dieselbe Marke Passly.
 *
 * **Sie ist ein eigener Eingang, keine Unterseite.** Wer hier landet, kommt
 * aus der Suche („Ticketsystem Sportverein", „Dauerkarten online verkaufen"),
 * aus einer Kaltakquise-Mail oder aus einem Bio-Link — fast nie von der
 * Startseite. Deshalb trägt sie den ganzen Weg allein: Hero, Beweise,
 * Gebühren, Fragen, Abschluss.
 *
 * **Warum sie nicht die Startseite mit ausgetauschten Substantiven ist:**
 * genau das wäre eine Doorway-Page, und der Leser merkt es in zehn Sekunden.
 * Der Verein benutzt tatsächlich andere Teile des Produkts als ein Club —
 * vor allem die **Dauerkarte**, die hier ein eigenes Kapitel bekommt. Sie ist
 * das Argument, das Sport von Clubs unterscheidet, und der Grund, mit dieser
 * Nische anzufangen.
 *
 * **Kein Kunde auf dieser Seite**, auch nicht anonym: kein Vereinsname, kein
 * Logo, kein Zitat, keine Zuschauerzahl aus einer echten Halle. Solange es
 * keine Referenz gibt, wird auch keine behauptet — dieselbe Regel wie auf der
 * Startseite. Alle Namen in den Mockups sind erfunden.
 *
 * **Marken-Violett bleibt.** Die Nische unterscheidet sich über Inhalt,
 * Beispiele und Sprache, nicht über die Farbe: drei Farben wären drei Marken.
 */

export const metadata: Metadata = {
  title: 'Ticketsystem für Sportvereine · Passly',
  description:
    'Vorverkauf für jedes Heimspiel, Dauerkarten für die ganze Saison, Einlass mit dem Handy deiner Helfer. Ohne Grundgebühr, ohne Vertrag, ohne Technik im Verein.',
  alternates: { canonical: '/sportvereine' },
  openGraph: {
    type: 'website',
    title: 'Ticketsystem für Sportvereine · Passly',
    description:
      'Vorverkauf für jedes Heimspiel, Dauerkarten für die ganze Saison, Einlass mit dem Handy deiner Helfer. Ohne Grundgebühr, ohne Vertrag.',
  },
};

/* Die Fragen stehen als Daten da, weil sie zweimal gebraucht werden: einmal
   sichtbar als Aufklappliste und einmal als FAQPage-Auszeichnung für die
   Suche. Zwei getippte Fassungen derselben Antwort würden auseinanderlaufen. */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Wann ist das Geld auf dem Vereinskonto?',
    a: 'Frühestens am Tag nach dem Heimspiel — nicht schon beim Verkauf. Das schützt uns beide vor Rückbuchungen, wenn ein Spiel doch noch abgesagt wird. Beim allerersten Mal warten wir drei Tage nach dem Spiel, danach ist es immer der Tag danach. Ausgezahlt wird über unseren Zahlungspartner Stripe direkt auf euer Vereinskonto; dafür verifiziert ihr es einmalig.',
  },
  {
    q: 'Brauchen unsere Helfer am Eingang einen Zugang?',
    a: 'Nein. Du erzeugst pro Spiel einen Türlink und schickst ihn in die Helfergruppe. Wer ihn öffnet, kann Tickets scannen und die Abendkasse bedienen — sonst nichts. Kein Vereinszugang, kein Passwort, keine App. Der Link läuft nach dem Spiel von allein ab, und du kannst ihn jederzeit widerrufen.',
  },
  {
    q: 'Was ist mit Zuschauern, die bar an der Kasse zahlen?',
    a: 'Die verkaufst du direkt auf der Türseite über die Abendkasse: Kategorie wählen, kassieren, fertig. Das Bargeld bleibt bei euch, es läuft kein Geld über Passly. Der Preis an der Kasse ist derselbe wie online — sonst gewöhnt ihr eure Zuschauer daran, den Vorverkauf zu überspringen. Die Servicegebühr dieser Barverkäufe wird einfach mit eurer nächsten Online-Auszahlung verrechnet.',
  },
  {
    q: 'Können Mitglieder, Schüler oder Rentner günstiger rein?',
    a: 'Ja, über Kategorien: bis zu fünf Preisstufen pro Spiel, jede mit eigenem Kontingent, zum Beispiel Erwachsene, Ermäßigt und Kinder frei. Wer bei euch was zahlt, entscheidet ihr. Rabattcodes für einzelne Gruppen gibt es zusätzlich im Pro-Tarif.',
  },
  {
    q: 'Funktioniert der Einlass, wenn in der Halle kein Netz ist?',
    a: 'Ja. Die Türseite lädt die Ticketliste vor und prüft danach auf dem Gerät weiter — auch ohne Empfang, und auch dann nur einmal je Ticket. Sobald das Handy wieder online ist, werden die Scans nachgetragen. Genau dafür ist es gebaut: Hallen und Sportplätze sind selten Funklöcher-frei.',
  },
  {
    q: 'Was passiert, wenn ein Spiel ausfällt?',
    a: 'Du sagst das Spiel im Dashboard ab, dann wird jedes verkaufte Ticket automatisch und vollständig erstattet, inklusive Servicegebühr — ihr müsst niemandem hinterhertelefonieren. Was der Zahlungsdienstleister bei einer Erstattung einbehält, tragen wir nicht; dieser Betrag wird mit eurer nächsten Auszahlung verrechnet und im Dashboard ausgewiesen.',
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

  /* Abstand und Haarlinie zwischen den Abschnitten wie auf der Startseite —
     hier gilt derselbe Grund: vier Kapitel plus FAQ laufen ohne Trennung
     ineinander. Der Abstand allein stand vorher da, die Linie fehlte; gleicher
     Abstand bei unterschiedlichem Struktursignal war ein Versehen. */
  .container > section + section {
    margin-top: 88px; padding-top: 88px; border-top: 1px solid var(--line);
  }
  @media (max-width: 700px) {
    .container > section + section { margin-top: 56px; padding-top: 56px; }
  }

  /* ── Gebühren ────────────────────────────────────────────── */
  .fee-section { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 40px; align-items: center; }
  @media (max-width: 900px) { .fee-section { grid-template-columns: 1fr; gap: 24px; } }
  .fee-copy h2 { font-size: clamp(24px, 3.2vw, 32px); font-weight: 600; letter-spacing: -0.03em; line-height: 1.15; }
  .fee-copy p { font-size: 14.5px; color: var(--ink-3); line-height: 1.65; margin-top: 12px; max-width: 46ch; }
  .fee-copy .more { display: inline-flex; align-items: center; gap: 7px; margin-top: 18px; font-size: 13.5px; font-weight: 500; color: var(--accent); }
  .fee-copy .more:hover { color: var(--accent-2); }
  .fee-copy .more:active { opacity: 0.7; }

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
  /* Kein Scale: die Zeile ist breit, ein Kippen waere unruhig. Ein Ton dunkler
     ist die Rueckmeldung, dass der Druck angekommen ist. --surface-3 statt
     --surface-2, weil die Zeile auf weissem Grund steht: 0.987 gegen 1.0 waere
     kein sichtbarer Unterschied. Gleiche Stufe wie .nav a:active. */
  .faq summary:active { background: var(--surface-3); }
  .faq summary .faq-chev { color: var(--ink-4); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); flex-shrink: 0; }
  .faq details[open] summary .faq-chev { transform: rotate(90deg); }
  .faq .faq-a { padding: 0 18px 16px; font-size: 13.5px; line-height: 1.65; color: var(--ink-3); max-width: 66ch; }
  /* Die Antwort faehrt auf, statt schlagartig in voller Hoehe dazustehen:
     bisher war das drehende Chevron das einzige bewegte Teil und sagte nichts
     ueber den Inhalt, der erscheint.

     interpolate-size steht bewusst auf .faq details und nicht auf :root — die
     Eigenschaft vererbt, das reicht hier vollstaendig, und app-weit wuerde sie
     jede Hoehen-Transition mit Schluesselwort betreffen (Drawer, Modal,
     EventEditor), also auch etwas animieren, was heute steht.

     ::details-content und interpolate-size gibt es noch nicht ueberall. Wo
     nicht, klappt es auf wie bisher — der akzeptierte Rueckfall, kein Fehler. */
  .faq details { interpolate-size: allow-keywords; }
  .faq details::details-content {
    block-size: 0; overflow: hidden;
    transition: block-size 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                content-visibility 0.28s allow-discrete;
  }
  .faq details[open]::details-content { block-size: auto; }

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
  .footer .links a:active { opacity: 0.7; }

  @media (prefers-reduced-motion: reduce) {
    .faq summary .faq-chev { transition: none; }
    .faq details::details-content { transition: none; }
  }
`;

export default function SportvereinePage() {
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
            <SiteNav active="sport" />
            <div className="topbar-right">
              <SignInButton />
            </div>
          </div>
        </div>

        <div className="main">
          <ScrollReveal />
          <div className="aurora" aria-hidden="true" />
          <div className="container">

            <section className="info-hero" data-reveal>
              <div className="info-eyebrow">
                <Icon name="ticket" size={13} /> Für Sportvereine
              </div>
              <h1>
                Deine Heimspiele.<br />
                Deine Dauerkarten.<br />
                <span className="accent">Deine Kasse.</span>
              </h1>
              <p className="lead">
                Vorverkauf für jedes Heimspiel, Dauerkarten für die ganze Saison,
                Einlass mit dem Handy eurer Helfer. Statt Namensliste, Geldkassette
                und der Frage, wer schon bezahlt hat. Ohne Grundgebühr, ohne
                Vertrag, ohne Technik im Verein.
              </p>
              <div className="hero-ctas">
                <Link href="/become-organizer" className="btn primary lg">
                  Kostenlos starten <Icon name="arrow" size={14} />
                </Link>
                <Link href="/preise" className="btn ghost lg">Was es kostet</Link>
              </div>
            </section>

            {/* Nachprüfbare Zusagen statt Vereinsstimmen: es gibt noch keine. */}
            <section>
              <div className="trust-bar" data-reveal>
                <div className="trust-item">
                  <div className="ic"><Icon name="euro" size={15} /></div>
                  <div className="label">Keine Grundgebühr, kein Vertrag, keine Mindestlaufzeit</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="users" size={15} /></div>
                  <div className="label">Türlinks für Helfer, ohne Vereinszugang</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="wifi" size={15} /></div>
                  <div className="label">Einlass funktioniert auch ohne Netz in der Halle</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="refresh" size={15} /></div>
                  <div className="label">Fällt ein Spiel aus, wird automatisch erstattet</div>
                </div>
              </div>
            </section>

            <section>
              {/* Kapitel 1 — Vorverkauf */}
              <div className="sc-chapter" data-reveal>
                <div className="sc-copy">
                  <span className="sc-eyebrow">Dein Vorverkauf</span>
                  <h3>Ein Link für jedes Heimspiel.</h3>
                  <p>
                    Du legst das Spiel an und teilst einen Link — in der WhatsApp-Gruppe,
                    auf Instagram, auf der Vereinsseite. Wer draufklickt, kauft in einer
                    Minute und hat sein Ticket sofort auf dem Handy.
                  </p>
                  <ul className="sc-points">
                    <li><Icon name="check" size={14} /> Bis zu fünf Preisstufen: Erwachsene, Ermäßigt, Mitglieder, Kinder frei</li>
                    <li><Icon name="check" size={14} /> Karte, PayPal, Apple&nbsp;Pay und Google&nbsp;Pay</li>
                    <li><Icon name="check" size={14} /> Kaufen ohne Konto, das legt der Zuschauer später an</li>
                    <li><Icon name="check" size={14} /> Jedes Kontingent zählt sich selbst herunter, nichts wird doppelt verkauft</li>
                  </ul>
                </div>
                <div className="sc-media">
                  <ShopCard {...NICHE_SPORT.shopCard} />
                </div>
              </div>

              {/* Kapitel 2 — Dauerkarte. Das Kapitel, das diese Seite von der
                  Startseite und von einer Club-Seite unterscheidet. */}
              <div className="sc-chapter flip" data-reveal>
                <div className="sc-copy">
                  <span className="sc-eyebrow">Deine Dauerkarte</span>
                  <h3>Die ganze Saison auf einem Ticket.</h3>
                  <p>
                    Du legst die Heimspiele einer Saison zu einer Dauerkarte zusammen und
                    verkaufst sie wie ein normales Ticket. Am Eingang zählt dasselbe Handy,
                    dasselbe Scannen — nur eben an elf Spieltagen statt an einem.
                  </p>
                  <ul className="sc-points">
                    <li><Icon name="check" size={14} /> Ein Ticket für alle Termine der Serie</li>
                    <li><Icon name="check" size={14} /> Je Spieltag genau einmal Einlass, automatisch mitgezählt</li>
                    <li><Icon name="check" size={14} /> Eigenes Kontingent, unabhängig von den Tageskarten</li>
                    <li><Icon name="check" size={14} /> Im kostenlosen Tarif enthalten</li>
                  </ul>
                </div>
                <div className="sc-media">
                  <SeasonPassMock />
                </div>
              </div>

              {/* Kapitel 3 — Tür */}
              <DoorScene
                eventName="Heimspiel gegen SV Nordstadt"
                ticketWhen="Samstag, 11. Oktober · 19:30 Uhr"
                doorWhen="Samstag, 11. Oktober"
                tierLabel="Erwachsene"
                venue="Sporthalle am Ring"
                admittedCount="164"
                lastScanAt="19:22"
                doorHeading="Der Eingang ist ein Handy."
                doorText="Kein Scanner, keine Hardware, keine Schulung: dein Helfer öffnet einen Link und scannt mit dem eigenen Handy. Zwei Eingänge? Zwei Links."
                ticketHeading="Der Code steht nie still."
                ticketText="Der Code auf dem Handy des Zuschauers erneuert sich jede Minute. Ein weitergeschickter Screenshot ist am Eingang wertlos."
              />

              <ul className="scn-facts" data-reveal>
                <li><Icon name="check" size={14} /> Türlinks für Helfer, ohne Zugang zum Vereinskonto</li>
                <li><Icon name="check" size={14} /> Läuft weiter, wenn in der Halle das Netz wegbricht</li>
                <li><Icon name="check" size={14} /> Abendkasse für Laufkundschaft, zum selben Preis wie online</li>
                <li><Icon name="check" size={14} /> Wiedereinlass in der Halbzeitpause, wenn du ihn einschaltest</li>
              </ul>

              {/* Kapitel 4 — Zahlen */}
              <div className="sc-chapter" data-reveal>
                <div className="sc-copy">
                  <span className="sc-eyebrow">Deine Zahlen</span>
                  <h3>Am Donnerstag weißt du, wie voll es Samstag wird.</h3>
                  <p>
                    Wie viele Karten weg sind, wie viele Zuschauer wirklich da waren, was
                    hereingekommen ist — je Heimspiel, ohne dass jemand eine Liste führt.
                    Und für den Kassenwart alles als Datei.
                  </p>
                  <ul className="sc-points">
                    <li><Icon name="check" size={14} /> Verkauft, eingelassen und Einnahmen je Spiel</li>
                    <li><Icon name="check" size={14} /> Zuschauerliste mit Einlassstatus, auch offline geführt</li>
                    <li><Icon name="check" size={14} /> Jede Auszahlung einzeln nachvollziehbar</li>
                    <li><Icon name="check" size={14} /> Export für die Vereinsbuchhaltung, als CSV</li>
                  </ul>
                </div>
                <div className="sc-media">
                  <DashboardMock
                    kicker="Samstag, 11. Oktober"
                    title="Heimspiel gegen SV Nordstadt"
                    sold={164}
                    capacity={220}
                    redeemed={151}
                    revenueLabel="1.312 €"
                  />
                </div>
              </div>
            </section>

            {/* Gebühren. Der Mindestbetrag wird hier offen angesprochen:
                Vereinstickets liegen fast alle unter der Schwelle, ab der die
                7,9 % greifen — der Rechner daneben zeigt die Zahl ohnehin, und
                sie erst an der Kasse zu erklären wäre die schlechtere Reihenfolge. */}
            <section>
              <div className="fee-section" data-reveal>
                <div className="fee-copy">
                  <h2>Was bleibt dem Verein?</h2>
                  <p>
                    Pro verkauftem Ticket fallen 7,9&nbsp;% Servicegebühr an, mindestens
                    aber 0,99&nbsp;€. Bei Vereinspreisen greift fast immer dieser
                    Mindestbetrag: unter rund 12,50&nbsp;€ sind es 0,99&nbsp;€ pro Karte,
                    darüber der Prozentsatz. Standardmäßig zahlt sie der Zuschauer offen
                    ausgewiesen obendrauf, und ihr bekommt euren Kartenpreis auf den Cent.
                    Wollt ihr lieber einen runden Eintrittspreis, übernehmt ihr sie.
                    Kostenlose Spiele bleiben komplett kostenlos.
                  </p>
                  <Link href="/preise" className="more">
                    Alle Preise im Detail <Icon name="arrow" size={13} />
                  </Link>
                </div>
                <FeeCalculator initialPrice={NICHE_SPORT.calcStartPriceEur} quantity={150} />
              </div>
            </section>

            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Häufige Fragen aus Vereinen</h2>
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
                <h2>Leg dein erstes Heimspiel an.</h2>
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
                <Link href="/clubs">Für Clubs</Link>
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
