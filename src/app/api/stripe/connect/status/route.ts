import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

export const dynamic = "force-dynamic";

/**
 * Connect onboarding state for the signed-in organizer's own account. Gated:
 * it returns the Stripe account id and the KYC flags, and it calls the Stripe
 * API plus writes the refreshed flags back, so it must not be triggerable for
 * an arbitrary wallet.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress");
  if (!walletAddress) {
    return NextResponse.json({ connected: false }, { status: 400 });
  }

  if (!(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
