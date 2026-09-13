import { NextRequest, NextResponse } from "next/server";
import { requestUser } from "@/lib/sessionUser";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * The signed-in account, as the client is allowed to see it.
 *
 * Client pages used to read the wallet address straight out of the wallet
 * provider's hook. That address is no longer the one tickets are minted to —
 * it is derived from the user id server-side — so anything that displays or
 * links to it has to ask here instead.
 *
 * Traegt seit 2026-09-13 auch die **Rolle**: `organizerStatus` ist der Stand
 * der `organizers`-Zeile zu dieser Adresse (`none`, wenn es keine gibt). Ein
 * Konto ist erst einmal ein Gastkonto; zum Veranstalter wird es, wenn es sich
 * ueber „Event anlegen" dafuer entscheidet (`/become-organizer`). Die Rolle
 * steht hier und nicht nur in `/api/organizers/status`, weil jede Seite sie
 * fuer die Navigation braucht — ein zweiter Aufruf pro Seite waere zu viel.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await requestUser(req);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { data: org } = await supabaseAdmin
    .from("organizers")
    .select("status")
    .eq("wallet_address", user.walletAddress)
    .maybeSingle();
  const organizerStatus = (org?.status as string | undefined) ?? "none";

  return NextResponse.json(
    { id: user.id, email: user.email, walletAddress: user.walletAddress, organizerStatus },
    { headers: { "Cache-Control": "no-store" } },
  );
}
