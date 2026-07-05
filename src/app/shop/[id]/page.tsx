import { Epilogue, Unbounded } from 'next/font/google';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import type { Event } from '@/lib/supabase';
import ShopClient from './ShopClient';

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

async function getEvent(id: string): Promise<Event | null> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as Event;
}

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) notFound();

  const priceFormatted = (event.price_eur / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  const available = event.capacity - event.tickets_sold - (event.tickets_reserved ?? 0);
  const soldOut = available <= 0;

  return (
    <>
      <style>{`
        :root {
          --color-bg:          oklch(0.09 0.028 305);
          --color-surface:     oklch(0.15 0.024 308);
          --color-border:      oklch(0.26 0.022 305);
          --color-text:        oklch(0.96 0.008 75);
          --color-text-muted:  oklch(0.56 0.012 305);
          --color-accent:      oklch(0.79 0.19 48);
          --color-accent-bg:   oklch(0.18 0.048 48);
          --color-accent-2:    oklch(0.67 0.24 295);
          --color-accent-2-bg: oklch(0.16 0.040 295);
          --color-accent-3:    oklch(0.72 0.22 350);
          --color-accent-3-bg: oklch(0.17 0.040 350);
        }

        html, body { margin: 0; padding: 0; background: var(--color-bg); }

        .shop-root {
          font-family: var(--font-body);
          background-color: var(--color-bg);
          background-image: radial-gradient(circle, oklch(0.28 0.026 308 / 0.38) 1px, transparent 1px);
          background-size: 28px 28px;
          color: var(--color-text);
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          box-sizing: border-box;
        }

        .shop-card {
          width: 100%;
          max-width: 480px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          animation: fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) { .shop-card { animation: none; } }

        .shop-card-header {
          padding: 32px 36px 28px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .shop-eyebrow {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-accent);
        }

        .shop-title {
          font-family: var(--font-display);
          font-size: clamp(22px, 4vw, 28px);
          font-weight: 900;
          letter-spacing: -0.02em;
          line-height: 1.15;
          color: var(--color-text);
          margin: 0;
        }

        .shop-date {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
          margin-top: 4px;
        }

        .shop-card-body {
          padding: 28px 36px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .shop-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .shop-row-label {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .shop-row-value {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--color-text);
        }

        .shop-row-value.accent {
          font-size: 22px;
          color: var(--color-accent);
          letter-spacing: -0.01em;
        }

        .shop-divider { height: 1px; background: var(--color-border); }

        .shop-card-footer { padding: 24px 36px 32px; }

        .shop-brand {
          margin-top: 28px;
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          text-align: center;
        }

        .shop-brand span { color: var(--color-accent); }
      `}</style>

      <div className={`shop-root ${unbounded.variable} ${epilogue.variable}`}>
        <div className="shop-card">
          <div className="shop-card-header">
            <div className="shop-eyebrow">Event Ticket</div>
            <h1 className="shop-title">{event.name}</h1>
            <div className="shop-date">{event.date}</div>
          </div>

          <div className="shop-card-body">
            <div className="shop-row">
              <div className="shop-row-label">Price</div>
              <div className="shop-row-value accent">{priceFormatted}</div>
            </div>
            <div className="shop-divider" />
            <div className="shop-row">
              <div className="shop-row-label">Capacity</div>
              <div className="shop-row-value">{event.capacity.toLocaleString()}</div>
            </div>
            <div className="shop-row">
              <div className="shop-row-label">Available</div>
              <div className="shop-row-value">{soldOut ? 'Sold out' : available.toLocaleString()}</div>
            </div>
          </div>

          <div className="shop-card-footer">
            <ShopClient eventId={event.id} soldOut={soldOut} priceEur={event.price_eur} available={available} />
          </div>
        </div>

        <div className="shop-brand">Passly<span>.</span></div>
      </div>
    </>
  );
}
