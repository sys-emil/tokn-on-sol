import { NextRequest, NextResponse } from "next/server";
import { mintTicket } from "@/lib/mint";

interface MintRequestBody {
  eventName: string;
  eventDate: string;
  ownerWallet: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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
