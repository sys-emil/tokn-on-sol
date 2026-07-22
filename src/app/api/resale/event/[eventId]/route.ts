import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/resale/event/[eventId] — public list of active resale offers, cheapest first.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await params;

  const { data, error } = await supabaseAdmin
    .from("resale_listings")
    .select("id, list_price_cents, face_value_cents, currency")
    .eq("event_id", eventId)
    .eq("status", "active")
    .order("list_price_cents", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const listings = (data ?? []).map((l) => ({
    id: l.id as string,
    listPriceCents: l.list_price_cents as number,
    faceValueCents: l.face_value_cents as number,
    currency: (l.currency ?? "eur") as string,
  }));

  return NextResponse.json({ listings });
}
