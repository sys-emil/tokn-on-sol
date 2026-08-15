'use client';

import { useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AccountMenu } from '@/app/components/AccountMenu';
import { Celebration } from '@/app/components/Celebration';
import { ProfileNudge } from '@/app/components/ProfileNudge';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon, Spark, VerifiedCheck } from '@/app/components/passlyUi';
import { useEffect, useState } from 'react';

interface EventRow {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  is_private: boolean;
  image_url: string | null;
  accent_hue: number | null;
  border_style: string | null;
}

interface ActivityItem {
  eventName: string;
  quantity: number;
  when: string;
  kind: 'sale' | 'redemption';
}

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const monthShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}


const PAGE_CSS = `
  /* ── Stronger aurora behind the dashboard hero ───────────── */
  .aurora {
    inset: -40% -14% auto -14%;
    height: 560px;
    filter: blur(60px) saturate(1.4);
    opacity: 0.9;
  }
  .aurora::before {
    left: 4%; top: 6%;
    width: 560px; height: 560px;
    background: radial-gradient(circle at 30% 30%, oklch(0.78 0.22 var(--hue)) 0%, transparent 64%);
    animation: dashAuroraA 18s ease-in-out infinite alternate;
  }
  .aurora::after {
    right: 2%; top: -6%;
    width: 660px; height: 660px;
    background:
      radial-gradient(circle at 70% 40%, oklch(0.78 0.20 calc(var(--hue) + 40)) 0%, transparent 60%),
      radial-gradient(circle at 40% 80%, oklch(0.80 0.18 calc(var(--hue) - 40)) 0%, transparent 60%);
    animation: dashAuroraB 22s ease-in-out infinite alternate;
  }
  @keyframes dashAuroraA {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(30px, 18px, 0); }
  }
  @keyframes dashAuroraB {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(-34px, 14px, 0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .aurora::before, .aurora::after { animation: none; }
  }
`;

function isUpcoming(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + 'T00:00:00').getTime() >= today.getTime();
}

export default function Dashboard() {
  const router = useRouter();
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [sparkline, setSparkline] = useState<number[]>([]);
  const [soldLast7, setSoldLast7] = useState(0);
  const [soldPrev7, setSoldPrev7] = useState(0);
  const [ticketsIssued, setTicketsIssued] = useState(0);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [passCount, setPassCount] = useState<number | null>(null);
  const [orgStatus, setOrgStatus] = useState<'loading' | 'none' | 'approved'>('loading');
  const [stripeStatus, setStripeStatus] = useState<'loading' | 'disconnected' | 'pending' | 'connected'>('disconnected');
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [orgVerified, setOrgVerified] = useState(false);
  const [orgVerifiedLabel, setOrgVerifiedLabel] = useState<string | null>(null);
  const [planCancelAtPeriodEnd, setPlanCancelAtPeriodEnd] = useState(false);
  const [planPeriodEnd, setPlanPeriodEnd] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [showProCelebration, setShowProCelebration] = useState(false);
  const [statusNonce, setStatusNonce] = useState(0);

  const solanaWalletAddress = solanaWallets[0]?.address;

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  // Stripe redirects here with ?billing=success after the Pro checkout.
  // Celebrate, clean the URL, and re-check the plan once the webhook had a
  // moment to flip `organizers.plan`.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('billing')) return;
    const isSuccess = new URLSearchParams(window.location.search).get('billing') === 'success';
    router.replace('/dashboard');
    if (!isSuccess) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of the redirect URL, runs once on mount
    setShowProCelebration(true);
    const timer = setTimeout(() => setStatusNonce((n) => n + 1), 4000);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (!solanaWalletAddress) return;
    async function checkOrg(): Promise<void> {
      const token = await getAccessToken();
      const res = await fetch(`/api/organizers/status?walletAddress=${solanaWalletAddress}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setOrgStatus('none'); setStripeStatus('disconnected'); return; }
      const data = (await res.json()) as {
        status: string;
        stripe_account_id: string | null;
        stripe_charges_enabled: boolean;
        stripe_payouts_enabled: boolean;
        plan?: string;
        plan_period_end?: string | null;
        plan_cancel_at_period_end?: boolean;
        public_name?: string | null;
        is_verified?: boolean;
        verified_label?: string | null;
      };
      const s = data.status;
      setOrgStatus(s === 'approved' ? 'approved' : 'none');
      if (s === 'approved') {
        if (!data.stripe_account_id) setStripeStatus('disconnected');
        else if (!data.stripe_charges_enabled) setStripeStatus('pending');
        else setStripeStatus('connected');
        setPlan(data.plan === 'pro' ? 'pro' : 'free');
        setOrgVerified(Boolean(data.is_verified));
        setOrgVerifiedLabel(data.verified_label ?? null);
        setPlanPeriodEnd(data.plan_period_end ?? null);
        setPlanCancelAtPeriodEnd(data.plan_cancel_at_period_end ?? false);
      }
    }
    void checkOrg();
  }, [solanaWalletAddress, statusNonce, getAccessToken]);

  useEffect(() => {
    if (orgStatus === 'none') router.push('/become-organizer');
  }, [orgStatus, router]);

  useEffect(() => {
    if (!solanaWalletAddress || eventsLoaded || orgStatus !== 'approved') return;
    async function loadEvents(): Promise<void> {
      try {
        const token = await getAccessToken();
        const [res, passRes] = await Promise.all([
          fetch(`/api/events/list?organizerWallet=${solanaWalletAddress}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/organizer/passes?walletAddress=${solanaWalletAddress}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (passRes.ok) {
          const passData = (await passRes.json()) as { passes: { active: boolean }[] };
          setPassCount(passData.passes.filter((p) => p.active).length);
        }
        if (res.ok) {
          const data = (await res.json()) as {
            events: EventRow[];
            totalTickets: number;
            activity: ActivityItem[];
            sparkline: number[];
            soldLast7: number;
            soldPrev7: number;
          };
          setEvents(data.events);
          setTicketsIssued(data.totalTickets);
          setActivity(data.activity ?? []);
          setSparkline(data.sparkline ?? []);
          setSoldLast7(data.soldLast7 ?? 0);
          setSoldPrev7(data.soldPrev7 ?? 0);
        }
      } finally {
        setEventsLoaded(true);
      }
    }
    void loadEvents();
  }, [solanaWalletAddress, eventsLoaded, orgStatus, getAccessToken]);

  // After returning from Stripe Express onboarding, refresh Connect status from Stripe.
  useEffect(() => {
    const stripeParam = new URLSearchParams(window.location.search).get('stripe');
    if ((stripeParam !== 'return' && stripeParam !== 'refresh') || !solanaWalletAddress) return;
    async function refreshStripeStatus(): Promise<void> {
      setStripeStatus('loading');
      try {
        const token = await getAccessToken();
        const r = await fetch(`/api/stripe/connect/status?walletAddress=${solanaWalletAddress}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await r.json()) as { connected: boolean; charges_enabled?: boolean };
        if (!data.connected) setStripeStatus('disconnected');
        else if (!data.charges_enabled) setStripeStatus('pending');
        else setStripeStatus('connected');
      } catch {
        setStripeStatus('disconnected');
      }
    }
    void refreshStripeStatus();
  }, [solanaWalletAddress, getAccessToken]);

  if (!ready || !authenticated) return null;

  const ownerWallet = solanaWalletAddress;
  const email = user?.email?.address ?? '';
  const loadingEvents = !!ownerWallet && !eventsLoaded;

  const totalRevenueCents = events.reduce((a, e) => a + e.tickets_sold * e.price_eur, 0);
  const activeEvents = events.filter((e) => isUpcoming(e.date)).length;
  const nextEvent = [...events]
    .filter((e) => isUpcoming(e.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  async function handleBilling(endpoint: 'checkout' | 'portal'): Promise<void> {
    if (!ownerWallet || billingBusy) return;
    setBillingError(null);
    const token = await getAccessToken();
    if (!token) {
      setBillingError('Nicht angemeldet. Bitte melde dich ab und wieder an.');
      return;
    }
    setBillingBusy(true);
    try {
      const res = await fetch(`/api/organizer/billing/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: ownerWallet }),
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setBillingError(data.error ?? 'Aktion konnte nicht gestartet werden.');
      }
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Aktion konnte nicht gestartet werden.');
    } finally {
      setBillingBusy(false);
    }
  }

  async function handleConnectStripe(): Promise<void> {
    if (!ownerWallet || connectingStripe) return;
    setStripeError(null);
    const token = await getAccessToken();
    if (!token) {
      setStripeError('Nicht angemeldet. Bitte melde dich ab und wieder an.');
      return;
    }
    setConnectingStripe(true);
    try {
      const res = await fetch('/api/stripe/connect/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: ownerWallet }),
      });
      const text = await res.text();
      let data: { success: boolean; url?: string; error?: string };
      try {
        data = JSON.parse(text) as { success: boolean; url?: string; error?: string };
      } catch {
        setStripeError(`Serverfehler (${res.status}): ${text.slice(0, 120) || 'leere Antwort'}`);
        return;
      }
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setStripeError(data.error ?? 'Stripe-Onboarding konnte nicht gestartet werden.');
      }
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : 'Stripe-Onboarding konnte nicht gestartet werden.');
    } finally {
      setConnectingStripe(false);
    }
  }

  const deltaPct = soldPrev7 > 0
    ? Math.round(((soldLast7 - soldPrev7) / soldPrev7) * 1000) / 10
    : null;

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/dashboard" className="active">Übersicht</Link>
              <Link href="/dashboard/profile">Profil</Link>
              <Link href="/dashboard/passes">Saisonpässe</Link>
              <Link href="/dashboard/payouts">Auszahlungen</Link>
              <Link href="/dashboard/analytics" className={plan === 'pro' ? 'nav-pro' : undefined}>
                {plan === 'pro' && <Icon name="sparkle" size={12} strokeWidth={2} />} Pro
              </Link>
              <Link href="/events">Events</Link>
              <Link href="/my-tickets">Meine Tickets</Link>
            </div>
            <div className="topbar-right">
              <AccountMenu email={email} walletAddress={ownerWallet} onLogout={() => logout()} />
            </div>
          </div>
        </div>

        <div className="main">
          {orgStatus === 'approved' && (
            <>
              <div className="aurora" />
              <div className="container">

                <div className="hero">
                  {/* Nur der Zweck der Seite, kein Werbetext: das Dashboard ist ein
                      Arbeitsplatz, und der Veranstalter weiss, wo er ist. */}
                  <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    Veranstaltungen
                    {orgVerified && <VerifiedCheck size={18} title={orgVerifiedLabel ?? 'Verifiziert'} />}
                  </h1>
                  <div className="row gap-2" style={{ marginTop: 22 }}>
                    <Link href="/dashboard/events/neu" className="btn primary lg">
                      <Icon name="plus" size={15} /> Veranstaltung erstellen
                    </Link>
                  </div>
                </div>

                <div className={`kpis${plan === 'pro' ? ' pro-active' : ''}`}>
                  <div className="kpi">
                    <div className="label">Verkaufte Tickets</div>
                    <div className="value">{ticketsIssued.toLocaleString('de-DE')}</div>
                    {deltaPct !== null ? (
                      <div className={`delta${deltaPct < 0 ? ' neg' : ''}`}>
                        <Icon name="arrow" size={12} strokeWidth={2.2} /> {deltaPct >= 0 ? '+' : ''}{deltaPct.toLocaleString('de-DE')} % zu letzter Woche
                      </div>
                    ) : (
                      <div className="delta" style={{ color: 'var(--ink-3)' }}>{soldLast7} in den letzten 7 Tagen</div>
                    )}
                    {sparkline.length > 1 && <div className="spark"><Spark data={sparkline} /></div>}
                  </div>
                  <div className="kpi">
                    <div className="label">Einnahmen</div>
                    <div className="value">{eur(totalRevenueCents)}</div>
                    <div className="delta" style={{ color: 'var(--ink-3)' }}>Ticketumsatz gesamt · 100 % für dich</div>
                    {sparkline.length > 1 && <div className="spark"><Spark data={sparkline} color="var(--ok)" /></div>}
                  </div>
                  <div className="kpi">
                    <div className="label">Aktive Events</div>
                    <div className="value">{activeEvents}</div>
                    <div className="delta" style={{ color: 'var(--ink-3)' }}>
                      {events.length - activeEvents} vorbei
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="label">Nächstes Event</div>
                    <div className="value" style={{ fontSize: 20, letterSpacing: '-0.02em' }}>
                      {nextEvent ? shortDate(nextEvent.date) : 'keins'}
                    </div>
                    <div className="delta" style={{ color: 'var(--ink-3)' }}>
                      {nextEvent ? nextEvent.name : 'Keine bevorstehende'}
                    </div>
                  </div>
                </div>

                {stripeStatus !== 'connected' && (
                  <section>
                    <div className="card" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--warn-wash)', border: '1px solid oklch(0.86 0.09 70)', display: 'grid', placeItems: 'center', color: 'var(--warn)', flexShrink: 0 }}>
                        <Icon name="euro" size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {stripeStatus === 'pending' ? 'Stripe-Verifizierung abschließen' : 'Auszahlungen einrichten'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
                          {stripeStatus === 'pending'
                            ? 'Du kannst Events erstellen, aber bezahlte Ticketverkäufe bleiben deaktiviert, bis die Verifizierung abgeschlossen ist.'
                            : 'Verbinde Stripe, um Einnahmen ausgezahlt zu bekommen. Pro Ticket fällt eine kleine Servicegebühr an; wer sie zahlt, legst du je Event fest.'}
                        </div>
                        {stripeError && (
                          <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 6 }}>{stripeError}</div>
                        )}
                      </div>
                      <button className="btn primary" onClick={() => void handleConnectStripe()} disabled={connectingStripe}>
                        {connectingStripe ? 'Weiterleitung …' : stripeStatus === 'pending' ? 'Verifizierung fortsetzen' : 'Stripe verbinden'}
                      </button>
                    </div>
                  </section>
                )}

                <section>
                  <div className={`card${plan === 'free' ? ' pro-outline' : ' pro-active'}`} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, var(--accent), oklch(0.62 0.19 calc(var(--hue) + 45)))', border: 'none', display: 'grid', placeItems: 'center', color: 'white', flexShrink: 0, boxShadow: '0 2px 10px oklch(0.50 0.20 var(--hue) / 0.40)' }}>
                      <Icon name="sparkle" size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div className="row gap-2" style={{ alignItems: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Passly Pro</div>
                        {plan === 'pro'
                          ? <span className="chip pro"><span className="d" />Aktiv</span>
                          : <span className="chip"><span className="d" />Free</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
                        {plan === 'pro'
                          ? planCancelAtPeriodEnd && planPeriodEnd
                            ? `Dein Abo endet am ${new Date(planPeriodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}.`
                            : 'Detaillierte Analytics, Gäste-Nachrichten und dein Treueprogramm sind freigeschaltet.'
                          : 'Kenne deine Stammgäste, schreibe allen Ticketinhabern und belohne Wiederkehrer mit deinem eigenen Treueprogramm, alles in einem Abo, jederzeit kündbar.'}
                      </div>
                      {billingError && (
                        <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 6 }}>{billingError}</div>
                      )}
                    </div>
                    {plan === 'pro' ? (
                      <div className="row gap-2">
                        <Link href="/dashboard/analytics" className="btn ghost">Pro-Bereich</Link>
                        <button className="btn subtle" onClick={() => void handleBilling('portal')} disabled={billingBusy}>
                          {billingBusy ? 'Weiterleitung …' : 'Abo verwalten'}
                        </button>
                      </div>
                    ) : (
                      <button className="btn primary btn-shine" onClick={() => void handleBilling('checkout')} disabled={billingBusy}>
                        {billingBusy ? 'Weiterleitung …' : 'Pro werden'}
                      </button>
                    )}
                  </div>
                </section>

                {/* Eigener Einstieg im Seiteninhalt: der Topbar-Link allein
                    verschwindet auf schmalen Bildschirmen im Scroll. */}
                <section>
                  <div className="card" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-wash)', display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                      <Icon name="ticket" size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Saisonpässe</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
                        {passCount && passCount > 0
                          ? `${passCount} ${passCount === 1 ? 'Pass ist' : 'Pässe sind'} im Verkauf. Ein Pass gilt für alle Termine, die du ihm zuordnest.`
                          : 'Ein Ticket für mehrere Termine. Fans kaufen die Reihe mit einem Kauf, am Einlass gilt der Pass pro Termin einmal.'}
                      </div>
                    </div>
                    <Link href="/dashboard/passes" className="btn primary">
                      {passCount && passCount > 0 ? 'Pässe verwalten' : 'Saisonpass anlegen'}
                    </Link>
                  </div>
                </section>

                <section>
                  <div className="section-head">
                    <div>
                      <h2>Veranstaltungen</h2>
                      <div className="sub">{events.length} insgesamt · {activeEvents} aktiv</div>
                    </div>
                  </div>

                  {loadingEvents ? (
                    <div className="card"><div className="empty">Lade Veranstaltungen …</div></div>
                  ) : (
                    <div className="events-grid">
                      {events.map((e) => {
                        const pct = e.capacity > 0 ? Math.round((e.tickets_sold / e.capacity) * 100) : 0;
                        const upcoming = isUpcoming(e.date);
                        const cardClasses = [
                          'event-card',
                          e.border_style ? `border-${e.border_style}` : '',
                          e.image_url && 'has-image',
                        ].filter(Boolean).join(' ');
                        const cardStyle: Record<string, string | number> = {};
                        if (e.accent_hue != null) cardStyle['--hue'] = e.accent_hue;
                        if (e.image_url) cardStyle.backgroundImage = `url(${e.image_url})`;
                        return (
                          <Link key={e.id} href={`/dashboard/events/${e.id}`} className={cardClasses} style={cardStyle as React.CSSProperties}>
                            <div className="row gap-3">
                              <div className="date-chip">
                                <div className="m">{monthShort(e.date)}</div>
                                <div className="d">{dayNum(e.date)}</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="title">{e.name}</div>
                                <div className="meta">
                                  {e.venue ? (<><Icon name="location" size={12} /> {e.venue}</>) : (<><Icon name="euro" size={12} /> {e.price_eur === 0 ? 'Kostenlos' : eur(e.price_eur)}</>)}
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="sold">
                                <span><b>{e.tickets_sold}</b> von {e.capacity} verkauft</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="progress"><span style={{ width: pct + '%' }} /></div>
                            </div>
                            <div className="row" style={{ justifyContent: 'space-between' }}>
                              <span className="row gap-2">
                                <span className={'chip ' + (upcoming ? 'ok' : '')}>
                                  <span className="d" />{upcoming ? 'Aktiv' : 'Vorbei'}
                                </span>
                                {e.is_private && <span className="chip"><span className="d" />Privat</span>}
                              </span>
                              <span className="muted" style={{ fontSize: 12 }}>
                                {e.price_eur === 0 ? 'Kostenlos' : eur(e.price_eur)}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                      <Link
                        href="/dashboard/events/neu"
                        className="event-card"
                        style={{
                          border: '1.5px dashed var(--line-2)', boxShadow: 'none', background: 'transparent',
                          display: 'grid', placeItems: 'center', minHeight: 200, color: 'var(--ink-3)',
                        }}
                      >
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10, background: 'var(--accent-wash)',
                            display: 'grid', placeItems: 'center', margin: '0 auto 8px', color: 'var(--accent)',
                          }}>
                            <Icon name="plus" size={18} strokeWidth={2} />
                          </div>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>Neue Veranstaltung</div>
                          <div style={{ fontSize: 12, marginTop: 2 }}>Name, Datum, Ticketanzahl</div>
                        </div>
                      </Link>
                    </div>
                  )}
                </section>

                {activity.length > 0 && (
                  <section>
                    <div className="section-head">
                      <div>
                        <h2>Letzte Aktivität</h2>
                        <div className="sub">Was gerade passiert</div>
                      </div>
                    </div>
                    <div className="card">
                      {activity.map((a, i) => (
                        <div key={i} style={{
                          display: 'grid', gridTemplateColumns: '36px 1fr auto',
                          alignItems: 'center', gap: 14, padding: '14px 20px',
                          borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: a.kind === 'sale' ? 'var(--accent-wash)' : 'var(--ok-wash)',
                            border: '1px solid ' + (a.kind === 'sale' ? 'var(--accent-line)' : 'oklch(0.86 0.08 150)'),
                            display: 'grid', placeItems: 'center',
                            color: a.kind === 'sale' ? 'var(--accent-ink)' : 'var(--ok)',
                          }}>
                            <Icon name={a.kind === 'sale' ? 'ticket' : 'doublecheck'} size={14} />
                          </div>
                          <div style={{ fontSize: 13.5 }}>
                            {a.kind === 'sale'
                              ? `${a.quantity} ${a.quantity === 1 ? 'neues Ticket' : 'neue Tickets'} für ${a.eventName}`
                              : `Ticket eingelöst bei ${a.eventName}`}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{relativeTime(a.when)}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />

              </div>
            </>
          )}
        </div>

      </div>

      {!showProCelebration && <ProfileNudge walletAddress={ownerWallet} />}

      {showProCelebration && (
        <Celebration
          emoji="🚀"
          title="Willkommen bei Passly Pro!"
          message="Herzlichen Glückwunsch! Analytics über alle Events, Gäste-Nachrichten und dein Treueprogramm sind jetzt für dich freigeschaltet. Zeit, deine Stammgäste zu begeistern."
          actionLabel="Zum Pro-Bereich"
          actionHref="/dashboard/analytics"
          onClose={() => setShowProCelebration(false)}
        />
      )}
    </>
  );
}
