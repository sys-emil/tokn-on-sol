'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import { ConsentBanner, PageViewTracker } from '@/app/components/ConsentBanner';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48" />
        <link rel="apple-touch-icon" href="/apple-touch-icon-180.png" sizes="180x180" />
      </head>
      <body>
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
      </body>
    </html>
  );
}