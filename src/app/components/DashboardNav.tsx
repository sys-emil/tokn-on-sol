'use client';

import Link from 'next/link';

/**
 * Die Navigationsleiste aller Dashboard-Seiten.
 *
 * Vorher stand sie auf jeder der acht Seiten von Hand geschrieben, und keine
 * zwei waren gleich: „Profil" fehlte auf vier, „Meine Tickets" auf fuenf, und
 * die Reihenfolge wechselte von Seite zu Seite — wer auf „Saisonpaesse"
 * klickte, fand „Profil" danach an einer anderen Stelle. **Immer alle Punkte,
 * immer in dieser Reihenfolge.**
 *
 * Reihenfolge entlang des Arbeitswegs eines Veranstalters: was ich verkaufe
 * (Uebersicht, Saisonpaesse) → mein Geld (Auszahlungen) → meine Zahlen (Pro)
 * → mein oeffentliches Gesicht (Profil). Danach, hinter einem Trenner, die
 * beiden Wege hinaus auf die Gastseite — sie gehoeren nicht zum Dashboard und
 * sollen auch nicht wie ein weiterer Abschnitt aussehen.
 *
 * „Pro" trug frueher auf der Uebersicht ein Funkel-Symbol, wenn das Abo lief,
 * und auf den uebrigen Seiten nicht — nur diese eine kannte den Tarif. Das
 * Symbol aendert die Breite des Punktes und haette alles rechts davon je nach
 * Seite verschoben, also ist es raus. Den Tarif zeigen die Pro-Karte auf der
 * Uebersicht und die Pro-Seite selbst.
 */
export type DashboardNavKey = 'overview' | 'passes' | 'payouts' | 'pro' | 'profile';

export function DashboardNav({ active }: { active?: DashboardNavKey }) {
  return (
    <div className="nav">
      <Link href="/dashboard" className={active === 'overview' ? 'active' : undefined}>Übersicht</Link>
      <Link href="/dashboard/passes" className={active === 'passes' ? 'active' : undefined}>Saisonpässe</Link>
      <Link href="/dashboard/payouts" className={active === 'payouts' ? 'active' : undefined}>Auszahlungen</Link>
      <Link href="/dashboard/analytics" className={active === 'pro' ? 'active' : undefined}>Pro</Link>
      <Link href="/dashboard/profile" className={active === 'profile' ? 'active' : undefined}>Profil</Link>
      <span className="nav-sep" aria-hidden="true" />
      <Link href="/events">Events</Link>
      <Link href="/my-tickets">Meine Tickets</Link>
    </div>
  );
}
