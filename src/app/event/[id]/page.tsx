import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import type { Event, TicketTier } from '@/lib/supabase';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon, VerifiedCheck } from '@/app/components/passlyUi';
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

/** Gleiche generative Optik wie die Karten auf /events, wenn kein Bild da ist. */
function eventHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

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
  .sc-hero {
    position: relative; border-radius: 24px; overflow: hidden;
    background: var(--ink); color: #fff;
    box-shadow: 0 30px 70px -30px rgba(17, 20, 45, 0.45), 0 2px 8px rgba(17, 20, 45, 0.08);
  }
  .sc-hero-art { position: absolute; inset: 0; }
  .sc-hero-art img, .sc-hero-art .sc-art-bg {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  }
  .sc-hero-scrim {
    position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(100deg, rgba(11, 8, 26, 0.93) 0%, rgba(11, 8, 26, 0.72) 45%, rgba(11, 8, 26, 0.2) 80%),
      linear-gradient(0deg, rgba(11, 8, 26, 0.6), transparent 55%);
  }
  .sc-hero-inner {
    position: relative; display: grid; grid-template-columns: 1.4fr 0.6fr;
    gap: 40px; align-items: end; padding: 44px 40px 40px; min-height: 440px;
  }
  .sc-back {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.72); margin-bottom: 18px;
  }
  .sc-back:hover { color: #fff; }
  .sc-hero-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
  .sc-when {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.13); border: 1px solid rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(10px);
    font-size: 12px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; color: rgba(255, 255, 255, 0.92);
  }
  .sc-hero h1 {
    margin: 0; font-size: 52px; line-height: 1.04; font-weight: 640;
    letter-spacing: -0.04em; color: #fff; text-wrap: balance; max-width: 17ch;
  }
  .sc-hero-meta {
    display: flex; flex-wrap: wrap; align-items: center; gap: 20px;
    color: rgba(255, 255, 255, 0.82); font-size: 14.5px;
  }
  .sc-hero-meta span, .sc-hero-meta a { display: inline-flex; align-items: center; gap: 8px; color: inherit; }
  .sc-hero-meta a { text-decoration: underline; text-underline-offset: 3px; }
  .sc-hero-meta a:hover { color: #fff; }
  .sc-hero-org { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; color: inherit; }
  .sc-hero-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px; border-radius: 6px;
    background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.24);
    font-size: 11.5px; font-weight: 500; color: rgba(255, 255, 255, 0.9);
  }

  .sc-buybox {
    padding: 24px; border-radius: 18px;
    background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(22px) saturate(1.3);
    box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.5);
  }
  .sc-buybox .amount {
    display: block; font-size: 32px; font-weight: 640; letter-spacing: -0.035em;
    color: #fff; font-variant-numeric: tabular-nums;
  }
  .sc-buybox .fee { display: block; font-size: 12.5px; color: rgba(255, 255, 255, 0.6); margin-top: 4px; }
  .sc-cta {
    margin-top: 18px; display: flex; align-items: center; justify-content: center; gap: 8px;
    height: 48px; border-radius: 12px; background: #fff; color: var(--ink);
    font-size: 15px; font-weight: 640; transition: transform 0.2s, box-shadow 0.2s;
  }
  .sc-cta:hover { color: var(--ink); transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28); }
  .sc-cta.disabled { background: rgba(255, 255, 255, 0.18); color: rgba(255, 255, 255, 0.72); pointer-events: none; }
  .sc-buybox .trust {
    margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 7px;
    font-size: 12.5px; color: rgba(255, 255, 255, 0.66); text-align: center;
  }
  .sc-cancelled {
    margin-top: 4px; padding: 12px 14px; border-radius: 10px;
    background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.28);
    font-size: 13px; line-height: 1.55; color: rgba(255, 255, 255, 0.92);
  }

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
    color: var(--ink-4); background: none; border: none; cursor: pointer;
    white-space: nowrap; transition: color 0.25s;
  }
  .sc-tab:hover { color: var(--ink-3); }
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
  .sc-tickets-cta {
    display: inline-flex; align-items: center; gap: 8px; margin-top: 20px;
    padding: 12px 20px; border-radius: 12px;
    background: var(--accent); color: #fff; font-size: 14.5px; font-weight: 600;
    transition: background 0.2s, transform 0.2s;
  }
  .sc-tickets-cta:hover { background: var(--accent-2); color: #fff; transform: translateY(-1px); }
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
    .sc-hero { border-radius: 20px; }
    .sc-hero-inner {
      grid-template-columns: 1fr; gap: 18px; padding: 0;
      align-items: end; align-content: end; min-height: 0; aspect-ratio: 4 / 5;
    }
    .sc-hero-scrim {
      background: linear-gradient(0deg, rgba(11, 8, 26, 0.94) 10%, rgba(11, 8, 26, 0.3) 58%, rgba(11, 8, 26, 0.08));
    }
    .sc-hero-copy { gap: 12px; padding: 18px 18px 0; }
    .sc-hero h1 { font-size: 27px; line-height: 1.12; max-width: none; }
    .sc-hero-meta { gap: 12px; font-size: 13px; }
    .sc-back { margin-bottom: 12px; }
    .sc-buybox {
      padding: 0 18px 18px; border: none; background: none;
      box-shadow: none; backdrop-filter: none; border-radius: 0;
    }
    .sc-buybox .amount { font-size: 24px; }
    .sc-buybox .trust { display: none; }
    .sc-cta { margin-top: 12px; height: 46px; }

    .sc-tabs { padding: 0 16px; margin-top: 24px; }
    .sc-tabbar { gap: 8px; }
    .sc-tab { font-size: 19px; }
    .sc-tab + .sc-tab { margin-left: 14px; }
    .sc-arrow { width: 38px; height: 38px; }
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
    .sc-sticky .b {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 12px 18px; border-radius: 12px; min-height: 44px;
      background: var(--accent); color: #fff; font-size: 14.5px; font-weight: 600;
    }
    .sc-sticky .b.disabled { background: var(--surface-3); color: var(--ink-3); pointer-events: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sc-hero-wrap { animation: none; }
    .sc-viewport, .sc-track, .sc-arrow, .sc-cta, .sc-tickets-cta, .sc-pass, .sc-gallery-nav { transition: none; }
    .sc-arrow:hover:not(:disabled), .sc-cta:hover, .sc-tickets-cta:hover, .sc-pass:hover { transform: none; }
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

  const heroArt = event.image_url ? (
    // eslint-disable-next-line @next/next/no-img-element -- storage host is env-dependent, skip next/image remotePatterns
    <img src={event.image_url} alt="" />
  ) : (
    <div
      className="sc-art-bg"
      style={{
        background: `radial-gradient(ellipse at 30% 40%, oklch(0.72 0.15 ${hue}), transparent 60%), radial-gradient(ellipse at 70% 65%, oklch(0.66 0.13 ${(hue + 50) % 360}), transparent 55%), oklch(0.45 0.09 ${hue})`,
      }}
    />
  );

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
            <Link href={`/shop/${event.id}`} className="sc-tickets-cta">
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
          <div className="sc-hero">
            <div className="sc-hero-art">{heroArt}</div>
            <div className="sc-hero-scrim" aria-hidden="true" />
            <div className="sc-hero-inner">
              <div className="sc-hero-copy">
                <Link href="/events" className="sc-back"><Icon name="chevronLeft" size={14} />{t('showcase.backToEvents')}</Link>
                <span className="sc-when">
                  <Icon name="calendar" size={13} />
                  {monthShort(event.date, lang)} {dayNum(event.date)}
                  {event.start_time ? ` · ${event.start_time}${startSuffix ? ` ${startSuffix}` : ''}` : ''}
                </span>
                <h1>{event.name}</h1>
                <div className="sc-hero-meta">
                  {organizerName && (
                    organizerHandle ? (
                      <Link href={`/@${organizerHandle}`} className="sc-hero-org">
                        {organizerName}
                        {organizerVerified && <VerifiedCheck size={15} title={organizerVerifiedLabel ?? t('shop.verified')} />}
                        <span className="sc-hero-chip"><Icon name="shield" size={11} />{t('shop.verified')}</span>
                      </Link>
                    ) : (
                      <span className="sc-hero-org">
                        {organizerName}
                        {organizerVerified && <VerifiedCheck size={15} title={organizerVerifiedLabel ?? t('shop.verified')} />}
                        <span className="sc-hero-chip"><Icon name="shield" size={11} />{t('shop.verified')}</span>
                      </span>
                    )
                  )}
                  {event.venue && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(event.venue)}`} target="_blank" rel="noopener noreferrer">
                      <Icon name="location" size={15} />{event.venue}
                    </a>
                  )}
                </div>
              </div>

              <div className="sc-buybox">
                {cancelled ? (
                  <div className="sc-cancelled">{t('shop.cancelledText')}</div>
                ) : (
                  <>
                    <span className="amount">{priceLabel}</span>
                    {minPrice > 0 && (
                      <span className="fee">{t('showcase.feeNote', { fee: money(serviceFeePerTicketCents(minPrice), lang) })}</span>
                    )}
                    {buyable ? (
                      <Link href={`/shop/${event.id}`} className="sc-cta">
                        {t('showcase.getTickets')} <Icon name="arrow" size={17} />
                      </Link>
                    ) : (
                      <span className="sc-cta disabled">{t('showcase.soldOut')}</span>
                    )}
                    <div className="trust"><Icon name="shield" size={14} />{t('shop.trust')}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <EventTabs panels={panels} prevLabel={t('showcase.prevTab')} nextLabel={t('showcase.nextTab')} />

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
              <Link href={`/shop/${event.id}`} className="b">{t('showcase.getTickets')} <Icon name="arrow" size={15} /></Link>
            ) : (
              <span className="b disabled">{t('showcase.soldOut')}</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
