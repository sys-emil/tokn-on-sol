import { NextRequest, NextResponse } from "next/server";
import { requestOwnsWallet } from "@/lib/privyServer";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_NAME_LENGTH = 40;
const MAX_BIO_LENGTH = 240;

export interface ProfileRow {
  wallet_address: string;
  display_name: string | null;
  bio: string | null;
  is_private: boolean;
}

/** Own profile for the account editor; requires proof of wallet ownership. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = req.nextUrl.searchParams.get("walletAddress") ?? "";
  if (!(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("wallet_address, display_name, bio, is_private")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: "profile_load_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true, profile: (data as ProfileRow | null) ?? null });
}

interface PutBody {
  walletAddress: string;
  displayName?: string;
  bio?: string;
  isPrivate?: boolean;
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const walletAddress = body.walletAddress ?? "";
  if (!(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const displayName = (body.displayName ?? "").trim().slice(0, MAX_NAME_LENGTH);
  const bio = (body.bio ?? "").trim().slice(0, MAX_BIO_LENGTH);
  const isPrivate = body.isPrivate === true;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        wallet_address: walletAddress,
        display_name: displayName || null,
        bio: bio || null,
        is_private: isPrivate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address" },
    )
    .select("wallet_address, display_name, bio, is_private")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: "profile_save_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true, profile: data as ProfileRow });
}
