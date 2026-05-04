import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, name, date, price_eur, capacity, tickets_sold")
    .gte("date", today)
    .eq("is_private", false)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []).map((e) => ({
    id: e.id as string,
    name: e.name as string,
    date: e.date as string,
    price_eur: e.price_eur as number,
    capacity: e.capacity as number,
    tickets_sold: e.tickets_sold as number,
  }));

  return NextResponse.json({ events });
}
