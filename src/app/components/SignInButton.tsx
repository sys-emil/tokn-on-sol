'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { postLoginDestination } from '@/lib/postLogin';

/**
 * Anmelde-Knopf oben rechts auf den drei Einstiegsseiten: Startseite,
 * `/sportvereine`, `/clubs`.
 *
 * Vorher stand dort „Event anlegen" und schickte jeden auf das
 * Bewerbungsformular — auch Veranstalter, die laengst ein Konto haben und
 * eigentlich nur in ihr Dashboard wollten. Der Knopf zeigt deshalb, was
 * jeweils dran ist: anmelden, oder weiter ins Dashboard.
 *
 * Auf den beiden Nischenseiten stand bis 2026-09-10 „Kostenlos starten" —
 * derselbe Text, dieselbe Farbe und gleichzeitig sichtbar mit dem Hauptknopf
 * im Hero. Zwei gleich auffaellige Hauptsachen heben sich gegenseitig auf, und
 * ein Veranstalter mit Konto hatte auf diesen Seiten ueberhaupt keinen Weg
 * hinein.
 *
 * Angemeldet zeigt er die Rolle des Kontos: Veranstalter gehen ins Dashboard,
 * Gaeste zu ihren Tickets. Ein Gastkonto bekommt hier bewusst keinen
 * „Dashboard"-Knopf — das Dashboard, die Saisonpaesse und die Auszahlungen
 * sind fuer Veranstalter, und wer eines werden will, tut das ueber „Event
 * anlegen" auf den Veranstalterseiten.
 *
 * Nach erfolgreicher Anmeldung geht es sofort weiter — ins Dashboard, wenn das
 * Konto ein freigeschalteter Veranstalter ist, sonst zu den eigenen Tickets
 * (`postLoginDestination`). Das gilt nur auf diesen Einstiegsseiten; wer sich
 * mitten in einem Kauf oder an der Tuer anmeldet, bleibt dort.
 *
 * Eigene Client-Komponente, weil die drei Seiten Server-Components sind und
 * bleiben sollen (globale Metadaten, statisch ausgeliefert). Nur dieser Knopf
 * braucht die Anmeldung.
 */
export function SignInButton() {
  const { ready, authenticated, isOrganizer, login } = useAuth();
  const router = useRouter();

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
    return isOrganizer
      ? <Link href="/dashboard" className="btn primary sm">Dashboard</Link>
      : <Link href="/my-tickets" className="btn primary sm">Meine Tickets</Link>;
  }

  return (
    <button
      type="button"
      className="btn primary sm"
      onClick={() => login({ onComplete: () => { void postLoginDestination().then((to) => router.push(to)); } })}
    >
      Anmelden
    </button>
  );
}
