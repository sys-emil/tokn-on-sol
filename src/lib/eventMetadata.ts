import { supabaseAdmin } from "@/lib/supabase";

/**
 * Static per-event cNFT metadata in Supabase Storage (public bucket
 * `event-assets`). The mint stamps this URL on-chain, so it must stay
 * reachable independently of the app deployment — unlike the legacy
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
 * Writes the metadata JSON for an event and returns its public URL.
 * Upserts, so re-running (e.g. after adding an image) refreshes the file —
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

  const path = `metadata/${eventId}.json`;
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
