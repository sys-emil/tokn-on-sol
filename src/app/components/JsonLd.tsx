/**
 * Ein JSON-LD-Block. Serverkomponente, absichtlich ohne 'use client': die
 * Auszeichnung muss im ausgelieferten HTML stehen, nicht erst nach Hydration —
 * ein Crawler fuehrt kein JavaScript aus, bevor er den Treffer baut.
 *
 * Es gibt sie, damit `dangerouslySetInnerHTML` an einer Stelle steht statt auf
 * jeder Seite. Der Inhalt kommt ausschliesslich aus `src/lib/structuredData.ts`,
 * also aus eigenem Code, nie aus Nutzereingaben.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
