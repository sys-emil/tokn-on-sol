import { supabaseAdmin } from "@/lib/supabase";

/**
 * Wer im öffentlichen Schaufenster erscheinen darf.
 *
 * Seit der Wegfall der manuellen Freigabe (2026-09-07) ist die Anmeldung als
 * Veranstalter sofort wirksam — jeder kann anlegen, verkaufen und seinen Link
 * verteilen. Was nicht sofort wirksam ist, ist die *Reichweite*: `/events`, die
 * Startseite, die Sitemap und der ICS-Feed zeigen nur Veranstalter mit
 * `organizers.is_vetted`. Gesetzt wird das Flag automatisch mit abgeschlossenem
 * Stripe-KYC (eine echte Identitätsprüfung, die Passly selbst nicht leistet)
 * oder von Hand im Admin — nötig für Veranstalter, die ausschließlich
 * kostenlose Events machen und deshalb nie ein Connect-Konto verifizieren.
 *
 * Bewusst NICHT gefiltert werden die Direktlinks `/shop/[id]`, `/event/[id]`,
 * `/pass/[id]` und `/@handle`: das sind die eigenen Links des Veranstalters und
 * laut Positionierung ohnehin sein ganzer Vertriebsweg. Gegenstand der Sperre
 * ist das Schaufenster, nicht der Verkauf.
 *
 * Eine leere Liste ist ein gültiges Ergebnis (dann zeigt das Listing nichts).
 * Ein DB-Fehler liefert ebenfalls die leere Liste: im Zweifel lieber ein leeres
 * Schaufenster als eines, das jeden hereinlässt.
 */
export async function listedOrganizerWallets(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("organizers")
    .select("wallet_address")
    .eq("is_vetted", true);

  if (error) {
    console.error("listedOrganizerWallets:", error.message);
    return [];
  }
  return (data ?? []).map((o) => o.wallet_address as string);
}
