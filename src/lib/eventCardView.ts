import type { TranslationKey } from "@/lib/i18n";

/**
 * Anzeigewerte einer Event-Karte: Badge, Fortschritt und Fusszeile.
 *
 * Rein und ohne i18n-Aufruf — die Funktion liefert Uebersetzungs*schluessel*
 * samt Variablen, uebersetzt wird beim Aufrufer. So bleibt sie testbar, und
 * vor allem: die Liste /events und die Live-Vorschau im Event-Editor rechnen
 * garantiert dasselbe aus. Eine Vorschau, die etwas anderes behauptet als die
 * Seite, die sie vorhersagt, waere schlimmer als keine.
 */

export interface CardLabel {
  key: TranslationKey;
  vars?: Record<string, string | number>;
}

export interface EventCardViewInput {
  capacity: number;
  ticketsSold: number;
  ticketsReserved?: number;
  /** YYYY-MM-DD */
  date: string;
  createdAt?: string | null;
  /** Pro-Veranstalter bieten auf der ausverkauften Karte die Warteliste an. */
  hasWaitlist?: boolean;
  /** Injizierbar fuer Tests; sonst jetzt. */
  now?: Date;
}

export interface EventCardView {
  soldOut: boolean;
  /** Verkauft in Prozent, 0 wenn das Event keine Kapazitaet hat. */
  pctSold: number;
  /** Rest in Prozent, nie unter 1 solange nicht ausverkauft. */
  pctLeft: number;
  /** Breite des Balkens; ausverkauft ist immer voll. */
  fillPct: number;
  barColor: string;
  /** Ab 95 % verkauft und noch nicht ausverkauft: rot und fett. */
  urgent: boolean;
  badge: CardLabel | null;
  progress: CardLabel | null;
  footNote: CardLabel | null;
}

/** Ganze Tage bis zum Eventdatum; 0 = heute. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso + "T00:00:00").getTime() - today.getTime()) / 86400000);
}

/** Vor weniger als 7 Tagen angelegt — treibt das „Neu"-Badge. */
export function isRecent(createdAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  return now.getTime() - new Date(createdAt).getTime() < 7 * 86400000;
}

export function eventCardView(input: EventCardViewInput): EventCardView {
  const { capacity, ticketsSold, date } = input;
  const now = input.now ?? new Date();
  const taken = ticketsSold + (input.ticketsReserved ?? 0);
  // Kapazitaet 0 zaehlt als ausverkauft, nicht als frei — ein Event ohne
  // Plaetze hat keine zu vergeben. (Verhalten der Liste vor der Auslagerung.)
  const soldOut = taken >= capacity;
  const pctSold = capacity > 0 ? Math.min(100, Math.round((taken / capacity) * 100)) : 0;
  const pctLeft = Math.max(1, 100 - pctSold);
  const urgent = !soldOut && capacity > 0 && pctSold >= 95;
  const days = daysUntil(date, now);

  // Reihenfolge: was den Kauf am staerksten treibt, gewinnt.
  const badge: CardLabel | null = soldOut
    ? { key: input.hasWaitlist ? "events.waitlistBadge" : "events.soldOut" }
    : days === 0
      ? { key: "events.today" }
      : days === 1
        ? { key: "events.tomorrow" }
        : isRecent(input.createdAt, now)
          ? { key: "events.isNew" }
          : capacity > 0
            ? { key: "events.percentLeft", vars: { percent: pctLeft } }
            : null;

  const progress: CardLabel | null = capacity <= 0
    ? null
    : soldOut
      ? { key: "events.soldOutZero" }
      : urgent
        ? { key: "events.almostSoldOut" }
        : { key: "events.percentSold", vars: { percent: pctSold } };

  const footNote: CardLabel | null = soldOut
    ? { key: input.hasWaitlist ? "events.waitlistBadge" : "events.soldOut" }
    : urgent
      ? { key: "events.almostSoldOut" }
      : capacity > 0
        ? { key: "events.percentLeft", vars: { percent: pctLeft } }
        : null;

  return {
    soldOut,
    pctSold,
    pctLeft,
    fillPct: soldOut ? 100 : pctSold,
    barColor: soldOut ? "var(--ink-4)" : urgent ? "var(--bad)" : "var(--accent)",
    urgent,
    badge,
    progress,
    footNote,
  };
}
