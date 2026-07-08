import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";
import { countAttendedEvents, generateClaimCode } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

/**
 * Buyer claims a loyalty benefit: qualification is re-verified server-side,
 * one claim per customer per program (DB unique), code shown at the venue.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { buyerWallet?: string; programId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const buyerWallet = body.buyerWallet ?? "";
  const programId = body.programId ?? "";
  if (!buyerWallet || !programId) {
    return NextResponse.json({ success: false, error: "buyerWallet und programId sind erforderlich" }, { status: 400 });
  }
  if (!(await requestOwnsWallet(req, buyerWallet))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: program } = await supabaseAdmin
    .from("loyalty_programs")
    .select("id, organizer_wallet, threshold, benefit_title, active")
    .eq("id", programId)
    .maybeSingle();
  if (!program || !program.active) {
    return NextResponse.json({ success: false, error: "Programm nicht gefunden" }, { status: 404 });
  }

  // Benefit only exists while the organizer is on Pro.
  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("plan")
    .eq("wallet_address", program.organizer_wallet as string)
    .maybeSingle();
  if ((organizer?.plan as string | undefined) !== "pro") {
    return NextResponse.json({ success: false, error: "Programm nicht verfügbar" }, { status: 404 });
  }

  const attended = await countAttendedEvents(buyerWallet, program.organizer_wallet as string);
  if (attended < (program.threshold as number)) {
    return NextResponse.json({ success: false, error: "not_qualified" }, { status: 403 });
  }

  const { data: claim, error } = await supabaseAdmin
    .from("loyalty_claims")
    .insert({
      program_id: programId,
      wallet_address: buyerWallet,
      code: generateClaimCode(),
    })
    .select("code")
    .single();

  if (error) {
    // Unique violation → the customer already claimed; return the existing code.
    if (error.code === "23505") {
      const { data: existing } = await supabaseAdmin
        .from("loyalty_claims")
        .select("code, redeemed_at")
        .eq("program_id", programId)
        .eq("wallet_address", buyerWallet)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ success: true, code: existing.code, redeemedAt: existing.redeemed_at });
      }
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, code: (claim as { code: string }).code, redeemedAt: null });
}
