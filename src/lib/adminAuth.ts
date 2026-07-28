import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "./rateLimit";

/**
 * Shared gate for every ADMIN_SECRET-protected route (/api/admin/*, the manual
 * mint). One secret guards the whole admin surface, so guessing it must not be
 * free: failed attempts are throttled per IP.
 *
 * Only failures consume the budget. The admin dashboard polls several of these
 * routes with a correct secret and must never be throttled by its own traffic.
 */

const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_MS = 60_000;

function secretMatches(provided: string | null, secret: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // timingSafeEqual throws on length mismatch; comparing lengths first leaks
  // only the length, which is not the secret.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Returns `null` when the request carries the admin secret, otherwise the
 * response to return (401, or 429 once an IP has burned through its attempts).
 *
 *     const denied = requireAdmin(req);
 *     if (denied) return denied;
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SECRET;
  if (secret && secretMatches(req.headers.get("x-admin-secret"), secret)) {
    return null;
  }

  const rl = rateLimit(`admin-auth:${clientIp(req)}`, MAX_FAILED_ATTEMPTS, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
