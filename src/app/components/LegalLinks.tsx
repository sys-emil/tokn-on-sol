import Link from 'next/link';

/*
 * Compact Impressum/Datenschutz/AGB link row. The Impressum must be reachable
 * from every page of the site (§ 5 DDG: "leicht erkennbar und unmittelbar
 * erreichbar"), drop this into any page without a full footer.
 */
export function LegalLinks({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        flexWrap: 'wrap',
        justifyContent: 'center',
        fontSize: 11.5,
        color: 'var(--ink-4)',
        ...style,
      }}
    >
      <Link href="/impressum">Impressum</Link>
      <Link href="/datenschutz">Datenschutz</Link>
      <Link href="/agb">AGB</Link>
    </div>
  );
}
