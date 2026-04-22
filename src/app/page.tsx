'use client';

import { useLogin, usePrivy } from '@privy-io/react-auth';
import { Epilogue, Unbounded } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '900'],
  display: 'swap',
});

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500'],
  display: 'swap',
});

export default function Home() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin({
    onComplete: () => router.push('/dashboard'),
  });

  useEffect(() => {
    if (ready && authenticated) router.push('/dashboard');
  }, [ready, authenticated, router]);

  return (
    <>
      <style>{`
        :root {
          --color-bg:           oklch(0.10 0.014 258);
          --color-surface:      oklch(0.14 0.014 258);
          --color-border:       oklch(0.22 0.016 258);
          --color-text:         oklch(0.96 0.008 95);
          --color-text-muted:   oklch(0.48 0.012 250);
          --color-accent:       oklch(0.72 0.118 148);
          --color-accent-bg:    oklch(0.18 0.040 148);
        }

        html, body {
          margin: 0;
          padding: 0;
          background: var(--color-bg);
        }

        .root {
          font-family: var(--font-body);
          background-color: var(--color-bg);
          background-image: radial-gradient(
            circle,
            oklch(0.23 0.014 258 / 0.45) 1px,
            transparent 1px
          );
          background-size: 28px 28px;
          color: var(--color-text);
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
        }

        /* ── Navigation ─────────────────────────────────────── */
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 20;
          padding: 26px 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: oklch(0.10 0.014 258 / 0.88);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .logo {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--color-text);
        }

        .logo-dot {
          color: var(--color-accent);
        }

        .nav-chain {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        /* ── Hero ────────────────────────────────────────────── */
        .hero {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 136px 48px 96px;
          align-items: center;
          box-sizing: border-box;
        }

        .hero-content {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .hero-label {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--color-accent);
        }

        .hero-label-line {
          display: block;
          width: 28px;
          height: 1px;
          background: var(--color-accent);
          flex-shrink: 0;
        }

        .hero-headline {
          font-family: var(--font-display);
          font-size: clamp(46px, 6.2vw, 86px);
          font-weight: 900;
          line-height: 1.04;
          letter-spacing: -0.025em;
          color: var(--color-text);
          margin: 0;
        }

        .hero-headline-accent {
          color: var(--color-accent);
        }

        .hero-body {
          font-family: var(--font-body);
          font-size: clamp(15px, 1.4vw, 17px);
          line-height: 1.70;
          color: var(--color-text-muted);
          max-width: 44ch;
          margin: 0;
        }

        /* ── CTA Button ──────────────────────────────────────── */
        .cta {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 14px 28px;
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-accent);
          background: transparent;
          border: 1.5px solid var(--color-accent);
          cursor: pointer;
          align-self: flex-start;
          transition:
            background 0.16s ease,
            color 0.16s ease;
        }

        .cta:hover:not(:disabled) {
          background: var(--color-accent);
          color: oklch(0.10 0.014 258);
        }

        .cta:hover:not(:disabled) .cta-arrow {
          transform: translateX(5px);
        }

        .cta:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .cta-arrow {
          display: inline-block;
          transition: transform 0.16s ease;
        }

        /* ── Ticket decoration ───────────────────────────────── */
        .ticket-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
        }

        .ticket {
          width: 100%;
          max-width: 360px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          position: relative;
          padding: 28px 30px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ticket-notch-left,
        .ticket-notch-right {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
        }

        .ticket-notch-left  { left:  -14px; }
        .ticket-notch-right { right: -14px; }

        .ticket-divider {
          position: absolute;
          top: 50%;
          left: 7%;
          right: 7%;
          height: 0;
          border-top: 1px dashed var(--color-border);
        }

        .ticket-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .ticket-id {
          font-family: var(--font-display);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .ticket-verified {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-accent);
        }

        .ticket-verified-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--color-accent);
          flex-shrink: 0;
        }

        .ticket-event-name {
          font-family: var(--font-display);
          font-size: clamp(22px, 2.4vw, 28px);
          font-weight: 900;
          line-height: 1.1;
          color: var(--color-text);
        }

        .ticket-bottom {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-top: 28px;
        }

        .ticket-field {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .ticket-field-label {
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--color-text-muted);
        }

        .ticket-field-value {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--color-text);
        }

        /* ── Features ────────────────────────────────────────── */
        .features {
          border-top: 1px solid var(--color-border);
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 72px 48px 96px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          box-sizing: border-box;
        }

        .feature {
          padding: 0 48px 0 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .feature + .feature {
          padding-left: 48px;
          border-left: 1px solid var(--color-border);
        }

        .feature-num {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: var(--color-accent);
        }

        .feature-title {
          font-family: var(--font-display);
          font-size: clamp(16px, 1.4vw, 19px);
          font-weight: 900;
          line-height: 1.2;
          color: var(--color-text);
        }

        .feature-desc {
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.72;
          color: var(--color-text-muted);
          max-width: 30ch;
          margin: 0;
        }

        /* ── Footer ──────────────────────────────────────────── */
        .footer {
          border-top: 1px solid var(--color-border);
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 22px 48px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-sizing: border-box;
        }

        .footer-copy {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-text-muted);
          letter-spacing: 0.04em;
        }

        .footer-tagline {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        /* ── Entrance animations ─────────────────────────────── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        .a1 { animation: fadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both; }
        .a2 { animation: fadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
        .a3 { animation: fadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both; }
        .a4 { animation: fadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both; }
        .a5 { animation: fadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both; }

        @media (prefers-reduced-motion: reduce) {
          .a1, .a2, .a3, .a4, .a5 { animation: none; }
        }

        /* ── Responsive ──────────────────────────────────────── */
        @media (max-width: 900px) {
          .nav { padding: 20px 24px; }

          .hero {
            grid-template-columns: 1fr;
            padding: 108px 24px 64px;
          }

          .ticket-wrap { display: none; }

          .features {
            grid-template-columns: 1fr;
            padding: 48px 24px 64px;
            gap: 40px;
          }

          .feature { padding: 0; }

          .feature + .feature {
            padding-left: 0;
            border-left: none;
            border-top: 1px solid var(--color-border);
            padding-top: 40px;
          }

          .footer {
            padding: 20px 24px;
            flex-direction: column;
            gap: 6px;
            align-items: flex-start;
          }
        }
      `}</style>

      <div className={`root ${unbounded.variable} ${epilogue.variable}`}>

        {/* Nav */}
        <nav className="nav">
          <div className="logo">Tokn<span className="logo-dot">.</span></div>
          <div className="nav-chain">Solana</div>
        </nav>

        {/* Hero */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-label a1">
              <span className="hero-label-line" />
              NFT Ticketing on Solana
            </div>

            <h1 className="hero-headline a2">
              Tickets that<br />
              <span className="hero-headline-accent">can&rsquo;t</span> be<br />
              faked.
            </h1>

            <p className="hero-body a3">
              Tokn issues cryptographically unique NFT tickets on Solana.
              Each one is verifiable on-chain, impossible to clone, and
              scannable at the gate in real time.
            </p>

            <button
              className="cta a4"
              onClick={login}
              disabled={!ready}
            >
              Get Started
              <span className="cta-arrow">→</span>
            </button>
          </div>

          {/* Ticket illustration */}
          <div className="ticket-wrap a5">
            <div className="ticket">
              <div className="ticket-notch-left" />
              <div className="ticket-notch-right" />
              <div className="ticket-divider" />

              <div className="ticket-top">
                <div className="ticket-id">#TKN&ndash;0001</div>
                <div className="ticket-verified">
                  <div className="ticket-verified-dot" />
                  On-chain
                </div>
              </div>

              <div className="ticket-event-name">
                Summer<br />Festival
              </div>

              <div className="ticket-bottom">
                <div className="ticket-field">
                  <div className="ticket-field-label">Date</div>
                  <div className="ticket-field-value">Jul 12, 2025</div>
                </div>
                <div className="ticket-field">
                  <div className="ticket-field-label">Gate</div>
                  <div className="ticket-field-value">A-04</div>
                </div>
                <div className="ticket-field">
                  <div className="ticket-field-label">Tier</div>
                  <div className="ticket-field-value">General</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="features">
          <div className="feature">
            <div className="feature-num">01</div>
            <div className="feature-title">Zero counterfeits</div>
            <p className="feature-desc">
              Each ticket is a unique token on Solana. No PDFs to screenshot.
              No barcodes to copy. Ownership is provable, not printable.
            </p>
          </div>

          <div className="feature">
            <div className="feature-num">02</div>
            <div className="feature-title">Instant gate validation</div>
            <p className="feature-desc">
              Attendees show their wallet. Your staff scans. The blockchain
              confirms in real time — no barcodes, no backend calls to fake.
            </p>
          </div>

          <div className="feature">
            <div className="feature-num">03</div>
            <div className="feature-title">Resale on your terms</div>
            <p className="feature-desc">
              Set royalty rules once. Earn a cut on every resale,
              automatically — without chasing secondary markets.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-copy">© 2025 Tokn Based</div>
          <div className="footer-tagline">Built on Solana</div>
        </footer>

      </div>
    </>
  );
}
