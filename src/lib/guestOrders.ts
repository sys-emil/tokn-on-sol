import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Guest checkout: paying without an account, creating one only afterwards.
 *
 * The buyer has no wallet at checkout time, so the cNFT is minted to the
 * operator wallet and held there. What the guest receives is a `/order/<token>`
 * link; signing in on that page moves the tickets into their own account, and
 * only then does a scannable code exist.
 *
 * That ordering is the whole design. An earlier version rendered a static,
 * operator-signed QR straight onto the order page so no account was ever
 * needed; it was dropped because such a code is copyable and the link carrying
 * it travels by e-mail. Keeping every ticket on the rotating-QR model is worth
 * the one login. `events.guest_checkout_enabled` still lets an organizer
 * require the account up front instead.
 */

export interface GuestOrder {
  id: string;
  token: string;
  stripe_session_id: string;
  event_id: string;
  email: string | null;
  lang: string;
  claimed_at: string | null;
  claimer_wallet: string | null;
}

export function generateOrderToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Records a guest order for a completed checkout session. Idempotent: a second
 * webhook delivery for the same session keeps the first token, so a link that
 * was already mailed out never stops working.
 */
export async function ensureGuestOrder(params: {
  stripeSessionId: string;
  eventId: string;
  email: string | null;
  lang?: string;
}): Promise<GuestOrder | null> {
  const { stripeSessionId, eventId, email, lang } = params;

  const { data: existing } = await supabaseAdmin
    .from("guest_orders")
    .select("*")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();
  if (existing) return existing as GuestOrder;

  const { data, error } = await supabaseAdmin
    .from("guest_orders")
    .insert({
      token: generateOrderToken(),
      stripe_session_id: stripeSessionId,
      event_id: eventId,
      email,
      lang: lang ?? "de",
    })
    .select("*")
    .maybeSingle();

  // A concurrent delivery may have won the unique index; re-read rather than fail.
  if (error?.code === "23505") {
    const { data: raced } = await supabaseAdmin
      .from("guest_orders")
      .select("*")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle();
    return (raced as GuestOrder | null) ?? null;
  }
  if (error) throw new Error(`Failed to create guest order: ${error.message}`);
  return (data as GuestOrder | null) ?? null;
}

export async function loadGuestOrder(token: string): Promise<GuestOrder | null> {
  if (!token || token.length < 16) return null;
  const { data } = await supabaseAdmin
    .from("guest_orders")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return (data as GuestOrder | null) ?? null;
}
