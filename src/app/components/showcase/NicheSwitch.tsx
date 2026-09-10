import Link from 'next/link';
import { Icon } from '@/app/components/passlyUi';
import { ShopCard } from '@/app/components/eventSurfaces/ShopCard';
import { NICHES, DEFAULT_NICHE } from '@/app/components/showcase/niches';

/**
 * Die Kaufkarte im ersten Kapitel der Startseite, mit den Wegen zu den
 * Nischenseiten darunter.
 *
 * Frueher stand hier ein Umschalter („Was veranstaltest du?") mit drei
 * Knoepfen, der die Karte an Ort und Stelle austauschte. Er ist raus: eine
 * Frage mitten im ersten Kapitel unterbricht den Trichter, bevor der Besucher
 * ueberhaupt gesehen hat, was Passly tut. Die Karte zeigt jetzt eine Nische
 * (`DEFAULT_NICHE`) als Vorschau auf *dein* Event, und wer sich in einer der
 * beiden Nischen wiedererkennt, geht ueber den Link dorthin — ohne dass die
 * Startseite eine Entscheidung verlangt.
 *
 * Nischen ohne eigene Seite (`href: null`) tauchen hier gar nicht auf; die
 * Links stehen genau fuer die Seiten, die es wirklich gibt.
 */

const NICHE_SWITCH_CSS = `
  .nsw { display: grid; gap: 14px; }
  .nsw-links {
    display: flex; gap: 8px 18px; flex-wrap: wrap; justify-content: center;
  }
  .nsw-more {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 500; color: var(--accent);
  }
  .nsw-more:hover { text-decoration: underline; }
  .nsw-more:active { opacity: 0.7; }
`;

export function NicheSwitch() {
  const shown = NICHES.find((n) => n.key === DEFAULT_NICHE) ?? NICHES[0];
  const links = NICHES.filter((n) => n.href);

  return (
    <>
      <style>{NICHE_SWITCH_CSS}</style>
      <div className="nsw">
        <ShopCard {...shown.shopCard} />

        {links.length > 0 && (
          <div className="nsw-links">
            {links.map((n) => (
              <Link key={n.key} href={n.href!} className="nsw-more">
                {n.linkLabel} <Icon name="arrow" size={13} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
