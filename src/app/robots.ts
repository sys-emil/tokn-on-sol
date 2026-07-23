import type { MetadataRoute } from 'next';

const siteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Auth-gated app surfaces and API routes have nothing to index and no
      // canonical public content; keep crawlers on the marketing/event pages.
      disallow: [
        '/api/',
        '/dashboard',
        '/dashboard/',
        '/admin',
        '/admin/',
        '/my-tickets',
        '/tickets/',
        '/doorman/',
        '/become-organizer',
        '/account',
        '/claim/',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
