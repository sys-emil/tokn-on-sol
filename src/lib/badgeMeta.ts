/**
 * Single source of truth for badge definitions; display (name/symbol/hue),
 * cNFT metadata copy, and award thresholds. Client-safe: no server imports,
 * imported by client pages, server components, and the badge engine alike.
 */

export type BadgeType =
  | 'first_show'
  | 'show_5'
  | 'show_10'
  | 'loyal_organizer'
  | 'first_ticket'
  | 'early_bird'
  | 'sold_out_show';

export const BADGE_META: Record<
  BadgeType,
  { name: string; description: string; symbol: string; hue: number }
> = {
  first_show: {
    name: 'Erstes Event',
    description: 'Das allererste Event auf Passly besucht; der Anfang der Sammlung.',
    symbol: 'I',
    hue: 285,
  },
  show_5: {
    name: '5 Events',
    description: '5 Events besucht; auf dem besten Weg zum Stammgast.',
    symbol: 'V',
    hue: 150,
  },
  show_10: {
    name: '10 Events',
    description: '10 Events besucht. Das ist ein Lebensgefühl.',
    symbol: 'X',
    hue: 220,
  },
  loyal_organizer: {
    name: 'Stammgast',
    description: '3 Events beim selben Veranstalter besucht.',
    symbol: '♥',
    hue: 340,
  },
  first_ticket: {
    name: 'Frühstarter',
    description: 'Das allererste Ticket auf Passly gekauft.',
    symbol: '✦',
    hue: 95,
  },
  early_bird: {
    name: 'Early Bird',
    description: 'Ticket in der ersten Stunde des Vorverkaufs gesichert.',
    symbol: '☀',
    hue: 60,
  },
  sold_out_show: {
    name: 'Ausverkauft dabei',
    description: 'Bei einem restlos ausverkauften Event dabei gewesen.',
    symbol: '★',
    hue: 20,
  },
};

/** Fallback for unknown/legacy badge types coming from the database. */
export function badgeDisplay(type: string): { name: string; symbol: string; hue: number } {
  return BADGE_META[type as BadgeType] ?? { name: type, symbol: '◆', hue: 260 };
}

/** Attendance milestones, awarded on redemption (count of redeemed tickets). */
export const MILESTONES: { type: BadgeType; threshold: number }[] = [
  { type: 'first_show', threshold: 1 },
  { type: 'show_5', threshold: 5 },
  { type: 'show_10', threshold: 10 },
];

/** Distinct redeemed events at the same organizer for the Stammgast badge. */
export const STAMMGAST_THRESHOLD = 3;

/** Purchase window after event creation that still counts as Early Bird. */
export const EARLY_BIRD_WINDOW_MS = 60 * 60 * 1000;
