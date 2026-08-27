import { NextRequest, NextResponse } from "next/server";
import { requestUser } from "@/lib/sessionUser";

export const dynamic = "force-dynamic";

/**
 * The signed-in account, as the client is allowed to see it.
 *
 * Client pages used to read the wallet address straight out of the wallet
 * provider's hook. That address is no longer the one tickets are minted to —
 * it is derived from the user id server-side — so anything that displays or
 * links to it has to ask here instead.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await requestUser(req);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  return NextResponse.json(
    { id: user.id, email: user.email, walletAddress: user.walletAddress },
    { headers: { "Cache-Control": "no-store" } },
  );
}
