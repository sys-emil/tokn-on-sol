import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

/**
 * Dashboard-Pro plan helpers. The `organizers.plan` column is maintained
 * exclusively by the Stripe webhook (checkout.session.completed in
 * subscription mode + customer.subscription.*); everything else only reads it.
 */

export interface ProOrganizer {
  id: string;
  wallet_address: string;
  email: string | null;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

type RequireProResult =
  | { ok: true; organizer: ProOrganizer }
  | { ok: false; response: NextResponse };

/**
 * Auth gate for Pro-only organizer routes: Privy token must own the wallet,
 * the organizer must be approved and on the 'pro' plan. The server-side plan
 * check is the authority — client UI gating is cosmetic.
 */
export async function requireProOrganizer(
  req: NextRequest,
  walletAddress: string,
): Promise<RequireProResult> {
  if (!walletAddress) {
    return {
      ok: false,
      response: NextResponse.json({ error: "walletAddress is required" }, { status: 400 }),
    };
  }

  if (!(await requestOwnsWallet(req, walletAddress))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("id, wallet_address, email, plan, stripe_customer_id, stripe_subscription_id")
    .eq("wallet_address", walletAddress)
    .eq("status", "approved")
    .maybeSingle();

  if (!organizer) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not an approved organizer" }, { status: 403 }),
    };
  }
  if ((organizer.plan as string) !== "pro") {
    return {
      ok: false,
      response: NextResponse.json({ error: "pro_required" }, { status: 403 }),
    };
  }

  return { ok: true, organizer: organizer as unknown as ProOrganizer };
}
