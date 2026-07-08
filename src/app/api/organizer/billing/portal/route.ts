import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

/**
 * Opens the Stripe Billing Portal for an organizer with a Pro subscription
 * (manage payment method, cancel, invoices). Requires the portal to be
 * configured once in the Stripe dashboard.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
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
    .select("stripe_customer_id")
    .eq("wallet_address", walletAddress)
    .eq("status", "approved")
    .maybeSingle();
  const customerId = organizer?.stripe_customer_id as string | null;
  if (!customerId) {
    return NextResponse.json({ success: false, error: "Kein Abo vorhanden." }, { status: 404 });
  }

  const host = req.headers.get("host") ?? "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });
    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Billing portal failed:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
