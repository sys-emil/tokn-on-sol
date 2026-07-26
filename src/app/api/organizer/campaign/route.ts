import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireProOrganizer } from "@/lib/plan";
import { loadCustomers, segmentRecipients } from "@/lib/organizerCustomers";
import { SEGMENT_LABEL, parseSegment } from "@/lib/proAnalytics";
import { sendOrganizerCampaign } from "@/lib/email";

export const dynamic = "force-dynamic";

const MAX_SUBJECT = 120;
const MAX_TEXT = 2000;
const MAX_PER_24H = 2;

/**
 * Pro feature: e-mail one customer segment of an organizer. Same guard rails as
 * the per-event message route — plaintext only, hard cap of 2 campaigns per
 * organizer per 24 h, audit-logged in `organizer_campaigns`. The recipient set
 * is recomputed here from the segment id; the client never sends addresses.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { walletAddress?: string; segment?: string; subject?: string; text?: string; preview?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const walletAddress = body.walletAddress ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const segment = parseSegment(body.segment);
  const segmentLabel = segment === "alle" ? "Alle Kunden" : SEGMENT_LABEL[segment];

  const customers = await loadCustomers(walletAddress);
  const recipients = segmentRecipients(customers, segment);

  if (body.preview) {
    return NextResponse.json({ success: true, segment, segmentLabel, recipientCount: recipients.length });
  }

  const subject = (body.subject ?? "").trim();
  const text = (body.text ?? "").trim();
  if (!subject || !text) {
    return NextResponse.json({ success: false, error: "Betreff und Nachricht sind erforderlich" }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT || text.length > MAX_TEXT) {
    return NextResponse.json({ success: false, error: "Betreff oder Nachricht zu lang" }, { status: 400 });
  }
  if (recipients.length === 0) {
    return NextResponse.json({ success: false, error: "In diesem Segment ist niemand erreichbar." }, { status: 404 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recent } = await supabaseAdmin
    .from("organizer_campaigns")
    .select("*", { count: "exact", head: true })
    .eq("organizer_wallet", walletAddress)
    .gte("created_at", since);
  if ((recent ?? 0) >= MAX_PER_24H) {
    return NextResponse.json(
      { success: false, error: `Limit erreicht: maximal ${MAX_PER_24H} Kampagnen in 24 Stunden.` },
      { status: 429 },
    );
  }

  const { data: organizerRow } = await supabaseAdmin
    .from("organizers")
    .select("name, business_name, public_name")
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  const organizerName = (organizerRow?.public_name
    ?? organizerRow?.business_name
    ?? organizerRow?.name
    ?? "dem Veranstalter") as string;

  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const sent = await sendOrganizerCampaign({
    recipients,
    organizerName,
    segmentLabel,
    subject,
    text,
    baseUrl,
  });

  await supabaseAdmin.from("organizer_campaigns").insert({
    organizer_wallet: walletAddress,
    segment,
    subject,
    body: text,
    recipient_count: sent,
  });

  return NextResponse.json({ success: true, recipientCount: sent });
}
