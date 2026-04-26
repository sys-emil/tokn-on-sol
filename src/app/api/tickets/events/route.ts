import { NextRequest, NextResponse } from "next/server";

interface DasAsset {
  content: {
    json_uri: string;
    metadata: { name: string };
  };
  compression?: { compressed: boolean };
}

interface DasResponse {
  result?: { items?: DasAsset[]; total?: number };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const ownerWallet = searchParams.get("ownerWallet");

  if (!ownerWallet) {
    return NextResponse.json({ error: "ownerWallet is required" }, { status: 400 });
  }

  const heliusApiKey = process.env.HELIUS_API_KEY ?? "";
  if (!heliusApiKey) {
    return NextResponse.json({ error: "HELIUS_API_KEY not configured" }, { status: 500 });
  }

  const dasUrl = `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  const res = await fetch(dasUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "events-lookup",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: ownerWallet,
        sortBy: { sortBy: "created", sortDirection: "asc" },
        limit: 1000,
      },
    }),
  });

  const das = (await res.json()) as DasResponse;
  const items = das.result?.items ?? [];

  // Only our cNFTs have a json_uri pointing to /api/tickets/metadata
  const ours = items.filter(
    (a) =>
      a.compression?.compressed === true &&
      a.content.json_uri.includes("/api/tickets/metadata")
  );

  // Group by name + date, keyed from the URI query params
  const groups = new Map<string, { name: string; date: string; count: number }>();

  for (const asset of ours) {
    let name = asset.content.metadata.name;
    let date = "";

    try {
      const url = new URL(asset.content.json_uri);
      name = url.searchParams.get("name") ?? name;
      date = url.searchParams.get("date") ?? "";
    } catch {
      // malformed URI — fall back to on-chain name, no date
    }

    const key = `${name}||${date}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { name, date, count: 1 });
    }
  }

  const events = Array.from(groups.values());
  const totalTickets = events.reduce((sum, e) => sum + e.count, 0);

  return NextResponse.json({ events, totalTickets });
}
