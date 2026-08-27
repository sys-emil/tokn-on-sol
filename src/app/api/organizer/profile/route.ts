import { NextRequest, NextResponse } from "next/server";
import { requestOwnsWallet } from "@/lib/sessionUser";
import { supabaseAdmin } from "@/lib/supabase";
import { isOwnStorageUrl } from "@/lib/eventMetadata";
import { validateHandle } from "@/lib/organizerHandle";

export const dynamic = "force-dynamic";

const MAX_NAME = 40;
const MAX_BIO = 240;
const MAX_LINKS = 5;
const MAX_LINK_LABEL = 24;

export interface OrganizerLink {
  label: string;
  url: string;
}

export interface OrganizerProfile {
  wallet_address: string;
  handle: string | null;
  public_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  links: OrganizerLink[];
  accent_hue: number | null;
  featured_event_id: string | null;
  is_verified: boolean;
  verified_label: string | null;
  plan: string;
  status: string;
  name: string;
  business_name: string | null;
  type: "private" | "business";
}

const SELECT =
  "wallet_address, handle, public_name, bio, avatar_url, banner_url, links, accent_hue, featured_event_id, is_verified, verified_label, plan, status, name, business_name, type";

/** Own organizer profile for the dashboard editor; requires wallet ownership. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = req.nextUrl.searchParams.get("walletAddress") ?? "";
  if (!(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("organizers")
    .select(SELECT)
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: "profile_load_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "not_an_organizer" }, { status: 404 });
  }
  return NextResponse.json({ success: true, profile: data as OrganizerProfile });
}

interface PutBody {
  walletAddress: string;
  handle?: string | null;
  publicName?: string;
  bio?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  links?: OrganizerLink[];
  accentHue?: number | null;
  featuredEventId?: string | null;
}

function cleanLinks(input: unknown): OrganizerLink[] {
  if (!Array.isArray(input)) return [];
  const out: OrganizerLink[] = [];
  for (const raw of input.slice(0, MAX_LINKS)) {
    if (!raw || typeof raw !== "object") continue;
    const label = String((raw as OrganizerLink).label ?? "").trim().slice(0, MAX_LINK_LABEL);
    const url = String((raw as OrganizerLink).url ?? "").trim();
    if (!label || !/^https?:\/\/.+/i.test(url) || url.length > 400) continue;
    out.push({ label, url });
  }
  return out;
}

function cleanImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return isOwnStorageUrl(trimmed) ? trimmed : null;
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const walletAddress = body.walletAddress ?? "";
  if (!(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Must be an approved organizer to have a public profile.
  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("wallet_address, plan, status")
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  if (!organizer || organizer.status !== "approved") {
    return NextResponse.json({ success: false, error: "not_approved" }, { status: 403 });
  }
  const isPro = organizer.plan === "pro";

  // Handle: optional. When present it must pass format/reserved checks and be
  // unique (case-insensitive) across other organizers.
  let handle: string | null | undefined;
  if (body.handle === null || body.handle === "") {
    handle = null;
  } else if (typeof body.handle === "string") {
    const valid = validateHandle(body.handle);
    if (!valid) {
      return NextResponse.json({ success: false, error: "handle_invalid" }, { status: 400 });
    }
    const { data: taken } = await supabaseAdmin
      .from("organizers")
      .select("wallet_address")
      .ilike("handle", valid)
      .neq("wallet_address", walletAddress)
      .maybeSingle();
    if (taken) {
      return NextResponse.json({ success: false, error: "handle_taken" }, { status: 409 });
    }
    handle = valid;
  }

  const update: Record<string, unknown> = {
    public_name: (body.publicName ?? "").trim().slice(0, MAX_NAME) || null,
    bio: (body.bio ?? "").trim().slice(0, MAX_BIO) || null,
    avatar_url: cleanImageUrl(body.avatarUrl),
    banner_url: cleanImageUrl(body.bannerUrl),
    links: cleanLinks(body.links),
  };
  if (handle !== undefined) update.handle = handle;

  // Pro-only customizations: silently ignored on the free plan (the UI locks
  // them, this is the server-side backstop).
  if (isPro) {
    const hue = body.accentHue;
    update.accent_hue = typeof hue === "number" && hue >= 0 && hue <= 360 ? Math.round(hue) : null;

    let featured: string | null = null;
    if (body.featuredEventId) {
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("id", body.featuredEventId)
        .eq("organizer_wallet", walletAddress)
        .maybeSingle();
      featured = ev ? (ev.id as string) : null;
    }
    update.featured_event_id = featured;
  }

  const { data, error } = await supabaseAdmin
    .from("organizers")
    .update(update)
    .eq("wallet_address", walletAddress)
    .select(SELECT)
    .single();

  if (error) {
    // Unique-index race on handle.
    if (error.code === "23505") {
      return NextResponse.json({ success: false, error: "handle_taken" }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: "profile_save_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true, profile: data as OrganizerProfile });
}
