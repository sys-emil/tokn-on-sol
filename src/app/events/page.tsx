import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { LegalLinks } from '@/app/components/LegalLinks';
import { getT } from '@/lib/i18nServer';
import { cityFromVenue, cityMatches } from '@/lib/eventCity';
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
  description: string | null;
  created_at: string | null;
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

/** Vor weniger als 7 Tagen angelegt — treibt das „Neu"-Badge auf der Karte. */
function isRecent(createdAt: string | null): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 7 * 86400000;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

const PAGE_CSS = `
  @keyframes ev-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes ev-breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

  .ev-page { background: var(--surface-2); }
  .ev-page .topbar-inner { height: 64px; padding: 0 32px; gap: 28px; }
  .ev-page .nav a { font-size: 14px; border-radius: 8px; padding: 7px 13px; }
  .ev-page .nav a.active { background: var(--surface-3); color: var(--ink); font-weight: 550; }
  .ev-topbar-link { font-size: 14px; font-weight: 500; color: var(--ink-3); }
  .ev-topbar-link:hover { color: var(--ink); }
  .ev-topbar-cta {
    display: inline-flex; align-items: center;
    padding: 9px 16px; border-radius: 10px;
    font-size: 14px; font-weight: 600;
    background: var(--accent); color: #fff;
    box-shadow: 0 2px 12px oklch(0.54 0.22 var(--hue) / 0.28);
    transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .ev-topbar-cta:hover {
    background: var(--accent-2); color: #fff;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px oklch(0.54 0.22 var(--hue) / 0.34);
  }

  /* Kopfband: eigener Verlauf statt der globalen .aurora, damit die dunkle
     Featured-Karte einen ruhigen Hintergrund bekommt. */
  .ev-band { position: relative; overflow: hidden; }
  .ev-glow {
    position: absolute; inset: -20% -10% auto -10%; height: 640px;
    background:
      radial-gradient(600px 300px at 18% 20%, oklch(0.86 0.11 var(--hue) / 0.55), transparent 65%),
      radial-gradient(700px 320px at 78% 8%, oklch(0.90 0.09 210 / 0.5), transparent 65%);
    filter: blur(20px); pointer-events: none;
  }
  .ev-shell { position: relative; max-width: 1240px; margin: 0 auto; padding: 0 32px; }

  /* ── Featured ─────────────────────────────────────────────────── */
  .ev-featured-wrap { padding-top: 44px; animation: ev-rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
  .ev-featured {
    position: relative; display: block;
    border-radius: 24px; overflow: hidden;
    background: var(--ink); color: #fff;
    box-shadow: 0 30px 70px -30px rgba(17, 20, 45, 0.45), 0 2px 8px rgba(17, 20, 45, 0.08);
  }
  .ev-featured-art { position: absolute; inset: 0; }
  .ev-featured-art img, .ev-featured-art .art-bg {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .ev-featured:hover .ev-featured-art img, .ev-featured:hover .ev-featured-art .art-bg { transform: scale(1.03); }
  .ev-featured-scrim {
    position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(100deg, rgba(11, 8, 26, 0.92) 0%, rgba(11, 8, 26, 0.7) 42%, rgba(11, 8, 26, 0.15) 78%),
      linear-gradient(0deg, rgba(11, 8, 26, 0.55), transparent 55%);
  }
  .ev-featured-inner {
    position: relative; display: grid; grid-template-columns: 1.35fr 0.65fr;
    gap: 40px; align-items: end; padding: 56px 44px 44px; min-height: 460px;
  }
  .ev-featured-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
  .ev-featured-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px 6px 10px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.13); border: 1px solid rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(10px);
    font-size: 11.5px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: rgba(255, 255, 255, 0.92);
  }
  .ev-featured-badge .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: oklch(0.78 0.19 var(--hue));
    animation: ev-breathe 2.4s ease-in-out infinite;
  }
  .ev-featured h1 {
    margin: 0; font-size: 60px; line-height: 1.02; font-weight: 640;
    letter-spacing: -0.04em; color: #fff; text-wrap: balance; max-width: 15ch;
  }
  .ev-featured-desc {
    margin: 0; font-size: 17px; line-height: 1.6;
    color: rgba(255, 255, 255, 0.72); max-width: 44ch; text-wrap: pretty;
  }
  .ev-featured-meta {
    display: flex; flex-wrap: wrap; align-items: center; gap: 22px; margin-top: 4px;
    color: rgba(255, 255, 255, 0.82); font-size: 14.5px;
  }
  .ev-featured-meta span { display: flex; align-items: center; gap: 8px; }
  .ev-buybox {
    padding: 24px; border-radius: 18px;
    background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(22px) saturate(1.3);
    box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.5);
  }
  .ev-buybox-price { display: flex; align-items: baseline; gap: 8px; }
  .ev-buybox-price .amount {
    font-size: 34px; font-weight: 640; letter-spacing: -0.035em;
    color: #fff; font-variant-numeric: tabular-nums;
  }
  .ev-buybox-price .per { font-size: 13px; color: rgba(255, 255, 255, 0.6); }
  .ev-buybox-scarcity { margin-top: 16px; }
  .ev-buybox-scarcity .labels {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 12.5px; color: rgba(255, 255, 255, 0.8); margin-bottom: 8px;
  }
  .ev-buybox-scarcity .labels .sold { font-weight: 600; }
  .ev-buybox-scarcity .labels .left { font-variant-numeric: tabular-nums; }
  .ev-buybox-track { height: 5px; border-radius: 999px; background: rgba(255, 255, 255, 0.18); overflow: hidden; }
  .ev-buybox-fill {
    height: 100%; border-radius: 999px;
    background: linear-gradient(90deg, oklch(0.72 0.2 var(--hue)), oklch(0.85 0.16 200));
  }
  /* Der Preis erscheint auf dem Desktop oben in der Box, auf dem Handy
     unten neben dem CTA — deshalb steht er zweimal im Markup. */
  .ev-buybox-mobile-price { display: none; }
  .ev-buybox-cta {
    margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 8px;
    height: 48px; border-radius: 12px; background: #fff; color: var(--ink);
    font-size: 15px; font-weight: 640; transition: transform 0.2s, box-shadow 0.2s;
  }
  .ev-featured:hover .ev-buybox-cta { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28); }
  .ev-buybox-trust {
    margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 7px;
    font-size: 12.5px; color: rgba(255, 255, 255, 0.66);
  }

  /* Textkopf, wenn es kein verfuegbares Event gibt (leer oder alles ausverkauft). */
  .ev-texthero { padding: 48px 0 8px; animation: ev-rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
  .ev-texthero h1 { font-size: 40px; letter-spacing: -0.035em; font-weight: 600; line-height: 1.05; }
  .ev-texthero .eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 11.5px; color: var(--accent-ink); font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px;
  }
  .ev-texthero .eyebrow .dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
    animation: ev-breathe 2.4s ease-in-out infinite;
  }
  .ev-texthero p { margin-top: 12px; color: var(--ink-3); font-size: 16px; max-width: 560px; line-height: 1.55; }

  /* ── Filterleiste ─────────────────────────────────────────────── */
  .ev-filterbar-wrap { padding-top: 36px; }
  .ev-filterbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
    padding: 14px; border-radius: 16px;
    background: color-mix(in oklab, var(--surface) 75%, transparent);
    border: 1px solid var(--line); backdrop-filter: blur(14px);
    box-shadow: var(--shadow);
  }
  .ev-cities { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .ev-cities a {
    padding: 9px 15px; border-radius: 10px;
    font-size: 13.5px; font-weight: 500; color: var(--ink-3);
    white-space: nowrap; transition: background 0.15s, color 0.15s;
  }
  .ev-cities a:hover { background: var(--surface-3); color: var(--ink); }
  .ev-cities a.active { background: var(--ink); color: #fff; font-weight: 600; }
  .ev-cities a.active:hover { background: var(--ink); color: #fff; }
  .ev-search { display: flex; align-items: center; gap: 10px; margin-left: auto; }
  .ev-search-wrap { position: relative; min-width: 280px; }
  .ev-search-wrap .icon {
    position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
    color: var(--ink-4); display: grid; pointer-events: none;
  }
  .ev-search-wrap input {
    width: 100%; height: 42px; padding: 0 14px 0 40px;
    border-radius: 11px; border: 1px solid var(--line-2);
    background: var(--surface); font-size: 14px; color: var(--ink);
    font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .ev-search-wrap input::placeholder { color: var(--ink-4); }
  .ev-search-wrap input:focus {
    outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 16%, transparent);
  }
  .ev-filter-note {
    display: inline-flex; align-items: center; gap: 8px;
    margin-top: 14px; padding: 6px 12px;
    background: var(--accent-wash); border: 1px solid var(--accent-line);
    border-radius: 8px; font-size: 12.5px; color: var(--accent-ink);
  }
  .ev-filter-note a { color: var(--accent); font-weight: 500; }

  /* ── Liste ────────────────────────────────────────────────────── */
  .ev-main { max-width: 1240px; margin: 0 auto; padding: 40px 32px 96px; }
  .ev-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 24px; margin-bottom: 22px;
  }
  .ev-head h2 { margin: 0; font-size: 26px; font-weight: 620; letter-spacing: -0.03em; }
  .ev-head p { margin: 6px 0 0; font-size: 14.5px; color: var(--ink-3); }
  .ev-head-link {
    display: flex; align-items: center; gap: 6px;
    font-size: 14px; font-weight: 550; color: var(--accent); white-space: nowrap;
  }
  .ev-head-link:hover { color: var(--accent-2); }
  .ev-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
  @media (max-width: 980px) { .ev-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

  .ev-card {
    display: flex; flex-direction: column;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 18px; overflow: hidden; box-shadow: var(--shadow);
    color: inherit;
    transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.35s, border-color 0.35s;
    animation: ev-rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .ev-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); border-color: var(--accent-line); }
  .ev-card-art { position: relative; aspect-ratio: 4 / 3; background: var(--surface-3); overflow: hidden; }
  .ev-card-art img, .ev-card-art .art-bg {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .ev-card:hover .ev-card-art img, .ev-card:hover .ev-card-art .art-bg { transform: scale(1.04); }
  .ev-datebadge {
    position: absolute; top: 12px; left: 12px;
    display: flex; flex-direction: column; align-items: center;
    width: 44px; padding: 6px 0 7px; border-radius: 11px;
    background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(8px);
    box-shadow: 0 4px 14px rgba(17, 20, 45, 0.16); pointer-events: none;
  }
  .ev-datebadge .m {
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.09em;
    color: var(--accent); text-transform: uppercase;
  }
  .ev-datebadge .d { font-size: 18px; font-weight: 640; letter-spacing: -0.03em; line-height: 1.1; color: var(--ink); }
  .ev-badge {
    position: absolute; top: 14px; right: 12px;
    padding: 5px 10px; border-radius: 8px;
    font-size: 11.5px; font-weight: 600;
    background: rgba(11, 8, 26, 0.62); color: #fff;
    backdrop-filter: blur(8px); pointer-events: none;
  }
  .ev-card-body { display: flex; flex-direction: column; gap: 14px; padding: 18px 18px 20px; flex: 1; }
  .ev-card-eyebrow { display: none; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: var(--accent); }
  .ev-card h3 { margin: 0; font-size: 17px; font-weight: 620; letter-spacing: -0.025em; line-height: 1.3; }
  .ev-card-sub { margin: 7px 0 0; font-size: 13.5px; color: var(--ink-3); }
  .ev-progress { display: flex; flex-direction: column; gap: 7px; margin-top: auto; }
  .ev-track { height: 4px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
  .ev-fill { height: 100%; border-radius: 999px; transition: width 0.3s; }
  .ev-progress-label { font-size: 12px; color: var(--ink-3); }
  .ev-card-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding-top: 14px; border-top: 1px solid var(--line);
  }
  .ev-price { font-size: 19px; font-weight: 640; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .ev-cta {
    display: flex; align-items: center; gap: 7px;
    padding: 10px 15px; border-radius: 10px;
    font-size: 13.5px; font-weight: 600;
    background: var(--accent); color: #fff; transition: background 0.2s;
  }
  .ev-card:hover .ev-cta { background: var(--accent-2); }
  .ev-cta.waitlist {
    background: var(--surface-3); border: 1px solid var(--line-2); color: var(--ink);
  }
  .ev-card:hover .ev-cta.waitlist { background: var(--surface); border-color: var(--ink-4); }
  .ev-foot-note { display: none; font-size: 12px; color: var(--ink-3); }
  .ev-card.is-soldout .ev-card-art img, .ev-card.is-soldout .ev-card-art .art-bg { filter: grayscale(0.7); opacity: 0.75; }
  .ev-card.is-soldout .ev-price { color: var(--ink-3); }

  /* ── Saisonpaesse ─────────────────────────────────────────────── */
  .ev-pass-grid { display: grid; gap: 22px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .ev-pass-card {
    display: flex; flex-direction: column; gap: 6px;
    padding: 20px 20px 18px;
    background: var(--surface); border: 1px solid var(--accent-line);
    border-radius: 18px; box-shadow: var(--shadow-sm); color: inherit;
    transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.35s, border-color 0.35s;
    animation: ev-rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .ev-pass-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); border-color: var(--accent); }
  .ev-pass-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
  .ev-pass-name { font-size: 17px; font-weight: 620; letter-spacing: -0.025em; line-height: 1.3; }
  .ev-pass-meta { font-size: 13.5px; color: var(--ink-3); }
  .ev-pass-card .ev-card-foot { margin-top: 12px; }

  /* ── Leerzustand ──────────────────────────────────────────────── */
  .ev-empty {
    padding: 56px 24px; text-align: center; color: var(--ink-3);
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 18px; box-shadow: var(--shadow);
  }
  .ev-empty .badge {
    width: 44px; height: 44px; border-radius: 12px;
    background: var(--accent-wash); border: 1px solid var(--accent-line);
    display: grid; place-items: center; margin: 0 auto 12px; color: var(--accent);
  }
  .ev-empty .t { font-size: 15px; font-weight: 600; color: var(--ink); }
  .ev-empty .s { font-size: 13px; margin-top: 4px; }

  /* ── Footer ───────────────────────────────────────────────────── */
  .ev-footer { border-top: 1px solid var(--line); background: var(--surface); }
  .ev-footer-inner {
    max-width: 1240px; margin: 0 auto; padding: 28px 32px;
    display: flex; flex-wrap: wrap; align-items: center; gap: 20px;
    font-size: 13px; color: var(--ink-3);
  }
  .ev-footer-links { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 22px; font-size: 13px; }
  .ev-footer-links a { color: var(--ink-3); }
  .ev-footer-links a:hover { color: var(--ink); }

  /* ── Mobil ────────────────────────────────────────────────────── */
  @media (max-width: 780px) {
    .ev-page .topbar-inner { padding: 0 16px; gap: 10px; height: 60px; }
    .ev-topbar-link { display: none; }
    .ev-shell { padding: 0 16px; }
    .ev-main { padding: 28px 16px 72px; }
    .ev-footer-inner { padding: 24px 16px; }

    .ev-featured-wrap { padding-top: 20px; }
    .ev-featured { border-radius: 20px; }
    .ev-featured-inner {
      grid-template-columns: 1fr; gap: 0;
      align-items: end; align-content: end;
      padding: 0; min-height: 0; aspect-ratio: 4 / 5;
    }
    .ev-featured-scrim {
      background: linear-gradient(0deg, rgba(11, 8, 26, 0.92) 8%, rgba(11, 8, 26, 0.25) 55%, rgba(11, 8, 26, 0.05));
    }
    .ev-featured-copy { gap: 12px; padding: 18px 18px 0; }
    .ev-featured h1 { font-size: 26px; line-height: 1.1; letter-spacing: -0.035em; max-width: none; }
    .ev-featured-desc, .ev-featured-meta { display: none; }
    .ev-buybox {
      padding: 0 18px 18px; border: none; background: none;
      box-shadow: none; backdrop-filter: none; border-radius: 0;
    }
    .ev-buybox-price { display: none; }
    .ev-buybox-scarcity { margin-top: 12px; }
    .ev-buybox-mobile-foot {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px;
    }
    .ev-buybox-mobile-price {
      display: block;
      font-size: 22px; font-weight: 640; letter-spacing: -0.03em;
      color: #fff; font-variant-numeric: tabular-nums;
    }
    .ev-buybox-cta { margin-top: 0; height: 46px; padding: 0 18px; font-size: 14.5px; }
    .ev-buybox-trust { display: none; }

    .ev-texthero { padding: 28px 0 4px; }
    .ev-texthero h1 { font-size: 30px; }

    .ev-filterbar-wrap { padding-top: 18px; }
    .ev-filterbar { flex-direction: column; align-items: stretch; gap: 12px; padding: 12px; border-radius: 14px; }
    .ev-cities {
      overflow-x: auto; -webkit-overflow-scrolling: touch;
      scrollbar-width: none; margin: 0 -12px; padding: 0 12px;
    }
    .ev-cities::-webkit-scrollbar { display: none; }
    .ev-cities a { padding: 8px 14px; font-size: 13px; border: 1px solid var(--line-2); background: var(--surface); }
    .ev-cities a.active { border-color: var(--ink); }
    .ev-search { margin-left: 0; }
    .ev-search-wrap { min-width: 0; flex: 1; }
    /* 16px verhindert den iOS-Zoom beim Fokus. */
    .ev-search-wrap input { font-size: 16px; }

    .ev-head { flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .ev-head h2 { font-size: 21px; }
    .ev-grid, .ev-pass-grid { grid-template-columns: 1fr; gap: 12px; }

    .ev-card { flex-direction: row; gap: 13px; padding: 12px; border-radius: 16px; }
    .ev-card:hover { transform: none; }
    .ev-card-art {
      width: 92px; height: 92px; flex: none;
      aspect-ratio: auto; border-radius: 12px;
    }
    .ev-datebadge, .ev-badge, .ev-progress, .ev-cta { display: none; }
    .ev-card-body { padding: 0; gap: 6px; min-width: 0; }
    .ev-card-eyebrow { display: block; }
    .ev-card h3 { font-size: 15px; font-weight: 620; letter-spacing: -0.02em; }
    .ev-card-sub { margin: 0; font-size: 12.5px; }
    .ev-card-foot { border-top: none; padding-top: 0; margin-top: auto; }
    .ev-price { font-size: 15px; }
    .ev-foot-note { display: block; }

    .ev-pass-card { padding: 14px; border-radius: 16px; }
    .ev-pass-card:hover { transform: none; }
    .ev-pass-card .ev-cta { display: flex; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ev-featured-wrap, .ev-texthero, .ev-card, .ev-pass-card { animation: none; }
    .ev-featured-badge .dot, .ev-texthero .eyebrow .dot { animation: none; opacity: 1; }
    .ev-card, .ev-pass-card, .ev-topbar-cta, .ev-buybox-cta,
    .ev-card-art img, .ev-card-art .art-bg,
    .ev-featured-art img, .ev-featured-art .art-bg { transition: none; }
    .ev-card:hover, .ev-pass-card:hover, .ev-topbar-cta:hover { transform: none; }
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
  searchParams: Promise<{ q?: string; veranstalter?: string; stadt?: string }>;
}) {
  const { lang, t } = await getT();
  const today = new Date().toISOString().slice(0, 10);
  const { q, veranstalter, stadt } = await searchParams;
  const query = (q ?? '').trim();
  const city = (stadt ?? '').trim();

  let dbQuery = supabaseAdmin
    .from('events')
    .select('id, name, date, start_time, price_eur, capacity, tickets_sold, tickets_reserved, image_url, venue, description, created_at, organizer_wallet')
    .gte('date', today)
    .eq('is_private', false)
    .order('date', { ascending: true });
  if (veranstalter) dbQuery = dbQuery.eq('organizer_wallet', veranstalter);

  const { data } = await dbQuery;

  // Text search runs in JS; the public listing is small, and this avoids
  // feeding user input into a PostgREST or() filter string.
  const needle = query.toLowerCase();
  const inScope = ((data ?? []) as EventRow[]).filter((e) =>
    !needle || e.name.toLowerCase().includes(needle) || (e.venue ?? '').toLowerCase().includes(needle),
  );

  // Die Stadt-Chips zeigen die Staedte der Liste *vor* dem Stadtfilter —
  // sonst waere nach einem Klick keine andere Stadt mehr erreichbar.
  const cityCount = new Map<string, number>();
  for (const e of inScope) {
    const c = cityFromVenue(e.venue);
    if (c) cityCount.set(c, (cityCount.get(c) ?? 0) + 1);
  }
  const cities = [...cityCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([name]) => name);

  const all = city ? inScope.filter((e) => cityMatches(e.venue, city)) : inScope;

  const taken = (e: EventRow) => e.tickets_sold + (e.tickets_reserved ?? 0);
  const available = all.filter((e) => taken(e) < e.capacity);
  const soldOut = all.filter((e) => taken(e) >= e.capacity);
  const totalCount = all.length;
  const listedCities = new Set(all.map((e) => cityFromVenue(e.venue)).filter(Boolean)).size;

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

  // Das naechste verfuegbare Event fuehrt die Seite an; ist alles ausverkauft
  // oder leer, uebernimmt der Textkopf.
  const featured = available[0] ?? null;
  const startSuffix = t('ticket.startSuffix');
  const freeLabel = t('common.free');

  /** Verkaufsstand in Prozent; 0 wenn das Event keine Kapazitaet hat. */
  const soldPct = (e: EventRow) =>
    e.capacity > 0 ? Math.min(100, Math.round((taken(e) / e.capacity) * 100)) : 0;

  const filterHref = (nextCity: string | null) => {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (veranstalter) p.set('veranstalter', veranstalter);
    if (nextCity) p.set('stadt', nextCity);
    const qs = p.toString();
    return qs ? `/events?${qs}` : '/events';
  };

  const icsHref = (() => {
    const p = new URLSearchParams();
    if (veranstalter) p.set('veranstalter', veranstalter);
    if (city) p.set('stadt', city);
    const qs = p.toString();
    return qs ? `/api/events/ics?${qs}` : '/api/events/ics';
  })();

  const subLine = (e: EventRow) =>
    [e.start_time ? `${e.start_time}${startSuffix ? ` ${startSuffix}` : ''}` : null, e.venue]
      .filter(Boolean).join(' · ');

  const card = (e: EventRow, index: number) => {
    const isSoldOut = taken(e) >= e.capacity;
    const pct = soldPct(e);
    const pctLeft = Math.max(1, 100 - pct);
    const hasWaitlist = waitlistWallets.has(e.organizer_wallet);
    const days = daysUntil(e.date);

    // Badge-Reihenfolge: was den Kauf am staerksten treibt, gewinnt.
    const badge = isSoldOut
      ? (hasWaitlist ? t('events.waitlistBadge') : t('events.soldOut'))
      : days === 0 ? t('events.today')
        : days === 1 ? t('events.tomorrow')
          : isRecent(e.created_at) ? t('events.isNew')
            : e.capacity > 0 ? t('events.percentLeft', { percent: pctLeft }) : null;

    const barColor = isSoldOut ? 'var(--ink-4)' : pct >= 95 ? 'var(--bad)' : 'var(--accent)';
    const progressLabel = isSoldOut
      ? t('events.soldOutZero')
      : pct >= 95 ? t('events.almostSoldOut') : t('events.percentSold', { percent: pct });

    // Sold-out events stay clickable; the shop page shows the waitlist
    // signup (Pro organizers) and the full event details.
    return (
      <Link
        key={e.id}
        href={`/event/${e.id}`}
        className={`ev-card${isSoldOut ? ' is-soldout' : ''}`}
        style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      >
        <div className="ev-card-art">
          <EventArt name={e.name} imageUrl={e.image_url} />
          <div className="ev-datebadge">
            <span className="m">{monthShort(e.date, lang)}</span>
            <span className="d">{dayNum(e.date)}</span>
          </div>
          {badge && <span className="ev-badge">{badge}</span>}
        </div>
        <div className="ev-card-body">
          <div>
            <span className="ev-card-eyebrow">{monthShort(e.date, lang).toUpperCase()} {dayNum(e.date)}</span>
            <h3>{e.name}</h3>
            {subLine(e) && <p className="ev-card-sub">{subLine(e)}</p>}
          </div>
          {e.capacity > 0 && (
            <div className="ev-progress">
              <div className="ev-track">
                <div className="ev-fill" style={{ width: `${isSoldOut ? 100 : pct}%`, background: barColor }} />
              </div>
              <span className="ev-progress-label" style={pct >= 95 && !isSoldOut ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>
                {progressLabel}
              </span>
            </div>
          )}
          <div className="ev-card-foot">
            <span className="ev-price">{formatPrice(e.price_eur, lang, freeLabel)}</span>
            {isSoldOut ? (
              hasWaitlist ? (
                <span className="ev-cta waitlist">{t('events.toWaitlist')}</span>
              ) : (
                <span className="ev-cta waitlist">{t('events.soldOut')}</span>
              )
            ) : (
              <span className="ev-cta">{t('events.getTickets')} <Icon name="arrow" size={15} /></span>
            )}
            <span className="ev-foot-note" style={pct >= 95 && !isSoldOut ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>
              {isSoldOut
                ? (hasWaitlist ? t('events.waitlistBadge') : t('events.soldOut'))
                : pct >= 95 ? t('events.almostSoldOut')
                  : e.capacity > 0 ? t('events.percentLeft', { percent: pctLeft }) : ''}
            </span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app ev-page">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events" className="active">{t('common.events')}</Link>
              <Link href="/my-tickets">{t('common.myTickets')}</Link>
            </div>
            <div className="topbar-right">
              <Link href="/so-funktionierts" className="ev-topbar-link">{t('common.howItWorks')}</Link>
              <Link href="/become-organizer" className="ev-topbar-cta">{t('events.getStarted')}</Link>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="ev-band">
            <div className="ev-glow" aria-hidden="true" />

            <section className="ev-shell ev-featured-wrap">
              {featured ? (
                <Link href={`/event/${featured.id}`} className="ev-featured">
                  <div className="ev-featured-art">
                    <EventArt name={featured.name} imageUrl={featured.image_url} />
                  </div>
                  <div className="ev-featured-scrim" aria-hidden="true" />
                  <div className="ev-featured-inner">
                    <div className="ev-featured-copy">
                      <span className="ev-featured-badge">
                        <span className="dot" />
                        {t('events.featuredEyebrow')}
                        {cityFromVenue(featured.venue) ? ` · ${cityFromVenue(featured.venue)}` : ''}
                      </span>
                      <h1>{featured.name}</h1>
                      <p className="ev-featured-desc">
                        {featured.description ? truncate(featured.description, 180) : t('events.leadEmpty')}
                      </p>
                      <div className="ev-featured-meta">
                        <span><Icon name="calendar" size={16} />{formatDate(featured.date, lang)}</span>
                        {featured.start_time && (
                          <span><Icon name="clock" size={16} />{featured.start_time}{startSuffix ? ` ${startSuffix}` : ''}</span>
                        )}
                        {featured.venue && <span><Icon name="location" size={16} />{featured.venue}</span>}
                      </div>
                    </div>

                    <div className="ev-buybox">
                      <div className="ev-buybox-price">
                        <span className="amount">{formatPrice(featured.price_eur, lang, freeLabel)}</span>
                        {featured.price_eur > 0 && <span className="per">{t('events.perTicket')}</span>}
                      </div>
                      {featured.capacity > 0 && (
                        <div className="ev-buybox-scarcity">
                          <div className="labels">
                            <span className="sold">{t('events.percentSold', { percent: soldPct(featured) })}</span>
                            <span className="left">{t('events.percentLeft', { percent: Math.max(1, 100 - soldPct(featured)) })}</span>
                          </div>
                          <div className="ev-buybox-track">
                            <div className="ev-buybox-fill" style={{ width: `${soldPct(featured)}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="ev-buybox-mobile-foot">
                        <span className="ev-buybox-mobile-price">{formatPrice(featured.price_eur, lang, freeLabel)}</span>
                        <span className="ev-buybox-cta">
                          {t('events.getTickets')} <Icon name="arrow" size={17} />
                        </span>
                      </div>
                      <div className="ev-buybox-trust">
                        <Icon name="shield" size={14} />{t('events.trustLine')}
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="ev-texthero">
                  <div className="eyebrow"><span className="dot" />{t('events.eyebrow')}</div>
                  <h1>{organizerLabel ? t('events.titleOrganizer', { name: organizerLabel }) : t('events.title')}</h1>
                  <p>
                    {totalCount === 0
                      ? t('events.leadEmpty')
                      : totalCount === 1
                        ? t('events.leadOne')
                        : t('events.lead', { count: totalCount })}
                  </p>
                </div>
              )}
            </section>

            <section className="ev-shell ev-filterbar-wrap">
              <div className="ev-filterbar">
                <nav className="ev-cities" aria-label={t('events.cityFilterAria')}>
                  <Link href={filterHref(null)} className={city ? '' : 'active'}>{t('events.allCities')}</Link>
                  {cities.map((c) => (
                    <Link
                      key={c}
                      href={filterHref(c)}
                      className={city.toLowerCase() === c.toLowerCase() ? 'active' : ''}
                    >
                      {c}
                    </Link>
                  ))}
                </nav>
                <form className="ev-search" action="/events" method="get">
                  {veranstalter && <input type="hidden" name="veranstalter" value={veranstalter} />}
                  {city && <input type="hidden" name="stadt" value={city} />}
                  <div className="ev-search-wrap">
                    <span className="icon"><Icon name="search" size={16} /></span>
                    <input
                      type="search"
                      name="q"
                      defaultValue={query}
                      placeholder={`${t('events.searchPlaceholder')} …`}
                      maxLength={80}
                      aria-label={t('events.searchAria')}
                    />
                  </div>
                </form>
              </div>
              {(organizerLabel || query || city) && (
                <div className="ev-filter-note">
                  {organizerLabel && query
                    ? t('events.filterSearchAt', { query, name: organizerLabel })
                    : organizerLabel
                      ? t('events.filterOrganizer')
                      : query
                        ? t('events.filterSearch', { query })
                        : t('events.filterCity', { city })}
                  <Link href="/events">{t('events.reset')}</Link>
                </div>
              )}
            </section>
          </div>

          <div className="ev-main">
            {totalCount === 0 ? (
              <div className="ev-empty">
                <div className="badge">
                  <Icon name={query || organizerLabel || city ? 'search' : 'calendar'} size={20} />
                </div>
                {query || organizerLabel || city ? (
                  <>
                    <div className="t">{t('events.emptyFoundTitle')}</div>
                    <div className="s">
                      {t('events.emptyFoundText')}{' '}
                      <Link href="/events" style={{ color: 'var(--accent)', fontWeight: 500 }}>{t('events.emptyFoundLink')}</Link>.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="t">{t('events.emptyTitle')}</div>
                    <div className="s">{t('events.emptyText')}</div>
                  </>
                )}
              </div>
            ) : (
              <>
                {passes.length > 0 && (
                  <section style={{ marginBottom: 40 }}>
                    <div className="ev-head">
                      <div>
                        <h2>{t('events.passesTitle')}</h2>
                        <p>{t('events.passesSub')}</p>
                      </div>
                    </div>
                    <div className="ev-pass-grid">
                      {passes.map((p, i) => (
                        <Link
                          key={p.id}
                          href={`/pass/${p.id}`}
                          className="ev-pass-card"
                          style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                        >
                          <div className="ev-pass-eyebrow">{t('events.seasonPass')}</div>
                          <div className="ev-pass-name">{p.name}</div>
                          <div className="ev-pass-meta">
                            {p.dates === 1 ? t('events.validForDate') : t('events.validForDates', { count: p.dates })}
                          </div>
                          <div className="ev-card-foot">
                            <span className="ev-price">{formatPrice(p.priceCents, lang, freeLabel)}</span>
                            <span className="ev-cta">{t('events.securePass')} <Icon name="arrow" size={15} /></span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <div className="ev-head">
                    <div>
                      <h2>{organizerLabel ? t('events.titleOrganizer', { name: organizerLabel }) : t('events.title')}</h2>
                      <p>
                        {listedCities > 1
                          ? t('events.countSub', { count: totalCount, cities: listedCities })
                          : listedCities === 1
                            ? t('events.countSubOneCity', { count: totalCount })
                            : t('events.countSubNoCity', { count: totalCount })}
                      </p>
                    </div>
                    <a href={icsHref} className="ev-head-link">
                      {t('events.subscribeCalendar')}<Icon name="chevronRight" size={15} />
                    </a>
                  </div>
                  <div className="ev-grid">
                    {[...available, ...soldOut].map((e, i) => card(e, i))}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>

        <footer className="ev-footer">
          <div className="ev-footer-inner">
            <span>© 2026 Passly · {t('common.tagline')}</span>
            <div className="ev-footer-links">
              <Link href="/so-funktionierts">{t('common.howItWorks')}</Link>
              <LegalLinks style={{ fontSize: 13, color: 'inherit', gap: 22 }} />
            </div>
          </div>
        </footer>
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
