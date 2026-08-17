// Aus src/app/api/webhooks/stripe/route.ts herausgeloest (Stand resale-v1).
// Die drei Handler des alten C2C-Weiterverkaufs. Siehe README.md.

/**
 * Settle a completed resale checkout: hand the ticket to the buyer and credit
 * the seller. Every side effect is guarded by its own marker column so a Stripe
 * retry (after a thrown error → 500) re-runs only the unfinished steps. Throws
 * on a genuine failure so the caller releases the idempotency claim and retries.
 */
async function handleResaleCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const listingId = session.metadata?.listingId;
  const assetId = session.metadata?.assetId;
  const buyerWallet = session.metadata?.buyerWallet;
  const sellerWallet = session.metadata?.sellerWallet;
  const netCents = parseInt(session.metadata?.netCents ?? "0", 10) || 0;
  if (!listingId || !assetId || !buyerWallet || !sellerWallet) {
    // Nothing we can do without the linkage; log and ack (no retry would help).
    console.error(`Resale session ${session.id} missing metadata`);
    return;
  }

  const { data: listing } = await supabaseAdmin
    .from("resale_listings")
    .select("id, status, transferred_at, credited_at, charge_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) {
    console.error(`Resale session ${session.id}: listing ${listingId} not found`);
    return;
  }

  const nowIso = new Date().toISOString();

  // Record the charge so a later refund/dispute (which have no payouts row for
  // resale) can find this listing and reverse the seller's credit.
  if (!listing.charge_id && typeof session.payment_intent === "string") {
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
    const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null;
    if (chargeId) {
      await supabaseAdmin.from("resale_listings").update({ charge_id: chargeId, updated_at: nowIso }).eq("id", listingId);
    }
  }

  // 1) Mark sold (idempotent; a retry keeps the existing sold state).
  if (listing.status !== "sold") {
    await supabaseAdmin
      .from("resale_listings")
      .update({ status: "sold", buyer_wallet: buyerWallet, sold_at: nowIso, updated_at: nowIso })
      .eq("id", listingId);
  }

  // 2) Hand over the cNFT (operator escrow → buyer). Idempotent: if a prior
  //    attempt already moved it, the buyer is the on-chain owner and we proceed.
  if (!listing.transferred_at) {
    try {
      await transferCnft({ assetId, fromWallet: getOperatorWalletAddress(), toWallet: buyerWallet });
    } catch (err) {
      const owner = await getAssetOwner(assetId);
      if (owner !== buyerWallet) throw err; // genuinely failed → let Stripe retry
    }
    // The purchase row follows the ticket so it shows on the buyer's /my-tickets.
    await supabaseAdmin.from("purchases").update({ buyer_wallet: buyerWallet }).eq("asset_id", assetId);
    await supabaseAdmin
      .from("resale_listings")
      .update({ transferred_at: nowIso, updated_at: nowIso })
      .eq("id", listingId);
  }

  // 3) Credit the seller's net proceeds as Passly credit (once).
  if (!listing.credited_at) {
    const { error: creditError } = await supabaseAdmin.rpc("add_credit", {
      p_wallet: sellerWallet,
      p_cents: netCents,
      p_reason: "resale_sale",
      p_ref: listingId,
    });
    if (creditError) throw new Error(`Credit failed: ${creditError.message}`);
    await supabaseAdmin
      .from("resale_listings")
      .update({ credited_at: nowIso, updated_at: nowIso })
      .eq("id", listingId);
  }
}

/**
 * Refund on a resale (secondary-market) charge. Resale sales have no payouts
 * row: the money moved buyer to platform, and the seller got Passly credit. On
 * a refund we claw that credit back (proportionally, idempotent via
 * credit_reversed_cents since amount_refunded is cumulative) and, on a full
 * refund, revoke the resold ticket. A negative add_credit clamps the balance at
 * 0, so an already-spent credit leaves the platform short, hence the alert.
 */
async function handleResaleRefund(charge: Stripe.Charge): Promise<void> {
  const { data: listing } = await supabaseAdmin
    .from("resale_listings")
    .select("id, seller_wallet, asset_id, net_cents, fee_cents, credit_reversed_cents, stripe_session_id")
    .eq("charge_id", charge.id)
    .maybeSingle();
  if (!listing) {
    console.error(`Refund on charge ${charge.id} with no payout row and no resale listing`);
    return;
  }

  const net = listing.net_cents as number;
  // The buyer paid the seller net plus the full fee; refunds are proportional to
  // that total, not to the seller's list price.
  const buyerTotal = net + (listing.fee_cents as number);
  const alreadyReversed = (listing.credit_reversed_cents as number) ?? 0;
  const refunded = charge.amount_refunded;
  const fullyRefunded = charge.refunded || charge.amount - refunded <= 0;

  // Reverse the seller's credit in proportion to how much of the sale was refunded.
  const target = buyerTotal > 0 ? Math.min(net, Math.round((net * refunded) / buyerTotal)) : net;
  const delta = target - alreadyReversed;
  const nowIso = new Date().toISOString();
  if (delta > 0) {
    const { error } = await supabaseAdmin.rpc("add_credit", {
      p_wallet: listing.seller_wallet,
      p_cents: -delta,
      p_reason: "resale_refund",
      p_ref: listing.id,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("resale_listings")
      .update({ credit_reversed_cents: target, updated_at: nowIso })
      .eq("id", listing.id);
  }

  if (fullyRefunded) {
    // Buyer got their money back, so the resold ticket is no longer valid.
    await supabaseAdmin
      .from("purchases")
      .update({ revoked_at: nowIso })
      .eq("asset_id", listing.asset_id)
      .is("revoked_at", null);
  }

  alertAdmin(
    `Weiterverkauf erstattet, Charge ${charge.id}`,
    `Ein weiterverkauftes Ticket wurde erstattet (${refunded} von ${charge.amount} ${charge.currency}).\n`
      + `Verkäufer-Guthaben um ${delta} Cent zurückgebucht (Ziel ${target} von ${net}).\n`
      + (fullyRefunded
        ? `Das Ticket ${listing.asset_id} wurde entwertet. Der aktuelle Besitz ist ggf. manuell zu klären.`
        : `Teil-Erstattung.`)
      + `\nListing ${listing.id}, Session ${listing.stripe_session_id}.`,
  );
}

/**
 * Chargeback on a resale charge: the platform (merchant of record) will likely
 * lose the funds, so reverse the full remaining seller credit and alert for
 * manual review. Idempotent via credit_reversed_cents.
 */
async function handleResaleDispute(dispute: Stripe.Dispute, chargeId: string): Promise<void> {
  const { data: listing } = await supabaseAdmin
    .from("resale_listings")
    .select("id, seller_wallet, asset_id, net_cents, credit_reversed_cents, stripe_session_id")
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (!listing) {
    console.error(`Dispute ${dispute.id} for unknown charge ${chargeId}`);
    return;
  }

  const net = listing.net_cents as number;
  const alreadyReversed = (listing.credit_reversed_cents as number) ?? 0;
  const delta = net - alreadyReversed;
  const nowIso = new Date().toISOString();
  if (delta > 0) {
    const { error } = await supabaseAdmin.rpc("add_credit", {
      p_wallet: listing.seller_wallet,
      p_cents: -delta,
      p_reason: "resale_dispute",
      p_ref: listing.id,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("resale_listings")
      .update({ credit_reversed_cents: net, updated_at: nowIso })
      .eq("id", listing.id);
  }

  alertAdmin(
    `Chargeback auf Weiterverkauf, ${dispute.id}`,
    `Dispute über ${dispute.amount} ${dispute.currency} auf Resale-Charge ${chargeId}.\n`
      + `Verkäufer-Guthaben (${delta} von ${net} Cent) zurückgebucht.\n`
      + `Ticket ${listing.asset_id} ggf. entwerten oder Besitz klären. Listing ${listing.id}, Session ${listing.stripe_session_id}.\n`
      + `Frist und Evidence im Stripe-Dashboard.`,
  );
}
