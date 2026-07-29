'use client';

import { useLang } from '@/app/components/LangProvider';
import type { Lang } from '@/lib/i18n';

/**
 * DE/EN toggle for the buyer surfaces. Two labels rather than a dropdown:
 * there are exactly two languages, and a select for two options is a click
 * more than the choice deserves.
 */
export function LangSwitch({ style }: { style?: React.CSSProperties }) {
  const { lang, setLang, t } = useLang();

  return (
    <div className="lang-switch" role="group" aria-label={t('common.language')} style={style}>
      {(['de', 'en'] as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          className={code === lang ? 'active' : undefined}
          aria-pressed={code === lang}
          onClick={() => code !== lang && setLang(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
