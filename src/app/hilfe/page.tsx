import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/app/components/LegalPageShell';
import { JsonLd } from '@/app/components/JsonLd';
import { breadcrumbLd } from '@/lib/structuredData';

export const metadata: Metadata = {
  title: 'Hilfe & Support · Passly',
  alternates: { canonical: '/hilfe' },
  description: 'Antworten auf häufige Fragen zu Tickets, Anmeldung und Rückerstattungen: der Draht zum Passly-Support.',
};

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@getpassly.de';

export default function HilfePage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Hilfe & Support', path: '/hilfe' }])} />
    <LegalPageShell title="Hilfe & Support" stand="17. September 2026">
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
      <p>
        Hast du ohne Konto gekauft, findest du in deiner Bestätigungs-E-Mail einen Bestell-Link.
        Öffne ihn und melde dich an, dann wird die Bestellung deinem Konto zugeordnet und das
        Ticket erscheint unter „Meine Tickets&ldquo;. Vorher lässt sich kein QR-Code anzeigen.
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

      <h2>Ich kann nicht kommen: kann ich mein Ticket weitergeben oder zurückgeben?</h2>
      <p>
        <strong>Weitergeben</strong> geht immer. Öffne dein Ticket unter{' '}
        <Link href="/my-tickets">Meine Tickets</Link> und erstelle dort einen Weitergabe-Link.
        Die Person, die den Link öffnet und sich anmeldet, erhält das Ticket; dein eigener
        Zugriff erlischt dabei. Schicke den Link nur der Person, die das Ticket bekommen soll.
      </p>
      <p>
        <strong>Zurückgeben</strong> geht, wenn der Veranstalter die Rückgabe für sein Event
        freigeschaltet hat; du siehst das direkt beim Ticket. Dein Platz geht dann zurück in den
        Verkauf. Sobald ihn jemand kauft, erhältst du den Ticketpreis abzüglich 10&nbsp;%
        (mindestens 1&nbsp;€) auf dein ursprüngliches Zahlungsmittel zurück; die Servicegebühr
        wird nicht erstattet. Wird der Platz bis zum Veranstaltungstag nicht verkauft, bekommst
        du dein Ticket zurück. Bis dahin kannst du die Rückgabe jederzeit abbrechen. Möglich ist
        das bis zum Tag vor der Veranstaltung und nur für noch nicht eingelöste Tickets.
      </p>
      <p>
        Ist die Rückgabe nicht freigeschaltet, wende dich an den Veranstalter: Er kann ein
        einzelnes Ticket aus seinem Dashboard vollständig erstatten, muss das aber nicht.
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

      <h2>Am Veranstaltungsort gibt es keinen Empfang</h2>
      <p>
        Der QR-Code auf der Ticketseite braucht eine Verbindung, weil er sich jede Minute
        erneuert. Für Orte ohne Netz kannst du zusätzlich ein Offline-Ticket als PDF erzeugen,
        direkt nach dem Kauf auf der Bestätigungsseite oder später auf deiner Ticketseite. Es
        wird auf deinen Namen und dein Geburtsdatum ausgestellt und ist nur zusammen mit deinem
        Ausweis gültig. Erzeuge es am besten zu Hause, bevor du losfährst.
      </p>

      <h2>Ich veranstalte selbst und brauche Hilfe</h2>
      <p>
        Antworten rund um Events, Auszahlungen und den Einlass-Modus findest du unter{' '}
        <Link href="/fuer-veranstalter">Für Veranstalter</Link>. Für alles Weitere:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPageShell>
    </>
  );
}
