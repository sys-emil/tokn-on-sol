import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestUser } from "@/lib/sessionUser";
import { signAsUser } from "@/lib/wallet";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * The rotating QR code for one ticket.
 *
 * Replaces the client-side `signMessage` on the ticket page: the payload is
 * byte-identical, only the signer moved to the server. `/api/tickets/verify`
 * is therefore untouched — it verifies Ed25519 against the address the asset
 * is minted to and cannot tell where the signature was produced.
 *
 * The ticket page calls this once a minute while it is visible, so the door
 * always shows a code that is at most 60 seconds old.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
): Promise<NextResponse> {
  const { assetId } = await params;

  // Two buckets, as on /api/checkout/create, and the coarse one is deliberately
  // very generous: at a 200-person door every guest polls this once a minute
  // from behind the venue's single NAT. A limit tight enough to be interesting
  // would lock out exactly the situation the route exists for. It is a flood
  // stop, nothing more — the meaningful limit is per user, below.
  const ipLimit = rateLimit(`qr-ip:${clientIp(req)}`, 600, 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Zu viele Anfragen." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
    );
  }

  const user = await requestUser(req);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  // One ticket page refreshes ~1x/min; a few open at once is normal, a hundred
  // is not. Keyed on the user id, which a caller cannot invent — unlike a
  // wallet address in a request body.
  const userLimit = rateLimit(`qr-user:${user.id}`, 20, 60_000);
  if (!userLimit.ok) {
    return NextResponse.json(
      { error: "Zu viele Anfragen." },
      { status: 429, headers: { "Retry-After": String(userLimit.retryAfter) } },
    );
  }

  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("id, revoked_at")
    .eq("asset_id", assetId)
    .eq("buyer_wallet", user.walletAddress)
    .maybeSingle();

  // Same answer for "not yours" and "does not exist": whether a given asset id
  // is a real ticket is not something a stranger should be able to probe.
  if (!purchase) {
    return NextResponse.json({ error: "Ticket nicht gefunden." }, { status: 404 });
  }
  if (purchase.revoked_at) {
    return NextResponse.json({ error: "Dieses Ticket ist nicht mehr gültig." }, { status: 410 });
  }

  const t = Math.floor(Date.now() / 60000);
  const challenge = `passly:verify:${assetId}:${t}`;
  const signature = signAsUser(user.id, user.keyVersion, new TextEncoder().encode(challenge));

  return NextResponse.json(
    { a: assetId, t, w: user.walletAddress, s: signature },
    // The code is only valid for this minute anyway, but an intermediary
    // holding a copy of it is pointless risk.
    { headers: { "Cache-Control": "no-store" } },
  );
}
