'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';

/**
 * Anmelde-Knopf oben rechts auf der Startseite.
 *
 * Vorher stand dort „Event anlegen" und schickte jeden auf das
 * Bewerbungsformular — auch Veranstalter, die laengst ein Konto haben und
 * eigentlich nur in ihr Dashboard wollten. Der Knopf zeigt deshalb, was
 * jeweils dran ist: anmelden, oder weiter ins Dashboard.
 *
 * Eigene Client-Komponente, weil die Startseite ein Server-Component ist und
 * bleiben soll (globale Metadaten, statisch ausgeliefert). Nur dieser Knopf
 * braucht die Anmeldung.
 */
export function SignInButton() {
  const { ready, authenticated, login } = useAuth();

  // Bis die Sitzung geladen ist, steht der Knopf schon an seinem Platz — sonst
  // springt die Topbar beim Laden.
  if (!ready) {
    return (
      <span className="btn primary sm" aria-hidden="true" style={{ opacity: 0.55, pointerEvents: 'none' }}>
        Anmelden
      </span>
    );
  }

  if (authenticated) {
    // Wer kein Veranstalter ist, wird vom Dashboard selbst zur Bewerbung
    // weitergeleitet; hier braucht es dafuer keine zweite Abfrage.
    return <Link href="/dashboard" className="btn primary sm">Dashboard</Link>;
  }

  return (
    <button type="button" className="btn primary sm" onClick={() => login()}>
      Anmelden
    </button>
  );
}
