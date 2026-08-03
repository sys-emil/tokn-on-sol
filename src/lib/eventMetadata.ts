import { supabaseAdmin } from "@/lib/supabase";

/**
 * Static per-event cNFT metadata in Supabase Storage (public bucket
 * `event-assets`). The mint stamps this URL on-chain, so it must stay
 * reachable independently of the app deployment; unlike the legacy
 * `/api/tickets/metadata?name=&date=` route, which only exists while the
 * Next.js app is running and carries no event ID or image. The legacy route
 * is kept as read fallback for assets minted before this change.
 */

const BUCKET = "event-assets";

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function publicUrl(path: string): string {
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** True if the URL points into our own public bucket (used to validate client-supplied image URLs). */
export function isOwnStorageUrl(url: string): boolean {
  return url.startsWith(publicUrl(""));
}

export async function uploadEventImage(
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported image type: ${contentType}`);

  const path = `images/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, cacheControl: "31536000" });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  return publicUrl(path);
}

/**
 * Uploads an organizer profile image (avatar or banner) into the same public
 * bucket under its own prefix; returns the public URL. Reuses the event-image
 * validation constants and long cache TTL.
 */
export async function uploadProfileImage(
  bytes: ArrayBuffer,
  contentType: string,
  kind: "avatar" | "banner",
): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported image type: ${contentType}`);

  const path = `${kind === "avatar" ? "avatars" : "banners"}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, cacheControl: "31536000" });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  return publicUrl(path);
}

/**
 * Writes the metadata JSON for an event and returns its public URL.
 * Upserts, so re-running (e.g. after adding an image) refreshes the file;
 * minted assets keep pointing at the same URL.
 */
export async function uploadEventMetadata(params: {
  eventId: string;
  name: string;
  date: string;
  imageUrl?: string | null;
  venue?: string | null;
  description?: string | null;
}): Promise<string> {
  const { eventId, name, date, imageUrl, venue, description } = params;

  const metadata = {
    name,
    symbol: "TOKN",
    description: description
      || (date ? `NFT ticket for ${name} on ${date}` : `NFT ticket for ${name}`),
    image: imageUrl ?? "",
    attributes: [
      { trait_type: "Event Name", value: name },
      ...(date ? [{ trait_type: "Event Date", value: date }] : []),
      ...(venue ? [{ trait_type: "Venue", value: venue }] : []),
      { trait_type: "Event ID", value: eventId },
    ],
  };

  return writeMetadata(`metadata/${eventId}.json`, metadata);
}

/**
 * Metadata JSON for a season pass. Same bucket and shape as an event's, so
 * wallets and the ticket page read it identically; the "Event Date" attribute
 * is replaced by the pass validity, which spans many dates.
 */
export async function uploadPassMetadata(params: {
  passId: string;
  name: string;
  imageUrl?: string | null;
  description?: string | null;
  /** Sorted event dates the pass admits to; used for the human-readable validity. */
  eventDates?: string[];
}): Promise<string> {
  const { passId, name, imageUrl, description, eventDates = [] } = params;

  const validity = eventDates.length > 1
    ? `${eventDates[0]} – ${eventDates[eventDates.length - 1]}`
    : eventDates[0] ?? "";

  const metadata = {
    name,
    symbol: "TOKN",
    description: description || `Saisonpass für ${eventDates.length} Termine`,
    image: imageUrl ?? "",
    attributes: [
      { trait_type: "Event Name", value: name },
      ...(validity ? [{ trait_type: "Pass Validity", value: validity }] : []),
      { trait_type: "Pass Dates", value: String(eventDates.length) },
      { trait_type: "Season Pass ID", value: passId },
    ],
  };

  return writeMetadata(`metadata/pass-${passId}.json`, metadata);
}

/**
 * Every `metadata/*.json` in the bucket, as plain object paths.
 *
 * Storage keeps no reference back to the row that created a file, so a deleted
 * event leaves its JSON behind — still publicly readable. Listing is the only
 * way to find those; see `pruneOrphanMetadata` in the admin refresh route.
 */
export async function listMetadataObjects(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list("metadata", { limit: 1000 });
  if (error) throw new Error(`Metadata list failed: ${error.message}`);
  return (data ?? [])
    .filter((o) => o.name.endsWith(".json"))
    .map((o) => `metadata/${o.name}`);
}

/** Deletes metadata objects by path. Returns the paths Storage confirmed. */
export async function deleteMetadataObjects(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
  if (error) throw new Error(`Metadata delete failed: ${error.message}`);
  return (data ?? []).map((o) => o.name);
}

async function writeMetadata(path: string, metadata: unknown): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, JSON.stringify(metadata), {
      contentType: "application/json",
      cacheControl: "300",
      upsert: true,
    });
  if (error) throw new Error(`Metadata upload failed: ${error.message}`);

  return publicUrl(path);
}
