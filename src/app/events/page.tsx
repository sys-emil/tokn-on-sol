import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Events entdecken · Passly',
  description: 'Finde Events in deiner Nähe und sichere dir fälschungssichere Tickets, Einlass per Handy, kein Ausdrucken nötig.',
  openGraph: { title: 'Events entdecken · Passly', description: 'Finde Events in deiner Nähe und sichere dir fälschungssichere Tickets.' },
};

interface EventRow {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  tickets_reserved: number;
  image_url: string | null;
  venue: string | null;
  organizer_wallet: string;
}

// Same generative recipe as before, one visual language for events
// without an uploaded image.
function eventHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

const monthShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });

function formatPrice(cents: number): string {
  if (cents === 0) return 'Kostenlos';
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}

const PAGE_CSS = `
  .event-card.listing { padding: 0; }
  .event-card .art {
    aspect-ratio: 5 / 3;
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid var(--line);
    background: var(--surface-3);
  }
  .event-card .art img, .event-card .art .art-bg {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover;
    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .event-card:hover .art img, .event-card:hover .art .art-bg { transform: scale(1.03); }
  .event-card .art .art-chip { position: absolute; top: 12px; left: 12px; }
  .event-card .body { padding: 16px 18px 16px; display: flex; flex-direction: column; gap: 14px; flex: 1; }
  .event-card.sold-out:hover { transform: none; box-shadow: var(--shadow); border-color: var(--line); }
  .event-card.sold-out .art img, .event-card.sold-out .art .art-bg { filter: grayscale(0.7); opacity: 0.6; }
  .search-row { display: flex; gap: 8px; margin-top: 18px; max-width: 420px; }
  .search-row .search-wrap { position: relative; flex: 1; min-width: 0; }
  .search-row .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ink-3); display: grid; }
  .search-row .input { width: 100%; padding-left: 36px; }
  .filter-note {
    display: inline-flex; align-items: center; gap: 8px;
    margin-top: 14px; padding: 6px 12px;
    background: var(--accent-wash); border: 1px solid var(--accent-line);
    border-radius: 999px; font-size: 12.5px; color: var(--accent-ink);
  }
  .filter-note a { color: var(--accent); font-weight: 500; }
  .event-card .price-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: auto;
  }
  .event-card .price {
    font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }
  .event-card .go {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px; font-weight: 500; color: var(--accent);
  }
  @media (prefers-reduced-motion: reduce) {
    .event-card .art img, .event-card .art .art-bg { transition: none; }
  }
`;

function EventArt({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- storage host is env-dependent, skip next/image remotePatterns
    return <img src={imageUrl} alt="" loading="lazy" />;
  }
  const hue = eventHue(name);
  const hue2 = (hue + 50) % 360;
  return (
    <div
      className="art-bg"
      style={{
        background: `radial-gradient(ellipse at 30% 40%, oklch(0.88 0.09 ${hue}), transparent 60%), radial-gradient(ellipse at 70% 65%, oklch(0.90 0.07 ${hue2}), transparent 55%), oklch(0.95 0.02 ${hue})`,
      }}
    />
  );
}

export default async function EventsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; veranstalter?: string }>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { q, veranstalter } = await searchParams;
  const query = (q ?? '').trim();

  let dbQuery = supabaseAdmin
    .from('events')
    .select('id, name, date, start_time, price_eur, capacity, tickets_sold, tickets_reserved, image_url, venue, organizer_wallet')
    .gte('date', today)
    .eq('is_private', false)
    .order('date', { ascending: true });
  if (veranstalter) dbQuery = dbQuery.eq('organizer_wallet', veranstalter);

  const { data } = await dbQuery;

  // Text search runs in JS; the public listing is small, and this avoids
  // feeding user input into a PostgREST or() filter string.
  const needle = query.toLowerCase();
  const all = ((data ?? []) as EventRow[]).filter((e) =>
    !needle || e.name.toLowerCase().includes(needle) || (e.venue ?? '').toLowerCase().includes(needle),
  );
  const taken = (e: EventRow) => e.tickets_sold + (e.tickets_reserved ?? 0);
  const available = all.filter((e) => taken(e) < e.capacity);
  const soldOut = all.filter((e) => taken(e) >= e.capacity);
  const totalCount = all.length;

  // Sold-out cards of Pro organizers advertise the waitlist on the shop page.
  const soldOutWallets = [...new Set(soldOut.map((e) => e.organizer_wallet))];
  const waitlistWallets = new Set<string>();
  if (soldOutWallets.length > 0) {
    const { data: proRows } = await supabaseAdmin
      .from('organizers')
      .select('wallet_address')
      .in('wallet_address', soldOutWallets)
      .eq('plan', 'pro');
    for (const r of (proRows ?? []) as { wallet_address: string }[]) waitlistWallets.add(r.wallet_address);
  }

  // "Events von X" heading when the listing is filtered by organizer.
  let organizerLabel: string | null = null;
  if (veranstalter) {
    const { data: org } = await supabaseAdmin
      .from('organizers')
      .select('name, business_name, type')
      .eq('wallet_address', veranstalter)
      .maybeSingle();
    if (org) organizerLabel = (org.type === 'business' && org.business_name ? org.business_name : org.name) as string;
  }

  const card = (e: EventRow, isSoldOut: boolean) => {
    const remaining = e.capacity - taken(e);
    const isLow = !isSoldOut && remaining / e.capacity <= 0.15;
    const days = daysUntil(e.date);
    const soonLabel = days === 0 ? 'Heute' : days === 1 ? 'Morgen' : null;

    const inner = (
      <>
        <div className="art">
          <EventArt name={e.name} imageUrl={e.image_url} />
          {isSoldOut ? (
            <span className="chip bad art-chip"><span className="d" />Ausverkauft</span>
          ) : soonLabel ? (
            <span className="chip accent art-chip"><span className="d" />{soonLabel}</span>
          ) : isLow ? (
            <span className="chip warn art-chip"><span className="d" />Nur noch {remaining}</span>
          ) : null}
        </div>
        <div className="body">
          <div className="row gap-3">
            <div className="date-chip">
              <div className="m">{monthShort(e.date)}</div>
              <div className="d">{dayNum(e.date)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="title">{e.name}</div>
              <div className="meta">
                {formatDate(e.date)}{e.start_time ? ` · ${e.start_time} Uhr` : ''}
                {e.venue && (<><span className="dot" />{e.venue}</>)}
              </div>
            </div>
          </div>
          <div className="price-row">
            <div className="price">{formatPrice(e.price_eur)}</div>
            {isSoldOut ? (
              waitlistWallets.has(e.organizer_wallet) ? (
                <span className="go">Zur Warteliste <Icon name="arrow" size={13} /></span>
              ) : (
                <span className="muted" style={{ fontSize: 12.5 }}>Ausverkauft</span>
              )
            ) : (
              <span className="go">Tickets sichern <Icon name="arrow" size={13} /></span>
            )}
          </div>
        </div>
      </>
    );

    // Sold-out events stay clickable; the shop page shows the waitlist
    // signup (Pro organizers) and the full event details.
    return (
      <Link key={e.id} href={`/shop/${e.id}`} className={`event-card listing${isSoldOut ? ' sold-out' : ''}`}>
        {inner}
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
              <Link href="/events" className="active">Events</Link>
              <Link href="/my-tickets">Meine Tickets</Link>
            </div>
            <div className="topbar-right">
              <Link href="/become-organizer" className="btn subtle sm">Event veranstalten</Link>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="aurora" aria-hidden="true" />
          <div className="container">

            <div className="hero">
              <div className="eyebrow"><span className="pulse" />Entdecken</div>
              <h1>{organizerLabel ? `Events von ${organizerLabel}` : 'Bevorstehende Events'}</h1>
              <p className="lead">
                {totalCount > 0
                  ? `${totalCount} Event${totalCount !== 1 ? 's' : ''} mit fälschungssicheren Tickets: kaufen, teilen, am Einlass vorzeigen.`
                  : 'Fälschungssichere Tickets: kaufen, teilen, am Einlass vorzeigen.'}
              </p>
              <form className="search-row" action="/events" method="get">
                {veranstalter && <input type="hidden" name="veranstalter" value={veranstalter} />}
                <div className="search-wrap">
                  <span className="search-icon"><Icon name="search" size={14} /></span>
                  <input className="input" type="search" name="q" defaultValue={query} placeholder="Event oder Ort suchen …" maxLength={80} aria-label="Events durchsuchen" />
                </div>
                <button type="submit" className="btn subtle">Suchen</button>
              </form>
              {(organizerLabel || query) && (
                <div className="filter-note">
                  {organizerLabel && query ? `Suche „${query}" bei ${organizerLabel}` : organizerLabel ? `Nur Events dieses Veranstalters` : `Suche „${query}"`}
                  <Link href="/events">Zurücksetzen</Link>
                </div>
              )}
            </div>

            {totalCount === 0 ? (
              <div className="card">
                <div className="empty">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--accent)' }}>
                    <Icon name={query || organizerLabel ? 'search' : 'calendar'} size={20} />
                  </div>
                  {query || organizerLabel ? (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Nichts gefunden.</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        Versuch einen anderen Suchbegriff oder <Link href="/events" style={{ color: 'var(--accent)', fontWeight: 500 }}>zeig alle Events</Link>.
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Gerade ist nichts angekündigt.</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>Schau bald wieder vorbei, neue Events erscheinen hier zuerst.</div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {available.length > 0 && (
                  <section>
                    <div className="events-grid">
                      {available.map((e) => card(e, false))}
                    </div>
                  </section>
                )}

                {soldOut.length > 0 && (
                  <section>
                    <div className="section-head">
                      <div>
                        <h2>Ausverkauft</h2>
                        <div className="sub">Vielleicht klappt&rsquo;s beim nächsten Mal</div>
                      </div>
                    </div>
                    <div className="events-grid">
                      {soldOut.map((e) => card(e, true))}
                    </div>
                  </section>
                )}
              </>
            )}

            <footer style={{ borderTop: '1px solid var(--line)', marginTop: 64, padding: '28px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--ink-3)' }}>
              <div>© 2026 Passly · Digitale Tickets</div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <Link href="/so-funktionierts">So funktioniert&rsquo;s</Link>
                <Link href="/impressum">Impressum</Link>
                <Link href="/datenschutz">Datenschutz</Link>
                <Link href="/agb">AGB</Link>
              </div>
            </footer>

          </div>
        </div>
      </div>
    </>
  );
}
