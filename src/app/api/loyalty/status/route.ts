import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

export const dynamic = "force-dynamic";

/**
 * Buyer view of loyalty programs: for every organizer the wallet has attended,
 * report active programs of Pro organizers with progress and claim state.
 * Read-only and keyed by wallet, same access model as /api/my-tickets — the
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

  // Active programs whose organizer is currently on Pro — a lapsed
  // subscription silently hides the benefits.
  const [{ data: programs }, { data: proOrganizers }] = await Promise.all([
    supabaseAdmin
      .from("loyalty_programs")
      .select("id, organizer_wallet, threshold, benefit_title, benefit_description")
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

  const visible = ((programs ?? []) as {
    id: string;
    organizer_wallet: string;
    threshold: number;
    benefit_title: string;
    benefit_description: string | null;
  }[]).filter((p) => proByWallet.has(p.organizer_wallet));

  if (visible.length === 0) return NextResponse.json({ programs: [] });

  const { data: claims } = await supabaseAdmin
    .from("loyalty_claims")
    .select("program_id, code, redeemed_at")
    .eq("wallet_address", buyerWallet)
    .in("program_id", visible.map((p) => p.id));
  const claimByProgram = new Map(
    ((claims ?? []) as { program_id: string; code: string; redeemed_at: string | null }[])
      .map((c) => [c.program_id, c]),
  );

  const result = visible.map((p) => {
    const attendedEvents = attendedPerOrganizer.get(p.organizer_wallet)?.size ?? 0;
    const claim = claimByProgram.get(p.id) ?? null;
    return {
      programId: p.id,
      organizerName: proByWallet.get(p.organizer_wallet) ?? "Veranstalter",
      benefitTitle: p.benefit_title,
      benefitDescription: p.benefit_description,
      threshold: p.threshold,
      attendedEvents,
      qualified: attendedEvents >= p.threshold,
      claim: claim ? { code: claim.code, redeemedAt: claim.redeemed_at } : null,
    };
  });

  return NextResponse.json({ programs: result });
}
