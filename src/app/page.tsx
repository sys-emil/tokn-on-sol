import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { SignInButton } from '@/app/components/SignInButton';
import { ScrollReveal } from '@/app/components/ScrollReveal';
import { HeroTicket } from '@/app/components/HeroTicket';
import { FeeCalculator } from '@/app/components/FeeCalculator';
import { ProPrice } from '@/app/components/ProPrice';
import { SiteNav } from '@/app/components/SiteNav';

/*
 * Landing page — addressed at ORGANIZERS, deliberately (since 2026-07-30).
 *
 * Guests never pick a ticketing provider; they arrive on /shop/[id] from the
 * organizer's own link and never see this page. The people who make a decision
 * here are organizers, so the hero sells to them. Guest discovery lives on
 * /events and the public @handle profiles, reachable from the nav, the guest
 * strip below and the footer. Don't turn the hero back into "Events entdecken".
 *
 * "Fälschungssicher" is a proof point under pillar 3, not the headline: it is
 * a feature every competitor claims, and it is not what makes an organizer
 * switch. The positioning is that the organizer keeps their brand, their money
 * and their rules.
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
    .pillar-card { padding: 22px 18px; }
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
  .hero-v2-guest { margin: 20px 0 0; font: 400 13.5px var(--font); color: var(--ink-3); }
  .hero-v2-guest a { font-weight: 500; color: var(--accent); }
  .hero-v2-guest a:hover { color: var(--accent-2); }
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

  /* ── Die drei Säulen ─────────────────────────────────────── */
  .pillar-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  @media (max-width: 940px) { .pillar-grid { grid-template-columns: 1fr; } }
  .pillar-card { padding: 26px; display: flex; flex-direction: column; gap: 14px; }
  .pillar-icon {
    width: 40px; height: 40px; border-radius: 11px;
    display: grid; place-items: center;
    background: var(--accent-wash);
    border: 1px solid var(--accent-line);
    color: var(--accent);
  }
  .pillar-card h3 { font-size: 18px; font-weight: 600; letter-spacing: -0.025em; }
  .pillar-card > p { font-size: 13.5px; color: var(--ink-3); line-height: 1.6; margin-top: -6px; }
  .pillar-points { list-style: none; display: flex; flex-direction: column; gap: 9px; margin-top: 2px; }
  .pillar-points li {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 13.5px; color: var(--ink-2); line-height: 1.55;
  }
  .pillar-points svg { color: var(--accent); flex-shrink: 0; margin-top: 3px; }

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

  /* ── Gäste-Streifen ──────────────────────────────────────── */
  .guest-strip {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: var(--radius);
    padding: 20px 24px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap;
  }
  .guest-strip .t { font-size: 15px; font-weight: 600; letter-spacing: -0.02em; }
  .guest-strip .s { font-size: 13px; color: var(--ink-3); margin-top: 3px; }
  .guest-strip .acts { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

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
                  Deine Gäste kaufen bei dir.<br />
                  <span className="grad">Nicht bei uns.</span>
                </h1>
                <p className="lead">
                  Passly ist Ticketing, das deinen Namen trägt: eigene Verkaufsseite,
                  100&nbsp;% des Ticketpreises und deine Regeln beim Einlass und beim
                  Weiterverkauf.
                </p>
                <div className="hero-v2-ctas">
                  <Link href="/become-organizer" className="btn primary lg">Event anlegen →</Link>
                  <Link href="/preise" className="btn ghost lg">Was es kostet</Link>
                </div>
                <p className="hero-v2-guest">
                  Du willst nur ein Ticket kaufen? <Link href="/events">Events entdecken →</Link>
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
                  <div className="label">100&nbsp;% des Ticketpreises an dich</div>
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

            {/* Die drei Säulen */}
            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Warum Veranstalter zu Passly wechseln</h2>
                  <div className="sub">Drei Dinge, die anderswo dem Marktplatz gehören</div>
                </div>
              </div>
              <div className="pillar-grid">
                <div className="card pillar-card" data-reveal>
                  <div className="pillar-icon"><Icon name="sparkle" size={18} /></div>
                  <h3>Dein Name steht drauf</h3>
                  <p>
                    Deine Gäste landen auf deiner Seite, nicht in einem fremden Regal
                    zwischen vierhundert anderen Veranstaltungen.
                  </p>
                  <ul className="pillar-points">
                    <li><Icon name="check" size={14} /> Öffentliche Markenseite unter getpassly.de/@deinname</li>
                    <li><Icon name="check" size={14} /> Banner, Logo, Text und Links, die du selbst pflegst</li>
                    <li><Icon name="check" size={14} /> Eigene Akzentfarbe auf jeder Eventkarte</li>
                    <li><Icon name="check" size={14} /> Geprüft-Kennzeichnung, damit Gäste dich erkennen</li>
                  </ul>
                </div>

                <div className="card pillar-card" data-reveal style={{ '--reveal-delay': '90ms' } as React.CSSProperties}>
                  <div className="pillar-icon"><Icon name="euro" size={18} /></div>
                  <h3>Der Ticketpreis gehört dir</h3>
                  <p>
                    Kein prozentualer Abzug vom Nennwert. Die Servicegebühr zahlt
                    standardmäßig der Gast sichtbar obendrauf; ob du sie lieber teilst
                    oder selbst trägst, entscheidest du je Event.
                  </p>
                  <ul className="pillar-points">
                    <li><Icon name="check" size={14} /> Ohne Grundgebühr, du bestimmst wer die Gebühr zahlt</li>
                    <li><Icon name="check" size={14} /> Auszahlung aufs Bankkonto, Puffer selbst gewählt</li>
                    <li><Icon name="check" size={14} /> Jede Auszahlung einzeln nachvollziehbar</li>
                    <li><Icon name="check" size={14} /> Kostenlose Events kosten auch dich nichts</li>
                  </ul>
                </div>

                <div className="card pillar-card" data-reveal style={{ '--reveal-delay': '180ms' } as React.CSSProperties}>
                  <div className="pillar-icon"><Icon name="scan" size={18} /></div>
                  <h3>Der Abend läuft</h3>
                  <p>
                    Einlass, Abendkasse und Weiterverkauf laufen nach deinen Regeln,
                    auch wenn im Keller das Netz wegbricht.
                  </p>
                  <ul className="pillar-points">
                    <li><Icon name="check" size={14} /> QR-Code erneuert sich jede Minute, Screenshots sind wertlos</li>
                    <li><Icon name="check" size={14} /> Scanner läuft im Browser und weiter ohne Empfang</li>
                    <li><Icon name="check" size={14} /> Türlinks fürs Personal, Abendkasse für Laufkundschaft</li>
                    <li><Icon name="check" size={14} /> Weiterverkauf nur bis zu deiner Preisobergrenze</li>
                  </ul>
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

            {/* Pro */}
            <section>
              <div className="pro-block" data-reveal>
                <div>
                  <span className="tag"><Icon name="sparkle" size={12} /> Passly Pro</span>
                  <h2>Wenn du deine Gäste wiedersehen willst</h2>
                  <div className="sub">
                    Alles oben ist kostenlos und bleibt es. Pro kommt dazu, wenn aus
                    einzelnen Abenden ein Publikum wird.
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

            {/* Gäste sollen sich nicht verlaufen */}
            <section>
              <div className="guest-strip" data-reveal>
                <div>
                  <div className="t">Du bist als Gast hier?</div>
                  <div className="s">Dein Ticket liegt in deinem Konto, auf jedem Gerät abrufbar.</div>
                </div>
                <div className="acts">
                  <Link href="/so-funktionierts" className="btn ghost sm">So funktioniert&rsquo;s</Link>
                  <Link href="/events" className="btn subtle sm">Events entdecken</Link>
                  <Link href="/my-tickets" className="btn subtle sm">Meine Tickets</Link>
                </div>
              </div>
            </section>

            {/* CTA banner */}
            <section>
              <div className="cta-banner" data-reveal>
                <h2>Leg dein erstes Event an.</h2>
                <p>Kostenlos, in wenigen Minuten, ohne Vertrag und ohne Grundgebühr.</p>
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
