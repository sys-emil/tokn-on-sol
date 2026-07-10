import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

/**
 * Door access links: a time-limited token per event that lets venue staff run
 * the doorman scanner without the organizer's login. The token grants exactly
 * the door surface (verify, snapshot, offline sync) for one event — nothing
 * else, and only until `expires_at` or revocation.
 */

export const DOOR_TOKEN_HEADER = "x-door-token";

export interface DoorLinkRow {
  id: string;
  event_id: string;
  token: string;
  label: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export function generateDoorToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Door links outlive the event night but not much more: event date + 2 days. */
export function doorLinkExpiry(eventDate: string): Date {
  const base = new Date(`${eventDate}T00:00:00Z`).getTime();
  const fallback = Date.now();
  return new Date((Number.isFinite(base) ? base : fallback) + 2 * 24 * 60 * 60 * 1000);
}

export async function doorTokenValidFor(req: NextRequest, eventId: string): Promise<boolean> {
  const token = req.headers.get(DOOR_TOKEN_HEADER);
  if (!token || token.length < 16) return false;

  const { data } = await supabaseAdmin
    .from("door_access_links")
    .select("expires_at, revoked_at")
    .eq("event_id", eventId)
    .eq("token", token)
    .maybeSingle();
  if (!data || data.revoked_at) return false;
  return new Date(data.expires_at as string).getTime() > Date.now();
}

/**
 * The gate for door routes (verify / snapshot / offline sync): the organizer's
 * own Privy session OR a valid door access link for exactly this event. Every
 * other organizer route keeps requiring `requestOwnsWallet` — door tokens must
 * never unlock dashboards, payouts, or guest e-mail addresses beyond the
 * snapshot the door needs.
 */
export async function requestMayWorkTheDoor(
  req: NextRequest,
  eventId: string,
  organizerWallet: string,
): Promise<boolean> {
  // Cheap DB lookup first — most doorman devices use the link, and the Privy
  // check costs two upstream API calls.
  if (await doorTokenValidFor(req, eventId)) return true;
  return requestOwnsWallet(req, organizerWallet);
}
