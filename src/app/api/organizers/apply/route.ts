// Requires NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET in environment variables
// Find them at: https://dashboard.privy.io → your app → Settings → API keys
import { PrivyClient } from "@privy-io/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

interface ApplyBody {
  walletAddress: string;
  email: string;
  name: string;
  type: "private" | "business";
  businessName?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let privyUser: Awaited<ReturnType<typeof privy.getUser>>;
  try {
    const verified = await privy.verifyAuthToken(authToken);
    privyUser = await privy.getUser(verified.userId);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!privyUser.phone?.number) {
    return NextResponse.json({ success: false, error: "phone_required" }, { status: 403 });
  }

  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { walletAddress, email, name, type, businessName } = body;

  if (!walletAddress || !email?.trim() || !name?.trim() || !type) {
    return NextResponse.json(
      { success: false, error: "walletAddress, email, name, and type are required" },
      { status: 400 },
    );
  }

  if (type !== "private" && type !== "business") {
    return NextResponse.json({ success: false, error: "type must be private or business" }, { status: 400 });
  }

  if (type === "business" && !businessName?.trim()) {
    return NextResponse.json(
      { success: false, error: "businessName is required for business accounts" },
      { status: 400 },
    );
  }

  // Reject duplicate applications
  const { data: existing } = await supabaseAdmin
    .from("organizers")
    .select("status")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { success: false, error: "An application already exists for this wallet" },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin.from("organizers").insert({
    wallet_address: walletAddress,
    email: email.trim(),
    name: name.trim(),
    type,
    business_name: type === "business" ? (businessName?.trim() ?? null) : null,
    status: "approved",
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
