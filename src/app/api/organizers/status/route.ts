import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress");

  if (!walletAddress) {
    return NextResponse.json({ status: "none" });
  }

  const { data } = await supabaseAdmin
    .from("organizers")
    .select("status, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, plan, plan_period_end, plan_cancel_at_period_end, handle, public_name, is_verified, verified_label")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ status: "none" });
  }

  return NextResponse.json({
    status: data.status as string,
    stripe_account_id: (data.stripe_account_id as string | null) ?? null,
    stripe_charges_enabled: (data.stripe_charges_enabled as boolean) ?? false,
    stripe_payouts_enabled: (data.stripe_payouts_enabled as boolean) ?? false,
    plan: (data.plan as string) ?? "free",
    plan_period_end: (data.plan_period_end as string | null) ?? null,
    plan_cancel_at_period_end: (data.plan_cancel_at_period_end as boolean) ?? false,
    handle: (data.handle as string | null) ?? null,
    public_name: (data.public_name as string | null) ?? null,
    is_verified: (data.is_verified as boolean) ?? false,
    verified_label: (data.verified_label as string | null) ?? null,
  });
}
