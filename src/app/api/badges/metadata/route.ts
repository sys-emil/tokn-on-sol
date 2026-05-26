import { NextRequest, NextResponse } from "next/server";

const BADGE_META: Record<string, { name: string; description: string }> = {
  first_show: {
    name: "First Show",
    description: "Attended their very first event on Passly.",
  },
  show_5: {
    name: "5 Shows",
    description: "Attended 5 events — a regular in the making.",
  },
  show_10: {
    name: "10 Shows",
    description: "10 shows attended. This is a lifestyle.",
  },
  loyal_organizer: {
    name: "Loyal Fan",
    description: "Showed up 3 times for the same organizer.",
  },
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const type = new URL(req.url).searchParams.get("type") ?? "";
  const meta = BADGE_META[type];

  if (!meta) {
    return NextResponse.json({ error: "Unknown badge type" }, { status: 400 });
  }

  return NextResponse.json(
    {
      name: meta.name,
      symbol: "BADG",
      description: meta.description,
      image: "",
      attributes: [
        { trait_type: "Badge Type", value: type },
        { trait_type: "Category", value: "Achievement" },
      ],
    },
    { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
