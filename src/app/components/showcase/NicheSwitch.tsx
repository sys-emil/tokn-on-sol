'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/app/components/passlyUi';
import { ShopCard } from '@/app/components/eventSurfaces/ShopCard';
import { NICHES, DEFAULT_NICHE, type NicheKey } from '@/app/components/showcase/niches';

/**
 * „Was veranstaltest du?" — tauscht die Kaufkarte im ersten Kapitel der
 * Startseite **an Ort und Stelle** aus.
 *
 * Die Alternative dazu waren drei anklickbare Nischen-Säulen mitten auf der
 * Seite. Wer auf der Startseite steht, ist aber schon da; ein zweiter,
 * konkurrierender Weg kostet dort Leute im Trichter. Hier erkennt sich der
 * Besucher wieder, ohne die Seite zu verlassen — und die Nischenseiten
 * bleiben, was sie sind: eigene Eingangstüren aus der Suche.
 *
 * Es wechselt nur die Karte (und die Zeile darunter), nicht Überschrift und
 * Fließtext des Kapitels — sonst springt beim Klick das Layout.
 *
 * Nischen ohne eigene Seite (`href: null`) schalten die Karte trotzdem um.
 * Die Karte ist eine Vorschau auf *dein* Event, kein Versprechen einer
 * Unterseite.
 */

const NICHE_SWITCH_CSS = `
  .nsw { display: grid; gap: 14px; }
  .nsw-head {
    font-size: 11px; font-weight: 600; color: var(--accent-ink);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .nsw-seg { display: flex; gap: 6px; flex-wrap: wrap; }
  .nsw-seg button {
    flex: 1 1 auto; min-width: 88px; appearance: none; cursor: pointer;
    background: var(--surface); color: var(--ink-2);
    border: 1px solid var(--line); border-radius: 8px;
    padding: 9px 10px; font: inherit; font-size: 13px; font-weight: 550;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .nsw-seg button:hover { border-color: var(--line-2); color: var(--ink); }
  .nsw-seg button.active {
    background: var(--accent-wash); color: var(--accent-ink); border-color: var(--accent);
  }
  .nsw-more {
    display: inline-flex; align-items: center; gap: 6px; justify-self: center;
    font-size: 13px; font-weight: 500; color: var(--accent);
  }
  .nsw-more:hover { text-decoration: underline; }
  @media (prefers-reduced-motion: reduce) {
    .nsw-seg button { transition: none; }
  }
`;

export function NicheSwitch() {
  const [key, setKey] = useState<NicheKey>(DEFAULT_NICHE);
  const active = NICHES.find((n) => n.key === key) ?? NICHES[0];

  return (
    <>
      <style>{NICHE_SWITCH_CSS}</style>
      <div className="nsw">
        <div>
          <div className="nsw-head" id="nsw-label">Was veranstaltest du?</div>
          <div className="nsw-seg" role="group" aria-labelledby="nsw-label" style={{ marginTop: 8 }}>
            {NICHES.map((n) => (
              <button
                key={n.key}
                type="button"
                className={n.key === active.key ? 'active' : undefined}
                aria-pressed={n.key === active.key}
                onClick={() => setKey(n.key)}
              >
                {n.switchLabel}
              </button>
            ))}
          </div>
        </div>

        <ShopCard {...active.shopCard} />

        {active.href && (
          <Link href={active.href} className="nsw-more">
            {active.linkLabel} <Icon name="arrow" size={13} />
          </Link>
        )}
      </div>
    </>
  );
}
