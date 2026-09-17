import type { Metadata } from 'next';
import Link from 'next/link';
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
 * (Separate Charges & Transfers; der Veranstalter erhält den Ticketpreis
 * abzüglich des Anteils an der Servicegebühr, den er je Event selbst trägt,
 * `events.fee_payer`).
 *
 * Jede Zahl hier hat eine Quelle im Code: Gebührenstaffel `src/lib/fees.ts`,
 * Reservierung `HOLD_MINUTES` in `/api/checkout/create`, Auszahlungsfristen
 * `effectiveHoldDays` in `src/lib/payouts.ts`, Rückgabe `RETURN_FEE_BPS` /
 * `RETURN_WINDOW_DAYS` in `fees.ts` / `resaleReturn.ts`, Freikarten-Deckel
 * `src/lib/freeTickets.ts`. Ändert sich eine Konstante, ändert sich dieser
 * Text im selben Commit.
 *
 * Dieser Text ist ein sorgfältiger Entwurf, ERSETZT ABER KEINE anwaltliche
 * Prüfung, insbesondere §§ 3, 8, 9, 9a und Teil B sollten von einer auf
 * IT-/Vertriebsrecht spezialisierten Kanzlei freigegeben werden.
 */

export default function AgbPage() {
  return (
    <LegalPageShell title="Allgemeine Geschäftsbedingungen" stand="September 2026">

      <h2>§ 1 Geltungsbereich und Rolle von Passly</h2>
      <p>
        (1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der
        Plattform Passly (getpassly.de), betrieben von Emil Lange,
        Vingerstr. 47, 81375 München („Passly“, „wir“).
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
        (1) Tickets werden in einem Passly-Konto verwahrt und vorgezeigt. Die
        Anmeldung erfolgt mit einer gültigen E-Mail-Adresse über einen
        Bestätigungscode; ein Passwort wird nicht vergeben.
      </p>
      <p>
        (2) Soweit der Veranstalter dies zulässt, kann der Kauf auch ohne
        bestehendes Konto abgeschlossen werden (Gastbestellung). Der Gast erhält
        in diesem Fall per E-Mail einen Bestell-Link. Das Ticket kann erst
        vorgezeigt werden, nachdem der Gast sich über diesen Link in einem
        Passly-Konto angemeldet und die Bestellung dem Konto zugeordnet hat.
      </p>
      <p>
        (3) Du bist verpflichtet, den Zugang zu deinem E-Mail-Postfach sowie
        einen dir zugesandten Bestell-Link vor dem Zugriff Dritter zu schützen,
        da darüber auf dein Konto und deine Tickets zugegriffen werden kann.
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
        (3) Zur Vermeidung von Überverkauf werden die ausgewählten Tickets mit
        Beginn des Bezahlvorgangs reserviert. Die Reservierung gilt längstens
        30 Minuten. Ist der Bezahlvorgang nach fünf Minuten nicht abgeschlossen,
        kann die Reservierung vorzeitig aufgehoben werden, wenn andere Gäste die
        Plätze nachfragen; der Bezahlvorgang wird in diesem Fall abgebrochen. Eine
        bereits abgeschlossene Zahlung bleibt hiervon unberührt.
      </p>

      <h2>§ 4 Preise und Servicegebühr</h2>
      <p>
        (1) Es gilt der beim jeweiligen Event ausgewiesene Ticketpreis. Dieser wird
        vom Veranstalter festgelegt und steht diesem vollständig zu.
      </p>
      <p>
        (2) Für jedes verkaufte Ticket erhebt Passly eine{' '}
        <strong>Servicegebühr in Höhe von 7,9&nbsp;% des Ticketpreises bis
        15,00&nbsp;€, zuzüglich 5,9&nbsp;% des darüber hinausgehenden Anteils bis
        50,00&nbsp;€ und 4,5&nbsp;% des darüber hinausgehenden Anteils, mindestens
        jedoch 0,99&nbsp;€ je Ticket</strong>. Der jeweilige Satz gilt nur für den
        Teil des Ticketpreises, der in die betreffende Stufe fällt. Wer sie trägt,
        legt der Veranstalter je Event fest: der
        Gast zusätzlich zum Ticketpreis, beide je zur Hälfte, oder der
        Veranstalter allein. Der auf den Gast entfallende Anteil wird vor
        Abschluss des Kaufs ausgewiesen; trägt der Veranstalter die Gebühr
        vollständig, ist der ausgewiesene Ticketpreis der Endpreis. Für
        kostenlose Tickets fällt keine Servicegebühr an.
      </p>
      <p>
        (3) Sagt der Veranstalter ein Event ab, erhalten die Gäste den vollen
        gezahlten Betrag einschließlich der Servicegebühr erstattet. Die
        Entgelte, die der Zahlungsdienstleister für die ursprüngliche Zahlung
        erhoben hat und bei einer Erstattung <strong>nicht zurückerstattet</strong>,
        trägt der Veranstalter. Passly reicht ausschließlich diese tatsächlich
        angefallenen Fremdkosten weiter, nicht die eigene Servicegebühr, und
        behält sie von der nächsten Auszahlung an den Veranstalter ein. Die
        Höhe ist im Veranstalter-Konto einsehbar.
      </p>
      <p>
        (4) Fordert ein Gast eine Zahlung über seinen Zahlungsdienstleister
        zurück (Chargeback) und geht der Fall zulasten des Veranstalters aus,
        erhebt der Zahlungsdienstleister hierfür ein gesondertes Entgelt. Passly
        reicht dieses Entgelt in der tatsächlich angefallenen Höhe an den
        Veranstalter weiter und behält es von der nächsten Auszahlung ein.
        Endet der Fall zugunsten des Veranstalters, entfällt die Weiterbelastung
        vollständig. Weitergereicht wird ausschließlich das Entgelt des
        Zahlungsdienstleisters, nicht die Servicegebühr von Passly. Die Höhe ist
        im Veranstalter-Konto einsehbar.
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
        (2) Jedes Ticket berechtigt zum einmaligen Einlass. Hat der Veranstalter
        für sein Event den Wiedereinlass freigeschaltet, kann der Gast den
        Veranstaltungsort verlassen und mit demselben Ticket erneut eingelassen
        werden; zwischen zwei Scans desselben Tickets gilt eine vom Veranstalter
        festgelegte Sperrzeit. Ein Saisonpass berechtigt zum jeweils einmaligen
        Einlass zu jedem im Pass enthaltenen Termin.
      </p>
      <p>
        (3) Kopien, Screenshots oder Abfotografien des QR-Codes berechtigen nicht
        zum Einlass.
      </p>
      <p>
        (4) <strong>Offline-Ticket:</strong> Für Veranstaltungsorte ohne
        Netzverbindung kann der Gast zu seinem Ticket zusätzlich ein
        Offline-Ticket als PDF erzeugen. Es trägt einen unveränderlichen
        QR-Code, der auf Vor- und Nachname sowie Geburtsdatum des Gastes
        ausgestellt ist; diese Angaben sind Bestandteil des Codes und können
        nachträglich nicht geändert werden. Am Einlass ist zum Offline-Ticket ein
        amtlicher Lichtbildausweis vorzulegen; stimmen die Angaben nicht überein,
        kann der Einlass verweigert werden. Das Offline-Ticket ist nicht
        übertragbar. Es verliert seine Gültigkeit, sobald das zugehörige Ticket
        eingelöst, weitergegeben, zurückgegeben oder erstattet wurde.
      </p>
      <p>
        (5) Für die Einlasskontrolle und etwaige zusätzliche Einlassbedingungen
        (z.&nbsp;B. Altersgrenzen) ist der Veranstalter verantwortlich.
      </p>

      <h2>§ 7 Weitergabe von Tickets</h2>
      <p>
        (1) Tickets können über die dafür vorgesehene Funktion per
        Übergabe-Link an eine andere Person weitergegeben werden. Mit Annahme der
        Übergabe gehen alle Rechte aus dem Ticket auf die annehmende Person über;
        der QR-Code des bisherigen Inhabers und ein für das Ticket erzeugtes
        Offline-Ticket verlieren ihre Gültigkeit. Der Übergabe-Link ist ein
        Berechtigungsnachweis: Wer ihn kennt, kann das Ticket annehmen. Er ist
        daher nur der Person zu übermitteln, die das Ticket erhalten soll.
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
        ist ausgeschlossen, soweit nicht §&nbsp;9 oder §&nbsp;9a etwas anderes
        bestimmt.
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
        (3) Sagt der Veranstalter die Veranstaltung ab, erstattet Passly dem Gast
        zusammen mit dem Ticketpreis auch die Servicegebühr. Bei einer bloßen
        Verlegung besteht kein Anspruch auf Erstattung der Servicegebühr.
      </p>
      <p>
        (4) Erstattet der Veranstalter ein einzelnes Ticket auf Bitte des Gastes
        oder aus eigenem Entschluss, erhält der Gast den für dieses Ticket
        gezahlten Betrag einschließlich der Servicegebühr auf das ursprüngliche
        Zahlungsmittel zurück; das Ticket verliert seine Gültigkeit. Ein Anspruch
        des Gastes auf eine solche Erstattung besteht nicht; die Entscheidung
        liegt beim Veranstalter. Die vom Zahlungsdienstleister einbehaltenen
        Entgelte trägt der Veranstalter entsprechend §&nbsp;4 Abs.&nbsp;3.
      </p>

      <h2>§ 9a Rückgabe und Neuverkauf</h2>
      <p>
        (1) Der Veranstalter kann für ein Event die Rückgabe von Tickets
        freischalten. Ob sie für ein Event verfügbar ist, wird im Passly-Konto
        beim jeweiligen Ticket angezeigt. Ist sie freigeschaltet, kann der Gast
        ein noch nicht eingelöstes Ticket bis zum Tag vor der Veranstaltung über
        sein Passly-Konto zur Rückgabe anbieten.
      </p>
      <p>
        (2) Mit dem Angebot verliert das Ticket seine Gültigkeit, und der Platz
        wird zum ursprünglichen Ticketpreis erneut zum Verkauf gestellt. Ein
        Verkauf zu einem höheren als dem ursprünglichen Preis ist nicht möglich.
        Der neue Käufer erwirbt das Ticket über den regulären Kaufvorgang nach
        §&nbsp;3.
      </p>
      <p>
        (3) Wird der Platz erneut verkauft, erstattet Passly dem Gast den für
        das Ticket gezahlten Ticketpreis abzüglich einer{' '}
        <strong>Rückgabegebühr in Höhe von 10&nbsp;% des Ticketpreises,
        mindestens jedoch 1,00&nbsp;€</strong>, auf das ursprüngliche
        Zahlungsmittel. Eine beim Kauf gezahlte Servicegebühr wird nicht
        erstattet. Der zu erwartende Erstattungsbetrag wird vor Abgabe des
        Angebots angezeigt.
      </p>
      <p>
        (4) Wird der Platz bis zum Tag der Veranstaltung nicht erneut verkauft,
        erhält der Gast sein Ticket in gültiger Form zurück; ein Anspruch auf
        Erstattung besteht in diesem Fall nicht. Bis zum Neuverkauf kann der
        Gast das Angebot jederzeit zurücknehmen; das Ticket wird dann wieder
        gültig.
      </p>
      <p>
        (5) Die Rückgabe ist nicht möglich für Saisonpässe, kostenlose Tickets,
        an der Abendkasse erworbene Tickets, bereits eingelöste Tickets sowie für
        Käufe, die länger als 150 Tage zurückliegen.
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
        (2) Der Veranstalter erhält den von ihm festgelegten Ticketpreis
        abzüglich des von ihm gewählten Anteils an der Servicegebühr
        (§&nbsp;4 Abs.&nbsp;2). Wählt er die Voreinstellung „Gast zahlt&ldquo;, erhält er{' '}
        <strong>100&nbsp;% des von ihm festgelegten Ticketpreises</strong>.
      </p>
      <p>
        (3) Zusätzliche Funktionen („Passly Pro&ldquo;) bietet Passly gegen ein
        Entgelt als Abonnement mit monatlicher oder jährlicher Laufzeit an. Der
        jeweils gültige Preis wird vor Abschluss im Bestellvorgang angezeigt und
        ist für die gewählte Laufzeit im Voraus fällig. Das Abonnement
        verlängert sich jeweils um die gewählte Laufzeit, wenn es nicht bis zum
        Ende der laufenden Laufzeit gekündigt wird; die Kündigung ist jederzeit
        in der Abo-Verwaltung möglich und wirkt zum Ende der laufenden Laufzeit.
        Eine anteilige Erstattung bereits gezahlter Entgelte für die restliche
        Laufzeit erfolgt nicht. Ein Wechsel von monatlicher auf jährliche
        Laufzeit ist jederzeit möglich; bereits gezahlte Monatsentgelte werden
        dabei angerechnet.
      </p>
      <p>
        (4) <strong>Abendkasse:</strong> Der Veranstalter kann Tickets über die
        Einlassfunktion auch vor Ort gegen Barzahlung ausgeben. Passly wickelt
        dabei keine Zahlung ab; der vereinnahmte Betrag verbleibt beim
        Veranstalter. Der Preis an der Abendkasse entspricht dem Preis, den ein
        Gast im Online-Vorverkauf für dasselbe Ticket zahlt, einschließlich des
        auf den Gast entfallenden Anteils der Servicegebühr. Die Servicegebühr
        nach §&nbsp;4 Abs.&nbsp;2 fällt für diese Tickets in voller Höhe an und
        wird von der nächsten Auszahlung an den Veranstalter einbehalten. Die
        offenen Beträge sind im Veranstalter-Konto einsehbar.
      </p>
      <p>
        (5) <strong>Kostenlose Tickets:</strong> Je Event können ohne
        Passly&nbsp;Pro bis zu 500 kostenlose Tickets angeboten werden; mit
        Passly&nbsp;Pro gilt die allgemeine Kapazitätsgrenze je Event von
        10.000 Tickets. Die Grenze wird beim Anlegen und Bearbeiten des Events
        geprüft; für Events, die vor Einführung der Grenze angelegt wurden,
        bleibt die bestehende Kapazität erhalten.
      </p>

      <h2>§ 12 Auszahlung und Identitätsprüfung</h2>
      <p>
        (1) Auszahlungen erfolgen über Stripe Connect auf das vom Veranstalter
        hinterlegte Bankkonto. Voraussetzung ist der Abschluss der von Stripe
        durchgeführten, gesetzlich vorgeschriebenen Identitätsprüfung. Bis zu deren
        Abschluss ist der Verkauf kostenpflichtiger Tickets nicht möglich.
      </p>
      <p>
        (2) Ticketerlöse werden <strong>nicht bereits mit dem Verkauf</strong>,
        sondern erst nach der Veranstaltung ausgezahlt. Maßgeblich ist das
        Veranstaltungsdatum: Die Auszahlung erfolgt frühestens am Tag nach der
        Veranstaltung, bei der ersten Auszahlung eines Veranstalters frühestens
        drei Tage nach der Veranstaltung. Diese Frist dient der Abwicklung von
        Absagen, Erstattungen und Rückbuchungen. Der Veranstalter kann je Event
        eine längere Haltefrist festlegen; eine Verkürzung unter die vorstehenden
        Fristen ist nicht möglich. Bei Saisonpässen, die mehrere Termine umfassen,
        tritt an die Stelle des Veranstaltungsdatums das Kaufdatum.
      </p>
      <p>
        (3) Der Veranstalter kann je Event eine vorzeitige Auszahlung beantragen.
        Über den Antrag entscheidet Passly nach billigem Ermessen; ein Anspruch
        auf vorzeitige Auszahlung besteht nicht. Eine Freigabe gilt nur für die
        im Zeitpunkt der Entscheidung offenen Beträge dieses Events.
      </p>
      <p>
        (4) Bei Zahlungsstreitigkeiten (Chargebacks), Rückerstattungen oder
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
      <p>
        (4) Soweit Passly personenbezogene Daten der Gäste im Auftrag des
        Veranstalters verarbeitet (Gästeliste, Einlass, Nachrichten an Gäste,
        Export), gilt die <Link href="/avv">Vereinbarung zur Auftragsverarbeitung</Link>
        nach Art.&nbsp;28 DSGVO. Sie wird mit dem Anlegen des Veranstalter-Kontos
        Bestandteil dieses Vertrags.
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
