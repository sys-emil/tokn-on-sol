import Link from 'next/link';
import CtaButton from '@/app/components/CtaButton';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { ScrollReveal } from '@/app/components/ScrollReveal';
import { TodayStamp } from '@/app/components/TodayStamp';

const PAGE_CSS = `
  /* ── Stronger aurora on the landing page ─────────────────── */
  .aurora {
    inset: -46% -12% auto -12%;
    height: 680px;
    filter: blur(64px) saturate(1.45);
    opacity: 1;
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
  .glow-violet {
    width: 560px; height: 560px;
    left: -160px; top: 820px;
    background: radial-gradient(circle at 50% 50%, oklch(0.76 0.20 var(--hue)) 0%, transparent 68%);
    opacity: 0.68;
    animation: glowFloatA 14s ease-in-out infinite alternate;
  }
  .glow-blue {
    width: 600px; height: 600px;
    right: -180px; top: 1450px;
    background: radial-gradient(circle at 50% 50%, oklch(0.78 0.17 235) 0%, transparent 68%);
    opacity: 0.62;
    animation: glowFloatB 18s ease-in-out infinite alternate;
  }
  .glow-violet-2 {
    width: 480px; height: 480px;
    left: 8%; top: 2150px;
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
  @media (max-width: 920px) {
    .glow-violet { top: 900px; }
    .glow-blue { top: 1700px; }
    .glow-violet-2 { top: 2600px; }
  }
  @media (max-width: 640px) {
    /* "Für Veranstalter" bleibt über Hero, Karte und Footer erreichbar */
    .topbar .btn.subtle { display: none; }
    .glow { filter: blur(64px); }
    .glow-violet { width: 340px; height: 340px; left: -120px; }
    .glow-blue { width: 360px; height: 360px; right: -140px; }
    .glow-violet-2 { width: 300px; height: 300px; }
    .landing-hero { padding: 32px 0 40px; }
    .cta-banner { padding: 40px 22px; }
    .audience-card { padding: 22px 18px; }
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
    max-width: 46ch;
  }
  .hero-ctas { margin-top: 28px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .hero-organizer {
    margin-top: 18px;
    font-size: 13px; color: var(--ink-3);
    display: flex; align-items: center; gap: 8px;
  }
  .hero-organizer a { color: var(--accent); font-weight: 500; }
  .hero-organizer a:hover { color: var(--accent-2); }

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
  /* Scan-Beam: der QR lebt — genau das Verkaufsargument */
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

  /* ── Audience sections ───────────────────────────────────── */
  .audience-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 860px) { .audience-grid { grid-template-columns: 1fr; } }
  .audience-card { padding: 26px; display: flex; flex-direction: column; gap: 16px; }
  .aud-tag {
    align-self: flex-start;
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 11.5px; font-weight: 500;
    color: var(--accent-ink);
    background: var(--accent-wash);
    border: 1px solid var(--accent-line);
    padding: 3px 9px; border-radius: 999px;
  }
  .audience-card h3 { font-size: 19px; font-weight: 600; letter-spacing: -0.025em; }
  .audience-card > p { font-size: 13.5px; color: var(--ink-3); line-height: 1.6; margin-top: -8px; }
  .aud-points { list-style: none; display: flex; flex-direction: column; gap: 9px; }
  .aud-points li {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 13.5px; color: var(--ink-2); line-height: 1.55;
  }
  .aud-points svg { color: var(--accent); flex-shrink: 0; margin-top: 3px; }
  .aud-cta { margin-top: auto; padding-top: 6px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .aud-more { font-size: 13px; font-weight: 500; color: var(--accent); }
  .aud-more:hover { color: var(--accent-2); }

  .why-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 860px) { .why-grid { grid-template-columns: 1fr; } }
  .why-card { padding: 22px; display: flex; gap: 16px; align-items: flex-start; }
  .why-icon {
    width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
    display: grid; place-items: center;
  }
  .why-card h3 { font-size: 15px; font-weight: 600; letter-spacing: -0.015em; }
  .why-card p { font-size: 13.5px; color: var(--ink-3); line-height: 1.6; margin-top: 4px; }

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

  /* ── Stats strip ─────────────────────────────────────────── */
  .stats-strip {
    display: flex; align-items: center; justify-content: center; gap: 12px;
    flex-wrap: wrap;
    font-size: 13px; color: var(--ink-3);
    padding: 8px 0;
  }
  .stats-strip .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--ink-4); }

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
          <div className="glow glow-violet" aria-hidden="true" />
          <div className="glow glow-blue" aria-hidden="true" />
          <div className="glow glow-violet-2" aria-hidden="true" />
          <div className="container">

            {/* Hero */}
            <section className="landing-hero">
              <div data-reveal>
                <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-ink)', fontWeight: 500, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', padding: '4px 10px', borderRadius: 999, marginBottom: 18 }}>
                  <Icon name="shield" size={13} /> Fälschungssichere Tickets
                </div>
                <h1>
                  Tickets, die man<br />
                  <span className="accent">nicht fälschen</span> kann.
                </h1>
                <p className="lead">
                  Jedes Ticket ist einzigartig und lässt sich weder kopieren noch abfotografieren.
                  Keine Fälschungen am Einlass, kein Weiterverkaufs-Chaos — nur ein Code, der
                  eindeutig dir gehört.
                </p>
                <div className="hero-ctas">
                  <Link href="/events" className="btn primary lg btn-shine">
                    Events entdecken <Icon name="arrow" size={14} />
                  </Link>
                  <Link href="/so-funktionierts" className="btn ghost lg">So funktioniert&rsquo;s</Link>
                </div>
                <div className="hero-organizer">
                  Du veranstaltest selbst?
                  <Link href="/fuer-veranstalter">So funktioniert Passly für Veranstalter →</Link>
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

            {/* Trust-Leiste — konkrete, nachprüfbare Zusagen statt Kundenstimmen */}
            <section>
              <div className="trust-bar" data-reveal>
                <div className="trust-item">
                  <div className="ic"><Icon name="lock" size={15} /></div>
                  <div className="label">Zahlungen verschlüsselt über Stripe</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="location" size={15} /></div>
                  <div className="label">Daten gehostet in der EU</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="euro" size={15} /></div>
                  <div className="label">100&nbsp;% des Ticketpreises an den Veranstalter</div>
                </div>
                <div className="trust-item">
                  <div className="ic"><Icon name="refresh" size={15} /></div>
                  <div className="label">Automatische Rückerstattung bei Event-Absage</div>
                </div>
              </div>
            </section>

            {/* Für Gäste & Veranstalter */}
            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Für Gäste &amp; Veranstalter</h2>
                  <div className="sub">Was Passly für beide Seiten macht — kurz erklärt</div>
                </div>
              </div>
              <div className="audience-grid">
                <div className="card audience-card" data-reveal>
                  <span className="aud-tag"><Icon name="ticket" size={12} /> Für Gäste</span>
                  <h3>Kaufen, anmelden, reingehen.</h3>
                  <p>
                    Dein Ticket lebt in deinem Konto, nicht auf einem Zettel — und ist
                    auf jedem Gerät sofort wieder da.
                  </p>
                  <ul className="aud-points">
                    <li><Icon name="check" size={14} /> Mit Karte zahlen — ohne App, ohne Passwort</li>
                    <li><Icon name="check" size={14} /> Ticket auf jedem Gerät, Anmeldung per E-Mail-Code</li>
                    <li><Icon name="check" size={14} /> QR-Code erneuert sich jede Minute — nicht kopierbar</li>
                    <li><Icon name="check" size={14} /> Verhindert? Ticket sicher per Link weitergeben</li>
                  </ul>
                  <div className="aud-cta">
                    <Link href="/so-funktionierts" className="btn ghost">
                      So funktioniert&rsquo;s <Icon name="arrow" size={13} />
                    </Link>
                    <Link href="/events" className="aud-more">Events entdecken →</Link>
                  </div>
                </div>
                <div className="card audience-card" data-reveal style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
                  <span className="aud-tag"><Icon name="calendar" size={12} /> Für Veranstalter</span>
                  <h3>Dein komplettes Ticketsystem.</h3>
                  <p>
                    Event anlegen, Tickets verkaufen, mit dem Handy einlassen — ohne
                    Fixkosten und ohne Technik-Aufwand.
                  </p>
                  <ul className="aud-points">
                    <li><Icon name="check" size={14} /> Event in Minuten live — öffentlich oder privat per Link</li>
                    <li><Icon name="check" size={14} /> 100&nbsp;% des Ticketpreises gehören dir</li>
                    <li><Icon name="check" size={14} /> Einlass-Scanner im Browser, für dein ganzes Team</li>
                    <li><Icon name="check" size={14} /> Automatische Auszahlung aufs Bankkonto</li>
                  </ul>
                  <div className="aud-cta">
                    <Link href="/fuer-veranstalter" className="btn ghost">
                      Für Veranstalter erklärt <Icon name="arrow" size={13} />
                    </Link>
                    <Link href="/become-organizer" className="aud-more">Direkt Event anlegen →</Link>
                  </div>
                </div>
              </div>
            </section>

            {/* Warum Passly */}
            <section>
              <div className="section-head" data-reveal>
                <div>
                  <h2>Warum Passly</h2>
                  <div className="sub">Gebaut gegen Fälschungen — und für entspannte Abende</div>
                </div>
              </div>
              <div className="why-grid">
                <div className="card why-card" data-reveal>
                  <div className="why-icon" style={{ background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', color: 'var(--accent)' }}>
                    <Icon name="shield" size={17} />
                  </div>
                  <div>
                    <h3>Nicht kopierbar</h3>
                    <p>
                      Der QR-Code erneuert sich jede Minute. Ein Screenshot ist am Einlass
                      wertlos — nur das echte Ticket kommt durch.
                    </p>
                  </div>
                </div>
                <div className="card why-card" data-reveal style={{ '--reveal-delay': '90ms' } as React.CSSProperties}>
                  <div className="why-icon" style={{ background: 'var(--ok-wash)', border: '1px solid oklch(0.86 0.08 150)', color: 'var(--ok)' }}>
                    <Icon name="doublecheck" size={17} />
                  </div>
                  <div>
                    <h3>Blitzschnell geprüft</h3>
                    <p>
                      Jeder Scan prüft Echtheit und Besitz in Echtzeit und löst das Ticket
                      genau einmal ein. Doppelter Einlass? Ausgeschlossen.
                    </p>
                  </div>
                </div>
                <div className="card why-card" data-reveal style={{ '--reveal-delay': '180ms' } as React.CSSProperties}>
                  <div className="why-icon" style={{ background: 'var(--warn-wash)', border: '1px solid oklch(0.86 0.09 70)', color: 'var(--warn)' }}>
                    <Icon name="euro" size={17} />
                  </div>
                  <div>
                    <h3>Faire Auszahlung</h3>
                    <p>
                      Der Ticketpreis geht zu 100&nbsp;% an dich als Veranstalter — die
                      Servicegebühr zahlen die Käufer transparent obendrauf.
                    </p>
                  </div>
                </div>
                <div className="card why-card" data-reveal style={{ '--reveal-delay': '270ms' } as React.CSSProperties}>
                  <div className="why-icon" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                    <Icon name="share" size={17} />
                  </div>
                  <div>
                    <h3>Weitergeben per Link</h3>
                    <p>
                      Verhindert? Ticket per Link an Freunde weitergeben — sicher und
                      nachvollziehbar, ohne Zettelwirtschaft.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Stats strip */}
            <section>
              <div className="stats-strip" data-reveal>
                <span>Keine App nötig</span>
                <span className="dot" />
                <span>Prüfung in unter einer Sekunde</span>
                <span className="dot" />
                <span>Bezahlen einfach mit Karte</span>
              </div>
            </section>

            {/* CTA banner */}
            <section>
              <div className="cta-banner" data-reveal>
                <h2>Bereit für Tickets, die man nicht fälschen kann?</h2>
                <p>Leg dein erstes Event an — kostenlos und in wenigen Minuten.</p>
                <Link href="/become-organizer" className="btn lg btn-shine">
                  Jetzt Event anlegen <Icon name="arrow" size={14} />
                </Link>
              </div>
            </section>

            <footer className="footer">
              <div>© 2026 Passly · Digitale Tickets</div>
              <div className="links">
                <Link href="/events">Events</Link>
                <Link href="/so-funktionierts">So funktioniert&rsquo;s</Link>
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
