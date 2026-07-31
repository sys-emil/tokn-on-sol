import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { LegalLinks } from '@/app/components/LegalLinks';
import { getT } from '@/lib/i18nServer';
import type { Lang } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t('events.metaTitle'),
    description: t('events.metaDescription'),
    openGraph: { title: t('events.metaTitle'), description: t('events.metaDescription') },
  };
}

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

const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'de-DE');

const monthShort = (iso: string, lang: Lang) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(locale(lang), { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const formatDate = (iso: string, lang: Lang) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(locale(lang), { weekday: 'short', day: 'numeric', month: 'long' });

function formatPrice(cents: number, lang: Lang, free: string): string {
  if (cents === 0) return free;
  return (cents / 100).toLocaleString(locale(lang), { style: 'currency', currency: 'EUR' });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}

const PAGE_CSS = `
  .event-card.listing { padding: 0; }
  /* Saisonpass-Karten: bewusst ohne Bildflaeche, damit sie sich von den
     Terminkarten unterscheiden statt mit ihnen zu konkurrieren. */
  .pass-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  .pass-card {
    display: flex; flex-direction: column; gap: 6px;
    padding: 18px 20px 16px;
    background: var(--surface);
    border: 1px solid var(--accent-line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .pass-card:hover { border-color: var(--accent); box-shadow: var(--shadow); transform: translateY(-1px); }
  .pass-eyebrow {
    font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--accent-ink);
  }
  .pass-name { font-size: 16px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.25; }
  .pass-meta { font-size: 12.5px; color: var(--ink-3); }
  .pass-card .price-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: auto; padding-top: 12px;
  }
  .pass-card .price {
    font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }
  .pass-card .go {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px; font-weight: 500; color: var(--accent);
  }

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
    border-radius: 8px; font-size: 12.5px; color: var(--accent-ink);
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
  const { lang, t } = await getT();
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

  // Season passes covering at least one of the listed dates. A pass is bought
  // on its own page, so without this section the listing would show the dates
  // and hide the only place the series can be bought as a whole.
  const passes = await loadPasses(all.map((e) => e.id), needle, veranstalter);

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
    const soonLabel = days === 0 ? t('events.today') : days === 1 ? t('events.tomorrow') : null;
    const startSuffix = t('ticket.startSuffix');

    const inner = (
      <>
        <div className="art">
          <EventArt name={e.name} imageUrl={e.image_url} />
          {isSoldOut ? (
            <span className="chip bad art-chip"><span className="d" />{t('events.soldOut')}</span>
          ) : soonLabel ? (
            <span className="chip accent art-chip"><span className="d" />{soonLabel}</span>
          ) : isLow ? (
            <span className="chip warn art-chip"><span className="d" />{t('events.onlyLeft', { count: remaining })}</span>
          ) : null}
        </div>
        <div className="body">
          <div className="row gap-3">
            <div className="date-chip">
              <div className="m">{monthShort(e.date, lang)}</div>
              <div className="d">{dayNum(e.date)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="title">{e.name}</div>
              <div className="meta">
                {formatDate(e.date, lang)}
                {e.start_time ? ` · ${e.start_time}${startSuffix ? ` ${startSuffix}` : ''}` : ''}
                {e.venue && (<><span className="dot" />{e.venue}</>)}
              </div>
            </div>
          </div>
          <div className="price-row">
            <div className="price">{formatPrice(e.price_eur, lang, t('common.free'))}</div>
            {isSoldOut ? (
              waitlistWallets.has(e.organizer_wallet) ? (
                <span className="go">{t('events.toWaitlist')} <Icon name="arrow" size={13} /></span>
              ) : (
                <span className="muted" style={{ fontSize: 12.5 }}>{t('events.soldOut')}</span>
              )
            ) : (
              <span className="go">{t('events.getTickets')} <Icon name="arrow" size={13} /></span>
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
              <Link href="/events" className="active">{t('common.events')}</Link>
              <Link href="/my-tickets">{t('common.myTickets')}</Link>
            </div>
            <div className="topbar-right">
              <Link href="/become-organizer" className="btn subtle sm">{t('events.hostEvent')}</Link>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="aurora" aria-hidden="true" />
          <div className="container">

            <div className="hero">
              <div className="eyebrow"><span className="pulse" />{t('events.eyebrow')}</div>
              <h1>{organizerLabel ? t('events.titleOrganizer', { name: organizerLabel }) : t('events.title')}</h1>
              <p className="lead">
                {totalCount === 0
                  ? t('events.leadEmpty')
                  : totalCount === 1
                    ? t('events.leadOne')
                    : t('events.lead', { count: totalCount })}
              </p>
              <form className="search-row" action="/events" method="get">
                {veranstalter && <input type="hidden" name="veranstalter" value={veranstalter} />}
                <div className="search-wrap">
                  <span className="search-icon"><Icon name="search" size={14} /></span>
                  <input className="input" type="search" name="q" defaultValue={query} placeholder={`${t('events.searchPlaceholder')} …`} maxLength={80} aria-label={t('events.searchAria')} />
                </div>
                <button type="submit" className="btn subtle">{t('events.search')}</button>
              </form>
              {(organizerLabel || query) && (
                <div className="filter-note">
                  {organizerLabel && query
                    ? t('events.filterSearchAt', { query, name: organizerLabel })
                    : organizerLabel
                      ? t('events.filterOrganizer')
                      : t('events.filterSearch', { query })}
                  <Link href="/events">{t('events.reset')}</Link>
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
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{t('events.emptyFoundTitle')}</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        {t('events.emptyFoundText')} <Link href="/events" style={{ color: 'var(--accent)', fontWeight: 500 }}>{t('events.emptyFoundLink')}</Link>.
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{t('events.emptyTitle')}</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>{t('events.emptyText')}</div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {passes.length > 0 && (
                  <section>
                    <div className="section-head">
                      <div>
                        <h2>{t('events.passesTitle')}</h2>
                        <div className="sub">{t('events.passesSub')}</div>
                      </div>
                    </div>
                    <div className="pass-grid">
                      {passes.map((p) => (
                        <Link key={p.id} href={`/pass/${p.id}`} className="pass-card">
                          <div className="pass-eyebrow">{t('events.seasonPass')}</div>
                          <div className="pass-name">{p.name}</div>
                          <div className="pass-meta">
                            {p.dates === 1 ? t('events.validForDate') : t('events.validForDates', { count: p.dates })}
                          </div>
                          <div className="price-row">
                            <div className="price">{formatPrice(p.priceCents, lang, t('common.free'))}</div>
                            <span className="go">{t('events.securePass')} <Icon name="arrow" size={13} /></span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {available.length > 0 && (
                  <section>
                    {passes.length > 0 && (
                      <div className="section-head">
                        <div>
                          <h2>{t('events.singleDatesTitle')}</h2>
                          <div className="sub">{t('events.singleDatesSub')}</div>
                        </div>
                      </div>
                    )}
                    <div className="events-grid">
                      {available.map((e) => card(e, false))}
                    </div>
                  </section>
                )}

                {soldOut.length > 0 && (
                  <section>
                    <div className="section-head">
                      <div>
                        <h2>{t('events.soldOutTitle')}</h2>
                        <div className="sub">{t('events.soldOutSub')}</div>
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
              <div>© 2026 Passly · {t('common.tagline')}</div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                <Link href="/so-funktionierts">{t('common.howItWorks')}</Link>
                <LegalLinks style={{ fontSize: 12.5, color: 'inherit', gap: 18 }} />
              </div>
            </footer>

          </div>
        </div>
      </div>
    </>
  );
}

interface PassCard {
  id: string;
  name: string;
  priceCents: number;
  dates: number;
  organizerWallet: string;
}

/**
 * Active passes with capacity left that include at least one of the upcoming
 * public dates on this page. Filtered by the same search term and organizer
 * filter as the events, so the section never contradicts the listing.
 */
async function loadPasses(
  upcomingEventIds: string[],
  needle: string,
  veranstalter?: string,
): Promise<PassCard[]> {
  if (upcomingEventIds.length === 0) return [];

  const { data: links } = await supabaseAdmin
    .from('season_pass_events')
    .select('pass_id')
    .in('event_id', upcomingEventIds);
  const passIds = [...new Set(((links ?? []) as { pass_id: string }[]).map((l) => l.pass_id))];
  if (passIds.length === 0) return [];

  let query = supabaseAdmin
    .from('season_passes')
    .select('id, name, price_eur, capacity, tickets_sold, tickets_reserved, organizer_wallet')
    .in('id', passIds)
    .eq('active', true);
  if (veranstalter) query = query.eq('organizer_wallet', veranstalter);
  const { data: rows } = await query;

  // Total date count per pass, including dates outside this page's window;
  // "gilt für 8 Termine" is what the buyer is actually getting.
  const { data: allLinks } = await supabaseAdmin
    .from('season_pass_events')
    .select('pass_id')
    .in('pass_id', passIds);
  const dateCount = new Map<string, number>();
  for (const l of (allLinks ?? []) as { pass_id: string }[]) {
    dateCount.set(l.pass_id, (dateCount.get(l.pass_id) ?? 0) + 1);
  }

  type PassRow = {
    id: string; name: string; price_eur: number; capacity: number;
    tickets_sold: number; tickets_reserved: number; organizer_wallet: string;
  };
  return ((rows ?? []) as PassRow[])
    .filter((p) => p.capacity - p.tickets_sold - p.tickets_reserved > 0)
    .filter((p) => !needle || p.name.toLowerCase().includes(needle))
    .map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.price_eur,
      dates: dateCount.get(p.id) ?? 0,
      organizerWallet: p.organizer_wallet,
    }));
}
