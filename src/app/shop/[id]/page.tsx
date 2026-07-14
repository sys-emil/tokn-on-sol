import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import type { Event, TicketTier } from '@/lib/supabase';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import ShopClient from './ShopClient';
import type { TierView } from './ShopClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: 'Event nicht gefunden — Passly' };

  const dateLabel = formatDate(event.date);
  const title = `${event.name} — ${dateLabel} — Passly`;
  const description = event.venue
    ? `${dateLabel} · ${event.venue}. Tickets sicher und fälschungssicher kaufen — Einlass per Handy.`
    : `${dateLabel}. Tickets sicher und fälschungssicher kaufen — Einlass per Handy.`;

  return {
    title,
    description,
    openGraph: {
      title: event.name,
      description,
      type: 'website',
      ...(event.image_url ? { images: [event.image_url] } : {}),
    },
    twitter: {
      card: event.image_url ? 'summary_large_image' : 'summary',
      title: event.name,
      description,
      ...(event.image_url ? { images: [event.image_url] } : {}),
    },
  };
}

async function getEvent(id: string): Promise<Event | null> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as Event;
}

async function getTiers(eventId: string): Promise<TicketTier[]> {
  const { data } = await supabaseAdmin
    .from('ticket_tiers')
    .select('*')
    .eq('event_id', eventId)
    .order('sort')
    .order('created_at');
  return (data ?? []) as TicketTier[];
}

const monthShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const PAGE_CSS = `
  .shop-page {
    min-height: 100vh;
    background: radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2);
    display: flex; flex-direction: column; align-items: center;
    padding: 32px 20px 56px;
  }
  .shop-card {
    width: 100%; max-width: 460px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    margin-top: 28px;
  }
  .shop-art {
    aspect-ratio: 2 / 1; position: relative; overflow: hidden;
    border-bottom: 1px solid var(--line);
    background: var(--surface-3);
  }
  .shop-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .shop-head { padding: 22px 24px 20px; display: flex; gap: 14px; align-items: flex-start; }
  .shop-head h1 { font-size: 21px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
  .shop-head .when { font-size: 13px; color: var(--ink-3); margin-top: 5px; display: flex; flex-direction: column; gap: 3px; }
  .shop-head .when .line { display: flex; align-items: center; gap: 6px; }
  .shop-desc {
    padding: 0 24px 20px;
    font-size: 13.5px; color: var(--ink-2); line-height: 1.6;
    white-space: pre-line;
  }
  .shop-rows { border-top: 1px solid var(--line); padding: 18px 24px; display: flex; flex-direction: column; gap: 12px; }
  .shop-row { display: flex; align-items: center; justify-content: space-between; font-size: 13.5px; }
  .shop-row .label { color: var(--ink-3); }
  .shop-row .value { font-weight: 600; font-variant-numeric: tabular-nums; }
  .shop-row .value.big { font-size: 19px; letter-spacing: -0.01em; }
  .shop-foot { border-top: 1px solid var(--line); padding: 20px 24px 24px; background: var(--surface-2); }
  .shop-trust {
    margin-top: 22px;
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: var(--ink-3);
  }
`;

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) notFound();

  const tiers = await getTiers(id);
  const cancelled = Boolean((event as Event & { cancelled_at?: string | null }).cancelled_at);

  // Waitlist is a Pro feature of the organizer — the shop only offers the
  // signup when the plan is active (the join API enforces the same rule).
  const { data: organizerRow } = await supabaseAdmin
    .from('organizers')
    .select('plan')
    .eq('wallet_address', event.organizer_wallet)
    .maybeSingle();
  const waitlistEnabled = organizerRow?.plan === 'pro';

  // Per-tier availability, additionally capped by the event-level counters —
  // the hard overselling gate in reserve_tickets uses the same numbers.
  const eventAvailable = Math.max(0, event.capacity - event.tickets_sold - (event.tickets_reserved ?? 0));
  const tierViews: TierView[] = tiers.map((t) => ({
    id: t.id,
    name: t.name,
    priceEur: t.price_eur,
    available: Math.min(eventAvailable, Math.max(0, t.capacity - t.tickets_sold - t.tickets_reserved)),
  }));

  const prices = tierViews.map((t) => t.priceEur);
  const minPrice = prices.length > 0 ? Math.min(...prices) : event.price_eur;
  const uniformPrice = prices.length > 0 && prices.every((p) => p === minPrice);
  const priceFormatted = minPrice === 0 && uniformPrice
    ? 'Kostenlos'
    : `${uniformPrice ? '' : 'ab '}${(minPrice / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`;

  const available = tierViews.length > 0
    ? Math.min(eventAvailable, tierViews.reduce((sum, t) => sum + t.available, 0))
    : eventAvailable;
  const soldOut = available <= 0;
  const venue = (event as Event & { venue?: string | null }).venue ?? null;
  const description = (event as Event & { description?: string | null }).description ?? null;

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="shop-page">
        <PasslyLogo height={24} />

        <div className="shop-card">
          {event.image_url && (
            <div className="shop-art">
              {/* eslint-disable-next-line @next/next/no-img-element -- storage host is env-dependent, skip next/image remotePatterns */}
              <img src={event.image_url} alt={event.name} />
            </div>
          )}

          <div className="shop-head">
            <div className="date-chip" style={{ width: 52, flexShrink: 0, border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden', textAlign: 'center', background: 'var(--surface)' }}>
              <div style={{ fontSize: 9.5, letterSpacing: '0.1em', color: 'white', textTransform: 'uppercase', fontWeight: 600, background: 'var(--accent)', padding: '3px 0' }}>{monthShort(event.date)}</div>
              <div style={{ fontSize: 20, fontWeight: 600, padding: '4px 0 5px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{dayNum(event.date)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1>{event.name}</h1>
              <div className="when">
                <span className="line"><Icon name="calendar" size={13} /> {formatDate(event.date)}</span>
                {venue && <span className="line"><Icon name="location" size={13} /> {venue}</span>}
              </div>
            </div>
          </div>

          {description && <div className="shop-desc">{description}</div>}

          <div className="shop-rows">
            <div className="shop-row">
              <span className="label">Ticketpreis</span>
              <span className="value big">{priceFormatted}</span>
            </div>
            <div className="shop-row">
              <span className="label">Verfügbarkeit</span>
              {cancelled ? (
                <span className="chip bad"><span className="d" />Abgesagt</span>
              ) : soldOut ? (
                <span className="chip bad"><span className="d" />Ausverkauft</span>
              ) : available <= Math.max(5, Math.floor(event.capacity * 0.1)) ? (
                <span className="chip warn"><span className="d" />Nur noch {available}</span>
              ) : (
                <span className="chip ok"><span className="d" />Verfügbar</span>
              )}
            </div>
          </div>

          <div className="shop-foot">
            {cancelled ? (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bad-wash)', border: '1px solid oklch(0.86 0.10 25)', fontSize: 13, color: 'var(--bad)', lineHeight: 1.55 }}>
                Dieses Event wurde vom Veranstalter abgesagt. Bereits gekaufte
                Tickets werden automatisch erstattet.
              </div>
            ) : (
              <ShopClient eventId={event.id} tiers={tierViews} waitlistEnabled={waitlistEnabled} />
            )}
          </div>
        </div>

        <div className="shop-trust">
          <Icon name="shield" size={14} />
          Jedes Ticket ist einzigartig und fälschungssicher.
        </div>

        <Link href="/events" style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-3)' }}>
          Alle Events ansehen →
        </Link>

        <div style={{ marginTop: 20, display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--ink-4)' }}>
          <Link href="/hilfe">Hilfe</Link>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
        </div>
      </div>
    </>
  );
}
