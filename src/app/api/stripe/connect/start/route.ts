import { PrivyClient } from "@privy-io/server-auth";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let email: string | undefined;
  try {
    const verified = await privy.verifyAuthToken(authToken);
    const privyUser = await privy.getUser(verified.userId);
    email = privyUser.email?.address ?? undefined;
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { walletAddress: string };
  try {
    body = (await req.json()) as { walletAddress: string };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { walletAddress } = body;
  if (!walletAddress) {
    return NextResponse.json({ success: false, error: "walletAddress is required" }, { status: 400 });
  }

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
