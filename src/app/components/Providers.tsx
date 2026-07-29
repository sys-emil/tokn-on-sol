'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { Suspense } from 'react';
import { ConsentBanner, PageViewTracker } from '@/app/components/ConsentBanner';
import { LangProvider } from '@/app/components/LangProvider';
import type { Lang } from '@/lib/i18n';

export function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email'],
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <LangProvider lang={lang}>{children}</LangProvider>
      <ConsentBanner />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </PrivyProvider>
  );
}
