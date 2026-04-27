import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sessionId = new URL(req.url).searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ found: false, error: "session_id required" }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from("purchases")
    .select("asset_id")
    .eq("stripe_session_id", sessionId)
    .single();

  if (!data) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, assetId: data.asset_id });
}
