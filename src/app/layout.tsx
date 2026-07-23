import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/app/components/Providers';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

const siteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Passly: Fälschungssichere Tickets für dein Event',
  description: 'Tickets, die man nicht fälschen kann. Passly ist das Ticketsystem für Veranstalter: 100 % des Ticketpreises, Einlass mit dem Handy, ohne Fixkosten.',
  openGraph: {
    type: 'website',
    siteName: 'Passly',
    title: 'Passly: Fälschungssichere Tickets für dein Event',
    description: 'Tickets, die man nicht fälschen kann. Kaufen, anmelden, reingehen, oder als Veranstalter: 100 % des Ticketpreises, ohne Fixkosten.',
    images: ['/icon-512.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Passly: Fälschungssichere Tickets für dein Event',
    description: 'Tickets, die man nicht fälschen kann.',
    images: ['/icon-512.png'],
  },
};

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
