'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { Suspense } from 'react';
import { ConsentBanner, PageViewTracker } from '@/app/components/ConsentBanner';

export function Providers({ children }: { children: React.ReactNode }) {
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
      {children}
      <ConsentBanner />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </PrivyProvider>
  );
}
