'use client';

import Link from 'next/link';
import { useT } from '@/app/components/LangProvider';
import { LangSwitch } from '@/app/components/LangSwitch';

/*
 * Compact Impressum/Datenschutz/AGB link row. The Impressum must be reachable
 * from every page of the site (§ 5 DDG: "leicht erkennbar und unmittelbar
 * erreichbar"), drop this into any page without a full footer.
 *
 * It also carries the DE/EN switch: this row is the one thing every buyer page
 * has (ticket, shop, order, claim, success), and those pages are centred cards
 * with no topbar to put a toggle in. The legal pages themselves stay German —
 * the links keep their German names on purpose, since that is what the linked
 * documents are called.
 */
export function LegalLinks({ style, showLanguage = true }: { style?: React.CSSProperties; showLanguage?: boolean }) {
  const t = useT();

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11.5,
        color: 'var(--ink-4)',
        ...style,
      }}
    >
      <Link href="/impressum">{t('common.imprint')}</Link>
      <Link href="/datenschutz">{t('common.privacy')}</Link>
      <Link href="/agb">{t('common.terms')}</Link>
      {showLanguage && <LangSwitch />}
    </div>
  );
}
