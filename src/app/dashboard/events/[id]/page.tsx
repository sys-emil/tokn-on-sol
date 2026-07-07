'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { useEffect, useMemo, useState } from 'react';

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
  venue: string | null;
  description: string | null;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  is_private: boolean;
  image_url: string | null;
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

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, authenticated, getAccessToken } = usePrivy();

  const [event, setEvent] = useState<EventData | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [checkedIn, setCheckedIn] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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
        const data = (await res.json()) as {
          event: EventData;
          tickets: TicketRow[];
          stats: { checkedIn: number; revoked: number };
        };
        setEvent(data.event);
        setTickets(data.tickets);
        setCheckedIn(data.stats.checkedIn);
      } catch {
        setLoadError('Verbindungsfehler. Bitte lade die Seite neu.');
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [ready, authenticated, id, loaded, getAccessToken]);

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
  const revenueCents = event ? event.tickets_sold * event.price_eur : 0;
  const redemptionPct = event && event.tickets_sold > 0 ? Math.round((checkedIn / event.tickets_sold) * 100) : 0;

  const copyShopLink = () => {
    if (!event) return;
    void navigator.clipboard.writeText(`${window.location.origin}/shop/${event.id}`).then(() => {
      setCopiedShop(true);
      setTimeout(() => setCopiedShop(false), 2000);
    });
  };

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

            {!loaded && <div className="empty">Lade Veranstaltung …</div>}
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
                      <span className={'chip ' + (upcoming ? 'ok' : '')}><span className="d" />{upcoming ? 'Aktiv' : 'Vorbei'}</span>
                      {event.is_private && <span className="chip"><span className="d" />Privat</span>}
                      <span className="chip"><Icon name="shield" size={11} /> Fälschungsgeschützt</span>
                    </div>
                    <h1 style={{ fontSize: 30, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1 }}>{event.name}</h1>
                    <div className="row gap-3" style={{ marginTop: 10, color: 'var(--ink-3)', fontSize: 13.5, flexWrap: 'wrap' }}>
                      <span className="row gap-2"><Icon name="calendar" size={14} />{formatDate(event.date)}</span>
                      {event.venue && <span className="row gap-2"><Icon name="location" size={14} />{event.venue}</span>}
                      <span className="row gap-2"><Icon name="euro" size={14} />{event.price_eur === 0 ? 'Kostenlos' : `${eur(event.price_eur)} pro Ticket`}</span>
                    </div>
                    {event.description && (
                      <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, maxWidth: 560 }}>
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="row gap-2">
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
                            style={{ padding: '7px 10px 7px 32px', fontSize: 12.5, width: 180 }}
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
                              <button className="btn ghost sm" disabled={pageClamped === 0} onClick={() => setPage(pageClamped - 1)}>
                                <Icon name="chevronLeft" size={12} />
                              </button>
                              <span>{pageClamped + 1} / {pageCount}</span>
                              <button className="btn ghost sm" disabled={pageClamped >= pageCount - 1} onClick={() => setPage(pageClamped + 1)}>
                                <Icon name="chevronRight" size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card" style={{ padding: 22 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                        Verkauf
                      </div>
                      <div style={{ fontSize: 34, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {event.tickets_sold}
                        <span style={{ fontSize: 18, color: 'var(--ink-3)', fontWeight: 500 }}> / {event.capacity}</span>
                      </div>
                      <div className="progress" style={{ marginTop: 10 }}><span style={{ width: pct + '%' }} /></div>
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
                      </div>
                    </div>

                    <div className="card" style={{ padding: 22 }}>
                      <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10 }}>Schnellaktionen</h3>
                      <div className="stack" style={{ gap: 6 }}>
                        <button className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={copyShopLink}>
                          <Icon name="share" size={14} /> {copiedShop ? 'Kopiert!' : 'Ticket-Link kopieren'}
                        </button>
                        <Link href={`/doorman/${event.id}`} className="btn ghost" style={{ justifyContent: 'flex-start' }}>
                          <Icon name="scan" size={14} /> Einlass-Modus öffnen
                        </Link>
                        <Link href={`/shop/${event.id}`} className="btn ghost" style={{ justifyContent: 'flex-start' }}>
                          <Icon name="ticket" size={14} /> Shop-Seite ansehen
                        </Link>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
