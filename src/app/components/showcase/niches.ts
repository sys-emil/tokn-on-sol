import type { ShopCardProps } from '@/app/components/eventSurfaces/ShopCard';

/**
 * Die drei Nischen, in denen Passly verkauft wird: Verein, Club, Kultur.
 *
 * **Eine Marke, drei Türen.** Ein Sportverein, ein Club und ein
 * Kulturveranstalter suchen mit verschiedenen Worten und brauchen
 * verschiedene Beispiele — aber es gibt eine Person und noch keine Kunden,
 * also darf sich nichts verdreifachen. Geteilt wird deshalb genau das hier:
 * die Beispieldaten, mit denen dieselben Produktflächen (`ShopCard`,
 * `DoorScene`, `ShowcaseMocks`) je Nische beschriftet werden.
 *
 * **Der Fließtext der Nischenseiten steht bewusst NICHT hier.** Eine Datei,
 * aus der sich drei ganze Landingpages generieren, produziert genau die
 * austauschbaren Doorway-Pages, die wir vermeiden wollen: dieselbe Seite mit
 * ausgetauschten Substantiven merkt der Leser in zehn Sekunden, und Google
 * auch. Geteilt wird das Gerüst, unterschiedlich bleibt der Inhalt.
 *
 * `href` ist `null`, solange eine Nische noch keine eigene Seite hat. Der
 * Umschalter auf der Startseite zeigt ihre Karte trotzdem — die Karte ist
 * eine Vorschau auf *dein* Event, kein Versprechen einer Unterseite.
 *
 * Für die Mockups gilt die Regel aus `ShowcaseMocks`: **es steht nur drauf,
 * was es gibt.** Alle Namen sind erfunden; kein echter Verein, kein echter
 * Club, keine Referenz, die es noch nicht gibt.
 */

export type NicheKey = 'sport' | 'club' | 'kultur';

export interface Niche {
  key: NicheKey;
  /** Beschriftung im Umschalter auf der Startseite. */
  switchLabel: string;
  /** Eigene Nischenseite, oder `null`, solange es keine gibt. */
  href: string | null;
  /** Beschriftung des Links darunter, z. B. „Mehr für Sportvereine". */
  linkLabel: string;
  /** Startwert des Gebührenrechners auf der jeweiligen Nischenseite, in Euro. */
  calcStartPriceEur: number;
  shopCard: ShopCardProps;
}

/* Die Club-Karte ist die, die seit dem Showcase-Umbau auf der Startseite
   steht. Sie bleibt der Startzustand des Umschalters: wer ihn nicht anfasst,
   sieht die Startseite unverändert. */
const CLUB: Niche = {
  key: 'club',
  switchLabel: 'Club',
  href: '/clubs',
  linkLabel: 'Mehr für Clubs',
  calcStartPriceEur: 15,
  shopCard: {
    name: 'Die beste Nacht des Jahres',
    dateChip: { month: 'Sep', day: '5' },
    whenLabel: 'Freitag, 5. September · 20:00 Uhr',
    venue: 'Halle 7, Leipzig',
    priceLabel: 'ab 12,00 €',
    feeNote: 'zzgl. Servicegebühr',
    tiers: [
      { name: 'Frühbucher', priceLabel: '12,00 €' },
      { name: 'Abendkasse', priceLabel: '15,00 €' },
    ],
    ctaLabel: 'Jetzt kaufen',
  },
};

const SPORT: Niche = {
  key: 'sport',
  switchLabel: 'Verein',
  href: '/sportvereine',
  linkLabel: 'Mehr für Sportvereine',
  calcStartPriceEur: 8,
  shopCard: {
    name: 'Heimspiel gegen SV Nordstadt',
    dateChip: { month: 'Okt', day: '11' },
    whenLabel: 'Samstag, 11. Oktober · 19:30 Uhr',
    venue: 'Sporthalle am Ring',
    priceLabel: 'ab 6,00 €',
    feeNote: 'zzgl. Servicegebühr',
    tiers: [
      { name: 'Erwachsene', priceLabel: '9,00 €' },
      { name: 'Ermäßigt', priceLabel: '6,00 €' },
    ],
    ctaLabel: 'Jetzt kaufen',
  },
};

const KULTUR: Niche = {
  key: 'kultur',
  switchLabel: 'Kultur',
  href: null,
  linkLabel: 'Mehr für Kulturveranstalter',
  calcStartPriceEur: 18,
  shopCard: {
    name: 'Herbstkonzert im Saal',
    dateChip: { month: 'Nov', day: '8' },
    whenLabel: 'Samstag, 8. November · 19:00 Uhr',
    venue: 'Kulturhaus, Großer Saal',
    priceLabel: 'ab 12,00 €',
    feeNote: 'zzgl. Servicegebühr',
    tiers: [
      { name: 'Vollzahler', priceLabel: '18,00 €' },
      { name: 'Ermäßigt', priceLabel: '12,00 €' },
    ],
    ctaLabel: 'Jetzt kaufen',
  },
};

/** Reihenfolge im Umschalter. */
export const NICHES: readonly Niche[] = [CLUB, SPORT, KULTUR];

/**
 * Startzustand des Umschalters. Der Club steht vorn, weil seine Karte die
 * ist, die dort seit dem Showcase-Umbau steht: wer den Schalter nicht
 * anfasst, sieht die Startseite unverändert.
 */
export const DEFAULT_NICHE: NicheKey = 'club';

export const NICHE_SPORT = SPORT;
export const NICHE_CLUB = CLUB;
