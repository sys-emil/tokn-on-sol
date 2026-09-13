import type { Lang } from "@/lib/i18n";

/**
 * Mehrtaegige Events (seit 2026-09-13). `date` ist der erste Tag und bleibt
 * der Anker fuer alles, was am Anfang haengt: Erinnerungsmail am Vorabend,
 * Rueckgabefrist, Sortierung. `end_date` (optional) ist der letzte Tag und
 * steuert, was am Ende haengt: ob das Event noch „bevorstehend" ist, das
 * Kalenderende, den Live-Tag im Dashboard und den Auszahlungsanker. Ohne
 * `end_date` sind beide derselbe Tag — jedes bestehende Event verhaelt sich
 * unveraendert. Client-safe: kein Supabase, kein next/headers.
 */

export interface DatedEvent {
  date: string;
  end_date?: string | null;
}

/** Letzter Tag des Events (= erster Tag, wenn keiner gesetzt ist). */
export function lastDay(e: DatedEvent): string {
  return e.end_date && e.end_date > e.date ? e.end_date : e.date;
}

export function isMultiDay(e: DatedEvent): boolean {
  return Boolean(e.end_date && e.end_date > e.date);
}

/** Heute in Europe/Berlin als YYYY-MM-DD. */
export function berlinToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

/** Das Event liegt (noch) nicht hinter uns: der letzte Tag ist heute oder spaeter. */
export function isUpcomingEvent(e: DatedEvent, today = berlinToday()): boolean {
  return lastDay(e) >= today;
}

/** Heute ist einer der Eventtage. */
export function isEventDayOf(e: DatedEvent, today = berlinToday()): boolean {
  return e.date <= today && today <= lastDay(e);
}

/**
 * PostgREST-Filter fuer „bevorstehend": `end_date >= heute` oder, ohne
 * Enddatum, `date >= heute`. Als `.or(...)`-Ausdruck, weil PostgREST kein
 * coalesce kennt. Immer zusammen mit denselben uebrigen Filtern benutzen wie
 * bisher `.gte('date', today)`.
 */
export function upcomingOrFilter(today: string): string {
  return `end_date.gte.${today},and(end_date.is.null,date.gte.${today})`;
}

const locale = (lang: Lang) => (lang === "en" ? "en-GB" : "de-DE");

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Datum oder Datumsspanne, lesbar: „Sa., 12. Oktober 2026" bzw.
 * „12.–14. Oktober 2026" / „30. Okt. – 2. Nov. 2026". Faellt fuer ein
 * eintaegiges Event auf das gewohnte Einzeldatum zurueck.
 */
export function formatEventDates(
  e: DatedEvent,
  lang: Lang,
  opts: { weekday?: boolean } = { weekday: true },
): string {
  if (!e.date) return "";
  const loc = locale(lang);
  const start = parse(e.date);
  if (!isMultiDay(e)) {
    return start.toLocaleDateString(loc, {
      ...(opts.weekday ? { weekday: "long" as const } : {}),
      day: "numeric", month: "long", year: "numeric",
    });
  }
  const end = parse(lastDay(e));
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    const monthYear = end.toLocaleDateString(loc, { month: "long", year: "numeric" });
    return lang === "en"
      ? `${start.getDate()}–${end.getDate()} ${monthYear}`
      : `${start.getDate()}.–${end.getDate()}. ${monthYear}`;
  }
  const a = start.toLocaleDateString(loc, { day: "numeric", month: "short" });
  const b = end.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
  return `${a} – ${b}`;
}
