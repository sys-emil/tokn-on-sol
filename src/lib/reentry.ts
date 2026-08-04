import { supabaseAdmin } from "@/lib/supabase";
import { loadPassTicket, passCoversEvent } from "@/lib/seasonPass";

/**
 * Re-entry: some events let guests step outside and come back (smoking area,
 * festival grounds, a club with an outdoor yard). Admission then stops being
 * "used yes/no" and becomes a direction: the same QR scanned again checks the
 * guest out, the next scan checks them back in.
 *
 * The log lives in `ticket_scans` (append-only, one row per scan);
 * `purchases.redeemed_at` and `pass_redemptions` keep their old meaning of
 * "was admitted at least once", written by the first 'in'. Everything that
 * reads those (badges, the offline snapshot, the dashboard counters) is
 * therefore unaffected by whether re-entry is on.
 *
 * The toggle is per event (`events.reentry_enabled`). While it is off, the
 * verify route runs exactly the code it always ran — a second scan is a
 * rejected duplicate, not an exit.
 *
 * The cooldown (`events.reentry_cooldown_seconds`) is the anti-abuse part: a
 * ticket cannot flip state again until it has passed, so one QR can't be
 * waved past the scanner repeatedly to walk a queue of people in. Enforced in
 * the SQL function against the last scan of that ticket at that event, which
 * is where the row lock already is.
 */

export const DEFAULT_REENTRY_COOLDOWN_SECONDS = 120;
export const MAX_REENTRY_COOLDOWN_SECONDS = 3600;

export interface ReentryConfig {
  enabled: boolean;
  cooldownSeconds: number;
}

export type ScanDirection = "in" | "out";

/** The purchase row a scanned asset resolves to at this event. */
export interface ScanTarget {
  purchaseId: string;
  buyerWallet: string;
  seasonPass: boolean;
  passName?: string;
}

export type ScanTargetResult =
  | { ok: true; target: ScanTarget }
  | { ok: false; reason: "Ticket not found" | "Ticket revoked (refunded)" };

/**
 * Finds the ticket behind an asset ID for this event — an ordinary purchase
 * or a season pass whose series covers the date. A pass for a different
 * series reads as "not found", same as a ticket for another event: the door
 * learns nothing about tickets it may not scan.
 */
export async function resolveScanTarget(assetId: string, eventId: string): Promise<ScanTargetResult> {
  const { data } = await supabaseAdmin
    .from("purchases")
    .select("id, buyer_wallet, revoked_at")
    .eq("asset_id", assetId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (data) {
    if (data.revoked_at) return { ok: false, reason: "Ticket revoked (refunded)" };
    return {
      ok: true,
      target: {
        purchaseId: data.id as string,
        buyerWallet: data.buyer_wallet as string,
        seasonPass: false,
      },
    };
  }

  const pass = await loadPassTicket(assetId);
  if (!pass) return { ok: false, reason: "Ticket not found" };
  if (pass.revokedAt) return { ok: false, reason: "Ticket revoked (refunded)" };
  if (!(await passCoversEvent(pass.passId, eventId))) return { ok: false, reason: "Ticket not found" };

  return {
    ok: true,
    target: {
      purchaseId: pass.purchaseId,
      buyerWallet: pass.buyerWallet,
      seasonPass: true,
      passName: pass.passName,
    },
  };
}

export type ScanResult =
  | { status: "ok"; direction: ScanDirection; lastScanAt: string | null }
  | { status: "cooldown"; direction: ScanDirection; lastScanAt: string; retryInSeconds: number }
  | { status: "not_found" }
  | { status: "revoked" }
  | { status: "error" };

interface ScanRow {
  status: string;
  direction: string | null;
  last_scan_at: string | null;
}

/**
 * Records one in/out scan atomically (the SQL function locks the purchase row
 * before deciding, so two doormen scanning the same ticket at the same moment
 * cannot both write an 'in').
 *
 * `direction` is only passed by the offline sync, where the device already
 * decided the direction from its cached snapshot and enforced the cooldown
 * locally; live scans leave it undefined and let the function toggle.
 */
export async function recordTicketScan(
  purchaseId: string,
  eventId: string,
  opts: { cooldownSeconds: number; at: string; direction?: ScanDirection },
): Promise<ScanResult> {
  const { data, error } = await supabaseAdmin.rpc("record_ticket_scan", {
    p_purchase_id: purchaseId,
    p_event_id: eventId,
    p_cooldown_seconds: Math.max(0, Math.floor(opts.cooldownSeconds)),
    p_at: opts.at,
    p_direction: opts.direction ?? null,
  });

  if (error) {
    console.error("record_ticket_scan failed:", error);
    return { status: "error" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as ScanRow | undefined;
  if (!row) return { status: "error" };

  if (row.status === "cooldown" && row.last_scan_at) {
    const elapsed = (Date.parse(opts.at) - Date.parse(row.last_scan_at)) / 1000;
    return {
      status: "cooldown",
      // The direction of the last scan: "in" means the guest is inside and
      // has to wait before checking out again.
      direction: row.direction === "out" ? "out" : "in",
      lastScanAt: row.last_scan_at,
      retryInSeconds: Math.max(1, Math.ceil(opts.cooldownSeconds - elapsed)),
    };
  }

  if (row.status === "ok" && (row.direction === "in" || row.direction === "out")) {
    return { status: "ok", direction: row.direction, lastScanAt: row.last_scan_at };
  }

  if (row.status === "revoked") return { status: "revoked" };
  if (row.status === "not_found") return { status: "not_found" };
  return { status: "error" };
}

/** Current in/out state per purchase for one event, for the door snapshot. */
export async function currentScanStates(eventId: string): Promise<Map<string, { direction: ScanDirection; at: string }>> {
  const { data } = await supabaseAdmin
    .from("ticket_scans")
    .select("purchase_id, direction, scanned_at")
    .eq("event_id", eventId)
    .order("scanned_at", { ascending: true })
    .limit(50000);

  const state = new Map<string, { direction: ScanDirection; at: string }>();
  for (const row of data ?? []) {
    // Ascending order, so the last write per purchase wins.
    state.set(row.purchase_id as string, {
      direction: row.direction === "out" ? "out" : "in",
      at: row.scanned_at as string,
    });
  }
  return state;
}
