import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon, VerifiedCheck } from '@/app/components/passlyUi';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeHandle } from '@/lib/organizerHandle';

/**
 * Public organizer page at getpassly.de/@handle. YouTube-channel style: banner,
 * overlapping avatar, name + verification, bio, links and the organizer's
 * events. Served by this root dynamic segment; real routes (/events, /shop, …)
 * take routing priority, so only otherwise-unmatched paths land here, and we
 * 404 anything that isn't a valid `@handle`.
 */

const monthShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
const isUpcoming = (iso: string) => new Date(iso + 'T23:59:59') >= new Date();

interface OrganizerRow {
  wallet_address: string;
  handle: string | null;
  public_name: string | null;
  business_name: string | null;
  name: string;
  type: 'private' | 'business';
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  links: { label: string; url: string }[] | null;
  accent_hue: number | null;
  featured_event_id: string | null;
  is_verified: boolean;
  verified_label: string | null;
}

interface EventRow {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  image_url: string | null;
  accent_hue: number | null;
}

const ORG_SELECT =
  'wallet_address, handle, public_name, business_name, name, type, bio, avatar_url, banner_url, links, accent_hue, featured_event_id, is_verified, verified_label';

async function getOrganizer(handle: string): Promise<OrganizerRow | null> {
  const { data } = await supabaseAdmin
    .from('organizers')
    .select(ORG_SELECT)
    .ilike('handle', handle)
    .eq('status', 'approved')
    .maybeSingle();
  return (data as OrganizerRow | null) ?? null;
}

function organizerDisplayName(o: OrganizerRow): string {
  return (
    o.public_name?.trim() ||
    (o.type === 'business' && o.business_name ? o.business_name : o.name) ||
    'Veranstalter'
  );
}

/** Parses the `@handle` segment; returns the clean handle or null. */
function handleFromParam(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith('@')) return null;
  const h = normalizeHandle(decoded);
  return h || null;
}

const PAGE_CSS = `
  .org-banner {
    height: 220px; border-radius: 18px; overflow: hidden;
    background: linear-gradient(120deg, oklch(0.72 0.13 var(--hue)), oklch(0.58 0.19 calc(var(--hue) + 35)));
    border: 1px solid var(--line); position: relative;
  }
  .org-banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
  @media (max-width: 620px) { .org-banner { height: 140px; } }

  /* Short header row so the avatar reliably overlaps the banner; the tall
     bio/links live in .org-about below (a tall row here would push the
     flex-end-aligned avatar down past the banner). */
  .org-head {
    display: flex; align-items: flex-end; gap: 20px;
    padding: 0 8px; margin-top: -54px; position: relative; z-index: 2;
  }
  .org-headinfo { flex: 1; min-width: 0; padding-bottom: 6px; }
  .org-about { padding: 0 8px; margin-top: 18px; }
  .org-avatar {
    width: 116px; height: 116px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, oklch(0.82 0.08 var(--hue)), oklch(0.66 0.17 calc(var(--hue) + 40)));
    display: grid; place-items: center; overflow: hidden;
    color: white; font-size: 40px; font-weight: 600; letter-spacing: -0.02em;
    border: 4px solid var(--surface);
    box-shadow: 0 8px 24px oklch(0.52 0.20 var(--hue) / 0.30);
  }
  .org-avatar img { width: 100%; height: 100%; object-fit: cover; }
  @media (max-width: 620px) {
    .org-head { margin-top: -44px; align-items: flex-start; flex-direction: column; gap: 10px; }
    .org-avatar { width: 92px; height: 92px; font-size: 32px; }
  }

  .org-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .org-link {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px; font-weight: 500; color: var(--ink-2);
    padding: 6px 12px; border-radius: 8px;
    border: 1px solid var(--line); background: var(--surface);
  }
  .org-link:hover { border-color: var(--accent-line); color: var(--accent-ink); }

  .memory-card { padding: 0; overflow: hidden; }
  .memory-card .photo {
    width: 100%; height: 130px; object-fit: cover; display: block;
    border-bottom: 1px solid var(--line);
  }
  .memory-card .body { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
  .featured-tag {
    font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--accent-ink);
  }
`;

function Shell({ hue, children }: { hue: number | null; children: React.ReactNode }) {
  return (
    <div className="app" style={hue != null ? ({ '--hue': hue } as React.CSSProperties) : undefined}>
      <style>{PAGE_CSS}</style>
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} />
          <div className="nav">
            <Link href="/events">Events</Link>
          </div>
          <div className="topbar-right">
            <Link href="/events" className="btn ghost sm">Events entdecken</Link>
          </div>
        </div>
      </div>
      <div className="main">
        <div className="aurora" aria-hidden="true" />
        <div className="container">
          {children}
          <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />
        </div>
      </div>
    </div>
  );
}

function EventCard({ e, featured }: { e: EventRow; featured?: boolean }) {
  const inner = (
    <>
      {featured && <div className="featured-tag">Empfohlen</div>}
      <div className="row gap-3">
        <div className="date-chip">
          <div className="m">{monthShort(e.date)}</div>
          <div className="d">{dayNum(e.date)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title">{e.name}</div>
          <div className="meta">
            <Icon name="calendar" size={12} /> {formatDate(e.date)}
            {e.venue ? <><span className="dot" /> {e.venue}</> : null}
          </div>
        </div>
      </div>
    </>
  );
  return (
    <Link
      key={e.id}
      href={`/event/${e.id}`}
      className="event-card memory-card"
      style={e.accent_hue != null ? ({ '--hue': e.accent_hue } as React.CSSProperties) : undefined}
    >
      {e.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL, sizes vary
        <img className="photo" src={e.image_url} alt={e.name} loading="lazy" />
      )}
      <div className="body">{inner}</div>
    </Link>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = handleFromParam(raw);
  if (!handle) return {};
  const organizer = await getOrganizer(handle);
  if (!organizer) return {};


  const name = organizerDisplayName(organizer);
  const description =
    organizer.bio?.trim() ||
    `${name} auf Passly: kommende Events entdecken und Tickets sicher und fälschungssicher kaufen.`;
  return {
    title: `${name} · Veranstalter auf Passly`,
    description,
    openGraph: { title: `${name} auf Passly`, description, siteName: 'Passly' },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function OrganizerPublicPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const handle = handleFromParam(raw);
  if (!handle) notFound();

  const organizer = await getOrganizer(handle);
  if (!organizer) notFound();

  const { data: eventData } = await supabaseAdmin
    .from('events')
    .select('id, name, date, venue, image_url, accent_hue, is_private, cancelled_at')
    .eq('organizer_wallet', organizer.wallet_address)
    .eq('is_private', false)
    .is('cancelled_at', null)
    .order('date', { ascending: true });

  const events = (eventData ?? []) as (EventRow & { is_private: boolean; cancelled_at: string | null })[];
  const upcoming = events.filter((e) => isUpcoming(e.date));
  const past = events.filter((e) => !isUpcoming(e.date)).reverse();

  // Pin the featured event to the front of the upcoming list.
  const featuredId = organizer.featured_event_id;
  const featured = featuredId ? upcoming.find((e) => e.id === featuredId) ?? null : null;
  const upcomingOrdered = featured
    ? [featured, ...upcoming.filter((e) => e.id !== featured.id)]
    : upcoming;

  // Season passes still on sale. The profile is where a fan lands from a link
  // in a bio, so the series has to be buyable from here, not only from a
  // single date's shop page.
  const passes = await loadProfilePasses(
    organizer.wallet_address,
    upcoming.map((e) => e.id),
  );

  const name = organizerDisplayName(organizer);
  const initials = name.slice(0, 2).toUpperCase();
  const links = Array.isArray(organizer.links) ? organizer.links.slice(0, 5) : [];

  return (
    <Shell hue={organizer.accent_hue}>
      <div className="org-banner">
        {organizer.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL, sizes vary
          <img src={organizer.banner_url} alt="" />
        )}
      </div>

      <div className="org-head">
        <div className="org-avatar">
          {organizer.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL, sizes vary
            <img src={organizer.avatar_url} alt={name} />
          ) : (
            initials
          )}
        </div>
        <div className="org-headinfo">
          <h1 style={{ fontSize: 30, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.15, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {name}
            {organizer.is_verified && <VerifiedCheck size={26} title={organizer.verified_label ?? 'Verifiziert'} />}
          </h1>
          <div className="row gap-2" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <span className="chip ok"><Icon name="shield" size={11} /> Geprüft</span>
            {organizer.is_verified && organizer.verified_label && (
              <span className="chip" style={{ color: 'var(--accent-ink)', background: 'var(--accent-wash)', borderColor: 'var(--accent-line)' }}>
                {organizer.verified_label}
              </span>
            )}
          </div>
        </div>
      </div>

      {(organizer.bio || links.length > 0) && (
        <div className="org-about">
          {organizer.bio && (
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 560 }}>{organizer.bio}</p>
          )}
          {links.length > 0 && (
            <div className="org-links">
              {links.map((l, i) => (
                <a key={i} href={l.url} className="org-link" target="_blank" rel="noopener noreferrer nofollow">
                  <Icon name="share" size={12} /> {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {passes.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <div className="section-head">
            <div>
              <h2>Saisonpässe</h2>
              <div className="sub">Ein Ticket für die ganze Reihe</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {passes.map((p) => (
              <Link
                key={p.id}
                href={`/pass/${p.id}`}
                className="card"
                style={{ padding: '18px 20px', display: 'grid', gap: 6, color: 'inherit' }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>
                  Saisonpass
                </span>
                <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.25 }}>{p.name}</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                  Gilt für {p.dates} {p.dates === 1 ? 'Termin' : 'Termine'}
                </span>
                <span style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {p.priceCents === 0
                      ? 'Kostenlos'
                      : (p.priceCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--accent)' }}>Pass sichern →</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 36 }}>
        <div className="section-head">
          <div>
            <h2>Kommende Events</h2>
            <div className="sub">{upcomingOrdered.length} geplant</div>
          </div>
        </div>
        {upcomingOrdered.length === 0 ? (
          <div className="card"><div className="empty">Aktuell sind keine Events geplant, schau bald wieder vorbei.</div></div>
        ) : (
          <div className="events-grid">
            {upcomingOrdered.map((e) => (
              <EventCard key={e.id} e={e} featured={featured?.id === e.id} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <div className="section-head">
            <div>
              <h2>Vergangene Events</h2>
              <div className="sub">{past.length} gespielt</div>
            </div>
          </div>
          <div className="events-grid">
            {past.slice(0, 12).map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}

/**
 * Active passes of this organizer that still have capacity and cover at least
 * one upcoming date. A pass whose whole series has passed is not on sale.
 */
async function loadProfilePasses(
  organizerWallet: string,
  upcomingEventIds: string[],
): Promise<{ id: string; name: string; priceCents: number; dates: number }[]> {
  if (upcomingEventIds.length === 0) return [];

  const { data: rows } = await supabaseAdmin
    .from('season_passes')
    .select('id, name, price_eur, capacity, tickets_sold, tickets_reserved')
    .eq('organizer_wallet', organizerWallet)
    .eq('active', true);

  type Row = {
    id: string; name: string; price_eur: number;
    capacity: number; tickets_sold: number; tickets_reserved: number;
  };
  const live = ((rows ?? []) as Row[]).filter(
    (p) => p.capacity - p.tickets_sold - p.tickets_reserved > 0,
  );
  if (live.length === 0) return [];

  const { data: links } = await supabaseAdmin
    .from('season_pass_events')
    .select('pass_id, event_id')
    .in('pass_id', live.map((p) => p.id));

  const upcomingSet = new Set(upcomingEventIds);
  const total = new Map<string, number>();
  const hasUpcoming = new Set<string>();
  for (const l of (links ?? []) as { pass_id: string; event_id: string }[]) {
    total.set(l.pass_id, (total.get(l.pass_id) ?? 0) + 1);
    if (upcomingSet.has(l.event_id)) hasUpcoming.add(l.pass_id);
  }

  return live
    .filter((p) => hasUpcoming.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, priceCents: p.price_eur, dates: total.get(p.id) ?? 0 }));
}
