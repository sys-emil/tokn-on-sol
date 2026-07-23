// Note: NEXTAUTH_SECRET is intentionally unused here.
// Ticket authenticity is guaranteed by on-chain Ed25519 signature verification.

import { supabaseAdmin } from "@/lib/supabase";
import { heliusRpcUrl } from "@/lib/solana";
import { checkRedemptionBadges } from "@/lib/badges";
import { requestMayWorkTheDoor } from "@/lib/doorAccess";
import bs58 from "bs58";
import { NextRequest, NextResponse } from "next/server";

interface VerifyBody {
  token: string;
  eventId: string;
}

interface QrPayload {
  a: string; // assetId
  t?: number; // minuteTimestamp = Math.floor(Date.now() / 60000); absent on backup tokens
  w: string; // walletAddress (base58)
  s: string; // Ed25519 signature (base58)
  b?: number; // 1 = static backup ticket (challenge without time window)
}

interface DasAsset {
  result?: { ownership?: { owner?: string } };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ valid: false, reason: "Invalid request body" }, { status: 400 });
  }

  const { token, eventId } = body;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ valid: false, reason: "Token is required" }, { status: 400 });
  }
  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json({ valid: false, reason: "eventId is required" }, { status: 400 });
  }

  // Redemption is a door action, not a public one: only the organizer of this
  // event or a holder of a valid door access link for it may burn a ticket.
  // Without this gate anyone who captured a valid QR could POST it here and
  // mark the ticket used, locking the real guest out. The redemption below is
  // additionally scoped to this event, so the door can only redeem its own
  // tickets.
  const { data: gateEvent, error: gateError } = await supabaseAdmin
    .from("events")
    .select("organizer_wallet")
    .eq("id", eventId)
    .single();
  if (gateError || !gateEvent) {
    return NextResponse.json({ valid: false, reason: "Event not found" }, { status: 404 });
  }
  if (!(await requestMayWorkTheDoor(req, eventId, gateEvent.organizer_wallet as string))) {
    return NextResponse.json({ valid: false, reason: "Unauthorized" }, { status: 401 });
  }

  // Parse token: compact JSON { a, t, w, s }
  let payload: QrPayload;
  try {
    payload = JSON.parse(token) as QrPayload;
  } catch {
    return NextResponse.json({ valid: false, reason: "Invalid QR code" });
  }

  const { a: assetId, t, w: walletAddress, s: sigBase58 } = payload;
  const isBackup = payload.b === 1;
  if (!assetId || (!isBackup && typeof t !== "number") || !walletAddress || !sigBase58) {
    return NextResponse.json({ valid: false, reason: "Invalid QR code" });
  }

  // Step 1; Replay protection: accept current minute and previous minute.
  // Backup tickets are deliberately static (saved in advance for venues
  // without connectivity); no time window; once-only redemption plus the
  // printed personalization (ID check at the door) carry the security.
  if (!isBackup) {
    const nowMinute = Math.floor(Date.now() / 60000);
    if (t !== nowMinute && t !== nowMinute - 1) {
      return NextResponse.json({ valid: false, reason: "QR code expired" });
    }
  }

  // Step 2; Reconstruct the challenge the client signed
  const challenge = isBackup ? `passly:backup:${assetId}` : `passly:verify:${assetId}:${t}`;

  // Step 3; Decode base58 pubkey and signature, then verify Ed25519
  let pubkeyBytes: Uint8Array<ArrayBuffer>;
  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    pubkeyBytes = Uint8Array.from(bs58.decode(walletAddress));
    sigBytes = Uint8Array.from(bs58.decode(sigBase58));
  } catch {
    return NextResponse.json({ valid: false, reason: "Invalid QR code" });
  }

  let signatureValid: boolean;
  try {
    const key = await crypto.subtle.importKey("raw", pubkeyBytes, "Ed25519", false, ["verify"]);
    signatureValid = await crypto.subtle.verify(
      "Ed25519",
      key,
      sigBytes,
      new TextEncoder().encode(challenge),
    );
  } catch {
    return NextResponse.json({ valid: false, reason: "Signature verification failed" });
  }

  if (!signatureValid) {
    return NextResponse.json({ valid: false, reason: "Invalid signature" });
  }

  // Step 4; On-chain ownership check via Helius DAS
  const assetRes = await fetch(heliusRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "verify-ownership",
      method: "getAsset",
      params: { id: assetId },
    }),
    cache: "no-store",
  });

  if (!assetRes.ok) {
    return NextResponse.json({ valid: false, reason: "Ownership check failed" });
  }

  const assetJson = (await assetRes.json()) as DasAsset;
  const onChainOwner = assetJson.result?.ownership?.owner;

  if (!onChainOwner || onChainOwner !== walletAddress) {
    return NextResponse.json({ valid: false, reason: "Wallet does not own this ticket" });
  }

  // Step 5; Atomic redemption: update only if redeemed_at IS NULL (unchanged)
  const now = new Date().toISOString();

  const { data: updated } = await supabaseAdmin
    .from("purchases")
    .update({ redeemed_at: now })
    .eq("asset_id", assetId)
    .eq("event_id", eventId)
    .is("redeemed_at", null)
    .is("revoked_at", null)
    .select("id, event_id");

  if (updated && updated.length > 0) {
    const eventId = (updated[0] as { event_id: string }).event_id;
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("name")
      .eq("id", eventId)
      .single();

    // Fire badge check async; doorman can't wait for a mint
    const baseUrl = process.env.APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    void checkRedemptionBadges(walletAddress, eventId, baseUrl);

    return NextResponse.json({
      valid: true,
      assetId,
      eventName: event?.name ?? "",
      redeemedAt: now,
      backup: isBackup,
    });
  }

  // Not updated; ticket not found, wrong event, revoked (refunded), or already
  // redeemed. Scoped to this event so a ticket for a different event reads as
  // "not found" rather than leaking its state.
  const { data: existing } = await supabaseAdmin
    .from("purchases")
    .select("redeemed_at, revoked_at")
    .eq("asset_id", assetId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ valid: false, reason: "Ticket not found" });
  }

  if (existing.revoked_at) {
    return NextResponse.json({ valid: false, reason: "Ticket revoked (refunded)" });
  }

  return NextResponse.json({
    valid: false,
    reason: "Already redeemed",
    redeemedAt: existing.redeemed_at as string,
  });
}
