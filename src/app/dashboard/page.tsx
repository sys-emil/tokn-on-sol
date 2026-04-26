'use client';

import { useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { Epilogue, Unbounded } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

function truncateLong(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

interface EventRow {
  name: string;
  date: string;
  count: number;
}

interface MintResult {
  assetId: string;
  signature: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [modalOpen, setModalOpen] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [ticketCount, setTicketCount] = useState(1);
  const [minting, setMinting] = useState(false);
  const [mintedSoFar, setMintedSoFar] = useState(0);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [ticketsIssued, setTicketsIssued] = useState(0);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return null;

  const solanaWallet = solanaWallets[0];
  const ownerWallet = solanaWallet?.address;
  const displayName = user?.email?.address ?? 'Organizer';

  function resetForm(): void {
    setEventName('');
    setEventDate('');
    setTicketCount(1);
    setMintedSoFar(0);
    setMintResult(null);
    setMintError(null);
  }

  function closeModal(): void {
    if (minting) return;
    setModalOpen(false);
    resetForm();
  }

  async function handleMint(): Promise<void> {
    if (!ownerWallet) {
      setMintError('No Solana wallet connected.');
      return;
    }
    const trimmedName = eventName.trim();
    if (!trimmedName || !eventDate) {
      setMintError('Event name and date are required.');
      return;
    }
    const count = Math.max(1, Math.min(500, Math.floor(ticketCount || 0)));
    if (count < 1) {
      setMintError('Number of tickets must be at least 1.');
      return;
    }

    setMintError(null);
    setMintResult(null);
    setMintedSoFar(0);
    setMinting(true);

    let lastResult: MintResult | null = null;
    try {
      for (let i = 0; i < count; i++) {
        const res = await fetch('/api/tickets/mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName: trimmedName,
            eventDate,
            ownerWallet,
          }),
        });
        const data = (await res.json()) as
          | { success: true; assetId: string; signature: string }
          | { success: false; error: string };
        if (!res.ok || !data.success) {
          const message = !data.success ? data.error : `HTTP ${res.status}`;
          throw new Error(message);
        }
        lastResult = { assetId: data.assetId, signature: data.signature };
        setMintedSoFar(i + 1);
        setTicketsIssued((n) => n + 1);
      }

      if (lastResult) {
        setMintResult(lastResult);
        setEvents((prev) => [
          ...prev,
          { name: trimmedName, date: eventDate, count },
        ]);
        setTimeout(() => {
          setModalOpen(false);
          resetForm();
        }, 1500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mint failed.';
      setMintError(message);
    } finally {
      setMinting(false);
    }
  }

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

        /* ── Event rows ──────────────────────────────────────── */
        .events-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: var(--color-border);
          border: 1px solid var(--color-border);
          flex: 1;
        }

        .event-row {
          background: var(--color-bg);
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text);
          line-height: 1.4;
        }

        .event-row-dot {
          width: 6px;
          height: 6px;
          background: var(--color-accent);
          flex-shrink: 0;
        }

        .event-row-name {
          font-family: var(--font-display);
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--color-text);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .event-row-meta {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-text-muted);
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        .events-list-footer {
          display: flex;
          justify-content: flex-end;
        }

        /* ── Modal ───────────────────────────────────────────── */
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes modalIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          background: oklch(0.10 0.014 258 / 0.80);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          animation: overlayIn 0.20s ease both;
        }

        .modal-surface {
          width: 100%;
          max-width: 460px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          padding: 36px;
          display: flex;
          flex-direction: column;
          gap: 28px;
          box-sizing: border-box;
          animation: modalIn 0.30s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .modal-header {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .modal-eyebrow {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-accent);
        }

        .modal-title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: var(--color-text);
          margin: 0;
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field-label {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .field-input {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: 0;
          padding: 12px 16px;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.15s ease;
          -webkit-appearance: none;
          appearance: none;
        }

        .field-input:focus {
          border-color: var(--color-accent);
        }

        .field-input:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .field-input::placeholder {
          color: var(--color-text-muted);
        }

        /* Force the date picker indicator to render in light mode against our dark bg */
        .field-input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.9);
          cursor: pointer;
        }

        .modal-status {
          font-family: var(--font-body);
          font-size: 13px;
          line-height: 1.5;
          padding: 14px 16px;
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .modal-status-dot {
          width: 6px;
          height: 6px;
          flex-shrink: 0;
          margin-top: 6px;
        }

        .modal-status-dot.error { background: oklch(0.62 0.18 28); }
        .modal-status-dot.success { background: var(--color-accent); }
        .modal-status-dot.progress { background: var(--color-text-muted); }

        .modal-status-text {
          flex: 1;
          color: var(--color-text);
        }

        .modal-status-meta {
          display: block;
          margin-top: 6px;
          font-family: var(--font-display);
          font-size: 11px;
          letter-spacing: 0.10em;
          color: var(--color-text-muted);
          word-break: break-all;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-create:disabled,
        .btn-logout:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Responsive ──────────────────────────────────────── */
        @media (max-width: 900px) {
          .nav { padding: 0 24px; }

          .main { padding: 96px 24px 64px; }

          .cards { grid-template-columns: 1fr; }
        }

        @media (max-width: 520px) {
          .modal-surface { padding: 28px 24px; }
          .modal-actions { flex-direction: column-reverse; }
          .modal-actions .btn-create,
          .modal-actions .btn-logout { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className={`dash-root ${unbounded.variable} ${epilogue.variable}`}>

        {/* Nav */}
        <nav className="nav">
          <div className="nav-left">
            <div className="logo">Passly<span className="logo-dot">.</span></div>
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
              {events.length === 0 ? (
                <div className="events-empty">
                  <p className="events-empty-text">
                    No events yet.<br />Create your first NFT-ticketed event.
                  </p>
                  <button
                    className="btn-create"
                    onClick={() => setModalOpen(true)}
                  >
                    + Create Event
                  </button>
                </div>
              ) : (
                <>
                  <div className="events-list">
                    {events.map((evt, i) => (
                      <div className="event-row" key={`${evt.name}-${i}`}>
                        <div className="event-row-dot" />
                        <div className="event-row-name">{evt.name}</div>
                        <div className="event-row-meta">{evt.date}</div>
                        <div className="event-row-meta">{evt.count} tickets</div>
                      </div>
                    ))}
                  </div>
                  <div className="events-list-footer">
                    <button
                      className="btn-create"
                      onClick={() => setModalOpen(true)}
                    >
                      + Create Event
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Tickets Issued */}
            <div className="card">
              <div className="card-header">
                <div className="card-label">Tickets Issued</div>
                <div className="card-num">02</div>
              </div>
              <div className="stat-value">{ticketsIssued}</div>
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

        {modalOpen && (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div className="modal-surface">
              <div className="modal-header">
                <div className="modal-eyebrow">New Event</div>
                <h2 className="modal-title" id="modal-title">
                  Create event &amp; mint tickets
                </h2>
              </div>

              <form
                className="modal-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleMint();
                }}
              >
                <div className="field">
                  <label className="field-label" htmlFor="evt-name">Event Name</label>
                  <input
                    id="evt-name"
                    type="text"
                    className="field-input"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    required
                    disabled={minting}
                    placeholder="Passly Launch Night"
                    maxLength={120}
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="evt-date">Event Date</label>
                  <input
                    id="evt-date"
                    type="date"
                    className="field-input"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                    disabled={minting}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="evt-count">Number of Tickets</label>
                  <input
                    id="evt-count"
                    type="number"
                    className="field-input"
                    value={ticketCount}
                    onChange={(e) => setTicketCount(Number(e.target.value))}
                    min={1}
                    max={500}
                    required
                    disabled={minting}
                  />
                </div>

                {mintError && (
                  <div className="modal-status">
                    <div className="modal-status-dot error" />
                    <div className="modal-status-text">{mintError}</div>
                  </div>
                )}

                {minting && !mintError && (
                  <div className="modal-status">
                    <div className="modal-status-dot progress" />
                    <div className="modal-status-text">
                      Minting {Math.min(mintedSoFar + 1, ticketCount)} of {ticketCount}...
                    </div>
                  </div>
                )}

                {!minting && mintResult && !mintError && (
                  <div className="modal-status">
                    <div className="modal-status-dot success" />
                    <div className="modal-status-text">
                      {mintedSoFar} ticket{mintedSoFar === 1 ? '' : 's'} minted successfully.
                      <span className="modal-status-meta">
                        {truncateLong(mintResult.assetId)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-logout"
                    onClick={closeModal}
                    disabled={minting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-create"
                    disabled={minting || !ownerWallet}
                  >
                    {minting ? 'Minting...' : '+ Mint Tickets'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
