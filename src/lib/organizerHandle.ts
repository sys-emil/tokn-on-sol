/**
 * Organizer `@handle` rules, shared by the client editor (live validation),
 * the profile PUT route (authority) and the public `[handle]` page. Client-safe
 * (no server imports).
 *
 * Handles are stored lowercase without the leading `@`; the public URL is
 * `getpassly.de/@<handle>`. Uniqueness is enforced by a case-insensitive DB
 * index; the reserved list keeps handles from shadowing real top-level routes.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/** Lowercase letters, digits and underscore; must start with a letter. */
export const HANDLE_RE = /^[a-z][a-z0-9_]{2,29}$/;

/** Top-level route names (and a few brand words) that must not become handles. */
export const RESERVED_HANDLES = new Set([
  "admin", "api", "events", "shop", "dashboard", "doorman", "tickets",
  "my-tickets", "collection", "account", "hilfe", "datenschutz", "impressum",
  "become-organizer", "organizer", "organizers", "passly", "support", "app",
  "login", "signup", "settings", "about", "agb", "terms", "privacy",
]);

/** Strip a leading `@` and lowercase; does not validate. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle);
}

/** Returns the clean handle or null if it fails format / reserved checks. */
export function validateHandle(raw: string): string | null {
  const h = normalizeHandle(raw);
  if (!HANDLE_RE.test(h) || isReservedHandle(h)) return null;
  return h;
}
