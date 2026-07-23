import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestMayWorkTheDoor } from "@/lib/doorAccess";

export const dynamic = "force-dynamic";

/**
 * Offline snapshot for the doorman: every ticket of the event with owner
 * wallet and redemption/revocation state, compact enough to cache in
 * localStorage. With this list the doorman can keep verifying tickets in a
 * dead spot: Ed25519 signature check runs client-side, ownership comes from
 * purchases.buyer_wallet (kept current by the claim/transfer flow), and
 * once-only redemption is enforced locally until the queue is synced back
 * via /api/tickets/redeem-offline.
 *
 * Gated like the other door routes: organizer session or door access link;
 * the wallet list is not public data.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: event, error } = await supabaseAdmin
    .from("events")
    .select("id, organizer_wallet, cancelled_at")
    .eq("id", id)
    .single();
  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!(await requestMayWorkTheDoor(req, id, event.organizer_wallet as string))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("asset_id, buyer_wallet, redeemed_at, revoked_at")
    .eq("event_id", id)
    .limit(10000);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    cancelled: Boolean(event.cancelled_at),
    tickets: (purchases ?? []).map((p) => ({
      a: p.asset_id as string,
      w: p.buyer_wallet as string,
      r: p.redeemed_at ? 1 : 0,
      x: p.revoked_at ? 1 : 0,
    })),
  });
}
