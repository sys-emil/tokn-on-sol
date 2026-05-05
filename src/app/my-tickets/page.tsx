'use client';

import { useLogout, usePrivy, getAccessToken } from '@privy-io/react-auth';
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
  redeemedAt: string | null;
  claimUrl: string | null;
}

function formatDateLong(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(iso + 'T00:00:00');
  return Math.ceil((event.getTime() - today.getTime()) / 86400000);
}

function isUpcoming(iso: string): boolean {
  return daysUntil(iso) >= 0;
}

const CSS = `
  :root {
    --color-bg:         oklch(0.10 0.014 258);
    --color-surface:    oklch(0.14 0.014 258);
    --color-border:     oklch(0.22 0.016 258);
    --color-text:       oklch(0.96 0.008 95);
    --color-text-muted: oklch(0.48 0.012 250);
    --color-accent:     oklch(0.72 0.118 148);
    --color-accent-dim: oklch(0.18 0.04 148);
    --color-missed:     oklch(0.55 0.10 40);
    --color-missed-dim: oklch(0.16 0.04 40);
  }

  html, body { margin: 0; padding: 0; background: var(--color-bg); }

  .page-root {
    font-family: var(--font-body);
    background-color: var(--color-bg);
    background-image: radial-gradient(circle, oklch(0.23 0.014 258 / 0.45) 1px, transparent 1px);
    background-size: 28px 28px;
    color: var(--color-text);
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  /* ── Nav ─────────────────────────────────────────────────── */
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

  .nav-left { display: flex; align-items: center; gap: 32px; }

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

  .nav-divider { width: 1px; height: 18px; background: var(--color-border); }

  .nav-section {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .nav-right { display: flex; align-items: center; gap: 12px; }

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

  .btn-nav:hover { color: var(--color-text); border-color: oklch(0.40 0.016 258); }

  /* ── Layout ──────────────────────────────────────────────── */
  .main {
    flex: 1;
    max-width: 760px;
    width: 100%;
    margin: 0 auto;
    padding: 108px 48px 96px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 64px;
  }

  /* ── Page heading ────────────────────────────────────────── */
  .page-heading { display: flex; flex-direction: column; gap: 6px; }

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

  /* ── Section ─────────────────────────────────────────────── */
  .section { display: flex; flex-direction: column; gap: 20px; }

  .section-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.20em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .section-count {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: var(--color-accent);
  }

  /* ── Upcoming cards ──────────────────────────────────────── */
  .upcoming-list { display: flex; flex-direction: column; gap: 1px; }

  .upcoming-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: 24px 28px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-sizing: border-box;
    transition: border-color 0.2s ease;
  }

  .upcoming-card:hover { border-color: oklch(0.35 0.016 258); }

  .upcoming-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }

  .upcoming-event-name {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 900;
    letter-spacing: -0.01em;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .upcoming-event-date {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .upcoming-card-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    flex-shrink: 0;
  }

  .days-badge {
    font-family: var(--font-display);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 4px 8px;
    background: var(--color-accent-dim, oklch(0.18 0.04 148));
    color: var(--color-accent);
    white-space: nowrap;
  }

  .days-badge.urgent {
    background: oklch(0.72 0.118 148 / 0.2);
    color: var(--color-accent);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.65; }
  }

  @media (prefers-reduced-motion: reduce) { .days-badge.urgent { animation: none; } }

  .upcoming-actions { display: flex; gap: 6px; align-items: center; }

  /* ── History timeline ────────────────────────────────────── */
  .timeline { display: flex; flex-direction: column; gap: 28px; }

  .year-group { display: flex; flex-direction: column; gap: 1px; }

  .year-label {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--color-text-muted);
    padding-bottom: 10px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 1px;
  }

  .history-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid oklch(0.22 0.016 258 / 0.5);
  }

  .history-row:last-child { border-bottom: none; }

  .history-date {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    min-width: 52px;
    flex-shrink: 0;
  }

  .history-name {
    flex: 1;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--color-text);
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-badge {
    font-family: var(--font-display);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 3px 7px;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .status-attended {
    background: var(--color-accent-dim, oklch(0.18 0.04 148));
    color: var(--color-accent);
  }

  .status-missed {
    background: var(--color-missed-dim);
    color: var(--color-missed);
  }

  .history-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }

  /* ── Buttons ─────────────────────────────────────────────── */
  .btn {
    font-family: var(--font-display);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 7px 12px;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    transition: opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .btn-primary {
    color: oklch(0.10 0.014 258);
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
  }

  .btn-primary:hover { opacity: 0.85; }

  .btn-ghost {
    color: var(--color-text-muted);
    background: transparent;
    border: 1px solid var(--color-border);
  }

  .btn-ghost:hover { color: var(--color-text); border-color: oklch(0.40 0.016 258); }

  .btn-ghost:disabled { opacity: 0.4; cursor: default; }

  /* ── Empty state ─────────────────────────────────────────── */
  .empty {
    border: 1px dashed var(--color-border);
    padding: 32px 24px;
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

  /* ── Modal ───────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: oklch(0.05 0.01 258 / 0.80);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .modal {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: 28px 28px 24px;
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 900;
    letter-spacing: -0.01em;
    color: var(--color-text);
    margin: 0;
  }

  .modal-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .modal-url {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    padding: 10px 12px;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--color-text-muted);
    word-break: break-all;
    line-height: 1.5;
  }

  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

  /* ── Animations ──────────────────────────────────────────── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .a1 { animation: fadeUp 0.50s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both; }
  .a2 { animation: fadeUp 0.50s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
  .a3 { animation: fadeUp 0.50s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both; }

  @media (prefers-reduced-motion: reduce) { .a1, .a2, .a3 { animation: none; } }

  /* ── Responsive ──────────────────────────────────────────── */
  @media (max-width: 640px) {
    .nav { padding: 0 20px; }
    .main { padding: 96px 20px 64px; }
    .upcoming-card { padding: 18px 20px; flex-direction: column; align-items: flex-start; gap: 14px; }
    .upcoming-card-right { flex-direction: row; align-items: center; width: 100%; justify-content: space-between; }
    .history-name { font-size: 13px; }
  }
`;

export default function MyTickets() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [shareModal, setShareModal] = useState<{ assetId: string; url: string } | null>(null);
  const [sharingAssetId, setSharingAssetId] = useState<string | null>(null);
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  const buyerWallet = solanaWallets[0]?.address;

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!buyerWallet || ticketsLoaded) return;
    async function load() {
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
    void load();
  }, [buyerWallet, ticketsLoaded]);

  async function handleShare(assetId: string, existingClaimUrl: string | null) {
    if (existingClaimUrl) { setShareModal({ assetId, url: existingClaimUrl }); return; }
    setSharingAssetId(assetId);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/claims/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ assetId }),
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) {
        setTickets((prev) => prev.map((t) => t.assetId === assetId ? { ...t, claimUrl: data.url! } : t));
        setShareModal({ assetId, url: data.url });
      } else if (data.error === 'not_delegated') {
        alert('This ticket was purchased before sharing was supported and cannot be shared.');
      } else {
        alert(data.error ?? 'Failed to create share link.');
      }
    } finally {
      setSharingAssetId(null);
    }
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopyConfirmed(true);
    setTimeout(() => setCopyConfirmed(false), 2000);
  }

  if (!ready || !authenticated) return null;

  const loading = !!buyerWallet && !ticketsLoaded;

  // Split tickets into upcoming and past based on event date
  const upcoming = tickets.filter((t) => isUpcoming(t.eventDate));
  const past = tickets.filter((t) => !isUpcoming(t.eventDate));

  // Group past tickets by year, newest year first
  const byYear = new Map<number, Ticket[]>();
  for (const t of past) {
    const year = Number(t.eventDate.split('-')[0]);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(t);
  }
  const sortedYears = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <>
      <style>{CSS}</style>
      <div className={`page-root ${unbounded.variable} ${epilogue.variable}`}>

        <nav className="nav">
          <div className="nav-left">
            <Link href="/" className="logo">Passly<span className="logo-dot">.</span></Link>
            <div className="nav-divider" />
            <div className="nav-section">My Tickets</div>
          </div>
          <div className="nav-right">
            <Link href="/dashboard" className="btn-nav">Organizer Dashboard</Link>
            <button className="btn-nav" onClick={() => logout()}>Log out</button>
          </div>
        </nav>

        <main className="main">

          <div className="page-heading a1">
            <div className="page-label">
              <span className="page-label-line" />
              Account
            </div>
            <h1 className="page-title">My Tickets</h1>
          </div>

          {/* ── Upcoming ──────────────────────────────────────── */}
          <div className="section a2">
            <div className="section-header">
              <div className="section-title">Upcoming</div>
              {upcoming.length > 0 && (
                <div className="section-count">{upcoming.length}</div>
              )}
            </div>

            {loading ? (
              <div className="empty"><p className="empty-text">Loading…</p></div>
            ) : upcoming.length === 0 ? (
              <div className="empty">
                <p className="empty-text">
                  No upcoming tickets.{' '}
                  <Link href="/" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
                    Browse events →
                  </Link>
                </p>
              </div>
            ) : (
              <div className="upcoming-list">
                {upcoming.map((t) => {
                  const days = daysUntil(t.eventDate);
                  const daysLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
                  return (
                    <div className="upcoming-card" key={t.assetId}>
                      <div className="upcoming-card-body">
                        <div className="upcoming-event-name">{t.eventName}</div>
                        <div className="upcoming-event-date">{formatDateLong(t.eventDate)}</div>
                      </div>
                      <div className="upcoming-card-right">
                        <div className={`days-badge${days <= 7 ? ' urgent' : ''}`}>{daysLabel}</div>
                        <div className="upcoming-actions">
                          <Link href={`/tickets/${t.assetId}`} className="btn btn-primary">
                            View Ticket
                          </Link>
                          <button
                            className="btn btn-ghost"
                            onClick={() => void handleShare(t.assetId, t.claimUrl)}
                            disabled={sharingAssetId === t.assetId}
                          >
                            {sharingAssetId === t.assetId ? '…' : t.claimUrl ? 'Copy Link' : 'Share'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── History ───────────────────────────────────────── */}
          <div className="section a3">
            <div className="section-header">
              <div className="section-title">History</div>
              {past.length > 0 && (
                <div className="section-count">{past.length}</div>
              )}
            </div>

            {loading ? (
              <div className="empty"><p className="empty-text">Loading…</p></div>
            ) : past.length === 0 ? (
              <div className="empty">
                <p className="empty-text">Events you attend will appear here.</p>
              </div>
            ) : (
              <div className="timeline">
                {sortedYears.map((year) => (
                  <div className="year-group" key={year}>
                    <div className="year-label">{year}</div>
                    {byYear.get(year)!.map((t) => (
                      <div className="history-row" key={t.assetId}>
                        <div className="history-date">{formatDateShort(t.eventDate)}</div>
                        <div className="history-name">{t.eventName}</div>
                        <div
                          className={`status-badge ${t.redeemedAt ? 'status-attended' : 'status-missed'}`}
                        >
                          {t.redeemedAt ? 'Attended' : 'Missed'}
                        </div>
                        <div className="history-actions">
                          <Link href={`/tickets/${t.assetId}`} className="btn btn-ghost">
                            View
                          </Link>
                          <button
                            className="btn btn-ghost"
                            onClick={() => void handleShare(t.assetId, t.claimUrl)}
                            disabled={sharingAssetId === t.assetId}
                          >
                            {sharingAssetId === t.assetId ? '…' : t.claimUrl ? 'Copy Link' : 'Share'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

        </main>
      </div>

      {shareModal && (
        <div className="modal-backdrop" onClick={() => setShareModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Share ticket link</h2>
            <p className="modal-body">
              Send this link to a friend or buyer. Once claimed, the ticket moves to their wallet and this link becomes invalid.
            </p>
            <div className="modal-url">{shareModal.url}</div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShareModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => void handleCopy(shareModal.url)}>
                {copyConfirmed ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
