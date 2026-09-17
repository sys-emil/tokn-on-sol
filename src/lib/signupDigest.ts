import { supabaseAdmin } from "@/lib/supabase";
import { sendAdminSignupDigest } from "@/lib/email";

/**
 * Taegliche Anmelde-Zusammenfassung an den Admin (seit 2026-09-17).
 *
 * Eine Veranstalter-Registrierung schickt sofort einen Alarm
 * (/api/organizers/apply); die Gast-Anmeldung dagegen legt in
 * `getOrCreateUser` still eine Zeile an, und der einzige Blick darauf war die
 * Supabase-Tabelle. Pro Login eine Mail waere bei einem Vorverkauf mit 150
 * Kaeufern 150 Mails — deshalb einmal taeglich aus dem Payout-Cron, und wie
 * beim Verkaufs-Digest **nur an Tagen mit mindestens einer Anmeldung**.
 *
 * Nur Zahlen, keine Adressen: der Admin hat die Tabelle ohnehin, und eine
 * Mail mit hundert Gast-E-Mails braucht niemand. Kein einmaliger Claim; ein
 * doppelter Lauf wiederholt hoechstens dieselbe Zusammenfassung.
 */
export async function sendDailySignupDigest(baseUrl: string): Promise<{ signups: number; organizers: number; sent: boolean }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recent } = await supabaseAdmin
    .from("users")
    .select("wallet_address")
    .gte("created_at", since)
    .limit(20000);
  const wallets = ((recent ?? []) as { wallet_address: string }[]).map((u) => u.wallet_address);
  if (wallets.length === 0) return { signups: 0, organizers: 0, sent: false };

  // Wie viele der neuen Konten sind gleich Veranstalter geworden. Ueber die
  // Wallet, nicht ueber `organizers.created_at`: ein Konto von gestern, das
  // heute Veranstalter wird, zaehlt beim naechsten Lauf nicht mehr als neu.
  const { count: organizerCount } = await supabaseAdmin
    .from("organizers")
    .select("id", { count: "exact", head: true })
    .in("wallet_address", wallets);
  const organizers = organizerCount ?? 0;

  const { count: total } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true });

  await sendAdminSignupDigest({ signups: wallets.length, organizers, total: total ?? wallets.length, baseUrl });
  return { signups: wallets.length, organizers, sent: true };
}
