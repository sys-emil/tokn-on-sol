'use client';

import { useState } from 'react';
import { EventCard, EventArt, eventHue, EVENT_CARD_CSS } from './EventCard';
import { ShowcaseHero, ShowcaseArt, SHOWCASE_HERO_CSS } from './ShowcaseHero';
import { eventCardView } from '@/lib/eventCardView';
import type { CardLabel } from '@/lib/eventCardView';
import { isVipTier } from '@/lib/tier';
import { serviceFeePerTicketCents } from '@/lib/fees';
import { t as translate } from '@/lib/i18n';
import { Icon } from '@/app/components/passlyUi';

/**
 * Live-Vorschau des Events auf allen Oberflaechen, auf denen es auftaucht.
 *
 * Liste und Event-Seite kommen aus denselben Komponenten wie die echten
 * Seiten — dort kann die Vorschau gar nicht luegen. Kaufseite und Ticket sind
 * originalgetreue Nachbauten: die echten brauchen Stripe, eine Privy-Wallet
 * und eine Event-ID, die es beim Anlegen noch nicht gibt. Beide sind als
 * Vorschau gekennzeichnet, damit niemand den Platzhalter fuer einen Fehler
 * haelt.
 *
 * Die Beschriftungen kommen ueber `translate('de', …)` aus demselben
 * Woerterbuch wie die Kaeuferseiten — so steht in der Vorschau wortgleich,
 * was der Gast spaeter liest.
 */

export interface PreviewTier {
  name: string;
  /** Euro als Text, so wie im Formular getippt. */
  priceEur: string;
  capacity: string;
}

export interface PreviewDraft {
  name: string;
  date: string;
  startTime: string;
  venue: string;
  description: string;
  longDescription: string;
  tiers: PreviewTier[];
  imageUrl: string | null;
  galleryUrls: string[];
  accentHue: number | null;
  borderStyle: string | null;
  /** Im Bearbeiten-Modus die echten Zahlen, beim Anlegen 0. */
  ticketsSold?: number;
  ticketsReserved?: number;
}

type Surface = 'list' | 'showcase' | 'shop' | 'ticket';

const SURFACES: { key: Surface; label: string }[] = [
  { key: 'list', label: 'In der Liste' },
  { key: 'showcase', label: 'Event-Seite' },
  { key: 'shop', label: 'Kaufseite' },
  { key: 'ticket', label: 'Ticket' },
];

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const priceCents = (t: PreviewTier) => Math.round((Number(t.priceEur) || 0) * 100);
const capacityOf = (t: PreviewTier) => Math.floor(Number(t.capacity)) || 0;

const monthShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const longDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function EventPreview({ draft }: { draft: PreviewDraft }) {
  const [surface, setSurface] = useState<Surface>('list');

  // Platzhalter, damit die Vorschau vom ersten Moment an etwas zeigt statt
  // einer leeren Karte.
  const name = draft.name.trim() || 'Name deiner Veranstaltung';
  const date = draft.date || new Date().toISOString().slice(0, 10);
  const venue = draft.venue.trim() || null;
  const capacity = draft.tiers.reduce((sum, t) => sum + capacityOf(t), 0);
  const prices = draft.tiers.map(priceCents);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const uniform = prices.length > 0 && prices.every((p) => p === minPrice);
  const free = minPrice === 0 && uniform;
  const priceLabel = free ? 'Kostenlos' : `${uniform ? '' : 'ab '}${eur(minPrice)}`;

  const sold = draft.ticketsSold ?? 0;
  const view = eventCardView({
    capacity,
    ticketsSold: sold,
    ticketsReserved: draft.ticketsReserved ?? 0,
    date,
    createdAt: new Date().toISOString(),
  });
  const label = (l: CardLabel | null) => (l ? translate('de', l.key, l.vars) : null);

  const subLine = [draft.startTime ? `${draft.startTime} Uhr` : null, venue].filter(Boolean).join(' · ');
  const hue = eventHue(name);
  const bodyText = draft.longDescription.trim() || draft.description.trim();
  const vip = draft.tiers.some((t) => isVipTier(t.name));

  // Der Akzent-Farbton faerbt die ganze Buehne, genau wie spaeter die Seite.
  const stageStyle = draft.accentHue != null
    ? ({ '--hue': String(draft.accentHue) } as React.CSSProperties)
    : undefined;

  return (
    <div className="epv" style={stageStyle}>
      <style>{PREVIEW_CSS}</style>

      <div className="epv-bar">
        <div className="seg epv-seg">
          {SURFACES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={surface === s.key ? 'active' : ''}
              onClick={() => setSurface(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="epv-live"><span className="dot" />Live</span>
      </div>

      {surface === 'list' && (
        <div className="epv-stage light">
          <div className="epv-listgrid">
            <EventCard
              name={name}
              monthLabel={monthShort(date)}
              dayLabel={dayNum(date)}
              subLine={subLine || null}
              priceLabel={priceLabel}
              art={<EventArt name={name} imageUrl={draft.imageUrl} />}
              badge={label(view.badge)}
              progressLabel={label(view.progress)}
              fillPct={view.fillPct}
              barColor={view.barColor}
              urgent={view.urgent}
              soldOut={view.soldOut}
              ctaLabel={view.soldOut ? translate('de', 'events.soldOut') : translate('de', 'events.getTickets')}
              ctaMuted={view.soldOut}
              footNote={label(view.footNote)}
            />
            {/* Zwei blasse Nachbarn, damit die Wirkung im Kontext sichtbar ist. */}
            <div className="epv-ghost" aria-hidden="true" />
            <div className="epv-ghost" aria-hidden="true" />
          </div>
          <p className="epv-note">So erscheint dein Event auf getpassly.de/events.</p>
        </div>
      )}

      {surface === 'showcase' && (
        <div className="epv-stage light">
          <ShowcaseHero
            name={name}
            art={<ShowcaseArt name={name} imageUrl={draft.imageUrl} hue={hue} />}
            whenLabel={`${monthShort(date)} ${dayNum(date)}${draft.startTime ? ` · ${draft.startTime} Uhr` : ''}`}
            venue={venue}
            verifiedLabel="Geprüft"
            organizerName="Dein Profil"
            priceLabel={priceLabel}
            feeLabel={minPrice > 0 ? `zzgl. ${eur(serviceFeePerTicketCents(minPrice))} Servicegebühr pro Ticket` : null}
            trustLabel="Jedes Ticket ist einzigartig und fälschungssicher."
            backLabel="Alle Events"
            backHref={null}
            ctaLabel="Tickets sichern"
          />
          <div className="epv-tabstrip">
            <span className="on">Übersicht</span>
            {draft.galleryUrls.length > 0 && <span>Galerie</span>}
            <span>Tickets</span>
          </div>
          <div className="epv-overview">
            <p className={bodyText ? '' : 'empty'}>
              {bodyText || 'Noch keine Beschreibung — der Text aus „Ausführliche Beschreibung“ steht hier.'}
            </p>
            <div className="epv-facts">
              <div><span>Datum</span><b>{longDate(date)}</b></div>
              {draft.startTime && <div><span>Beginn</span><b>{draft.startTime} Uhr</b></div>}
              {venue && <div><span>Ort</span><b>{venue}</b></div>}
              <div><span>Plätze</span><b>{capacity}</b></div>
            </div>
          </div>
        </div>
      )}

      {surface === 'shop' && (
        <div className="epv-stage light">
          <div className="epv-shopcard">
            {draft.imageUrl && (
              <div className="epv-shopart">
                {/* eslint-disable-next-line @next/next/no-img-element -- storage host is env-dependent */}
                <img src={draft.imageUrl} alt="" />
              </div>
            )}
            <div className="epv-shophead">
              <div className="epv-datechip">
                <div className="m">{monthShort(date)}</div>
                <div className="d">{dayNum(date)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{name}</h3>
                <div className="when">
                  <span><Icon name="calendar" size={13} /> {longDate(date)}{draft.startTime ? ` · ${draft.startTime} Uhr` : ''}</span>
                  {venue && <span><Icon name="location" size={13} /> {venue}</span>}
                </div>
              </div>
            </div>
            {draft.description.trim() && <div className="epv-shopdesc">{draft.description.trim()}</div>}
            <div className="epv-shoprows">
              <div className="epv-shoprow">
                <span className="k">
                  Ticketpreis
                  {minPrice > 0 && <span className="sub">zzgl. Servicegebühr</span>}
                </span>
                <span className="v big">{priceLabel}</span>
              </div>
              <div className="epv-shoprow">
                <span className="k">Verfügbarkeit</span>
                {view.soldOut
                  ? <span className="chip bad"><span className="d" />Ausverkauft</span>
                  : <span className="chip ok"><span className="d" />Verfügbar</span>}
              </div>
            </div>
            <div className="epv-shopfoot">
              {draft.tiers.map((tier, i) => (
                <div key={i} className="epv-tierrow">
                  <span>{tier.name.trim() || `Kategorie ${i + 1}`}</span>
                  <b>{priceCents(tier) === 0 ? 'Kostenlos' : eur(priceCents(tier))}</b>
                </div>
              ))}
              <div className="epv-fakebtn">Jetzt kaufen</div>
            </div>
          </div>
          <p className="epv-note">Nachbau — die echte Kaufbox entsteht erst mit dem Event.</p>
        </div>
      )}

      {surface === 'ticket' && (
        <div className="epv-stage ticket">
          <div className={`epv-ticket${vip ? ' vip' : ''}`}>
            {vip && <div className="epv-vipstrip">★ VIP ★</div>}
            <div className="epv-tickethead">
              <span className="brand">passly</span>
              {vip && <span className="epv-vipchip">VIP</span>}
            </div>
            <div className="epv-ticketname">
              <div className="kicker">{vip ? 'Dein VIP-Ticket' : 'Dein Ticket'}</div>
              <div className="n">{name}</div>
              <div className="s">{longDate(date)}</div>
            </div>
            <div className={`epv-ticketbody${vip ? ' vip' : ''}`}>
              <div className="row">
                <span className="chip ok"><span className="d" />Gültig</span>
                <span className="serial">PSL-0000</span>
              </div>
              <div className="qr"><Icon name="qr" size={54} /></div>
              <div className="perf left" /><div className="perf right" />
            </div>
            <div className="epv-ticketrows">
              <div><span>Kategorie</span><b>{draft.tiers[0]?.name.trim() || 'Standard'}</b></div>
              {venue && <div><span>Ort</span><b>{venue}</b></div>}
              {draft.startTime && <div><span>Beginn</span><b>{draft.startTime} Uhr</b></div>}
            </div>
          </div>
          <p className="epv-note">Nachbau — der QR-Code wird erst beim Kauf erzeugt und wechselt jede Minute.</p>
        </div>
      )}
    </div>
  );
}

const PREVIEW_CSS = `
  ${EVENT_CARD_CSS}
  ${SHOWCASE_HERO_CSS}

  .epv { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .epv-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .epv-seg { flex-wrap: wrap; }
  .epv-live {
    margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
    font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--accent-ink);
  }
  .epv-live .dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
    animation: epvPulse 2s ease-in-out infinite;
  }
  @keyframes epvPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

  .epv-stage {
    border: 1px solid var(--line); border-radius: 18px;
    padding: 24px; overflow: hidden; min-width: 0;
  }
  .epv-stage.light { background: var(--surface-2); }
  .epv-stage.ticket {
    background:
      radial-gradient(700px 360px at 50% -20%, var(--accent-wash), transparent 60%),
      var(--surface-2);
    display: grid; place-items: center;
  }
  .epv-note { margin: 16px 0 0; font-size: 12px; color: var(--ink-3); text-align: center; }

  /* ── Liste ─────────────────────────────────────────────────────── */
  .epv-listgrid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; align-items: start; }
  .epv-ghost {
    border: 1px dashed var(--line-2); border-radius: 18px; min-height: 260px;
    background: repeating-linear-gradient(115deg, transparent, transparent 10px, var(--surface-3) 10px, var(--surface-3) 20px);
    opacity: 0.45;
  }
  @media (max-width: 1100px) { .epv-listgrid { grid-template-columns: 1fr; } .epv-ghost { display: none; } }

  /* ── Event-Seite ───────────────────────────────────────────────── */
  .epv-tabstrip { display: flex; gap: 20px; margin-top: 22px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
  .epv-tabstrip span { font-size: 19px; font-weight: 620; letter-spacing: -0.03em; color: var(--ink-3); }
  .epv-tabstrip span.on { color: var(--ink); }
  .epv-overview { display: grid; grid-template-columns: 1.6fr 1fr; gap: 24px; margin-top: 18px; align-items: start; }
  .epv-overview p { margin: 0; font-size: 14.5px; line-height: 1.65; color: var(--ink-2); white-space: pre-line; }
  .epv-overview p.empty { color: var(--ink-3); font-style: italic; }
  .epv-facts { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
  .epv-facts div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; font-size: 13px; }
  .epv-facts div + div { border-top: 1px solid var(--line); }
  .epv-facts span { color: var(--ink-3); }
  .epv-facts b { font-weight: 600; text-align: right; }
  @media (max-width: 900px) { .epv-overview { grid-template-columns: 1fr; } }

  /* ── Kaufseite ─────────────────────────────────────────────────── */
  .epv-shopcard {
    width: 100%; max-width: 420px; margin: 0 auto;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden;
  }
  .epv-shopart { aspect-ratio: 2 / 1; position: relative; overflow: hidden; border-bottom: 1px solid var(--line); background: var(--surface-3); }
  .epv-shopart img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .epv-shophead { padding: 20px 22px 18px; display: flex; gap: 14px; align-items: flex-start; }
  .epv-shophead h3 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
  .epv-shophead .when { font-size: 12.5px; color: var(--ink-3); margin-top: 5px; display: flex; flex-direction: column; gap: 3px; }
  .epv-shophead .when span { display: inline-flex; align-items: center; gap: 6px; }
  .epv-datechip {
    width: 52px; flex-shrink: 0; border: 1px solid var(--line);
    border-radius: 9px; overflow: hidden; text-align: center; background: var(--surface);
  }
  .epv-datechip .m {
    font-size: 9.5px; letter-spacing: 0.1em; color: #fff; text-transform: uppercase;
    font-weight: 600; background: var(--accent); padding: 3px 0;
  }
  .epv-datechip .d { font-size: 20px; font-weight: 600; padding: 4px 0 5px; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .epv-shopdesc { padding: 0 22px 18px; font-size: 13px; color: var(--ink-2); line-height: 1.6; white-space: pre-line; }
  .epv-shoprows { border-top: 1px solid var(--line); padding: 16px 22px; display: flex; flex-direction: column; gap: 12px; }
  .epv-shoprow { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13.5px; }
  .epv-shoprow .k { color: var(--ink-3); }
  .epv-shoprow .k .sub { display: block; font-size: 11px; color: var(--ink-4); margin-top: 2px; }
  .epv-shoprow .v { font-weight: 600; font-variant-numeric: tabular-nums; }
  .epv-shoprow .v.big { font-size: 19px; letter-spacing: -0.01em; }
  .epv-shopfoot { border-top: 1px solid var(--line); padding: 18px 22px 20px; background: var(--surface-2); display: flex; flex-direction: column; gap: 8px; }
  .epv-tierrow { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--ink-2); }
  .epv-tierrow b { font-variant-numeric: tabular-nums; }
  .epv-fakebtn {
    margin-top: 8px; height: 42px; border-radius: 10px;
    background: var(--accent); color: #fff; display: grid; place-items: center;
    font-size: 14px; font-weight: 600; opacity: 0.75;
  }

  /* ── Ticket ────────────────────────────────────────────────────── */
  .epv-ticket {
    width: 340px; max-width: 100%;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 24px; box-shadow: var(--shadow-lg);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .epv-ticket.vip {
    border-color: oklch(0.78 0.11 92);
    box-shadow: 0 0 0 1px oklch(0.78 0.11 92 / 0.45), 0 20px 50px oklch(0.55 0.10 90 / 0.28), var(--shadow-lg);
  }
  .epv-vipstrip {
    background: linear-gradient(110deg, oklch(0.62 0.11 88), oklch(0.78 0.12 92) 30%, oklch(0.92 0.09 95) 50%, oklch(0.78 0.12 92) 70%, oklch(0.62 0.11 88));
    color: oklch(0.28 0.06 85);
    display: flex; align-items: center; justify-content: center;
    padding: 8px 0; font-size: 12px; font-weight: 700; letter-spacing: 0.42em;
    text-indent: 0.42em; text-transform: uppercase;
  }
  .epv-tickethead { padding: 16px 20px 0; display: flex; align-items: center; justify-content: space-between; }
  .epv-tickethead .brand { font-size: 16px; font-weight: 600; letter-spacing: -0.035em; }
  .epv-vipchip {
    padding: 2px 10px; border-radius: 6px;
    background: linear-gradient(110deg, oklch(0.72 0.12 90), oklch(0.85 0.11 94));
    color: oklch(0.26 0.06 85);
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em;
    border: 1px solid oklch(0.68 0.11 88);
  }
  .epv-ticketname { padding: 14px 20px 12px; }
  .epv-ticketname .kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--ink-3); font-weight: 600; }
  .epv-ticketname .n { font-size: 18px; font-weight: 600; letter-spacing: -0.02em; margin-top: 4px; line-height: 1.25; }
  .epv-ticketname .s { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; }
  .epv-ticketbody {
    margin: 0 16px; padding: 18px; border-radius: 18px; position: relative;
    background: var(--accent-wash); border: 1px solid var(--accent-line);
    display: flex; flex-direction: column; gap: 14px;
  }
  .epv-ticketbody.vip { background: linear-gradient(150deg, oklch(0.97 0.035 95), oklch(0.94 0.06 92)); border-color: oklch(0.80 0.10 92); }
  .epv-ticketbody .row { display: flex; align-items: center; justify-content: space-between; }
  .epv-ticketbody .serial { font-family: var(--mono); font-size: 11.5px; color: var(--ink-3); }
  .epv-ticketbody .qr { background: #fff; padding: 18px; border-radius: 12px; display: grid; place-items: center; color: var(--ink-4); }
  .epv-ticketbody .perf {
    position: absolute; width: 18px; height: 18px; border-radius: 50%;
    background: var(--surface); border: 1px solid var(--accent-line);
    top: 50%; transform: translateY(-50%);
  }
  .epv-ticketbody .perf.left { left: -10px; }
  .epv-ticketbody .perf.right { right: -10px; }
  .epv-ticketbody.vip .perf { border-color: oklch(0.80 0.10 92); }
  .epv-ticketrows { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 9px; }
  .epv-ticketrows div { display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; }
  .epv-ticketrows span { color: var(--ink-3); }
  .epv-ticketrows b { font-weight: 600; text-align: right; }

  @media (prefers-reduced-motion: reduce) { .epv-live .dot { animation: none; } }
`;
