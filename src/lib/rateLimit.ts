import type { NextRequest } from "next/server";

/**
 * Best-effort in-memory rate limiter (sliding fixed window).
 *
 * No external store — the bucket map lives in the module scope of a single
 * serverless instance. On Vercel Fluid Compute instances are reused across
 * requests, so this reliably throttles bursts from one source hitting a warm
 * instance (the naive "reserve every ticket in a loop" attack). A determined
 * attacker spreading requests across many cold instances can still get through;
 * treat this as a first line of defence, not a hard quota. For a strict global
 * limit, back it with Redis/Upstash later.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (only meaningful when ok === false). */
  retryAfter: number;
}

/**
 * Consume one token for `key`. Returns ok=false once `limit` requests have
 * arrived within `windowMs`. Keys are namespaced by the caller, e.g.
 * `checkout:<ip>`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow without bound under attack.
  if (buckets.size > MAX_TRACKED_KEYS) prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count++;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}
