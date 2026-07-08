import { NextRequest, NextResponse } from "next/server";
import { BADGE_META, type BadgeType } from "@/lib/badgeMeta";

const siteUrl = process.env.APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export async function GET(req: NextRequest): Promise<NextResponse> {
  const type = new URL(req.url).searchParams.get("type") ?? "";
  const meta = BADGE_META[type as BadgeType];

  if (!meta) {
    return NextResponse.json({ error: "Unknown badge type" }, { status: 400 });
  }

  return NextResponse.json(
    {
      name: meta.name,
      symbol: "BADG",
      description: meta.description,
      image: `${siteUrl}/badges/${type}.png`,
      attributes: [
        { trait_type: "Badge Type", value: type },
        { trait_type: "Category", value: "Achievement" },
      ],
    },
    { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
