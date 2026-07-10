import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";
import { doorLinkExpiry, generateDoorToken, type DoorLinkRow } from "@/lib/doorAccess";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_LINKS = 10;

interface EventRow {
  id: string;
  date: string;
  organizer_wallet: string;
}

/** Load the event and require the caller to be its organizer. */
async function gate(req: NextRequest, eventId: string): Promise<EventRow | NextResponse> {
  const { data: event, error } = await supabaseAdmin
    .from("events")
    .select("id, date, organizer_wallet")
    .eq("id", eventId)
    .single();
  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!(await requestOwnsWallet(req, event.organizer_wallet as string))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return event as EventRow;
}

function linkView(row: DoorLinkRow) {
  return {
    id: row.id,
    token: row.token,
    label: row.label,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const eventId = new URL(req.url).searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const gated = await gate(req, eventId);
  if (gated instanceof NextResponse) return gated;

  const { data } = await supabaseAdmin
    .from("door_access_links")
    .select("*")
    .eq("event_id", eventId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({ links: ((data ?? []) as DoorLinkRow[]).map(linkView) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { eventId?: string; label?: string };
  try {
    body = (await req.json()) as { eventId?: string; label?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { eventId } = body;
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const gated = await gate(req, eventId);
  if (gated instanceof NextResponse) return gated;

  const { count } = await supabaseAdmin
    .from("door_access_links")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_ACTIVE_LINKS) {
    return NextResponse.json(
      { error: `Maximal ${MAX_ACTIVE_LINKS} aktive Zugänge pro Event.` },
      { status: 409 },
    );
  }

  const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) || null : null;
  const { data, error } = await supabaseAdmin
    .from("door_access_links")
    .insert({
      event_id: eventId,
      token: generateDoorToken(),
      label,
      expires_at: doorLinkExpiry(gated.date).toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ link: linkView(data as DoorLinkRow) });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: { linkId?: string };
  try {
    body = (await req.json()) as { linkId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.linkId) return NextResponse.json({ error: "linkId is required" }, { status: 400 });

  const { data: link } = await supabaseAdmin
    .from("door_access_links")
    .select("id, event_id")
    .eq("id", body.linkId)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  const gated = await gate(req, link.event_id as string);
  if (gated instanceof NextResponse) return gated;

  // Revoke instead of delete — the row documents that the token existed.
  await supabaseAdmin
    .from("door_access_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", body.linkId)
    .is("revoked_at", null);

  return NextResponse.json({ success: true });
}
