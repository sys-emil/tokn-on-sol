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
import { Icon, Spark, EventStyleFields } from '@/app/components/passlyUi';
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
const formatDateLong = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

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

// priceEur/capacity are kept as raw text while editing (not number) so the
// user can clear a leading "0" and type a new value without it snapping back.
type TierDraft = { name: string; priceEur: string; capacity: string };

const MAX_TIERS = 5;

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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [tiers, setTiers] = useState<TierDraft[]>([{ name: 'Standard', priceEur: '0', capacity: '100' }]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [payoutHoldDays, setPayoutHoldDays] = useState('0');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [accentHue, setAccentHue] = useState<number | null>(null);
  const [borderStyle, setBorderStyle] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [shopLink, setShopLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [sparkline, setSparkline] = useState<number[]>([]);
  const [soldLast7, setSoldLast7] = useState(0);
  const [soldPrev7, setSoldPrev7] = useState(0);
  const [ticketsIssued, setTicketsIssued] = useState(0);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [orgStatus, setOrgStatus] = useState<'loading' | 'none' | 'approved'>('loading');
  const [stripeStatus, setStripeStatus] = useState<'loading' | 'disconnected' | 'pending' | 'connected'>('disconnected');
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
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
      const res = await fetch(`/api/organizers/status?walletAddress=${solanaWalletAddress}`);
      if (!res.ok) { setOrgStatus('none'); setStripeStatus('disconnected'); return; }
      const data = (await res.json()) as {
        status: string;
        stripe_account_id: string | null;
        stripe_charges_enabled: boolean;
        stripe_payouts_enabled: boolean;
        plan?: string;
        plan_period_end?: string | null;
        plan_cancel_at_period_end?: boolean;
      };
      const s = data.status;
      setOrgStatus(s === 'approved' ? 'approved' : 'none');
      if (s === 'approved') {
        if (!data.stripe_account_id) setStripeStatus('disconnected');
        else if (!data.stripe_charges_enabled) setStripeStatus('pending');
        else setStripeStatus('connected');
        setPlan(data.plan === 'pro' ? 'pro' : 'free');
        setPlanPeriodEnd(data.plan_period_end ?? null);
        setPlanCancelAtPeriodEnd(data.plan_cancel_at_period_end ?? false);
      }
    }
    void checkOrg();
  }, [solanaWalletAddress, statusNonce]);

  useEffect(() => {
    if (orgStatus === 'none') router.push('/become-organizer');
  }, [orgStatus, router]);

  useEffect(() => {
    if (!solanaWalletAddress || eventsLoaded || orgStatus !== 'approved') return;
    async function loadEvents(): Promise<void> {
      try {
        const res = await fetch(`/api/events/list?organizerWallet=${solanaWalletAddress}`);
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
  }, [solanaWalletAddress, eventsLoaded, orgStatus]);

  // After returning from Stripe Express onboarding, refresh Connect status from Stripe.
  useEffect(() => {
    const stripeParam = new URLSearchParams(window.location.search).get('stripe');
    if ((stripeParam !== 'return' && stripeParam !== 'refresh') || !solanaWalletAddress) return;
    async function refreshStripeStatus(): Promise<void> {
      setStripeStatus('loading');
      try {
        const r = await fetch(`/api/stripe/connect/status?walletAddress=${solanaWalletAddress}`);
        const data = (await r.json()) as { connected: boolean; charges_enabled?: boolean };
        if (!data.connected) setStripeStatus('disconnected');
        else if (!data.charges_enabled) setStripeStatus('pending');
        else setStripeStatus('connected');
      } catch {
        setStripeStatus('disconnected');
      }
    }
    void refreshStripeStatus();
  }, [solanaWalletAddress]);

  if (!ready || !authenticated) return null;

  const ownerWallet = solanaWalletAddress;
  const email = user?.email?.address ?? '';
  const displayName = email ? email.split('@')[0] : 'Organizer';
  const loadingEvents = !!ownerWallet && !eventsLoaded;

  const totalRevenueCents = events.reduce((a, e) => a + e.tickets_sold * e.price_eur, 0);
  const activeEvents = events.filter((e) => isUpcoming(e.date)).length;
  const nextEvent = [...events]
    .filter((e) => isUpcoming(e.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const deltaPct = soldPrev7 > 0
    ? Math.round(((soldLast7 - soldPrev7) / soldPrev7) * 1000) / 10
    : null;

  function resetForm(): void {
    setEventName('');
    setEventDate('');
    setVenue('');
    setDescription('');
    setTiers([{ name: 'Standard', priceEur: '0', capacity: '100' }]);
    setIsPrivate(false);
    setPayoutHoldDays('0');
    setImageFile(null);
    setAccentHue(null);
    setBorderStyle(null);
    setFormError(null);
    setShopLink(null);
    setCopied(false);
  }

  function closeDrawer(): void {
    if (creating) return;
    setDrawerOpen(false);
    resetForm();
  }

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

  async function handleCreateEvent(): Promise<void> {
    if (!ownerWallet) {
      setFormError('Dein Konto ist noch nicht bereit. Bitte versuche es gleich noch einmal.');
      return;
    }
    const trimmedName = eventName.trim();
    if (!trimmedName || !eventDate) {
      setFormError('Name und Datum sind Pflichtfelder.');
      return;
    }
    const parsedTiers = tiers.map((t) => ({
      name: t.name,
      priceEur: Number(t.priceEur) || 0,
      capacity: Math.floor(Number(t.capacity)) || 0,
    }));
    for (const t of parsedTiers) {
      if (!t.name.trim()) {
        setFormError('Jede Ticketkategorie braucht einen Namen.');
        return;
      }
      if (t.priceEur < 0) {
        setFormError(`Der Preis für „${t.name.trim()}" muss 0 oder größer sein.`);
        return;
      }
      if (!Number.isInteger(t.capacity) || t.capacity < 1) {
        setFormError(`Die Ticketanzahl für „${t.name.trim()}" muss mindestens 1 sein.`);
        return;
      }
    }
    const tierNames = new Set(parsedTiers.map((t) => t.name.trim().toLowerCase()));
    if (tierNames.size !== parsedTiers.length) {
      setFormError('Die Namen der Ticketkategorien müssen eindeutig sein.');
      return;
    }
    const totalCapacity = parsedTiers.reduce((sum, t) => sum + t.capacity, 0);
    if (totalCapacity > 10000) {
      setFormError('Insgesamt sind höchstens 10.000 Tickets möglich.');
      return;
    }
    const parsedHoldDays = Math.floor(Number(payoutHoldDays)) || 0;
    if (!Number.isInteger(parsedHoldDays) || parsedHoldDays < 0 || parsedHoldDays > 90) {
      setFormError('Der Auszahlungs-Puffer muss zwischen 0 und 90 Tagen liegen.');
      return;
    }
    if (imageFile && !['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) {
      setFormError('Das Event-Bild muss ein JPEG, PNG oder WebP sein.');
      return;
    }
    if (imageFile && imageFile.size > 4 * 1024 * 1024) {
      setFormError('Das Event-Bild darf höchstens 4 MB groß sein.');
      return;
    }

    setFormError(null);
    setShopLink(null);
    setCopied(false);
    setCreating(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setFormError('Nicht angemeldet. Bitte melde dich ab und wieder an.');
        return;
      }

      let imageUrl: string | undefined;
      if (imageFile) {
        const form = new FormData();
        form.append('organizer_wallet', ownerWallet);
        form.append('file', imageFile);
        const uploadRes = await fetch('/api/events/upload-image', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const uploadData = (await uploadRes.json()) as
          | { success: true; url: string }
          | { success: false; error: string };
        if (!uploadRes.ok || !uploadData.success) {
          const message = !uploadData.success ? uploadData.error : `HTTP ${uploadRes.status}`;
          setFormError(`Bild-Upload fehlgeschlagen: ${message}`);
          return;
        }
        imageUrl = uploadData.url;
      }

      const createRes = await fetch('/api/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organizer_wallet: ownerWallet,
          name: trimmedName,
          date: eventDate,
          tiers: parsedTiers.map((t) => ({
            name: t.name.trim(),
            price_eur: Math.round(t.priceEur * 100),
            capacity: t.capacity,
          })),
          is_private: isPrivate,
          payout_hold_days: parsedHoldDays,
          accent_hue: accentHue,
          border_style: borderStyle,
          ...(venue.trim() ? { venue: venue.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(imageUrl ? { image_url: imageUrl } : {}),
        }),
      });
      const createData = (await createRes.json()) as
        | { success: true; id: string }
        | { success: false; error: string };
      if (!createRes.ok || !createData.success) {
        const message = !createData.success ? createData.error : `HTTP ${createRes.status}`;
        setFormError(`Speichern fehlgeschlagen: ${message}`);
        return;
      }
      const eventId = createData.id;
      const link = `${window.location.origin}/shop/${eventId}`;
      setShopLink(link);
      setEvents((prev) => [
        {
          id: eventId,
          name: trimmedName,
          date: eventDate,
          venue: venue.trim() || null,
          price_eur: Math.round(Math.min(...parsedTiers.map((t) => t.priceEur)) * 100),
          capacity: parsedTiers.reduce((sum, t) => sum + t.capacity, 0),
          tickets_sold: 0,
          is_private: isPrivate,
          image_url: imageUrl ?? null,
          accent_hue: accentHue,
          border_style: borderStyle,
        },
        ...prev,
      ]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setCreating(false);
    }
  }

  const canSave = !!eventName.trim() && !!eventDate
    && tiers.length > 0 && tiers.every((t) => t.name.trim() && (Number(t.capacity) || 0) > 0)
    && !creating && !shopLink;

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/dashboard" className="active">Übersicht</Link>
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
                  <div className="eyebrow"><span className="pulse" /> Willkommen zurück{displayName !== 'Organizer' ? `, ${displayName}` : ''}</div>
                  <h1>Deine Veranstaltungen <br />auf einen Blick.</h1>
                  <p className="lead">
                    Erstelle Tickets, teile sie per Link und prüfe den Einlass — alles fälschungssicher, ohne Papierchaos.
                  </p>
                  <div className="row gap-2" style={{ marginTop: 22 }}>
                    <button className="btn primary lg" onClick={() => setDrawerOpen(true)}>
                      <Icon name="plus" size={15} /> Veranstaltung erstellen
                    </button>
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
                      {nextEvent ? shortDate(nextEvent.date) : '—'}
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
                            : 'Verbinde Stripe, um Einnahmen ausgezahlt zu bekommen. Du erhältst 100 % deines Ticketpreises — Käufer zahlen eine kleine Servicegebühr obendrauf.'}
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
                          : 'Kenne deine Stammgäste, schreibe allen Ticketinhabern und belohne Wiederkehrer mit deinem eigenen Treueprogramm — alles in einem Abo, jederzeit kündbar.'}
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
                      <button
                        className="event-card"
                        onClick={() => setDrawerOpen(true)}
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
                      </button>
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

        {drawerOpen && (
          <>
            <div className="drawer-backdrop" onClick={closeDrawer} />
            <div className="drawer" role="dialog" aria-labelledby="drawerTitle">
              <div className="drawer-head">
                <h3 id="drawerTitle">Neue Veranstaltung</h3>
                <p>Wir erstellen automatisch fälschungssichere Tickets mit QR-Code.</p>
              </div>
              <div className="drawer-body">
                {shopLink ? (
                  <div>
                    <div style={{
                      padding: 14, borderRadius: 10,
                      background: 'var(--ok-wash)', border: '1px solid oklch(0.86 0.08 150)',
                      display: 'flex', gap: 10, marginBottom: 16,
                    }}>
                      <div style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 1 }}><Icon name="check" size={16} /></div>
                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                        <b>Veranstaltung erstellt.</b> Teile diesen Link, damit Gäste Tickets bekommen:
                      </div>
                    </div>
                    <div className="field">
                      <label>Ticket-Link</label>
                      <input className="input mono" readOnly value={shopLink} onFocus={(e) => e.target.select()} style={{ fontSize: 12 }} />
                    </div>
                    <button
                      className="btn ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(shopLink).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                      }}
                    >
                      <Icon name="share" size={13} /> {copied ? 'Kopiert!' : 'Link kopieren'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label>Name der Veranstaltung</label>
                      <input className="input" placeholder="z. B. Sommerkonzert 2026" value={eventName}
                        onChange={(e) => setEventName(e.target.value)} maxLength={120} disabled={creating} />
                    </div>
                    <div className="field">
                      <label>Datum</label>
                      <div className="date-field">
                        <span className="date-field-icon"><Icon name="calendar" size={15} /></span>
                        <input type="date" className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} disabled={creating} />
                      </div>
                      {eventDate && (
                        <span className="date-preview">
                          <Icon name="calendar" size={12} /> {formatDateLong(eventDate)}
                        </span>
                      )}
                    </div>
                    <div className="field">
                      <label>Veranstaltungsort</label>
                      <input className="input" placeholder="z. B. Aula der Schule, Augsburg" value={venue}
                        onChange={(e) => setVenue(e.target.value)} maxLength={200} disabled={creating} />
                    </div>
                    <div className="field">
                      <label>Ticketkategorien</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {tiers.map((t, i) => (
                          <div key={i} style={{
                            padding: 12, borderRadius: 10,
                            border: '1px solid var(--line-2)', background: 'var(--surface)',
                            display: 'flex', flexDirection: 'column', gap: 8,
                          }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input className="input" placeholder="z. B. Early Bird, VIP" value={t.name} maxLength={80}
                                onChange={(e) => setTiers((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                                disabled={creating} />
                              {tiers.length > 1 && (
                                <button type="button" className="close-btn" aria-label="Kategorie entfernen"
                                  onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))} disabled={creating}>
                                  <Icon name="x" size={14} />
                                </button>
                              )}
                            </div>
                            <div className="field-row" style={{ marginBottom: 0 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span className="hint">Preis pro Ticket (€)</span>
                                <input type="number" className="input" value={t.priceEur} min={0} step={0.5}
                                  onChange={(e) => setTiers((prev) => prev.map((x, j) => j === i ? { ...x, priceEur: e.target.value } : x))}
                                  disabled={creating} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span className="hint">Anzahl Tickets</span>
                                <input type="number" className="input" value={t.capacity} min={1} max={10000}
                                  onChange={(e) => setTiers((prev) => prev.map((x, j) => j === i ? { ...x, capacity: e.target.value } : x))}
                                  disabled={creating} />
                              </div>
                            </div>
                          </div>
                        ))}
                        {tiers.length < MAX_TIERS && (
                          <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }}
                            onClick={() => setTiers((prev) => [...prev, { name: '', priceEur: '0', capacity: '50' }])}
                            disabled={creating}>
                            + Kategorie hinzufügen
                          </button>
                        )}
                      </div>
                      <span className="hint">Preis 0 = kostenlos. Mit mehreren Kategorien (z. B. Early Bird, VIP) wählen Gäste beim Kauf.</span>
                    </div>
                    <div className="field">
                      <label>Beschreibung (optional)</label>
                      <textarea className="textarea" rows={3} placeholder="Kurzer Hinweis für Gäste …" value={description}
                        onChange={(e) => setDescription(e.target.value)} maxLength={2000} disabled={creating} />
                    </div>
                    <div className="field">
                      <label>Event-Bild (optional)</label>
                      <input type="file" className="input" accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} disabled={creating} />
                      <span className="hint">JPEG, PNG oder WebP, max. 4 MB. Erscheint auf der Ticketseite.</span>
                    </div>
                    <EventStyleFields
                      accentHue={accentHue}
                      onAccentHueChange={setAccentHue}
                      borderStyle={borderStyle}
                      onBorderStyleChange={setBorderStyle}
                      isPro={plan === 'pro'}
                      disabled={creating}
                    />
                    <div className="field">
                      <label>Sichtbarkeit</label>
                      <div className="seg">
                        <button type="button" className={!isPrivate ? 'active' : ''} onClick={() => setIsPrivate(false)} disabled={creating}>Öffentlich</button>
                        <button type="button" className={isPrivate ? 'active' : ''} onClick={() => setIsPrivate(true)} disabled={creating}>Privat</button>
                      </div>
                      <span className="hint">
                        {isPrivate ? 'Nur über den direkten Link erreichbar.' : 'Erscheint in der öffentlichen Event-Liste.'}
                      </span>
                    </div>
                    {tiers.some((t) => (Number(t.priceEur) || 0) > 0) && (
                      <div className="field">
                        <label>Auszahlungs-Puffer (Tage nach dem Event)</label>
                        <input type="number" className="input" value={payoutHoldDays} min={0} max={90} step={1}
                          onChange={(e) => setPayoutHoldDays(e.target.value)} disabled={creating} />
                        <span className="hint">
                          0 = tägliche automatische Auszahlung. Ein Puffer hält Einnahmen als Rückbuchungsschutz, bis N Tage nach dem Event vergangen sind.
                        </span>
                      </div>
                    )}

                    <div style={{
                      marginTop: 18, padding: 14, borderRadius: 10,
                      background: 'var(--accent-wash)', border: '1px solid var(--accent-line)',
                      display: 'flex', gap: 10,
                    }}>
                      <div style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><Icon name="shield" size={16} /></div>
                      <div style={{ fontSize: 12.5, color: 'var(--accent-ink)', lineHeight: 1.5 }}>
                        <b style={{ color: 'var(--accent-ink)' }}>Fälschungsschutz ist aktiv.</b> Jedes Ticket erhält einen einzigartigen QR-Code. Kopien werden beim Einlass automatisch erkannt.
                      </div>
                    </div>

                    {formError && (
                      <div style={{ marginTop: 14, fontSize: 13, color: 'var(--bad)', lineHeight: 1.5 }}>{formError}</div>
                    )}
                  </>
                )}
              </div>
              <div className="drawer-foot">
                <button className="btn ghost" onClick={closeDrawer} disabled={creating}>
                  {shopLink ? 'Schließen' : 'Abbrechen'}
                </button>
                {!shopLink && (
                  <button className="btn primary" disabled={!canSave} onClick={() => void handleCreateEvent()}>
                    {creating ? 'Wird erstellt …' : (<>Veranstaltung erstellen <Icon name="arrow" size={13} /></>)}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {!showProCelebration && <ProfileNudge walletAddress={ownerWallet} />}

      {showProCelebration && (
        <Celebration
          emoji="🚀"
          title="Willkommen bei Passly Pro!"
          message="Herzlichen Glückwunsch — Analytics über alle Events, Gäste-Nachrichten und dein Treueprogramm sind jetzt für dich freigeschaltet. Zeit, deine Stammgäste zu begeistern."
          actionLabel="Zum Pro-Bereich"
          actionHref="/dashboard/analytics"
          onClose={() => setShowProCelebration(false)}
        />
      )}
    </>
  );
}
