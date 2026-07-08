import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireProOrganizer } from "@/lib/plan";
import { sendOrganizerMessage } from "@/lib/email";

export const dynamic = "force-dynamic";

const MAX_SUBJECT = 120;
const MAX_TEXT = 2000;
const MAX_PER_EVENT_24H = 2;

/**
 * Pro feature: e-mail all ticket holders of one event (plaintext, rate-limited,
 * audit-logged in organizer_messages).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { walletAddress?: string; eventId?: string; subject?: string; text?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const walletAddress = body.walletAddress ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const eventId = body.eventId ?? "";
  const subject = (body.subject ?? "").trim();
  const text = (body.text ?? "").trim();
  if (!eventId || !subject || !text) {
    return NextResponse.json({ success: false, error: "eventId, subject und text sind erforderlich" }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT || text.length > MAX_TEXT) {
    return NextResponse.json({ success: false, error: "Betreff oder Nachricht zu lang" }, { status: 400 });
  }

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, name, organizer_wallet")
    .eq("id", eventId)
    .eq("organizer_wallet", walletAddress)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ success: false, error: "Event nicht gefunden" }, { status: 404 });
  }

  // Rate limit: at most 2 messages per event per 24 h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recent } = await supabaseAdmin
    .from("organizer_messages")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .gte("created_at", since);
  if ((recent ?? 0) >= MAX_PER_EVENT_24H) {
    return NextResponse.json(
      { success: false, error: "Limit erreicht: maximal 2 Nachrichten pro Event in 24 Stunden." },
      { status: 429 },
    );
  }

  // Recipients: distinct buyer e-mails of non-revoked tickets.
  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("stripe_session_id")
    .eq("event_id", eventId)
    .is("revoked_at", null)
    .not("stripe_session_id", "is", null);
  const sessionIds = [...new Set(
    ((purchases ?? []) as { stripe_session_id: string }[]).map((p) => p.stripe_session_id),
  )];

  const recipients = new Set<string>();
  if (sessionIds.length > 0) {
    const { data: jobs } = await supabaseAdmin
      .from("mint_jobs")
      .select("buyer_email")
      .in("stripe_session_id", sessionIds)
      .not("buyer_email", "is", null);
    for (const j of (jobs ?? []) as { buyer_email: string }[]) recipients.add(j.buyer_email);
  }

  if (recipients.size === 0) {
    return NextResponse.json({ success: false, error: "Keine erreichbaren Ticketinhaber gefunden." }, { status: 404 });
  }

  const { data: organizerRow } = await supabaseAdmin
    .from("organizers")
    .select("name, business_name")
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  const organizerName = (organizerRow?.business_name ?? organizerRow?.name ?? "dem Veranstalter") as string;

  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const sent = await sendOrganizerMessage({
    recipients: [...recipients],
    organizerName,
    eventName: event.name as string,
    subject,
    text,
    baseUrl,
  });

  await supabaseAdmin.from("organizer_messages").insert({
    organizer_wallet: walletAddress,
    event_id: eventId,
    subject,
    body: text,
    recipient_count: sent,
  });

  return NextResponse.json({ success: true, recipientCount: sent });
}
