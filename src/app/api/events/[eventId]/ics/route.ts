import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildCalendar, type IcsEvent } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * Kalender-Export: liefert das Event als .ics-Datei ("Zum Kalender
 * hinzufügen" auf Ticket- und Kaufbestätigungsseite). Enthält nur die
 * öffentlichen Event-Daten, die der Käufer ohnehin sieht.
 *
 * Der Kalenderbau selbst liegt in src/lib/ics.ts, geteilt mit dem
 * Sammel-Feed /api/events/ics.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await params;

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, name, date, start_time, venue, description, cancelled_at")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.cancelled_at) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(req.url).origin);
  const day = (event.date as string).replace(/-/g, "");

  return new NextResponse(buildCalendar([event as IcsEvent], baseUrl), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="passly-${day}.ics"`,
      "Cache-Control": "no-store",
    },
  }) as NextResponse;
}
