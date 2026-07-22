import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

export const dynamic = "force-dynamic";

// GET /api/credit?walletAddress=... — the wallet's Passly credit balance.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress");
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }
  // A wallet address is public — prove ownership before returning the balance.
  if (!(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("user_credits")
    .select("balance_cents")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  return NextResponse.json({ creditCents: (data?.balance_cents as number | undefined) ?? 0 });
}
