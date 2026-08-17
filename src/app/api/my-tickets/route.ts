import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";
import { MILESTONES, STAMMGAST_THRESHOLD } from "@/lib/badgeMeta";
import { returnBreakdown } from "@/lib/fees";
import { processMintJobs } from "@/lib/mintJobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // after() may mint outstanding tickets once the response is sent

/**
 * Nudge the mint worker when this buyer has an unfinished mint job.
 *
 * The webhook's own after() is the primary path and the success page's polling
 * the secondary — but that polling only runs while the buyer keeps that tab
 * open. On the Hobby plan the cron fallback is daily, so a buyer who closed the
 * tab after a crashed run would otherwise wait until 03:30 for a ticket they
 * already paid for. Opening one's ticket list is exactly the moment to heal it.
 *
 * Safe to call on every request: claim_mint_jobs is FOR UPDATE SKIP LOCKED and
 * ignores jobs touched in the last 10 minutes, so polling cannot stampede — the
 * same reasoning documented over /api/checkout/confirm.
 */
async function kickPendingMints(walletAddress: string): Promise<void> {
  const { data: unfinished } = await supabaseAdmin
    .from("mint_jobs")
    .select("id")
    .eq("buyer_wallet", walletAddress)
    .in("status", ["queued", "processing"])
    .limit(1);

  if (!unfinished || unfinished.length === 0) return;

  after(async () => {
    try {
      await processMintJobs(3);
    } catch (err) {
      console.error("Mint kick from my-tickets failed:", err);
    }
  });
}

interface PassPurchaseRow {
  id: string;
  asset_id: string;
  created_at: string;
  season_pass_id: string;
}

export interface PassView {
  assetId: string;
  passId: string;
  passName: string;
  purchasedAt: string;
  dates: {
    eventId: string;
    eventName: string;
    eventDate: string;
    startTime: string | null;
    venue: string | null;
    cancelled: boolean;
    redeemedAt: string | null;
  }[];
}

/**
 * Resolves the buyer's season passes with every date and its admission state.
 * A pass burns once per date (pass_redemptions), never globally, so there is
 * no single redeemed_at to report.
 */
async function loadPasses(rows: PassPurchaseRow[]): Promise<PassView[]> {
  if (rows.length === 0) return [];

  const passIds = [...new Set(rows.map((r) => r.season_pass_id))];
  const [{ data: passes }, { data: links }, { data: redemptions }] = await Promise.all([
    supabaseAdmin.from("season_passes").select("id, name").in("id", passIds),
    supabaseAdmin
      .from("season_pass_events")
      .select("pass_id, events(id, name, date, start_time, venue, cancelled_at)")
      .in("pass_id", passIds),
    supabaseAdmin
      .from("pass_redemptions")
      .select("purchase_id, event_id, redeemed_at")
      .in("purchase_id", rows.map((r) => r.id)),
  ]);

  const nameById = new Map(((passes ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  type LinkRow = { pass_id: string; events: Record<string, unknown> | Record<string, unknown>[] | null };
  const datesByPass = new Map<string, PassView["dates"]>();
  for (const link of (links ?? []) as LinkRow[]) {
    const ev = Array.isArray(link.events) ? link.events[0] : link.events;
    if (!ev) continue;
    const entry = {
      eventId: ev.id as string,
      eventName: ev.name as string,
      eventDate: ev.date as string,
      startTime: (ev.start_time as string | null) ?? null,
      venue: (ev.venue as string | null) ?? null,
      cancelled: Boolean(ev.cancelled_at),
      redeemedAt: null as string | null,
    };
    datesByPass.set(link.pass_id, [...(datesByPass.get(link.pass_id) ?? []), entry]);
  }

  const usedByPurchase = new Map<string, Map<string, string>>();
  for (const r of (redemptions ?? []) as { purchase_id: string; event_id: string; redeemed_at: string }[]) {
    const inner = usedByPurchase.get(r.purchase_id) ?? new Map<string, string>();
    inner.set(r.event_id, r.redeemed_at);
    usedByPurchase.set(r.purchase_id, inner);
  }

  return rows.map((row) => {
    const used = usedByPurchase.get(row.id);
    return {
      assetId: row.asset_id,
      passId: row.season_pass_id,
      passName: nameById.get(row.season_pass_id) ?? "Saisonpass",
      purchasedAt: row.created_at,
      dates: (datesByPass.get(row.season_pass_id) ?? [])
        .map((d) => ({ ...d, redeemedAt: used?.get(d.eventId) ?? null }))
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    };
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const buyerWallet = new URL(req.url).searchParams.get("buyerWallet");

  if (!buyerWallet) {
    return NextResponse.json(
      { error: "buyerWallet is required" },
      { status: 400 }
    );
  }

  // The response exposes personal purchase history AND live claim tokens
  // (bearer secrets that transfer the ticket). A wallet address is public, so
  // the caller must prove they own this wallet via their Privy auth token,
  // otherwise anyone could enumerate and hijack another buyer's tickets.
  if (!(await requestOwnsWallet(req, buyerWallet))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Heal a stalled mint before building the response; the work itself runs in
  // after(), so it costs the buyer nothing.
  await kickPendingMints(buyerWallet);

  const { data: allRows, error } = await supabaseAdmin
    .from("purchases")
    .select("id, asset_id, created_at, event_id, season_pass_id, redeemed_at, events(name, date, start_time, venue, image_url, accent_hue, border_style, price_eur, resale_enabled), ticket_tiers(name, price_eur)")
    .eq("buyer_wallet", buyerWallet)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Season passes belong to no single date, so they can't be folded into the
  // date-keyed ticket list (grouping, countdowns, resale all assume one event).
  // They get their own section on /my-tickets instead.
  const passRows = (allRows ?? []).filter((row) => row.season_pass_id);
  const data = (allRows ?? []).filter((row) => !row.season_pass_id);
  const passes = await loadPasses(passRows as PassPurchaseRow[]);

  const assetIds = (data ?? []).map((row) => row.asset_id as string);

  const [claimsResult, badgesResult, offersResult] = await Promise.all([
    assetIds.length > 0
      ? supabaseAdmin
          .from("claims")
          .select("asset_id, token")
          .in("asset_id", assetIds)
          .is("claimed_at", null)
      : Promise.resolve({ data: [] }),
    supabaseAdmin
      .from("badges")
      .select("badge_type, asset_id, earned_at, organizer_wallet")
      .eq("wallet_address", buyerWallet)
      .order("earned_at", { ascending: true }),
    // The seller's own open return offers. The ticket stays in their wallet but
    // is revoked while offered, so the UI has to show it as "angeboten" rather
    // than as a usable ticket.
    supabaseAdmin
      .from("resale_offers")
      .select("id, asset_id, paid_cents, return_fee_cents, refund_cents, status")
      .eq("seller_wallet", buyerWallet)
      .in("status", ["active", "sold"]),
  ]);

  const offeredAssets = new Map<string, {
    id: string; paidCents: number; returnFeeCents: number; refundCents: number; status: string;
  }>(
    ((offersResult.data ?? []) as {
      id: string; asset_id: string; paid_cents: number; return_fee_cents: number; refund_cents: number; status: string;
    }[]).map((o) => [o.asset_id, {
      id: o.id, paidCents: o.paid_cents, returnFeeCents: o.return_fee_cents,
      refundCents: o.refund_cents, status: o.status,
    }]),
  );

  const claimedAssets = new Map<string, string>(
    ((claimsResult.data ?? []) as { asset_id: string; token: string }[]).map((c) => [
      c.asset_id,
      c.token,
    ]),
  );

  const tickets = (data ?? []).map((row) => {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    const tier = Array.isArray(row.ticket_tiers) ? row.ticket_tiers[0] : row.ticket_tiers;
    const assetId = row.asset_id as string;
    const claimToken = claimedAssets.get(assetId);
    const baseUrl = process.env.APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    // Return eligibility (client shows "Ticket zurückgeben"). The refund is
    // computed from what the buyer actually paid, so the preview here is only
    // indicative — /api/resale/offer recomputes it from the payouts row, which
    // is the money authority. Face value is the closest honest stand-in for a
    // list that must not do a Stripe lookup per ticket.
    const returnEnabled = (event?.resale_enabled ?? false) === true;
    const faceValueCents = ((tier?.price_eur ?? event?.price_eur ?? 0)) as number;
    const offer = offeredAssets.get(assetId) ?? null;

    return {
      assetId,
      eventName: (event?.name ?? "") as string,
      eventDate: (event?.date ?? "") as string,
      // Shown on the ticket stubs (Einlass-Uhrzeit / Ort / Stadt); both are
      // optional event fields, the UI falls back gracefully when NULL.
      startTime: (event?.start_time ?? null) as string | null,
      venue: (event?.venue ?? null) as string | null,
      purchasedAt: row.created_at as string,
      eventId: row.event_id as string,
      redeemedAt: (row.redeemed_at ?? null) as string | null,
      claimUrl: claimToken ? `${baseUrl}/claim/${claimToken}` : null,
      imageUrl: (event?.image_url ?? null) as string | null,
      accentHue: (event?.accent_hue ?? null) as number | null,
      borderStyle: (event?.border_style ?? null) as string | null,
      tierName: (tier?.name ?? null) as string | null,
      faceValueCents,
      returnEnabled,
      returnPreview: returnEnabled && faceValueCents > 0 ? returnBreakdown(faceValueCents) : null,
      returnOffer: offer,
    };
  });

  const badgeRows = (badgesResult.data ?? []) as {
    badge_type: string;
    asset_id: string | null;
    earned_at: string;
    organizer_wallet: string | null;
  }[];

  const badges = badgeRows.map((b) => ({
    badgeType: b.badge_type,
    assetId: b.asset_id,
    earnedAt: b.earned_at,
  }));

  // Progress toward the next badges; the hook that brings buyers back. Pass
  // admissions count exactly like ticket ones — the door awards the same
  // badges for them, so the progress bar has to agree.
  const redeemedRows = (data ?? []).filter((row) => row.redeemed_at);
  const passAttendedEventIds = passes.flatMap((p) =>
    p.dates.filter((d) => d.redeemedAt).map((d) => d.eventId),
  );
  const attendedCount = redeemedRows.length + passAttendedEventIds.length;
  const nextMilestone = MILESTONES.find((m) => attendedCount < m.threshold) ?? null;

  // Best Stammgast candidate: distinct redeemed events per organizer, skipping
  // organizers where the badge is already earned. Shown by name, never wallet.
  let topOrganizer: { name: string; attendedEvents: number; threshold: number } | null = null;
  const redeemedEventIds = [
    ...new Set([...redeemedRows.map((row) => row.event_id as string), ...passAttendedEventIds]),
  ];
  if (redeemedEventIds.length > 0) {
    const { data: eventOwners } = await supabaseAdmin
      .from("events")
      .select("id, organizer_wallet")
      .in("id", redeemedEventIds);

    const stammgastEarned = new Set(
      badgeRows
        .filter((b) => b.badge_type === "loyal_organizer" && b.organizer_wallet)
        .map((b) => b.organizer_wallet as string),
    );

    const perOrganizer = new Map<string, number>();
    for (const ev of (eventOwners ?? []) as { id: string; organizer_wallet: string }[]) {
      if (stammgastEarned.has(ev.organizer_wallet)) continue;
      perOrganizer.set(ev.organizer_wallet, (perOrganizer.get(ev.organizer_wallet) ?? 0) + 1);
    }

    const best = [...perOrganizer.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0 && best[1] < STAMMGAST_THRESHOLD) {
      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("name, business_name")
        .eq("wallet_address", best[0])
        .maybeSingle();
      const displayName = (organizer?.business_name ?? organizer?.name ?? "") as string;
      if (displayName) {
        topOrganizer = { name: displayName, attendedEvents: best[1], threshold: STAMMGAST_THRESHOLD };
      }
    }
  }

  const progress = { attendedCount, nextMilestone, topOrganizer };

  return NextResponse.json({ tickets, passes, badges, progress });
}
