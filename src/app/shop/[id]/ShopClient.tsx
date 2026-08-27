'use client';

import { usePrivy, getAccessToken } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { splitServiceFee, type FeePayer } from '@/lib/fees';
import { track } from '@/lib/track';

export interface TierView {
  id: string;
  name: string;
  priceEur: number;
  available: number;
}

interface Props {
  eventId: string;
  tiers: TierView[];
  waitlistEnabled?: boolean;
  /** events.guest_checkout_enabled; false forces buyers through a login. */
  guestAllowed?: boolean;
  /** events.queue_enabled; buyers must hold a waiting-room slot to check out. */
  queueEnabled?: boolean;
  /** events.fee_payer; decides how much of the service fee lands on the buyer. */
  feePayer?: FeePayer;
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const MAX_QTY = 4;

// A checkout the buyer started but hasn't finished. The server-side
// reservation (30 min) keeps the seats, the Stripe session URL stays valid.
interface PendingCheckout {
  url: string;
  expiresAt: number; // ms epoch
  quantity: number;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ShopClient({ eventId, tiers, waitlistEnabled = false, guestAllowed = true, queueEnabled = false, feePayer = 'buyer' }: Props) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const selectionTracked = useRef(false);
  const [tierId, setTierId] = useState<string>(
    () => (tiers.find((t) => t.available > 0) ?? tiers[0])?.id ?? '',
  );
  const pendingCheckout = useRef(false);
  // Waiting room. `queuePos` is 1-based; 0 means admitted.
  const [queueToken, setQueueToken] = useState<string | null>(null);
  const [queuePos, setQueuePos] = useState<number | null>(null);
  // True once the buyer pressed the button: admission then continues on its own.
  const queueResume = useRef(false);
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const storageKey = `passly_checkout_${eventId}`;

  // Discount code (validated server-side; this mirrors discountedUnitPrice)
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ code: string; percentOff: number } | null>(null);

  // Waitlist signup (sold-out events of Pro organizers)
  const [wlEmail, setWlEmail] = useState('');
  const [wlBusy, setWlBusy] = useState(false);
  const [wlDone, setWlDone] = useState(false);
  const [wlError, setWlError] = useState<string | null>(null);

  const walletAddress = solanaWallets[0]?.address;
  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];
  const soldOut = tiers.every((t) => t.available <= 0);
  const tierSoldOut = !tier || tier.available <= 0;
  const maxQty = tier ? Math.min(MAX_QTY, Math.max(1, tier.available)) : 1;
  const unitPrice = tier
    ? applied
      ? Math.max(0, Math.round((tier.priceEur * (100 - applied.percentOff)) / 100))
      : tier.priceEur
    : 0;
  // Only the buyer's share shows up here; the organizer's share (if they chose
  // to carry it) never touches the buyer's total. Mirrors /api/checkout/create.
  const feePerTicket = tier ? splitServiceFee(unitPrice, feePayer).buyerCents : 0;
  const feeTotal = feePerTicket * quantity;
  const grandTotal = tier ? (unitPrice + feePerTicket) * quantity : 0;
  // In line and not yet admitted: the buy button is replaced by the position.
  const waiting = queuePos !== null && queuePos > 0;

  // Funnel stage between "Shop besucht" and "Checkout gestartet": the visitor
  // actively configured a ticket. Once per visit, so the funnel counts people.
  function trackSelection() {
    if (selectionTracked.current) return;
    selectionTracked.current = true;
    track('ticket_selected', { eventId });
  }

  function changeQuantity(next: number) {
    setQuantity(next);
    trackSelection();
  }

  function selectTier(id: string) {
    setTierId(id);
    setError(null);
    trackSelection();
    const next = tiers.find((t) => t.id === id);
    if (next) setQuantity((q) => Math.min(q, Math.min(MAX_QTY, Math.max(1, next.available))));
  }

  // Restore a still-valid reservation when the buyer bounced back from Stripe
  // (cancel_url lands here). The countdown explains why seats may look taken
  // and offers the way back into the open session.
  useEffect(() => {
    // Deferred a tick so hydration completes with the server-rendered markup
    // before the banner pops in (sessionStorage is client-only).
    const restore = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as PendingCheckout;
        if (parsed.url && parsed.expiresAt > Date.now() + 5_000) {
          setPending(parsed);
        } else {
          sessionStorage.removeItem(storageKey);
        }
      } catch {
        // corrupt entry, ignore
      }
    }, 0);
    return () => clearTimeout(restore);
  }, [storageKey]);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (pending.expiresAt <= Date.now()) {
        setPending(null);
        try { sessionStorage.removeItem(storageKey); } catch { /* private mode */ }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pending, storageKey]);

  const remainingSec = pending ? Math.max(0, Math.floor((pending.expiresAt - now) / 1000)) : 0;

  useEffect(() => {
    if (!pendingCheckout.current) return;
    if (!authenticated || !walletAddress) return;
    pendingCheckout.current = false;
    void startCheckout(walletAddress);
  }, [authenticated, walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // An applied code can become invalid when the quantity changes (soft cap
  // max_uses is checked per quantity), so revalidate instead of letting the
  // checkout API reject it after the redirect.
  useEffect(() => {
    if (!applied) return;
    let stale = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/checkout/validate-code?eventId=${encodeURIComponent(eventId)}&code=${encodeURIComponent(applied.code)}&quantity=${quantity}`,
        );
        const data = (await res.json()) as { valid: boolean; error?: string };
        if (!stale && !data.valid) {
          setApplied(null);
          setCodeError(data.error ?? 'Der Rabattcode gilt nicht für diese Anzahl.');
        }
      } catch { /* network hiccup; the checkout API is the authority anyway */ }
    })();
    return () => { stale = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check when the quantity changes
  }, [quantity]);

  async function applyCode() {
    const code = codeInput.trim();
    if (!code || codeBusy) return;
    setCodeBusy(true);
    setCodeError(null);
    try {
      const res = await fetch(
        `/api/checkout/validate-code?eventId=${encodeURIComponent(eventId)}&code=${encodeURIComponent(code)}&quantity=${quantity}`,
      );
      const data = (await res.json()) as { valid: boolean; percentOff?: number; error?: string };
      if (data.valid && data.percentOff) {
        setApplied({ code: code.toUpperCase(), percentOff: data.percentOff });
        setCodeOpen(false);
        setCodeInput('');
      } else {
        setCodeError(data.error ?? 'Dieser Code ist ungültig.');
      }
    } catch {
      setCodeError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setCodeBusy(false);
    }
  }

  async function joinWaitlist() {
    const email = wlEmail.trim();
    if (!email || wlBusy) return;
    setWlBusy(true);
    setWlError(null);
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, email }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) setWlDone(true);
      else setWlError(data.error ?? 'Eintrag fehlgeschlagen. Bitte versuch es erneut.');
    } catch {
      setWlError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setWlBusy(false);
    }
  }

  /** `wallet === null` buys as a guest: no account, ticket lands on /order/<token>. */
  async function startCheckout(wallet: string | null) {
    setLoading(true);
    setError(null);
    track('checkout_started', { eventId, quantity });
    try {
      const token = wallet !== null ? await getAccessToken() : null;
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          eventId,
          ...(wallet === null ? { guest: true } : {}),
          quantity,
          tierId: tier?.id,
          ...(applied ? { discountCode: applied.code } : {}),
          ...(queueToken ? { queueToken } : {}),
        }),
      });
      const data = (await res.json()) as { success: boolean; url?: string; expiresAt?: number; error?: string };
      if (!res.ok || !data.success || !data.url) {
        setError(data.error ?? 'Der Kauf konnte nicht gestartet werden. Bitte versuch es erneut.');
        return;
      }
      if (data.expiresAt) {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ url: data.url, expiresAt: data.expiresAt, quantity } satisfies PendingCheckout));
        } catch { /* private mode */ }
      }
      window.location.href = data.url;
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setLoading(false);
    }
  }

  /** Joins the waiting room; admission resumes the purchase automatically. */
  async function enterQueue() {
    setError(null);
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = (await res.json()) as {
        success: boolean; queueEnabled?: boolean; token?: string; admitted?: boolean; position?: number; error?: string;
      };
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Die Warteschlange ist gerade nicht erreichbar.');
        queueResume.current = false;
        return;
      }
      // The organizer switched the queue off between page load and click.
      if (data.queueEnabled === false) {
        setQueuePos(0);
        await proceedBuy();
        return;
      }
      setQueueToken(data.token ?? null);
      setQueuePos(data.admitted ? 0 : data.position ?? 1);
      if (data.admitted) await proceedBuy();
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      queueResume.current = false;
    }
  }

  /**
   * The default path deliberately does NOT require a login. Signed-in buyers
   * keep buying into their account (they get the rotating QR and their credit
   * balance); everyone else buys as a guest and receives an order link.
   */
  async function proceedBuy() {
    if (authenticated && walletAddress) {
      await startCheckout(walletAddress);
      return;
    }
    if (authenticated && !walletAddress) {
      setError('Dein Konto wird noch eingerichtet. Warte einen Moment und versuch es dann erneut.');
      return;
    }
    if (!guestAllowed) {
      pendingCheckout.current = true;
      login();
      return;
    }
    await startCheckout(null);
  }

  async function handleBuy() {
    if (soldOut || tierSoldOut || loading) return;
    if (!ready) return;

    // Events with a waiting room admit in order; the click puts the buyer in
    // line and the polling effect below picks the purchase back up.
    if (queueEnabled && queuePos !== 0) {
      queueResume.current = true;
      await enterQueue();
      return;
    }
    await proceedBuy();
  }

  /** Explicit "buy with an account" for guests who want one up front. */
  function handleBuyWithAccount() {
    if (soldOut || tierSoldOut || loading || !ready) return;
    pendingCheckout.current = true;
    login();
  }


  return (
    <>
      <style>{`
        .tier-list {
          display: flex; flex-direction: column; gap: 8px;
          margin-bottom: 16px;
        }
        .tier-option {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 12px 14px;
          background: var(--surface);
          border: 1px solid var(--line-2); border-radius: 10px;
          box-shadow: var(--shadow-sm);
          text-align: left;
          transition: border-color 0.12s, box-shadow 0.12s;
          width: 100%;
        }
        .tier-option[aria-checked="true"] {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent), var(--shadow-sm);
        }
        .tier-option:disabled { opacity: 0.55; cursor: default; }
        .tier-option .t-name { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
        .tier-option .t-left { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
        .tier-option .t-price {
          font-size: 14px; font-weight: 600; white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        /* ── VIP tier: gold treatment (matches the VIP ticket page) ──── */
        .tier-option.vip {
          position: relative; overflow: hidden;
          background: linear-gradient(150deg, oklch(0.99 0.015 95), oklch(0.955 0.05 92));
          border-color: oklch(0.80 0.10 92);
        }
        .tier-option.vip:not(:disabled):hover {
          border-color: oklch(0.72 0.12 90);
          box-shadow: 0 4px 14px oklch(0.55 0.10 90 / 0.22), var(--shadow-sm);
        }
        .tier-option.vip[aria-checked="true"] {
          border-color: oklch(0.70 0.12 89);
          box-shadow:
            0 0 0 1px oklch(0.70 0.12 89),
            0 6px 18px oklch(0.55 0.10 90 / 0.28),
            var(--shadow-sm);
        }
        .tier-option.vip::after {
          content: "";
          position: absolute; inset: 0;
          background: linear-gradient(115deg, transparent 35%, oklch(0.99 0.04 95 / 0.85) 50%, transparent 65%);
          transform: translateX(-100%);
          animation: tierVipShine 3.8s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes tierVipShine {
          0% { transform: translateX(-100%); }
          40%, 100% { transform: translateX(100%); }
        }
        .tier-option.vip .t-name { color: oklch(0.42 0.09 85); }
        .tier-option.vip .t-left { color: oklch(0.52 0.08 85); }
        .tier-option.vip .t-price { color: oklch(0.40 0.09 85); }
        .tier-vip-chip {
          display: inline-grid; place-items: center;
          width: 17px; height: 17px; margin-left: 8px; border-radius: 999px;
          background: linear-gradient(110deg, oklch(0.72 0.12 90), oklch(0.85 0.11 94));
          border: 1px solid oklch(0.68 0.11 88);
          color: oklch(0.26 0.06 85);
          vertical-align: -2px;
        }
        .tier-vip-chip .star {
          font-size: 9px; line-height: 1;
          animation: tierVipStar 2.6s ease-in-out infinite;
        }
        @keyframes tierVipStar {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35) rotate(18deg); opacity: 0.75; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tier-option.vip::after, .tier-vip-chip .star { animation: none; }
        }
        .qty-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-bottom: 14px;
        }
        .qty-label { font-size: 13px; font-weight: 500; color: var(--ink-2); }
        .qty-controls {
          display: inline-flex; align-items: center;
          background: var(--surface);
          border: 1px solid var(--line-2); border-radius: 8px;
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .qty-btn {
          width: 34px; height: 34px;
          display: grid; place-items: center;
          font-size: 16px; color: var(--ink-2);
          transition: background 0.12s;
        }
        .qty-btn:hover:not(:disabled) { background: var(--surface-2); }
        .qty-btn:disabled { color: var(--ink-4); cursor: default; }
        @media (pointer: coarse) {
          .qty-btn { width: 42px; height: 42px; }
          .qty-num { min-width: 40px; line-height: 42px; }
        }
        .qty-num {
          min-width: 34px; text-align: center;
          font-size: 14px; font-weight: 600;
          font-variant-numeric: tabular-nums;
          border-left: 1px solid var(--line); border-right: 1px solid var(--line);
          line-height: 34px;
        }
        .fee-summary {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 12px; margin-bottom: 14px;
        }
        .fee-summary .label { font-size: 12px; color: var(--ink-3); }
        .fee-summary .total {
          font-size: 17px; font-weight: 600; letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .resume-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 12px 14px; margin-bottom: 16px;
          background: var(--accent-wash);
          border: 1px solid var(--accent);
          border-radius: 10px;
        }
        .resume-banner .rb-title { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
        .resume-banner .rb-time { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
        .resume-banner .rb-time b {
          color: var(--accent); font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .resume-banner .rb-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .resume-banner .rb-dismiss {
          font-size: 11px; color: var(--ink-4);
          text-decoration: underline; text-underline-offset: 2px;
        }
        .group-hint {
          display: flex; align-items: baseline; gap: 6px;
          font-size: 11.5px; color: var(--ink-3); line-height: 1.5;
          margin: -6px 0 14px;
        }
        .buy-error {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--bad-wash);
          border: 1px solid oklch(0.86 0.10 25);
          font-size: 12.5px; color: var(--bad); line-height: 1.5;
        }
        .queue-box {
          text-align: center; padding: 22px 16px;
          border: 1px dashed var(--surface-3); border-radius: 12px;
          background: var(--surface-2);
        }
        .queue-spinner {
          width: 22px; height: 22px; margin: 0 auto 12px;
          border: 2px solid var(--surface-3); border-top-color: var(--accent);
          border-radius: 999px; animation: queue-spin 0.9s linear infinite;
        }
        @keyframes queue-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .queue-spinner { animation-duration: 2.4s; } }
        .queue-pos {
          font-size: 20px; font-weight: 650; letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums; margin-bottom: 6px;
        }
        .queue-text { font-size: 12px; color: var(--ink-3); line-height: 1.6; max-width: 280px; margin: 0 auto; }
        .pay-methods {
          margin-top: 10px;
          text-align: center;
          font-size: 11.5px;
          color: var(--ink-4);
        }
        .guest-note {
          margin-top: 8px; text-align: center;
          font-size: 11.5px; color: var(--ink-4); line-height: 1.6;
        }
        .guest-note .linkish {
          display: block; margin: 2px auto 0;
          appearance: none; background: none; border: none; padding: 0;
          font: inherit; color: var(--ink-3); text-decoration: underline; cursor: pointer;
        }
        .guest-note .linkish:hover { color: var(--ink-1); }
        .code-row { display: flex; gap: 8px; margin-bottom: 14px; }
        .code-row .input { flex: 1; min-width: 0; text-transform: uppercase; }
        .code-toggle {
          font-size: 12px; color: var(--ink-3);
          text-decoration: underline; text-underline-offset: 2px;
          margin-bottom: 14px; display: inline-block;
        }
        .code-applied {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 8px 12px; margin-bottom: 14px;
          background: var(--ok-wash);
          border: 1px solid oklch(0.86 0.08 150);
          border-radius: 8px;
          font-size: 12.5px; color: oklch(0.38 0.12 150); font-weight: 500;
        }
        .code-applied button { color: inherit; text-decoration: underline; text-underline-offset: 2px; font-size: 11.5px; }
        .waitlist-box {
          padding: 14px;
          background: var(--surface);
          border: 1px solid var(--line-2);
          border-radius: 10px;
          margin-top: 14px;
        }
        .waitlist-box .wl-title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
        .waitlist-box .wl-sub { font-size: 12px; color: var(--ink-3); line-height: 1.5; margin-top: 3px; }
        .waitlist-box .wl-row { display: flex; gap: 8px; margin-top: 10px; }
        .waitlist-box .wl-row .input { flex: 1; min-width: 0; }


      `}</style>

      {pending && remainingSec > 0 && (
        <div className="resume-banner">
          <div>
            <div className="rb-title">
              {pending.quantity > 1
                ? `${pending.quantity} Tickets für dich reserviert`
                : 'Ein Ticket für dich reserviert'}
            </div>
            <div className="rb-time">
              Noch <b>{formatCountdown(remainingSec)}</b>, danach können deine Plätze an andere Gäste gehen.
            </div>
          </div>
          <div className="rb-actions">
            <a className="btn primary sm" href={pending.url}>Kauf abschließen</a>
            <button
              type="button"
              className="rb-dismiss"
              onClick={() => {
                setPending(null);
                try { sessionStorage.removeItem(storageKey); } catch { /* private mode */ }
              }}
            >
              Verwerfen
            </button>
          </div>
        </div>
      )}

      {!soldOut && tiers.length > 1 && (
        <div className="tier-list" role="radiogroup" aria-label="Ticketkategorie">
          {tiers.map((t) => {
            const isVipTier = /\bvip\b/i.test(t.name);
            return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === tier?.id}
              className={`tier-option${isVipTier ? ' vip' : ''}`}
              disabled={t.available <= 0 || loading}
              onClick={() => selectTier(t.id)}
            >
              <span>
                <span className="t-name">{t.name}</span>
                {isVipTier && (
                  <span className="tier-vip-chip" aria-hidden="true">
                    <span className="star">★</span>
                  </span>
                )}
                <span className="t-left" style={{ display: 'block' }}>
                  {t.available <= 0
                    ? 'Ausverkauft'
                    : t.available <= 10
                    ? `Nur noch ${t.available}`
                    : 'Verfügbar'}
                </span>
              </span>
              <span className="t-price">{t.priceEur === 0 ? 'Kostenlos' : formatPrice(t.priceEur)}</span>
            </button>
            );
          })}
        </div>
      )}

      {!soldOut && !tierSoldOut && (
        <div className="qty-row">
          <div className="qty-label">Anzahl</div>
          <div className="qty-controls">
            <button
              className="qty-btn"
              onClick={() => changeQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1 || loading}
              aria-label="Weniger Tickets"
            >
              −
            </button>
            <div className="qty-num">{quantity}</div>
            <button
              className="qty-btn"
              onClick={() => changeQuantity(Math.min(maxQty, quantity + 1))}
              disabled={quantity >= maxQty || loading}
              aria-label="Mehr Tickets"
            >
              +
            </button>
          </div>
        </div>
      )}

      {!soldOut && !tierSoldOut && quantity > 1 && (
        <p className="group-hint">
          <span>👥</span>
          <span>Du kaufst für die Gruppe? Nach dem Kauf kannst du jedes Ticket per Link an deine Freunde weitergeben.</span>
        </p>
      )}

      {!soldOut && !tierSoldOut && tier && tier.priceEur > 0 && (
        <>
          {applied ? (
            <div className="code-applied">
              <span>Code {applied.code} eingelöst: {applied.percentOff} % Rabatt</span>
              <button type="button" onClick={() => setApplied(null)} disabled={loading}>Entfernen</button>
            </div>
          ) : codeOpen ? (
            <div className="code-row">
              <input
                className="input"
                placeholder="Rabattcode"
                value={codeInput}
                maxLength={24}
                onChange={(e) => { setCodeInput(e.target.value); setCodeError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void applyCode(); }}
                disabled={codeBusy}
                style={{ padding: '8px 10px', fontSize: 13 }}
              />
              <button className="btn ghost" onClick={() => void applyCode()} disabled={codeBusy || !codeInput.trim()}>
                {codeBusy ? '…' : 'Einlösen'}
              </button>
            </div>
          ) : (
            <button type="button" className="code-toggle" onClick={() => setCodeOpen(true)}>
              Du hast einen Rabattcode?
            </button>
          )}
          {codeError && <div className="buy-error" style={{ marginTop: 0, marginBottom: 14 }}>{codeError}</div>}

          <div className="fee-summary">
            <div className="label">
              Gesamt{feeTotal > 0
                ? ` · inkl. ${formatPrice(feeTotal)} Servicegebühr`
                : unitPrice > 0 ? ' · inkl. aller Gebühren' : ''}
            </div>
            <div className="total">{grandTotal === 0 ? 'Kostenlos' : formatPrice(grandTotal)}</div>
          </div>
        </>
      )}

      {waiting ? (
        <div className="queue-box">
          <div className="queue-spinner" />
          <div className="queue-pos">Platz {queuePos}</div>
          <div className="queue-text">
            Gerade sind viele gleichzeitig hier. Lass diese Seite offen, du rückst automatisch
            nach und der Kauf geht dann von allein weiter.
          </div>
        </div>
      ) : (
        <button
          className="btn primary lg"
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={soldOut || tierSoldOut || loading || !ready}
          onClick={() => void handleBuy()}
        >
          {soldOut
            ? 'Ausverkauft'
            : tierSoldOut
            ? 'Kategorie ausverkauft'
            : loading
            ? 'Weiterleitung …'
            : quantity > 1
            ? `${quantity} Tickets kaufen`
            : 'Ticket kaufen'}
        </button>
      )}

      {error && <div className="buy-error">{error}</div>}

      {!soldOut && !tierSoldOut && grandTotal > 0 && (
        <div className="pay-methods">Karte, PayPal, Apple&nbsp;Pay und Google&nbsp;Pay</div>
      )}

      {!soldOut && !tierSoldOut && !authenticated && guestAllowed && (
        <div className="guest-note">
          Direkt bezahlen, ohne vorher ein Konto anzulegen. Dein Ticket schaltest du danach
          mit deiner E-Mail-Adresse frei.
          <button type="button" className="linkish" onClick={handleBuyWithAccount} disabled={loading}>
            Lieber gleich anmelden
          </button>
        </div>
      )}

      {soldOut && waitlistEnabled && (
        <div className="waitlist-box">
          <div className="wl-title">Warteliste</div>
          {wlDone ? (
            <div className="wl-sub" style={{ color: 'oklch(0.38 0.12 150)', fontWeight: 500 }}>
              Du stehst auf der Liste! Wir schreiben dir, sobald wieder Tickets verfügbar sind.
            </div>
          ) : (
            <>
              <div className="wl-sub">
                Trag dich ein, dann bekommst du sofort eine E-Mail, sobald Plätze frei werden.
              </div>
              <div className="wl-row">
                <input
                  className="input"
                  type="email"
                  placeholder="deine@email.de"
                  value={wlEmail}
                  maxLength={254}
                  onChange={(e) => { setWlEmail(e.target.value); setWlError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void joinWaitlist(); }}
                  disabled={wlBusy}
                  style={{ padding: '8px 10px', fontSize: 13 }}
                />
                <button className="btn primary" onClick={() => void joinWaitlist()} disabled={wlBusy || !wlEmail.trim()}>
                  {wlBusy ? '…' : 'Eintragen'}
                </button>
              </div>
              {wlError && <div className="buy-error">{wlError}</div>}
            </>
          )}
        </div>
      )}


      {!soldOut && (
        <p
          style={{
            marginTop: 12,
            fontSize: 11.5,
            lineHeight: 1.55,
            color: 'var(--ink-3)',
          }}
        >
          Mit dem Kauf akzeptierst du die <Link href="/agb" style={{ color: 'var(--accent)', fontWeight: 500 }}>AGB</Link>.
          Der Vertrag kommt mit dem Veranstalter zustande. Für Tickets zu
          termingebundenen Veranstaltungen besteht kein Widerrufsrecht
          (§&nbsp;312g Abs.&nbsp;2 Nr.&nbsp;9 BGB). Jeder Kauf ist verbindlich.
          Hinweise zur Datenverarbeitung: <Link href="/datenschutz" style={{ color: 'var(--accent)', fontWeight: 500 }}>Datenschutzerklärung</Link>.
        </p>
      )}
    </>
  );
}
