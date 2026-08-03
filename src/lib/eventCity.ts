/**
 * Stadt eines Events. Es gibt kein eigenes Stadt-Feld: `events.venue` ist
 * Freitext ("Backstage Halle, München"), und der Teil hinter dem letzten Komma
 * ist in der Praxis die Stadt. Bewusst eine Heuristik statt einer Migration —
 * der Stadtfilter auf /events ist Navigationshilfe, keine harte Zusage.
 */
export function cityFromVenue(venue: string | null | undefined): string | null {
  if (!venue) return null;
  const parts = venue.split(',');
  const last = (parts[parts.length - 1] ?? '').trim();
  return last || null;
}

/** Vergleich für den ?stadt=-Filter: ohne Rücksicht auf Groß-/Kleinschreibung. */
export function cityMatches(venue: string | null | undefined, city: string): boolean {
  const found = cityFromVenue(venue);
  return !!found && found.toLowerCase() === city.trim().toLowerCase();
}
