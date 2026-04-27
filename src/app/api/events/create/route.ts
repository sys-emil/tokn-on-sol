import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

interface CreateEventBody {
  organizer_wallet: string;
  name: string;
  date: string;
  price_eur: number;
  capacity: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CreateEventBody;

  try {
    body = (await req.json()) as CreateEventBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { organizer_wallet, name, date, price_eur, capacity } = body;

  if (!organizer_wallet || !name || !date) {
    return NextResponse.json(
      { success: false, error: "organizer_wallet, name, and date are required" },
      { status: 400 }
    );
  }

  if (typeof price_eur !== "number" || price_eur < 0) {
    return NextResponse.json(
      { success: false, error: "price_eur must be a non-negative number" },
      { status: 400 }
    );
  }

  if (typeof capacity !== "number" || capacity < 1 || capacity > 10000) {
    return NextResponse.json(
      { success: false, error: "capacity must be between 1 and 10000" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("events")
      .insert({
        organizer_wallet: organizer_wallet.trim(),
        name: name.trim(),
        date,
        price_eur,
        capacity,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
