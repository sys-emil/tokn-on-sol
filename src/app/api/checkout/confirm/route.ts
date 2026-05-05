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
    .eq("stripe_session_id", sessionId);

  if (!data || data.length === 0) return NextResponse.json({ found: false });

  const assetIds = data.map((row) => row.asset_id as string);
  return NextResponse.json({ found: true, assetIds });
}
