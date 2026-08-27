'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/lib/auth';
import { ConsentBanner, PageViewTracker } from '@/app/components/ConsentBanner';
import { LangProvider } from '@/app/components/LangProvider';
import type { Lang } from '@/lib/i18n';

export function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <>
      <AuthProvider>
        <LangProvider lang={lang}>{children}</LangProvider>
      </AuthProvider>
      {/* Ausserhalb des AuthProvider, weil dieser den Seiteninhalt fuer den
          Anmeldedialog unscharf schaltet: ein `filter` macht das Element zum
          Bezugsrahmen fuer `position: fixed` darin, und das Banner haengt dann
          am Dokumentende statt am Viewport. Beide brauchen keine Sitzung. */}
      <ConsentBanner />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  );
}
