'use client';

import { useEffect, useRef } from 'react';

/**
 * Tastatur- und Fokusverhalten eines Dialogs.
 *
 * Auf /my-tickets standen drei Dialoge nebeneinander, von denen genau einer
 * auf Escape reagierte und keiner den Fokus fuehrte: mit der Tastatur lief man
 * aus dem offenen Dialog heraus in die Seite dahinter weiter. Das ist kein
 * seitenspezifisches Problem, deshalb liegt es hier und nicht dort — jede
 * weitere `.modal`-Flaeche kann es uebernehmen.
 *
 * Drei Dinge, in dieser Reihenfolge:
 *  1. Escape schliesst (auf `keydown`, damit es vor der Tasteneingabe eines
 *     Feldes im Dialog greift).
 *  2. Der Fokus springt beim Oeffnen in den Dialog und beim Schliessen zurueck
 *     auf das ausloesende Element.
 *  3. Tab laeuft im Kreis, statt hinter den Dialog zu wandern.
 *
 * `onClose` darf sich bei jedem Rendern aendern; der Effekt haengt bewusst
 * nicht daran, sonst reisst jeder neue Zustand des Dialogs den Listener ab und
 * setzt den Fokus erneut.
 */
export function useDialogChrome(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    const previous = document.activeElement as HTMLElement | null;

    const focusable = () => {
      if (!root) return [] as HTMLElement[];
      return [...root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    // Der Dialog selbst bekommt den Fokus, nicht der erste Knopf darin: sonst
    // liest ein Screenreader mit „Abbrechen" los statt mit der Ueberschrift.
    root?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !root) return;
      const items = focusable();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Nur zurueckgeben, wenn der Fokus noch im Dialog steht — sonst ueber-
      // schreibt das Schliessen eine Stelle, die der Nutzer selbst gewaehlt hat.
      if (previous && (!document.activeElement || document.activeElement === document.body || root?.contains(document.activeElement))) {
        previous.focus?.({ preventScroll: true });
      }
    };
  }, [open]);

  return ref;
}
