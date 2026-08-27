'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/lib/auth';
import { ConsentBanner, PageViewTracker } from '@/app/components/ConsentBanner';
import { LangProvider } from '@/app/components/LangProvider';
import type { Lang } from '@/lib/i18n';

export function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LangProvider lang={lang}>{children}</LangProvider>
      <ConsentBanner />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </AuthProvider>
  );
}
