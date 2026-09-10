import type { Metadata } from 'next';

/*
 * Nur wegen der Metadaten: `page.tsx` ist eine Client-Komponente (Auth-Hooks)
 * und kann deshalb kein `metadata` exportieren.
 *
 * `noindex`, weil hinter dieser Adresse eine Anmeldemaske steht. Fuer einen
 * Crawler ist das eine leere Seite, und die Suchanfrage, die hierher fuehren
 * soll ("Passly Veranstalter werden"), beantwortet /fuer-veranstalter
 * ausfuehrlich — die Seite soll ranken, diese hier nur ihr Ziel sein.
 *
 * Der Kommentar in `sitemap.ts` behauptete das bereits ("robots.ts disallows
 * it"), ohne dass es irgendwo durchgesetzt war; siehe dort.
 */
export const metadata: Metadata = {
  title: 'Veranstalter werden · Passly',
  robots: { index: false, follow: true },
};

export default function BecomeOrganizerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
