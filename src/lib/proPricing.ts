/**
 * Pro-Abo: Preise und Laufzeiten. Client-sicher (kein Stripe, kein Supabase),
 * weil /preise, die Landingpage und die beiden Upsells im Dashboard dieselben
 * Zahlen rendern.
 *
 * Die Beträge selbst kommen aus Stripe (`/api/organizer/billing/price`); hier
 * steht nur, was sich daraus ableitet. „2 Monate geschenkt" wird aus Monats-
 * und Jahrespreis gerechnet, nie getippt — sonst wirbt die Seite irgendwann mit
 * einem Nachlass, den Checkout nicht gewährt.
 */

export type ProInterval = 'month' | 'year';

export interface ProPriceInfo {
  unitAmount: number; // Cent
  currency: string;   // ISO, klein ('eur')
}

export interface ProPrices {
  month: ProPriceInfo | null;
  year: ProPriceInfo | null;
}

/** Der Preis, den Emil am 2026-07-30 festgelegt hat; nur Fallback, bis
 *  STRIPE_PRO_PRICE_ID existiert. Stripe gewinnt immer. */
export const FALLBACK_MONTHLY_CENTS = 2900;

export const INTERVAL_DE: Record<ProInterval, string> = { month: 'Monat', year: 'Jahr' };

export function isProInterval(v: unknown): v is ProInterval {
  return v === 'month' || v === 'year';
}

/** Jahrespreis auf den Monat umgelegt, abgerundet: „24 €" statt „24,17 €",
 *  weil die Zahl neben dem Jahresbetrag steht und nicht wie ein Taschenrechner
 *  aussehen soll. Abgerundet, nie aufgerundet — die Seite darf nicht mehr
 *  versprechen, als abgebucht wird. */
export function yearlyPerMonthCents(yearCents: number): number {
  return Math.floor(yearCents / 12);
}

export interface YearlySaving {
  /** Volle Monate, die das Jahresabo gegenüber 12 Monatsraten spart. */
  monthsFree: number;
  /** Ersparnis in Prozent gegenüber 12 Monatsraten, gerundet. */
  percent: number;
}

/** null, wenn das Jahresabo nicht günstiger ist — dann gibt es nichts zu
 *  bewerben und der Schalter zeigt nur den Preis. */
export function yearlySaving(monthCents: number, yearCents: number): YearlySaving | null {
  if (monthCents <= 0 || yearCents <= 0) return null;
  const twelve = monthCents * 12;
  if (yearCents >= twelve) return null;
  // Toleranz gegen 290/29 = 10,000000001 und Ähnliches.
  const monthsFree = Math.floor(12 - yearCents / monthCents + 1e-6);
  const percent = Math.round(((twelve - yearCents) / twelve) * 100);
  return { monthsFree, percent };
}

/** Das kurze Etikett neben dem Jährlich-Schalter. Volle Monate, wenn es welche
 *  gibt; sonst der Prozentsatz, damit eine krumme Stripe-Price nicht „0 Monate
 *  geschenkt" ergibt. */
export function yearlySavingLabel(saving: YearlySaving | null): string | null {
  if (!saving) return null;
  if (saving.monthsFree >= 1) {
    return saving.monthsFree === 1 ? '1 Monat geschenkt' : `${saving.monthsFree} Monate geschenkt`;
  }
  return saving.percent >= 1 ? `${saving.percent} % günstiger` : null;
}

export function formatCents(cents: number, currency = 'eur'): string {
  return (cents / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
