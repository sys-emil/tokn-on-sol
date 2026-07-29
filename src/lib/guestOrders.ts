import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { backupChallenge } from "@/lib/backupChallenge";
import { signAsOperator } from "@/lib/operatorSign";
import { getOperatorWalletAddress } from "@/lib/transfer";

/**
 * Guest checkout: buying without an account.
 *
 * The buyer never gets a wallet, so the cNFT is minted to the operator wallet
 * and stays there until (and unless) the guest claims it into a real account.
 * What the guest receives is a `/order/<token>` link; the token is the whole
 * credential, exactly like the `claims` tokens used for ticket sharing.
 *
 * The QR on that page is the existing static backup-ticket format signed by the
 * operator (`src/lib/operatorSign.ts`), which the door already accepts — no
 * change to the verification path. The trade-off is the one backup tickets
 * always had: a static code is copyable, and once-only redemption is what
 * carries the security. Organizers can turn it off per event via
 * `events.guest_checkout_enabled`.
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

/**
 * The QR payload for an escrowed guest ticket: the static backup format
 * `{a,w,s,b:1}` that /api/tickets/verify already understands, signed by the
 * operator because the operator is the on-chain owner.
 *
 * Returns null once the ticket has left escrow (the guest claimed it into an
 * account); the ownership check at the door would reject an operator-signed
 * code then, and the real rotating QR on /tickets/<assetId> takes over.
 */
export function guestTicketQr(assetId: string, currentOwner: string | null): string | null {
  const operator = getOperatorWalletAddress();
  if (currentOwner !== operator) return null;
  return JSON.stringify({
    a: assetId,
    w: operator,
    s: signAsOperator(backupChallenge(assetId, null)),
    b: 1,
  });
}
