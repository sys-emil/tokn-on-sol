'use client';

import { useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
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

function truncate(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function Dashboard() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets } = useWallets();

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return null;

  const solanaWallet = wallets.find((w) => w.chainType === 'solana');
  const displayName = user?.email?.address ?? 'Organizer';

  return (
    <>
      <style>{`
        :root {
          --color-bg:         oklch(0.10 0.014 258);
          --color-surface:    oklch(0.14 0.014 258);
          --color-border:     oklch(0.22 0.016 258);
          --color-text:       oklch(0.96 0.008 95);
          --color-text-muted: oklch(0.48 0.012 250);
          --color-accent:     oklch(0.72 0.118 148);
          --color-accent-bg:  oklch(0.18 0.040 148);
        }

        html, body {
          margin: 0;
          padding: 0;
          background: var(--color-bg);
        }

        .dash-root {
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

        /* ── Nav ─────────────────────────────────────────────── */
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 20;
          padding: 0 48px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: oklch(0.10 0.014 258 / 0.88);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid var(--color-border);
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .logo {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--color-text);
        }

        .logo-dot { color: var(--color-accent); }

        .nav-divider {
          width: 1px;
          height: 18px;
          background: var(--color-border);
        }

        .nav-section {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .nav-email {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
          max-width: 240px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .btn-logout {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          background: transparent;
          border: 1px solid var(--color-border);
          padding: 8px 16px;
          cursor: pointer;
          transition: color 0.15s ease, border-color 0.15s ease;
        }

        .btn-logout:hover {
          color: var(--color-text);
          border-color: oklch(0.40 0.016 258);
        }

        /* ── Main ────────────────────────────────────────────── */
        .main {
          flex: 1;
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 108px 48px 96px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 48px;
        }

        .page-heading {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .page-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--color-accent);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .page-label-line {
          display: block;
          width: 24px;
          height: 1px;
          background: var(--color-accent);
          flex-shrink: 0;
        }

        .page-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 3.2vw, 42px);
          font-weight: 900;
          letter-spacing: -0.02em;
          line-height: 1.1;
          color: var(--color-text);
          margin: 0;
        }

        /* ── Cards grid ──────────────────────────────────────── */
        .cards {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1px;
          background: var(--color-border);
          border: 1px solid var(--color-border);
        }

        .card {
          background: var(--color-surface);
          padding: 32px 36px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-sizing: border-box;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .card-label {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .card-num {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          color: var(--color-accent);
        }

        /* ── My Events card ──────────────────────────────────── */
        .events-empty {
          border: 1px dashed var(--color-border);
          padding: 36px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          flex: 1;
        }

        .events-empty-text {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
          text-align: center;
          line-height: 1.6;
          margin: 0;
        }

        .btn-create {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 11px 22px;
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-accent);
          background: transparent;
          border: 1.5px solid var(--color-accent);
          cursor: pointer;
          transition: background 0.16s ease, color 0.16s ease;
        }

        .btn-create:hover {
          background: var(--color-accent);
          color: oklch(0.10 0.014 258);
        }

        /* ── Stat card (Tickets Issued) ──────────────────────── */
        .stat-value {
          font-family: var(--font-display);
          font-size: clamp(42px, 5vw, 64px);
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1;
          color: var(--color-text);
        }

        .stat-desc {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
          line-height: 1.6;
          margin: 0;
        }

        /* ── Wallet card ─────────────────────────────────────── */
        .wallet-address-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          flex: 1;
        }

        .wallet-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-accent);
          flex-shrink: 0;
        }

        .wallet-address {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: var(--color-text);
          word-break: break-all;
        }

        .wallet-none {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
          padding: 14px 0;
        }

        .wallet-chain {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          margin-top: auto;
        }

        /* ── Entrance animation ──────────────────────────────── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        .a1 { animation: fadeUp 0.50s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both; }
        .a2 { animation: fadeUp 0.50s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }

        @media (prefers-reduced-motion: reduce) {
          .a1, .a2 { animation: none; }
        }

        /* ── Responsive ──────────────────────────────────────── */
        @media (max-width: 900px) {
          .nav { padding: 0 24px; }

          .main { padding: 96px 24px 64px; }

          .cards { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className={`dash-root ${unbounded.variable} ${epilogue.variable}`}>

        {/* Nav */}
        <nav className="nav">
          <div className="nav-left">
            <div className="logo">Tokn<span className="logo-dot">.</span></div>
            <div className="nav-divider" />
            <div className="nav-section">Dashboard</div>
          </div>

          <div className="nav-right">
            <span className="nav-email">{displayName}</span>
            <button className="btn-logout" onClick={() => logout()}>
              Log out
            </button>
          </div>
        </nav>

        {/* Main */}
        <main className="main">

          {/* Heading */}
          <div className="page-heading a1">
            <div className="page-label">
              <span className="page-label-line" />
              Organizer
            </div>
            <h1 className="page-title">Your overview</h1>
          </div>

          {/* Cards */}
          <div className="cards a2">

            {/* My Events */}
            <div className="card">
              <div className="card-header">
                <div className="card-label">My Events</div>
                <div className="card-num">01</div>
              </div>
              <div className="events-empty">
                <p className="events-empty-text">
                  No events yet.<br />Create your first NFT-ticketed event.
                </p>
                <button className="btn-create">
                  + Create Event
                </button>
              </div>
            </div>

            {/* Tickets Issued */}
            <div className="card">
              <div className="card-header">
                <div className="card-label">Tickets Issued</div>
                <div className="card-num">02</div>
              </div>
              <div className="stat-value">0</div>
              <p className="stat-desc">
                NFTs minted and distributed<br />across all your events.
              </p>
            </div>

            {/* Wallet */}
            <div className="card">
              <div className="card-header">
                <div className="card-label">Wallet</div>
                <div className="card-num">03</div>
              </div>
              {solanaWallet ? (
                <div className="wallet-address-wrap">
                  <div className="wallet-dot" />
                  <div className="wallet-address">
                    {truncate(solanaWallet.address)}
                  </div>
                </div>
              ) : (
                <div className="wallet-none">No wallet connected.</div>
              )}
              <div className="wallet-chain">Solana</div>
            </div>

          </div>
        </main>

      </div>
    </>
  );
}
