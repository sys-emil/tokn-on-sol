import { supabaseAdmin } from "@/lib/supabase";
import { sendSalesDigest, type DigestEventLine } from "@/lib/email";

/**
 * Taegliche Verkaufszusammenfassung an den Veranstalter (seit 2026-09-13).
 *
 * Es gab kein Signal fuer einen Verkauf — die erste Woche Vorverkauf bestand
 * aus Dashboard-Neuladen. Der taegliche Payout-Cron (03:00 UTC) schickt jedem
 * Veranstalter mit `daily_digest = true` eine Mail, **wenn in den letzten 24 h
 * mindestens ein Ticket verkauft wurde**: pro Event „gestern n Tickets,
 * verkauft/Kapazitaet, in x Tagen". Kein Verkauf, keine Mail — ein taeglicher
 * Nuller ist Spam. Zaehlt `purchases` (nicht `payouts`), damit Freitickets und
 * Abendkasse mitzaehlen; storniert wird nicht gezaehlt.
 *
 * Kein einmaliger Claim wie bei der Erinnerung: das Fenster ist „seit dem
 * letzten Lauf", und ein doppelter Lauf am selben Tag schickt hoechstens
 * dieselbe Zusammenfassung zweimal. Best-effort, darf den Cron nie scheitern
 * lassen.
 */
export async function sendDailySalesDigests(baseUrl: string): Promise<{ organizers: number; mails: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });

  // Verkaeufe der letzten 24 h, nach Event gruppiert.
  const { data: recent } = await supabaseAdmin
    .from("purchases")
    .select("event_id")
    .gte("created_at", since)
    .is("revoked_at", null)
    .not("event_id", "is", null)
    .limit(20000);
  const soldByEvent = new Map<string, number>();
  for (const p of (recent ?? []) as { event_id: string }[]) {
    soldByEvent.set(p.event_id, (soldByEvent.get(p.event_id) ?? 0) + 1);
  }
  if (soldByEvent.size === 0) return { organizers: 0, mails: 0 };

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, organizer_wallet, name, date, capacity, tickets_sold, cancelled_at")
    .in("id", [...soldByEvent.keys()]);

  const byOrganizer = new Map<string, DigestEventLine[]>();
  for (const e of (events ?? []) as { id: string; organizer_wallet: string; name: string; date: string; capacity: number; tickets_sold: number; cancelled_at: string | null }[]) {
    if (e.cancelled_at) continue;
    const lines = byOrganizer.get(e.organizer_wallet) ?? [];
    lines.push({
      eventId: e.id,
      name: e.name,
      date: e.date,
      soldYesterday: soldByEvent.get(e.id) ?? 0,
      soldTotal: e.tickets_sold,
      capacity: e.capacity,
      daysUntil: Math.round((Date.parse(`${e.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000),
    });
    byOrganizer.set(e.organizer_wallet, lines);
  }
  if (byOrganizer.size === 0) return { organizers: 0, mails: 0 };

  const { data: organizers } = await supabaseAdmin
    .from("organizers")
    .select("wallet_address, email, name, public_name, daily_digest")
    .in("wallet_address", [...byOrganizer.keys()])
    .eq("status", "approved");

  let mails = 0;
  for (const o of (organizers ?? []) as { wallet_address: string; email: string | null; name: string; public_name: string | null; daily_digest: boolean }[]) {
    if (!o.daily_digest || !o.email) continue;
    const lines = (byOrganizer.get(o.wallet_address) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (lines.length === 0) continue;
    try {
      await sendSalesDigest({ to: o.email, name: o.public_name ?? o.name, events: lines, baseUrl });
      mails += 1;
    } catch (err) {
      console.error(`Sales digest to ${o.wallet_address} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return { organizers: byOrganizer.size, mails };
}
