import type { Metadata } from 'next';
import { LegalPageShell } from '@/app/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'AGB · Passly',
  description: 'Allgemeine Geschäftsbedingungen für die Nutzung der Passly-Plattform.',
  robots: { index: false },
};

/*
 * AGB im Vermittlermodell: Der Veranstaltungsvertrag kommt zwischen Gast und
 * Veranstalter zustande; Passly vermittelt, wickelt die Zahlung über Stripe ab
 * und stellt das Ticketsystem. Das entspricht dem technischen Aufbau
 * (Separate Charges & Transfers, Veranstalter erhält 100 % des Ticketpreises).
 *
 * Dieser Text ist ein sorgfältiger Entwurf, ERSETZT ABER KEINE anwaltliche
 * Prüfung, insbesondere §§ 3, 8, 9 und Teil B sollten vor Go-Live von einer
 * auf IT-/Vertriebsrecht spezialisierten Kanzlei freigegeben werden.
 * VOR GO-LIVE: "PLATZHALTER" ausfüllen.
 */

export default function AgbPage() {
  return (
    <LegalPageShell title="Allgemeine Geschäftsbedingungen" stand="Juli 2026">

      <h2>§ 1 Geltungsbereich und Rolle von Passly</h2>
      <p>
        (1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der
        Plattform Passly (getpassly.de), betrieben von [PLATZHALTER: Vor- und
        Nachname, Anschrift] („Passly“, „wir“).
      </p>
      <p>
        (2) Passly ist eine <strong>Vermittlungsplattform</strong>: Veranstalter
        können über Passly Tickets für ihre Veranstaltungen anbieten; Gäste können
        diese Tickets kaufen, aufbewahren und am Einlass vorzeigen. Der Vertrag
        über den Besuch der Veranstaltung (Veranstaltungsvertrag) kommt
        ausschließlich <strong>zwischen dem Gast und dem jeweiligen
        Veranstalter</strong> zustande. Passly wird nicht Vertragspartner des
        Veranstaltungsvertrags und schuldet nicht die Durchführung der
        Veranstaltung.
      </p>
      <p>
        (3) Teil A dieser AGB gilt für alle Nutzer, insbesondere Ticketkäufer.
        Teil B gilt ergänzend für Veranstalter.
      </p>

      <h2>Teil A: Für alle Nutzer</h2>

      <h2>§ 2 Konto</h2>
      <p>
        (1) Für den Kauf und die Verwaltung von Tickets ist ein Passly-Konto
        erforderlich. Die Anmeldung erfolgt mit einer gültigen E-Mail-Adresse über
        einen Bestätigungscode; ein Passwort wird nicht vergeben.
      </p>
      <p>
        (2) Du bist verpflichtet, den Zugang zu deinem E-Mail-Postfach vor dem
        Zugriff Dritter zu schützen, da darüber auf dein Konto und deine Tickets
        zugegriffen werden kann.
      </p>

      <h2>§ 3 Ticketkauf und Vertragsschluss</h2>
      <p>
        (1) Die Darstellung eines Events auf Passly ist kein bindendes Angebot,
        sondern eine Aufforderung zur Abgabe eines Angebots durch den Gast.
      </p>
      <p>
        (2) Mit Abschluss des Bezahlvorgangs auf der Bezahlseite unseres
        Zahlungsdienstleisters Stripe gibt der Gast ein verbindliches Angebot zum
        Erwerb der ausgewählten Tickets ab. Der Vertrag mit dem Veranstalter kommt
        mit der Zahlungsbestätigung zustande. Der Gast erhält eine Bestätigung mit
        den Ticket-Links per E-Mail.
      </p>
      <p>
        (3) Zur Vermeidung von Überverkauf werden Tickets während des
        Bezahlvorgangs für 30 Minuten reserviert. Wird der Bezahlvorgang nicht
        abgeschlossen, verfällt die Reservierung.
      </p>

      <h2>§ 4 Preise und Servicegebühr</h2>
      <p>
        (1) Es gilt der beim jeweiligen Event ausgewiesene Ticketpreis. Dieser wird
        vom Veranstalter festgelegt und steht diesem vollständig zu.
      </p>
      <p>
        (2) Zusätzlich zum Ticketpreis erhebt Passly vom Gast eine{' '}
        <strong>Servicegebühr von 1,00&nbsp;€ zzgl. 4&nbsp;% des Ticketpreises pro
        Ticket</strong>. Die Servicegebühr wird vor Abschluss des Kaufs
        ausgewiesen. Für kostenlose Tickets fällt keine Servicegebühr an.
      </p>

      <h2>§ 5 Bezahlung</h2>
      <p>
        Die Bezahlung erfolgt über die Stripe Payments Europe, Ltd. (Dublin,
        Irland) mit den dort angebotenen Zahlungsmitteln. Passly speichert keine
        Kartendaten. Passly nimmt Zahlungen für den Veranstalter entgegen; die
        Zahlung an Passly hat schuldbefreiende Wirkung gegenüber dem Veranstalter.
      </p>

      <h2>§ 6 Ticket, QR-Code und Einlass</h2>
      <p>
        (1) Jedes Ticket ist ein einzigartiges, personengebundenes digitales
        Ticket, das im Passly-Konto des Gastes hinterlegt wird. Der Einlass erfolgt
        über einen sich minütlich erneuernden QR-Code, der nur im angemeldeten
        Konto angezeigt wird.
      </p>
      <p>
        (2) Jedes Ticket berechtigt zum einmaligen Einlass. Kopien, Screenshots
        oder Abfotografien des QR-Codes berechtigen nicht zum Einlass.
      </p>
      <p>
        (3) Für die Einlasskontrolle und etwaige zusätzliche Einlassbedingungen
        (z.&nbsp;B. Altersgrenzen) ist der Veranstalter verantwortlich.
      </p>

      <h2>§ 7 Weitergabe von Tickets</h2>
      <p>
        (1) Tickets können über die dafür vorgesehene Funktion per
        Übergabe-Link an eine andere Person weitergegeben werden. Mit Annahme der
        Übergabe gehen alle Rechte aus dem Ticket auf die annehmende Person über;
        der QR-Code des bisherigen Inhabers verliert seine Gültigkeit.
      </p>
      <p>
        (2) Eine Weitergabe außerhalb dieser Funktion ist technisch nicht möglich
        und nicht Bestandteil der Leistung. Der gewerbliche Weiterverkauf von
        Tickets kann durch den Veranstalter untersagt sein.
      </p>

      <h2>§ 8 Kein Widerrufsrecht</h2>
      <p>
        <strong>Belehrung:</strong> Ein Widerrufsrecht besteht beim Kauf von
        Tickets nicht. Gemäß §&nbsp;312g Abs.&nbsp;2 Nr.&nbsp;9 BGB sind Verträge
        über Dienstleistungen im Zusammenhang mit Freizeitbetätigungen vom
        Widerrufsrecht ausgenommen, wenn der Vertrag, wie bei Veranstaltungen mit
        festem Termin, einen spezifischen Zeitpunkt oder Zeitraum für die
        Erbringung vorsieht. Jeder Ticketkauf ist daher verbindlich; eine Rückgabe
        ist ausgeschlossen, soweit nicht §&nbsp;9 etwas anderes bestimmt.
      </p>

      <h2>§ 9 Absage, Verlegung und Erstattung</h2>
      <p>
        (1) Wird eine Veranstaltung abgesagt oder wesentlich verlegt, richten sich
        Erstattungsansprüche gegen den <strong>Veranstalter</strong> als
        Vertragspartner des Veranstaltungsvertrags.
      </p>
      <p>
        (2) Passly unterstützt die Rückabwicklung technisch: Vom Veranstalter
        veranlasste Erstattungen werden über denselben Zahlungsweg zurückgezahlt;
        die betroffenen Tickets verlieren ihre Gültigkeit.
      </p>
      <p>
        (3) Ein Anspruch auf Erstattung der Servicegebühr gegen Passly besteht bei
        Absage oder Verlegung durch den Veranstalter nicht, es sei denn, Passly hat
        die Absage zu vertreten. [PLATZHALTER: Kulanzregelung prüfen, viele
        Plattformen erstatten die Gebühr bei Absage freiwillig mit; das ist auch
        kommunikativ die stärkere Lösung.]
      </p>

      <h2>§ 10 Haftung von Passly</h2>
      <p>
        (1) Passly haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie
        bei Verletzung von Leben, Körper oder Gesundheit.
      </p>
      <p>
        (2) Bei einfacher Fahrlässigkeit haftet Passly nur für die Verletzung
        wesentlicher Vertragspflichten (Pflichten, deren Erfüllung die
        ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf
        deren Einhaltung der Nutzer regelmäßig vertrauen darf), begrenzt auf den
        vertragstypischen, vorhersehbaren Schaden.
      </p>
      <p>
        (3) Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt. Für die
        Durchführung der Veranstaltung haftet ausschließlich der Veranstalter.
      </p>

      <h2>Teil B: Zusätzlich für Veranstalter</h2>

      <h2>§ 11 Leistungen von Passly für Veranstalter</h2>
      <p>
        (1) Passly stellt Veranstaltern die Plattform zum Anlegen von Events, den
        Ticketverkauf mit automatischer Kapazitätssteuerung, die Ausstellung
        fälschungssicherer digitaler Tickets, die Einlass-Scanfunktion und die
        Auszahlung der Ticketerlöse bereit.
      </p>
      <p>
        (2) Der Veranstalter erhält <strong>100&nbsp;% des von ihm festgelegten
        Ticketpreises</strong>. Die Servicegebühr (§&nbsp;4 Abs.&nbsp;2) trägt der
        Gast.
      </p>

      <h2>§ 12 Auszahlung und Identitätsprüfung</h2>
      <p>
        (1) Auszahlungen erfolgen über Stripe Connect auf das vom Veranstalter
        hinterlegte Bankkonto. Voraussetzung ist der Abschluss der von Stripe
        durchgeführten, gesetzlich vorgeschriebenen Identitätsprüfung. Bis zu deren
        Abschluss ist der Verkauf kostenpflichtiger Tickets nicht möglich.
      </p>
      <p>
        (2) Der Veranstalter kann je Event eine Haltefrist festlegen, nach deren
        Ablauf die Ticketerlöse ausgezahlt werden. Ohne Haltefrist erfolgt die
        Auszahlung fortlaufend, in der Regel innerhalb eines Tages nach dem
        jeweiligen Verkauf.
      </p>
      <p>
        (3) Bei Zahlungsstreitigkeiten (Chargebacks), Rückerstattungen oder
        begründetem Betrugsverdacht kann Passly Auszahlungen ganz oder teilweise
        zurückhalten, bis der Sachverhalt geklärt ist. Bereits ausgezahlte, aber
        vom Gast wirksam zurückgeforderte Beträge hat der Veranstalter zu
        erstatten.
      </p>

      <h2>§ 13 Pflichten des Veranstalters</h2>
      <p>(1) Der Veranstalter ist verantwortlich für:</p>
      <ul>
        <li>die ordnungsgemäße Durchführung der Veranstaltung und die Erfüllung des Veranstaltungsvertrags gegenüber den Gästen,</li>
        <li>die Richtigkeit und Rechtmäßigkeit aller Eventangaben (Beschreibung, Bilder, Preise) einschließlich der Rechte an verwendeten Bildern,</li>
        <li>die Einhaltung aller ihn treffenden gesetzlichen Pflichten, insbesondere gewerbe-, steuer- und preisangabenrechtlicher Art sowie, bei gewerblichem Handeln, eigener Informationspflichten gegenüber Verbrauchern,</li>
        <li>die Abwicklung von Erstattungen bei Absage oder Verlegung (§&nbsp;9).</li>
      </ul>
      <p>
        (2) Der Veranstalter stellt Passly von Ansprüchen Dritter frei, die auf
        einer Verletzung dieser Pflichten beruhen, einschließlich der
        erforderlichen Rechtsverteidigungskosten.
      </p>
      <p>
        (3) Passly kann Events sperren oder löschen, die gegen gesetzliche
        Vorschriften oder diese AGB verstoßen.
      </p>

      <h2>§ 14 Schlussbestimmungen</h2>
      <p>
        (1) Es gilt das Recht der Bundesrepublik Deutschland. Gegenüber
        Verbrauchern gilt diese Rechtswahl nur, soweit ihnen dadurch nicht der
        Schutz zwingender Bestimmungen des Staates ihres gewöhnlichen Aufenthalts
        entzogen wird.
      </p>
      <p>
        (2) Ist der Nutzer Kaufmann, juristische Person des öffentlichen Rechts
        oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand der Sitz von
        Passly.
      </p>
      <p>
        (3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die
        Wirksamkeit der übrigen Bestimmungen unberührt.
      </p>

    </LegalPageShell>
  );
}
