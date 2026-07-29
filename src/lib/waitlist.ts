import { supabaseAdmin } from "@/lib/supabase";
import { sendWaitlistEmail } from "@/lib/email";

/**
 * Waitlist notifications (Pro feature). Entries are collected on the shop
 * page while an event is sold out; when seats free up (refund, expired
 * reservation, or the daily sweep) the not-yet-notified entries get a
 * one-shot "tickets are back" e-mail. Notification is first-come-first-serve
 * on the shop page; the mail reserves nothing.
 */

/** Batch size per freed-seat wave: don't blast 300 people over one seat. */
const NOTIFY_FACTOR = 5;

export async function notifyWaitlistIfSeats(eventId: string, baseUrl: string): Promise<number> {
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, name, capacity, tickets_sold, tickets_reserved, cancelled_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.cancelled_at) return 0;

  const available = Math.max(
    0,
    (event.capacity as number) - (event.tickets_sold as number) - ((event.tickets_reserved as number) ?? 0),
  );
  if (available <= 0) return 0;

  const { data: entries } = await supabaseAdmin
    .from("waitlist_entries")
    .select("id, email")
    .eq("event_id", eventId)
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(available * NOTIFY_FACTOR);
  if (!entries || entries.length === 0) return 0;

  // Claim before sending; a concurrent trigger (webhook + cron) must not
  // double-mail the same entries.
  const ids = entries.map((e) => e.id as string);
  const { data: claimed } = await supabaseAdmin
    .from("waitlist_entries")
    .update({ notified_at: new Date().toISOString() })
    .in("id", ids)
    .is("notified_at", null)
    .select("email, lang");
  const rows = (claimed ?? []) as { email: string; lang: string | null }[];
  if (rows.length === 0) return 0;

  // One batch per language, same reason as the reminder mails.
  const byLang = new Map<string, string[]>();
  for (const r of rows) {
    const key = r.lang === "en" ? "en" : "de";
    byLang.set(key, [...(byLang.get(key) ?? []), r.email]);
  }

  let sent = 0;
  for (const [lang, recipients] of byLang) {
    sent += await sendWaitlistEmail({
      recipients,
      eventName: event.name as string,
      eventId,
      baseUrl,
      lang,
    });
  }
  return sent;
}

/**
 * Daily catch-all (runs in the payout cron): notify every event that has
 * open waitlist entries and free seats; covers seat-freeing paths without
 * their own hook (e.g. reservations swept by release_expired_reservations).
 */
export async function sweepWaitlists(baseUrl: string): Promise<number> {
  const { data: rows } = await supabaseAdmin
    .from("waitlist_entries")
    .select("event_id")
    .is("notified_at", null)
    .limit(2000);
  const eventIds = [...new Set(((rows ?? []) as { event_id: string }[]).map((r) => r.event_id))];

  let mails = 0;
  for (const eventId of eventIds) {
    mails += await notifyWaitlistIfSeats(eventId, baseUrl);
  }
  return mails;
}
