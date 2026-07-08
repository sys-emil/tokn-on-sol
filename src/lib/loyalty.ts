import { supabaseAdmin } from "@/lib/supabase";

/**
 * Loyalty program helpers (Pro feature). Qualification = distinct redeemed
 * events at the program organizer — the same signal as the Stammgast badge.
 */

/** Distinct redeemed events of a wallet at one organizer. */
export async function countAttendedEvents(
  wallet: string,
  organizerWallet: string,
): Promise<number> {
  const { data: orgEvents } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("organizer_wallet", organizerWallet);
  const eventIds = (orgEvents ?? []).map((e: { id: string }) => e.id);
  if (eventIds.length === 0) return 0;

  const { data: redeemed } = await supabaseAdmin
    .from("purchases")
    .select("event_id")
    .eq("buyer_wallet", wallet)
    .in("event_id", eventIds)
    .not("redeemed_at", "is", null);

  return new Set((redeemed ?? []).map((r: { event_id: string }) => r.event_id)).size;
}

/** All wallets with >= threshold distinct redeemed events at the organizer. */
export async function qualifiedCustomers(
  organizerWallet: string,
  threshold: number,
): Promise<{ wallet: string; attendedEvents: number }[]> {
  const { data: orgEvents } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("organizer_wallet", organizerWallet);
  const eventIds = (orgEvents ?? []).map((e: { id: string }) => e.id);
  if (eventIds.length === 0) return [];

  const { data: redeemed } = await supabaseAdmin
    .from("purchases")
    .select("buyer_wallet, event_id")
    .in("event_id", eventIds)
    .not("redeemed_at", "is", null);

  const perWallet = new Map<string, Set<string>>();
  for (const row of (redeemed ?? []) as { buyer_wallet: string; event_id: string }[]) {
    if (!perWallet.has(row.buyer_wallet)) perWallet.set(row.buyer_wallet, new Set());
    perWallet.get(row.buyer_wallet)!.add(row.event_id);
  }

  return [...perWallet.entries()]
    .map(([wallet, events]) => ({ wallet, attendedEvents: events.size }))
    .filter((c) => c.attendedEvents >= threshold)
    .sort((a, b) => b.attendedEvents - a.attendedEvents);
}

/** Human-friendly claim code — no ambiguous characters (0/O, 1/I/L). */
export function generateClaimCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}
