import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/app/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Auftragsverarbeitungsvertrag · Passly',
  description: 'Vereinbarung zur Auftragsverarbeitung nach Art. 28 DSGVO zwischen Veranstaltern und Passly.',
  robots: { index: false },
};

/*
 * Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO, Passly als
 * Auftragsverarbeiter des Veranstalters.
 *
 * Rollenmodell, das dem technischen Aufbau entspricht:
 * - Fuer den TICKETKAUF (Konto, Zahlung, Ticketausstellung, eigene Mails an
 *   den Gast) ist Passly selbst Verantwortlicher; das regelt /datenschutz.
 * - Fuer alles, was Passly dem Veranstalter ueber SEINE Gaeste bereitstellt
 *   (Gaesteliste mit E-Mail, Einlass-Stand, Export, Erinnerungs- und
 *   Kampagnenmails im Namen des Veranstalters, Tuerscans, Rueckerstattungen),
 *   verarbeitet Passly im Auftrag des Veranstalters. Dafuer ist dieser Vertrag.
 *
 * Er wird nicht unterschrieben, sondern durch das Anlegen des
 * Veranstalter-Kontos bzw. des ersten Events angenommen (Art. 28 Abs. 9 DSGVO:
 * elektronisches Format genuegt). Fuer Veranstalter, die eine unterzeichnete
 * Fassung brauchen, steht die Kontaktadresse in Ziffer 13.
 *
 * ENTWURF. Ersetzt keine anwaltliche Pruefung; insbesondere die Rollenabgrenzung
 * in Ziffer 1, die Unterauftragsverarbeiter in Anlage 2 (Drittlandtransfer
 * Vercel/Stripe) und die TOM in Anlage 3 vor dem ersten gewerblichen
 * Veranstalter freigeben lassen. VOR GO-LIVE: "PLATZHALTER" ausfuellen.
 */

export default function AvvPage() {
  return (
    <LegalPageShell title="Vereinbarung zur Auftragsverarbeitung" stand="September 2026">

      <p>
        zwischen dem Veranstalter, der ein Veranstalter-Konto bei Passly führt
        (nachfolgend „<strong>Verantwortlicher</strong>“), und [PLATZHALTER: Vor- und
        Nachname, Anschrift], Betreiber der Plattform Passly, getpassly.de
        (nachfolgend „<strong>Auftragsverarbeiter</strong>“ oder „Passly“),
        gemeinsam „die Parteien“.
      </p>
      <p>
        Diese Vereinbarung konkretisiert die datenschutzrechtlichen Pflichten der
        Parteien aus dem Nutzungsverhältnis nach den{' '}
        <Link href="/agb">Allgemeinen Geschäftsbedingungen</Link> (Teil B) und wird
        Bestandteil dieses Vertrags. Sie wird mit dem Anlegen des Veranstalter-Kontos
        in elektronischer Form geschlossen (Art. 28 Abs. 9 DSGVO).
      </p>

      <h2>1. Gegenstand, Rollen und Dauer</h2>
      <p>
        (1) Passly stellt dem Verantwortlichen eine Plattform für Vorverkauf,
        Einlass und Auswertung seiner Veranstaltungen bereit. Dabei verarbeitet
        Passly personenbezogene Daten der Gäste des Verantwortlichen in dessen
        Auftrag, soweit die Verarbeitung ausschließlich der Durchführung der
        Veranstaltung des Verantwortlichen dient (Anlage 1).
      </p>
      <p>
        (2) <strong>Nicht Gegenstand dieser Vereinbarung</strong> sind Verarbeitungen,
        für die Passly selbst Verantwortlicher ist: die Führung des Passly-Kontos des
        Gastes, die Zahlungsabwicklung einschließlich Erstattungen über den
        Zahlungsdienstleister, die Ausstellung und Echtheitsprüfung des Tickets,
        die eigene Kaufbestätigung an den Gast, die Betrugs- und Missbrauchsabwehr
        sowie die einwilligungsbasierte Reichweitenmessung. Diese Verarbeitungen
        richten sich nach der <Link href="/datenschutz">Datenschutzerklärung</Link>
        von Passly. Soweit dieselben Daten (etwa die E-Mail-Adresse eines Gastes)
        beiden Zwecken dienen, verarbeitet jede Partei sie für ihren Zweck in eigener
        Verantwortung.
      </p>
      <p>
        (3) Die Vereinbarung gilt für die Dauer des Nutzungsverhältnisses. Sie endet
        mit der Löschung des Veranstalter-Kontos, jedoch nicht vor Abschluss der
        letzten über Passly abgewickelten Veranstaltung des Verantwortlichen und dem
        Ablauf der Aufbewahrungsfristen nach Ziffer 10.
      </p>

      <h2>2. Weisungen</h2>
      <p>
        (1) Passly verarbeitet die Daten ausschließlich auf dokumentierte Weisung
        des Verantwortlichen. Als Weisungen gelten diese Vereinbarung, die AGB und
        die Nutzung der Plattformfunktionen durch den Verantwortlichen (etwa das
        Anlegen eines Events, das Erstellen eines Türlinks, das Auslösen einer
        Erinnerungs- oder Kampagnenmail, der Export der Gästeliste oder die
        Erstattung eines Tickets).
      </p>
      <p>
        (2) Weisungen, die über die Plattformfunktionen hinausgehen, sind in Textform
        an die Adresse in Ziffer 13 zu richten. Passly kann solche Weisungen ablehnen,
        wenn sie technisch nicht umsetzbar sind oder Passly zu unverhältnismäßigem
        Aufwand zwingen würden; Passly teilt dies unverzüglich mit.
      </p>
      <p>
        (3) Hält Passly eine Weisung für rechtswidrig, informiert Passly den
        Verantwortlichen unverzüglich und ist berechtigt, die Ausführung bis zur
        Bestätigung oder Änderung der Weisung auszusetzen (Art. 28 Abs. 3 Satz 3
        DSGVO).
      </p>

      <h2>3. Pflichten des Verantwortlichen</h2>
      <p>
        (1) Der Verantwortliche ist für die Rechtmäßigkeit der Verarbeitung
        gegenüber seinen Gästen verantwortlich, insbesondere für die Rechtsgrundlage
        der Erhebung, die Information der Gäste nach Art. 13, 14 DSGVO und die
        Wahrung der Betroffenenrechte.
      </p>
      <p>
        (2) Der Verantwortliche stellt sicher, dass Nachrichten, die er über die
        Plattform an seine Gäste versendet (Erinnerung, Gästeinformation,
        Kampagnen), inhaltlich zulässig sind. Werbliche Nachrichten setzt er nur
        ein, wenn eine dafür ausreichende Rechtsgrundlage besteht (§ 7 UWG, Art. 6
        DSGVO); die Kampagnenfunktion ist ihm bewusst als werbliche Nutzung
        gekennzeichnet.
      </p>
      <p>
        (3) Der Verantwortliche verpflichtet sich, Türlinks und Zugangsdaten nur an
        Personen weiterzugeben, die für ihn am Einlass tätig sind, und diese auf die
        Vertraulichkeit der Gästedaten hinzuweisen. Nicht mehr benötigte Türlinks
        widerruft er in der Plattform.
      </p>

      <h2>4. Vertraulichkeit</h2>
      <p>
        Passly stellt sicher, dass die mit der Verarbeitung befassten Personen zur
        Vertraulichkeit verpflichtet sind oder einer angemessenen gesetzlichen
        Verschwiegenheitspflicht unterliegen, und dass sie die Daten nur auf Weisung
        verarbeiten. Zum Zeitpunkt dieser Vereinbarung ist die einzige mit
        Verarbeitung befasste Person der Betreiber selbst.
      </p>

      <h2>5. Sicherheit der Verarbeitung</h2>
      <p>
        (1) Passly trifft die in Anlage 3 beschriebenen technischen und
        organisatorischen Maßnahmen nach Art. 32 DSGVO und passt sie dem Stand der
        Technik an. Eine Änderung einzelner Maßnahmen ist zulässig, wenn das
        Schutzniveau insgesamt nicht unterschritten wird.
      </p>
      <p>
        (2) Passly unterstützt den Verantwortlichen unter Berücksichtigung der Art
        der Verarbeitung und der Passly zur Verfügung stehenden Informationen bei der
        Einhaltung der Pflichten aus Art. 32 bis 36 DSGVO.
      </p>

      <h2>6. Unterauftragsverarbeiter</h2>
      <p>
        (1) Der Verantwortliche erteilt eine allgemeine Genehmigung zum Einsatz von
        Unterauftragsverarbeitern. Die zum Zeitpunkt dieser Vereinbarung eingesetzten
        Unterauftragsverarbeiter sind in Anlage 2 aufgeführt.
      </p>
      <p>
        (2) Passly informiert den Verantwortlichen über beabsichtigte Änderungen
        (Hinzufügen oder Ersetzen eines Unterauftragsverarbeiters) mindestens 30 Tage
        vor Wirksamwerden per E-Mail an die im Veranstalter-Konto hinterlegte
        Adresse. Der Verantwortliche kann der Änderung innerhalb dieser Frist aus
        wichtigem datenschutzrechtlichem Grund widersprechen. Können sich die
        Parteien nicht einigen, ist jede Partei berechtigt, das Nutzungsverhältnis mit
        Wirkung zum Zeitpunkt der Änderung zu kündigen; bereits verkaufte Tickets
        werden noch abgewickelt.
      </p>
      <p>
        (3) Passly verpflichtet Unterauftragsverarbeiter durch Vertrag zu im
        Wesentlichen denselben Datenschutzpflichten, wie sie in dieser Vereinbarung
        festgelegt sind. Kommt ein Unterauftragsverarbeiter seinen Pflichten nicht
        nach, haftet Passly dem Verantwortlichen gegenüber für dessen Erfüllung.
      </p>
      <p>
        (4) Nicht als Unterauftragsverarbeiter gelten Dienste, die Passly als eigene
        Verantwortliche in Anspruch nimmt (insbesondere der Zahlungsdienstleister für
        die Zahlungsabwicklung, Ziffer 1 Abs. 2).
      </p>

      <h2>7. Drittlandtransfer</h2>
      <p>
        Die Verarbeitung findet grundsätzlich in der Europäischen Union statt
        (Anlage 2). Soweit ein Unterauftragsverarbeiter Daten in einem Drittland
        verarbeitet oder von dort auf sie zugreifen kann, stützt sich die
        Übermittlung auf einen Angemessenheitsbeschluss der Europäischen Kommission
        (insbesondere das EU-U.S. Data Privacy Framework) oder auf
        Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO, die Passly mit
        dem Unterauftragsverarbeiter abgeschlossen hat.
      </p>

      <h2>8. Betroffenenrechte</h2>
      <p>
        (1) Macht eine betroffene Person Rechte nach Art. 15 bis 22 DSGVO gegenüber
        dem Verantwortlichen geltend, unterstützt Passly ihn mit geeigneten
        technischen und organisatorischen Maßnahmen. Auskunft, Berichtigung und
        Löschung von Ticketdaten sowie der Export der Gästeliste sind über die
        Plattform selbst möglich; darüber hinausgehende Anfragen richtet der
        Verantwortliche an die Adresse in Ziffer 13.
      </p>
      <p>
        (2) Wendet sich eine betroffene Person unmittelbar an Passly, leitet Passly
        die Anfrage unverzüglich an den Verantwortlichen weiter, soweit sie die
        Verarbeitung im Auftrag betrifft, und beantwortet sie nicht ohne dessen
        Weisung. Betrifft die Anfrage die eigene Verantwortlichkeit von Passly
        (Ziffer 1 Abs. 2), beantwortet Passly sie selbst.
      </p>
      <p>
        (3) Passly weist darauf hin, dass ein einmal ausgestelltes Ticket als
        fälschungssicherer Nachweis in einem öffentlichen Register gespeichert wird.
        Dieser Eintrag enthält keine Klarnamen, keine E-Mail-Adressen und keine
        Veranstaltungsbezeichnung, sondern eine pseudonyme Kennung des Kontos und
        einen einheitlichen Ticketnamen. Er kann nicht gelöscht, aber durch Löschung
        des Kontos von der Person entkoppelt werden. Der Verantwortliche informiert
        seine Gäste hierüber, soweit er selbst Informationspflichten erfüllt; Passly
        tut dies in seiner Datenschutzerklärung.
      </p>

      <h2>9. Meldung von Verletzungen des Schutzes personenbezogener Daten</h2>
      <p>
        (1) Passly meldet dem Verantwortlichen eine Verletzung des Schutzes
        personenbezogener Daten, die Daten im Auftrag betrifft, unverzüglich nach
        Bekanntwerden, spätestens innerhalb von 48 Stunden, per E-Mail an die im
        Veranstalter-Konto hinterlegte Adresse. Die Meldung enthält, soweit bekannt,
        die in Art. 33 Abs. 3 DSGVO genannten Informationen und wird bei
        Nachreichung ergänzt.
      </p>
      <p>
        (2) Passly unterstützt den Verantwortlichen bei der Erfüllung seiner Melde-
        und Benachrichtigungspflichten nach Art. 33 und 34 DSGVO. Die Meldung an die
        Aufsichtsbehörde und die Benachrichtigung der Betroffenen obliegen dem
        Verantwortlichen.
      </p>

      <h2>10. Löschung und Rückgabe</h2>
      <p>
        (1) Nach Ende der Verarbeitung im Auftrag, spätestens mit Löschung des
        Veranstalter-Kontos, löscht Passly die im Auftrag verarbeiteten Daten oder
        gibt sie zurück, nach Wahl des Verantwortlichen. Der Verantwortliche kann
        die Gästeliste jederzeit selbst über die Plattform exportieren.
      </p>
      <p>
        (2) Ausgenommen von der Löschung sind Daten, die Passly aufgrund
        gesetzlicher Aufbewahrungspflichten (insbesondere handels- und
        steuerrechtlich, § 147 AO, § 257 HGB) oder zur Abwicklung noch offener
        Zahlungen, Erstattungen oder Rückbelastungen benötigt; diese werden nach
        Ablauf der Frist gelöscht und bis dahin in der Verarbeitung eingeschränkt.
      </p>
      <p>
        (3) Daten, die Passly als eigener Verantwortlicher verarbeitet
        (insbesondere das Passly-Konto des Gastes und seine Tickets), bleiben von
        einer Löschung durch den Verantwortlichen unberührt; sie unterliegen der
        Datenschutzerklärung von Passly und den Rechten des Gastes.
      </p>

      <h2>11. Nachweise und Kontrollen</h2>
      <p>
        (1) Passly stellt dem Verantwortlichen alle erforderlichen Informationen zum
        Nachweis der Einhaltung dieser Vereinbarung zur Verfügung. Dazu gehören
        insbesondere die Beschreibung der technischen und organisatorischen Maßnahmen
        (Anlage 3), die Liste der Unterauftragsverarbeiter (Anlage 2) sowie, soweit
        vorhanden, Zertifikate und Prüfberichte der Unterauftragsverarbeiter.
      </p>
      <p>
        (2) Der Verantwortliche kann darüber hinaus einmal jährlich sowie bei
        konkretem Anlass eine Überprüfung verlangen. Diese erfolgt vorrangig durch
        Beantwortung schriftlicher Fragen und Vorlage von Unterlagen. Eine Kontrolle
        vor Ort ist nach vorheriger Abstimmung während der üblichen Geschäftszeiten
        möglich und hat den laufenden Betrieb und Geschäftsgeheimnisse zu wahren.
        Passly kann für Kontrollen, die über die jährliche Überprüfung hinausgehen
        und nicht durch eine Pflichtverletzung von Passly veranlasst sind, eine
        angemessene Vergütung verlangen.
      </p>

      <h2>12. Haftung</h2>
      <p>
        Die Haftung der Parteien richtet sich nach Art. 82 DSGVO und den Regelungen
        der AGB. Der Verantwortliche stellt Passly von Ansprüchen frei, die auf einer
        von ihm zu verantwortenden Rechtswidrigkeit der Verarbeitung beruhen,
        insbesondere auf fehlender Rechtsgrundlage für von ihm veranlasste
        Nachrichten an Gäste.
      </p>

      <h2>13. Kontakt und Schlussbestimmungen</h2>
      <p>
        (1) Ansprechpartner für Datenschutzfragen bei Passly: [PLATZHALTER: Vor- und
        Nachname], E-Mail: [PLATZHALTER: datenschutz@getpassly.de]. Ein
        Datenschutzbeauftragter ist nach § 38 BDSG derzeit nicht zu benennen.
      </p>
      <p>
        (2) Benötigt der Verantwortliche eine unterzeichnete Fassung dieser
        Vereinbarung, übersendet Passly sie auf Anfrage an die Adresse in Abs. 1.
      </p>
      <p>
        (3) Änderungen dieser Vereinbarung bedürfen der Textform. Bei Widersprüchen
        zwischen dieser Vereinbarung und den AGB gehen die Regelungen dieser
        Vereinbarung vor, soweit es um die Verarbeitung personenbezogener Daten geht.
        Es gilt deutsches Recht.
      </p>
      <p>
        (4) Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der
        übrigen unberührt. Die Parteien werden eine unwirksame Bestimmung durch eine
        wirksame ersetzen, die dem wirtschaftlichen und datenschutzrechtlichen Zweck
        am nächsten kommt.
      </p>

      <h2>Anlage 1: Gegenstand der Verarbeitung</h2>
      <p><strong>Art und Zweck der Verarbeitung</strong></p>
      <ul>
        <li>Bereitstellung einer Gästeliste je Veranstaltung mit Einlass-Stand, Kaufzeitpunkt und Ticketkategorie, einschließlich Suche und Export (CSV).</li>
        <li>Einlasskontrolle: Prüfung und Entwertung von Tickets am Einlass durch den Verantwortlichen oder von ihm beauftragte Personen (Türlinks), einschließlich manueller Suche nach Gästen und Wiedereinlass-Protokoll, sofern aktiviert.</li>
        <li>Versand von Nachrichten im Namen des Verantwortlichen an seine Gäste: Erinnerung am Vortag, Absage- oder Änderungsinformationen, sowie bei Nutzung der Pro-Funktionen Nachrichten an alle Ticketinhaber und Kampagnen an Gästesegmente.</li>
        <li>Rückerstattung einzelner Tickets und Absage von Veranstaltungen auf Veranlassung des Verantwortlichen.</li>
        <li>Verkauf an der Abendkasse durch den Verantwortlichen mit optionaler Erfassung der E-Mail-Adresse des Gastes.</li>
        <li>Auswertungen für den Verantwortlichen (Verkaufs- und Einlasszahlen, bei Pro-Funktionen zusätzlich Kundensegmente, Wiederkehrer und Treueprogramme); Auswertungen über mehrere Veranstalter hinweg erhält der Verantwortliche nur aggregiert und ohne Rückführbarkeit auf Personen.</li>
      </ul>
      <p><strong>Kategorien betroffener Personen</strong></p>
      <ul>
        <li>Gäste (Ticketkäufer und Ticketinhaber) der Veranstaltungen des Verantwortlichen,</li>
        <li>Personen, die sich für eine Warteliste des Verantwortlichen eingetragen haben,</li>
        <li>vom Verantwortlichen am Einlass eingesetzte Personen, soweit ihre Nutzung eines Türlinks protokolliert wird.</li>
      </ul>
      <p><strong>Kategorien personenbezogener Daten</strong></p>
      <ul>
        <li>E-Mail-Adresse des Gastes, Sprache,</li>
        <li>Ticketdaten: Veranstaltung, Kategorie, Kaufzeitpunkt, Ticketkennung, Status (gültig, eingelöst, storniert, zurückgegeben), Einlasszeitpunkte und Richtung (bei Wiedereinlass),</li>
        <li>pseudonyme Kontokennung des Gastes (technischer Schlüssel des Passly-Kontos),</li>
        <li>Zahlungsbezogene Angaben in dem Umfang, der dem Verantwortlichen für Auszahlung und Buchhaltung angezeigt wird: Bruttobetrag, Servicegebühr, Nettobetrag, Zahlungsart, Erstattungsstatus; keine Karten- oder Kontodaten,</li>
        <li>bei Treueprogrammen: Anzahl besuchter Veranstaltungen und eingelöste Vorteile,</li>
        <li>bei Kampagnen: Segmentzugehörigkeit (z.&nbsp;B. Stammgast) als abgeleitetes Merkmal.</li>
      </ul>
      <p>
        Nicht im Auftrag verarbeitet werden Name und Geburtsdatum, die ein Gast für
        ein Offline-Ticket angibt: sie werden ausschließlich in den signierten Code
        des Tickets eingebettet und von Passly nicht gespeichert.
      </p>
      <p><strong>Besondere Kategorien (Art. 9 DSGVO)</strong>: keine. Der Verantwortliche verpflichtet sich, keine solchen Daten in Eventbeschreibungen, Nachrichten oder Freitextfelder einzubringen.</p>

      <h2>Anlage 2: Unterauftragsverarbeiter</h2>
      <p>Stand: September 2026. Alle Angaben ohne Gewähr für spätere Änderungen der Anbieter; Änderungen werden nach Ziffer 6 mitgeteilt.</p>
      <ul>
        <li>
          <strong>Supabase Inc.</strong>, 970 Toa Payoh North #07-04, Singapur 318992 – Datenbank, Dateispeicher und Anmeldung.
          Verarbeitungsort: Rechenzentrum Irland (AWS, Region eu-west-1). Übermittlungsmechanismus für den Support-Zugriff: Standardvertragsklauseln (Bestandteil des Supabase DPA).
        </li>
        <li>
          <strong>Vercel Inc.</strong>, 440 N Barranca Ave #4133, Covina, CA 91723, USA – Hosting und Ausführung der Anwendung.
          Verarbeitungsort: EU (Region Frankfurt) für die Anwendungsausführung, weltweites Netzwerk für die Auslieferung statischer Inhalte. Übermittlungsmechanismus: EU-U.S. Data Privacy Framework und Standardvertragsklauseln (Vercel DPA).
        </li>
        <li>
          <strong>Resend, Inc.</strong>, 2261 Market Street #5039, San Francisco, CA 94114, USA – Versand von E-Mails an Gäste im Namen des Verantwortlichen.
          Verarbeitet: Empfängeradresse, Betreff, Inhalt, Zustellstatus. Übermittlungsmechanismus: Standardvertragsklauseln (Resend DPA).
        </li>
        <li>
          <strong>Functional Software, Inc. (Sentry)</strong>, 45 Fremont Street, 8th Floor, San Francisco, CA 94105, USA – Fehlerprotokollierung des Betriebs, nur soweit aktiviert.
          Verarbeitet: technische Fehlerdaten, die Ticket- oder Bestellkennungen enthalten können; keine E-Mail-Adressen von Gästen absichtlich. Übermittlungsmechanismus: EU-U.S. Data Privacy Framework und Standardvertragsklauseln.
        </li>
      </ul>
      <p>
        <strong>Kein Unterauftragsverarbeiter im Sinne dieser Vereinbarung</strong>: Stripe Payments Europe, Ltd. (Zahlungsabwicklung, eigene Verantwortlichkeit von Passly bzw. Stripe) sowie Helius Labs (Bereitstellung des öffentlichen Registers für die Ticketechtheit; dorthin gelangen keine Gästedaten, nur die pseudonyme Kontokennung und der einheitliche Ticketname).
      </p>

      <h2>Anlage 3: Technische und organisatorische Maßnahmen</h2>
      <p><strong>Zutritts-, Zugangs- und Zugriffskontrolle</strong></p>
      <ul>
        <li>Der Betrieb läuft vollständig bei den in Anlage 2 genannten Anbietern in zertifizierten Rechenzentren (ISO 27001, SOC 2); Passly betreibt keine eigene Hardware mit Gästedaten.</li>
        <li>Anmeldung für Gäste und Veranstalter ohne Passwort über Einmalcodes an die E-Mail-Adresse; Sitzungen laufen ab und werden serverseitig geprüft.</li>
        <li>Jede Veranstalterfunktion prüft serverseitig, dass die angemeldete Person Inhaber des betroffenen Events ist; Gästedaten eines Veranstalters sind für andere Veranstalter nicht erreichbar.</li>
        <li>Einlasspersonal erhält zeitlich befristete, jederzeit widerrufbare Türlinks, die ausschließlich die Einlassfunktionen eines einzelnen Events freischalten (Prüfen, Suchen, Entwerten, Abendkasse), nicht die Verwaltungsoberfläche.</li>
        <li>Datenbankzugriff ausschließlich über den Anwendungsserver mit dienstinternem Schlüssel; für öffentliche Zugänge ist der Zeilenzugriff auf jede Tabelle beschränkt (Row Level Security), und alle geld- oder kapazitätsrelevanten Datenbankfunktionen sind für öffentliche Rollen gesperrt.</li>
        <li>Administrative Funktionen sind durch ein geheimes Zugangstoken mit Ratenbegrenzung gegen Erraten geschützt.</li>
      </ul>
      <p><strong>Weitergabe- und Transportkontrolle</strong></p>
      <ul>
        <li>Sämtliche Übertragungen sind mit TLS verschlüsselt; HTTP Strict Transport Security ist aktiv.</li>
        <li>Eine Content-Security-Policy und weitere Sicherheitskopfzeilen begrenzen, welche Dienste vom Browser aus angesprochen werden dürfen; die Anwendung darf nicht in fremde Seiten eingebettet werden, mit Ausnahme der dafür vorgesehenen Ticketkarte, die keine Gästedaten enthält.</li>
        <li>E-Mail-Versand erfolgt über einen authentifizierten Dienst mit SPF/DKIM für die Absenderdomain.</li>
      </ul>
      <p><strong>Eingabe- und Auftragskontrolle</strong></p>
      <ul>
        <li>Nachrichten an Gäste werden mit Veranstalter, Event, Zeitpunkt und Empfängerzahl protokolliert; die Kampagnenfunktion erfordert eine zweistufige Bestätigung und ist auf zwei Aussendungen je 24 Stunden begrenzt.</li>
        <li>Erstattungen, Absagen, Einlassvorgänge und Rückgaben werden mit Zeitpunkt und auslösendem Konto gespeichert.</li>
        <li>Zahlungsereignisse des Zahlungsdienstleisters werden nur einmal verarbeitet (Idempotenzprüfung), Geld- und Kapazitätsänderungen laufen in atomaren Datenbankfunktionen.</li>
      </ul>
      <p><strong>Verfügbarkeitskontrolle</strong></p>
      <ul>
        <li>Datenbank mit automatischen Sicherungen durch den Anbieter; die Anwendung ist zustandslos und wird bei jedem Stand neu ausgerollt, ein Rollback auf einen früheren Stand ist jederzeit möglich.</li>
        <li>Einlass funktioniert auch ohne Netzverbindung auf Basis einer lokal zwischengespeicherten Ticketliste; Vorgänge werden bei Rückkehr der Verbindung nachgetragen.</li>
        <li>Betriebsstörungen werden automatisch per E-Mail an den Betreiber gemeldet; Fehlerprotokollierung nach Anlage 2, soweit aktiviert.</li>
      </ul>
      <p><strong>Trennungskontrolle und Datenminimierung</strong></p>
      <ul>
        <li>Jede Gästezeile ist einem Event und dieses einem Veranstalter zugeordnet; jede Abfrage der Verwaltungsoberfläche filtert auf den angemeldeten Veranstalter.</li>
        <li>Die Reichweitenmessung speichert keine E-Mail-Adressen, Konten oder IP-Adressen, sondern nur eine einwilligungsbasierte Zufallskennung; Veranstalter erhalten daraus nur aggregierte Werte.</li>
        <li>Personalisierungsdaten von Offline-Tickets (Name, Geburtsdatum) werden nicht gespeichert, sondern nur in den signierten Ticketcode eingebettet.</li>
        <li>Einträge im öffentlichen Echtheitsregister enthalten weder Klarnamen noch Veranstaltungsbezeichnung.</li>
        <li>Branchenvergleiche für Veranstalter werden erst ab fünf vergleichbaren Veranstaltern angezeigt, sodass keine Einzelwerte ableitbar sind.</li>
      </ul>
      <p><strong>Organisation</strong></p>
      <ul>
        <li>Änderungen an der Anwendung durchlaufen automatisierte Prüfungen (Typprüfung, statische Analyse, Tests der zahlungs- und ticketrelevanten Abläufe) vor jeder Auslieferung.</li>
        <li>Zugangsdaten zu den Diensten aus Anlage 2 werden ausschließlich in der verschlüsselten Konfigurationsverwaltung des Hostinganbieters gehalten, nicht im Quellcode.</li>
        <li>Mit allen Unterauftragsverarbeitern bestehen Auftragsverarbeitungsverträge.</li>
      </ul>

    </LegalPageShell>
  );
}
