import type { Metadata } from 'next';
import { LegalPageShell } from '@/app/components/LegalPageShell';
import { ConsentSettingsButton } from '@/app/components/ConsentBanner';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung · Passly',
  description: 'Informationen zur Verarbeitung personenbezogener Daten gemäß Art. 13, 14 DSGVO.',
  robots: { index: false },
};

/*
 * Datenschutzerklärung nach Art. 13/14 DSGVO.
 *
 * Diese Erklärung ist auf den tatsächlichen Stack abgestimmt:
 * Vercel (Hosting), Privy (Login/Konto), Supabase (Datenbank/Storage),
 * Stripe (Zahlungen + Connect-Auszahlungen), Helius/Solana (Ticket-Echtheit),
 * Resend (E-Mail-Versand), eigene einwilligungsbasierte Reichweitenmessung
 * (First-Party-Cookie passly_cid, Speicherung in Supabase). Wird ein Dienst
 * ergänzt oder entfernt, MUSS diese Seite angepasst werden.
 *
 * VOR GO-LIVE: "PLATZHALTER" ausfüllen und mit allen genannten Anbietern
 * Auftragsverarbeitungsverträge (AVV/DPA) abschließen, bei Vercel, Supabase,
 * Stripe und Resend im Dashboard verfügbar; bei Privy Teil der Terms (prüfen).
 */

export default function DatenschutzPage() {
  return (
    <LegalPageShell title="Datenschutzerklärung" stand="Juli 2026">

      <p>
        Mit dieser Erklärung informieren wir dich darüber, welche personenbezogenen
        Daten wir beim Besuch und bei der Nutzung von Passly verarbeiten, zu welchen
        Zwecken und auf welcher Rechtsgrundlage das geschieht und welche Rechte dir
        zustehen (Art. 13, 14 DSGVO).
      </p>

      <h2>1. Verantwortlicher</h2>
      <div className="legal-address">
        <strong>[PLATZHALTER: Vor- und Nachname]</strong><br />
        [PLATZHALTER: Straße und Hausnummer]<br />
        [PLATZHALTER: PLZ und Ort]<br />
        E-Mail: [PLATZHALTER: kontakt@getpassly.de]
      </div>
      <p>
        Ein Datenschutzbeauftragter ist nicht bestellt, da die gesetzlichen
        Voraussetzungen für eine Benennungspflicht (Art. 37 DSGVO, § 38 BDSG)
        nicht vorliegen.
      </p>

      <h2>2. Überblick: Was Passly ist</h2>
      <p>
        Passly ist eine Plattform, über die Veranstalter fälschungssichere digitale
        Tickets verkaufen und Gäste diese kaufen, aufbewahren und am Einlass
        vorzeigen. Dafür verarbeiten wir vor allem: deine E-Mail-Adresse (Konto),
        Ticket- und Kaufdaten sowie, abgewickelt durch unseren Zahlungsdienstleister,
        Zahlungsdaten. Wir betreiben kein Werbetracking und verkaufen keine
        Daten; eine anonyme Reichweitenmessung findet nur mit deiner
        Einwilligung statt (siehe Ziffer 10).
      </p>

      <h2>3. Hosting (Vercel)</h2>
      <p>
        Unsere Website wird bei Vercel Inc., 440 N Barranca Ave #4133, Covina, CA
        91723, USA gehostet. Beim Aufruf der Seite verarbeitet Vercel technisch
        notwendige Verbindungsdaten (IP-Adresse, Datum und Uhrzeit des Zugriffs,
        aufgerufene Seite, Browser- und Gerätetyp) in Server-Logs. Diese Daten sind
        für die Auslieferung der Website und die Abwehr von Angriffen erforderlich.
      </p>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am
        sicheren und stabilen Betrieb). Mit Vercel besteht ein
        Auftragsverarbeitungsvertrag; die Übermittlung in die USA erfolgt auf
        Grundlage des EU-US Data Privacy Framework bzw. der
        EU-Standardvertragsklauseln.
      </p>

      <h2>4. Konto und Anmeldung (Privy)</h2>
      <p>
        Für dein Passly-Konto nutzen wir den Dienst Privy (Horkos, Inc., New York,
        USA). Die Anmeldung erfolgt ausschließlich per E-Mail-Code, ein Passwort
        gibt es nicht. Verarbeitet werden dabei deine E-Mail-Adresse sowie
        technische Sitzungsdaten. Beim ersten Login wird deinem Konto automatisch
        eine eindeutige technische Kennung zugeordnet (ein kryptografisches
        Schlüsselpaar, siehe Ziffer 7), über die deine Tickets dir zugeordnet
        werden.
      </p>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Kontos zur
        Vertragserfüllung). Die Übermittlung in die USA erfolgt auf Grundlage der
        EU-Standardvertragsklauseln.
      </p>

      <h2>5. Datenbank und Speicherung (Supabase)</h2>
      <p>
        Konto-, Event-, Ticket- und Kaufdaten speichern wir in einer Datenbank des
        Anbieters Supabase Inc. (Region des Rechenzentrums:
        [PLATZHALTER: z. B. Frankfurt, EU, im Supabase-Dashboard nachsehen]).
        Eventbilder und Ticket-Beschreibungsdaten liegen in einem öffentlich
        abrufbaren Speicher, enthalten aber keine personenbezogenen Daten der
        Käufer.
      </p>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Mit Supabase besteht ein
        Auftragsverarbeitungsvertrag.
      </p>

      <h2>6. Bezahlung (Stripe)</h2>
      <p>
        Die Bezahlung wickelt die Stripe Payments Europe, Ltd., 1 Grand Canal Street
        Lower, Grand Canal Dock, Dublin, Irland ab. Beim Kauf wirst du auf eine
        Bezahlseite von Stripe weitergeleitet; deine Kartendaten werden
        ausschließlich dort eingegeben und von uns zu keinem Zeitpunkt gespeichert.
        Wir erhalten von Stripe eine Bestätigung der Zahlung, deine E-Mail-Adresse
        und den Zahlbetrag. Stripe verarbeitet Zahlungsdaten teilweise in eigener
        Verantwortung (etwa zur Betrugsprävention und zur Erfüllung
        geldwäscherechtlicher Pflichten); Informationen dazu findest du in der
        Datenschutzerklärung von Stripe
        (<a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer">stripe.com/de/privacy</a>).
      </p>
      <p>
        <strong>Für Veranstalter:</strong> Auszahlungen erfolgen über Stripe
        Connect. Dabei erhebt Stripe zur gesetzlich vorgeschriebenen
        Identitätsprüfung (Geldwäschegesetz, Know-Your-Customer) weitere Daten wie
        Name, Anschrift, Geburtsdatum und Bankverbindung. Diese Prüfung führt
        Stripe als eigenständig Verantwortlicher durch.
      </p>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Zahlungsabwicklung) und
        Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflichten).
      </p>

      <h2>7. Ticket-Echtheit und dezentrale Speicherung</h2>
      <p>
        Die Fälschungssicherheit der Tickets beruht darauf, dass jedes Ticket als
        einzigartiger Eintrag in einer öffentlichen, dezentralen Datenbank (der
        Solana-Blockchain) ausgestellt wird. Dort gespeichert werden: eine
        pseudonyme technische Kennung deines Kontos (die automatisch erzeugte
        Kennung aus Ziffer 4), die Ticket-Kennung sowie allgemeine Eventdaten
        (Name, Datum). <strong>Nicht</strong> gespeichert werden dein Name, deine
        E-Mail-Adresse oder Zahlungsdaten.
      </p>
      <p>
        Wichtig zu wissen: Einträge in dieser dezentralen Datenbank sind
        systembedingt öffentlich einsehbar und können nachträglich nicht verändert
        oder gelöscht werden. Ein Rückschluss von der pseudonymen Kennung auf deine
        Person ist Dritten ohne Zusatzwissen nicht möglich. Zur technischen
        Anbindung nutzen wir den Dienst Helius (Helius Labs, Inc., USA), der dabei
        die pseudonymen Ticket- und Kontokennungen verarbeitet.
      </p>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Ausstellung und Prüfung des
        Tickets ist Kern der vertraglichen Leistung) sowie Art. 6 Abs. 1 lit. f
        DSGVO (berechtigtes Interesse an fälschungssicheren Tickets).
      </p>

      <h2>8. E-Mail-Versand (Resend)</h2>
      <p>
        Kaufbestätigungen und Ticket-Links versenden wir über den Dienst Resend
        (Plus Five Five, Inc., USA). Dabei werden deine E-Mail-Adresse und der
        Inhalt der Bestätigungs-E-Mail verarbeitet. Rechtsgrundlage: Art. 6 Abs. 1
        lit. b DSGVO. Mit Resend besteht ein Auftragsverarbeitungsvertrag; die
        Übermittlung in die USA erfolgt auf Grundlage der
        EU-Standardvertragsklauseln.
      </p>

      <h2>9. Einlasskontrolle (QR-Scan)</h2>
      <p>
        Am Einlass scannt das Team des Veranstalters den QR-Code deines Tickets.
        Dabei wird geprüft, ob das Ticket echt ist, dir gehört und noch nicht
        eingelöst wurde; Zeitpunkt der Einlösung wird gespeichert. Der Veranstalter
        sieht dabei den Ticket- und Einlösestatus seines Events, nicht aber deine
        Zahlungsdaten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>10. Cookies und lokale Speicherung</h2>
      <p>
        <strong>Technisch notwendige Cookies:</strong> Passly verwendet Cookies
        und Einträge im lokalen Speicher deines Browsers, um deine Anmeldung
        aufrechtzuerhalten (Sitzungsdaten unseres Login-Dienstes Privy), den
        Bezahlvorgang bei Stripe abzusichern und deine Cookie-Entscheidung zu
        speichern. Diese sind für den Betrieb erforderlich; eine Einwilligung
        ist dafür nicht nötig (§ 25 Abs. 2 Nr. 2 TDDDG).
      </p>
      <p>
        <strong>Statistik-Cookie (nur mit Einwilligung):</strong> Wenn du im
        Cookie-Banner „Alle akzeptieren“ wählst, setzen wir zusätzlich einen
        eigenen Statistik-Cookie (<code>passly_cid</code>, Speicherdauer 12
        Monate). Er enthält eine zufällig erzeugte, pseudonyme Kennung, über die
        wir aufgerufene Seiten, Zeitpunkt und grundlegende Nutzungsschritte
        (z.&nbsp;B. Start eines Ticketkaufs) in unserer eigenen Datenbank
        (Supabase, siehe Ziffer 5) auswerten. Es findet keine Weitergabe an
        Dritte und kein Werbetracking statt; IP-Adressen speichern wir dabei
        nicht. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1
        TDDDG (Einwilligung).
      </p>
      <p>
        Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft
        widerrufen, dabei wird der Statistik-Cookie sofort gelöscht:
      </p>
      <p>
        <ConsentSettingsButton />
      </p>

      <h2>11. Speicherdauer</h2>
      <p>
        Wir speichern personenbezogene Daten nur so lange, wie es für die genannten
        Zwecke erforderlich ist. Kauf- und Abrechnungsdaten unterliegen den
        gesetzlichen handels- und steuerrechtlichen Aufbewahrungsfristen (derzeit
        bis zu zehn Jahre, §&nbsp;147 AO, §&nbsp;257 HGB) und werden danach
        gelöscht. Dein Konto kannst du jederzeit löschen lassen (Kontakt siehe
        Ziffer 1); die Einschränkung für dezentrale Einträge aus Ziffer 7 bleibt
        dabei bestehen.
      </p>

      <h2>12. Deine Rechte</h2>
      <p>Du hast gegenüber uns folgende Rechte hinsichtlich deiner Daten:</p>
      <ul>
        <li>Auskunft über die verarbeiteten Daten (Art. 15 DSGVO),</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO),</li>
        <li>Löschung (Art. 17 DSGVO), mit der technischen Einschränkung aus Ziffer 7,</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO),</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO),</li>
        <li>Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO).</li>
      </ul>
      <p>
        Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu
        beschweren (Art. 77 DSGVO), etwa bei der für deinen Wohnort oder unseren
        Sitz zuständigen Landesdatenschutzbehörde
        ([PLATZHALTER: zuständige Behörde des Bundeslands, z. B. „Landesbeauftragte
        für Datenschutz und Informationsfreiheit Nordrhein-Westfalen“]).
      </p>

      <h2>13. Keine automatisierte Entscheidungsfindung</h2>
      <p>
        Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne
        des Art. 22 DSGVO findet bei uns nicht statt. (Die Betrugsprävention im
        Bezahlvorgang verantwortet Stripe, siehe Ziffer 6.)
      </p>

      <h2>14. Änderungen dieser Erklärung</h2>
      <p>
        Wir passen diese Datenschutzerklärung an, wenn sich unsere Dienste oder die
        Rechtslage ändern. Es gilt die jeweils hier veröffentlichte Fassung.
      </p>

    </LegalPageShell>
  );
}
