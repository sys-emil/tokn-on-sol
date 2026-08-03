/**
 * Eine Kategorie gilt als VIP, wenn ihr Name das Wort enthält — die Wortgrenze
 * verhindert, dass "Vipassana-Retreat" plötzlich golden leuchtet.
 *
 * Die Regel lag dreifach kopiert im Code (ShopClient, Ticketseite,
 * /my-tickets). Sie steuert eine sichtbare Sonderbehandlung, also braucht sie
 * genau eine Quelle — sonst zeigt die Vorschau Gold, wo das Ticket keins hat.
 */
export function isVipTier(tierName: string | null | undefined): boolean {
  return /\bvip\b/i.test(tierName ?? "");
}
