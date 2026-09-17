import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/app/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Impressum · Passly',
  description: 'Anbieterkennzeichnung gemäß § 5 DDG.',
  robots: { index: false },
};

/*
 * Anbieterkennzeichnung nach § 5 DDG (Digitale-Dienste-Gesetz, löst das TMG ab)
 * und § 18 Abs. 2 MStV.
 *
 * Ein fehlendes oder unvollständiges Impressum ist abmahnfähig.
 */

export default function ImpressumPage() {
  return (
    <LegalPageShell title="Impressum" stand="September 2026">

      <h2>Angaben gemäß § 5 DDG</h2>
      <div className="legal-address">
        <strong>Emil Lange</strong><br />
        Vingerstr. 47<br />
        81375 München<br />
        Deutschland
      </div>
      <p>
        Passly wird als Einzelunternehmen betrieben (Gewerbe angemeldet; kein
        Eintrag im Handelsregister).
        {/* Bei Gründung einer Gesellschaft: Rechtsform, Handelsregister +
            Registernummer und Vertretungsberechtigte hier ergänzen. */}
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:support@getpassly.de">support@getpassly.de</a><br />
        Telefon: +49 152 03540460
      </p>

      <h2>Umsatzsteuer</h2>
      <p>
        Gemäß § 19 UStG wird keine Umsatzsteuer erhoben und ausgewiesen
        (Kleinunternehmerregelung).
        {/* Bei Wechsel zur Regelbesteuerung: "Umsatzsteuer-Identifikationsnummer
            gemäß § 27a UStG: DE…" – und die Gebührenstaffel in src/lib/fees.ts
            neu kalkulieren (Kleinunternehmer-Annahme). */}
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        Emil Lange, Vingerstr. 47, 81375 München
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
        regeln unsere <Link href="/agb">AGB</Link>.
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
