import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Virtual waiting room for on-sales with more demand than capacity.
 *
 * A buyer joins once and holds a token. `admit_from_queue` promotes waiting
 * tokens in order until `events.queue_slots` buyers hold a live slot; an
 * admitted token is what `/api/checkout/create` demands before it will reserve
 * seats. Slots expire on their own, so a buyer who wanders off frees their
 * place without anyone having to clean up.
 *
 * Every status poll drives the promotion, which means the queue advances
 * whenever anyone is watching — no cron needed for the normal case.
 */

/** How long an admitted buyer keeps their checkout slot. */
export const QUEUE_HOLD_MINUTES = 10;

export interface QueueState {
  token: string;
  admitted: boolean;
  /** 1 = next in line. 0 once admitted. */
  position: number;
  /** Seconds left on the slot; null while still waiting. */
  secondsLeft: number | null;
}

function generateQueueToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Places a new buyer at the end of the line for this event. */
export async function joinQueue(eventId: string): Promise<QueueState | null> {
  const token = generateQueueToken();
  const { error } = await supabaseAdmin
    .from("queue_tokens")
    .insert({ event_id: eventId, token });
  if (error) return null;

  // Admit immediately when the room isn't full; the common case for a queue
  // that is switched on defensively but never actually saturates.
  await supabaseAdmin.rpc("admit_from_queue", {
    p_event_id: eventId,
    p_hold_minutes: QUEUE_HOLD_MINUTES,
  });
  return queueState(eventId, token);
}

/**
 * Current state of one token, after giving the queue a chance to advance.
 * Returns null for an unknown token (expired and purged, or never existed).
 */
export async function queueState(eventId: string, token: string): Promise<QueueState | null> {
  await supabaseAdmin.rpc("admit_from_queue", {
    p_event_id: eventId,
    p_hold_minutes: QUEUE_HOLD_MINUTES,
  });

  const { data: row } = await supabaseAdmin
    .from("queue_tokens")
    .select("seq, admitted_at, expires_at")
    .eq("event_id", eventId)
    .eq("token", token)
    .maybeSingle();
  if (!row) return null;

  const admittedAt = row.admitted_at as string | null;
  const expiresAt = row.expires_at as string | null;

  if (admittedAt && expiresAt && new Date(expiresAt).getTime() > Date.now()) {
    return {
      token,
      admitted: true,
      position: 0,
      secondsLeft: Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)),
    };
  }

  // Still waiting (or the slot lapsed): position is how many are ahead.
  const { count } = await supabaseAdmin
    .from("queue_tokens")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .is("admitted_at", null)
    .lt("seq", row.seq as number);

  return { token, admitted: false, position: (count ?? 0) + 1, secondsLeft: null };
}

/**
 * Gate for the checkout route: true when this token currently holds a live
 * slot for the event. Anything else (missing, unknown, waiting, expired) is a
 * no, so a buyer can't skip the line by inventing a token.
 */
export async function holdsQueueSlot(eventId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const { data } = await supabaseAdmin
    .from("queue_tokens")
    .select("admitted_at, expires_at")
    .eq("event_id", eventId)
    .eq("token", token)
    .maybeSingle();
  if (!data?.admitted_at || !data.expires_at) return false;
  return new Date(data.expires_at as string).getTime() > Date.now();
}
