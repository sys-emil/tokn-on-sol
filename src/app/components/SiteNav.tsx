'use client';

import Link from 'next/link';
import { useT } from '@/app/components/LangProvider';

/**
 * Die Navigationsleiste aller oeffentlichen Seiten — Startseite, Eventliste,
 * Eventseite, Meine Tickets, Konto, oeffentliche Profile, Marketing- und
 * Rechtsseiten.
 *
 * Es gibt sie als eigene Komponente, weil sie vorher auf jeder Seite von Hand
 * geschrieben stand: mal drei Punkte, mal zwei, jedes Mal in einer anderen
 * Reihenfolge. Wer von der Startseite auf „Events" klickte, fand denselben
 * Punkt danach an einer anderen Stelle. **Immer alle Punkte, immer in dieser
 * Reihenfolge** — nur so bleibt jedes Ziel dort, wo man es zuletzt angeklickt
 * hat. Eine Seite waehlt hier nichts aus; sie sagt nur, wo sie selbst steht.
 *
 * Reihenfolge: die beiden Gastziele zuerst, weil auf neun dieser elf Seiten
 * ein Gast steht, danach die Erklaerseite und zuletzt die beiden Seiten fuer
 * Veranstalter. Dass die Startseite Veranstalter anspricht, traegt ihre
 * Ueberschrift und ihr Hauptknopf, nicht die Leiste.
 */
export type SiteNavKey = 'events' | 'tickets' | 'how' | 'organizers' | 'pricing';

export function SiteNav({ active }: { active?: SiteNavKey }) {
  const t = useT();

  const items: { key: SiteNavKey; href: string; label: string }[] = [
    { key: 'events', href: '/events', label: t('common.events') },
    { key: 'tickets', href: '/my-tickets', label: t('common.myTickets') },
    { key: 'how', href: '/so-funktionierts', label: t('common.howItWorks') },
    { key: 'organizers', href: '/fuer-veranstalter', label: t('common.forOrganizers') },
    { key: 'pricing', href: '/preise', label: t('common.pricing') },
  ];

  return (
    <div className="nav">
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={i.key === active ? 'active' : undefined}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}
