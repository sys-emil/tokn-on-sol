import { supabaseAdmin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { mintTicket } from "@/lib/mint";
import { sendTicketConfirmation, sendAdminAlert } from "@/lib/email";
import { checkPurchaseBadges } from "@/lib/badges";

/**
 * Async mint queue (decouples slow Bubblegum mints from the Stripe webhook).
 *
 * The webhook inserts a mint_jobs row and returns 200 immediately; the actual
 * minting runs afterwards — first via `after()` in the webhook invocation,
 * with a minute cron (`/api/cron/mint`) as retry fallback for crashed or
 * partially completed runs.
 *
 * Jobs are claimed atomically via the `claim_mint_jobs` SQL function
 * (FOR UPDATE SKIP LOCKED), so concurrent workers never process the same job.
 * The purchases table (one row per minted ticket, keyed by session) is the
 * authoritative minted count — a re-run only mints what is still missing.
 */

const MAX_ATTEMPTS = 5;

export interface MintJob {
  id: string;
  stripe_session_id: string;
  event_id: string;
  tier_id: string | null;
  buyer_wallet: string;
  buyer_email: string | null;
  quantity: number;
  status: "queued" | "processing" | "done" | "failed";
  attempts: number;
  last_error: string | null;
  refund_id: string | null;
}

export const mintJobsSiteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/**
 * The buyer paid but (some of) their tickets could never be minted — refund
 * the unminted share automatically. Returns a human-readable outcome line for
 * the admin alert. `refund_id` on the job is the once-only gate; the Stripe
 * call additionally carries an idempotency key derived from the job ID.
 *
 * The resulting charge.refunded webhook does the bookkeeping: full refund →
 * payout 'refunded' + seats freed; partial refund → organizer share recomputed
 * (seats for the unminted remainder are freed here, since the webhook cannot
 * know which part of a partial refund was undelivered tickets).
 */
async function autoRefundFailedJob(job: MintJob, totalMinted: number): Promise<string> {
  const missing = job.quantity - totalMinted;
  if (missing <= 0) return "No refund needed (all tickets minted)";

  const { data: payout } = await supabaseAdmin
    .from("payouts")
    .select("payment_intent_id, charge_id, gross_cents, currency, status")
    .eq("stripe_session_id", job.stripe_session_id)
    .maybeSingle();

  if (!payout || (!payout.payment_intent_id && !payout.charge_id)) {
    return "No refund issued (free tickets or missing payout row)";
  }
  if (payout.status === "paid") {
    return "NO auto-refund: funds were already transferred to the organizer — refund manually";
  }
  if (payout.status === "refunded") return "Charge already fully refunded";
  if (payout.status === "disputed") return "NO auto-refund: charge is disputed — resolve the dispute first";

  // Claim the refund exactly once.
  const { data: gate } = await supabaseAdmin
    .from("mint_jobs")
    .update({ refund_id: "pending", updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .is("refund_id", null)
    .select("id");
  if (!gate || gate.length === 0) return "Refund already issued by an earlier run";

  const amountCents = Math.min(
    Math.round((payout.gross_cents * missing) / job.quantity),
    payout.gross_cents,
  );

  try {
    const refund = await stripe.refunds.create(
      {
        ...(payout.payment_intent_id
          ? { payment_intent: payout.payment_intent_id }
          : { charge: payout.charge_id as string }),
        amount: amountCents,
        metadata: { mint_job_id: job.id, cause: "mint_failed" },
      },
      { idempotencyKey: `mint-refund-${job.id}` },
    );

    await supabaseAdmin
      .from("mint_jobs")
      .update({ refund_id: refund.id, updated_at: new Date().toISOString() })
      .eq("id", job.id);

    // Partial failure: free the seats of the unminted tickets so they can be
    // resold. (Full failure is handled by the charge.refunded webhook.)
    if (totalMinted > 0) {
      await supabaseAdmin.rpc("release_sold_seats", {
        p_event_id: job.event_id,
        p_quantity: missing,
        p_tier_id: job.tier_id,
      });
    }

    return `Auto-refunded ${(amountCents / 100).toFixed(2)} ${payout.currency ?? "eur"} for ${missing} unminted ticket(s): ${refund.id}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("mint_jobs")
      .update({ refund_id: null, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return `Auto-refund FAILED (${message}) — refund manually`;
  }
}

async function processOneJob(job: MintJob, baseUrl: string): Promise<number> {
  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("name, date, metadata_uri")
    .eq("id", job.event_id)
    .single();
  if (eventError || !event) {
    throw new Error(`Event ${job.event_id} not found: ${eventError?.message ?? "no row"}`);
  }

  const { data: existing } = await supabaseAdmin
    .from("purchases")
    .select("asset_id")
    .eq("stripe_session_id", job.stripe_session_id);
  const alreadyMinted = existing?.length ?? 0;
  const toMint = job.quantity - alreadyMinted;

  // Mint sequentially — Bubblegum appends one leaf at a time; parallel
  // transactions to the same tree conflict. Retry each mint up to 3 times.
  let minted = 0;
  let lastError: string | null = null;
  for (let i = 0; i < toMint; i++) {
    const ticketNum = alreadyMinted + i + 1;

    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
      try {
        const { assetId, signature } = await mintTicket({
          eventName: event.name,
          eventDate: event.date,
          ownerWallet: job.buyer_wallet,
          baseUrl,
          metadataUri: event.metadata_uri,
        });

        await supabaseAdmin.from("purchases").insert({
          event_id: job.event_id,
          tier_id: job.tier_id,
          buyer_wallet: job.buyer_wallet,
          asset_id: assetId,
          signature,
          stripe_session_id: job.stripe_session_id,
        });

        console.info(`Ticket ${ticketNum}/${job.quantity} minted → assetId=${assetId} sig=${signature}`);
        minted++;
        success = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`Ticket ${ticketNum}/${job.quantity} attempt ${attempt + 1} failed:`, err);
      }
    }

    // Stop the run on a persistent failure — remaining tickets are picked up
    // by the next claim (this run's progress is already in purchases).
    if (!success) break;
  }

  const totalMinted = alreadyMinted + minted;

  if (totalMinted >= job.quantity) {
    await supabaseAdmin
      .from("mint_jobs")
      .update({ status: "done", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", job.id);

    // Purchase-time badges (Frühstarter, Early Bird) — must not delay the job.
    void checkPurchaseBadges(job.buyer_wallet, job.event_id, baseUrl).catch((err) =>
      console.error("Purchase badge check failed:", err),
    );

    // One confirmation email per completed job, listing every ticket of the session.
    if (job.buyer_email) {
      const { data: all } = await supabaseAdmin
        .from("purchases")
        .select("asset_id")
        .eq("stripe_session_id", job.stripe_session_id);
      const assetIds = (all ?? []).map((r) => r.asset_id as string);
      if (assetIds.length > 0) {
        void sendTicketConfirmation({
          to: job.buyer_email,
          eventName: event.name,
          eventDate: event.date,
          assetIds,
          baseUrl,
        }).catch((err) => console.error("Confirmation email failed:", err));
      }
    }
    return minted;
  }

  const exhausted = job.attempts >= MAX_ATTEMPTS;
  await supabaseAdmin
    .from("mint_jobs")
    .update({
      status: exhausted ? "failed" : "queued",
      last_error: lastError ?? `minted ${totalMinted}/${job.quantity}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (exhausted) {
    // Paid but not fully delivered — refund the undelivered share
    // automatically, then tell a human what happened.
    let refundNote: string;
    try {
      refundNote = await autoRefundFailedJob(job, totalMinted);
    } catch (err) {
      refundNote = `Auto-refund crashed (${err instanceof Error ? err.message : String(err)}) — refund manually`;
    }
    console.error(`Mint job ${job.id} failed permanently: ${refundNote}`);

    void sendAdminAlert({
      subject: `Mint job failed permanently — session ${job.stripe_session_id}`,
      text: `Mint job ${job.id} gave up after ${job.attempts} attempts.\n`
        + `Event: ${event.name} (${job.event_id})\n`
        + `Buyer wallet: ${job.buyer_wallet}\n`
        + `Minted ${totalMinted}/${job.quantity} tickets.\n`
        + `Last error: ${lastError ?? "unknown"}\n\n`
        + `Refund: ${refundNote}`,
    }).catch((err) => console.error("Admin alert failed:", err));
  }
  return minted;
}

export async function processMintJobs(limit = 5, baseUrl = mintJobsSiteUrl): Promise<{
  claimed: number;
  minted: number;
}> {
  // Jobs whose final attempt crashed mid-run stay 'processing' forever and are
  // no longer claimable — mark them failed and run the same refund + alert
  // path as a normally exhausted job.
  const { data: crashedJobs } = await supabaseAdmin
    .from("mint_jobs")
    .update({ status: "failed", last_error: "worker crashed on final attempt", updated_at: new Date().toISOString() })
    .eq("status", "processing")
    .gte("attempts", MAX_ATTEMPTS)
    .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select("*");

  for (const job of (crashedJobs ?? []) as MintJob[]) {
    const { data: existing } = await supabaseAdmin
      .from("purchases")
      .select("asset_id")
      .eq("stripe_session_id", job.stripe_session_id);
    const totalMinted = existing?.length ?? 0;

    let refundNote: string;
    try {
      refundNote = await autoRefundFailedJob(job, totalMinted);
    } catch (err) {
      refundNote = `Auto-refund crashed (${err instanceof Error ? err.message : String(err)}) — refund manually`;
    }
    console.error(`Mint job ${job.id} failed permanently (crashed worker): ${refundNote}`);

    void sendAdminAlert({
      subject: `Mint job failed permanently — session ${job.stripe_session_id}`,
      text: `Mint job ${job.id} was abandoned mid-run after ${job.attempts} attempts (worker crash).\n`
        + `Event ID: ${job.event_id}\n`
        + `Buyer wallet: ${job.buyer_wallet}\n`
        + `Minted ${totalMinted}/${job.quantity} tickets.\n\n`
        + `Refund: ${refundNote}`,
    }).catch((err) => console.error("Admin alert failed:", err));
  }

  const { data: jobs, error } = await supabaseAdmin.rpc("claim_mint_jobs", {
    p_limit: limit,
    p_max_attempts: MAX_ATTEMPTS,
  });
  if (error) throw new Error(`claim_mint_jobs failed: ${error.message}`);

  let minted = 0;
  for (const job of (jobs ?? []) as MintJob[]) {
    try {
      minted += await processOneJob(job, baseUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Mint job ${job.id} failed:`, message);
      await supabaseAdmin
        .from("mint_jobs")
        .update({
          status: job.attempts >= MAX_ATTEMPTS ? "failed" : "queued",
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }

  return { claimed: (jobs ?? []).length, minted };
}
