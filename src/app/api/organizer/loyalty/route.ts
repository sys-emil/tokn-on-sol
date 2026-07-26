import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireProOrganizer } from "@/lib/plan";
import { loadCustomers } from "@/lib/organizerCustomers";
import { share } from "@/lib/proAnalytics";
import { MAX_TIERS } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

interface TierRow {
  id: string;
  name: string;
  badge: string | null;
  threshold: number;
  benefit_title: string;
  benefit_description: string | null;
  active: boolean;
  sort: number;
}

/**
 * Pro "Treueprogramm" tab. Since 2026-07-26 an organizer runs several tiers
 * (Bronze/Silber/Gold …) instead of a single program: every row in
 * `loyalty_programs` is one tier, `loyalty_claims.program_id` points at the
 * tier a guest claimed. Qualification is unchanged — distinct redeemed events
 * at this organizer, the same signal as the Stammgast badge.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress") ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const [{ data: tierRows }, customers] = await Promise.all([
    supabaseAdmin
      .from("loyalty_programs")
      .select("id, name, badge, threshold, benefit_title, benefit_description, active, sort")
      .eq("organizer_wallet", walletAddress)
      .order("threshold", { ascending: true }),
    loadCustomers(walletAddress),
  ]);

  const tiers = (tierRows ?? []) as TierRow[];
  const tierIds = tiers.map((t) => t.id);

  const { data: claimRows } = tierIds.length > 0
    ? await supabaseAdmin
      .from("loyalty_claims")
      .select("id, program_id, wallet_address, code, claimed_at, redeemed_at")
      .in("program_id", tierIds)
      .order("claimed_at", { ascending: false })
    : { data: [] };
  const claims = (claimRows ?? []) as {
    id: string; program_id: string; wallet_address: string; code: string;
    claimed_at: string; redeemed_at: string | null;
  }[];

  const emailByWallet = new Map(customers.filter((c) => c.email).map((c) => [c.wallet, c.email!]));
  const byThresholdDesc = [...tiers].sort((a, b) => b.threshold - a.threshold);

  // Membership is exclusive: a guest counts towards the highest tier reached,
  // so the three numbers add up to the qualified customer base.
  const memberCount = new Map<string, number>();
  for (const c of customers) {
    const tier = byThresholdDesc.find((t) => t.active && c.redeemedEvents >= t.threshold);
    if (tier) memberCount.set(tier.id, (memberCount.get(tier.id) ?? 0) + 1);
  }

  const tierPayload = tiers.map((t) => {
    const own = claims.filter((c) => c.program_id === t.id);
    const redeemed = own.filter((c) => c.redeemed_at).length;
    return {
      id: t.id,
      name: t.name,
      badge: t.badge || t.name.slice(0, 1).toUpperCase(),
      threshold: t.threshold,
      benefitTitle: t.benefit_title,
      benefitDescription: t.benefit_description,
      active: t.active,
      sort: t.sort,
      members: memberCount.get(t.id) ?? 0,
      claimed: own.length,
      redeemed,
      redeemRate: share(redeemed, own.length),
    };
  });

  const tierByProgram = new Map(tiers.map((t) => [t.id, t]));
  const redemptions = claims
    .filter((c) => c.redeemed_at)
    .slice(0, 12)
    .map((c) => ({
      code: c.code,
      wallet: c.wallet_address,
      email: emailByWallet.get(c.wallet_address) ?? null,
      benefitTitle: tierByProgram.get(c.program_id)?.benefit_title ?? "Vorteil",
      tierName: tierByProgram.get(c.program_id)?.name ?? null,
      redeemedAt: c.redeemed_at,
    }));

  /* Wirkt das Programm? Mitglieder (mind. eine Stufe erreicht) vs. alle anderen. */
  const members = customers.filter((c) => c.tier);
  const others = customers.filter((c) => !c.tier);
  const avg = (rows: typeof customers, pick: (c: (typeof customers)[number]) => number): number =>
    rows.length === 0 ? 0 : Math.round((rows.reduce((a, c) => a + pick(c), 0) / rows.length) * 10) / 10;

  const impact = {
    memberCount: members.length,
    otherCount: others.length,
    rows: [
      {
        label: "Tickets pro Gast",
        unit: "count",
        member: avg(members, (c) => c.tickets),
        other: avg(others, (c) => c.tickets),
      },
      {
        label: "Ø Ausgaben pro Gast",
        unit: "eur",
        member: Math.round(avg(members, (c) => c.spendCents)),
        other: Math.round(avg(others, (c) => c.spendCents)),
      },
      {
        label: "Rückkehrquote in 90 Tagen",
        unit: "pct",
        member: share(members.filter((c) => c.returnedWithin90).length, members.length),
        other: share(others.filter((c) => c.returnedWithin90).length, others.length),
      },
    ],
  };

  return NextResponse.json({
    tiers: tierPayload,
    maxTiers: MAX_TIERS,
    qualifiedCount: customers.filter((c) => c.tier).length,
    redemptions,
    impact,
  });
}

/** Create or update a single tier. */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: {
    walletAddress?: string; id?: string; name?: string; badge?: string;
    threshold?: number; benefitTitle?: string; benefitDescription?: string; active?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const walletAddress = body.walletAddress ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const name = (body.name ?? "").trim();
  const benefitTitle = (body.benefitTitle ?? "").trim();
  const benefitDescription = (body.benefitDescription ?? "").trim();
  const threshold = Math.round(Number(body.threshold ?? 3));
  const badge = (body.badge ?? name.slice(0, 1)).trim().toUpperCase().slice(0, 2);

  if (!name || name.length > 30) {
    return NextResponse.json({ success: false, error: "Name der Stufe fehlt oder ist zu lang" }, { status: 400 });
  }
  if (!benefitTitle || benefitTitle.length > 80 || benefitDescription.length > 300) {
    return NextResponse.json({ success: false, error: "Vorteil fehlt oder ist zu lang" }, { status: 400 });
  }
  if (!Number.isFinite(threshold) || threshold < 2 || threshold > 20) {
    return NextResponse.json({ success: false, error: "Schwelle muss zwischen 2 und 20 liegen" }, { status: 400 });
  }

  const values = {
    organizer_wallet: walletAddress,
    name,
    badge,
    threshold,
    benefit_title: benefitTitle,
    benefit_description: benefitDescription || null,
    active: body.active ?? true,
    sort: threshold,
    updated_at: new Date().toISOString(),
  };

  if (body.id) {
    // Scoped to the organizer's own wallet: an id alone must never be enough
    // to edit somebody else's tier.
    const { data, error } = await supabaseAdmin
      .from("loyalty_programs")
      .update(values)
      .eq("id", body.id)
      .eq("organizer_wallet", walletAddress)
      .select("id")
      .maybeSingle();
    if (error) return tierError(error);
    if (!data) return NextResponse.json({ success: false, error: "Stufe nicht gefunden" }, { status: 404 });
    return NextResponse.json({ success: true, id: data.id });
  }

  const { count } = await supabaseAdmin
    .from("loyalty_programs")
    .select("*", { count: "exact", head: true })
    .eq("organizer_wallet", walletAddress);
  if ((count ?? 0) >= MAX_TIERS) {
    return NextResponse.json(
      { success: false, error: `Maximal ${MAX_TIERS} Stufen pro Veranstalter.` },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("loyalty_programs")
    .insert(values)
    .select("id")
    .single();
  if (error) return tierError(error);
  return NextResponse.json({ success: true, id: (data as { id: string }).id });
}

/** Delete a tier. Claims cascade, so a tier with redeemed benefits is kept. */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get("walletAddress") ?? "";
  const id = url.searchParams.get("id") ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;
  if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

  const { count } = await supabaseAdmin
    .from("loyalty_claims")
    .select("*", { count: "exact", head: true })
    .eq("program_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { success: false, error: "Diese Stufe hat bereits vergebene Vorteile. Deaktiviere sie stattdessen." },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin
    .from("loyalty_programs")
    .delete()
    .eq("id", id)
    .eq("organizer_wallet", walletAddress);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

function tierError(error: { code?: string; message: string }): NextResponse {
  if (error.code === "23505") {
    return NextResponse.json(
      { success: false, error: "Name und Schwelle müssen sich zwischen deinen Stufen unterscheiden." },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}
