'use client';

import { useLogout, usePrivy, getAccessToken } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AccountMenu } from '@/app/components/AccountMenu';
import { Celebration } from '@/app/components/Celebration';
import { ProfileNudge } from '@/app/components/ProfileNudge';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { badgeDisplay, BADGE_META, type BadgeType } from '@/lib/badgeMeta';
import { resaleFeeCents, resaleNetProceedsCents } from '@/lib/fees';
import { useEffect, useRef, useState } from 'react';

const PAGE_CSS = `
  /* ── Frisch gekauftes Ticket: Entrance + Akzent-Halo ─────── */
  .event-card.is-fresh {
    animation: freshIn 0.6s cubic-bezier(0.18, 1.2, 0.3, 1) var(--fresh-delay, 0ms) both;
  }
  .event-card.is-fresh::after {
    content: "";
    position: absolute; inset: 0;
    border-radius: inherit;
    border: 2px solid var(--accent);
    box-shadow: inset 0 0 24px oklch(0.56 0.22 var(--hue) / 0.12), 0 0 24px oklch(0.56 0.22 var(--hue) / 0.35);
    opacity: 0;
    animation: freshHalo 2.8s ease-out calc(var(--fresh-delay, 0ms) + 250ms);
    pointer-events: none;
  }
  @keyframes freshIn {
    from { opacity: 0; transform: scale(0.9) translateY(14px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes freshHalo {
    0% { opacity: 0; }
    12% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* Frisch verdientes Abzeichen: Landung + pulsierender Medaillen-Glow
     (Basis-Medaillen-Styles sind global — auch /collection nutzt sie) */
  .badge-tile.is-new {
    animation: badgeLand 0.7s cubic-bezier(0.18, 1.4, 0.3, 1) var(--fresh-delay, 150ms) both;
  }
  .badge-tile.is-new .badge-medal {
    animation: medalGlow 1.5s ease-in-out calc(var(--fresh-delay, 150ms) + 350ms) 3;
  }
  @keyframes badgeLand {
    from { opacity: 0; transform: scale(0.55) translateY(18px) rotate(-4deg); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes medalGlow {
    0%, 100% {
      box-shadow:
        0 4px 12px oklch(0.52 0.20 var(--bh) / 0.38),
        inset 0 1px 2px rgba(255,255,255,0.5),
        inset 0 -3px 6px oklch(0.40 0.18 var(--bh) / 0.45);
    }
    50% {
      box-shadow:
        0 0 0 9px oklch(0.60 0.20 var(--bh) / 0.14),
        0 0 30px oklch(0.60 0.20 var(--bh) / 0.60),
        inset 0 1px 2px rgba(255,255,255,0.5),
        inset 0 -3px 6px oklch(0.40 0.18 var(--bh) / 0.45);
    }
  }

  /* ── Klickbare Abzeichen: Detailkarte zieht sich auf ─────── */
  .badge-tile.is-clickable { cursor: pointer; }
  .badge-tile.is-clickable:focus-visible {
    outline: 2px solid oklch(0.56 0.20 var(--bh)); outline-offset: 2px;
  }

  .badge-detail-overlay {
    position: fixed; inset: 0; z-index: 120;
    display: grid; place-items: center;
    padding: 20px;
    background: oklch(0.30 0.03 285 / 0.42);
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
    animation: badgeOverlayIn 0.2s ease both;
  }
  .badge-detail-overlay.is-closing { animation: badgeOverlayOut 0.24s ease both; }
  @keyframes badgeOverlayIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes badgeOverlayOut { from { opacity: 1; } to { opacity: 0; } }

  .badge-detail-card {
    --bh: 285;
    position: relative;
    width: min(360px, 100%);
    padding: 32px 26px 24px;
    text-align: center;
    border-radius: 22px;
    cursor: pointer;
    overflow: hidden;
    background:
      radial-gradient(200px 130px at 50% -10%, oklch(0.95 0.06 var(--bh)), transparent 72%),
      linear-gradient(180deg, oklch(0.99 0.008 var(--bh)), #fff);
    border: 1px solid oklch(0.88 0.06 var(--bh));
    box-shadow: 0 24px 64px oklch(0.45 0.18 var(--bh) / 0.30), inset 0 1px 0 #fff;
    transform-origin: center;
    animation: badgeCardIn 0.36s cubic-bezier(0.18, 1.3, 0.3, 1) both;
  }
  .badge-detail-overlay.is-closing .badge-detail-card {
    animation: badgeCardOut 0.24s cubic-bezier(0.4, 0, 0.9, 0.4) both;
  }
  @keyframes badgeCardIn {
    from { opacity: 0; transform: scale(0.5) translateY(12px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes badgeCardOut {
    from { opacity: 1; transform: none; }
    to   { opacity: 0; transform: scale(0.72) translateY(6px); }
  }
  .badge-detail-card .badge-medal { width: 78px; height: 78px; font-size: 30px; }
  .badge-detail-card .badge-medal::before { inset: -7px; }
  .bd-name { font-size: 19px; font-weight: 700; margin-top: 18px; letter-spacing: -0.01em; animation: bdRise 0.4s ease 0.14s both; }
  .bd-desc { font-size: 13.5px; line-height: 1.55; color: var(--ink-2); margin-top: 10px; animation: bdRise 0.4s ease 0.22s both; }
  .bd-meta { font-size: 12px; color: var(--ink-3); margin-top: 16px; animation: bdRise 0.4s ease 0.30s both; }
  .bd-hint { font-size: 11px; color: var(--ink-3); opacity: 0.75; margin-top: 18px; animation: bdRise 0.4s ease 0.38s both; }
  @keyframes bdRise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }

  @media (prefers-reduced-motion: reduce) {
    .event-card.is-fresh, .event-card.is-fresh::after,
    .badge-tile.is-new, .badge-tile.is-new .badge-medal { animation: none; }
    .event-card.is-fresh::after { opacity: 0; }
    .badge-tile::after { transition: none; }
    .badge-detail-overlay, .badge-detail-overlay.is-closing,
    .badge-detail-card, .badge-detail-overlay.is-closing .badge-detail-card,
    .bd-name, .bd-desc, .bd-meta, .bd-hint { animation: none; }
  }
`;

interface Ticket {
  assetId: string;
  eventName: string;
  eventDate: string;
  purchasedAt: string;
  eventId: string;
  redeemedAt: string | null;
  claimUrl: string | null;
  imageUrl: string | null;
  accentHue: number | null;
  borderStyle: string | null;
  tierName: string | null;
  faceValueCents: number;
  resaleMaxMarkupPct: number | null;
  resaleMaxPriceCents: number | null;
  resaleListing: { id: string; listPriceCents: number; feeCents: number; netCents: number; status: string } | null;
}

const euro = (cents: number) => (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface BadgeItem {
  badgeType: string;
  assetId: string | null;
  earnedAt: string;
}

interface Progress {
  attendedCount: number;
  nextMilestone: { type: string; threshold: number } | null;
  topOrganizer: { name: string; attendedEvents: number; threshold: number } | null;
}

interface LoyaltyProgramView {
  programId: string;
  organizerName: string;
  benefitTitle: string;
  benefitDescription: string | null;
  threshold: number;
  attendedEvents: number;
  qualified: boolean;
  claim: { code: string; redeemedAt: string | null } | null;
}

const monthShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}

function isUpcoming(iso: string): boolean { return daysUntil(iso) >= 0; }

export default function MyTickets() {
  const router = useRouter();
  const { ready, authenticated, user, login } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyProgramView[]>([]);
  const [claimingProgramId, setClaimingProgramId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [shareModal, setShareModal] = useState<{ assetId: string; url: string } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharingAssetId, setSharingAssetId] = useState<string | null>(null);
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [freshAssetIds, setFreshAssetIds] = useState<Set<string>>(new Set());
  const [newBadgeTypes, setNewBadgeTypes] = useState<Set<string>>(new Set());
  const [celebration, setCelebration] = useState<{ emoji: string; title: string; message: string } | null>(null);
  const [badgeDetail, setBadgeDetail] = useState<{ type: string; earnedAt: string } | null>(null);
  const [badgeClosing, setBadgeClosing] = useState(false);
  const [creditCents, setCreditCents] = useState(0);
  const [resaleModal, setResaleModal] = useState<Ticket | null>(null);
  const [resalePrice, setResalePrice] = useState('');
  const [resaleBusy, setResaleBusy] = useState(false);
  const [resaleError, setResaleError] = useState<string | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);

  const closeBadgeDetail = () => {
    setBadgeClosing(true);
    setTimeout(() => { setBadgeDetail(null); setBadgeClosing(false); }, 240);
  };

  // Escape schließt die Abzeichen-Detailkarte
  useEffect(() => {
    if (!badgeDetail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeBadgeDetail(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [badgeDetail]);

  const buyerWallet = solanaWallets[0]?.address;

  // Arrival celebration: the checkout success page drops the freshly minted
  // asset IDs into sessionStorage right before redirecting here.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('passly_new_tickets');
      if (!raw) return;
      sessionStorage.removeItem('passly_new_tickets');
      const ids = JSON.parse(raw) as string[];
      if (!Array.isArray(ids) || ids.length === 0) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot sessionStorage handoff, runs once on mount
      setFreshAssetIds(new Set(ids));
      setCelebration({
        emoji: '🎟️',
        title: 'Herzlichen Glückwunsch!',
        message: ids.length === 1
          ? 'Dein neues Ticket ist da — sicher in deinem Konto und bereit für einen unvergesslichen Abend.'
          : `Deine ${ids.length} neuen Tickets sind da — sicher in deinem Konto und bereit für einen unvergesslichen Abend.`,
      });
    } catch { /* private mode */ }
  }, []);

  // Badge celebration: compare the loaded badges against what this device has
  // already seen. First visit only seeds the store (no stale celebrations).
  useEffect(() => {
    if (!loaded || !buyerWallet) return;
    const key = `passly_badges_seen:${buyerWallet}`;
    try {
      const raw = localStorage.getItem(key);
      const current = badges.map((b) => b.badgeType);
      if (raw !== null) {
        const seen = new Set(JSON.parse(raw) as string[]);
        const fresh = current.filter((t) => !seen.has(t));
        if (fresh.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- diff against localStorage is only known after the fetch
          setNewBadgeTypes(new Set(fresh));
          const meta = badgeDisplay(fresh[0]);
          setCelebration((prev) => prev ?? {
            emoji: '🏅',
            title: 'Neues Abzeichen!',
            message: fresh.length === 1
              ? `Herzlichen Glückwunsch — du hast dir „${meta.name}“ verdient. Ein echter Meilenstein für deine Sammlung.`
              : `Herzlichen Glückwunsch — du hast dir ${fresh.length} neue Abzeichen verdient. Echte Meilensteine für deine Sammlung.`,
          });
        }
      }
      localStorage.setItem(key, JSON.stringify(current));
    } catch { /* private mode */ }
  }, [loaded, buyerWallet, badges]);

  // Open the login modal at most once for signed-out visitors — never call
  // login() from re-runs of this effect, or the modal resets mid-flow and the
  // e-mail code step never appears.
  const loginPrompted = useRef(false);
  useEffect(() => {
    if (ready && !authenticated && !loginPrompted.current) {
      loginPrompted.current = true;
      login();
    }
  }, [ready, authenticated, login]);

  useEffect(() => {
    if (!buyerWallet || loaded) return;
    async function load() {
      try {
        const authToken = await getAccessToken();
        const authHeaders = { Authorization: `Bearer ${authToken ?? ''}` };
        const [res, loyaltyRes] = await Promise.all([
          fetch(`/api/my-tickets?buyerWallet=${buyerWallet}`, { headers: authHeaders }),
          fetch(`/api/loyalty/status?buyerWallet=${buyerWallet}`, { headers: authHeaders }),
        ]);
        if (res.ok) {
          const data = (await res.json()) as { tickets: Ticket[]; badges: BadgeItem[]; progress?: Progress; creditCents?: number };
          setTickets(data.tickets);
          setBadges(data.badges ?? []);
          setProgress(data.progress ?? null);
          setCreditCents(data.creditCents ?? 0);
        }
        if (loyaltyRes.ok) {
          const data = (await loyaltyRes.json()) as { programs: LoyaltyProgramView[] };
          setLoyalty(data.programs ?? []);
        }
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [buyerWallet, loaded]);

  async function handleShare(assetId: string, existingClaimUrl: string | null) {
    setShareError(null);
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
        setShareError('Dieses Ticket wurde gekauft, bevor Weitergabe unterstützt wurde, und kann nicht geteilt werden.');
      } else {
        setShareError(data.error ?? 'Der Link konnte nicht erstellt werden.');
      }
    } finally {
      setSharingAssetId(null);
    }
  }

  function openResale(t: Ticket) {
    setResaleError(null);
    // Default the price to the face value — the "just get rid of it" case.
    setResalePrice((t.faceValueCents / 100).toFixed(2));
    setResaleModal(t);
  }

  async function submitResale() {
    if (!resaleModal || resaleBusy) return;
    const cents = Math.round(Number(resalePrice.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setResaleError('Bitte gib einen gültigen Preis ein.');
      return;
    }
    if (resaleModal.resaleMaxPriceCents != null && cents > resaleModal.resaleMaxPriceCents) {
      setResaleError(`Höchstpreis: ${euro(resaleModal.resaleMaxPriceCents)}.`);
      return;
    }
    setResaleBusy(true);
    setResaleError(null);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/resale/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ assetId: resaleModal.assetId, listPriceCents: cents }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        setResaleModal(null);
        setLoaded(false); // reload — the ticket moves into the "angeboten" state
      } else if (data.error === 'not_delegated') {
        setResaleError('Dieses Ticket wurde gekauft, bevor der Weiterverkauf unterstützt wurde.');
      } else {
        setResaleError(data.error ?? 'Das Angebot konnte nicht erstellt werden.');
      }
    } finally {
      setResaleBusy(false);
    }
  }

  async function withdrawResale(listingId: string) {
    if (cancelBusyId) return;
    setCancelBusyId(listingId);
    setResaleError(null);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/resale/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ listingId }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        setLoaded(false);
      } else {
        setShareError(data.error ?? 'Das Angebot konnte nicht zurückgezogen werden.');
      }
    } finally {
      setCancelBusyId(null);
    }
  }

  async function handleClaimBenefit(programId: string) {
    if (!buyerWallet || claimingProgramId) return;
    setClaimingProgramId(programId);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/loyalty/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ buyerWallet, programId }),
      });
      const data = (await res.json()) as { success: boolean; code?: string; redeemedAt?: string | null };
      if (data.success && data.code) {
        setLoyalty((prev) => prev.map((p) =>
          p.programId === programId ? { ...p, claim: { code: data.code!, redeemedAt: data.redeemedAt ?? null } } : p,
        ));
      }
    } finally {
      setClaimingProgramId(null);
    }
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopyConfirmed(true);
    setTimeout(() => setCopyConfirmed(false), 2000);
  }

  if (!ready) return null;

  // Signed out and the login modal was dismissed: show an explicit sign-in
  // state instead of a blank page or a silent bounce to the landing page.
  if (!authenticated) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events">Events</Link>
            </div>
          </div>
        </div>
        <div className="main">
          <div className="container" style={{ maxWidth: 480 }}>
            <div className="card" style={{ padding: 32, textAlign: 'center', marginTop: 48 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: 'var(--accent)' }}>
                <Icon name="ticket" size={20} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>Deine Tickets warten hier.</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6 }}>
                Melde dich mit deiner E-Mail-Adresse an — ohne Passwort, ein Code genügt.
              </div>
              <button className="btn primary" style={{ marginTop: 18 }} onClick={() => login()}>
                Anmelden
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const email = user?.email?.address ?? '';
  const loading = !!buyerWallet && !loaded;
  const upcoming = tickets.filter((t) => isUpcoming(t.eventDate));
  const past = tickets.filter((t) => !isUpcoming(t.eventDate));
  const isAllEmpty = loaded && tickets.length === 0 && badges.length === 0;

  const ticketCard = (t: Ticket, kind: 'upcoming' | 'past') => {
    const attended = !!t.redeemedAt;
    const days = daysUntil(t.eventDate);
    const daysLabel = days === 0 ? 'Heute' : days === 1 ? 'Morgen' : `in ${days} Tagen`;
    const isFresh = freshAssetIds.has(t.assetId);
    const freshIndex = isFresh ? [...freshAssetIds].indexOf(t.assetId) : 0;
    // Priority: VIP tier > organizer border preset (Pro) > accent hue > event
    // image — VIP always wins so its gold look stays an unambiguous signal.
    const isVip = /\bvip\b/i.test(t.tierName ?? '');
    const cardClasses = [
      'event-card',
      isFresh && 'is-fresh',
      isVip ? 'vip' : t.borderStyle ? `border-${t.borderStyle}` : '',
      t.imageUrl && 'has-image',
    ].filter(Boolean).join(' ');
    const cardStyle: Record<string, string | number> = {};
    if (isFresh) cardStyle['--fresh-delay'] = `${freshIndex * 120}ms`;
    if (t.accentHue != null) cardStyle['--hue'] = t.accentHue;
    if (t.imageUrl) cardStyle.backgroundImage = `url(${t.imageUrl})`;
    return (
      <Link
        key={t.assetId}
        href={`/tickets/${t.assetId}`}
        className={cardClasses}
        style={cardStyle as React.CSSProperties}
      >
        <div className="row gap-3">
          <div className="date-chip">
            <div className="m">{monthShort(t.eventDate)}</div>
            <div className="d">{dayNum(t.eventDate)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="title row gap-2">
              {t.eventName}
              {isVip && <span className="vip-tag"><span className="star">★</span>VIP</span>}
            </div>
            <div className="meta">
              <Icon name="calendar" size={12} /> {formatDate(t.eventDate)}
            </div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {kind === 'upcoming' ? (
            <span className="chip accent"><span className="d" />{daysLabel}</span>
          ) : attended ? (
            <span className="chip ok"><span className="d" />Dabei gewesen</span>
          ) : (
            <span className="chip"><span className="d" />Nicht eingelöst</span>
          )}
          {kind === 'upcoming' && t.resaleListing ? (
            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <span className="chip accent"><span className="d" />Zum Verkauf · {euro(t.resaleListing.listPriceCents)}</span>
              <button
                className="btn subtle sm"
                onClick={(e) => { e.preventDefault(); void withdrawResale(t.resaleListing!.id); }}
                disabled={cancelBusyId === t.resaleListing.id}
              >
                {cancelBusyId === t.resaleListing.id ? '…' : 'Zurückziehen'}
              </button>
            </div>
          ) : kind === 'upcoming' && (
            <div className="row gap-2">
              {t.resaleMaxPriceCents != null && (
                <button
                  className="btn subtle sm"
                  onClick={(e) => { e.preventDefault(); openResale(t); }}
                >
                  <Icon name="tag" size={12} /> Verkaufen
                </button>
              )}
              <button
                className="btn subtle sm"
                onClick={(e) => { e.preventDefault(); void handleShare(t.assetId, t.claimUrl); }}
                disabled={sharingAssetId === t.assetId}
              >
                <Icon name="share" size={12} /> {sharingAssetId === t.assetId ? '…' : t.claimUrl ? 'Link kopieren' : 'Teilen'}
              </button>
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events">Events</Link>
              <Link href="/my-tickets" className="active">Meine Tickets</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
            <div className="topbar-right">
              <AccountMenu email={email} walletAddress={buyerWallet} onLogout={() => logout()} />
            </div>
          </div>
        </div>

        <div className="main">
          <div className="container">

            <div className="row gap-3" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ fontSize: 30, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1 }}>Meine Tickets</h1>
                {buyerWallet && (
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>
                    <Link href={`/collection/${buyerWallet}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>
                      Öffentliches Profil ansehen →
                    </Link>
                  </div>
                )}
                {creditCents > 0 && (
                  <div className="chip accent" style={{ marginTop: 10 }} title="Wird beim nächsten Ticketkauf automatisch verrechnet.">
                    <Icon name="euro" size={12} /> {euro(creditCents)} Guthaben
                  </div>
                )}
              </div>
              <Link href="/events" className="btn ghost"><Icon name="ticket" size={14} /> Events entdecken</Link>
            </div>

            {shareError && (
              <div className="card" style={{ padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--bad)', border: '1px solid oklch(0.86 0.10 25)', background: 'var(--bad-wash)' }}>
                {shareError}
              </div>
            )}

            {loading && (
              <div className="card"><div className="empty">Lade Tickets …</div></div>
            )}

            {!loading && isAllEmpty && (
              <div className="card">
                <div className="empty">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--accent)' }}>
                    <Icon name="ticket" size={20} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Dein erstes Ticket wartet hier.</div>
                  <div style={{ fontSize: 13, marginTop: 4, marginBottom: 16 }}>Kauf ein Ticket — es landet automatisch in dieser Übersicht.</div>
                  <Link href="/events" className="btn primary">Events entdecken <Icon name="arrow" size={13} /></Link>
                </div>
              </div>
            )}

            {!loading && !isAllEmpty && (
              <>
                <section>
                  <div className="section-head">
                    <div>
                      <h2>Bevorstehend</h2>
                      <div className="sub">{upcoming.length} Ticket{upcoming.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  {upcoming.length === 0 ? (
                    <div className="card">
                      <div className="empty">
                        Keine bevorstehenden Tickets. <Link href="/events" style={{ color: 'var(--accent)', fontWeight: 500 }}>Events entdecken →</Link>
                      </div>
                    </div>
                  ) : (
                    <div className="events-grid">
                      {upcoming.map((t) => ticketCard(t, 'upcoming'))}
                    </div>
                  )}
                </section>

                <section>
                  <div className="section-head">
                    <div>
                      <h2>Sammlung</h2>
                      <div className="sub">Besuchte Events</div>
                    </div>
                  </div>
                  {past.length === 0 ? (
                    <div className="card">
                      <div className="empty">Events, bei denen du warst, erscheinen hier als Erinnerung.</div>
                    </div>
                  ) : (
                    <div className="events-grid">
                      {past.map((t) => ticketCard(t, 'past'))}
                    </div>
                  )}
                </section>

                {loyalty.length > 0 && (
                  <section>
                    <div className="section-head">
                      <div>
                        <h2>Deine Vorteile</h2>
                        <div className="sub">Treueprogramme deiner Veranstalter</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {loyalty.map((p) => {
                        const remaining = Math.max(0, p.threshold - p.attendedEvents);
                        const pct = Math.min(100, Math.round((p.attendedEvents / p.threshold) * 100));
                        return (
                          <div key={p.programId} className="card" style={{ padding: '16px 20px' }}>
                            <div className="row gap-3" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.benefitTitle}</div>
                                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                                  von {p.organizerName}{p.benefitDescription ? ` · ${p.benefitDescription}` : ''}
                                </div>
                                {!p.qualified && (
                                  <>
                                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
                                      Noch {remaining} Event{remaining !== 1 ? 's' : ''} bis zu deinem Vorteil ({p.attendedEvents}/{p.threshold})
                                    </div>
                                    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', marginTop: 6, overflow: 'hidden', maxWidth: 320 }}>
                                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: 'var(--accent)' }} />
                                    </div>
                                  </>
                                )}
                              </div>
                              {p.qualified && (
                                p.claim ? (
                                  p.claim.redeemedAt ? (
                                    <span className="chip"><span className="d" />Eingelöst</span>
                                  ) : (
                                    <div style={{ textAlign: 'center' }}>
                                      <div className="mono" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--accent)' }}>{p.claim.code}</div>
                                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Am Einlass vorzeigen</div>
                                    </div>
                                  )
                                ) : (
                                  <button
                                    className="btn primary sm"
                                    onClick={() => void handleClaimBenefit(p.programId)}
                                    disabled={claimingProgramId === p.programId}
                                  >
                                    {claimingProgramId === p.programId ? '…' : 'Vorteil abholen'}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {(badges.length > 0 || progress?.nextMilestone || progress?.topOrganizer) && (
                  <section>
                    <div className="section-head">
                      <div>
                        <h2>Abzeichen</h2>
                        <div className="sub">{badges.length > 0 ? `${badges.length} verdient` : 'Dein erstes Abzeichen wartet'}</div>
                      </div>
                    </div>
                    <div className="badges-row">
                      {badges.map((b, i) => {
                        const meta = badgeDisplay(b.badgeType);
                        const earned = new Date(b.earnedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
                        const isNew = newBadgeTypes.has(b.badgeType);
                        return (
                          <div
                            key={b.badgeType}
                            role="button"
                            tabIndex={0}
                            aria-label={`${meta.name} – Details anzeigen`}
                            onClick={() => setBadgeDetail({ type: b.badgeType, earnedAt: b.earnedAt })}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBadgeDetail({ type: b.badgeType, earnedAt: b.earnedAt }); } }}
                            className={`badge-tile is-clickable${isNew ? ' is-new' : ''}`}
                            style={{ '--bh': meta.hue, ...(isNew ? { '--fresh-delay': `${150 + i * 100}ms` } : null) } as React.CSSProperties}
                          >
                            {isNew && <span className="badge-new-tag">Neu</span>}
                            <div className="badge-medal">{meta.symbol}</div>
                            <div className="badge-name">{meta.name}</div>
                            <div className="badge-date">{earned}</div>
                          </div>
                        );
                      })}
                    </div>
                    {(progress?.nextMilestone || progress?.topOrganizer) && (
                      <div style={{ display: 'grid', gap: 10, marginTop: badges.length > 0 ? 14 : 0 }}>
                        {progress?.nextMilestone && (() => {
                          const meta = badgeDisplay(progress.nextMilestone.type);
                          const remaining = progress.nextMilestone.threshold - progress.attendedCount;
                          const pct = Math.min(100, Math.round((progress.attendedCount / progress.nextMilestone.threshold) * 100));
                          return (
                            <div className="card" style={{ padding: '14px 18px' }}>
                              <div className="row gap-3" style={{ alignItems: 'center' }}>
                                <div className="badge-medal sm locked" style={{ '--bh': meta.hue } as React.CSSProperties}>{meta.symbol}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    Noch {remaining} Event{remaining !== 1 ? 's' : ''} bis „{meta.name}“
                                  </div>
                                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', marginTop: 8, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, oklch(0.66 0.16 ${meta.hue}), oklch(0.54 0.21 ${meta.hue}))`, transition: 'width .4s ease' }} />
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                                  {progress.attendedCount}/{progress.nextMilestone.threshold}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {progress?.topOrganizer && (() => {
                          const meta = badgeDisplay('loyal_organizer');
                          const remaining = progress.topOrganizer.threshold - progress.topOrganizer.attendedEvents;
                          const pct = Math.min(100, Math.round((progress.topOrganizer.attendedEvents / progress.topOrganizer.threshold) * 100));
                          return (
                            <div className="card" style={{ padding: '14px 18px' }}>
                              <div className="row gap-3" style={{ alignItems: 'center' }}>
                                <div className="badge-medal sm locked" style={{ '--bh': meta.hue } as React.CSSProperties}>{meta.symbol}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    Noch {remaining} Event{remaining !== 1 ? 's' : ''} bei {progress.topOrganizer.name} bis „{meta.name}“
                                  </div>
                                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', marginTop: 8, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, oklch(0.66 0.16 ${meta.hue}), oklch(0.54 0.21 ${meta.hue}))`, transition: 'width .4s ease' }} />
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                                  {progress.topOrganizer.attendedEvents}/{progress.topOrganizer.threshold}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />

          </div>
        </div>
      </div>

      {!celebration && <ProfileNudge walletAddress={buyerWallet} />}

      {badgeDetail && (() => {
        const meta = badgeDisplay(badgeDetail.type);
        const full = BADGE_META[badgeDetail.type as BadgeType];
        const earned = new Date(badgeDetail.earnedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
        return (
          <div
            className={`badge-detail-overlay${badgeClosing ? ' is-closing' : ''}`}
            onClick={closeBadgeDetail}
            role="dialog"
            aria-modal="true"
            aria-label={`Abzeichen ${meta.name}`}
          >
            <div className="badge-detail-card" style={{ '--bh': meta.hue } as React.CSSProperties} onClick={closeBadgeDetail}>
              <div className="badge-medal">{meta.symbol}</div>
              <div className="bd-name">{meta.name}</div>
              <div className="bd-desc">{full?.description ?? 'Ein Abzeichen aus deiner Sammlung.'}</div>
              <div className="bd-meta">Verdient am {earned}</div>
              <div className="bd-hint">Zum Schließen tippen</div>
            </div>
          </div>
        );
      })()}

      {celebration && !loading && (
        <Celebration
          emoji={celebration.emoji}
          title={celebration.title}
          message={celebration.message}
          onClose={() => setCelebration(null)}
        />
      )}

      {resaleModal && (() => {
        const cents = Math.round(Number(resalePrice.replace(',', '.')) * 100);
        const valid = Number.isFinite(cents) && cents > 0
          && (resaleModal.resaleMaxPriceCents == null || cents <= resaleModal.resaleMaxPriceCents);
        const fee = valid ? resaleFeeCents(cents, resaleModal.faceValueCents) : 0;
        const net = valid ? resaleNetProceedsCents(cents, resaleModal.faceValueCents) : 0;
        return (
          <div className="modal-backdrop" onClick={() => !resaleBusy && setResaleModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>Ticket weiterverkaufen</h3>
                <button className="close-btn" aria-label="Schließen" onClick={() => setResaleModal(null)} disabled={resaleBusy}><Icon name="x" size={16} /></button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 14 }}>
                  <b style={{ color: 'var(--ink)' }}>{resaleModal.eventName}</b><br />
                  Originalpreis {euro(resaleModal.faceValueCents)}. Höchstpreis {resaleModal.resaleMaxPriceCents != null ? euro(resaleModal.resaleMaxPriceCents) : '—'} ({resaleModal.resaleMaxMarkupPct}% Aufpreis). Der Erlös landet als Passly-Guthaben in deinem Konto.
                </p>
                <div className="field">
                  <label>Dein Verkaufspreis</label>
                  <input
                    type="number" className="input" value={resalePrice} min={0}
                    max={resaleModal.resaleMaxPriceCents != null ? resaleModal.resaleMaxPriceCents / 100 : undefined}
                    step="0.01" inputMode="decimal" disabled={resaleBusy}
                    onChange={(e) => setResalePrice(e.target.value)}
                  />
                </div>
                <div className="card" style={{ padding: '12px 14px', marginTop: 12, fontSize: 13, display: 'grid', gap: 6 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-3)' }}>Verkaufspreis</span><span>{valid ? euro(cents) : '—'}</span></div>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-3)' }}>Verkaufsgebühr</span><span>{valid ? '− ' + euro(fee) : '—'}</span></div>
                  <div className="row" style={{ justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid var(--line)', paddingTop: 6 }}><span>Dein Guthaben</span><span style={{ color: 'var(--accent)' }}>{valid ? euro(net) : '—'}</span></div>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 10 }}>
                  Solange dein Ticket angeboten wird, liegt es sicher bei Passly und kann nicht selbst genutzt werden. Du kannst das Angebot jederzeit zurückziehen.
                </p>
                {resaleError && (
                  <div style={{ marginTop: 12, fontSize: 13, color: 'var(--bad)', lineHeight: 1.5 }}>{resaleError}</div>
                )}
              </div>
              <div className="modal-foot">
                <button className="btn ghost" onClick={() => setResaleModal(null)} disabled={resaleBusy}>Abbrechen</button>
                <button className="btn primary" onClick={() => void submitResale()} disabled={!valid || resaleBusy}>
                  {resaleBusy ? 'Wird eingestellt …' : 'Zum Verkauf anbieten'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {shareModal && (
        <div className="modal-backdrop" onClick={() => setShareModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Ticket-Link teilen</h3>
              <button className="close-btn" aria-label="Schließen" onClick={() => setShareModal(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 14 }}>
                Schicke diesen Link an eine Freundin oder einen Freund. Sobald er eingelöst wird, geht das Ticket über — und der Link wird ungültig.
              </p>
              <div className="input mono" style={{ fontSize: 12, wordBreak: 'break-all', userSelect: 'all' }}>{shareModal.url}</div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShareModal(null)}>Schließen</button>
              <button className="btn primary" onClick={() => void handleCopy(shareModal.url)}>
                {copyConfirmed ? 'Kopiert!' : 'Link kopieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
