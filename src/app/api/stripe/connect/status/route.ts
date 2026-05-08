import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress");
  if (!walletAddress) {
    return NextResponse.json({ connected: false }, { status: 400 });
  }

  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (!organizer?.stripe_account_id) {
    return NextResponse.json({ connected: false });
  }

  try {
    const account = await stripe.accounts.retrieve(organizer.stripe_account_id as string);
    const charges_enabled = account.charges_enabled ?? false;
    const payouts_enabled = account.payouts_enabled ?? false;

    if (
      charges_enabled !== organizer.stripe_charges_enabled ||
      payouts_enabled !== organizer.stripe_payouts_enabled
    ) {
      await supabaseAdmin
        .from("organizers")
        .update({ stripe_charges_enabled: charges_enabled, stripe_payouts_enabled: payouts_enabled })
        .eq("wallet_address", walletAddress);
    }

    return NextResponse.json({
      connected: true,
      charges_enabled,
      payouts_enabled,
      account_id: organizer.stripe_account_id,
    });
  } catch {
    return NextResponse.json({
      connected: true,
      charges_enabled: false,
      payouts_enabled: false,
      account_id: organizer.stripe_account_id,
    });
  }
}
