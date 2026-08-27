import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadGuestOrder } from "@/lib/guestOrders";
import { getOperatorWalletAddress } from "@/lib/transfer";
import { mintTicket } from "@/lib/mint";
import { getAssetOwner } from "@/lib/resaleReturn";
import { requestUser } from "@/lib/sessionUser";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { isBot, botDenied } from "@/lib/botCheck";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // one on-chain mint per ticket

/**
 * Hands every ticket of a guest order to the wallet of the now-signed-in buyer.
 *
 * The ticket is **minted fresh** rather than transferred out of escrow: a
 * Bubblegum transfer clears the operator delegation, and without it Passly can
 * never move that ticket again (no sharing by link, no support re-issue). See
 * the comment at the mint call below.
 *
 * Two credentials are required together: the order token (proves possession of
 * the mail) and a signed-in session (proves where the
 * tickets should go). The token alone must not be enough to send tickets to an
 * arbitrary address.
 *
 * Partial success is real: each ticket is its own on-chain transfer. Tickets
 * that moved stay moved and are reported; the order is only marked claimed once
 * nothing is left in escrow, so a retry picks up the remainder.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`guest-claim:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  if (await isBot()) return botDenied();

  let body: { token?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json(
      { success: false, error: "token is required" },
      { status: 400 },
    );
  }

  // Das Ziel der Einloesung kommt aus der Sitzung, nie aus dem Request. Hier
  // haengt mehr daran als sonst: dieser Wert entscheidet, auf welches Konto die
  // Tickets frisch geprägt werden.
  const user = await requestUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const claimerWallet = user.walletAddress;

  const order = await loadGuestOrder(token);
  if (!order) {
    return NextResponse.json({ success: false, error: "Bestellung nicht gefunden." }, { status: 404 });
  }
  if (order.claimed_at) {
    return NextResponse.json(
      { success: false, error: "Diese Tickets wurden bereits übernommen." },
      { status: 409 },
    );
  }

  // Claim the order before moving anything. Reading `claimed_at` above is not
  // enough on its own: two concurrent requests from two different signed-in
  // wallets would both pass that check and race into the transfer loop.
  // `claimer_wallet` doubles as the mutex — the guard admits a wallet that is
  // already mid-claim, so a retry finishes the remainder, but locks out a
  // second one.
  //
  // A claim that fails permanently therefore keeps the order bound to that
  // wallet. That is deliberate: tickets may already have moved there, so
  // handing the rest to somebody else would split the order across two
  // accounts. An admin can clear `claimer_wallet` to release it.
  if (order.claimer_wallet && order.claimer_wallet !== claimerWallet) {
    return NextResponse.json(
      { success: false, error: "Diese Tickets werden gerade von einem anderen Konto übernommen." },
      { status: 409 },
    );
  }

  // Compare-and-swap against the value we just read, so a request that lost the
  // race between the check above and this update finds the row already taken.
  const claimQuery = supabaseAdmin
    .from("guest_orders")
    .update({ claimer_wallet: claimerWallet })
    .eq("id", order.id)
    .is("claimed_at", null);
  const { data: mutex } = await (order.claimer_wallet
    ? claimQuery.eq("claimer_wallet", claimerWallet)
    : claimQuery.is("claimer_wallet", null)
  ).select("id");

  if (!mutex || mutex.length === 0) {
    return NextResponse.json(
      { success: false, error: "Diese Tickets werden gerade von einem anderen Konto übernommen." },
      { status: 409 },
    );
  }

  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("asset_id, revoked_at")
    .eq("stripe_session_id", order.stripe_session_id);

  const assets = ((purchases ?? []) as { asset_id: string; revoked_at: string | null }[])
    .filter((p) => !p.revoked_at)
    .map((p) => p.asset_id);
  if (assets.length === 0) {
    return NextResponse.json(
      { success: false, error: "Zu dieser Bestellung gibt es keine gültigen Tickets." },
      { status: 409 },
    );
  }

  const operator = getOperatorWalletAddress();
  const moved: string[] = [];
  const failed: string[] = [];

  // What the fresh ticket is minted from. Same source the mint worker uses.
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("name, date, metadata_uri")
    .eq("id", order.event_id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ success: false, error: "Event nicht gefunden." }, { status: 404 });
  }
  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  for (const assetId of assets) {
    try {
      // A retry after a partial run: this row already carries a ticket that
      // belongs to the claimer, nothing left to do.
      const owner = await getAssetOwner(assetId);
      if (owner && owner !== operator) {
        if (owner === claimerWallet) moved.push(assetId);
        else failed.push(assetId);
        continue;
      }

      // Mint a NEW ticket instead of handing the escrowed one over.
      //
      // Bubblegum's `transfer` clears the operator delegation, and the
      // delegation is what lets Passly move a ticket without the owner
      // signing. A transferred ticket was therefore a dead end: its owner
      // could never share it by link, and support could never re-issue it.
      // Minting fresh costs about a fifth of a cent and keeps every ticket on
      // the same footing as one bought with an account from the start.
      //
      // The escrowed cNFT stays behind in the operator wallet, unreferenced.
      // Nobody ever held a code for it — a guest has no account until this
      // very moment — so it is inert rather than a second valid ticket.
      const { assetId: freshAssetId, signature } = await mintTicket({
        eventName: event.name as string,
        eventDate: event.date as string,
        ownerWallet: claimerWallet,
        baseUrl,
        metadataUri: (event.metadata_uri as string | null) ?? null,
      });

      // Repoint the existing row rather than adding one: the order keeps
      // exactly one purchase per ticket, so counts and refund maths stay right.
      await supabaseAdmin
        .from("purchases")
        .update({ asset_id: freshAssetId, signature, buyer_wallet: claimerWallet })
        .eq("asset_id", assetId);
      moved.push(freshAssetId);
    } catch (err) {
      console.error(`Guest claim mint failed for ${assetId}:`, err);
      failed.push(assetId);
    }
  }

  if (failed.length === 0) {
    await supabaseAdmin
      .from("guest_orders")
      .update({ claimed_at: new Date().toISOString(), claimer_wallet: claimerWallet })
      .eq("id", order.id)
      .is("claimed_at", null);
  }

  return NextResponse.json({
    success: moved.length > 0,
    claimed: moved.length,
    failed: failed.length,
    ...(failed.length > 0
      ? { error: `${failed.length} Ticket(s) konnten nicht übernommen werden. Bitte versuch es gleich noch einmal.` }
      : {}),
  });
}
