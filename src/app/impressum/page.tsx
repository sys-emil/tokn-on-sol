import type { Metadata } from 'next';
import { LegalPageShell } from '@/app/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Impressum — Passly',
  description: 'Anbieterkennzeichnung gemäß § 5 DDG.',
  robots: { index: false },
};

/*
 * Anbieterkennzeichnung nach § 5 DDG (Digitale-Dienste-Gesetz, löst das TMG ab)
 * und § 18 Abs. 2 MStV.
 *
 * VOR GO-LIVE zwingend ausfüllen — grep nach "PLATZHALTER".
 * Ein fehlendes oder unvollständiges Impressum ist abmahnfähig.
 */

export default function ImpressumPage() {
  return (
    <LegalPageShell title="Impressum" stand="Juli 2026">

      <h2>Angaben gemäß § 5 DDG</h2>
      <div className="legal-address">
        <strong>[PLATZHALTER: Vor- und Nachname]</strong><br />
        [PLATZHALTER: Straße und Hausnummer]<br />
        [PLATZHALTER: PLZ und Ort]<br />
        Deutschland
      </div>
      <p>
        Passly wird derzeit von einer Einzelperson betrieben.
        {/* Sobald ein Gewerbe angemeldet oder eine Gesellschaft gegründet ist:
            Rechtsform, ggf. Handelsregister + Registernummer und
            Vertretungsberechtigte hier ergänzen. */}
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:[PLATZHALTER: kontakt@getpassly.de]">[PLATZHALTER: kontakt@getpassly.de]</a><br />
        Telefon: [PLATZHALTER: Telefonnummer — Pflicht ist ein zweiter schneller
        Kommunikationsweg neben E-Mail; eine Telefonnummer erfüllt das sicher]
      </p>

      <h2>Umsatzsteuer</h2>
      <p>
        [PLATZHALTER — eine der beiden Varianten wählen:]<br />
        <strong>Variante A (Kleinunternehmer):</strong> Gemäß § 19 UStG wird keine
        Umsatzsteuer erhoben und ausgewiesen (Kleinunternehmerregelung).<br />
        <strong>Variante B:</strong> Umsatzsteuer-Identifikationsnummer gemäß § 27a
        UStG: [USt-IdNr.]
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        [PLATZHALTER: Vor- und Nachname, Anschrift wie oben]
      </p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
        vor einer Verbraucherschlichtungsstelle im Sinne des
        Verbraucherstreitbeilegungsgesetzes (VSBG) teilzunehmen.
      </p>

      <h2>Rolle von Passly</h2>
      <p>
        Passly ist eine Vermittlungsplattform für Veranstaltungstickets. Der Vertrag
        über den Besuch einer Veranstaltung kommt zwischen dem jeweiligen
        Veranstalter und dem Ticketkäufer zustande. Verantwortlich für die
        Durchführung der Veranstaltung ist der jeweilige Veranstalter. Näheres
        regeln unsere <a href="/agb">AGB</a>.
      </p>

      <h2>Haftung für Inhalte und Links</h2>
      <p>
        Für die Inhalte der auf Passly angelegten Veranstaltungsseiten
        (Eventbeschreibungen, Bilder, Preisgestaltung) sind die jeweiligen
        Veranstalter verantwortlich. Wir entfernen rechtswidrige Inhalte nach
        Kenntniserlangung unverzüglich. Für externe Links übernehmen wir keine
        Haftung; für deren Inhalte ist stets der jeweilige Anbieter verantwortlich.
      </p>

    </LegalPageShell>
  );
}
