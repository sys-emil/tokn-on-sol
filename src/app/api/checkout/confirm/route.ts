import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { processMintJobs } from "@/lib/mintJobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // after() may mint missing tickets once the response is sent

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sessionId = new URL(req.url).searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ found: false, error: "session_id required" }, { status: 400 });
  }

  // Get expected quantity from Stripe session metadata.
  let quantity = 1;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    quantity = Math.max(1, parseInt(session.metadata?.quantity ?? "1", 10) || 1);
  } catch {
    // If Stripe lookup fails, fall back to 1.
  }

  const { data } = await supabaseAdmin
    .from("purchases")
    .select("asset_id")
    .eq("stripe_session_id", sessionId);

  // Tickets missing? Kick the mint worker after responding. The success page
  // polls this route while the buyer waits, so a crashed webhook run gets
  // retried within seconds; important on the Hobby plan, where the cron
  // fallback (/api/cron/mint) only runs daily. Claiming is SKIP LOCKED and
  // ignores jobs touched within the last 10 minutes, so polling can't stampede.
  if ((data?.length ?? 0) < quantity) {
    after(async () => {
      try {
        await processMintJobs(3);
      } catch (err) {
        console.error("Mint kick from checkout/confirm failed:", err);
      }
    });
  }

  if (!data || data.length === 0) return NextResponse.json({ found: false, quantity });

  const assetIds = data.map((row) => row.asset_id as string);
  return NextResponse.json({ found: true, assetIds, quantity });
}
