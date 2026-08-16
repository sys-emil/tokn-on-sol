'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { useEffect, useMemo, useState } from 'react';
import type { FeePayer } from '@/lib/fees';

interface TicketRow {
  assetId: string;
  serial: string;
  email: string | null;
  issuedAt: string;
  status: 'valid' | 'checked' | 'revoked';
}

interface EventData {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  venue: string | null;
  description: string | null;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  is_private: boolean;
  payout_hold_days: number;
  resale_max_markup_pct: number | null;
  fee_payer: FeePayer | null;
  guest_checkout_enabled: boolean;
  queue_enabled: boolean;
  queue_slots: number;
  image_url: string | null;
  long_description: string | null;
  gallery_urls: string[] | null;
  accent_hue: number | null;
  border_style: string | null;
  cancelled_at: string | null;
}

interface TierRow {
  id: string;
  name: string;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  tickets_reserved: number;
}


const PAGE_SIZE = 12;

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
const shortStamp = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

function isUpcoming(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + 'T00:00:00').getTime() >= today.getTime();
}

function isEventDay(iso: string): boolean {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return iso === today;
}

interface DiscountCode {
  id: string;
  code: string;
  percentOff: number;
  maxUses: number | null;
  uses: number;
}

interface DoorLink {
  id: string;
  token: string;
  label: string | null;
  expiresAt: string;
}

interface EventApiResponse {
  event: EventData;
  tiers: TierRow[];
  tickets: TicketRow[];
  stats: { checkedIn: number; revoked: number };
  /** Season-pass holders admitted to this date; not part of `tickets`. */
  passStats?: { total: number; checkedIn: number };
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const walletAddress = solanaWallets[0]?.address;

  const [event, setEvent] = useState<EventData | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [checkedIn, setCheckedIn] = useState(0);
  const [passStats, setPassStats] = useState<{ total: number; checkedIn: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConfirmText, setCancelConfirmText] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelResult, setCancelResult] = useState<string | null>(null);

  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [messageOpen, setMessageOpen] = useState(false);
  const [msgSubject, setMsgSubject] = useState('');
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [msgSent, setMsgSent] = useState<number | null>(null);

  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [codeName, setCodeName] = useState('');
  const [codePercent, setCodePercent] = useState(20);
  const [codeMaxUses, setCodeMaxUses] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState<string | null>(null);

  const [doorLinks, setDoorLinks] = useState<DoorLink[]>([]);
  const [doorLabel, setDoorLabel] = useState('');
  const [doorBusy, setDoorBusy] = useState(false);
  const [doorError, setDoorError] = useState<string | null>(null);
  const [copiedDoorId, setCopiedDoorId] = useState<string | null>(null);

  const [filter, setFilter] = useState<'all' | 'valid' | 'checked'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [copiedShop, setCopiedShop] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!ready || !authenticated || !id || loaded) return;
    async function load(): Promise<void> {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/organizer/event?id=${id}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (!res.ok) {
          setLoadError(res.status === 401 ? 'Kein Zugriff auf diese Veranstaltung.' : 'Veranstaltung nicht gefunden.');
          return;
        }
        const data = (await res.json()) as EventApiResponse;
        setEvent(data.event);
        setTiers(data.tiers ?? []);
        setTickets(data.tickets);
        setCheckedIn(data.stats.checkedIn);
        setPassStats(data.passStats ?? null);
      } catch {
        setLoadError('Verbindungsfehler. Bitte lade die Seite neu.');
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [ready, authenticated, id, loaded, getAccessToken]);

  useEffect(() => {
    if (!walletAddress) return;
    async function checkPlan(): Promise<void> {
      const token = await getAccessToken();
      const res = await fetch(`/api/organizers/status?walletAddress=${walletAddress}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { plan?: string };
      setPlan(data.plan === 'pro' ? 'pro' : 'free');
    }
    void checkPlan();
  }, [walletAddress, getAccessToken]);

  // Live refresh on the day of the event: doormen write redemptions while the
  // organizer watches this page, so the check-in numbers poll every 30 s.
  const liveDay = Boolean(event && !event.cancelled_at && isEventDay(event.date));
  useEffect(() => {
    if (!liveDay || !id || !loaded) return;
    let stopped = false;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const token = await getAccessToken();
          const res = await fetch(`/api/organizer/event?id=${id}`, {
            headers: { Authorization: `Bearer ${token ?? ''}` },
          });
          if (!res.ok || stopped) return;
          const data = (await res.json()) as EventApiResponse;
          if (stopped) return;
          setEvent(data.event);
          setTiers(data.tiers ?? []);
          setTickets(data.tickets);
          setCheckedIn(data.stats.checkedIn);
          setPassStats(data.passStats ?? null);
        } catch {
          // transient, next tick retries
        }
      })();
    }, 30_000);
    return () => { stopped = true; clearInterval(timer); };
  }, [liveDay, id, loaded, getAccessToken]);

  // Door access links load once after the event itself, not part of the
  // 30 s live polling, they only change through actions on this page.
  useEffect(() => {
    if (!loaded || !event || !id) return;
    let cancelled = false;
    async function loadLinks(): Promise<void> {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/organizer/door-links?eventId=${id}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { links: DoorLink[] };
        if (!cancelled) setDoorLinks(data.links);
      } catch {
        // non-critical, the card just shows no links
      }
    }
    void loadLinks();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, id]);

  // Discount codes are Pro, so the card only renders (and this only loads)
  // when the plan check came back 'pro'.
  useEffect(() => {
    if (plan !== 'pro' || !walletAddress || !id) return;
    let cancelled = false;
    async function loadCodes(): Promise<void> {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/organizer/discount-codes?walletAddress=${walletAddress}&eventId=${id}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { codes: DiscountCode[] };
        if (!cancelled) setCodes(data.codes);
      } catch {
        // non-critical
      }
    }
    void loadCodes();
    return () => { cancelled = true; };
  }, [plan, walletAddress, id, getAccessToken]);

  async function createCode(): Promise<void> {
    if (!walletAddress || !id || codeBusy) return;
    setCodeBusy(true);
    setCodeErr(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/organizer/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({
          walletAddress,
          eventId: id,
          code: codeName,
          percentOff: codePercent,
          maxUses: codeMaxUses.trim() === '' ? null : Number(codeMaxUses),
        }),
      });
      const data = (await res.json()) as { code?: DiscountCode; error?: string };
      if (!res.ok || !data.code) {
        setCodeErr(data.error ?? 'Anlegen fehlgeschlagen.');
        return;
      }
      setCodes((prev) => [data.code!, ...prev]);
      setCodeName('');
      setCodeMaxUses('');
    } catch {
      setCodeErr('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setCodeBusy(false);
    }
  }

  async function deactivateCode(codeId: string): Promise<void> {
    if (!walletAddress || codeBusy) return;
    setCodeBusy(true);
    setCodeErr(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/organizer/discount-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ walletAddress, codeId }),
      });
      if (res.ok) setCodes((prev) => prev.filter((c) => c.id !== codeId));
      else setCodeErr('Deaktivieren fehlgeschlagen.');
    } catch {
      setCodeErr('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setCodeBusy(false);
    }
  }

  async function createDoorLink(): Promise<void> {
    if (!id || doorBusy) return;
    setDoorBusy(true);
    setDoorError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/organizer/door-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ eventId: id, label: doorLabel }),
      });
      const data = (await res.json()) as { link?: DoorLink; error?: string };
      if (!res.ok || !data.link) {
        setDoorError(data.error ?? 'Link konnte nicht erstellt werden.');
        return;
      }
      setDoorLinks((prev) => [data.link!, ...prev]);
      setDoorLabel('');
    } catch {
      setDoorError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setDoorBusy(false);
    }
  }

  async function revokeDoorLink(linkId: string): Promise<void> {
    if (doorBusy) return;
    setDoorBusy(true);
    setDoorError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/organizer/door-links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ linkId }),
      });
      if (res.ok) setDoorLinks((prev) => prev.filter((l) => l.id !== linkId));
      else setDoorError('Widerruf fehlgeschlagen. Bitte versuch es erneut.');
    } catch {
      setDoorError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setDoorBusy(false);
    }
  }

  function copyDoorLink(link: DoorLink): void {
    if (!event) return;
    void navigator.clipboard
      .writeText(`${window.location.origin}/doorman/${event.id}?key=${link.token}`)
      .then(() => {
        setCopiedDoorId(link.id);
        setTimeout(() => setCopiedDoorId(null), 2000);
      });
  }

  async function sendMessage(): Promise<void> {
    if (!walletAddress || !event || msgSending) return;
    setMsgError(null);
    const token = await getAccessToken();
    if (!token) { setMsgError('Nicht angemeldet. Bitte melde dich ab und wieder an.'); return; }
    setMsgSending(true);
    try {
      const res = await fetch('/api/organizer/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress, eventId: event.id, subject: msgSubject, text: msgText }),
      });
      const data = (await res.json()) as { success: boolean; recipientCount?: number; error?: string };
      if (data.success) {
        setMsgSent(data.recipientCount ?? 0);
        setMsgSubject('');
        setMsgText('');
      } else {
        setMsgError(data.error ?? 'Senden fehlgeschlagen.');
      }
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : 'Senden fehlgeschlagen.');
    } finally {
      setMsgSending(false);
    }
  }

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (filter === 'valid' && t.status !== 'valid') return false;
      if (filter === 'checked' && t.status !== 'checked') return false;
      if (query) {
        const q = query.toLowerCase();
        if (!((t.email ?? '').toLowerCase().includes(q) || t.serial.includes(q))) return false;
      }
      return true;
    });
  }, [tickets, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(pageClamped * PAGE_SIZE, (pageClamped + 1) * PAGE_SIZE);

  if (!ready || !authenticated) return null;

  const upcoming = event ? isUpcoming(event.date) : false;
  const pct = event && event.capacity > 0 ? Math.round((event.tickets_sold / event.capacity) * 100) : 0;
  const revenueCents = tiers.length > 0
    ? tiers.reduce((sum, t) => sum + t.tickets_sold * t.price_eur, 0)
    : event ? event.tickets_sold * event.price_eur : 0;
  const redemptionPct = event && event.tickets_sold > 0 ? Math.round((checkedIn / event.tickets_sold) * 100) : 0;

  const copyShopLink = () => {
    if (!event) return;
    void navigator.clipboard.writeText(`${window.location.origin}/event/${event.id}`).then(() => {
      setCopiedShop(true);
      setTimeout(() => setCopiedShop(false), 2000);
    });
  };

  const cancelled = Boolean(event?.cancelled_at);

  // "Event duplizieren": hand the form values (everything except the date)
  // to the create editor via sessionStorage.
  function duplicateEvent(): void {
    if (!event) return;
    try {
      sessionStorage.setItem('passly_duplicate_event', JSON.stringify({
        name: event.name,
        startTime: event.start_time,
        venue: event.venue,
        description: event.description,
        isPrivate: event.is_private,
        payoutHoldDays: event.payout_hold_days ?? 0,
        feePayer: event.fee_payer,
        resaleMaxMarkupPct: event.resale_max_markup_pct,
        accentHue: event.accent_hue,
        borderStyle: event.border_style,
        tiers: tiers.map((t) => ({ name: t.name, priceEur: String(t.price_eur / 100), capacity: String(t.capacity) })),
      }));
    } catch { /* private mode, the editor just opens empty */ }
    router.push('/dashboard/events/neu');
  }

  async function confirmCancel(): Promise<void> {
    if (!event || cancelBusy || !walletAddress) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/events/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ eventId: event.id, organizer_wallet: walletAddress, action: 'cancel' }),
      });
      const data = (await res.json()) as {
        success: boolean;
        error?: string;
        refunded?: number;
        skipped?: { session: string; reason: string }[];
        failed?: { session: string; error: string }[];
      };
      if (!res.ok || !data.success) {
        setCancelError(data.error ?? `Absagen fehlgeschlagen (HTTP ${res.status}).`);
        return;
      }
      const parts = [`${data.refunded ?? 0} Zahlung(en) erstattet`];
      if (data.skipped && data.skipped.length > 0) parts.push(`${data.skipped.length} übersprungen (manuell klären)`);
      if (data.failed && data.failed.length > 0) parts.push(`${data.failed.length} fehlgeschlagen`);
      setCancelResult(parts.join(' · '));
      setLoaded(false); // reload, event is now cancelled
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Absagen fehlgeschlagen.');
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/dashboard" className="active">Übersicht</Link>
              <Link href="/events">Events</Link>
              <Link href="/my-tickets">Meine Tickets</Link>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="container">

            {/* Kopfzeile, Aktionsknoepfe und das zweispaltige Detailraster —
                dieselbe Anordnung wie unten, damit die Seite beim Eintreffen
                der Daten nicht komplett neu aufgebaut wird. */}
            {!loaded && (
              <div aria-busy="true" aria-label="Veranstaltung wird geladen">
                <div className="crumbs">
                  <span className="sk" style={{ display: 'inline-block', width: 116, height: 10 }} />
                </div>
                <div className="row gap-3" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
                  <div style={{ maxWidth: 640, display: 'grid', gap: 10 }}>
                    <div className="sk" style={{ width: 78, height: 20, borderRadius: 6 }} />
                    <div className="sk" style={{ width: 320, maxWidth: '100%', height: 28 }} />
                    <div className="sk" style={{ width: 236, height: 12 }} />
                  </div>
                  <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                    {[104, 108, 128].map((w, i) => (
                      <div key={i} className="sk block" style={{ width: w, height: 36 }} />
                    ))}
                  </div>
                </div>
                <div className="detail-grid">
                  {[0, 1].map((col) => (
                    <div key={col} className="card" style={{ padding: 20 }}>
                      <div className="sk" style={{ width: 178, height: 13 }} />
                      <div className="sk" style={{ width: 214, height: 10, marginTop: 8 }} />
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 16 }}>
                          <div className="sk" style={{ width: `${52 - i * 5}%`, height: 11 }} />
                          <div className="sk" style={{ width: 72, height: 11, flex: 'none' }} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {loaded && loadError && <div className="empty">{loadError}</div>}

            {loaded && event && (
              <>
                <div className="crumbs">
                  <Link href="/dashboard">Veranstaltungen</Link>
                  <span className="sep">/</span>
                  <span style={{ color: 'var(--ink)' }}>{event.name}</span>
                </div>

                <div className="row gap-3" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
                  <div style={{ maxWidth: 640 }}>
                    <div className="row gap-2" style={{ marginBottom: 10 }}>
                      {cancelled ? (
                        <span className="chip bad"><span className="d" />Abgesagt</span>
                      ) : (
                        <span className={'chip ' + (upcoming ? 'ok' : '')}><span className="d" />{upcoming ? 'Aktiv' : 'Vorbei'}</span>
                      )}
                      {event.is_private && <span className="chip"><span className="d" />Privat</span>}
                      <span className="chip"><Icon name="shield" size={11} /> Fälschungsgeschützt</span>
                    </div>
                    <h1 style={{ fontSize: 30, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1 }}>{event.name}</h1>
                    <div className="row gap-3" style={{ marginTop: 10, color: 'var(--ink-3)', fontSize: 13.5, flexWrap: 'wrap' }}>
                      <span className="row gap-2"><Icon name="calendar" size={14} />{formatDate(event.date)}</span>
                      {event.start_time && <span className="row gap-2"><Icon name="clock" size={14} />{event.start_time} Uhr</span>}
                      {event.venue && <span className="row gap-2"><Icon name="location" size={14} />{event.venue}</span>}
                      <span className="row gap-2"><Icon name="euro" size={14} />{event.price_eur === 0 ? 'Kostenlos' : `${eur(event.price_eur)} pro Ticket`}</span>
                    </div>
                    {event.description && (
                      <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, maxWidth: 560 }}>
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                    {!cancelled && (
                      <Link href={`/dashboard/events/${event.id}/bearbeiten`} className="btn ghost">
                        <Icon name="edit" size={14} /> Bearbeiten
                      </Link>
                    )}
                    <button className="btn ghost" onClick={copyShopLink}>
                      <Icon name="share" size={14} /> {copiedShop ? 'Kopiert!' : 'Link teilen'}
                    </button>
                    <Link href={`/doorman/${event.id}`} className="btn primary">
                      <Icon name="scan" size={14} /> Einlass-Modus
                    </Link>
                  </div>
                </div>

                <div className="detail-grid">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>Ausgestellte Tickets</h3>
                        <div className="sub">{event.tickets_sold} Tickets · {checkedIn} bereits eingelöst</div>
                      </div>
                      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="input"
                            placeholder="E-Mail oder Nr."
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                            style={{ padding: '7px 10px 7px 32px', fontSize: 12.5, width: 180, maxWidth: '100%' }}
                          />
                          <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--ink-3)' }}>
                            <Icon name="search" size={13} />
                          </span>
                        </div>
                        <div className="seg">
                          <button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setPage(0); }}>Alle</button>
                          <button className={filter === 'valid' ? 'active' : ''} onClick={() => { setFilter('valid'); setPage(0); }}>Gültig</button>
                          <button className={filter === 'checked' ? 'active' : ''} onClick={() => { setFilter('checked'); setPage(0); }}>Eingelöst</button>
                        </div>
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      {filtered.length === 0 ? (
                        <div className="empty">
                          {tickets.length === 0 ? 'Noch keine Tickets verkauft.' : 'Kein passendes Ticket gefunden.'}
                        </div>
                      ) : (
                        <table className="ticket-table">
                          <thead>
                            <tr>
                              <th style={{ width: 52 }}></th>
                              <th style={{ width: 72 }}>Nr.</th>
                              <th>Gast</th>
                              <th>Ausgestellt</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageRows.map((t) => (
                              <tr key={t.assetId} onClick={() => window.open(`/tickets/${t.assetId}`, '_blank')} style={{ cursor: 'pointer' }}>
                                <td>
                                  <div className="row-qr"><Icon name="qr" size={14} /></div>
                                </td>
                                <td className="mono">#{t.serial}</td>
                                <td>
                                  <div style={{ fontWeight: 500 }}>{t.email ?? 'Ohne E-Mail'}</div>
                                </td>
                                <td style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>{shortStamp(t.issuedAt)}</td>
                                <td>
                                  {t.status === 'valid' && <span className="chip ok"><span className="d" />Gültig</span>}
                                  {t.status === 'checked' && <span className="chip"><span className="d" />Eingelöst</span>}
                                  {t.status === 'revoked' && <span className="chip bad"><span className="d" />Storniert</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {filtered.length > 0 && (
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>
                          <span>{pageRows.length} von {filtered.length} Tickets</span>
                          {pageCount > 1 && (
                            <div className="row gap-2">
                              <button className="btn ghost sm" aria-label="Vorherige Seite" disabled={pageClamped === 0} onClick={() => setPage(pageClamped - 1)}>
                                <Icon name="chevronLeft" size={12} />
                              </button>
                              <span>{pageClamped + 1} / {pageCount}</span>
                              <button className="btn ghost sm" aria-label="Nächste Seite" disabled={pageClamped >= pageCount - 1} onClick={() => setPage(pageClamped + 1)}>
                                <Icon name="chevronRight" size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {liveDay && (
                      <div className="card" style={{ padding: 22, borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent), var(--shadow-sm)' }}>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                            Einlass heute
                          </div>
                          <span className="chip ok"><span className="d" />Live</span>
                        </div>
                        <div style={{ fontSize: 34, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                          {checkedIn}
                          <span style={{ fontSize: 18, color: 'var(--ink-3)', fontWeight: 500 }}> / {event.tickets_sold} eingecheckt</span>
                        </div>
                        <div className="progress" style={{ marginTop: 10 }}><span style={{ width: redemptionPct + '%' }} /></div>
                        {passStats && passStats.total > 0 && (
                          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)' }}>
                            Dazu {passStats.checkedIn} von {passStats.total} Saisonpässen eingecheckt.
                          </div>
                        )}
                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>
                          Aktualisiert sich alle 30 Sekunden automatisch.
                        </div>
                      </div>
                    )}

                    <div className="card" style={{ padding: 22 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                        Verkauf
                      </div>
                      <div style={{ fontSize: 34, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {event.tickets_sold}
                        <span style={{ fontSize: 18, color: 'var(--ink-3)', fontWeight: 500 }}> / {event.capacity}</span>
                      </div>
                      <div className="progress" style={{ marginTop: 10 }}><span style={{ width: pct + '%' }} /></div>
                      {tiers.length > 1 && (
                        <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12, display: 'grid', gap: 8 }}>
                          {tiers.map((t) => (
                            <div key={t.id} className="row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
                              <span className="muted">{t.name} · {t.price_eur === 0 ? 'kostenlos' : eur(t.price_eur)}</span>
                              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{t.tickets_sold} / {t.capacity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, fontSize: 12.5 }}>
                        <span className="muted">Einnahmen</span>
                        <span style={{ fontWeight: 600 }}>{eur(revenueCents)}</span>
                      </div>
                      <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, fontSize: 12.5 }}>
                        <span className="muted">Einlöse-Quote</span>
                        <span style={{ fontWeight: 600 }}>{redemptionPct}%</span>
                      </div>
                    </div>

                    <div className="card" style={{ padding: 22 }}>
                      <div className="row gap-2" style={{ marginBottom: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-wash)', color: 'var(--accent)', display: 'grid', placeItems: 'center', border: '1px solid var(--accent-line)' }}>
                          <Icon name="shield" size={15} />
                        </div>
                        <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>Fälschungsschutz</h3>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
                        Jedes Ticket trägt einen eindeutigen Code. Kopien werden beim Einlass automatisch erkannt und abgelehnt.
                      </p>
                      <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14, display: 'grid', gap: 8, fontSize: 12.5 }}>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <span className="muted">Eindeutige Codes</span>
                          <span style={{ fontWeight: 500 }}>{event.tickets_sold} ausgestellt</span>
                        </div>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <span className="muted">Bereits eingelöst</span>
                          <span style={{ fontWeight: 500, color: 'var(--ok)' }}>{checkedIn}</span>
                        </div>
                        {passStats && passStats.total > 0 && (
                          <div className="row" style={{ justifyContent: 'space-between' }}>
                            <span className="muted">Saisonpässe für diesen Termin</span>
                            <span style={{ fontWeight: 500 }}>{passStats.checkedIn} / {passStats.total}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!cancelled && (
                      <div className="card" style={{ padding: 22 }}>
                        <div className="row gap-2" style={{ marginBottom: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-wash)', color: 'var(--accent)', display: 'grid', placeItems: 'center', border: '1px solid var(--accent-line)' }}>
                            <Icon name="scan" size={15} />
                          </div>
                          <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>Türsteher-Zugang</h3>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
                          Links für dein Einlass-Personal, öffnen den Scanner ohne dein Konto.
                          Gültig bis 2 Tage nach dem Event, jederzeit widerrufbar.
                        </p>
                        {doorLinks.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 6 }}>
                            {doorLinks.map((l) => (
                              <div key={l.id} className="row" style={{ justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {l.label || 'Einlass-Link'}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>bis {shortStamp(l.expiresAt)}</div>
                                </div>
                                <div className="row gap-2" style={{ flexShrink: 0 }}>
                                  <button className="btn ghost sm" onClick={() => copyDoorLink(l)}>
                                    {copiedDoorId === l.id ? 'Kopiert!' : 'Kopieren'}
                                  </button>
                                  <button
                                    className="btn ghost sm"
                                    aria-label="Zugang widerrufen"
                                    title="Zugang widerrufen"
                                    disabled={doorBusy}
                                    onClick={() => void revokeDoorLink(l.id)}
                                  >
                                    <Icon name="x" size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="row gap-2" style={{ marginTop: 12 }}>
                          <input
                            className="input"
                            placeholder="Name (optional), z. B. Alex"
                            value={doorLabel}
                            maxLength={60}
                            onChange={(e) => setDoorLabel(e.target.value)}
                            style={{ padding: '7px 10px', fontSize: 12.5, flex: 1, minWidth: 0 }}
                          />
                          <button className="btn ghost sm" disabled={doorBusy} onClick={() => void createDoorLink()}>
                            {doorBusy ? '…' : '+ Link'}
                          </button>
                        </div>
                        {doorError && (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--bad)' }}>{doorError}</div>
                        )}
                      </div>
                    )}

                    {!cancelled && plan === 'pro' && (
                      <div className="card" style={{ padding: 22 }}>
                        <div className="row gap-2" style={{ marginBottom: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-wash)', color: 'var(--accent)', display: 'grid', placeItems: 'center', border: '1px solid var(--accent-line)' }}>
                            <Icon name="sparkle" size={15} />
                          </div>
                          <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>Rabattcodes</h3>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
                          Prozent-Rabatt oder Gästeliste (100 %), Käufer geben den Code im Shop ein.
                        </p>
                        {codes.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 6 }}>
                            {codes.map((c) => (
                              <div key={c.id} className="row" style={{ justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                                <div style={{ minWidth: 0 }}>
                                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.04em' }}>{c.code}</div>
                                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                                    −{c.percentOff} % · {c.uses}{c.maxUses !== null ? ` / ${c.maxUses}` : ''} eingelöst
                                  </div>
                                </div>
                                <button
                                  className="btn ghost sm"
                                  aria-label="Code deaktivieren"
                                  title="Code deaktivieren"
                                  disabled={codeBusy}
                                  onClick={() => void deactivateCode(c.id)}
                                >
                                  <Icon name="x" size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                          <input
                            className="input mono"
                            placeholder="CODE, z. B. PRESALE25"
                            value={codeName}
                            maxLength={24}
                            onChange={(e) => setCodeName(e.target.value.toUpperCase())}
                            style={{ padding: '7px 10px', fontSize: 12.5, textTransform: 'uppercase' }}
                          />
                          <div className="row gap-2">
                            <input
                              className="input"
                              type="number"
                              min={1}
                              max={100}
                              value={codePercent}
                              onChange={(e) => setCodePercent(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                              aria-label="Rabatt in Prozent"
                              style={{ padding: '7px 10px', fontSize: 12.5, width: 74 }}
                            />
                            <span style={{ fontSize: 12.5, color: 'var(--ink-3)', alignSelf: 'center' }}>%</span>
                            <input
                              className="input"
                              type="number"
                              min={1}
                              placeholder="Max. (∞)"
                              value={codeMaxUses}
                              onChange={(e) => setCodeMaxUses(e.target.value)}
                              aria-label="Maximale Einlösungen"
                              style={{ padding: '7px 10px', fontSize: 12.5, flex: 1, minWidth: 0 }}
                            />
                            <button className="btn ghost sm" disabled={codeBusy || !codeName.trim()} onClick={() => void createCode()}>
                              {codeBusy ? '…' : '+ Code'}
                            </button>
                          </div>
                        </div>
                        {codeErr && (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--bad)' }}>{codeErr}</div>
                        )}
                      </div>
                    )}

                    <div className="card" style={{ padding: 22 }}>
                      <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10 }}>Schnellaktionen</h3>
                      <div className="stack" style={{ gap: 6 }}>
                        {!cancelled && (
                          <Link href={`/dashboard/events/${event.id}/bearbeiten`} className="btn ghost" style={{ justifyContent: 'flex-start' }}>
                            <Icon name="edit" size={14} /> Event bearbeiten
                          </Link>
                        )}
                        <button className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={copyShopLink}>
                          <Icon name="share" size={14} /> {copiedShop ? 'Kopiert!' : 'Event-Link kopieren'}
                        </button>
                        <Link href={`/doorman/${event.id}`} className="btn ghost" style={{ justifyContent: 'flex-start' }}>
                          <Icon name="scan" size={14} /> Einlass-Modus öffnen
                        </Link>
                        <Link href={`/event/${event.id}`} className="btn ghost" style={{ justifyContent: 'flex-start' }}>
                          <Icon name="ticket" size={14} /> Event-Seite ansehen
                        </Link>
                        <button className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={duplicateEvent}>
                          <Icon name="plus" size={14} /> Event duplizieren
                        </button>
                        {plan === 'pro' ? (
                          <button
                            className="btn ghost"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => { setMsgError(null); setMsgSent(null); setMessageOpen(true); }}
                          >
                            <Icon name="mail" size={14} /> Gäste kontaktieren
                          </button>
                        ) : (
                          <Link href="/dashboard/analytics" className="btn ghost" style={{ justifyContent: 'flex-start', color: 'var(--ink-3)' }}>
                            <Icon name="mail" size={14} /> Gäste kontaktieren <span className="chip accent" style={{ marginLeft: 'auto' }}>Pro</span>
                          </Link>
                        )}
                        {!cancelled && (
                          <button
                            className="btn ghost"
                            style={{ justifyContent: 'flex-start', color: 'var(--bad)' }}
                            onClick={() => { setCancelConfirmText(''); setCancelError(null); setCancelResult(null); setCancelOpen(true); }}
                          >
                            <Icon name="x" size={14} /> Event absagen
                          </button>
                        )}
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {messageOpen && event && (
        <div className="modal-backdrop" onClick={() => !msgSending && setMessageOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Gäste kontaktieren</h3>
              <button className="close-btn" aria-label="Schließen" onClick={() => setMessageOpen(false)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              {msgSent !== null ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <span className="chip ok"><span className="d" />Nachricht an {msgSent} Empfänger gesendet</span>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 14 }}>
                    Deine Nachricht geht per E-Mail an alle Ticketinhaber von „{event.name}“.
                    Maximal 2 Nachrichten pro Event in 24 Stunden.
                  </p>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Betreff</label>
                    <input className="input" value={msgSubject} maxLength={120} onChange={(e) => setMsgSubject(e.target.value)} placeholder="z. B. Einlass ab 19 Uhr" />
                  </div>
                  <div className="field">
                    <label>Nachricht</label>
                    <textarea className="input" value={msgText} maxLength={2000} rows={6} onChange={(e) => setMsgText(e.target.value)} placeholder="Deine Nachricht an alle Gäste …" style={{ resize: 'vertical' }} />
                  </div>
                  {msgError && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 10 }}>{msgError}</div>}
                </>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setMessageOpen(false)} disabled={msgSending}>Schließen</button>
              {msgSent === null && (
                <button className="btn primary" onClick={() => void sendMessage()} disabled={msgSending || !msgSubject.trim() || !msgText.trim()}>
                  {msgSending ? 'Sende …' : 'Senden'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {cancelOpen && event && (
        <div className="modal-backdrop" onClick={() => !cancelBusy && setCancelOpen(false)}>
          <div className="modal" role="dialog" aria-label="Event absagen" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Event absagen</h3>
              <button className="close-btn" onClick={() => setCancelOpen(false)} disabled={cancelBusy} aria-label="Schließen">
                <Icon name="x" size={15} />
              </button>
            </div>
            <div className="modal-body">
              {cancelResult ? (
                <div style={{
                  padding: 14, borderRadius: 10,
                  background: 'var(--ok-wash)', border: '1px solid oklch(0.86 0.08 150)',
                  fontSize: 13, lineHeight: 1.55,
                }}>
                  <b>Event abgesagt.</b> {cancelResult}. Käufer erhalten ihr Geld
                  automatisch zurück; die Tickets sind ab sofort ungültig.
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
                    <b>„{event.name}&ldquo;</b> wird endgültig abgesagt: Der Verkauf stoppt sofort,
                    alle {event.tickets_sold} verkauften Tickets werden ungültig und jede
                    noch nicht ausgezahlte Zahlung wird vollständig erstattet. Das lässt
                    sich nicht rückgängig machen.
                  </p>
                  <div className="field" style={{ marginTop: 14 }}>
                    <label>Zur Bestätigung „absagen&ldquo; eintippen</label>
                    <input className="input" value={cancelConfirmText} onChange={(e) => setCancelConfirmText(e.target.value)}
                      placeholder="absagen" disabled={cancelBusy} />
                  </div>
                  {cancelError && (
                    <div style={{ fontSize: 13, color: 'var(--bad)', lineHeight: 1.5 }}>{cancelError}</div>
                  )}
                </>
              )}
            </div>
            <div className="modal-foot">
              {cancelResult ? (
                <button className="btn primary" onClick={() => setCancelOpen(false)}>Schließen</button>
              ) : (
                <>
                  <button className="btn ghost" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>Abbrechen</button>
                  <button
                    className="btn primary"
                    style={{ background: 'var(--bad)' }}
                    onClick={() => void confirmCancel()}
                    disabled={cancelBusy || cancelConfirmText.trim().toLowerCase() !== 'absagen'}
                  >
                    {cancelBusy ? 'Wird abgesagt …' : 'Endgültig absagen'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
