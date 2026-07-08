import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

/**
 * Starts the Dashboard-Pro subscription checkout. Creates (or reuses) a Stripe
 * Customer for the organizer, then a Checkout Session in subscription mode.
 * The webhook (`purpose: pro_subscription` + customer.subscription.*) is the
 * only writer of `organizers.plan`.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ success: false, error: "Pro ist noch nicht verfügbar." }, { status: 503 });
  }

  let body: { walletAddress?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const walletAddress = body.walletAddress ?? "";
  if (!walletAddress) {
    return NextResponse.json({ success: false, error: "walletAddress is required" }, { status: 400 });
  }
  if (!(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("id, email, plan, stripe_customer_id")
    .eq("wallet_address", walletAddress)
    .eq("status", "approved")
    .maybeSingle();
  if (!organizer) {
    return NextResponse.json({ success: false, error: "Not an approved organizer" }, { status: 403 });
  }
  if ((organizer.plan as string) === "pro") {
    return NextResponse.json({ success: false, error: "already_pro" }, { status: 409 });
  }

  const host = req.headers.get("host") ?? "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  try {
    let customerId = organizer.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        ...(organizer.email ? { email: organizer.email as string } : {}),
        metadata: { organizerWallet: walletAddress },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("organizers")
        .update({ stripe_customer_id: customerId })
        .eq("wallet_address", walletAddress);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { purpose: "pro_subscription", organizerWallet: walletAddress },
      subscription_data: { metadata: { organizerWallet: walletAddress } },
      success_url: `${origin}/dashboard?billing=success`,
      cancel_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Pro checkout failed:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
