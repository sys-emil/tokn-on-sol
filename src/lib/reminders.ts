import { supabaseAdmin } from "@/lib/supabase";
import { sendEventReminder } from "@/lib/email";

/**
 * "Morgen ist es soweit" — day-before reminder to all ticket holders.
 *
 * Runs inside the daily payout cron (both Hobby-plan cron slots are taken, so
 * the reminder can't have its own schedule). The cron fires 03:00 UTC; events
 * whose date is tomorrow in Europe/Berlin get their batch, so the mail lands
 * the morning before the event. `events.reminder_sent_at` is the once-only
 * claim — set while NULL before sending, so re-runs never double-send.
 */

function berlinDatePlusDays(days: number): string {
  const berlinNow = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const d = new Date(`${berlinNow}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function sendDueEventReminders(baseUrl: string): Promise<{ events: number; mails: number }> {
  const tomorrow = berlinDatePlusDays(1);

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, name, date, start_time, venue")
    .eq("date", tomorrow)
    .is("cancelled_at", null)
    .is("reminder_sent_at", null)
    .limit(50);

  let sentEvents = 0;
  let sentMails = 0;

  for (const event of events ?? []) {
    // Claim the event before sending — a concurrent/re-run cron loses here.
    const { data: claimed } = await supabaseAdmin
      .from("events")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", event.id)
      .is("reminder_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    // Recipients: distinct buyer e-mails of non-revoked tickets (same source
    // as the organizer messaging feature).
    const { data: purchases } = await supabaseAdmin
      .from("purchases")
      .select("stripe_session_id")
      .eq("event_id", event.id)
      .is("revoked_at", null)
      .not("stripe_session_id", "is", null);
    const sessionIds = [...new Set(
      ((purchases ?? []) as { stripe_session_id: string }[]).map((p) => p.stripe_session_id),
    )];
    if (sessionIds.length === 0) continue;

    const recipients = new Set<string>();
    const { data: jobs } = await supabaseAdmin
      .from("mint_jobs")
      .select("buyer_email")
      .in("stripe_session_id", sessionIds)
      .not("buyer_email", "is", null);
    for (const j of (jobs ?? []) as { buyer_email: string }[]) recipients.add(j.buyer_email);
    if (recipients.size === 0) continue;

    sentMails += await sendEventReminder({
      recipients: [...recipients],
      eventName: event.name as string,
      eventDate: event.date as string,
      startTime: (event.start_time ?? null) as string | null,
      venue: (event.venue ?? null) as string | null,
      baseUrl,
    });
    sentEvents++;
  }

  return { events: sentEvents, mails: sentMails };
}
