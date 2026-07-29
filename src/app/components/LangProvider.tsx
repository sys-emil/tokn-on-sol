'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  translator,
  type Lang,
  type TranslationKey,
} from '@/lib/i18n';

/**
 * Language for client components. The value comes from the server (root layout
 * reads the cookie), so there is no flash of the wrong language on first paint
 * and no `document.cookie` read during render.
 */

interface LangContextValue {
  lang: Lang;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  t: translator(DEFAULT_LANG),
  setLang: () => {},
});

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const router = useRouter();

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
      // Server components hold the other half of the copy, so a client-side
      // state flip alone would leave the page half-translated.
      router.refresh();
    },
    [router],
  );

  const value = useMemo<LangContextValue>(
    () => ({ lang, t: translator(lang), setLang }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/** Shorthand for the common case. */
export function useT() {
  return useContext(LangContext).t;
}
