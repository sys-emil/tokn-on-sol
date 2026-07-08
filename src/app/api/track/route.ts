import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Only allowlisted event names are stored — the table never becomes a dumping
// ground for arbitrary client input.
const ALLOWED_EVENTS = new Set([
  "page_view",
  "checkout_started",
  "purchase_completed",
  "ticket_viewed",
]);

const MAX_PROPS_BYTES = 1024;

/**
 * First-party analytics sink. Requires the consent + cid cookies; anything
 * else is dropped silently. Always responds 204 — tracking must never surface
 * errors to the client or block anything.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const noContent = new NextResponse(null, { status: 204 });

  const consent = req.cookies.get("passly_consent")?.value;
  const cid = req.cookies.get("passly_cid")?.value;
  if (consent !== "granted" || !cid || cid.length > 64) return noContent;

  let body: { name?: string; path?: string; referrer?: string | null; props?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return noContent;
  }

  const name = typeof body.name === "string" ? body.name : "";
  if (!ALLOWED_EVENTS.has(name)) return noContent;

  let props: Record<string, unknown> = {};
  if (body.props && typeof body.props === "object" && !Array.isArray(body.props)) {
    const serialized = JSON.stringify(body.props);
    if (serialized.length <= MAX_PROPS_BYTES) props = body.props as Record<string, unknown>;
  }

  await supabaseAdmin.from("analytics_events").insert({
    cid,
    name,
    path: typeof body.path === "string" ? body.path.slice(0, 300) : null,
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 300) : null,
    props,
  });

  return noContent;
}
