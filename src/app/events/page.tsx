import { Epilogue, Unbounded } from 'next/font/google';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { PasslyLogo } from '@/app/components/PasslyLogo';

export const dynamic = 'force-dynamic';

const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '900'],
  display: 'swap',
});

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500'],
  display: 'swap',
});

interface EventRow {
  id: string;
  name: string;
  date: string;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  tickets_reserved: number;
}

function formatDateShort(iso: string): string {
  const [year, month, day] = iso.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDateLong(iso: string): string {
  const [year, month, day] = iso.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}

const CSS = `
  :root {
    --color-bg:         oklch(0.10 0.014 258);
    --color-surface:    oklch(0.14 0.014 258);
    --color-border:     oklch(0.22 0.016 258);
    --color-text:       oklch(0.96 0.008 95);
    --color-text-muted: oklch(0.48 0.012 250);
    --color-accent:     oklch(0.72 0.118 148);
    --color-accent-dim: oklch(0.18 0.04 148);
    --color-warn:       oklch(0.72 0.14 60);
    --color-warn-dim:   oklch(0.18 0.06 60);
  }

  html, body { margin: 0; padding: 0; background: var(--color-bg); }

  .page-root {
    font-family: var(--font-body);
    background-color: var(--color-bg);
    background-image: radial-gradient(circle, oklch(0.23 0.014 258 / 0.45) 1px, transparent 1px);
    background-size: 28px 28px;
    color: var(--color-text);
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  /* ── Nav ─────────────────────────────────────────────────── */
  .nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 20;
    padding: 0 48px;
    height: 68px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: oklch(0.10 0.014 258 / 0.88);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--color-border);
  }

  .nav-left { display: flex; align-items: center; gap: 32px; }

  .logo {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--color-text);
    text-decoration: none;
  }

  .logo-dot { color: var(--color-accent); }

  .nav-divider { width: 1px; height: 18px; background: var(--color-border); }

  .nav-section {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .nav-chain {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  /* ── Layout ──────────────────────────────────────────────── */
  .main {
    flex: 1;
    max-width: 860px;
    width: 100%;
    margin: 0 auto;
    padding: 108px 48px 96px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 56px;
  }

  /* ── Page heading ────────────────────────────────────────── */
  .page-heading {
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
  }

  .page-label {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.20em;
    text-transform: uppercase;
    color: var(--color-accent);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .page-label-line {
    display: block;
    width: 24px;
    height: 1px;
    background: var(--color-accent);
    flex-shrink: 0;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(28px, 3.2vw, 42px);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--color-text);
    margin: 0;
  }

  .page-sub {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--color-text-muted);
    margin: 6px 0 0;
  }

  /* ── Column header ───────────────────────────────────────── */
  .col-header {
    display: grid;
    grid-template-columns: 64px 1fr 80px 100px 130px;
    gap: 16px;
    padding: 0 0 10px;
    border-bottom: 1px solid var(--color-border);
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.10s both;
  }

  .col-label {
    font-family: var(--font-display);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.20em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .col-label-right { text-align: right; }

  /* ── Event rows ──────────────────────────────────────────── */
  .events-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
  }

  .event-row {
    display: grid;
    grid-template-columns: 64px 1fr 80px 100px 130px;
    gap: 16px;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid oklch(0.22 0.016 258 / 0.5);
    transition: background 0.12s ease;
  }

  .event-row:last-child { border-bottom: none; }

  .event-row.available:hover {
    background: oklch(0.14 0.014 258 / 0.6);
    margin: 0 -12px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .event-date {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .event-name {
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .event-price {
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--color-text);
    text-align: right;
    white-space: nowrap;
  }

  .stock-cell { display: flex; justify-content: flex-end; align-items: center; }

  .stock-badge {
    font-family: var(--font-display);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 3px 7px;
    white-space: nowrap;
  }

  .stock-low {
    background: var(--color-warn-dim);
    color: var(--color-warn);
  }

  .stock-sold {
    background: oklch(0.16 0.01 258);
    color: oklch(0.36 0.012 258);
  }

  .action-cell { display: flex; justify-content: flex-end; }

  .btn-get {
    font-family: var(--font-display);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 8px 14px;
    color: oklch(0.10 0.014 258);
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    text-decoration: none;
    white-space: nowrap;
    transition: opacity 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn-get:hover { opacity: 0.85; }

  /* ── Sold-out section ────────────────────────────────────── */
  .soldout-divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.20s both;
  }

  .soldout-label {
    font-family: var(--font-display);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.20em;
    text-transform: uppercase;
    color: oklch(0.32 0.012 258);
    white-space: nowrap;
  }

  .soldout-line {
    flex: 1;
    height: 1px;
    background: oklch(0.22 0.016 258 / 0.5);
  }

  .events-list-soldout {
    display: flex;
    flex-direction: column;
    gap: 1px;
    opacity: 0.38;
    pointer-events: none;
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
  }

  .event-row.sold-out .event-name { color: var(--color-text-muted); }
  .event-row.sold-out .event-price { color: var(--color-text-muted); }
  .event-row.sold-out .event-date { color: oklch(0.32 0.012 258); }

  /* ── Empty state ─────────────────────────────────────────── */
  .empty {
    border: 1px dashed var(--color-border);
    padding: 48px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.10s both;
  }

  .empty-text {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--color-text-muted);
    text-align: center;
    line-height: 1.6;
    margin: 0;
  }

  /* ── Animations ──────────────────────────────────────────── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .page-heading, .col-header, .events-list,
    .soldout-divider, .events-list-soldout, .empty { animation: none; }
  }

  /* ── Responsive ──────────────────────────────────────────── */
  @media (max-width: 700px) {
    .nav { padding: 0 20px; }
    .main { padding: 96px 20px 64px; }

    .col-header { display: none; }

    .event-row {
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      gap: 6px 12px;
      padding: 14px 0;
    }

    .event-date {
      grid-column: 1;
      grid-row: 2;
      font-size: 10px;
    }

    .event-name {
      grid-column: 1;
      grid-row: 1;
      font-size: 14px;
    }

    .event-price {
      grid-column: 2;
      grid-row: 1;
      text-align: right;
    }

    .stock-cell {
      grid-column: 2;
      grid-row: 2;
      justify-content: flex-end;
    }

    .action-cell {
      grid-column: 1 / -1;
      grid-row: 3;
      justify-content: flex-start;
    }

    .btn-get { width: 100%; justify-content: center; padding: 10px 14px; }
  }
`;

export default async function EventsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabaseAdmin
    .from('events')
    .select('id, name, date, price_eur, capacity, tickets_sold, tickets_reserved')
    .gte('date', today)
    .eq('is_private', false)
    .order('date', { ascending: true });

  const all = (data ?? []) as EventRow[];
  const taken = (e: EventRow) => e.tickets_sold + (e.tickets_reserved ?? 0);
  const available = all.filter((e) => taken(e) < e.capacity);
  const soldOut = all.filter((e) => taken(e) >= e.capacity);

  const totalCount = available.length + soldOut.length;

  return (
    <>
      <style>{CSS}</style>
      <div className={`page-root ${unbounded.variable} ${epilogue.variable}`}>

        <nav className="nav">
          <div className="nav-left">
            <PasslyLogo />
            <div className="nav-divider" />
            <div className="nav-section">Events</div>
          </div>
          <div className="nav-chain">Solana</div>
        </nav>

        <main className="main">

          <div className="page-heading">
            <div className="page-label">
              <span className="page-label-line" />
              Discover
            </div>
            <h1 className="page-title">Events</h1>
            {totalCount > 0 && (
              <p className="page-sub">{totalCount} upcoming event{totalCount !== 1 ? 's' : ''}</p>
            )}
          </div>

          {totalCount === 0 ? (
            <div className="empty">
              <p className="empty-text">No events scheduled yet.<br />Check back soon.</p>
            </div>
          ) : (
            <>
              {/* Column headers (desktop) */}
              <div className="col-header">
                <div className="col-label">Date</div>
                <div className="col-label">Event</div>
                <div className="col-label col-label-right">Price</div>
                <div className="col-label col-label-right">Availability</div>
                <div className="col-label" />
              </div>

              {/* Available events */}
              {available.length > 0 && (
                <div className="events-list">
                  {available.map((e) => {
                    const remaining = e.capacity - taken(e);
                    const isLow = remaining / e.capacity <= 0.15;
                    const days = daysUntil(e.date);
                    const dateLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : formatDateShort(e.date);

                    return (
                      <div className="event-row available" key={e.id} title={formatDateLong(e.date)}>
                        <div className="event-date">{dateLabel}</div>
                        <div className="event-name">{e.name}</div>
                        <div className="event-price">{formatPrice(e.price_eur)}</div>
                        <div className="stock-cell">
                          {isLow && (
                            <div className="stock-badge stock-low">Only {remaining} left</div>
                          )}
                        </div>
                        <div className="action-cell">
                          <Link href={`/shop/${e.id}`} className="btn-get">
                            Get Tickets
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 5h6M5 2l3 3-3 3" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sold-out events */}
              {soldOut.length > 0 && (
                <>
                  <div className="soldout-divider">
                    <div className="soldout-label">Sold Out</div>
                    <div className="soldout-line" />
                  </div>
                  <div className="events-list-soldout">
                    {soldOut.map((e) => (
                      <div className="event-row sold-out" key={e.id}>
                        <div className="event-date">{formatDateShort(e.date)}</div>
                        <div className="event-name">{e.name}</div>
                        <div className="event-price">{formatPrice(e.price_eur)}</div>
                        <div className="stock-cell">
                          <div className="stock-badge stock-sold">Sold Out</div>
                        </div>
                        <div className="action-cell" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

        </main>
      </div>
    </>
  );
}
