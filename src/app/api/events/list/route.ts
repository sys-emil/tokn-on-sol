import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const organizerWallet = new URL(req.url).searchParams.get("organizerWallet");

  if (!organizerWallet) {
    return NextResponse.json(
      { error: "organizerWallet is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, name, date, tickets_sold")
    .eq("organizer_wallet", organizerWallet)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const totalTickets = rows.reduce((sum, e) => sum + (e.tickets_sold ?? 0), 0);

  const events = rows.map((e) => ({
    id: e.id as string,
    name: e.name as string,
    date: e.date as string,
    count: e.tickets_sold as number,
  }));

  return NextResponse.json({ events, totalTickets });
}
