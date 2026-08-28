import Link from 'next/link';
import { EventCard, EventArt, EVENT_CARD_CSS } from '@/app/components/eventSurfaces/EventCard';
import { eventCardView } from '@/lib/eventCardView';
import type { CardLabel } from '@/lib/eventCardView';
import { t as translate } from '@/lib/i18n';
import { Icon } from '@/app/components/passlyUi';

/**
 * „Diese Abende laufen gerade über Passly" — echte Events auf der Startseite.
 *
 * Der Block bedient beide Seiten mit demselben Inhalt, und das ist sein
 * ganzer Zweck: der Veranstalter liest *das ist echt, und so würde mein Event
 * aussehen*, der Gast liest *Events, klick*. Deshalb heißt er nicht „Events
 * entdecken" — das wäre ein Katalog, und damit würde die Startseite zur
 * Eingangstür eines Marktplatzes. Genau das verspricht Passly seinen
 * Veranstaltern nicht.
 *
 * **Er rendert erst ab sechs öffentlichen kommenden Events.** Ein prominenter
 * Block mit einer einzigen Karte beweist nicht „hier ist was los", sondern
 * „hier ist niemand" — und zwar dem Veranstalter, den die Seite gerade
 * überzeugen soll. Unter der Schwelle bleibt er einfach weg und geht von
 * allein an, sobald die Plattform ihn trägt. Kein zweiter Umbau später.
 *
 * Die Karten sind dieselbe Komponente wie auf /events, nicht ein Nachbau:
 * die Startseite kann damit gar nicht zeigen, was es nicht gibt.
 */

/** Ab so vielen öffentlichen kommenden Events lohnt sich der Block. */
const SCHWELLE = 6;
const ZEIGE = 3;

interface Row {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  tickets_reserved: number | null;
  image_url: string | null;
  venue: string | null;
  created_at: string;
}

const monthShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();

export async function LiveEvents() {
  const today = new Date().toISOString().slice(0, 10);

  let rows: Row[] = [];
  let gesamt = 0;
  try {
    // Erst hier geladen, nicht oben: `supabaseAdmin` wird beim Import erzeugt
    // und wirft, wenn der Service-Key fehlt. Die Startseite hing vorher an
    // gar keiner Datenbank — sie soll nicht wegen dieses Beiwerks ausfallen,
    // wenn eine Umgebungsvariable fehlt.
    const { supabaseAdmin } = await import('@/lib/supabase');

    // Eine Abfrage für beides: `count` ist die Gesamtzahl, die über die
    // Schwelle entscheidet, `data` sind die drei, die gezeigt werden.
    const { data, count } = await supabaseAdmin
      .from('events')
      .select(
        'id, name, date, start_time, price_eur, capacity, tickets_sold, tickets_reserved, image_url, venue, created_at',
        { count: 'exact' },
      )
      .gte('date', today)
      .eq('is_private', false)
      .is('cancelled_at', null)
      .order('date', { ascending: true })
      .limit(ZEIGE);

    gesamt = count ?? 0;
    rows = (data ?? []) as Row[];
  } catch {
    return null;
  }

  if (gesamt < SCHWELLE || rows.length === 0) return null;

  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate('de', key, vars);
  const label = (l: CardLabel | null) => (l ? t(l.key, l.vars) : null);

  return (
    <section>
      <style>{EVENT_CARD_CSS + LIVE_EVENTS_CSS}</style>
      <div className="le-head" data-reveal>
        <div>
          <h2>Diese Abende laufen gerade über Passly</h2>
          <div className="sub">
            Öffentlich gestellte Events landen zusätzlich hier — du entscheidest je Event,
            ob deins dabei ist.
          </div>
        </div>
        <Link href="/events" className="le-more">
          Alle Events ansehen <Icon name="arrow" size={13} />
        </Link>
      </div>

      <div className="le-grid">
        {rows.map((e, i) => {
          const v = eventCardView({
            capacity: e.capacity,
            ticketsSold: e.tickets_sold,
            ticketsReserved: e.tickets_reserved ?? 0,
            date: e.date,
            createdAt: e.created_at,
            hasWaitlist: false,
          });
          const sub = [e.start_time ? `${e.start_time} Uhr` : null, e.venue]
            .filter(Boolean)
            .join(' · ');

          return (
            <EventCard
              key={e.id}
              href={`/event/${e.id}`}
              name={e.name}
              monthLabel={monthShort(e.date)}
              dayLabel={dayNum(e.date)}
              subLine={sub || null}
              priceLabel={e.price_eur === 0
                ? 'Kostenlos'
                : `ab ${(e.price_eur / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
              art={<EventArt name={e.name} imageUrl={e.image_url} />}
              badge={label(v.badge)}
              progressLabel={label(v.progress)}
              fillPct={v.fillPct}
              barColor={v.barColor}
              urgent={v.urgent}
              soldOut={v.soldOut}
              ctaLabel={v.soldOut ? 'Ausverkauft' : 'Tickets sichern'}
              ctaMuted={v.soldOut}
              footNote={label(v.footNote)}
              animationDelayMs={i * 70}
            />
          );
        })}
      </div>
    </section>
  );
}

const LIVE_EVENTS_CSS = `
  .le-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 24px; margin-bottom: 20px;
  }
  .le-head h2 { font-size: clamp(22px, 2.6vw, 28px); font-weight: 620; letter-spacing: -0.03em; line-height: 1.15; }
  .le-head .sub { font-size: 14px; color: var(--ink-3); margin-top: 8px; max-width: 52ch; line-height: 1.6; }
  .le-more {
    display: inline-flex; align-items: center; gap: 6px; flex: none;
    font-size: 14px; font-weight: 550; color: var(--accent); white-space: nowrap;
  }
  .le-more:hover { color: var(--accent-2); }
  .le-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
  @media (max-width: 980px) { .le-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) {
    .le-head { flex-direction: column; align-items: flex-start; gap: 12px; }
    .le-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  }
`;
