import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateUser, type PasslyUser } from "@/lib/users";

function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const token = header.replace("Bearer ", "").trim();
  return token || null;
}

/**
 * Der Passly-Nutzer hinter einer Anfrage, oder null wenn niemand angemeldet ist.
 *
 * Die einzige Stelle im Projekt, die weiss, wer die Anmeldung macht. Alles
 * dahinter arbeitet mit `PasslyUser` — deshalb war der Wechsel von Privy auf
 * Supabase Auth eine Aenderung an dieser Funktion und nicht an 26 Routen.
 */
export async function requestUser(req: NextRequest): Promise<PasslyUser | null> {
  const token = bearer(req);
  if (!token) return null;

  try {
    // Prueft die Signatur des Tokens gegen das Projekt. Frueher standen hier
    // zwei Netzwerkaufrufe zum Wallet-Anbieter pro geschuetzter Anfrage.
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return await getOrCreateUser(data.user.id, data.user.email ?? "");
  } catch {
    return null;
  }
}

/**
 * Die Anfrage stammt vom Inhaber dieser Adresse.
 *
 * Behaelt Name und Signatur der frueheren Privy-Variante, damit die
 * Veranstalter-Routen unveraendert bleiben. Eine Adresse im Request beweist
 * weiterhin nichts fuer sich; sie wird gegen die Sitzung geprueft.
 */
export async function requestOwnsWallet(req: NextRequest, walletAddress: string): Promise<boolean> {
  if (!walletAddress) return false;
  const user = await requestUser(req);
  return !!user && user.walletAddress === walletAddress;
}
