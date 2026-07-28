import { NextRequest, NextResponse } from "next/server";
import { mintTicket } from "@/lib/mint";
import { requireAdmin } from "@/lib/adminAuth";

interface MintRequestBody {
  eventName: string;
  eventDate: string;
  ownerWallet: string;
}

// Manual admin/ops mint; nothing in the app calls this; the purchase flow
// mints via the mint_jobs worker. Gated because an open endpoint would let
// anyone mint real assets at the operator's expense.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: MintRequestBody;

  try {
    body = (await req.json()) as MintRequestBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventName, eventDate, ownerWallet } = body;

  if (!eventName || !eventDate || !ownerWallet) {
    return NextResponse.json(
      { success: false, error: "eventName, eventDate, and ownerWallet are required" },
      { status: 400 }
    );
  }

  try {
    const host = req.headers.get("host") ?? "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    const result = await mintTicket({ eventName, eventDate, ownerWallet, baseUrl });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
