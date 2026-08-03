/**
 * Kalender-Export (RFC 5545). Gemeinsame Basis für den Einzel-Event-Download
 * (`/api/events/[eventId]/ics`) und den Sammel-Feed der Event-Liste
 * (`/api/events/ics`, "Kalender abonnieren").
 *
 * Mit `start_time` entsteht ein Termin in Europe/Berlin (Ende +3 h als
 * Platzhalter; Events haben kein Endfeld), ohne Uhrzeit ein Ganztagstermin.
 */

export interface IcsEvent {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  venue: string | null;
  description: string | null;
}

// RFC 5545: backslash, semicolon, comma and newlines must be escaped in text values.
export function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export const VTIMEZONE_BERLIN = [
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

/** Die VEVENT-Zeilen eines Events (ohne VCALENDAR-Rahmen). */
export function buildVevent(event: IcsEvent, baseUrl: string, stamp: string): string[] {
  const day = event.date.replace(/-/g, "");
  const dtLines: string[] = [];

  if (event.start_time) {
    const startDt = new Date(`${event.date}T${event.start_time}:00`);
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

  const description = [
    event.description ?? "",
    `Dein Ticket: ${baseUrl}/my-tickets`,
  ].filter(Boolean).join("\n\n");

  return [
    "BEGIN:VEVENT",
    `UID:passly-event-${event.id}@getpassly.de`,
    `DTSTAMP:${stamp}`,
    ...dtLines,
    `SUMMARY:${icsEscape(event.name)}`,
    ...(event.venue ? [`LOCATION:${icsEscape(event.venue)}`] : []),
    ...(description ? [`DESCRIPTION:${icsEscape(description)}`] : []),
    `URL:${baseUrl}/event/${event.id}`,
    "END:VEVENT",
  ];
}

/** Ein vollständiger Kalender aus beliebig vielen Events. */
export function buildCalendar(events: IcsEvent[], baseUrl: string, calendarName?: string): string {
  const now = new Date();
  const stamp = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const needsTimezone = events.some((e) => e.start_time);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Passly//Tickets//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(calendarName ? [`X-WR-CALNAME:${icsEscape(calendarName)}`] : []),
    ...(needsTimezone ? VTIMEZONE_BERLIN : []),
    ...events.flatMap((e) => buildVevent(e, baseUrl, stamp)),
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}
