'use client';

import { useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { Epilogue, Unbounded } from 'next/font/google';
import Link from 'next/link';
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

interface Ticket {
  assetId: string;
  eventName: string;
  eventDate: string;
  purchasedAt: string;
  eventId: string;
}

interface PublicEvent {
  id: string;
  name: string;
  date: string;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function MyTickets() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<PublicEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const buyerWallet = solanaWallets[0]?.address;

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!buyerWallet || ticketsLoaded) return;
    async function loadTickets(): Promise<void> {
      try {
        const res = await fetch(`/api/my-tickets?buyerWallet=${buyerWallet}`);
        if (res.ok) {
          const data = (await res.json()) as { tickets: Ticket[] };
          setTickets(data.tickets);
        }
      } finally {
        setTicketsLoaded(true);
      }
    }
    void loadTickets();
  }, [buyerWallet, ticketsLoaded]);

  useEffect(() => {
    async function loadEvents(): Promise<void> {
      try {
        const res = await fetch('/api/events/public');
        if (res.ok) {
          const data = (await res.json()) as { events: PublicEvent[] };
          setUpcomingEvents(data.events);
        }
      } finally {
        setEventsLoaded(true);
      }
    }
    void loadEvents();
  }, []);

  if (!ready || !authenticated) return null;

  const loadingTickets = !!buyerWallet && !ticketsLoaded;

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
        }

        html, body {
          margin: 0;
          padding: 0;
          background: var(--color-bg);
        }

        .page-root {
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
          top: 0; left: 0; right: 0;
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
          text-decoration: none;
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
          gap: 12px;
        }

        .btn-nav {
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
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: color 0.15s ease, border-color 0.15s ease;
        }

        .btn-nav:hover {
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
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: var(--color-border);
          border: 1px solid var(--color-border);
          align-items: start;
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

        /* ── Rows ────────────────────────────────────────────── */
        .rows-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: var(--color-border);
          border: 1px solid var(--color-border);
        }

        .row {
          background: var(--color-bg);
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text);
        }

        .row-name {
          font-family: var(--font-display);
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--color-text);
          line-height: 1.3;
        }

        .row-bottom {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .row-meta {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-text-muted);
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        /* ── Row action buttons ──────────────────────────────── */
        .btn-row {
          font-family: var(--font-display);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 5px 10px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .btn-row-primary {
          color: oklch(0.10 0.014 258);
          background: var(--color-accent);
          border: 1px solid var(--color-accent);
        }

        .btn-row-primary:hover {
          background: oklch(0.80 0.118 148);
          border-color: oklch(0.80 0.118 148);
        }

        .btn-row-ghost {
          color: var(--color-text-muted);
          background: transparent;
          border: 1px solid var(--color-border);
        }

        .btn-row-ghost:hover {
          color: var(--color-text);
          border-color: oklch(0.40 0.016 258);
        }

        /* ── Empty / loading states ──────────────────────────── */
        .empty {
          border: 1px dashed var(--color-border);
          padding: 36px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .empty-text {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
          text-align: center;
          line-height: 1.6;
          margin: 0;
        }

        /* ── Animations ──────────────────────────────────────── */
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

      <div className={`page-root ${unbounded.variable} ${epilogue.variable}`}>

        <nav className="nav">
          <div className="nav-left">
            <Link href="/" className="logo">Passly<span className="logo-dot">.</span></Link>
            <div className="nav-divider" />
            <div className="nav-section">My Tickets</div>
          </div>
          <div className="nav-right">
            <Link href="/dashboard" className="btn-nav" style={{ textDecoration: 'none' }}>Organizer Dashboard</Link>
            <button className="btn-nav" onClick={() => logout()}>Log out</button>
          </div>
        </nav>

        <main className="main">

          <div className="page-heading a1">
            <div className="page-label">
              <span className="page-label-line" />
              Account
            </div>
            <h1 className="page-title">Your tickets</h1>
          </div>

          <div className="cards a2">

            {/* My Tickets */}
            <div className="card">
              <div className="card-header">
                <div className="card-label">My Tickets</div>
                <div className="card-num">01</div>
              </div>
              {loadingTickets ? (
                <div className="empty">
                  <p className="empty-text">Loading tickets…</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="empty">
                  <p className="empty-text">No tickets yet.</p>
                </div>
              ) : (
                <div className="rows-list">
                  {tickets.map((t) => (
                    <div className="row" key={t.assetId}>
                      <div className="row-name">{t.eventName}</div>
                      <div className="row-bottom">
                        <div className="row-meta">{formatDate(t.eventDate)}</div>
                        <Link href={`/tickets/${t.assetId}`} className="btn-row btn-row-primary">
                          View Ticket
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Events */}
            <div className="card">
              <div className="card-header">
                <div className="card-label">Upcoming Events</div>
                <div className="card-num">02</div>
              </div>
              {!eventsLoaded ? (
                <div className="empty">
                  <p className="empty-text">Loading events…</p>
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="empty">
                  <p className="empty-text">No upcoming events.</p>
                </div>
              ) : (
                <div className="rows-list">
                  {upcomingEvents.map((evt) => (
                    <div className="row" key={evt.id}>
                      <div className="row-name">{evt.name}</div>
                      <div className="row-bottom">
                        <div className="row-meta">{formatDate(evt.date)}</div>
                        <div className="row-meta">{formatPrice(evt.price_eur)}</div>
                        <Link href={`/shop/${evt.id}`} className="btn-row btn-row-ghost">
                          Get Ticket
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </main>

      </div>
    </>
  );
}
