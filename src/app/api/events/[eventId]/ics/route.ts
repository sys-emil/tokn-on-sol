import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Kalender-Export: liefert das Event als .ics-Datei ("Zum Kalender
 * hinzufügen" auf Ticket- und Kaufbestätigungsseite). Enthält nur die
 * öffentlichen Event-Daten, die der Käufer ohnehin sieht.
 *
 * Mit `start_time` wird ein Termin in Europe/Berlin erzeugt (Ende +3 h als
 * Platzhalter — Events haben kein Endfeld); ohne Uhrzeit ein Ganztagstermin.
 */

// RFC 5545: backslash, semicolon, comma and newlines must be escaped in text values.
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const VTIMEZONE_BERLIN = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

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
  const startTime = event.start_time as string | null;

  const dtLines: string[] = [];
  if (startTime) {
    const startDt = new Date(`${event.date}T${startTime}:00`);
    const endDt = new Date(startDt.getTime() + 3 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
    dtLines.push(`DTSTART;TZID=Europe/Berlin:${fmt(startDt)}`);
    dtLines.push(`DTEND;TZID=Europe/Berlin:${fmt(endDt)}`);
  } else {
    const next = new Date(`${event.date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    dtLines.push(`DTSTART;VALUE=DATE:${day}`);
    dtLines.push(`DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`);
  }

  const now = new Date();
  const stamp = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const description = [
    (event.description as string | null) ?? "",
    `Dein Ticket: ${baseUrl}/my-tickets`,
  ].filter(Boolean).join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Passly//Tickets//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(startTime ? VTIMEZONE_BERLIN : []),
    "BEGIN:VEVENT",
    `UID:passly-event-${event.id}@getpassly.de`,
    `DTSTAMP:${stamp}`,
    ...dtLines,
    `SUMMARY:${icsEscape(event.name as string)}`,
    ...(event.venue ? [`LOCATION:${icsEscape(event.venue as string)}`] : []),
    ...(description ? [`DESCRIPTION:${icsEscape(description)}`] : []),
    `URL:${baseUrl}/shop/${event.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="passly-${day}.ics"`,
      "Cache-Control": "no-store",
    },
  }) as NextResponse;
}
