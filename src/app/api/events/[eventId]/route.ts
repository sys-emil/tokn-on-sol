import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
): Promise<NextResponse> {
  const { eventId } = await params;

  // Public route; only expose what the doorman page (its sole consumer) needs.
  // A full row would leak exact sales figures (tickets_sold/reserved) and
  // payout settings to anyone with the event ID.
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, name, date, organizer_wallet")
    .eq("id", eventId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
