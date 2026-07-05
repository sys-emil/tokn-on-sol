import { supabaseAdmin } from "@/lib/supabase";
import { mintTicket } from "@/lib/mint";
import { sendTicketConfirmation, sendAdminAlert } from "@/lib/email";

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
  buyer_wallet: string;
  buyer_email: string | null;
  quantity: number;
  status: "queued" | "processing" | "done" | "failed";
  attempts: number;
  last_error: string | null;
}

export const mintJobsSiteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function processOneJob(job: MintJob, baseUrl: string): Promise<number> {
  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("name, date")
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
        });

        await supabaseAdmin.from("purchases").insert({
          event_id: job.event_id,
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
    // Paid but not fully delivered — a human has to look at this.
    void sendAdminAlert({
      subject: `Mint job failed permanently — session ${job.stripe_session_id}`,
      text: `Mint job ${job.id} gave up after ${job.attempts} attempts.\n`
        + `Event: ${event.name} (${job.event_id})\n`
        + `Buyer wallet: ${job.buyer_wallet}\n`
        + `Minted ${totalMinted}/${job.quantity} tickets.\n`
        + `Last error: ${lastError ?? "unknown"}\n\n`
        + `The buyer has paid — resolve manually (re-queue the job or refund).`,
    }).catch((err) => console.error("Admin alert failed:", err));
  }
  return minted;
}

export async function processMintJobs(limit = 5, baseUrl = mintJobsSiteUrl): Promise<{
  claimed: number;
  minted: number;
}> {
  // Jobs whose final attempt crashed mid-run stay 'processing' forever and are
  // no longer claimable — flag them as failed so they surface for the admin.
  await supabaseAdmin
    .from("mint_jobs")
    .update({ status: "failed", last_error: "worker crashed on final attempt", updated_at: new Date().toISOString() })
    .eq("status", "processing")
    .gte("attempts", MAX_ATTEMPTS)
    .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

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
