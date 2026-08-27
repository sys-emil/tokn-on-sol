import { requestUser } from "@/lib/sessionUser";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await requestUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const email: string | undefined = user.email || undefined;
  const walletAddress = user.walletAddress;

  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("stripe_account_id, status")
    .eq("wallet_address", walletAddress)
    .eq("status", "approved")
    .maybeSingle();

  if (!organizer) {
    return NextResponse.json({ success: false, error: "Not an approved organizer" }, { status: 403 });
  }

  const host = req.headers.get("host") ?? "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  let accountId = organizer.stripe_account_id as string | null;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        ...(email ? { email } : {}),
      });
      accountId = account.id;

      await supabaseAdmin
        .from("organizers")
        .update({ stripe_account_id: accountId })
        .eq("wallet_address", walletAddress);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?stripe=refresh`,
      return_url: `${origin}/dashboard?stripe=return`,
      type: "account_onboarding",
    });

    return NextResponse.json({ success: true, url: accountLink.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
