import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

interface VerifyBody {
  token: string;
}

interface QrPayload {
  assetId: string;
  exp: number;
}

async function verifyHmac(payloadStr: string, sigHex: string): Promise<boolean> {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadStr));
  const expectedHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expectedHex.length !== sigHex.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ sigHex.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ valid: false, reason: "Invalid request body" }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ valid: false, reason: "Token is required" }, { status: 400 });
  }

  // Parse token: base64(payload).hexsig
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) {
    return NextResponse.json({ valid: false, reason: "Invalid QR code" });
  }

  const payloadB64 = token.slice(0, lastDot);
  const sigHex = token.slice(lastDot + 1);

  let payload: QrPayload;
  let payloadStr: string;
  try {
    payloadStr = Buffer.from(payloadB64, "base64").toString("utf8");
    payload = JSON.parse(payloadStr) as QrPayload;
  } catch {
    return NextResponse.json({ valid: false, reason: "Invalid QR code" });
  }

  if (!payload.assetId || typeof payload.exp !== "number") {
    return NextResponse.json({ valid: false, reason: "Invalid QR code" });
  }

  // Verify signature
  const signatureValid = await verifyHmac(payloadStr, sigHex);
  if (!signatureValid) {
    return NextResponse.json({ valid: false, reason: "Invalid signature" });
  }

  // Check expiry (5 minutes)
  if (Date.now() > payload.exp) {
    return NextResponse.json({ valid: false, reason: "QR code expired" });
  }

  const { assetId } = payload;
  const now = new Date().toISOString();

  // Atomic redemption: update only if redeemed_at IS NULL
  const { data: updated } = await supabaseAdmin
    .from("purchases")
    .update({ redeemed_at: now })
    .eq("asset_id", assetId)
    .is("redeemed_at", null)
    .select("id, event_id");

  if (updated && updated.length > 0) {
    // Successfully redeemed — fetch event name
    const eventId = (updated[0] as { event_id: string }).event_id;
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("name")
      .eq("id", eventId)
      .single();

    return NextResponse.json({
      valid: true,
      assetId,
      eventName: event?.name ?? "",
      redeemedAt: now,
    });
  }

  // Not updated — either ticket not found or already redeemed
  const { data: existing } = await supabaseAdmin
    .from("purchases")
    .select("redeemed_at")
    .eq("asset_id", assetId)
    .single();

  if (!existing) {
    return NextResponse.json({ valid: false, reason: "Ticket not found" });
  }

  return NextResponse.json({
    valid: false,
    reason: "Already redeemed",
    redeemedAt: existing.redeemed_at as string,
  });
}
