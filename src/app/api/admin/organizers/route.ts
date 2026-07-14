import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendOrganizerApplicationDecision } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Admin API for organizer-application review. Gated by ADMIN_SECRET
 * (x-admin-secret header from /admin/organizers), same pattern as
 * /api/admin/payouts.
 *
 * GET  → all organizer rows (pending first).
 * POST → { walletAddress, action: "approve" | "reject", reason? }
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("organizers")
    .select("id, wallet_address, email, name, type, business_name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ organizers: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { walletAddress?: string; action?: string; reason?: string };
  try {
    body = (await req.json()) as { walletAddress?: string; action?: string; reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { walletAddress, action, reason } = body;
  if (!walletAddress || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "walletAddress and a valid action are required" }, { status: 400 });
  }

  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("wallet_address, email, name, status")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (!organizer) {
    return NextResponse.json({ error: "Organizer not found" }, { status: 404 });
  }
  if (organizer.status !== "pending") {
    return NextResponse.json(
      { error: `Only pending applications can be reviewed (current status: "${organizer.status}")` },
      { status: 409 },
    );
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";
  const { error } = await supabaseAdmin
    .from("organizers")
    .update({ status: nextStatus })
    .eq("wallet_address", walletAddress);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  void sendOrganizerApplicationDecision({
    to: organizer.email as string,
    name: organizer.name as string,
    approved: action === "approve",
    reason,
    baseUrl,
  }).catch(() => {});

  return NextResponse.json({ success: true, status: nextStatus });
}
