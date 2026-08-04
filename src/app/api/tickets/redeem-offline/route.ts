import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestMayWorkTheDoor } from "@/lib/doorAccess";
import { checkRedemptionBadges } from "@/lib/badges";
import { loadPassTicket, passCoversEvent, redeemPassForEvent } from "@/lib/seasonPass";
import { recordTicketScan, resolveScanTarget } from "@/lib/reentry";

export const dynamic = "force-dynamic";

interface OfflineRedemption {
  assetId: string;
  /** ISO timestamp of the offline scan. */
  at: string;
  /**
   * Per-scan key. Re-entry queues several scans of the same ticket, so the
   * asset ID no longer identifies a queue entry. Absent on entries queued
   * before re-entry existed; those fall back to the asset ID.
   */
  id?: string;
  /** Re-entry only: the direction this device recorded. */
  direction?: "in" | "out";
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
 *
 * On a re-entry event the entries are in/out scans instead. They are replayed
 * in the order the device recorded them, with the direction the device
 * decided — the cooldown was already enforced there and re-checking it here
 * against a later `now` would silently drop legitimate scans.
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
    .select("id, organizer_wallet, reentry_enabled")
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
  const conflicts: { key: string; assetId: string; reason: string; redeemedAt?: string }[] = [];
  const redeemedWallets = new Set<string>();
  const reentryEnabled = event.reentry_enabled === true;

  for (const r of redemptions) {
    if (!r.assetId || typeof r.assetId !== "string") continue;
    // Re-entry queues several scans per ticket, so the entry key is what the
    // device can strike off its queue, not the asset ID.
    const key = typeof r.id === "string" && r.id ? r.id : r.assetId;
    const atMs = Date.parse(r.at ?? "");
    // Reject garbage timestamps; clamp slight clock skew into the past.
    const at = Number.isFinite(atMs) && atMs <= nowMs + 60_000
      ? new Date(Math.min(atMs, nowMs)).toISOString()
      : new Date(nowMs).toISOString();

    if (reentryEnabled) {
      const resolved = await resolveScanTarget(r.assetId, eventId);
      if (!resolved.ok) {
        conflicts.push({
          key,
          assetId: r.assetId,
          reason: resolved.reason === "Ticket revoked (refunded)" ? "revoked" : "not_found",
        });
        continue;
      }
      const scan = await recordTicketScan(resolved.target.purchaseId, eventId, {
        cooldownSeconds: 0,
        at,
        direction: r.direction === "out" ? "out" : "in",
      });
      if (scan.status === "ok") {
        synced.push(key);
        if (scan.direction === "in") redeemedWallets.add(resolved.target.buyerWallet);
      } else {
        conflicts.push({ key, assetId: r.assetId, reason: scan.status });
      }
      continue;
    }

    const { data: updated } = await supabaseAdmin
      .from("purchases")
      .update({ redeemed_at: at })
      .eq("asset_id", r.assetId)
      .eq("event_id", eventId)
      .is("redeemed_at", null)
      .is("revoked_at", null)
      .select("id, buyer_wallet");

    if (updated && updated.length > 0) {
      synced.push(key);
      redeemedWallets.add((updated[0] as { buyer_wallet: string }).buyer_wallet);
      continue;
    }

    // Season passes carry no event_id, so the update above never matches one.
    // Their admission is booked per date in pass_redemptions, with the unique
    // index playing the role that `redeemed_at IS NULL` plays above.
    const passTicket = await loadPassTicket(r.assetId);
    if (passTicket) {
      if (passTicket.revokedAt) {
        conflicts.push({ key, assetId: r.assetId, reason: "revoked" });
      } else if (!(await passCoversEvent(passTicket.passId, eventId))) {
        conflicts.push({ key, assetId: r.assetId, reason: "not_found" });
      } else {
        const result = await redeemPassForEvent(passTicket.purchaseId, eventId, at);
        if (result.ok) {
          synced.push(key);
          redeemedWallets.add(passTicket.buyerWallet);
        } else {
          conflicts.push({
            key,
            assetId: r.assetId,
            reason: "already_redeemed",
            redeemedAt: result.redeemedAt ?? undefined,
          });
        }
      }
      continue;
    }

    const { data: existing } = await supabaseAdmin
      .from("purchases")
      .select("redeemed_at, revoked_at")
      .eq("asset_id", r.assetId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (!existing) {
      conflicts.push({ key, assetId: r.assetId, reason: "not_found" });
    } else if (existing.revoked_at) {
      conflicts.push({ key, assetId: r.assetId, reason: "revoked" });
    } else {
      conflicts.push({
        key,
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
