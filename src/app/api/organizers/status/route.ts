import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress");

  if (!walletAddress) {
    return NextResponse.json({ status: "none" });
  }

  const { data } = await supabaseAdmin
    .from("organizers")
    .select("status")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ status: "none" });
  }

  return NextResponse.json({ status: data.status as string });
}
