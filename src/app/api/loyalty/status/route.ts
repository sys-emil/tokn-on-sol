import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

export const dynamic = "force-dynamic";

/**
 * Buyer view of loyalty programs: for every organizer the wallet has attended,
 * report active programs of Pro organizers with progress and claim state.
 * Read-only and keyed by wallet, same access model as /api/my-tickets; the
 * caller must prove ownership of the wallet (it reveals which events the wallet
 * has attended).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const buyerWallet = new URL(req.url).searchParams.get("buyerWallet");
  if (!buyerWallet) {
    return NextResponse.json({ error: "buyerWallet is required" }, { status: 400 });
  }

  if (!(await requestOwnsWallet(req, buyerWallet))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Distinct redeemed events per organizer for this wallet.
  const { data: redeemed } = await supabaseAdmin
    .from("purchases")
    .select("event_id, events(organizer_wallet)")
    .eq("buyer_wallet", buyerWallet)
    .not("redeemed_at", "is", null);

  const attendedPerOrganizer = new Map<string, Set<string>>();
  for (const row of (redeemed ?? []) as unknown as { event_id: string; events: { organizer_wallet: string } | { organizer_wallet: string }[] | null }[]) {
    const ev = Array.isArray(row.events) ? row.events[0] : row.events;
    if (!ev?.organizer_wallet) continue;
    if (!attendedPerOrganizer.has(ev.organizer_wallet)) attendedPerOrganizer.set(ev.organizer_wallet, new Set());
    attendedPerOrganizer.get(ev.organizer_wallet)!.add(row.event_id);
  }

  const organizerWallets = [...attendedPerOrganizer.keys()];
  if (organizerWallets.length === 0) return NextResponse.json({ programs: [] });

  // Active programs whose organizer is currently on Pro; a lapsed
  // subscription silently hides the benefits.
  const [{ data: programs }, { data: proOrganizers }] = await Promise.all([
    supabaseAdmin
      .from("loyalty_programs")
      .select("id, organizer_wallet, name, threshold, benefit_title, benefit_description")
      .in("organizer_wallet", organizerWallets)
      .eq("active", true),
    supabaseAdmin
      .from("organizers")
      .select("wallet_address, name, business_name")
      .in("wallet_address", organizerWallets)
      .eq("plan", "pro"),
  ]);

  const proByWallet = new Map(
    ((proOrganizers ?? []) as { wallet_address: string; name: string; business_name: string | null }[])
      .map((o) => [o.wallet_address, (o.business_name ?? o.name) || "Veranstalter"]),
  );

  const allTiers = ((programs ?? []) as {
    id: string;
    organizer_wallet: string;
    name: string;
    threshold: number;
    benefit_title: string;
    benefit_description: string | null;
  }[]).filter((p) => proByWallet.has(p.organizer_wallet));

  // An organizer runs several tiers; the guest sees exactly one card per
  // organizer: the highest tier they have reached, or — while still short of
  // the first one — the cheapest tier as the goal to work towards.
  const tiersByOrganizer = new Map<string, typeof allTiers>();
  for (const tier of allTiers) {
    if (!tiersByOrganizer.has(tier.organizer_wallet)) tiersByOrganizer.set(tier.organizer_wallet, []);
    tiersByOrganizer.get(tier.organizer_wallet)!.push(tier);
  }
  const visible = [...tiersByOrganizer.entries()].map(([organizer, tiers]) => {
    const attended = attendedPerOrganizer.get(organizer)?.size ?? 0;
    const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
    const reached = [...sorted].reverse().find((t) => attended >= t.threshold);
    const next = sorted.find((t) => attended < t.threshold) ?? null;
    return { tier: reached ?? sorted[0], nextThreshold: reached ? next?.threshold ?? null : null };
  });

  if (visible.length === 0) return NextResponse.json({ programs: [] });

  const { data: claims } = await supabaseAdmin
    .from("loyalty_claims")
    .select("program_id, code, redeemed_at")
    .eq("wallet_address", buyerWallet)
    .in("program_id", visible.map((v) => v.tier.id));
  const claimByProgram = new Map(
    ((claims ?? []) as { program_id: string; code: string; redeemed_at: string | null }[])
      .map((c) => [c.program_id, c]),
  );

  const result = visible.map(({ tier, nextThreshold }) => {
    const attendedEvents = attendedPerOrganizer.get(tier.organizer_wallet)?.size ?? 0;
    const claim = claimByProgram.get(tier.id) ?? null;
    return {
      programId: tier.id,
      organizerName: proByWallet.get(tier.organizer_wallet) ?? "Veranstalter",
      tierName: tier.name,
      benefitTitle: tier.benefit_title,
      benefitDescription: tier.benefit_description,
      threshold: tier.threshold,
      nextThreshold,
      attendedEvents,
      qualified: attendedEvents >= tier.threshold,
      claim: claim ? { code: claim.code, redeemedAt: claim.redeemed_at } : null,
    };
  });

  return NextResponse.json({ programs: result });
}
