import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import type { Event, TicketTier } from '@/lib/supabase';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { ShowcaseHero, ShowcaseArt, SHOWCASE_HERO_CSS } from '@/app/components/eventSurfaces/ShowcaseHero';
import { eventHue } from '@/app/components/eventSurfaces/EventCard';
import { LegalLinks } from '@/app/components/LegalLinks';
import { getT } from '@/lib/i18nServer';
import { serviceFeePerTicketCents } from '@/lib/fees';
import type { Lang } from '@/lib/i18n';
import EventTabs, { Gallery } from './EventTabs';
import type { TabPanel } from './EventTabs';

export const dynamic = 'force-dynamic';

/**
 * Showcase-Seite zwischen Liste und Kauf: /events → /event/[id] → /shop/[id].
 *
 * Hier wird das Event verkauft (Bilder, Langtext, Kategorien-Vorschau), gekauft
 * wird eine Seite weiter. Bewusst **keine Kaufbox** — es gibt weiterhin genau
 * eine Kaufstrecke, und die liegt in /shop/[id].
 */

async function getEvent(id: string): Promise<Event | null> {
  const { data, error } = await supabaseAdmin.from('events').select('*').eq('id', id).single();
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

/** Saisonpaesse, die diesen Termin einschliessen — wie auf /shop/[id]. */
async function getPasses(eventId: string): Promise<{ id: string; name: string; priceCents: number; dates: number }[]> {
  const { data: links } = await supabaseAdmin
    .from('season_pass_events')
    .select('pass_id')
    .eq('event_id', eventId);

  const passIds = ((links ?? []) as { pass_id: string }[]).map((l) => l.pass_id);
  if (passIds.length === 0) return [];

  const [{ data: passes }, { data: allDates }] = await Promise.all([
    supabaseAdmin
      .from('season_passes')
      .select('id, name, price_eur, capacity, tickets_sold, tickets_reserved')
      .in('id', passIds)
      .eq('active', true),
    supabaseAdmin.from('season_pass_events').select('pass_id').in('pass_id', passIds),
  ]);

  const dateCount = new Map<string, number>();
  for (const row of (allDates ?? []) as { pass_id: string }[]) {
    dateCount.set(row.pass_id, (dateCount.get(row.pass_id) ?? 0) + 1);
  }

  type PassRow = { id: string; name: string; price_eur: number; capacity: number; tickets_sold: number; tickets_reserved: number };
  return ((passes ?? []) as PassRow[])
    .filter((p) => p.capacity - p.tickets_sold - p.tickets_reserved > 0)
    .map((p) => ({ id: p.id, name: p.name, priceCents: p.price_eur, dates: dateCount.get(p.id) ?? 0 }));
}

const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'de-DE');
const formatDate = (iso: string, lang: Lang) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(locale(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthShort = (iso: string, lang: Lang) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(locale(lang), { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const money = (cents: number, lang: Lang) =>
  (cents / 100).toLocaleString(locale(lang), { style: 'currency', currency: 'EUR' });

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [event, { lang, t }] = await Promise.all([getEvent(id), getT()]);
  if (!event) return { title: 'Event nicht gefunden · Passly' };

  const dateLabel = formatDate(event.date, lang);
  const title = `${event.name} · ${dateLabel} · Passly`;
  const description = (event.description?.trim() || null)
    ?? t('showcase.metaFallback', { name: event.name, date: dateLabel });

  return {
    title,
    description,
    alternates: { canonical: `/event/${event.id}` },
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

const PAGE_CSS = `
  @keyframes sc-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

  .sc-page { background: var(--surface-2); min-height: 100vh; display: flex; flex-direction: column; }
  .sc-page .topbar-inner { height: 64px; padding: 0 32px; gap: 28px; }
  .sc-shell { max-width: 1100px; margin: 0 auto; padding: 0 32px; width: 100%; }

  /* ── Hero ─────────────────────────────────────────────────────── */
  .sc-hero-wrap { padding: 28px 32px 0; max-width: 1100px; margin: 0 auto; width: 100%;
    animation: sc-rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
  ${SHOWCASE_HERO_CSS}

  /* ── Tabs ─────────────────────────────────────────────────────── */
  .sc-tabs { margin: 36px auto 0; max-width: 1100px; padding: 0 32px; width: 100%; }
  .sc-tabbar {
    display: flex; align-items: center; gap: 12px;
    padding-bottom: 14px; border-bottom: 1px solid var(--line);
  }
  .sc-tablist { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .sc-tablist::-webkit-scrollbar { display: none; }
  .sc-tab {
    padding: 8px 4px; font-size: 26px; font-weight: 620; letter-spacing: -0.03em;
    /* ink-3, nicht ink-4: die Tableiste ist die Hauptnavigation dieser Seite,
       und ink-4 auf surface-2 liegt unter dem 3:1-Kontrast fuer grosse Schrift. */
    color: var(--ink-3); background: none; border: none; cursor: pointer;
    white-space: nowrap; transition: color 0.25s;
  }
  .sc-tab:hover { color: var(--ink-2); }
  .sc-tab.active { color: var(--ink); }
  .sc-tab + .sc-tab { margin-left: 20px; }
  .sc-arrow {
    width: 44px; height: 44px; flex: none; display: grid; place-items: center;
    border-radius: 50%; border: 1px solid var(--line-2); background: var(--surface);
    color: var(--ink-2); cursor: pointer; box-shadow: var(--shadow-sm);
    transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s;
  }
  .sc-arrow:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: #fff; transform: translateY(-1px); }
  .sc-arrow:disabled { opacity: 0.35; cursor: default; }
  .sc-viewport { position: relative; overflow: hidden; transition: height 0.45s cubic-bezier(0.2, 0.7, 0.2, 1); }
  .sc-track { display: flex; transition: transform 0.45s cubic-bezier(0.2, 0.7, 0.2, 1); }
  .sc-panel { flex: 0 0 100%; min-width: 0; padding: 28px 2px 8px; align-self: flex-start; }

  /* Sichtbarer Tastaturfokus. globals.css definiert nur einen Ring fuer
     .input, alle Knoepfe hier haetten sonst nur den Browser-Default — auf dem
     dunklen Hero praktisch unsichtbar. */
  .sc-tab:focus-visible, .sc-arrow:focus-visible, .sc-gallery-nav:focus-visible,
  .sc-tickets-cta:focus-visible, .sc-pass:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 3px;
  }
  /* Auf dem Hero und in den scrollenden Leisten liegt der Ring innen, sonst
     schneidet ihn der Container ab. */
  .sc-back:focus-visible, .sc-cta:focus-visible,
  .sc-hero-org:focus-visible, .sc-venue:focus-visible {
    outline: 2px solid #fff; outline-offset: 3px;
  }
  .sc-thumb:focus-visible { outline: 2px solid var(--accent); outline-offset: -4px; }

  /* ── Panel: Uebersicht ────────────────────────────────────────── */
  .sc-overview { display: grid; grid-template-columns: 1.6fr 1fr; gap: 32px; align-items: start; }
  .sc-text { font-size: 15.5px; line-height: 1.7; color: var(--ink-2); white-space: pre-line; }
  .sc-text.empty { color: var(--ink-3); font-style: italic; }
  .sc-facts {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 16px; padding: 20px 22px; box-shadow: var(--shadow-sm);
  }
  .sc-facts h3 {
    margin: 0 0 14px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-3);
  }
  .sc-fact { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 9px 0; font-size: 13.5px; }
  .sc-fact + .sc-fact { border-top: 1px solid var(--line); }
  .sc-fact .k { color: var(--ink-3); flex: none; }
  .sc-fact .v { font-weight: 600; text-align: right; min-width: 0; }

  /* ── Panel: Galerie ───────────────────────────────────────────── */
  .sc-gallery-stage {
    position: relative; aspect-ratio: 16 / 9; border-radius: 18px; overflow: hidden;
    background: var(--surface-3); border: 1px solid var(--line);
  }
  .sc-gallery-stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .sc-gallery-nav {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 44px; height: 44px; display: grid; place-items: center;
    border-radius: 50%; border: none; cursor: pointer;
    background: rgba(255, 255, 255, 0.9); color: var(--ink);
    box-shadow: 0 4px 14px rgba(17, 20, 45, 0.2);
    transition: background 0.2s, transform 0.2s;
  }
  .sc-gallery-nav:hover { background: #fff; }
  .sc-gallery-nav.prev { left: 14px; }
  .sc-gallery-nav.next { right: 14px; }
  .sc-gallery-thumbs { display: flex; gap: 10px; margin-top: 14px; overflow-x: auto; scrollbar-width: none; }
  .sc-gallery-thumbs::-webkit-scrollbar { display: none; }
  .sc-thumb {
    width: 92px; height: 62px; flex: none; padding: 0; cursor: pointer;
    border-radius: 10px; overflow: hidden; position: relative;
    border: 2px solid transparent; background: var(--surface-3);
    transition: border-color 0.2s, opacity 0.2s; opacity: 0.65;
  }
  .sc-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .sc-thumb:hover { opacity: 1; }
  .sc-thumb.active { border-color: var(--accent); opacity: 1; }
  .sc-gallery-count { margin-top: 10px; font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }

  /* ── Panel: Tickets ───────────────────────────────────────────── */
  .sc-tickets-head { margin-bottom: 16px; }
  .sc-tickets-head h3 { margin: 0; font-size: 17px; font-weight: 620; letter-spacing: -0.02em; }
  .sc-tickets-head p { margin: 5px 0 0; font-size: 13.5px; color: var(--ink-3); }
  .sc-tier {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 16px 20px; background: var(--surface);
    border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-sm);
  }
  .sc-tier + .sc-tier { margin-top: 10px; }
  .sc-tier.gone { opacity: 0.6; }
  .sc-tier .n { font-size: 15px; font-weight: 600; letter-spacing: -0.015em; }
  .sc-tier .a { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; }
  .sc-tier .p { font-size: 19px; font-weight: 640; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  /* Optik aus .btn.primary.lg (globals.css); hier nur der Abstand. */
  .sc-tickets-cta { margin-top: 20px; color: #fff; }
  .sc-fee { margin-top: 12px; font-size: 12.5px; color: var(--ink-3); }

  /* ── Saisonpaesse + Fuss ──────────────────────────────────────── */
  .sc-after { max-width: 1100px; margin: 0 auto; padding: 40px 32px 96px; width: 100%; }
  .sc-passes { display: grid; gap: 10px; }
  .sc-passes-head {
    font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-3); margin-bottom: 4px;
  }
  .sc-pass {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    border: 1px solid var(--accent-line); background: var(--accent-wash);
    border-radius: 14px; font-size: 13.5px; color: var(--ink-2);
    transition: border-color 0.15s, transform 0.15s;
  }
  .sc-pass:hover { border-color: var(--accent); transform: translateY(-1px); }
  .sc-pass .ic { width: 32px; height: 32px; border-radius: 9px; flex: none; background: var(--accent); color: #fff; display: grid; place-items: center; }
  .sc-pass .n { font-weight: 600; color: var(--ink); display: block; }
  .sc-pass .s { display: block; font-size: 12.5px; color: var(--ink-3); margin-top: 2px; }
  .sc-pass .go { margin-left: auto; flex: none; color: var(--accent-ink); font-weight: 600; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; }
  .sc-more { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 18px; font-size: 13px; color: var(--ink-3); }
  .sc-more a { color: var(--ink-3); }
  .sc-more a:hover { color: var(--ink); }

  .sc-footer { border-top: 1px solid var(--line); background: var(--surface); margin-top: auto; }
  .sc-footer-inner {
    max-width: 1100px; margin: 0 auto; padding: 28px 32px;
    display: flex; flex-wrap: wrap; align-items: center; gap: 20px;
    font-size: 13px; color: var(--ink-3);
  }
  .sc-footer-links { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 22px; }
  .sc-footer-links a { color: var(--ink-3); }
  .sc-footer-links a:hover { color: var(--ink); }

  /* Mobil liegt der Kauf immer griffbereit am unteren Rand. */
  .sc-sticky { display: none; }

  @media (max-width: 900px) {
    .sc-overview { grid-template-columns: 1fr; gap: 22px; }
  }

  @media (max-width: 780px) {
    .sc-page .topbar-inner { padding: 0 16px; gap: 10px; height: 60px; }
    .sc-hero-wrap { padding: 14px 16px 0; }
    .sc-tabs { padding: 0 16px; margin-top: 24px; }
    .sc-tabbar { gap: 8px; }
    .sc-tab { font-size: 19px; padding: 10px 4px; }
    .sc-tab + .sc-tab { margin-left: 14px; }
    /* 44px bleibt auch mobil die Untergrenze fuer ein Tippziel. */
    .sc-arrow { width: 44px; height: 44px; }
    .sc-panel { padding: 20px 2px 8px; }
    .sc-text { font-size: 15px; }
    .sc-gallery-stage { aspect-ratio: 4 / 3; border-radius: 14px; }
    .sc-tier { padding: 14px 16px; border-radius: 12px; }
    .sc-after { padding: 28px 16px 96px; }
    .sc-footer-inner { padding: 24px 16px 96px; }

    .sc-sticky {
      display: flex; align-items: center; justify-content: space-between; gap: 14px;
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: color-mix(in oklab, var(--surface) 92%, transparent);
      backdrop-filter: blur(14px) saturate(1.3);
      border-top: 1px solid var(--line);
    }
    .sc-sticky .p { font-size: 17px; font-weight: 640; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    /* .btn.primary.lg plus die 44px-Untergrenze fuers Tippziel. */
    .sc-sticky .b { min-height: 44px; gap: 7px; color: #fff; }
    .sc-sticky .b.disabled {
      background: var(--surface-3); color: var(--ink-3);
      box-shadow: none; pointer-events: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sc-hero-wrap { animation: none; }
    .sc-viewport, .sc-track, .sc-arrow, .sc-tickets-cta, .sc-pass, .sc-gallery-nav { transition: none; }
    .sc-arrow:hover:not(:disabled), .sc-tickets-cta:hover, .sc-pass:hover { transform: none; }
  }
`;

export default async function EventShowcasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, { lang, t }] = await Promise.all([getEvent(id), getT()]);
  if (!event) notFound();

  const cancelled = Boolean((event as Event & { cancelled_at?: string | null }).cancelled_at);
  const [tiers, passes] = await Promise.all([
    getTiers(id),
    cancelled ? Promise.resolve([]) : getPasses(id),
  ]);

  const { data: organizerRow } = await supabaseAdmin
    .from('organizers')
    .select('name, business_name, type, public_name, handle, is_verified, verified_label')
    .eq('wallet_address', event.organizer_wallet)
    .maybeSingle();
  const organizerName = organizerRow
    ? (organizerRow.public_name?.trim()
        || (organizerRow.type === 'business' && organizerRow.business_name ? organizerRow.business_name : organizerRow.name))
    : null;
  const organizerHandle = (organizerRow?.handle as string | null) ?? null;
  const organizerVerified = Boolean(organizerRow?.is_verified);
  const organizerVerifiedLabel = (organizerRow?.verified_label as string | null) ?? null;

  // Verfuegbarkeit exakt wie auf der Kaufseite: pro Kategorie, zusaetzlich
  // durch die Event-Zaehler gedeckelt (dieselben Zahlen wie reserve_tickets).
  const eventAvailable = Math.max(0, event.capacity - event.tickets_sold - (event.tickets_reserved ?? 0));
  const tierViews = tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    priceEur: tier.price_eur,
    available: Math.min(eventAvailable, Math.max(0, tier.capacity - tier.tickets_sold - tier.tickets_reserved)),
  }));

  const prices = tierViews.map((tv) => tv.priceEur);
  const minPrice = prices.length > 0 ? Math.min(...prices) : event.price_eur;
  const uniformPrice = prices.length > 0 && prices.every((p) => p === minPrice);
  const priceLabel = minPrice === 0 && uniformPrice
    ? t('common.free')
    : uniformPrice
      ? money(minPrice, lang)
      : t('showcase.fromPrice', { price: money(minPrice, lang) });

  const available = tierViews.length > 0
    ? Math.min(eventAvailable, tierViews.reduce((sum, tv) => sum + tv.available, 0))
    : eventAvailable;
  const soldOut = available <= 0;
  const buyable = !cancelled && !soldOut;

  const gallery = Array.isArray(event.gallery_urls) ? event.gallery_urls.filter((u) => typeof u === 'string') : [];
  const bodyText = event.long_description?.trim() || event.description?.trim() || null;
  const startSuffix = t('ticket.startSuffix');
  const hue = eventHue(event.name);
  // accent_hue steht in der DB, aber nicht auf dem Event-Typ (wie auf /@handle).
  const accentHue = (event as Event & { accent_hue?: number | null }).accent_hue ?? null;

  const panels: TabPanel[] = [
    {
      key: 'overview',
      label: t('showcase.tabOverview'),
      node: (
        <div className="sc-overview">
          <div className={`sc-text${bodyText ? '' : ' empty'}`}>{bodyText ?? t('showcase.noText')}</div>
          <div className="sc-facts">
            <h3>{t('showcase.facts')}</h3>
            <div className="sc-fact"><span className="k">{t('showcase.factDate')}</span><span className="v">{formatDate(event.date, lang)}</span></div>
            {event.start_time && (
              <div className="sc-fact"><span className="k">{t('showcase.factStart')}</span><span className="v">{event.start_time}{startSuffix ? ` ${startSuffix}` : ''}</span></div>
            )}
            {event.venue && (
              <div className="sc-fact"><span className="k">{t('showcase.factVenue')}</span><span className="v">{event.venue}</span></div>
            )}
            <div className="sc-fact"><span className="k">{t('showcase.factCapacity')}</span><span className="v">{event.capacity}</span></div>
            {organizerName && (
              <div className="sc-fact">
                <span className="k">{t('showcase.factOrganizer')}</span>
                <span className="v">
                  {organizerHandle ? <Link href={`/@${organizerHandle}`} style={{ color: 'inherit' }}>{organizerName}</Link> : organizerName}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    // Ohne Bilder gibt es keinen leeren Tab, sondern gar keinen.
    ...(gallery.length > 0 ? [{
      key: 'gallery',
      label: t('showcase.tabGallery'),
      node: (
        <Gallery
          images={gallery}
          alt={event.name}
          prevLabel={t('showcase.prevImage')}
          nextLabel={t('showcase.nextImage')}
          // Ohne vars liefert t() die Vorlage mit {index}/{total} zurueck; die
          // Zahlen setzt der Client ein, weil er als Einziger den Stand kennt.
          countTemplate={t('showcase.imageCount')}
        />
      ),
    }] : []),
    {
      key: 'tickets',
      label: t('showcase.tabTickets'),
      node: (
        <div>
          <div className="sc-tickets-head">
            <h3>{t('showcase.ticketsHead')}</h3>
            <p>{t('showcase.ticketsSub')}</p>
          </div>
          {tierViews.map((tv) => (
            <div key={tv.id} className={`sc-tier${tv.available <= 0 ? ' gone' : ''}`}>
              <div style={{ minWidth: 0 }}>
                <div className="n">{tv.name}</div>
                <div className="a">
                  {tv.available <= 0 ? t('showcase.tierSoldOut') : t('showcase.tierLeft', { count: tv.available })}
                </div>
              </div>
              <div className="p">{tv.priceEur === 0 ? t('common.free') : money(tv.priceEur, lang)}</div>
            </div>
          ))}
          {minPrice > 0 && (
            <div className="sc-fee">{t('showcase.feeNote', { fee: money(serviceFeePerTicketCents(minPrice), lang) })}</div>
          )}
          {buyable && (
            <Link href={`/shop/${event.id}`} className="sc-tickets-cta btn primary lg">
              {t('showcase.getTickets')} <Icon name="arrow" size={16} />
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app sc-page" style={accentHue != null ? ({ '--hue': String(accentHue) } as React.CSSProperties) : undefined}>

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events" className="active">{t('common.events')}</Link>
              <Link href="/my-tickets">{t('common.myTickets')}</Link>
            </div>
          </div>
        </div>

        <div className="sc-hero-wrap">
          <ShowcaseHero
            name={event.name}
            art={<ShowcaseArt name={event.name} imageUrl={event.image_url} hue={hue} />}
            whenLabel={`${monthShort(event.date, lang)} ${dayNum(event.date)}${event.start_time ? ` · ${event.start_time}${startSuffix ? ` ${startSuffix}` : ''}` : ''}`}
            venue={event.venue}
            venueLink
            organizerName={organizerName}
            organizerHandle={organizerHandle}
            organizerVerified={organizerVerified}
            organizerVerifiedLabel={organizerVerifiedLabel}
            verifiedLabel={t('shop.verified')}
            priceLabel={priceLabel}
            feeLabel={minPrice > 0 ? t('showcase.feeNote', { fee: money(serviceFeePerTicketCents(minPrice), lang) }) : null}
            trustLabel={t('shop.trust')}
            backLabel={t('showcase.backToEvents')}
            ctaLabel={buyable ? t('showcase.getTickets') : t('showcase.soldOut')}
            ctaHref={`/shop/${event.id}`}
            ctaDisabled={!buyable}
            cancelledText={cancelled ? t('shop.cancelledText') : null}
          />
        </div>
        <EventTabs
          panels={panels}
          prevLabel={t('showcase.prevTab')}
          nextLabel={t('showcase.nextTab')}
          tablistLabel={t('showcase.tablistLabel')}
        />

        <div className="sc-after">
          {passes.length > 0 && (
            <div className="sc-passes">
              <div className="sc-passes-head">{t('shop.passesHead')}</div>
              {passes.map((p) => (
                <Link key={p.id} href={`/pass/${p.id}`} className="sc-pass">
                  <span className="ic"><Icon name="ticket" size={15} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="n">{p.name}</span>
                    <span className="s">
                      {p.dates === 1 ? t('events.validForDate') : t('events.validForDates', { count: p.dates })}
                      {p.priceCents > 0 && ` · ${money(p.priceCents, lang)}`}
                    </span>
                  </span>
                  <span className="go">{t('shop.passView')} <Icon name="arrow" size={13} /></span>
                </Link>
              ))}
            </div>
          )}

          <div className="sc-more">
            {organizerName && (
              <Link href={`/events?veranstalter=${encodeURIComponent(event.organizer_wallet)}`}>
                {t('shop.moreFrom', { name: organizerName })}
              </Link>
            )}
            <Link href="/events">{t('shop.allEvents')}</Link>
          </div>
        </div>

        <footer className="sc-footer">
          <div className="sc-footer-inner">
            <span>© 2026 Passly · {t('common.tagline')}</span>
            <div className="sc-footer-links">
              <Link href="/so-funktionierts">{t('common.howItWorks')}</Link>
              <LegalLinks style={{ fontSize: 13, color: 'inherit', gap: 22 }} />
            </div>
          </div>
        </footer>

        {!cancelled && (
          <div className="sc-sticky">
            <span className="p">{priceLabel}</span>
            {buyable ? (
              <Link href={`/shop/${event.id}`} className="b btn primary lg">{t('showcase.getTickets')} <Icon name="arrow" size={15} /></Link>
            ) : (
              <span className="b btn primary lg disabled">{t('showcase.soldOut')}</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
