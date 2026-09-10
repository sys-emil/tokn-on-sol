/**
 * Structured Data (JSON-LD) fuer die oeffentlichen Seiten.
 *
 * Warum das hier steht und nicht in den Seiten: die Angaben beschreiben die
 * *Marke*, nicht die Seite. Stuenden Name, Logo und Support-Adresse auf jeder
 * Seite von Hand, waere es dieselbe Geschichte wie bei der Navigationsleiste —
 * neunzehn Kopien, von denen keine zwei uebereinstimmen.
 *
 * Was das bewirkt, und was nicht:
 * - `WebSite` mit `name`/`alternateName` ist das Einzige, womit man Google den
 *   **Site-Namen** im Treffer vorschlagen kann ("Passly" statt "getpassly.de").
 *   Google verlangt dafuer ausdruecklich, dass die Auszeichnung auf der
 *   **Startseite** steht — deshalb wird sie genau dort eingebunden und nicht
 *   im Root-Layout, das auch ueber Dashboard, Tuer und Admin laeuft.
 * - `Organization` ist die Voraussetzung fuer Logo und Knowledge-Panel.
 * - `BreadcrumbList` ersetzt die URL-Zeile des Treffers durch einen lesbaren
 *   Pfad. Pro Unterseite, deshalb als Funktion.
 *
 * **Sitelinks** (die Unterlinks mit eigener Ueberschrift) erzeugt keine dieser
 * Angaben. Die vergibt Google allein; Markup dafuer gibt es nicht. Was hier
 * steht, verbessert nur die Zutaten: klare Struktur, klarer Name.
 */

export const siteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@getpassly.de';

/** Stabile @id, damit `WebSite.publisher` auf dieselbe Organisation zeigt. */
const ORGANIZATION_ID = `${siteUrl}/#organization`;

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Passly',
    url: `${siteUrl}/`,
    // Das SVG ist die einzige Logodatei in voller Aufloesung; das PNG daneben
    // ist das App-Icon und traegt den Namen nicht.
    logo: `${siteUrl}/passly-logo.svg`,
    description:
      'Passly ist ein Ticketsystem für Veranstalter: Vorverkauf ohne Grundgebühr, '
      + 'fälschungssichere Tickets und Einlass per Handy.',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SUPPORT_EMAIL,
      availableLanguage: ['de', 'en'],
    },
  };
}

export function webSiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    // `name` ist der Vorschlag fuer den Site-Namen im Suchergebnis,
    // `alternateName` faengt die Schreibweise ab, unter der Leute suchen.
    name: 'Passly',
    alternateName: 'Passly Ticketing',
    url: `${siteUrl}/`,
    inLanguage: 'de-DE',
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export interface Crumb {
  /** Beschriftung, wie sie im Treffer erscheinen soll. */
  name: string;
  /** Pfad ab dem Wurzelverzeichnis, z. B. `/preise`. */
  path: string;
}

/**
 * Der erste Eintrag ist immer die Startseite; uebergeben wird nur der Rest.
 * Ein einzelner Krumen ohne Wurzel ergibt keinen Pfad, und ihn auf jeder Seite
 * mitzuschreiben waere nur eine weitere Gelegenheit, ihn zu vergessen.
 */
export function breadcrumbLd(crumbs: Crumb[]) {
  const all: Crumb[] = [{ name: 'Startseite', path: '/' }, ...crumbs];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${siteUrl}${c.path}`,
    })),
  };
}
