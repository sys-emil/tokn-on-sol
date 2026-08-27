import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase-Client fuer den Browser (Anmeldung, Session, Token).
 *
 * Bewusst getrennt von src/lib/supabase.ts: dort haengt der service-role-Client
 * dran, der nie in ein Client-Bundle geraten darf.
 */
let client: SupabaseClient | null = null;

export function authClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anonKey) {
    // Laut statt still: beide Werte haben anderswo im Projekt einen ""-Fallback,
    // ein fehlender Key wuerde also durch den Build kommen und erst beim ersten
    // Anmeldeversuch auffallen — als wortloser Fehlschlag.
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY muessen gesetzt sein",
    );
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/**
 * Bearer-Token fuer die eigenen API-Routen. Gleiche Signatur wie frueher
 * `getAccessToken` des Wallet-Anbieters, damit die Aufrufstellen unveraendert
 * bleiben — es sind 84.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await authClient().auth.getSession();
  return data.session?.access_token ?? null;
}
