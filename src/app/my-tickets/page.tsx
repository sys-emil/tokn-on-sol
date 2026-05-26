'use client';

import { useLogout, usePrivy, getAccessToken } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { Epilogue, Unbounded } from 'next/font/google';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PasslyLogo } from '@/app/components/PasslyLogo';

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

interface BadgeItem {
  badgeType: string;
  assetId: string | null;
  earnedAt: string;
}

const BADGE_DISPLAY: Record<string, { name: string; symbol: string; hue: number }> = {
  first_show:      { name: 'First Show',  symbol: 'I',  hue: 48  },
  show_5:          { name: '5 Shows',     symbol: 'V',  hue: 150 },
  show_10:         { name: '10 Shows',    symbol: 'X',  hue: 220 },
  loyal_organizer: { name: 'Loyal Fan',   symbol: '♥',  hue: 340 },
};

function eventHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function formatDateShort(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const event = new Date(iso + 'T00:00:00');
  return Math.ceil((event.getTime() - today.getTime()) / 86400000);
}

function isUpcoming(iso: string): boolean { return daysUntil(iso) >= 0; }

const CSS = `
  :root {
    --color-bg:          oklch(0.09 0.028 305);
    --color-surface:     oklch(0.15 0.024 308);
    --color-border:      oklch(0.26 0.022 305);
    --color-text:        oklch(0.96 0.008 75);
    --color-text-muted:  oklch(0.56 0.012 305);
    --color-accent:      oklch(0.79 0.19 48);
    --color-accent-dim:  oklch(0.18 0.048 48);
  }
  html, body { margin: 0; padding: 0; background: var(--color-bg); }

  .page-root {
    font-family: var(--font-body);
    background-color: var(--color-bg);
    background-image: radial-gradient(circle, oklch(0.28 0.026 308 / 0.38) 1px, transparent 1px);
    background-size: 28px 28px;
    color: var(--color-text);
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  /* Nav */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 20;
    padding: 0 48px; height: 68px;
    display: flex; align-items: center; justify-content: space-between;
    background: oklch(0.09 0.028 305 / 0.88);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--color-border);
  }
  .nav-left  { display: flex; align-items: center; gap: 32px; }
  .nav-right { display: flex; align-items: center; gap: 12px; }
  .nav-divider { width: 1px; height: 18px; background: var(--color-border); }
  .nav-section {
    font-family: var(--font-body); font-size: 11px; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-text-muted);
  }
  .btn-nav {
    font-family: var(--font-display); font-size: 10px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--color-text-muted); background: transparent;
    border: 1px solid var(--color-border); padding: 8px 16px;
    cursor: pointer; text-decoration: none;
    display: inline-flex; align-items: center;
    transition: color 0.15s, border-color 0.15s;
  }
  .btn-nav:hover { color: var(--color-text); border-color: oklch(0.42 0.022 305); }

  /* Layout */
  .main {
    flex: 1; max-width: 860px; width: 100%; margin: 0 auto;
    padding: 108px 48px 96px; box-sizing: border-box;
    display: flex; flex-direction: column; gap: 64px;
  }

  /* Page heading */
  .page-heading { display: flex; flex-direction: column; gap: 6px; }
  .page-label {
    font-family: var(--font-body); font-size: 11px; font-weight: 500;
    letter-spacing: 0.20em; text-transform: uppercase; color: var(--color-accent);
    display: flex; align-items: center; gap: 10px;
  }
  .page-label-line { display: block; width: 24px; height: 1px; background: var(--color-accent); flex-shrink: 0; }
  .page-title {
    font-family: var(--font-display); font-size: clamp(28px, 3.2vw, 42px);
    font-weight: 900; letter-spacing: -0.02em; line-height: 1.1;
    color: var(--color-text); margin: 0;
  }
  .page-sub {
    font-family: var(--font-body); font-size: 13px; color: var(--color-text-muted);
    margin: 8px 0 0; line-height: 1.5;
  }

  /* Section */
  .section { display: flex; flex-direction: column; gap: 20px; }
  .section-header { display: flex; align-items: baseline; gap: 10px; }
  .section-title {
    font-family: var(--font-display); font-size: 10px; font-weight: 600;
    letter-spacing: 0.20em; text-transform: uppercase; color: var(--color-text-muted);
  }
  .section-count {
    font-family: var(--font-display); font-size: 10px; font-weight: 600;
    letter-spacing: 0.12em; color: var(--color-accent);
  }

  /* Card grid */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  /* Ticket card */
  .ticket-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    display: flex; flex-direction: column;
    position: relative; overflow: hidden;
    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    text-decoration: none; color: inherit;
  }
  .ticket-card:hover { transform: translateY(-2px); }

  .ticket-card.card-upcoming {
    border-color: oklch(0.79 0.19 48 / 0.45);
    animation: cardGlow 3.5s ease-in-out infinite;
  }
  @keyframes cardGlow {
    0%,100% { box-shadow: 0 0 0 1px oklch(0.79 0.19 48 / 0.12), 0 0 18px oklch(0.79 0.19 48 / 0.06); }
    50%     { box-shadow: 0 0 0 1px oklch(0.79 0.19 48 / 0.30), 0 0 28px oklch(0.79 0.19 48 / 0.14); }
  }
  @media (prefers-reduced-motion: reduce) { .ticket-card.card-upcoming { animation: none; } }

  .ticket-card.card-missed { opacity: 0.55; }
  .ticket-card.card-missed:hover { opacity: 0.75; }

  /* Art area */
  .card-art {
    height: 140px; position: relative; overflow: hidden;
    flex-shrink: 0;
  }
  .card-art-bg {
    position: absolute; inset: 0;
  }
  .card-art-noise {
    position: absolute; inset: 0;
    background-image: radial-gradient(circle, oklch(1 0 0 / 0.04) 1px, transparent 1px);
    background-size: 14px 14px;
  }

  /* Attended stamp */
  .card-stamp {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .card-stamp-text {
    font-family: var(--font-display); font-size: 11px; font-weight: 900;
    letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--color-accent);
    border: 2px solid var(--color-accent);
    padding: 5px 10px;
    transform: rotate(-18deg);
    opacity: 0.88;
    box-shadow: 0 0 16px oklch(0.79 0.19 48 / 0.35), inset 0 0 16px oklch(0.79 0.19 48 / 0.06);
  }
  .card-stamp-text.missed-stamp {
    color: oklch(0.65 0.08 32);
    border-color: oklch(0.65 0.08 32);
    box-shadow: none;
  }

  /* Days badge for upcoming */
  .card-days {
    position: absolute; top: 10px; right: 10px;
    font-family: var(--font-display); font-size: 8px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    background: oklch(0.09 0.028 305 / 0.75);
    color: var(--color-accent); padding: 3px 7px;
    border: 1px solid oklch(0.79 0.19 48 / 0.4);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  }

  /* Card info */
  .card-info {
    padding: 12px 14px;
    display: flex; flex-direction: column; gap: 3px;
    border-top: 1px solid var(--color-border);
    flex: 1;
  }
  .card-name {
    font-family: var(--font-display); font-size: 11px; font-weight: 900;
    letter-spacing: -0.01em; color: var(--color-text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .card-date {
    font-family: var(--font-body); font-size: 10px; color: var(--color-text-muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .card-footer {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 8px;
  }
  .card-status {
    font-family: var(--font-display); font-size: 8px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    padding: 2px 6px;
  }
  .status-upcoming  { background: var(--color-accent-dim, oklch(0.18 0.04 48)); color: var(--color-accent); }
  .status-attended  { background: oklch(0.16 0.04 150); color: oklch(0.72 0.18 150); }
  .status-missed    { background: oklch(0.16 0.04 32);  color: oklch(0.65 0.10 32); }
  .card-share {
    font-family: var(--font-display); font-size: 8px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--color-text-muted); background: transparent;
    border: none; padding: 2px 0; cursor: pointer;
    transition: color 0.15s;
  }
  .card-share:hover { color: var(--color-text); }
  .card-share:disabled { opacity: 0.4; cursor: default; }

  /* Badge cards */
  .badge-grid {
    display: flex; flex-wrap: wrap; gap: 10px;
  }
  .badge-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    width: 110px; padding: 16px 12px 14px;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    box-sizing: border-box;
  }
  .badge-symbol {
    font-family: var(--font-display); font-size: 22px; font-weight: 900;
    line-height: 1;
  }
  .badge-name {
    font-family: var(--font-display); font-size: 8px; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--color-text); text-align: center;
  }
  .badge-date {
    font-family: var(--font-body); font-size: 9px; color: var(--color-text-muted);
    text-align: center;
  }

  /* Empty */
  .empty {
    border: 1px dashed var(--color-border); padding: 28px 24px;
    display: flex; align-items: center; justify-content: center;
  }
  .empty-text {
    font-family: var(--font-body); font-size: 13px; color: var(--color-text-muted);
    text-align: center; line-height: 1.6; margin: 0;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed; inset: 0;
    background: oklch(0.05 0.015 305 / 0.85);
    backdrop-filter: blur(4px); z-index: 100;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .modal {
    background: var(--color-surface); border: 1px solid var(--color-border);
    padding: 28px 28px 24px; width: 100%; max-width: 420px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .modal-title {
    font-family: var(--font-display); font-size: 14px; font-weight: 900;
    letter-spacing: -0.01em; color: var(--color-text); margin: 0;
  }
  .modal-body {
    font-family: var(--font-body); font-size: 13px;
    color: var(--color-text-muted); line-height: 1.6; margin: 0;
  }
  .modal-url {
    background: var(--color-bg); border: 1px solid var(--color-border);
    padding: 10px 12px; font-family: var(--font-body); font-size: 12px;
    color: var(--color-text-muted); word-break: break-all; line-height: 1.5;
  }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .btn {
    font-family: var(--font-display); font-size: 9px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    padding: 7px 12px; cursor: pointer; text-decoration: none;
    display: inline-flex; align-items: center; white-space: nowrap;
    transition: opacity 0.15s, background 0.15s, border-color 0.15s, color 0.15s;
  }
  .btn-primary { color: oklch(0.09 0.028 305); background: var(--color-accent); border: 1px solid var(--color-accent); }
  .btn-primary:hover { opacity: 0.85; }
  .btn-ghost { color: var(--color-text-muted); background: transparent; border: 1px solid var(--color-border); }
  .btn-ghost:hover { color: var(--color-text); border-color: oklch(0.42 0.022 305); }

  /* Animations */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .a1 { animation: fadeUp 0.50s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
  .a2 { animation: fadeUp 0.50s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
  .a3 { animation: fadeUp 0.50s cubic-bezier(0.16,1,0.3,1) 0.25s both; }
  .a4 { animation: fadeUp 0.50s cubic-bezier(0.16,1,0.3,1) 0.35s both; }
  @media (prefers-reduced-motion: reduce) { .a1,.a2,.a3,.a4 { animation: none; } }

  /* Public shelf link */
  .shelf-link {
    font-family: var(--font-body); font-size: 12px; color: var(--color-text-muted);
    text-decoration: none; border-bottom: 1px solid var(--color-border);
    padding-bottom: 1px; transition: color 0.15s, border-color 0.15s;
  }
  .shelf-link:hover { color: var(--color-text); border-color: var(--color-text-muted); }

  /* Responsive */
  @media (max-width: 640px) {
    .nav { padding: 0 20px; }
    .main { padding: 96px 20px 64px; }
    .card-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .badge-card { width: calc(50% - 5px); }
  }
`;

export default function MyTickets() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [shareModal, setShareModal] = useState<{ assetId: string; url: string } | null>(null);
  const [sharingAssetId, setSharingAssetId] = useState<string | null>(null);
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  const buyerWallet = solanaWallets[0]?.address;

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!buyerWallet || loaded) return;
    async function load() {
      try {
        const res = await fetch(`/api/my-tickets?buyerWallet=${buyerWallet}`);
        if (res.ok) {
          const data = (await res.json()) as { tickets: Ticket[]; badges: BadgeItem[] };
          setTickets(data.tickets);
          setBadges(data.badges ?? []);
        }
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [buyerWallet, loaded]);

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

  const loading = !!buyerWallet && !loaded;
  const upcoming = tickets.filter((t) => isUpcoming(t.eventDate));
  const past      = tickets.filter((t) => !isUpcoming(t.eventDate));

  return (
    <>
      <style>{CSS}</style>
      <div className={`page-root ${unbounded.variable} ${epilogue.variable}`}>

        <nav className="nav">
          <div className="nav-left">
            <PasslyLogo />
            <div className="nav-divider" />
            <div className="nav-section">My Shelf</div>
          </div>
          <div className="nav-right">
            <Link href="/events" className="btn-nav">Events</Link>
            <Link href={buyerWallet ? `/collection/${buyerWallet}` : '#'} className="btn-nav">
              Public Profile
            </Link>
            <Link href="/dashboard" className="btn-nav">Dashboard</Link>
            <button className="btn-nav" onClick={() => logout()}>Log out</button>
          </div>
        </nav>

        <main className="main">

          <div className="page-heading a1">
            <div className="page-label">
              <span className="page-label-line" />
              Account
            </div>
            <h1 className="page-title">My Shelf</h1>
            {buyerWallet && (
              <p className="page-sub">
                Share your shelf:{' '}
                <Link href={`/collection/${buyerWallet}`} className="shelf-link">
                  passly.xyz/collection/{buyerWallet.slice(0, 6)}…
                </Link>
              </p>
            )}
          </div>

          {/* Upcoming */}
          <div className="section a2">
            <div className="section-header">
              <div className="section-title">Upcoming</div>
              {upcoming.length > 0 && <div className="section-count">{upcoming.length}</div>}
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
              <div className="card-grid">
                {upcoming.map((t) => {
                  const days = daysUntil(t.eventDate);
                  const daysLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
                  const hue = eventHue(t.eventName);
                  const hue2 = (hue + 55) % 360;
                  return (
                    <Link key={t.assetId} href={`/tickets/${t.assetId}`} className="ticket-card card-upcoming">
                      <div className="card-art">
                        <div
                          className="card-art-bg"
                          style={{ background: `radial-gradient(ellipse at 35% 45%, oklch(0.30 0.18 ${hue} / 0.95), transparent 55%), radial-gradient(ellipse at 65% 60%, oklch(0.24 0.13 ${hue2} / 0.8), transparent 50%), oklch(0.13 0.06 ${hue})` }}
                        />
                        <div className="card-art-noise" />
                        <div className="card-days">{daysLabel}</div>
                      </div>
                      <div className="card-info">
                        <div className="card-name">{t.eventName}</div>
                        <div className="card-date">{formatDateShort(t.eventDate)}</div>
                        <div className="card-footer">
                          <span className="card-status status-upcoming">Upcoming</span>
                          <button
                            className="card-share"
                            onClick={(e) => { e.preventDefault(); void handleShare(t.assetId, t.claimUrl); }}
                            disabled={sharingAssetId === t.assetId}
                          >
                            {sharingAssetId === t.assetId ? '…' : t.claimUrl ? 'Copy link' : 'Share'}
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collection (past) */}
          <div className="section a3">
            <div className="section-header">
              <div className="section-title">Collection</div>
              {past.length > 0 && <div className="section-count">{past.length}</div>}
            </div>
            {loading ? (
              <div className="empty"><p className="empty-text">Loading…</p></div>
            ) : past.length === 0 ? (
              <div className="empty">
                <p className="empty-text">Events you attend will appear here as collectibles.</p>
              </div>
            ) : (
              <div className="card-grid">
                {past.map((t) => {
                  const attended = !!t.redeemedAt;
                  const hue = eventHue(t.eventName);
                  const hue2 = (hue + 55) % 360;
                  return (
                    <Link
                      key={t.assetId}
                      href={`/tickets/${t.assetId}`}
                      className={`ticket-card ${attended ? 'card-attended' : 'card-missed'}`}
                    >
                      <div className="card-art">
                        <div
                          className="card-art-bg"
                          style={{
                            background: `radial-gradient(ellipse at 35% 45%, oklch(0.30 0.18 ${hue} / 0.95), transparent 55%), radial-gradient(ellipse at 65% 60%, oklch(0.24 0.13 ${hue2} / 0.8), transparent 50%), oklch(0.13 0.06 ${hue})`,
                            filter: attended ? 'none' : 'grayscale(0.6) brightness(0.55)',
                          }}
                        />
                        <div className="card-art-noise" />
                        {attended && (
                          <div className="card-stamp">
                            <span className="card-stamp-text">Attended</span>
                          </div>
                        )}
                        {!attended && (
                          <div className="card-stamp">
                            <span className="card-stamp-text missed-stamp">Missed</span>
                          </div>
                        )}
                      </div>
                      <div className="card-info">
                        <div className="card-name">{t.eventName}</div>
                        <div className="card-date">{formatDateShort(t.eventDate)}</div>
                        <div className="card-footer">
                          <span className={`card-status ${attended ? 'status-attended' : 'status-missed'}`}>
                            {attended ? 'Attended' : 'Missed'}
                          </span>
                          {attended && (
                            <button
                              className="card-share"
                              onClick={(e) => { e.preventDefault(); void handleShare(t.assetId, t.claimUrl); }}
                              disabled={sharingAssetId === t.assetId}
                            >
                              {sharingAssetId === t.assetId ? '…' : t.claimUrl ? 'Copy link' : 'Share'}
                            </button>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="section a4">
            <div className="section-header">
              <div className="section-title">Badges</div>
              {badges.length > 0 && <div className="section-count">{badges.length}</div>}
            </div>
            {loading ? (
              <div className="empty"><p className="empty-text">Loading…</p></div>
            ) : badges.length === 0 ? (
              <div className="empty">
                <p className="empty-text">Attend your first show to earn a badge.</p>
              </div>
            ) : (
              <div className="badge-grid">
                {badges.map((b) => {
                  const meta = BADGE_DISPLAY[b.badgeType] ?? { name: b.badgeType, symbol: '◆', hue: 260 };
                  const earnedDate = new Date(b.earnedAt).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  });
                  return (
                    <div key={b.badgeType} className="badge-card">
                      <span
                        className="badge-symbol"
                        style={{ color: `oklch(0.78 0.20 ${meta.hue})` }}
                      >
                        {meta.symbol}
                      </span>
                      <div className="badge-name">{meta.name}</div>
                      <div className="badge-date">{earnedDate}</div>
                    </div>
                  );
                })}
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
