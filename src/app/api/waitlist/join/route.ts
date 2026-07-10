import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Public waitlist signup for a sold-out event (Pro feature — active only when
 * the event's organizer is on the Pro plan). Unauthenticated by design: the
 * buyer may not have an account yet. Rate-limited like the other entry routes.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`waitlist:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { eventId?: string; email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const eventId = body.eventId ?? "";
  const email = (body.email ?? "").trim().toLowerCase();
  if (!eventId || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ success: false, error: "Bitte gib eine gültige E-Mail-Adresse an." }, { status: 400 });
  }

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, organizer_wallet, capacity, tickets_sold, tickets_reserved, cancelled_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.cancelled_at) {
    return NextResponse.json({ success: false, error: "Event nicht gefunden." }, { status: 404 });
  }

  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("plan")
    .eq("wallet_address", event.organizer_wallet)
    .maybeSingle();
  if (organizer?.plan !== "pro") {
    return NextResponse.json({ success: false, error: "Für dieses Event gibt es keine Warteliste." }, { status: 403 });
  }

  const available = Math.max(
    0,
    (event.capacity as number) - (event.tickets_sold as number) - ((event.tickets_reserved as number) ?? 0),
  );
  if (available > 0) {
    return NextResponse.json({ success: false, error: "Es sind noch Tickets verfügbar." }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from("waitlist_entries")
    .insert({ event_id: eventId, email });
  // 23505 = already on the list — same answer, signing up twice is fine.
  if (error && error.code !== "23505") {
    return NextResponse.json({ success: false, error: "Eintrag fehlgeschlagen. Bitte versuch es erneut." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
