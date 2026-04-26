import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "";
  const date = searchParams.get("date") ?? "";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const metadata = {
    name,
    symbol: "TOKN",
    description: date
      ? `NFT ticket for ${name} on ${date}`
      : `NFT ticket for ${name}`,
    image: "",
    attributes: [
      { trait_type: "Event Name", value: name },
      ...(date ? [{ trait_type: "Event Date", value: date }] : []),
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
