'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
          config={{
            loginMethods: ['email', 'sms'],
            embeddedWallets: {
              solana: {
                createOnLogin: 'users-without-wallets',
              },
            },
          }}
        >
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}