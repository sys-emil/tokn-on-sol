import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/app/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Hilfe & Support · Passly',
  description: 'Antworten auf häufige Fragen zu Tickets, Anmeldung und Rückerstattungen: der Draht zum Passly-Support.',
};

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@getpassly.de';

export default function HilfePage() {
  return (
    <LegalPageShell title="Hilfe & Support" stand="7. Juli 2026">
      <p>
        Die häufigsten Fragen sind hier beantwortet. Für alles andere erreichst du uns unter{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Wir melden uns in der Regel
        innerhalb von 24 Stunden.
      </p>

      <h2>Mein Ticket ist weg: wo finde ich es?</h2>
      <p>
        Dein Ticket hängt an deiner E-Mail-Adresse, nicht an deinem Gerät. Öffne{' '}
        <Link href="/my-tickets">Meine Tickets</Link> auf einem beliebigen Gerät und melde dich mit
        derselben E-Mail-Adresse an, mit der du gekauft hast, und das Ticket ist sofort wieder da.
        Eine App oder ein Passwort brauchst du nicht; du bekommst einen Anmeldecode per E-Mail.
      </p>

      <h2>Ich komme nicht mehr an meine E-Mail-Adresse</h2>
      <p>
        Kein Problem, dein Ticket ist nicht verloren. Schreib uns an{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> mit:
      </p>
      <ul>
        <li>der alten E-Mail-Adresse, mit der du gekauft hast,</li>
        <li>deiner neuen E-Mail-Adresse,</li>
        <li>einem Kaufnachweis (Stripe-Zahlungsbestätigung oder Bestell-E-Mail).</li>
      </ul>
      <p>
        Nach der Prüfung schicken wir dir einen einmaligen Übertragungslink an die neue Adresse,
        damit ziehst du dein Ticket sicher auf dein neues Konto um. Bereits eingelöste Tickets
        können nicht übertragen werden.
      </p>

      <h2>Ich kann nicht kommen: kann ich mein Ticket weitergeben?</h2>
      <p>
        Ja. Öffne dein Ticket unter <Link href="/my-tickets">Meine Tickets</Link> und erstelle dort
        einen Weitergabe-Link. Die Person, die den Link öffnet und sich anmeldet, erhält das Ticket,
        sicher und nachvollziehbar. Dein eigener Zugriff erlischt dabei.
      </p>

      <h2>Das Event wurde abgesagt: bekomme ich mein Geld zurück?</h2>
      <p>
        Ja, automatisch. Bei einer Absage erstatten wir jede noch nicht ausgezahlte Zahlung
        vollständig auf das ursprüngliche Zahlungsmittel; das dauert je nach Bank 5–10 Werktage.
        Du musst nichts tun. Falls nach 10 Werktagen nichts angekommen ist, melde dich mit deiner
        Zahlungsbestätigung bei <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Mein QR-Code wird am Einlass nicht angenommen</h2>
      <ul>
        <li>Der QR-Code erneuert sich jede Minute, lade die Ticketseite neu, falls „abgelaufen&ldquo; angezeigt wird.</li>
        <li>Screenshots funktionieren nicht. Zeige immer die geöffnete Ticketseite.</li>
        <li>Stelle die Bildschirmhelligkeit hoch, dann klappt der Scan schneller.</li>
      </ul>

      <h2>Ich veranstalte selbst und brauche Hilfe</h2>
      <p>
        Antworten rund um Events, Auszahlungen und den Einlass-Modus findest du unter{' '}
        <Link href="/fuer-veranstalter">Für Veranstalter</Link>. Für alles Weitere:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPageShell>
  );
}
