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
 * Vercel (Hosting), Supabase (Login/Konto, Datenbank/Storage),
 * Stripe (Zahlungen + Connect-Auszahlungen), Helius/Solana (Ticket-Echtheit),
 * Resend (E-Mail-Versand), Sentry (Fehlerprotokollierung, nur mit gesetztem
 * DSN; Browser-Fehler gehen direkt vom Gerät an Sentry, also samt IP),
 * eigene einwilligungsbasierte Reichweitenmessung (First-Party-Cookie
 * passly_cid, Speicherung in Supabase). Wird ein Dienst ergänzt oder
 * entfernt, MUSS diese Seite angepasst werden.
 *
 * Ziffer 9 ist zugleich die Gast-Seite des AVV (/avv): alles, was der
 * Veranstalter über seine Gäste sieht (E-Mail, Einlass-Stand, Export,
 * Nachrichten), steht dort. Wer dem Veranstalter ein neues Datum zeigt,
 * ergänzt es hier UND in Anlage 1 des AVV.
 *
 * VOR GO-LIVE: mit allen genannten Anbietern
 * Auftragsverarbeitungsverträge (AVV/DPA) abschließen, bei Vercel, Supabase,
 * Stripe, Resend und Sentry im Dashboard bzw. in den Terms verfügbar.
 *
 * HELIUS ist der offene Fall (geprüft 08.09.2026): weder Terms of Service noch
 * Privacy Policy nennen einen AVV, Art. 28 DSGVO oder eine Auftragsverarbeiter-
 * Rolle; Standardvertragsklauseln erwähnen sie nur für ihre eigenen
 * Übermittlungen. Bis das per Support geklärt ist, steht hier bewusst KEIN Satz
 * über einen bestehenden AVV — ein behaupteter Vertrag wäre eine Falschangabe.
 * Stattdessen ist offengelegt, was übermittelt wird, dass es serverseitig
 * geschieht und wie lange Helius es speichert.
 */

export default function DatenschutzPage() {
  return (
    <LegalPageShell title="Datenschutzerklärung" stand="September 2026">

      <p>
        Mit dieser Erklärung informieren wir dich darüber, welche personenbezogenen
        Daten wir beim Besuch und bei der Nutzung von Passly verarbeiten, zu welchen
        Zwecken und auf welcher Rechtsgrundlage das geschieht und welche Rechte dir
        zustehen (Art. 13, 14 DSGVO).
      </p>

      <h2>1. Verantwortlicher</h2>
      <div className="legal-address">
        <strong>Emil Lange</strong><br />
        Vingerstr. 47<br />
        81375 München<br />
        E-Mail: support@getpassly.de
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
        Zahlungsdaten. Der Veranstalter, dessen Ticket du kaufst, erhält die
        Angaben, die er für die Durchführung seiner Veranstaltung braucht (siehe
        Ziffer 9). Wir betreiben kein Werbetracking und verkaufen keine
        Daten; eine pseudonyme Reichweitenmessung findet nur mit deiner
        Einwilligung statt (siehe Ziffer 10).
      </p>

      <h2>3. Hosting und Fehlerprotokollierung (Vercel, Sentry)</h2>
      <p>
        Unsere Website wird bei Vercel Inc., 440 N Barranca Ave #4133, Covina, CA
        91723, USA gehostet; die Anwendung selbst wird in einem Rechenzentrum in
        Irland (EU) ausgeführt. Beim Aufruf der Seite verarbeitet Vercel technisch
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
      <p>
        <strong>Fehlerprotokollierung:</strong> Tritt in der Anwendung ein
        technischer Fehler auf, übermitteln wir eine Fehlermeldung an den Dienst
        Sentry (Functional Software, Inc., 45 Fremont Street, 8th Floor, San
        Francisco, CA 94105, USA). Eine Fehlermeldung enthält die Art des
        Fehlers, die betroffene Seite, Browser- und Gerätetyp sowie technische
        Kennungen (etwa eine Ticket- oder Bestellnummer), die der Fehler
        betrifft. Tritt der Fehler in deinem Browser auf, wird die Meldung von
        deinem Gerät aus gesendet, sodass Sentry dabei deine IP-Adresse
        verarbeitet. Wir übermitteln keine E-Mail-Adressen, Namen oder
        Zahlungsdaten und zeichnen keine Sitzungen auf. Fehlermeldungen werden
        spätestens nach 90 Tagen gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse an einem fehlerfreien Betrieb). Mit Sentry
        besteht ein Auftragsverarbeitungsvertrag; die Übermittlung in die USA
        erfolgt auf Grundlage des EU-US Data Privacy Framework bzw. der
        EU-Standardvertragsklauseln.
      </p>

      <h2>4. Konto und Anmeldung</h2>
      <p>
        Die Anmeldung erfolgt ausschließlich per E-Mail-Code, ein Passwort gibt es
        nicht. Verarbeitet werden dabei deine E-Mail-Adresse sowie technische
        Sitzungsdaten. Für die Konto- und Sitzungsverwaltung nutzen wir Supabase
        (siehe Ziffer 5); der Versand des Anmeldecodes läuft über Resend (siehe
        Ziffer 8). Beim ersten Login wird deinem Konto eine eindeutige technische
        Kennung zugeordnet (ein kryptografisches Schlüsselpaar, siehe Ziffer 7),
        über die deine Tickets dir zugeordnet werden. Dieses Schlüsselpaar wird
        von uns aus deiner Konto-Kennung berechnet; gespeichert wird nur die
        daraus abgeleitete öffentliche Kennung, nicht der zugehörige private
        Schlüssel.
      </p>
      <p>
        <strong>Gastbestellung:</strong> Lässt der Veranstalter es zu, kannst du
        ein Ticket auch ohne bestehendes Konto kaufen. Wir speichern dann deine
        E-Mail-Adresse zusammen mit der Bestellung und senden dir einen
        Bestell-Link. Sobald du dich über diesen Link anmeldest, wird die
        Bestellung deinem Konto zugeordnet und das Ticket dort angezeigt.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        <strong>Öffentliches Profil:</strong> Zu deinem Konto gehört eine
        öffentlich abrufbare Profilseite, deren Adresse die technische Kennung aus
        dem ersten Absatz dieser Ziffer enthält. Sie zeigt einen von dir gewählten Anzeigenamen,
        eine optionale Kurzbeschreibung, die Anzahl deiner besuchten
        Veranstaltungen und deine Abzeichen. Solange du keinen Anzeigenamen
        hinterlegst, erscheint dort nur die technische Kennung. Du kannst die Seite
        in den Kontoeinstellungen jederzeit auf privat stellen; sie ist dann nicht
        mehr abrufbar. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
        Interesse an einer teilbaren Sammlung), Widerspruch jederzeit durch
        Umstellen auf privat.
      </p>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Kontos zur
        Vertragserfüllung).
      </p>

      <h2>5. Datenbank und Speicherung (Supabase)</h2>
      <p>
        Konto-, Event-, Ticket- und Kaufdaten speichern wir in einer Datenbank des
        Anbieters Supabase Inc.; dort läuft auch die Anmeldung und Sitzungs&shy;verwaltung
        aus Ziffer 4. Rechenzentrum: Irland (EU, Region eu-west-1).
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
        Solana-Blockchain) ausgestellt wird. In der dezentralen Datenbank selbst
        werden gespeichert: eine pseudonyme technische Kennung deines Kontos (die
        automatisch erzeugte Kennung aus Ziffer 4), die Kennung des Tickets, der
        Zeitpunkt der Ausstellung sowie eine <strong>für alle Passly-Tickets
        identische</strong> Bezeichnung („Passly Ticket“) samt Verweis auf eine
        ebenso für alle identische Beschreibungsdatei.
        <strong>Nicht</strong> gespeichert werden dein Name, deine E-Mail-Adresse,
        Zahlungsdaten, der gezahlte Preis, ob und wann du eingelassen wurdest —
        und seit dem 8. September 2026 auch nicht mehr, um welche Veranstaltung
        es sich handelt. Welches Ticket zu welchem Event gehört, steht
        ausschließlich in unserer eigenen Datenbank.
      </p>
      <p>
        <strong>Abzeichen</strong>, die du für besuchte Veranstaltungen erhältst,
        werden seit dem 8. September 2026 gar nicht mehr in der dezentralen
        Datenbank ausgestellt; sie bestehen nur noch als Eintrag in unserer
        eigenen Datenbank und sind damit vollständig löschbar. Vor diesem Datum
        ausgestellte Abzeichen bleiben dort bestehen.
      </p>
      <p>
        <strong>Verknüpfbarkeit:</strong> Alle deine Tickets tragen dieselbe
        pseudonyme Kennung, und diese Kennung ist unter anderem in deinem
        Ticket-QR-Code enthalten sowie Bestandteil der Adresse deines
        öffentlichen Profils (Ziffer 4). Wer sie kennt, kann über frei
        zugängliche Blockchain-Dienste sehen, <strong>wie viele</strong>
        Passly-Tickets dir gehören — seit dem 8. September 2026 aber nicht mehr,
        zu welchen Veranstaltungen sie gehören. <strong>Für Tickets und
        Abzeichen, die vor diesem Datum ausgestellt wurden, gilt das nicht:</strong>
        dort stehen Veranstaltungsname und ein Verweis auf die zugehörige
        Beschreibungsdatei dauerhaft in der dezentralen Datenbank und lassen sich
        nicht nachträglich entfernen. Wir ordnen die Kennung öffentlich keiner
        Person zu; ohne Kenntnis der Kennung ist ein Rückschluss auf dich für
        Dritte nicht möglich.
      </p>
      <p>
        Wichtig zu wissen: Einträge in dieser dezentralen Datenbank sind
        systembedingt öffentlich einsehbar und können nachträglich nicht verändert
        oder gelöscht werden — auch dann nicht, wenn du dein Passly-Konto löschen
        lässt oder ein Ticket erstattet, zurückgegeben oder storniert wird. Diese
        Einschränkung betrifft nur die oben genannten Angaben in der dezentralen
        Datenbank selbst; die verlinkten Beschreibungsdateien und alle Daten in
        unserer eigenen Datenbank können wir sehr wohl löschen. Ein
        zurückgegebenes oder storniertes Ticket verliert seine Gültigkeit
        ausschließlich in unserer Datenbank; sein Eintrag in der dezentralen
        Datenbank bleibt bestehen.       </p>
      <p>
        Für den technischen Zugriff auf die dezentrale Datenbank nutzen wir den
        Dienst Helius (Helius Blockchain Technologies, Inc., 2093 Philadelphia
        Pike PMB 7808, Claymont, DE 19703, USA). Übermittelt werden dabei die
        pseudonyme Kontokennung und die Ticketkennung, jeweils zum Ausstellen
        eines Tickets und zum Prüfen der Echtheit am Einlass. <strong>Diese
        Abfragen stellt ausschließlich unser Server</strong>, nicht dein Browser
        oder dein Gerät — deine IP-Adresse wird dabei also nicht an Helius
        übermittelt. Nach den Angaben des Anbieters werden solche Abfragen dort
        bis zu 20 Wochen gespeichert. Name, E-Mail-Adresse, Zahlungsdaten und
        Einlassstatus werden nicht übermittelt.
      </p>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Ausstellung und Prüfung des
        Tickets ist Kern der vertraglichen Leistung) sowie Art. 6 Abs. 1 lit. f
        DSGVO (berechtigtes Interesse an fälschungssicheren Tickets).
      </p>

      <h2>8. E-Mail-Versand (Resend)</h2>
      <p>
        Alle E-Mails von Passly versenden wir über den Dienst Resend (Plus Five
        Five, Inc., 2261 Market Street #5039, San Francisco, CA 94114, USA).
        Dabei werden deine E-Mail-Adresse, Betreff und Inhalt der jeweiligen
        Nachricht sowie der Zustellstatus verarbeitet. Wir versenden:
      </p>
      <ul>
        <li>den Anmeldecode (Ziffer 4),</li>
        <li>die Kaufbestätigung mit den Ticket-Links und dem Zahlungsbeleg als PDF sowie, bei einer Gastbestellung, den Bestell-Link,</li>
        <li>auf deine Anforderung das Offline-Ticket als PDF (Ziffer 9),</li>
        <li>Mitteilungen im Namen des Veranstalters zu deinem Event: eine Erinnerung am Vortag, Informationen bei Absage oder Änderung sowie Nachrichten des Veranstalters an seine Gäste (Ziffer 9),</li>
        <li>eine Benachrichtigung, wenn du dich für die Warteliste eines ausverkauften Events eingetragen hast und wieder Plätze frei werden (eine einzige Nachricht je Eintragung),</li>
        <li>nach dem Einlass einen Hinweis, wenn dir genau ein Besuch zu einem Abzeichen in deinem Konto fehlt (Ziffer 4).</li>
      </ul>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO für Anmeldung, Kauf- und
        Ticket-Mails, Mitteilungen des Veranstalters und die Warteliste; Art. 6
        Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Information über den
        Stand deines Kontos) für den Abzeichen-Hinweis, dem du jederzeit per
        E-Mail an die Adresse in Ziffer 1 widersprechen kannst. Mit Resend
        besteht ein Auftragsverarbeitungsvertrag; die Übermittlung in die USA
        erfolgt auf Grundlage der EU-Standardvertragsklauseln.
      </p>

      <h2>9. Einlasskontrolle und Daten für den Veranstalter</h2>
      <p>
        <strong>QR-Scan:</strong> Am Einlass scannt das Team des Veranstalters
        den QR-Code deines Tickets. Dabei wird geprüft, ob das Ticket echt ist,
        dir gehört und noch nicht eingelöst wurde; der Zeitpunkt des Einlasses
        wird gespeichert. Hat der Veranstalter für sein Event den Wiedereinlass
        freigeschaltet, wird jeder Scan mit Zeitpunkt und Richtung (Einlass
        oder Verlassen) protokolliert. Kann das Team dein Ticket nicht scannen,
        kann es dich anhand deiner E-Mail-Adresse oder der Ticketnummer in der
        Gästeliste des Events suchen und manuell einlassen.
      </p>
      <p>
        <strong>Was der Veranstalter sieht:</strong> Der Veranstalter, dessen
        Ticket du kaufst, ist dein Vertragspartner für die Veranstaltung. Er
        erhält für sein Event eine Gästeliste mit deiner E-Mail-Adresse,
        Ticketkategorie, Kaufzeitpunkt, Ticketnummer und Einlass-Stand und kann
        dich über Passly zu diesem Event anschreiben (Ziffer 8). Nutzt er die
        kostenpflichtigen Pro-Funktionen, sieht er zusätzlich eine Übersicht
        seiner Gäste über alle seine Events hinweg (Anzahl der Besuche, Umsatz
        bei ihm, daraus abgeleitete Gruppen wie „Stammgast&ldquo;), kann diese
        exportieren und Nachrichten an einzelne Gruppen senden. Für seine
        Abrechnung sieht er
        außerdem den Bruttobetrag, die Servicegebühr, seinen Nettoerlös, die
        Zahlungsart (z.&nbsp;B. Karte oder PayPal) und den Erstattungsstatus,
        nicht aber Karten- oder Kontodaten. Ein Veranstalter sieht ausschließlich
        die Gäste seiner eigenen Events. Für diese Verarbeitung ist der
        Veranstalter Verantwortlicher; Passly verarbeitet die Daten in seinem
        Auftrag (Art. 28 DSGVO). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
        (Durchführung des Veranstaltungsvertrags).
      </p>
      <p>
        <strong>Offline-Ticket:</strong> Auf Wunsch erzeugen wir zu deinem Ticket
        ein Offline-Ticket als PDF für Veranstaltungsorte ohne Netzverbindung.
        Dafür gibst du Vor- und Nachname sowie Geburtsdatum an. Diese Angaben
        werden in den signierten QR-Code des PDF eingebettet und dir per E-Mail
        zugesandt; in unserer Datenbank speichern wir sie nicht, sondern nur den
        Zeitpunkt, zu dem ein Offline-Ticket ausgestellt wurde. Beim Scan des
        Offline-Tickets werden Name und Geburtsdatum aus dem Code auf dem Gerät
        des Einlassteams angezeigt, damit es sie mit deinem Ausweis abgleichen
        kann. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>10. Cookies und lokale Speicherung</h2>
      <p>
        <strong>Technisch notwendige Cookies:</strong> Passly verwendet Cookies
        und Einträge im lokalen Speicher deines Browsers, um deine Anmeldung
        aufrechtzuerhalten (Sitzungsdaten deiner Anmeldung), den
        Bezahlvorgang bei Stripe abzusichern, deine Cookie-Entscheidung
        (<code>passly_consent</code>, 12 Monate) und deine gewählte Sprache
        (<code>passly_lang</code>, 12 Monate) zu speichern. Diese sind für den
        Betrieb bzw. für die von dir ausdrücklich gewünschte Funktion
        erforderlich; eine Einwilligung ist dafür nicht nötig (§ 25 Abs. 2
        Nr. 2 TDDDG).
      </p>
      <p>
        <strong>Statistik-Cookie (nur mit Einwilligung):</strong> Wenn du im
        Cookie-Banner „Alle akzeptieren“ wählst, setzen wir zusätzlich einen
        eigenen Statistik-Cookie (<code>passly_cid</code>, Speicherdauer 12
        Monate). Er enthält eine zufällig erzeugte, pseudonyme Kennung, über die
        wir aufgerufene Seiten, Zeitpunkt, die verweisende Seite (Referrer, um
        zu erkennen, über welchen Kanal ein Shop aufgerufen wurde) und
        grundlegende Nutzungsschritte (z.&nbsp;B. Auswahl eines Tickets, Start
        eines Ticketkaufs) in unserer eigenen Datenbank
        (Supabase, siehe Ziffer 5) auswerten. Veranstalter sehen daraus
        ausschließlich zusammengefasste Statistiken, nie einzelne Verläufe.
        Es findet keine Weitergabe an
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
        (für unseren Sitz: Bayerisches Landesamt für Datenschutzaufsicht, Promenade 18,
        91522 Ansbach).
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
