import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireProOrganizer } from "@/lib/plan";

export const dynamic = "force-dynamic";

const MAX_CODES_PER_EVENT = 20;
const CODE_RE = /^[A-Z0-9-]{3,24}$/;

interface CodeRow {
  id: string;
  code: string;
  percent_off: number;
  max_uses: number | null;
  uses: number;
  active: boolean;
  created_at: string;
}

function codeView(row: CodeRow) {
  return {
    id: row.id,
    code: row.code,
    percentOff: row.percent_off,
    maxUses: row.max_uses,
    uses: row.uses,
    active: row.active,
  };
}

/** Pro feature: discount / guest-list codes per event. */
async function gate(req: NextRequest, walletAddress: string, eventId: string) {
  const pro = await requireProOrganizer(req, walletAddress);
  if (!pro.ok) return pro.response;
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("organizer_wallet", walletAddress)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get("walletAddress") ?? "";
  const eventId = url.searchParams.get("eventId") ?? "";
  const denied = await gate(req, walletAddress, eventId);
  if (denied) return denied;

  const { data } = await supabaseAdmin
    .from("discount_codes")
    .select("*")
    .eq("event_id", eventId)
    .eq("active", true)
    .order("created_at", { ascending: false });
  return NextResponse.json({ codes: ((data ?? []) as CodeRow[]).map(codeView) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { walletAddress?: string; eventId?: string; code?: string; percentOff?: number; maxUses?: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const walletAddress = body.walletAddress ?? "";
  const eventId = body.eventId ?? "";
  const denied = await gate(req, walletAddress, eventId);
  if (denied) return denied;

  const code = (body.code ?? "").trim().toUpperCase();
  const percentOff = Math.floor(body.percentOff ?? 0);
  const maxUses = body.maxUses == null ? null : Math.floor(body.maxUses);
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: "Code: 3–24 Zeichen, nur A–Z, 0–9 und Bindestrich." }, { status: 400 });
  }
  if (percentOff < 1 || percentOff > 100) {
    return NextResponse.json({ error: "Rabatt muss zwischen 1 und 100 % liegen." }, { status: 400 });
  }
  if (maxUses !== null && maxUses < 1) {
    return NextResponse.json({ error: "Maximale Einlösungen müssen mindestens 1 sein." }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from("discount_codes")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("active", true);
  if ((count ?? 0) >= MAX_CODES_PER_EVENT) {
    return NextResponse.json({ error: `Maximal ${MAX_CODES_PER_EVENT} aktive Codes pro Event.` }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("discount_codes")
    .insert({ event_id: eventId, code, percent_off: percentOff, max_uses: maxUses })
    .select("*")
    .single();
  if (error || !data) {
    const msg = error?.code === "23505" ? "Diesen Code gibt es für das Event schon." : error?.message ?? "Anlegen fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: error?.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json({ code: codeView(data as CodeRow) });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: { walletAddress?: string; codeId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const walletAddress = body.walletAddress ?? "";
  if (!body.codeId) return NextResponse.json({ error: "codeId is required" }, { status: 400 });

  const { data: codeRow } = await supabaseAdmin
    .from("discount_codes")
    .select("id, event_id")
    .eq("id", body.codeId)
    .maybeSingle();
  if (!codeRow) return NextResponse.json({ error: "Code nicht gefunden" }, { status: 404 });

  const denied = await gate(req, walletAddress, codeRow.event_id as string);
  if (denied) return denied;

  // Deactivate instead of delete — uses stay auditable.
  await supabaseAdmin.from("discount_codes").update({ active: false }).eq("id", body.codeId);
  return NextResponse.json({ success: true });
}
