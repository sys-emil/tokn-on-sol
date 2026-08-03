import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildCalendar, type IcsEvent } from "@/lib/ics";
import { cityMatches } from "@/lib/eventCity";

export const dynamic = "force-dynamic";

/**
 * Sammel-Kalender der öffentlichen Event-Liste ("Kalender abonnieren" auf
 * /events). Spiegelt die Filter der Seite, damit der Kalender das enthält,
 * was der Besucher gerade sieht: ?veranstalter= und ?stadt=.
 *
 * Private und abgesagte Events bleiben draußen — dieselbe Sichtbarkeitsregel
 * wie in der Listenansicht und im Sitemap.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const veranstalter = searchParams.get("veranstalter");
  const stadt = searchParams.get("stadt");
  const today = new Date().toISOString().slice(0, 10);

  let query = supabaseAdmin
    .from("events")
    .select("id, name, date, start_time, venue, description")
    .gte("date", today)
    .eq("is_private", false)
    .is("cancelled_at", null)
    .order("date", { ascending: true });
  if (veranstalter) query = query.eq("organizer_wallet", veranstalter);

  const { data } = await query;

  // Stadtfilter läuft in JS, weil die Stadt aus dem Freitext-venue abgeleitet wird.
  const events = ((data ?? []) as IcsEvent[]).filter(
    (e) => !stadt || cityMatches(e.venue, stadt),
  );

  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(req.url).origin);

  return new NextResponse(buildCalendar(events, baseUrl, "Passly Events"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="passly-events.ics"',
      "Cache-Control": "no-store",
    },
  }) as NextResponse;
}
