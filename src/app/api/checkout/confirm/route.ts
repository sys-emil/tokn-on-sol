import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

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

  // Fetch expected quantity from Stripe so we wait for all tickets to mint
  let expectedQty = 1;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    expectedQty = parseInt(session.metadata?.quantity ?? "1", 10) || 1;
  } catch {
    // If Stripe call fails, proceed with what we have
    expectedQty = data.length;
  }

  if (data.length < expectedQty) return NextResponse.json({ found: false });

  const assetIds = data.map((row) => row.asset_id as string);
  return NextResponse.json({ found: true, assetIds });
}
