import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { joinQueue, queueState } from "@/lib/queue";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * The waiting room, both halves on one route:
 *   POST /api/queue  { eventId }         → join, returns a token
 *   GET  /api/queue?eventId=…&token=…    → current position, drives promotion
 *
 * Unauthenticated by design: a buyer joins the line before they have decided
 * anything, and requiring a login here would defeat the guest checkout. The
 * token is the only credential, and holding one grants nothing except the
 * right to reach /api/checkout/create, which does all the real checks.
 */

async function queueEnabledFor(eventId: string): Promise<boolean | null> {
  const { data } = await supabaseAdmin
    .from("events")
    .select("queue_enabled, cancelled_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!data || data.cancelled_at) return null;
  return data.queue_enabled === true;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Joining is cheap but writes a row; cap it well above any human cadence.
  const rl = rateLimit(`queue-join:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { eventId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const eventId = (body.eventId ?? "").trim();
  if (!eventId) {
    return NextResponse.json({ success: false, error: "eventId is required" }, { status: 400 });
  }

  const enabled = await queueEnabledFor(eventId);
  if (enabled === null) {
    return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
  }
  if (!enabled) {
    // No queue on this event: tell the client to just buy.
    return NextResponse.json({ success: true, queueEnabled: false });
  }

  const state = await joinQueue(eventId);
  if (!state) {
    return NextResponse.json({ success: false, error: "Warteschlange nicht verfügbar." }, { status: 500 });
  }
  return NextResponse.json({ success: true, queueEnabled: true, ...state });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!eventId || !token) {
    return NextResponse.json({ success: false, error: "eventId and token are required" }, { status: 400 });
  }

  // Polling every few seconds is the normal case, so the ceiling is generous;
  // it only exists to stop a script from hammering the promotion function.
  const rl = rateLimit(`queue-status:${clientIp(req)}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const state = await queueState(eventId, token);
  if (!state) {
    // Purged or bogus: the client should re-join rather than wait forever.
    return NextResponse.json({ success: false, expired: true }, { status: 404 });
  }
  return NextResponse.json({ success: true, ...state });
}
