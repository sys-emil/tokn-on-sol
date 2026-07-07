import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";
import { uploadEventMetadata, isOwnStorageUrl } from "@/lib/eventMetadata";

interface CreateEventBody {
  organizer_wallet: string;
  name: string;
  date: string;
  price_eur: number;
  capacity: number;
  is_private?: boolean;
  payout_hold_days?: number;
  image_url?: string;
  venue?: string;
  description?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CreateEventBody;

  try {
    body = (await req.json()) as CreateEventBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { organizer_wallet, name, date, price_eur, capacity, is_private, payout_hold_days, image_url, venue, description } = body;

  if (!organizer_wallet || !name || !date) {
    return NextResponse.json(
      { success: false, error: "organizer_wallet, name, and date are required" },
      { status: 400 }
    );
  }

  if (typeof price_eur !== "number" || price_eur < 0) {
    return NextResponse.json(
      { success: false, error: "price_eur must be a non-negative number" },
      { status: 400 }
    );
  }

  if (typeof capacity !== "number" || capacity < 1 || capacity > 10000) {
    return NextResponse.json(
      { success: false, error: "capacity must be between 1 and 10000" },
      { status: 400 }
    );
  }

  if (venue !== undefined && (typeof venue !== "string" || venue.length > 200)) {
    return NextResponse.json(
      { success: false, error: "venue must be a string of at most 200 characters" },
      { status: 400 }
    );
  }

  if (description !== undefined && (typeof description !== "string" || description.length > 2000)) {
    return NextResponse.json(
      { success: false, error: "description must be a string of at most 2000 characters" },
      { status: 400 }
    );
  }

  const holdDays = payout_hold_days ?? 0;
  if (!Number.isInteger(holdDays) || holdDays < 0 || holdDays > 90) {
    return NextResponse.json(
      { success: false, error: "payout_hold_days must be an integer between 0 and 90" },
      { status: 400 }
    );
  }

  // Only URLs from our own upload endpoint end up in on-chain metadata.
  if (image_url !== undefined && (typeof image_url !== "string" || !isOwnStorageUrl(image_url))) {
    return NextResponse.json(
      { success: false, error: "image_url must come from /api/events/upload-image" },
      { status: 400 }
    );
  }

  // The caller must prove ownership of organizer_wallet via their Privy auth
  // token — otherwise anyone could create events in another organizer's name.
  if (!(await requestOwnsWallet(req, organizer_wallet))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Authoritative organizer gate — must be approved before creating events.
  // Incomplete Stripe Connect onboarding does NOT block event creation: paid
  // ticket sales are gated at checkout instead (/api/checkout/create returns
  // 503 until the organizer's Connect account has charges_enabled).
  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("status")
    .eq("wallet_address", organizer_wallet)
    .eq("status", "approved")
    .maybeSingle();

  if (!organizer) {
    return NextResponse.json(
      { success: false, error: "Not an approved organizer" },
      { status: 403 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("events")
      .insert({
        organizer_wallet: organizer_wallet.trim(),
        name: name.trim(),
        date,
        price_eur,
        capacity,
        is_private: is_private === true,
        payout_hold_days: holdDays,
        image_url: image_url ?? null,
        venue: venue?.trim() || null,
        description: description?.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Static metadata JSON for the cNFT mints of this event. Best-effort:
    // if the upload fails, metadata_uri stays NULL and the mint falls back
    // to the legacy /api/tickets/metadata route.
    try {
      const metadataUri = await uploadEventMetadata({
        eventId: data.id,
        name: name.trim(),
        date,
        imageUrl: image_url ?? null,
        venue: venue?.trim() || null,
        description: description?.trim() || null,
      });
      await supabaseAdmin
        .from("events")
        .update({ metadata_uri: metadataUri })
        .eq("id", data.id);
    } catch (err) {
      console.error(`Metadata upload for event ${data.id} failed:`, err);
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
