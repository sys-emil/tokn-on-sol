import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const buyerWallet = new URL(req.url).searchParams.get("buyerWallet");

  if (!buyerWallet) {
    return NextResponse.json(
      { error: "buyerWallet is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("asset_id, created_at, event_id, events(name, date)")
    .eq("buyer_wallet", buyerWallet)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tickets = (data ?? []).map((row) => {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    return {
      assetId: row.asset_id as string,
      eventName: (event?.name ?? "") as string,
      eventDate: (event?.date ?? "") as string,
      purchasedAt: row.created_at as string,
      eventId: row.event_id as string,
    };
  });

  return NextResponse.json({ tickets });
}
