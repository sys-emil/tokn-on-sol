import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

// Evaluated per request, not at build time — otherwise the event list would be
// frozen until the next deploy.
export const dynamic = 'force-dynamic';

const siteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

// /become-organizer is deliberately absent: it's auth-gated (robots.ts
// disallows it) — listing it in the sitemap would contradict robots.txt.
const STATIC_ROUTES = ['/', '/events', '/fuer-veranstalter', '/so-funktionierts', '/hilfe'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabaseAdmin
    .from('events')
    .select('id, date')
    .gte('date', today)
    .eq('is_private', false)
    .is('cancelled_at', null);

  const eventEntries: MetadataRoute.Sitemap = (data ?? []).map((e) => ({
    url: `${siteUrl}/shop/${e.id as string}`,
    lastModified: e.date as string,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.6,
  }));

  return [...staticEntries, ...eventEntries];
}
