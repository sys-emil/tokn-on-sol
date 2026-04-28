import { Epilogue, Unbounded } from 'next/font/google';
import Link from 'next/link';

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

export default async function Home() {
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
          position: relative;
          isolation: isolate;
        }

        /* Aurora — pulsing green glow */
        .hero-aurora {
          position: absolute;
          top: -160px;
          right: -120px;
          bottom: -40px;
          left: 38%;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 12%, #000 78%, transparent 100%);
                  mask-image: linear-gradient(180deg, transparent 0%, #000 12%, #000 78%, transparent 100%);
        }
        .hero-aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          will-change: transform, opacity;
        }
        .hero-aurora-blob-1 {
          top: 8%;
          left: 18%;
          width: 620px;
          height: 620px;
          background: radial-gradient(circle at 50% 50%,
            oklch(0.72 0.118 148 / 0.55) 0%,
            oklch(0.72 0.118 148 / 0.28) 38%,
            oklch(0.72 0.118 148 / 0) 70%);
          animation: auroraPulseA 9s ease-in-out infinite;
        }
        .hero-aurora-blob-2 {
          top: 36%;
          left: 46%;
          width: 480px;
          height: 480px;
          background: radial-gradient(circle at 50% 50%,
            oklch(0.78 0.140 158 / 0.40) 0%,
            oklch(0.72 0.118 148 / 0.18) 42%,
            oklch(0.72 0.118 148 / 0) 72%);
          animation: auroraPulseB 11s ease-in-out infinite;
        }
        .hero-aurora-blob-3 {
          top: 58%;
          left: 8%;
          width: 540px;
          height: 540px;
          background: radial-gradient(circle at 50% 50%,
            oklch(0.62 0.150 148 / 0.32) 0%,
            oklch(0.62 0.150 148 / 0.12) 45%,
            oklch(0.62 0.150 148 / 0) 72%);
          animation: auroraPulseC 13s ease-in-out infinite;
        }
        @keyframes auroraPulseA {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.85; }
          50%      { transform: translate(-30px, 24px) scale(1.08); opacity: 1; }
        }
        @keyframes auroraPulseB {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
          50%      { transform: translate(40px, -30px) scale(1.12); opacity: 0.95; }
        }
        @keyframes auroraPulseC {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.55; }
          50%      { transform: translate(20px, 20px) scale(1.06); opacity: 0.8; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-aurora-blob { animation: none; }
        }

        .hero-content {
          display: flex;
          flex-direction: column;
          gap: 28px;
          position: relative;
          z-index: 1;
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
          text-decoration: none;
          transition:
            background 0.16s ease,
            color 0.16s ease;
        }

        .cta:hover {
          background: var(--color-accent);
          color: oklch(0.10 0.014 258);
        }

        .cta:hover .cta-arrow {
          transform: translateX(5px);
        }

        .cta-arrow {
          display: inline-block;
          transition: transform 0.16s ease;
        }

        /* ── Phone mockup ────────────────────────────────────── */
        @keyframes phoneFloat {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes phoneGlow {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 0.85; }
        }
        .phone-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          position: relative;
          z-index: 1;
        }
        .phone-glow {
          position: absolute;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          width: 220px;
          height: 48px;
          background: var(--color-accent);
          filter: blur(44px);
          border-radius: 50%;
          animation: phoneGlow 3s ease-in-out infinite;
          z-index: 0;
        }
        /* Outer titanium frame */
        .phone {
          position: relative;
          z-index: 1;
          width: 282px;
          height: 572px;
          border-radius: 54px;
          padding: 8px;
          box-sizing: border-box;
          background:
            linear-gradient(160deg,
              oklch(0.34 0.012 258) 0%,
              oklch(0.22 0.012 258) 38%,
              oklch(0.30 0.012 258) 62%,
              oklch(0.18 0.012 258) 100%);
          box-shadow:
            0 32px 64px oklch(0 0 0 / 0.55),
            inset 0 0 0 1px oklch(0.42 0.012 258 / 0.55),
            inset 0 0 0 2px oklch(0.10 0.012 258);
          animation: phoneFloat 3s ease-in-out infinite;
        }
        /* Side hardware buttons */
        .phone-btn {
          position: absolute;
          background: oklch(0.20 0.012 258);
          box-shadow: inset 0 0 0 1px oklch(0.36 0.012 258 / 0.6);
        }
        .phone-btn-left  { left: -2px;  width: 3px; border-radius: 2px 0 0 2px; }
        .phone-btn-right { right: -2px; width: 3px; border-radius: 0 2px 2px 0; }
        .phone-silent  { top:  88px; height: 28px; }
        .phone-volup   { top: 132px; height: 48px; }
        .phone-voldn   { top: 192px; height: 48px; }
        .phone-power   { top: 152px; height: 76px; }
        /* Inner screen */
        .phone-screen {
          width: 100%;
          height: 100%;
          border-radius: 46px;
          background: oklch(0.10 0.014 258);
          position: relative;
          overflow: hidden;
          box-shadow: inset 0 0 0 1.5px oklch(0.06 0.014 258);
          display: flex;
          flex-direction: column;
        }
        /* Dynamic Island */
        .phone-island {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 96px;
          height: 28px;
          border-radius: 999px;
          background: #000;
          z-index: 3;
        }
        /* Status bar */
        .phone-status {
          position: relative;
          z-index: 2;
          height: 48px;
          padding: 14px 24px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text);
          letter-spacing: 0.02em;
        }
        .phone-status-icons {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .phone-bars {
          display: inline-flex;
          align-items: flex-end;
          gap: 1.5px;
          height: 9px;
        }
        .phone-bars span {
          width: 2px;
          background: var(--color-text);
          border-radius: 1px;
        }
        .phone-bars span:nth-child(1) { height: 3px; }
        .phone-bars span:nth-child(2) { height: 5px; }
        .phone-bars span:nth-child(3) { height: 7px; }
        .phone-bars span:nth-child(4) { height: 9px; }
        .phone-battery {
          width: 22px;
          height: 10px;
          border: 1px solid var(--color-text);
          border-radius: 2.5px;
          padding: 1px;
          position: relative;
          box-sizing: border-box;
        }
        .phone-battery::after {
          content: '';
          position: absolute;
          right: -3px;
          top: 3px;
          width: 1.5px;
          height: 4px;
          background: var(--color-text);
          border-radius: 0 1px 1px 0;
        }
        .phone-battery-fill {
          width: 78%;
          height: 100%;
          background: var(--color-text);
          border-radius: 1px;
        }
        /* Screen content area */
        .phone-content {
          flex: 1;
          padding: 12px 22px 32px;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .phone-card {
          flex: 1;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          padding: 16px 16px 14px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .phone-eyebrow {
          font-family: var(--font-display);
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-accent);
        }
        .phone-event-title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 900;
          line-height: 1.05;
          color: var(--color-text);
          margin-top: 6px;
          letter-spacing: -0.01em;
        }
        .phone-divider {
          height: 1px;
          background: var(--color-border);
          margin: 14px -16px;
        }
        .phone-qr-wrap {
          display: flex;
          justify-content: center;
        }
        .phone-qr {
          background: #fff;
          padding: 8px;
          border-radius: 4px;
          line-height: 0;
        }
        .phone-meta {
          margin-top: auto;
          padding-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .phone-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .phone-row-label {
          font-family: var(--font-body);
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }
        .phone-row-value {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--color-text);
        }
        .phone-row-value-accent { color: var(--color-accent); }
        .phone-footer-mark {
          margin-top: 14px;
          text-align: center;
          font-family: var(--font-display);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.22em;
          color: var(--color-text-muted);
        }
        .phone-home {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 110px;
          height: 4px;
          background: oklch(0.96 0.008 95 / 0.85);
          border-radius: 99px;
          z-index: 3;
        }

        /* ── How it works / Why / Solana / CTA banner ────────── */
        .how-it-works,
        .why-passly,
        .solana-section,
        .cta-banner {
          border-top: 1px solid var(--color-border);
          width: 100%;
        }

        .section-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 80px 48px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 48px;
        }

        .section-label {
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

        .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
        }
        .step {
          padding: 0 48px 0 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .step + .step {
          padding-left: 48px;
          border-left: 1px solid var(--color-border);
        }
        .step-num {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: var(--color-accent);
        }
        .step-title {
          font-family: var(--font-display);
          font-size: clamp(16px, 1.4vw, 19px);
          font-weight: 900;
          line-height: 1.2;
          color: var(--color-text);
        }
        .step-desc {
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.72;
          color: var(--color-text-muted);
          max-width: 30ch;
          margin: 0;
        }

        .why-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1px;
          background: var(--color-border);
          border: 1px solid var(--color-border);
        }
        .why-card {
          background: var(--color-bg);
          padding: 40px 36px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: background 0.2s ease;
        }
        .why-card:hover {
          background: var(--color-surface);
        }
        .why-card-icon {
          font-size: 20px;
          color: var(--color-accent);
          line-height: 1;
        }
        .why-card-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 900;
          color: var(--color-text);
        }
        .why-card-desc {
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.72;
          color: var(--color-text-muted);
          margin: 0;
          max-width: 32ch;
        }

        .solana-inner {
          max-width: 640px;
          margin: 0 auto;
          padding: 96px 48px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          text-align: center;
        }
        .solana-symbol {
          font-size: 36px;
          color: var(--color-accent);
          line-height: 1;
        }
        .solana-text {
          font-family: var(--font-display);
          font-size: clamp(18px, 2vw, 24px);
          font-weight: 900;
          line-height: 1.3;
          color: var(--color-text);
          margin: 0;
        }
        .solana-stats {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }
        .solana-dot {
          color: var(--color-border);
        }

        .cta-banner {
          background: linear-gradient(180deg, oklch(0.15 0.040 148 / 0.12) 0%, transparent 100%);
        }
        .cta-banner-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 96px 48px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 20px;
        }
        .cta-banner-headline {
          font-family: var(--font-display);
          font-size: clamp(28px, 3.5vw, 48px);
          font-weight: 900;
          line-height: 1.1;
          color: var(--color-text);
          margin: 0;
          max-width: 18ch;
        }
        .cta-banner-sub {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--color-text-muted);
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
          .phone { animation: none; }
          .phone-glow { animation: none; }
        }

        /* ── Responsive ──────────────────────────────────────── */
        @media (max-width: 900px) {
          .nav { padding: 20px 24px; }

          .hero {
            grid-template-columns: 1fr;
            padding: 108px 24px 64px;
          }

          .phone-wrap { padding: 48px 24px 32px; }

          .steps { grid-template-columns: 1fr; gap: 40px; }
          .step { padding: 0; }
          .step + .step {
            padding-left: 0;
            border-left: none;
            border-top: 1px solid var(--color-border);
            padding-top: 40px;
          }

          .why-grid { grid-template-columns: 1fr; }

          .solana-inner { padding: 64px 24px; }
          .cta-banner-inner { padding: 64px 24px; }
          .section-inner { padding: 64px 24px; }

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
          <div className="logo">Passly<span className="logo-dot">.</span></div>
          <div className="nav-chain">Solana</div>
        </nav>

        {/* Hero */}
        <section className="hero">
          <div className="hero-aurora" aria-hidden="true">
            <div className="hero-aurora-blob hero-aurora-blob-1" />
            <div className="hero-aurora-blob hero-aurora-blob-2" />
            <div className="hero-aurora-blob hero-aurora-blob-3" />
          </div>
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
              Passly issues cryptographically unique NFT tickets on Solana.
              Each one is verifiable on-chain, impossible to clone, and
              scannable at the gate in real time.
            </p>

            <Link href="/dashboard" className="cta a4">
              Get Started
              <span className="cta-arrow">→</span>
            </Link>
          </div>

          {/* Phone mockup */}
          <div className="phone-wrap a5">
            <div className="phone-glow" />
            <div className="phone">
              {/* Hardware buttons */}
              <div className="phone-btn phone-btn-left phone-silent" />
              <div className="phone-btn phone-btn-left phone-volup" />
              <div className="phone-btn phone-btn-left phone-voldn" />
              <div className="phone-btn phone-btn-right phone-power" />

              <div className="phone-screen">
                <div className="phone-island" />

                {/* Status bar */}
                <div className="phone-status">
                  <span>9:41</span>
                  <div className="phone-status-icons">
                    <div className="phone-bars"><span /><span /><span /><span /></div>
                    <div className="phone-battery">
                      <div className="phone-battery-fill" />
                    </div>
                  </div>
                </div>

                {/* Ticket card */}
                <div className="phone-content">
                  <div className="phone-card">
                    <div className="phone-eyebrow">Your Ticket</div>
                    <div className="phone-event-title">Sommerfest</div>

                    <div className="phone-divider" />

                    <div className="phone-qr-wrap">
                      <div className="phone-qr">
                        <svg
                          width="148"
                          height="148"
                          viewBox="0 0 33 33"
                          shapeRendering="crispEdges"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect x="0" y="0" width="33" height="33" fill="#ffffff" />
                          <path fill="#000" d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM9 0h1v1h-1zM10 0h1v1h-1zM11 0h1v1h-1zM13 0h1v1h-1zM14 0h1v1h-1zM16 0h1v1h-1zM19 0h1v1h-1zM21 0h1v1h-1zM23 0h1v1h-1zM26 0h1v1h-1zM27 0h1v1h-1zM28 0h1v1h-1zM29 0h1v1h-1zM30 0h1v1h-1zM31 0h1v1h-1zM32 0h1v1h-1zM0 1h1v1h-1zM6 1h1v1h-1zM14 1h1v1h-1zM17 1h1v1h-1zM19 1h1v1h-1zM22 1h1v1h-1zM24 1h1v1h-1zM26 1h1v1h-1zM32 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM15 2h1v1h-1zM17 2h1v1h-1zM18 2h1v1h-1zM19 2h1v1h-1zM22 2h1v1h-1zM23 2h1v1h-1zM24 2h1v1h-1zM26 2h1v1h-1zM28 2h1v1h-1zM29 2h1v1h-1zM30 2h1v1h-1zM32 2h1v1h-1zM0 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM11 3h1v1h-1zM13 3h1v1h-1zM14 3h1v1h-1zM15 3h1v1h-1zM18 3h1v1h-1zM19 3h1v1h-1zM20 3h1v1h-1zM21 3h1v1h-1zM22 3h1v1h-1zM26 3h1v1h-1zM28 3h1v1h-1zM29 3h1v1h-1zM30 3h1v1h-1zM32 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM8 4h1v1h-1zM13 4h1v1h-1zM15 4h1v1h-1zM18 4h1v1h-1zM21 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM26 4h1v1h-1zM28 4h1v1h-1zM29 4h1v1h-1zM30 4h1v1h-1zM32 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM14 5h1v1h-1zM16 5h1v1h-1zM17 5h1v1h-1zM19 5h1v1h-1zM20 5h1v1h-1zM23 5h1v1h-1zM24 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM24 6h1v1h-1zM26 6h1v1h-1zM27 6h1v1h-1zM28 6h1v1h-1zM29 6h1v1h-1zM30 6h1v1h-1zM31 6h1v1h-1zM32 6h1v1h-1zM9 7h1v1h-1zM13 7h1v1h-1zM14 7h1v1h-1zM20 7h1v1h-1zM21 7h1v1h-1zM23 7h1v1h-1zM2 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM9 8h1v1h-1zM10 8h1v1h-1zM11 8h1v1h-1zM12 8h1v1h-1zM14 8h1v1h-1zM17 8h1v1h-1zM21 8h1v1h-1zM23 8h1v1h-1zM24 8h1v1h-1zM25 8h1v1h-1zM2 9h1v1h-1zM3 9h1v1h-1zM4 9h1v1h-1zM7 9h1v1h-1zM9 9h1v1h-1zM11 9h1v1h-1zM12 9h1v1h-1zM15 9h1v1h-1zM16 9h1v1h-1zM21 9h1v1h-1zM22 9h1v1h-1zM23 9h1v1h-1zM25 9h1v1h-1zM26 9h1v1h-1zM28 9h1v1h-1zM32 9h1v1h-1zM0 10h1v1h-1zM1 10h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM8 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM11 10h1v1h-1zM15 10h1v1h-1zM16 10h1v1h-1zM20 10h1v1h-1zM21 10h1v1h-1zM22 10h1v1h-1zM23 10h1v1h-1zM25 10h1v1h-1zM28 10h1v1h-1zM31 10h1v1h-1zM32 10h1v1h-1zM1 11h1v1h-1zM3 11h1v1h-1zM5 11h1v1h-1zM7 11h1v1h-1zM8 11h1v1h-1zM10 11h1v1h-1zM15 11h1v1h-1zM16 11h1v1h-1zM17 11h1v1h-1zM18 11h1v1h-1zM19 11h1v1h-1zM21 11h1v1h-1zM22 11h1v1h-1zM23 11h1v1h-1zM24 11h1v1h-1zM27 11h1v1h-1zM28 11h1v1h-1zM30 11h1v1h-1zM0 12h1v1h-1zM1 12h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM12 12h1v1h-1zM14 12h1v1h-1zM15 12h1v1h-1zM17 12h1v1h-1zM18 12h1v1h-1zM19 12h1v1h-1zM20 12h1v1h-1zM21 12h1v1h-1zM22 12h1v1h-1zM25 12h1v1h-1zM27 12h1v1h-1zM28 12h1v1h-1zM29 12h1v1h-1zM32 12h1v1h-1zM1 13h1v1h-1zM4 13h1v1h-1zM5 13h1v1h-1zM8 13h1v1h-1zM9 13h1v1h-1zM10 13h1v1h-1zM11 13h1v1h-1zM15 13h1v1h-1zM18 13h1v1h-1zM19 13h1v1h-1zM20 13h1v1h-1zM24 13h1v1h-1zM25 13h1v1h-1zM26 13h1v1h-1zM28 13h1v1h-1zM30 13h1v1h-1zM32 13h1v1h-1zM0 14h1v1h-1zM1 14h1v1h-1zM3 14h1v1h-1zM6 14h1v1h-1zM14 14h1v1h-1zM15 14h1v1h-1zM18 14h1v1h-1zM19 14h1v1h-1zM20 14h1v1h-1zM23 14h1v1h-1zM25 14h1v1h-1zM26 14h1v1h-1zM29 14h1v1h-1zM31 14h1v1h-1zM0 15h1v1h-1zM2 15h1v1h-1zM3 15h1v1h-1zM5 15h1v1h-1zM7 15h1v1h-1zM8 15h1v1h-1zM11 15h1v1h-1zM12 15h1v1h-1zM13 15h1v1h-1zM18 15h1v1h-1zM22 15h1v1h-1zM26 15h1v1h-1zM29 15h1v1h-1zM31 15h1v1h-1zM0 16h1v1h-1zM2 16h1v1h-1zM5 16h1v1h-1zM6 16h1v1h-1zM8 16h1v1h-1zM9 16h1v1h-1zM10 16h1v1h-1zM16 16h1v1h-1zM24 16h1v1h-1zM27 16h1v1h-1zM28 16h1v1h-1zM30 16h1v1h-1zM31 16h1v1h-1zM32 16h1v1h-1zM0 17h1v1h-1zM1 17h1v1h-1zM4 17h1v1h-1zM5 17h1v1h-1zM10 17h1v1h-1zM12 17h1v1h-1zM13 17h1v1h-1zM14 17h1v1h-1zM17 17h1v1h-1zM18 17h1v1h-1zM19 17h1v1h-1zM20 17h1v1h-1zM26 17h1v1h-1zM32 17h1v1h-1zM0 18h1v1h-1zM2 18h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM9 18h1v1h-1zM11 18h1v1h-1zM13 18h1v1h-1zM18 18h1v1h-1zM19 18h1v1h-1zM20 18h1v1h-1zM24 18h1v1h-1zM25 18h1v1h-1zM29 18h1v1h-1zM0 19h1v1h-1zM1 19h1v1h-1zM2 19h1v1h-1zM3 19h1v1h-1zM4 19h1v1h-1zM5 19h1v1h-1zM7 19h1v1h-1zM8 19h1v1h-1zM9 19h1v1h-1zM10 19h1v1h-1zM11 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM19 19h1v1h-1zM21 19h1v1h-1zM22 19h1v1h-1zM27 19h1v1h-1zM28 19h1v1h-1zM30 19h1v1h-1zM31 19h1v1h-1zM32 19h1v1h-1zM4 20h1v1h-1zM5 20h1v1h-1zM6 20h1v1h-1zM7 20h1v1h-1zM9 20h1v1h-1zM13 20h1v1h-1zM15 20h1v1h-1zM17 20h1v1h-1zM18 20h1v1h-1zM20 20h1v1h-1zM21 20h1v1h-1zM22 20h1v1h-1zM23 20h1v1h-1zM27 20h1v1h-1zM29 20h1v1h-1zM30 20h1v1h-1zM32 20h1v1h-1zM0 21h1v1h-1zM2 21h1v1h-1zM7 21h1v1h-1zM10 21h1v1h-1zM11 21h1v1h-1zM13 21h1v1h-1zM17 21h1v1h-1zM18 21h1v1h-1zM21 21h1v1h-1zM22 21h1v1h-1zM23 21h1v1h-1zM30 21h1v1h-1zM32 21h1v1h-1zM4 22h1v1h-1zM5 22h1v1h-1zM6 22h1v1h-1zM7 22h1v1h-1zM8 22h1v1h-1zM9 22h1v1h-1zM10 22h1v1h-1zM11 22h1v1h-1zM12 22h1v1h-1zM14 22h1v1h-1zM15 22h1v1h-1zM16 22h1v1h-1zM18 22h1v1h-1zM20 22h1v1h-1zM25 22h1v1h-1zM27 22h1v1h-1zM30 22h1v1h-1zM31 22h1v1h-1zM4 23h1v1h-1zM5 23h1v1h-1zM7 23h1v1h-1zM8 23h1v1h-1zM9 23h1v1h-1zM10 23h1v1h-1zM13 23h1v1h-1zM14 23h1v1h-1zM20 23h1v1h-1zM24 23h1v1h-1zM26 23h1v1h-1zM27 23h1v1h-1zM28 23h1v1h-1zM30 23h1v1h-1zM31 23h1v1h-1zM32 23h1v1h-1zM0 24h1v1h-1zM1 24h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM5 24h1v1h-1zM6 24h1v1h-1zM9 24h1v1h-1zM11 24h1v1h-1zM13 24h1v1h-1zM17 24h1v1h-1zM19 24h1v1h-1zM22 24h1v1h-1zM24 24h1v1h-1zM25 24h1v1h-1zM26 24h1v1h-1zM27 24h1v1h-1zM28 24h1v1h-1zM29 24h1v1h-1zM31 24h1v1h-1zM10 25h1v1h-1zM11 25h1v1h-1zM15 25h1v1h-1zM16 25h1v1h-1zM20 25h1v1h-1zM22 25h1v1h-1zM24 25h1v1h-1zM28 25h1v1h-1zM29 25h1v1h-1zM32 25h1v1h-1zM0 26h1v1h-1zM1 26h1v1h-1zM2 26h1v1h-1zM3 26h1v1h-1zM4 26h1v1h-1zM5 26h1v1h-1zM6 26h1v1h-1zM8 26h1v1h-1zM10 26h1v1h-1zM11 26h1v1h-1zM13 26h1v1h-1zM15 26h1v1h-1zM19 26h1v1h-1zM20 26h1v1h-1zM22 26h1v1h-1zM23 26h1v1h-1zM24 26h1v1h-1zM26 26h1v1h-1zM28 26h1v1h-1zM29 26h1v1h-1zM30 26h1v1h-1zM31 26h1v1h-1zM0 27h1v1h-1zM6 27h1v1h-1zM12 27h1v1h-1zM13 27h1v1h-1zM14 27h1v1h-1zM15 27h1v1h-1zM17 27h1v1h-1zM18 27h1v1h-1zM24 27h1v1h-1zM28 27h1v1h-1zM0 28h1v1h-1zM2 28h1v1h-1zM3 28h1v1h-1zM4 28h1v1h-1zM6 28h1v1h-1zM8 28h1v1h-1zM12 28h1v1h-1zM14 28h1v1h-1zM15 28h1v1h-1zM16 28h1v1h-1zM17 28h1v1h-1zM18 28h1v1h-1zM20 28h1v1h-1zM21 28h1v1h-1zM22 28h1v1h-1zM23 28h1v1h-1zM24 28h1v1h-1zM25 28h1v1h-1zM26 28h1v1h-1zM27 28h1v1h-1zM28 28h1v1h-1zM30 28h1v1h-1zM32 28h1v1h-1zM0 29h1v1h-1zM2 29h1v1h-1zM3 29h1v1h-1zM4 29h1v1h-1zM6 29h1v1h-1zM13 29h1v1h-1zM15 29h1v1h-1zM17 29h1v1h-1zM18 29h1v1h-1zM19 29h1v1h-1zM20 29h1v1h-1zM23 29h1v1h-1zM24 29h1v1h-1zM26 29h1v1h-1zM27 29h1v1h-1zM28 29h1v1h-1zM31 29h1v1h-1zM0 30h1v1h-1zM2 30h1v1h-1zM3 30h1v1h-1zM4 30h1v1h-1zM6 30h1v1h-1zM9 30h1v1h-1zM12 30h1v1h-1zM17 30h1v1h-1zM21 30h1v1h-1zM22 30h1v1h-1zM27 30h1v1h-1zM29 30h1v1h-1zM31 30h1v1h-1zM32 30h1v1h-1zM0 31h1v1h-1zM6 31h1v1h-1zM8 31h1v1h-1zM10 31h1v1h-1zM12 31h1v1h-1zM13 31h1v1h-1zM15 31h1v1h-1zM18 31h1v1h-1zM20 31h1v1h-1zM21 31h1v1h-1zM26 31h1v1h-1zM27 31h1v1h-1zM31 31h1v1h-1zM32 31h1v1h-1zM0 32h1v1h-1zM1 32h1v1h-1zM2 32h1v1h-1zM3 32h1v1h-1zM4 32h1v1h-1zM5 32h1v1h-1zM6 32h1v1h-1zM8 32h1v1h-1zM11 32h1v1h-1zM13 32h1v1h-1zM14 32h1v1h-1zM18 32h1v1h-1zM19 32h1v1h-1zM21 32h1v1h-1zM24 32h1v1h-1zM25 32h1v1h-1zM28 32h1v1h-1zM32 32h1v1h-1z" />
                        </svg>
                      </div>
                    </div>

                    <div className="phone-meta">
                      <div className="phone-row">
                        <div className="phone-row-label">Ticket ID</div>
                        <div className="phone-row-value phone-row-value-accent">#PSL-PZV1</div>
                      </div>
                      <div className="phone-row">
                        <div className="phone-row-label">Owner</div>
                        <div className="phone-row-value">AWdW…yums</div>
                      </div>
                    </div>
                  </div>

                  <div className="phone-footer-mark">PASSLY.</div>
                </div>

                <div className="phone-home" />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="how-it-works">
          <div className="section-inner">
            <div className="section-label">
              <span className="hero-label-line" /> How it works
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">01</div>
                <div className="step-title">Create your event</div>
                <p className="step-desc">
                  Organizers set up an event on Passly in minutes. Name, date,
                  capacity, tier structure.
                </p>
              </div>
              <div className="step">
                <div className="step-num">02</div>
                <div className="step-title">Tickets mint on Solana</div>
                <p className="step-desc">
                  Each ticket becomes a unique compressed NFT.
                  Mathematically impossible to duplicate.
                </p>
              </div>
              <div className="step">
                <div className="step-num">03</div>
                <div className="step-title">Scan at the gate</div>
                <p className="step-desc">
                  Attendees show their QR. Staff scans. Blockchain confirms
                  in under a second. No fakes pass.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why Passly */}
        <section className="why-passly">
          <div className="section-inner">
            <div className="section-label">
              <span className="hero-label-line" /> Why Passly
            </div>
            <div className="why-grid">
              <div className="why-card">
                <div className="why-card-icon">◈</div>
                <div className="why-card-title">Unfakeable</div>
                <p className="why-card-desc">
                  Every ticket is a unique on-chain asset. No screenshots,
                  no copies, no fakes — ever.
                </p>
              </div>
              <div className="why-card">
                <div className="why-card-icon">⚡</div>
                <div className="why-card-title">Instant verification</div>
                <p className="why-card-desc">
                  Gate staff scan and confirm in under a second. No backend
                  calls to fake or intercept.
                </p>
              </div>
              <div className="why-card">
                <div className="why-card-icon">◎</div>
                <div className="why-card-title">No middlemen</div>
                <p className="why-card-desc">
                  Direct from organizer to attendee. No Ticketmaster tax.
                  No platform fees eating your margin.
                </p>
              </div>
              <div className="why-card">
                <div className="why-card-icon">∞</div>
                <div className="why-card-title">Permanent record</div>
                <p className="why-card-desc">
                  Your ticket lives on Solana forever. Proof of attendance,
                  verifiable by anyone, always.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Built on Solana */}
        <section className="solana-section">
          <div className="solana-inner">
            <div className="solana-symbol">◎</div>
            <p className="solana-text">
              Passly runs on Solana — the fastest, cheapest blockchain for
              real-world ticketing.
            </p>
            <div className="solana-stats">
              <span>Under $0.001 per ticket</span>
              <span className="solana-dot">·</span>
              <span>400ms finality</span>
              <span className="solana-dot">·</span>
              <span>100% on-chain</span>
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="cta-banner">
          <div className="cta-banner-inner">
            <h2 className="cta-banner-headline">
              Ready to sell tickets that can&rsquo;t be faked?
            </h2>
            <p className="cta-banner-sub">
              Join the waitlist or reach out directly.
            </p>
            <Link href="/dashboard" className="cta">
              Get Started
              <span className="cta-arrow">→</span>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-copy">© 2025 Passly</div>
          <div className="footer-tagline">Built on Solana</div>
        </footer>

      </div>
    </>
  );
}
