import type { MetadataRoute } from 'next';

const siteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Deliberately narrow: everything is crawlable except the four cases
      // where indexing is actively wrong. Auth-gated app surfaces
      // (/dashboard, /my-tickets, /tickets/, /doorman/, /account) are left
      // open — they render a login prompt to a crawler, which is harmless,
      // and none of them is in the sitemap.
      disallow: [
        // Nothing to index; JSON and POST-only handlers, pure crawl waste.
        '/api/',
        '/admin',
        '/admin/',
        // The buy flow. Every /shop/[id] declares /event/[id] as its
        // canonical, and only /event/[id] is in the sitemap; letting both be
        // crawled just splits the same event across two URLs.
        '/shop/',
        // Bearer tokens in the path — the token IS the credential. These
        // links travel by e-mail and are linked from nowhere, so a crawler
        // shouldn't find them anyway; this keeps them out of an index if one
        // ever leaks through a referrer.
        '/claim/',
        '/order/',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
