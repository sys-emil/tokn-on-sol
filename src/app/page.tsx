import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { ScrollReveal } from '@/app/components/ScrollReveal';
import { TodayStamp } from '@/app/components/TodayStamp';
import { FeeCalculator } from '@/app/components/FeeCalculator';
import { ProPrice } from '@/app/components/ProPrice';

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
  .aurora {
    inset: -46% -12% auto -12%;
    height: 680px;
    filter: blur(64px) saturate(1.1);
    opacity: 0.85;
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
    background:
      radial-gradient(circle at 70% 40%, oklch(0.78 0.22 calc(var(--hue) + 40)) 0%, transparent 62%),
      radial-gradient(circle at 40% 80%, oklch(0.80 0.20 calc(var(--hue) - 40)) 0%, transparent 62%);
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
  /* Blurry colour glows further down the page (violet + blue) */
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
    opacity: 0.68;
    animation: glowFloatA 14s ease-in-out infinite alternate;
  }
  .glow-cool {
    width: 600px; height: 600px;
    right: -180px; top: 46%;
    background: radial-gradient(circle at 50% 50%, oklch(0.78 0.18 calc(var(--hue) - 20)) 0%, transparent 68%);
    opacity: 0.6;
    animation: glowFloatB 18s ease-in-out infinite alternate;
  }
  .glow-violet-2 {
    width: 480px; height: 480px;
    left: 8%; top: 76%;
    background: radial-gradient(circle at 50% 50%, oklch(0.77 0.18 calc(var(--hue) + 25)) 0%, transparent 68%);
    opacity: 0.56;
    animation: glowFloatA 20s ease-in-out infinite alternate-reverse;
  }
  @keyframes glowFloatA {
    from { transform: translate3d(0, 0, 0) scale(1); }
    to   { transform: translate3d(36px, -24px, 0) scale(1.06); }
  }
  @keyframes glowFloatB {
    from { transform: translate3d(0, 0, 0) scale(1); }
    to   { transform: translate3d(-40px, 28px, 0) scale(1.05); }
  }
  @media (max-width: 640px) {
    .topbar .btn.subtle { display: none; }
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

  /* ── Hero ─────────────────────────────────────────────────── */
  .landing-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: 48px;
    align-items: center;
    padding: 64px 0 72px;
    position: relative;
  }
  @media (max-width: 920px) {
    .landing-hero { grid-template-columns: 1fr; padding: 40px 0 48px; gap: 40px; }
  }
  .landing-hero h1 {
    font-size: clamp(38px, 5.4vw, 60px);
    letter-spacing: -0.04em;
    font-weight: 600;
    line-height: 1.04;
  }
  .landing-hero h1 .accent { color: var(--accent); }
  .landing-hero .lead {
    margin-top: 18px;
    font-size: 16.5px; line-height: 1.6;
    color: var(--ink-3);
    max-width: 48ch;
  }
  .hero-ctas { margin-top: 28px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .hero-guest {
    margin-top: 18px;
    font-size: 13px; color: var(--ink-3);
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  .hero-guest a { color: var(--accent); font-weight: 500; }
  .hero-guest a:hover { color: var(--accent-2); }

  /* ── Ticket mockup ───────────────────────────────────────── */
  .mock-wrap { display: flex; justify-content: center; position: relative; }
  .mock-ticket {
    width: 300px;
    max-width: 100%;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    transform: rotate(2.5deg);
    animation: mockFloat 7s ease-in-out infinite;
  }
  @keyframes mockFloat {
    0%, 100% { transform: rotate(2.5deg) translateY(0); }
    50%      { transform: rotate(2.5deg) translateY(-8px); }
  }
  @media (prefers-reduced-motion: reduce) { .mock-ticket { animation: none; } }
  .mock-head { padding: 18px 20px 14px; display: flex; align-items: center; justify-content: space-between; }
  .mock-head .event { font-size: 15px; font-weight: 600; letter-spacing: -0.015em; }
  .mock-head .date { font-size: 12px; color: var(--ink-3); margin-top: 2px; }
  .mock-body {
    background: var(--accent-wash);
    border-top: 1px dashed var(--accent-line);
    border-bottom: 1px dashed var(--accent-line);
    padding: 22px 20px;
    display: grid; place-items: center;
    position: relative;
  }
  .mock-body::before, .mock-body::after {
    content: "";
    position: absolute; top: -7px;
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .mock-body::before { left: -8px; }
  .mock-body::after { right: -8px; }
  .mock-qr {
    width: 148px; height: 148px;
    background: var(--surface);
    border: 1px solid var(--accent-line);
    border-radius: 12px;
    display: grid; place-items: center;
    color: #23263c;
    position: relative;
    overflow: hidden;
  }
  /* Scan-Beam: der QR lebt, genau das Verkaufsargument */
  .mock-qr::after {
    content: "";
    position: absolute; left: 8px; right: 8px; top: 0;
    height: 36px; border-radius: 8px;
    background: linear-gradient(180deg, transparent, oklch(0.56 0.22 var(--hue) / 0.22) 55%, oklch(0.56 0.22 var(--hue) / 0.45) 78%, transparent);
    animation: qrScan 3s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes qrScan {
    0%, 12%  { transform: translateY(-40px); opacity: 0; }
    22%      { opacity: 1; }
    68%      { opacity: 1; }
    80%, 100% { transform: translateY(152px); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .mock-qr::after { animation: none; opacity: 0; } }
  .mock-foot { padding: 14px 20px 18px; display: flex; align-items: center; justify-content: space-between; }
  .mock-foot .id { font-family: var(--mono); font-size: 11px; color: var(--ink-3); }

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
            <div className="nav">
              <Link href="/fuer-veranstalter">Für Veranstalter</Link>
              <Link href="/preise">Preise</Link>
              <Link href="/events">Events</Link>
            </div>
            <div className="topbar-right">
              <Link href="/my-tickets" className="btn subtle sm">Meine Tickets</Link>
              <Link href="/become-organizer" className="btn primary sm">Event anlegen</Link>
            </div>
          </div>
        </div>

        <div className="main">
          <ScrollReveal />
          <div className="aurora" aria-hidden="true" />
          <div className="glow glow-violet" aria-hidden="true" />
          <div className="glow glow-cool" aria-hidden="true" />
          <div className="glow glow-violet-2" aria-hidden="true" />
          <div className="container">

            {/* Hero */}
            <section className="landing-hero">
              <div data-reveal>
                <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--accent-ink)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>
                  <Icon name="calendar" size={13} /> Ticketing für Veranstalter
                </div>
                <h1>
                  Deine Gäste kaufen bei dir.<br />
                  <span className="accent">Nicht bei uns.</span>
                </h1>
                <p className="lead">
                  Passly ist Ticketing, das deinen Namen trägt: eigene Verkaufsseite,
                  100&nbsp;% des Ticketpreises und deine Regeln beim Einlass und beim
                  Weiterverkauf.
                </p>
                <div className="hero-ctas">
                  <Link href="/become-organizer" className="btn primary lg btn-shine">
                    Event anlegen <Icon name="arrow" size={14} />
                  </Link>
                  <Link href="/preise" className="btn ghost lg">Was es kostet</Link>
                </div>
                <div className="hero-guest">
                  Du willst nur ein Ticket kaufen?
                  <Link href="/events">Events entdecken →</Link>
                </div>
              </div>

              {/* Ticket mockup */}
              <div className="mock-wrap" aria-hidden="true" data-reveal style={{ '--reveal-delay': '140ms' } as React.CSSProperties}>
                <div className="mock-ticket">
                  <div className="mock-head">
                    <div>
                      <div className="event">Die beste Nacht des Jahres</div>
                      <div className="date"><TodayStamp suffix=" · Einlass 20:00" /></div>
                    </div>
                    <span className="chip ok"><span className="d" />Gültig</span>
                  </div>
                  <div className="mock-body">
                    <div className="mock-qr"><Icon name="qr" size={96} strokeWidth={1.1} /></div>
                  </div>
                  <div className="mock-foot">
                    <span className="id">#PSL-K4X2</span>
                    <PasslyLogo height={16} asLink={false} />
                  </div>
                </div>
              </div>
            </section>

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
                    Kein Abzug vom Nennwert. Die Servicegebühr zahlt der Gast sichtbar
                    obendrauf, statt sie dir vom Umsatz zu nehmen.
                  </p>
                  <ul className="pillar-points">
                    <li><Icon name="check" size={14} /> 100&nbsp;% des Ticketpreises, ohne Grundgebühr</li>
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
                    Du bekommst den Ticketpreis, den du festlegst; auf den Cent. Deine
                    Gäste zahlen 1&nbsp;€ plus 4&nbsp;% pro Ticket obendrauf, offen im
                    Warenkorb ausgewiesen. Keine Einrichtungskosten, keine monatliche
                    Gebühr, keine Mindestlaufzeit.
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
