import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { SignInButton } from '@/app/components/SignInButton';
import { ScrollReveal } from '@/app/components/ScrollReveal';
import { HeroTicket } from '@/app/components/HeroTicket';
import { FeeCalculator } from '@/app/components/FeeCalculator';
import { ProPrice } from '@/app/components/ProPrice';
import { SiteNav } from '@/app/components/SiteNav';
import { ShopCard, SHOP_CARD_CSS } from '@/app/components/eventSurfaces/ShopCard';
import { DashboardMock, SHOWCASE_CSS } from '@/app/components/showcase/ShowcaseMocks';
import { DoorScene } from '@/app/components/showcase/DoorScene';
import { LiveEvents } from '@/app/components/showcase/LiveEvents';

/*
 * Startseite — richtet sich an Veranstalter, die noch nie online verkauft
 * haben (seit 28.08.2026; ersetzt die Marktplatz-Positionierung vom
 * 30.07.2026).
 *
 * Der Zielkunde kuendigt auf Instagram an, kassiert per PayPal und fuehrt an
 * der Tuer eine Namensliste. Er muss vor keinem Marktplatz gerettet werden —
 * er hat keine Reichweite und eine Schlange, die nicht vorangeht. Deshalb
 * benennt die Kopfzeile den Ablauf statt einen Gegner: "Dein Vorverkauf.
 * Deine Tuer. Deine Zahlen." Ihre drei Teile sind zugleich die drei Kapitel
 * des Showcase darunter, in derselben Reihenfolge.
 *
 * "Fuer dich kostenlos" statt "100 % des Ticketpreises": der Zielkunde
 * bekommt heute 100 %, per PayPal, fuer null. Jede Gebuehr ist fuer ihn eine
 * *neue* Ausgabe, also muss der Satz entwaffnen statt zu prahlen. Die
 * Rechnung dahinter steht im Gebuehrenabschnitt.
 *
 * Gaeste kommen fast nie hierher, um Events zu suchen — sie kommen ueber den
 * Link des Veranstalters direkt auf /shop/[id]. Wer doch hier landet, sucht
 * meist sein Ticket; das traegt die Kopfleiste ("Events", "Meine Tickets" an
 * Position 1 und 2 auf jeder Seite), nicht der Hero.
 */

const PAGE_CSS = `
  /* ── Stronger aurora on the landing page ─────────────────── */
  /* Fester Pixel-Offset statt Prozent: ein prozentualer top-Wert rechnet gegen
     die Hoehe von .main, und die ist auf dieser langen Seite ein paar tausend
     Pixel — die Aurora landete damit weit oberhalb des Sichtbereichs und war
     gar nicht zu sehen. Auf kurzen Seiten (globals.css, -40%) faellt das nicht
     auf, hier schon. */
  .aurora {
    inset: -220px -12% auto -12%;
    height: 680px;
    filter: blur(64px) saturate(1.1);
    /* Zurueckhaltender als frueher: die Hero-Sektion bringt inzwischen mit
       .hero-v2-bg eine eigene Farbgrafik mit, die darueber liegt. */
    opacity: 0.34;
  }
  .aurora::before {
    left: 2%; top: 4%;
    width: 720px; height: 720px;
    background: radial-gradient(circle at 30% 30%, oklch(0.78 0.24 var(--hue)) 0%, transparent 66%);
    animation: auroraDriftA 16s ease-in-out infinite alternate;
  }
  .aurora::after {
    right: -4%; top: -10%;
    width: 860px; height: 860px;
    background: radial-gradient(circle at 70% 40%, oklch(0.78 0.22 calc(var(--hue) + 40)) 0%, transparent 62%);
    animation: auroraDriftB 20s ease-in-out infinite alternate;
  }
  @keyframes auroraDriftA {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(40px, 24px, 0); }
  }
  @keyframes auroraDriftB {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(-48px, 18px, 0); }
  }
  /* Blurry colour glows further down the page (violet only) */
  .glow {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(90px);
    z-index: 0;
  }
  /* Positioned as a share of page height so each glow lands behind a real
     section (hero · mid · CTA) instead of in a dead-zone at a guessed pixel. */
  .glow-violet {
    width: 560px; height: 560px;
    left: -160px; top: 16%;
    background: radial-gradient(circle at 50% 50%, oklch(0.76 0.20 var(--hue)) 0%, transparent 68%);
    opacity: 0.38;
    animation: glowFloatA 14s ease-in-out infinite alternate;
  }
  .glow-violet-2 {
    width: 480px; height: 480px;
    left: 8%; top: 76%;
    background: radial-gradient(circle at 50% 50%, oklch(0.77 0.18 calc(var(--hue) + 25)) 0%, transparent 68%);
    opacity: 0.3;
    animation: glowFloatA 20s ease-in-out infinite alternate-reverse;
  }
  @keyframes glowFloatA {
    from { transform: translate3d(0, 0, 0) scale(1); }
    to   { transform: translate3d(36px, -24px, 0) scale(1.06); }
  }
  @media (max-width: 640px) {
    .glow { filter: blur(64px); }
    .glow-violet { width: 340px; height: 340px; left: -120px; }
    .glow-violet-2 { width: 300px; height: 300px; }
    .landing-hero { padding: 32px 0 40px; }
    .cta-banner { padding: 40px 22px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .aurora::before, .aurora::after, .glow { animation: none; }
  }

  /* ── Hero (1:1 aus passly-hero.html) ──────────────────────── */
  /* Vollbreite Sektion mit eigenem Verlaufs-Hintergrund; sie liegt deshalb
     außerhalb von .container und deckt in ihrem Bereich Aurora/Glows ab. */
  /* Kein eigener Hintergrund: body traegt bereits --surface-2. Waere die
     Sektion deckend, wuerde sie die Glows der Seite an ihrer Unterkante
     glatt abschneiden — als Linie sichtbar, sobald man scrollt. */
  .hero-v2 { position: relative; overflow: hidden; }
  .hero-v2-bg {
    position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(680px 420px at 76% -6%, oklch(0.80 0.14 300/.30), transparent 62%),
      radial-gradient(560px 380px at 96% 46%, oklch(0.85 0.10 220/.24), transparent 65%),
      radial-gradient(520px 320px at 58% 96%, oklch(0.90 0.08 330/.20), transparent 70%);
    filter: blur(6px);
    /* Der dritte Verlauf sitzt auf 96% Hoehe und ist an der Unterkante noch
       fast voll deckend; overflow:hidden schnitte ihn mitten in der Farbe
       durch. Die Maske blendet die Sektionsgrafik vorher aus, damit sie in
       die Seite laeuft statt an einer Kante zu enden. */
    -webkit-mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
    mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
  }
  .hero-v2-inner {
    position: relative;
    display: grid; grid-template-columns: 1.05fr .95fr;
    gap: 48px; align-items: center;
    padding: 88px 64px 96px;
    max-width: 1280px; margin: 0 auto;
  }
  .hero-v2 h1 {
    margin: 0; font: 700 62px/1.03 var(--font);
    letter-spacing: -0.045em; color: var(--ink);
  }
  .hero-v2 h1 .grad {
    background: linear-gradient(92deg, oklch(0.54 0.22 285), oklch(0.58 0.19 320));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .hero-v2 .lead {
    margin: 22px 0 0; max-width: 520px;
    font: 400 17px/1.65 var(--font); color: var(--ink-3);
  }
  .hero-v2-ctas { display: flex; gap: 12px; margin-top: 32px; flex-wrap: wrap; }
  .hero-v2-note { margin: 18px 0 0; font: 400 13px var(--font); color: var(--ink-3); }
  .hero-v2-mock {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    min-height: 520px; perspective: 1500px;
  }
  /* 600% × 22% Streifenbreite = 132% der Karte: der Sweep laeuft vollstaendig
     rechts hinaus statt kurz davor stehenzubleiben. Das Easing sitzt auf dem
     Sweep-Segment, die Pause danach ist ein reiner Halt. */
  @keyframes shimmerSweep {
    0%   { transform: translateX(-140%) skewX(-18deg); animation-timing-function: cubic-bezier(.42,.02,.3,1); }
    52%  { transform: translateX(600%) skewX(-18deg); }
    100% { transform: translateX(600%) skewX(-18deg); }
  }
  /* Nicht im Original: die Vorlage ist ein Desktop-Mockup ohne Umbruch. */
  @media (max-width: 980px) {
    .hero-v2-inner { grid-template-columns: 1fr; gap: 40px; padding: 56px 24px 64px; }
    .hero-v2 h1 { font-size: clamp(38px, 8vw, 56px); }
    .hero-v2-mock { min-height: 0; }
  }
  @media (max-width: 420px) {
    .hero-v2-ticket { width: 100% !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-v2-shimmer { animation: none; }
  }

  /* ── Trust bar ────────────────────────────────────────────── */
  .trust-bar {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  @media (max-width: 820px) { .trust-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .trust-item {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px;
    border: 1px solid var(--line-2);
    background: var(--surface);
    border-radius: var(--radius);
  }
  .trust-item .ic {
    width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
    display: grid; place-items: center;
    background: var(--accent-wash); color: var(--accent-ink);
  }
  .trust-item .label { font-size: 12.5px; color: var(--ink-2); line-height: 1.4; font-weight: 500; }

  /* Die Startseite ist lang; die 36px aus globals.css liessen ihre Abschnitte
     ineinanderlaufen. Hier bekommt jeder Abschnitt Luft und eine Haarlinie. */
  .container > section + section {
    margin-top: 88px; padding-top: 88px; border-top: 1px solid var(--line);
  }
  @media (max-width: 700px) {
    .container > section + section { margin-top: 56px; padding-top: 56px; }
  }

  /* ── Showcase: die drei Kapitel ──────────────────────────── */
  ${SHOP_CARD_CSS}
  ${SHOWCASE_CSS}

  /* ── Gebühren-Abschnitt ──────────────────────────────────── */
  .fee-section { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 40px; align-items: center; }
  @media (max-width: 900px) { .fee-section { grid-template-columns: 1fr; gap: 24px; } }
  .fee-copy h2 { font-size: clamp(24px, 3.2vw, 32px); font-weight: 600; letter-spacing: -0.03em; line-height: 1.15; }
  .fee-copy p { font-size: 14.5px; color: var(--ink-3); line-height: 1.65; margin-top: 12px; max-width: 44ch; }
  .fee-copy .more { display: inline-flex; align-items: center; gap: 7px; margin-top: 18px; font-size: 13.5px; font-weight: 500; color: var(--accent); }
  .fee-copy .more:hover { color: var(--accent-2); }

  /* ── Pro-Block ───────────────────────────────────────────── */
  .pro-block {
    border: 1px solid var(--accent-line);
    background:
      radial-gradient(700px 260px at 12% -30%, var(--accent-wash), transparent 70%),
      var(--surface);
    border-radius: var(--radius-lg);
    padding: 32px;
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    gap: 36px;
    align-items: center;
    box-shadow: var(--shadow);
  }
  @media (max-width: 900px) { .pro-block { grid-template-columns: 1fr; gap: 24px; padding: 26px 22px; } }
  .pro-block .tag {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 11px; font-weight: 600; color: var(--accent-ink);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .pro-block h2 { font-size: clamp(22px, 3vw, 28px); font-weight: 600; letter-spacing: -0.03em; margin-top: 12px; line-height: 1.2; }
  .pro-block .sub { font-size: 14px; color: var(--ink-3); line-height: 1.6; margin-top: 10px; }
  .pro-price { margin-top: 20px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .pro-feats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
  @media (max-width: 560px) { .pro-feats { grid-template-columns: 1fr; } }
  .pro-feats li {
    list-style: none;
    display: flex; gap: 9px; align-items: flex-start;
    font-size: 13.5px; color: var(--ink-2); line-height: 1.5;
  }
  .pro-feats svg { color: var(--accent); flex-shrink: 0; margin-top: 3px; }

  /* ── CTA banner ──────────────────────────────────────────── */
  .cta-banner {
    background: linear-gradient(135deg, var(--accent), oklch(0.48 0.22 calc(var(--hue) + 30)));
    border-radius: var(--radius-lg);
    padding: 48px 32px;
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
  /* Der Abschluss-CTA ist selbst ein Ticket: Stanz-Kerben wie im Hero-Mockup */
  .cta-banner::after {
    content: "";
    position: absolute; inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 0 50%, var(--surface-2) 9px, transparent 10px),
      radial-gradient(circle at 100% 50%, var(--surface-2) 9px, transparent 10px);
  }
  .cta-banner h2 {
    font-size: clamp(24px, 3.4vw, 34px);
    font-weight: 600; letter-spacing: -0.03em; line-height: 1.15;
    position: relative;
  }
  .cta-banner p { font-size: 14.5px; opacity: 0.85; margin-top: 10px; position: relative; }
  .cta-banner .btn {
    margin-top: 24px;
    background: white; color: var(--accent-ink);
    position: relative;
  }
  .cta-banner .btn:hover { background: oklch(0.96 0.01 var(--hue)); }
  /* Weißer Button im Banner: Sweep in Akzentfarbe statt Weiß */
  .cta-banner .btn-shine::after {
    background: linear-gradient(105deg, transparent 40%, oklch(0.56 0.22 var(--hue) / 0.14) 50%, transparent 60%);
  }

  /* ── Footer ──────────────────────────────────────────────── */
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

export default function Home() {
  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <SiteNav />
            <div className="topbar-right">
              <SignInButton />
            </div>
          </div>
        </div>

        <div className="main">
          <ScrollReveal />
          <div className="aurora" aria-hidden="true" />
          <div className="glow glow-violet" aria-hidden="true" />
          <div className="glow glow-violet-2" aria-hidden="true" />

          {/* Hero — 1:1 aus passly-hero.html, vollbreit außerhalb des Containers */}
          <section className="hero-v2">
            <div className="hero-v2-bg" aria-hidden="true" />
            <div className="hero-v2-inner">
              <div>
                <h1>
                  Dein Vorverkauf. Deine Tür.<br />
                  <span className="grad">Deine Zahlen.</span>
                </h1>
                <p className="lead">
                  Verkauf deine Tickets online, scann sie an der Tür, und sieh jederzeit,
                  wie der Abend steht. Für dich kostenlos.
                </p>
                <div className="hero-v2-ctas">
                  <Link href="/become-organizer" className="btn primary lg">Kostenlos anfangen →</Link>
                </div>
                {/* Die Pruefung wird ausgesprochen statt verschwiegen: der Knopf fuehrt
                    auf ein Bewerbungsformular, und wer „anlegen“ liest, erwartet anlegen.
                    Faellt die manuelle Freischaltung, wird hier „Sofort loslegen“ daraus. */}
                <p className="hero-v2-note">
                  In der Regel innerhalb eines Werktags freigeschaltet.
                </p>
              </div>

              <HeroTicket />
            </div>
          </section>

          <div className="container">

            {/* Trust-Leiste: konkrete, nachprüfbare Zusagen statt Kundenstimmen */}
            <section>
              <div className="trust-bar" data-reveal>
                <div className="trust-item">
                  <div className="ic"><Icon name="euro" size={15} /></div>
                  <div className="label">Für dich kostenlos, ohne Grundgebühr</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="lock" size={15} /></div>
                  <div className="label">Zahlungen verschlüsselt über Stripe</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="location" size={15} /></div>
                  <div className="label">Daten gehostet in der EU</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="refresh" size={15} /></div>
                  <div className="label">Automatische Rückerstattung bei Absage</div>
                </div>
              </div>
            </section>

            {/* Die drei Teile der Kopfzeile, in derselben Reihenfolge. Ersetzt spaeter
                der Showcase mit echten Produktbildern — die Ueberschriften bleiben. */}
            <section>
              {/* Kapitel 1 — Vorverkauf */}
              <div className="sc-chapter" data-reveal>
                <div className="sc-copy">
                  <span className="sc-eyebrow">Dein Vorverkauf</span>
                  <h3>Ein Link, den du teilst.</h3>
                  <p>
                    Statt Namensliste, DMs und Überweisungen: eine eigene Verkaufsseite,
                    in Minuten angelegt. Das Ticket liegt sofort auf dem Handy deines Gastes.
                  </p>
                  <ul className="sc-points">
                    <li><Icon name="check" size={14} /> Karte, PayPal, Apple&nbsp;Pay und Google&nbsp;Pay</li>
                    <li><Icon name="check" size={14} /> Preiskategorien, Kontingente, Rabattcodes</li>
                    <li><Icon name="check" size={14} /> Kaufen ohne Konto, das legt dein Gast später an</li>
                    <li><Icon name="check" size={14} /> Für dich kostenlos, ohne Grundgebühr und Vertrag</li>
                  </ul>
                </div>
                <div className="sc-media">
                  <ShopCard
                    name="Die beste Nacht des Jahres"
                    dateChip={{ month: 'Sep', day: '5' }}
                    whenLabel="Freitag, 5. September · 20:00 Uhr"
                    venue="Halle 7, Leipzig"
                    priceLabel="ab 12,00 €"
                    feeNote="zzgl. Servicegebühr"
                    tiers={[
                      { name: 'Frühbucher', priceLabel: '12,00 €' },
                      { name: 'Abendkasse', priceLabel: '15,00 €' },
                    ]}
                    ctaLabel="Jetzt kaufen"
                  />
                </div>
              </div>

              {/* Kapitel 2 — Tür. Eigener Abschnitt statt Zweispalter: die
                  Szene braucht die ganze Buehne, und ihre beiden Texte
                  treten darin selbst auf. Die vier Belege, die vorher als
                  Stichpunkte danebenstanden, folgen als Leiste darunter. */}
              <DoorScene />

              <ul className="scn-facts" data-reveal>
                <li><Icon name="check" size={14} /> Der Code erneuert sich jede Minute, Screenshots sind wertlos</li>
                <li><Icon name="check" size={14} /> Läuft weiter, wenn im Keller das Netz wegbricht</li>
                <li><Icon name="check" size={14} /> Türlinks fürs Personal, ohne deinen Zugang</li>
                <li><Icon name="check" size={14} /> Abendkasse für Laufkundschaft, zum selben Preis</li>
              </ul>

              {/* Kapitel 3 — Zahlen */}
              <div className="sc-chapter" data-reveal>
                <div className="sc-copy">
                  <span className="sc-eyebrow">Deine Zahlen</span>
                  <h3>Und du siehst, wie der Abend steht.</h3>
                  <p>
                    Zum ersten Mal weißt du vorher, wie voll es wird. Und hinterher, wer
                    wirklich da war. Die Zahlen entstehen nebenbei, du machst nichts anders.
                  </p>
                  <ul className="sc-points">
                    <li><Icon name="check" size={14} /> Verkauft, eingelöst und Einnahmen je Abend</li>
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

            {/* Gebühren, transparent gerechnet */}
            <section>
              <div className="fee-section" data-reveal>
                <div className="fee-copy">
                  <h2>Rechne selbst nach.</h2>
                  <p>
                    7,9&nbsp;% Servicegebühr pro Ticket, mindestens 0,99&nbsp;€. Der
                    Satz sinkt, je teurer das Ticket ist. Standardmäßig zahlt
                    sie dein Gast obendrauf, offen im Warenkorb ausgewiesen, und du bekommst
                    den Ticketpreis auf den Cent. Willst du lieber einen runden Endpreis,
                    übernimmst du sie. Keine Einrichtungskosten, keine monatliche Gebühr,
                    keine Mindestlaufzeit.
                  </p>
                  <Link href="/preise" className="more">
                    Alle Preise im Detail <Icon name="arrow" size={13} />
                  </Link>
                </div>
                <FeeCalculator />
              </div>
            </section>

            {/* Echte Events als Beleg — rendert erst ab sechs oeffentlichen
                kommenden Events, siehe LiveEvents. */}
            <LiveEvents />

            {/* Pro */}
            <section>
              <div className="pro-block" data-reveal>
                <div>
                  <span className="tag"><Icon name="sparkle" size={12} /> Passly Pro</span>
                  <h2>Wenn du deine Gäste wiedersehen willst</h2>
                  <div className="sub">
                    Deine Zahlen oben beantworten „wer kommt?“ und bleiben kostenlos.
                    Pro beantwortet „wer kommt wieder?“, sobald aus einzelnen Abenden ein
                    Publikum wird.
                  </div>
                  <div className="pro-price">
                    <ProPrice />
                    <Link href="/preise" style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--accent)' }}>
                      Was drin ist →
                    </Link>
                  </div>
                </div>
                <ul className="pro-feats">
                  <li><Icon name="check" size={14} /> Stammgäste, Neukunden und gefährdete Gäste als Segmente</li>
                  <li><Icon name="check" size={14} /> E-Mail-Kampagnen an eine Gästegruppe</li>
                  <li><Icon name="check" size={14} /> Mehrstufiges Treueprogramm mit eigenen Vorteilen</li>
                  <li><Icon name="check" size={14} /> Rabattcodes und Gästeliste</li>
                  <li><Icon name="check" size={14} /> Warteliste, sobald ein Event ausverkauft ist</li>
                  <li><Icon name="check" size={14} /> Umsatzprognose und Vergleich mit der Plattform</li>
                </ul>
              </div>
            </section>

            {/* CTA banner */}
            <section>
              <div className="cta-banner" data-reveal>
                <h2>Leg dein erstes Event an.</h2>
                <p>Kostenlos, ohne Vertrag und ohne Grundgebühr. Wir schalten dich in der Regel innerhalb eines Werktags frei.</p>
                <Link href="/become-organizer" className="btn lg btn-shine">
                  Jetzt starten <Icon name="arrow" size={14} />
                </Link>
              </div>
            </section>

            <footer className="footer">
              <div>© 2026 Passly · Digitale Tickets</div>
              <div className="links">
                <Link href="/fuer-veranstalter">Für Veranstalter</Link>
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
