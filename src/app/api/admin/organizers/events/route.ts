import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Admin lookup: all events of one organizer. Gated by ADMIN_SECRET
 * (x-admin-secret), same as /api/admin/organizers. Read-only.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallet = req.nextUrl.searchParams.get("wallet") ?? "";
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, name, date, venue, price_eur, capacity, tickets_sold, is_private, cancelled_at, created_at")
    .eq("organizer_wallet", wallet)
    .order("date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] });
}
