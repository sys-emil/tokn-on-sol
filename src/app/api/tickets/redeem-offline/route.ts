import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestMayWorkTheDoor } from "@/lib/doorAccess";
import { checkRedemptionBadges } from "@/lib/badges";

export const dynamic = "force-dynamic";

interface OfflineRedemption {
  assetId: string;
  /** ISO timestamp of the offline scan. */
  at: string;
}

interface SyncBody {
  eventId: string;
  redemptions: OfflineRedemption[];
}

/**
 * Sync queue for offline doorman scans. Each entry is applied with the same
 * atomic once-only rule as the live verify route (redeemed_at only set while
 * NULL); a ticket that another device redeemed in the meantime comes back as
 * a conflict so the doorman UI can surface the double entry.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: SyncBody;
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId, redemptions } = body;
  if (!eventId || !Array.isArray(redemptions) || redemptions.length === 0) {
    return NextResponse.json({ error: "eventId and redemptions are required" }, { status: 400 });
  }
  if (redemptions.length > 500) {
    return NextResponse.json({ error: "at most 500 redemptions per sync" }, { status: 400 });
  }

  const { data: event, error } = await supabaseAdmin
    .from("events")
    .select("id, organizer_wallet")
    .eq("id", eventId)
    .single();
  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!(await requestMayWorkTheDoor(req, eventId, event.organizer_wallet as string))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowMs = Date.now();
  const synced: string[] = [];
  const conflicts: { assetId: string; reason: string; redeemedAt?: string }[] = [];
  const redeemedWallets = new Set<string>();

  for (const r of redemptions) {
    if (!r.assetId || typeof r.assetId !== "string") continue;
    const atMs = Date.parse(r.at ?? "");
    // Reject garbage timestamps; clamp slight clock skew into the past.
    const at = Number.isFinite(atMs) && atMs <= nowMs + 60_000
      ? new Date(Math.min(atMs, nowMs)).toISOString()
      : new Date(nowMs).toISOString();

    const { data: updated } = await supabaseAdmin
      .from("purchases")
      .update({ redeemed_at: at })
      .eq("asset_id", r.assetId)
      .eq("event_id", eventId)
      .is("redeemed_at", null)
      .is("revoked_at", null)
      .select("id, buyer_wallet");

    if (updated && updated.length > 0) {
      synced.push(r.assetId);
      redeemedWallets.add((updated[0] as { buyer_wallet: string }).buyer_wallet);
      continue;
    }

    const { data: existing } = await supabaseAdmin
      .from("purchases")
      .select("redeemed_at, revoked_at")
      .eq("asset_id", r.assetId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (!existing) {
      conflicts.push({ assetId: r.assetId, reason: "not_found" });
    } else if (existing.revoked_at) {
      conflicts.push({ assetId: r.assetId, reason: "revoked" });
    } else {
      conflicts.push({
        assetId: r.assetId,
        reason: "already_redeemed",
        redeemedAt: existing.redeemed_at as string,
      });
    }
  }

  // Offline scans count toward badges just like live scans; fire-and-forget,
  // the doorman response must not wait for badge mints.
  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  for (const wallet of redeemedWallets) {
    void checkRedemptionBadges(wallet, eventId, baseUrl).catch((err) =>
      console.error("Badge check after offline sync failed:", err),
    );
  }

  return NextResponse.json({ synced, conflicts });
}
