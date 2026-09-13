import { getAccessToken } from '@/lib/authBrowser';

/**
 * Wohin es nach einer Anmeldung **von der Startseite aus** weitergeht.
 *
 * Nur dort: wer schon auf einer Unterseite steht (Shop, Ticket, Bestellung,
 * Tuer) hat einen Grund, genau dort zu sein — eine Weiterleitung wuerde ihn
 * aus dem Kauf oder aus dem Ticket herauswerfen. Diese Seiten rufen die
 * Anmeldung deshalb weiterhin ohne `onComplete`-Ziel auf.
 *
 * Veranstalter landen im Dashboard, alle anderen bei ihren Tickets. Nur
 * `approved` fuehrt ins Dashboard: `pending`/`rejected` wuerden dort sofort
 * wieder hinausgeleitet. Die Rolle kommt aus `/api/me`, derselben Antwort,
 * aus der auch der `AuthProvider` sie liest.
 *
 * Faellt im Fehlerfall bewusst auf `/my-tickets` zurueck — das ist das Ziel
 * fuer die grosse Mehrheit, und eine gescheiterte Statusabfrage darf niemanden
 * auf der Startseite stehen lassen.
 */
export async function postLoginDestination(): Promise<string> {
  const fallback = '/my-tickets';
  try {
    const token = await getAccessToken();
    if (!token) return fallback;
    const auth = { Authorization: `Bearer ${token}` };

    const meRes = await fetch('/api/me', { headers: auth, cache: 'no-store' });
    if (!meRes.ok) return fallback;
    const { organizerStatus } = (await meRes.json()) as { organizerStatus?: string };
    return organizerStatus === 'approved' ? '/dashboard' : fallback;
  } catch {
    return fallback;
  }
}
