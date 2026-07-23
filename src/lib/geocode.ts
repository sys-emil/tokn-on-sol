import { supabaseAdmin } from "@/lib/supabase";

/**
 * Server-side geocoding of free-text venue strings via OpenStreetMap /
 * Nominatim, backed by the `geocode_cache` table so identical venues are
 * looked up only once (and never re-hit on a negative result).
 *
 * Used by the admin overview API to place event markers on the globe.
 * Best-effort throughout: any failure resolves to `null`, never throws.
 *
 * Nominatim usage policy: a descriptive User-Agent is required and requests
 * must stay at or below 1/second. `geocodeVenues` serialises real (uncached)
 * lookups with a small delay to respect that.
 */

export type GeoPoint = { lat: number; lng: number; displayName: string | null };

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Passly-Admin/1.0 (support@getpassly.de)";
const RATE_LIMIT_MS = 1100;

export function normalizeVenue(venue: string): string {
  return venue.trim().toLowerCase().replace(/\s+/g, " ");
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function readCache(key: string): Promise<GeoPoint | null | undefined> {
  const { data } = await supabaseAdmin
    .from("geocode_cache")
    .select("latitude, longitude, display_name")
    .eq("query", key)
    .maybeSingle();
  if (!data) return undefined; // cache miss (not yet looked up)
  if (data.latitude == null || data.longitude == null) return null; // negative cache
  return {
    lat: data.latitude as number,
    lng: data.longitude as number,
    displayName: (data.display_name ?? null) as string | null,
  };
}

async function writeCache(key: string, point: GeoPoint | null): Promise<void> {
  await supabaseAdmin.from("geocode_cache").upsert(
    {
      query: key,
      latitude: point?.lat ?? null,
      longitude: point?.lng ?? null,
      display_name: point?.displayName ?? null,
      resolved_at: new Date().toISOString(),
    },
    { onConflict: "query" },
  );
}

async function fetchFromNominatim(venue: string): Promise<GeoPoint | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(venue)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const rows = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const hit = rows[0];
  if (!hit?.lat || !hit?.lon) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: hit.display_name ?? null };
}

/**
 * Resolve a single venue, using the cache first. Returns `null` when the venue
 * cannot be located (also written to the cache to avoid repeat lookups).
 */
export async function geocodeVenue(venue: string): Promise<GeoPoint | null> {
  const key = normalizeVenue(venue);
  if (!key) return null;
  try {
    const cached = await readCache(key);
    if (cached !== undefined) return cached;
    const point = await fetchFromNominatim(venue);
    await writeCache(key, point).catch(() => {});
    return point;
  } catch {
    return null;
  }
}

/**
 * Resolve many venues. Distinct venues are de-duplicated; cached ones return
 * instantly, and only genuine Nominatim misses are serialised with a >1s delay
 * to honour the rate limit. Returns a map keyed by the ORIGINAL venue string.
 */
export async function geocodeVenues(venues: string[]): Promise<Map<string, GeoPoint>> {
  const result = new Map<string, GeoPoint>();
  const distinct = new Map<string, string>(); // normalized -> first original
  for (const v of venues) {
    const key = normalizeVenue(v);
    if (key && !distinct.has(key)) distinct.set(key, v);
  }

  let didRemoteLookup = false;
  for (const [key, original] of distinct) {
    try {
      const cached = await readCache(key);
      if (cached !== undefined) {
        if (cached) fill(result, venues, key, cached);
        continue;
      }
      if (didRemoteLookup) await sleep(RATE_LIMIT_MS);
      didRemoteLookup = true;
      const point = await fetchFromNominatim(original);
      await writeCache(key, point).catch(() => {});
      if (point) fill(result, venues, key, point);
    } catch {
      // skip this venue
    }
  }
  return result;
}

function fill(target: Map<string, GeoPoint>, originals: string[], key: string, point: GeoPoint): void {
  for (const v of originals) {
    if (normalizeVenue(v) === key) target.set(v, point);
  }
}
