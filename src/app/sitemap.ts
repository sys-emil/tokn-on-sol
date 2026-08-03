import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

// Evaluated per request, not at build time; otherwise the event list would be
// frozen until the next deploy.
export const dynamic = 'force-dynamic';

const siteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

// /become-organizer is deliberately absent: it's auth-gated (robots.ts
// disallows it); listing it in the sitemap would contradict robots.txt.
const STATIC_ROUTES = ['/', '/events', '/fuer-veranstalter', '/preise', '/so-funktionierts', '/hilfe'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabaseAdmin
    .from('events')
    .select('id, date')
    .gte('date', today)
    .eq('is_private', false)
    .is('cancelled_at', null);

  const eventEntries: MetadataRoute.Sitemap = (data ?? []).map((e) => ({
    url: `${siteUrl}/event/${e.id as string}`,
    lastModified: e.date as string,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  // Season passes still on sale, i.e. active and with at least one date left.
  // A pass whose whole series has passed is dead content, not a sale page.
  const upcomingEventIds = (data ?? []).map((e) => e.id as string);
  const { data: passLinks } = upcomingEventIds.length > 0
    ? await supabaseAdmin
        .from('season_pass_events')
        .select('pass_id')
        .in('event_id', upcomingEventIds)
    : { data: [] };

  const livePassIds = [...new Set(((passLinks ?? []) as { pass_id: string }[]).map((l) => l.pass_id))];
  const { data: passes } = livePassIds.length > 0
    ? await supabaseAdmin
        .from('season_passes')
        .select('id')
        .in('id', livePassIds)
        .eq('active', true)
    : { data: [] };

  const passEntries: MetadataRoute.Sitemap = ((passes ?? []) as { id: string }[]).map((p) => ({
    url: `${siteUrl}/pass/${p.id}`,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  // Public organizer profiles (approved + handle set).
  const { data: orgs } = await supabaseAdmin
    .from('organizers')
    .select('handle')
    .eq('status', 'approved')
    .not('handle', 'is', null);

  const organizerEntries: MetadataRoute.Sitemap = (orgs ?? [])
    .filter((o) => o.handle)
    .map((o) => ({
      url: `${siteUrl}/@${o.handle as string}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.6,
  }));

  return [...staticEntries, ...eventEntries, ...passEntries, ...organizerEntries];
}
