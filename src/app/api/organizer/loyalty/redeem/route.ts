import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireProOrganizer } from "@/lib/plan";

export const dynamic = "force-dynamic";

/**
 * Pro feature: redeem a customer's loyalty claim code at the venue. Atomic
 * once-only, same pattern as ticket redemption (update only while NULL).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { walletAddress?: string; code?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const walletAddress = body.walletAddress ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ success: false, error: "code is required" }, { status: 400 });
  }

  // The code must belong to this organizer's program.
  const { data: claim } = await supabaseAdmin
    .from("loyalty_claims")
    .select("id, redeemed_at, loyalty_programs!inner(organizer_wallet, benefit_title)")
    .eq("code", code)
    .maybeSingle();

  const program = claim
    ? (Array.isArray(claim.loyalty_programs) ? claim.loyalty_programs[0] : claim.loyalty_programs) as
      { organizer_wallet: string; benefit_title: string } | null
    : null;

  if (!claim || !program || program.organizer_wallet !== walletAddress) {
    return NextResponse.json({ success: false, error: "unknown_code" }, { status: 404 });
  }
  if (claim.redeemed_at) {
    return NextResponse.json(
      { success: false, error: "already_redeemed", redeemedAt: claim.redeemed_at },
      { status: 409 },
    );
  }

  const { data: updated } = await supabaseAdmin
    .from("loyalty_claims")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("id", claim.id as string)
    .is("redeemed_at", null)
    .select("id, redeemed_at");

  if (!updated || updated.length === 0) {
    return NextResponse.json({ success: false, error: "already_redeemed" }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    benefitTitle: program.benefit_title,
    redeemedAt: (updated[0] as { redeemed_at: string }).redeemed_at,
  });
}
