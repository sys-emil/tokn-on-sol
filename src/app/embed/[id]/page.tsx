import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import type { Event, TicketTier } from '@/lib/supabase';
import { getT } from '@/lib/i18nServer';
import { formatEventDates } from '@/lib/eventDates';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Einbettbare Kaufkarte (seit 2026-09-13): `<iframe src="/embed/<id>">` auf der
 * Website des Veranstalters. Der Zielkunde verkauft heute ueber Instagram und
 * die eigene Seite; die Karte bringt den Vorverkauf dorthin, statt die Gaeste
 * erst auf getpassly.de zu schicken.
 *
 * Bewusst **nur eine Karte, kein Checkout**: der Kauf selbst laeuft auf
 * `/shop/[id]` (Ziel `_top`, also aus dem Rahmen heraus), wo Warteschlange,
 * Gast-Checkout, Rabattcodes und die Rechtstexte zu Hause sind. Ein zweiter
 * Checkout im Rahmen waere ein zweiter Ort fuer alles davon.
 *
 * `next.config.ts` erlaubt `frame-ancestors *` **nur** fuer `/embed/*`; alles
 * andere bleibt bei `'none'`. Der Snippet-Generator sitzt auf der
 * Event-Detailseite („Auf deine Website").
 */

function appOrigin(): string {
  return process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
}

export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lang, t } = await getT();

  const [{ data: event }, { data: tiers }] = await Promise.all([
    supabaseAdmin.from('events').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('ticket_tiers').select('*').eq('event_id', id).order('sort').order('created_at'),
  ]);
  if (!event) notFound();
  const ev = event as Event & { venue?: string | null; cancelled_at?: string | null };
  const tierRows = (tiers ?? []) as TicketTier[];

  const eventAvailable = Math.max(0, ev.capacity - ev.tickets_sold - (ev.tickets_reserved ?? 0));
  const available = tierRows.length > 0
    ? Math.min(eventAvailable, tierRows.reduce((sum, x) => sum + Math.max(0, x.capacity - x.tickets_sold - x.tickets_reserved), 0))
    : eventAvailable;
  const prices = tierRows.map((x) => x.price_eur);
  const minPrice = prices.length > 0 ? Math.min(...prices) : ev.price_eur;
  const uniform = prices.length > 0 && prices.every((p) => p === minPrice);
  const priceLabel = minPrice === 0 && uniform
    ? t('buy.free')
    : `${uniform ? '' : t('embed.from') + ' '}${(minPrice / 100).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE', { style: 'currency', currency: 'EUR' })}`;
  const cancelled = Boolean(ev.cancelled_at);
  const soldOut = available <= 0;
  const shopUrl = `${appOrigin()}/shop/${ev.id}`;

  return (
    <>
      <style>{`
        html, body { background: transparent !important; margin: 0; }
        .emb { font-family: var(--font, system-ui, sans-serif); padding: 2px; color: var(--ink); }
        .emb-card {
          display: flex; gap: 14px; align-items: stretch;
          background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
          box-shadow: var(--shadow-sm); overflow: hidden; min-height: 112px;
        }
        .emb-art { flex: none; width: 128px; background: var(--surface-3); position: relative; }
        .emb-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .emb-body { flex: 1; min-width: 0; padding: 14px 14px 14px 0; display: flex; flex-direction: column; gap: 4px; }
        .emb-card.no-art .emb-body { padding-left: 14px; }
        .emb-kicker { font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
        .emb-title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .emb-meta { font-size: 12.5px; color: var(--ink-3); line-height: 1.45; }
        .emb-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 6px; }
        .emb-price { font-size: 14px; font-weight: 600; }
        .emb-cta {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 36px; padding: 0 14px; border-radius: 9px;
          background: var(--accent); color: white; font-size: 13px; font-weight: 600; text-decoration: none;
          white-space: nowrap;
        }
        .emb-cta.is-off { background: var(--surface-2); color: var(--ink-3); pointer-events: none; }
        .emb-by { font-size: 10.5px; color: var(--ink-4); margin-top: 6px; text-align: right; }
        .emb-by a { color: inherit; text-decoration: none; }
        @media (max-width: 380px) { .emb-art { display: none; } .emb-body { padding-left: 14px; } }
      `}</style>
      <div className="emb">
        <div className={`emb-card${ev.image_url ? '' : ' no-art'}`}>
          {ev.image_url && (
            <div className="emb-art">
              {/* eslint-disable-next-line @next/next/no-img-element -- storage host is env-dependent */}
              <img src={ev.image_url} alt="" />
            </div>
          )}
          <div className="emb-body">
            <div className="emb-kicker">{t('embed.kicker')}</div>
            <div className="emb-title" title={ev.name}>{ev.name}</div>
            <div className="emb-meta">
              {formatEventDates(ev, lang, { weekday: false })}{ev.start_time ? ` · ${ev.start_time}${lang === 'en' ? '' : ' Uhr'}` : ''}
              {ev.venue ? ` · ${ev.venue}` : ''}
            </div>
            <div className="emb-foot">
              <div className="emb-price">{cancelled ? t('shop.cancelled') : soldOut ? t('buy.soldOut') : priceLabel}</div>
              <a className={`emb-cta${cancelled || soldOut ? ' is-off' : ''}`} href={shopUrl} target="_top" rel="noopener">
                {cancelled ? t('shop.cancelled') : soldOut ? t('buy.soldOut') : t('embed.cta')}
              </a>
            </div>
          </div>
        </div>
        <div className="emb-by"><a href={appOrigin()} target="_top" rel="noopener">{t('embed.by')}</a></div>
      </div>
    </>
  );
}
