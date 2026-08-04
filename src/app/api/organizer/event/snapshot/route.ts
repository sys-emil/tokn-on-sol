import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestMayWorkTheDoor } from "@/lib/doorAccess";
import { passTicketsForEvent } from "@/lib/seasonPass";
import { currentScanStates } from "@/lib/reentry";

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
    .select("id, organizer_wallet, cancelled_at, reentry_enabled, reentry_cooldown_seconds")
    .eq("id", id)
    .single();
  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!(await requestMayWorkTheDoor(req, id, event.organizer_wallet as string))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reentryEnabled = event.reentry_enabled === true;

  const [{ data: purchases }, { data: tiers }, passTickets, scanStates] = await Promise.all([
    supabaseAdmin
      .from("purchases")
      .select("id, asset_id, buyer_wallet, redeemed_at, revoked_at")
      .eq("event_id", id)
      .limit(10000),
    // Price categories for the box office panel; cached with the snapshot so
    // selling still works in a dead spot right after the page loaded.
    supabaseAdmin
      .from("ticket_tiers")
      .select("id, name, price_eur")
      .eq("event_id", id)
      .order("sort")
      .order("created_at"),
    // Season passes admit to this date too. Their admission is per-event
    // (pass_redemptions), so the flag is resolved here and folded into the
    // same list; the offline verifier needs no pass logic of its own.
    passTicketsForEvent(id),
    // Only re-entry events need the in/out log; for everyone else the flat
    // redeemed flag is the whole truth and this stays an empty map.
    reentryEnabled ? currentScanStates(id) : Promise.resolve(new Map()),
  ]);

  // `d` is the guest's current side of the door: 1 = inside. A ticket admitted
  // before re-entry was switched on has no scan row, so its redeemed flag
  // stands in for "inside" — the same fallback the SQL function applies.
  const doorState = (purchaseId: string, admitted: boolean) => {
    if (!reentryEnabled) return {};
    const scan = scanStates.get(purchaseId);
    if (!scan) return admitted ? { d: 1 as const } : {};
    return scan.direction === "in" ? { d: 1 as const, ls: scan.at } : { ls: scan.at };
  };

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    cancelled: Boolean(event.cancelled_at),
    reentry: {
      enabled: reentryEnabled,
      cooldownSeconds: (event.reentry_cooldown_seconds as number) ?? 0,
    },
    tiers: (tiers ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      priceCents: t.price_eur as number,
    })),
    tickets: [
      ...(purchases ?? []).map((p) => ({
        a: p.asset_id as string,
        w: p.buyer_wallet as string,
        r: p.redeemed_at ? 1 : 0,
        x: p.revoked_at ? 1 : 0,
        ...doorState(p.id as string, Boolean(p.redeemed_at)),
      })),
      ...passTickets.map((p) => ({
        a: p.assetId,
        w: p.buyerWallet,
        r: p.redeemedHere ? 1 : 0,
        x: p.revoked ? 1 : 0,
        p: 1 as const,
        ...doorState(p.purchaseId, p.redeemedHere),
      })),
    ],
  });
}
