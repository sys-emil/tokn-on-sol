import { NextRequest, NextResponse } from "next/server";
import { processMintJobs } from "@/lib/mintJobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Minute cron (see vercel.json): retry fallback for the async mint queue.
 *
 * The happy path mints via after() in the Stripe webhook — this cron only
 * picks up jobs whose worker crashed, timed out, or partially minted. Claiming
 * goes through claim_mint_jobs (SKIP LOCKED), so overlapping runs are safe.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { claimed, minted } = await processMintJobs(10);
    return NextResponse.json({ success: true, claimed, minted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
