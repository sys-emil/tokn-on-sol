import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireProOrganizer } from "@/lib/plan";
import { qualifiedCustomers } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

/** Pro feature: read the organizer's loyalty program incl. qualified customers and claims. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress") ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const { data: program } = await supabaseAdmin
    .from("loyalty_programs")
    .select("id, threshold, benefit_title, benefit_description, active")
    .eq("organizer_wallet", walletAddress)
    .maybeSingle();

  if (!program) {
    return NextResponse.json({ program: null, qualifiedCount: 0, claims: [] });
  }

  const [qualified, { data: claims }] = await Promise.all([
    qualifiedCustomers(walletAddress, program.threshold as number),
    supabaseAdmin
      .from("loyalty_claims")
      .select("id, wallet_address, code, claimed_at, redeemed_at")
      .eq("program_id", program.id as string)
      .order("claimed_at", { ascending: false }),
  ]);

  return NextResponse.json({
    program,
    qualifiedCount: qualified.length,
    claims: claims ?? [],
  });
}

/** Pro feature: create or update the loyalty program (one per organizer). */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: {
    walletAddress?: string;
    threshold?: number;
    benefitTitle?: string;
    benefitDescription?: string;
    active?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const walletAddress = body.walletAddress ?? "";
  const gate = await requireProOrganizer(req, walletAddress);
  if (!gate.ok) return gate.response;

  const threshold = Math.round(Number(body.threshold ?? 3));
  const benefitTitle = (body.benefitTitle ?? "").trim();
  const benefitDescription = (body.benefitDescription ?? "").trim();
  if (!benefitTitle || benefitTitle.length > 80 || benefitDescription.length > 300) {
    return NextResponse.json({ success: false, error: "Vorteil fehlt oder ist zu lang" }, { status: 400 });
  }
  if (!Number.isFinite(threshold) || threshold < 2 || threshold > 20) {
    return NextResponse.json({ success: false, error: "Schwelle muss zwischen 2 und 20 liegen" }, { status: 400 });
  }

  const { data: program, error } = await supabaseAdmin
    .from("loyalty_programs")
    .upsert(
      {
        organizer_wallet: walletAddress,
        threshold,
        benefit_title: benefitTitle,
        benefit_description: benefitDescription || null,
        active: body.active ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organizer_wallet" },
    )
    .select("id, threshold, benefit_title, benefit_description, active")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, program });
}
