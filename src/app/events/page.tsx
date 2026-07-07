import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';

export const dynamic = 'force-dynamic';

interface EventRow {
  id: string;
  name: string;
  date: string;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  tickets_reserved: number;
  image_url: string | null;
  venue: string | null;
}

// Same generative recipe as before — one visual language for events
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
  .event-card.sold-out { cursor: default; }
  .event-card.sold-out:hover { transform: none; box-shadow: var(--shadow); border-color: var(--line); }
  .event-card.sold-out .art img, .event-card.sold-out .art .art-bg { filter: grayscale(0.7); opacity: 0.6; }
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

export default async function EventsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabaseAdmin
    .from('events')
    .select('id, name, date, price_eur, capacity, tickets_sold, tickets_reserved, image_url, venue')
    .gte('date', today)
    .eq('is_private', false)
    .order('date', { ascending: true });

  const all = (data ?? []) as EventRow[];
  const taken = (e: EventRow) => e.tickets_sold + (e.tickets_reserved ?? 0);
  const available = all.filter((e) => taken(e) < e.capacity);
  const soldOut = all.filter((e) => taken(e) >= e.capacity);
  const totalCount = all.length;

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
                {formatDate(e.date)}
                {e.venue && (<><span className="dot" />{e.venue}</>)}
              </div>
            </div>
          </div>
          <div className="price-row">
            <div className="price">{formatPrice(e.price_eur)}</div>
            {isSoldOut ? (
              <span className="muted" style={{ fontSize: 12.5 }}>Ausverkauft</span>
            ) : (
              <span className="go">Tickets sichern <Icon name="arrow" size={13} /></span>
            )}
          </div>
        </div>
      </>
    );

    if (isSoldOut) {
      return <div key={e.id} className="event-card listing sold-out">{inner}</div>;
    }
    return <Link key={e.id} href={`/shop/${e.id}`} className="event-card listing">{inner}</Link>;
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
              <h1>Bevorstehende Events</h1>
              <p className="lead">
                {totalCount > 0
                  ? `${totalCount} Event${totalCount !== 1 ? 's' : ''} mit fälschungssicheren Tickets — kaufen, teilen, am Einlass vorzeigen.`
                  : 'Fälschungssichere Tickets — kaufen, teilen, am Einlass vorzeigen.'}
              </p>
            </div>

            {totalCount === 0 ? (
              <div className="card">
                <div className="empty">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--accent)' }}>
                    <Icon name="calendar" size={20} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Gerade ist nichts angekündigt.</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Schau bald wieder vorbei — neue Events erscheinen hier zuerst.</div>
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
