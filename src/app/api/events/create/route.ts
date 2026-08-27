import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";
import {
  uploadEventMetadata,
  isOwnStorageUrl,
  validateGalleryUrls,
  MAX_LONG_DESCRIPTION,
} from "@/lib/eventMetadata";
import { DEFAULT_REENTRY_COOLDOWN_SECONDS, MAX_REENTRY_COOLDOWN_SECONDS } from "@/lib/reentry";
import { isFeePayer, minUnitPriceCentsFor, tooCheapForFeePayer, type FeePayer } from "@/lib/fees";
import { freeCapacityExceeded } from "@/lib/freeTickets";

interface TierInput {
  name: string;
  price_eur: number;
  capacity: number;
}

interface CreateEventBody {
  organizer_wallet: string;
  name: string;
  date: string;
  /** Optional start time "HH:MM" (24h). */
  start_time?: string | null;
  /** Legacy single-price form; used when `tiers` is absent. */
  price_eur?: number;
  capacity?: number;
  /** 1–5 price categories; event capacity = sum, display price = min. */
  tiers?: TierInput[];
  is_private?: boolean;
  payout_hold_days?: number;
  image_url?: string | null;
  /** Extra images for the showcase page /event/[id]; max 8, same storage gate as image_url. */
  gallery_urls?: string[];
  venue?: string | null;
  description?: string | null;
  /** Long-form text on the showcase page; `description` stays the short teaser. */
  long_description?: string | null;
  /** Organizer-chosen accent hue (0–360) for buyer-facing ticket cards. Free for all organizers. */
  accent_hue?: number | null;
  /** Pro-only card border preset. */
  border_style?: string | null;
  /** Max resale markup over face value in percent (0–200). NULL/absent = resale disabled. */
  resale_enabled?: boolean;
  /** Who carries the service fee: 'buyer' (default), 'split' or 'organizer'. */
  fee_payer?: string;
  reentry_enabled?: boolean;
  reentry_cooldown_seconds?: number;
}

const MAX_TIERS = 5;
const BORDER_STYLES = ["gold", "chrome", "aurora", "neon"] as const;

function normalizeTiers(body: CreateEventBody): TierInput[] | { error: string } {
  const raw = body.tiers && body.tiers.length > 0
    ? body.tiers
    : [{ name: "Standard", price_eur: body.price_eur ?? NaN, capacity: body.capacity ?? NaN }];

  if (raw.length > MAX_TIERS) {
    return { error: `at most ${MAX_TIERS} ticket tiers are allowed` };
  }

  const tiers: TierInput[] = [];
  for (const t of raw) {
    const name = typeof t.name === "string" ? t.name.trim() : "";
    if (!name || name.length > 80) {
      return { error: "each tier needs a name of 1–80 characters" };
    }
    if (!Number.isInteger(t.price_eur) || t.price_eur < 0) {
      return { error: "tier price_eur must be a non-negative integer (cents)" };
    }
    if (!Number.isInteger(t.capacity) || t.capacity < 1) {
      return { error: "tier capacity must be a positive integer" };
    }
    tiers.push({ name, price_eur: t.price_eur, capacity: t.capacity });
  }

  const names = new Set(tiers.map((t) => t.name.toLowerCase()));
  if (names.size !== tiers.length) {
    return { error: "tier names must be unique" };
  }
  const totalCapacity = tiers.reduce((sum, t) => sum + t.capacity, 0);
  if (totalCapacity > 10000) {
    return { error: "total capacity must be at most 10000" };
  }
  return tiers;
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

  const { organizer_wallet, name, date, start_time, is_private, payout_hold_days, image_url, gallery_urls, venue, description, long_description, accent_hue, border_style, resale_enabled, reentry_enabled, reentry_cooldown_seconds, fee_payer } = body;

  if (!organizer_wallet || !name || !date) {
    return NextResponse.json(
      { success: false, error: "organizer_wallet, name, and date are required" },
      { status: 400 }
    );
  }

  const tiersOrError = normalizeTiers(body);
  if ("error" in tiersOrError) {
    return NextResponse.json({ success: false, error: tiersOrError.error }, { status: 400 });
  }
  const tiers = tiersOrError;
  const capacity = tiers.reduce((sum, t) => sum + t.capacity, 0);
  const price_eur = Math.min(...tiers.map((t) => t.price_eur));

  // Optionale Felder kommen aus dem Editor als `null`, wenn sie leer sind (und
  // das Titelbild wird durch `null` wieder entfernt). `null` ist hier also
  // dasselbe wie "nicht gesetzt" — genau wie in /api/events/update.
  if (start_time !== undefined && start_time !== null
      && (typeof start_time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time))) {
    return NextResponse.json(
      { success: false, error: "start_time must be HH:MM (24h)" },
      { status: 400 }
    );
  }

  if (venue !== undefined && venue !== null && (typeof venue !== "string" || venue.length > 200)) {
    return NextResponse.json(
      { success: false, error: "venue must be a string of at most 200 characters" },
      { status: 400 }
    );
  }

  if (description !== undefined && description !== null
      && (typeof description !== "string" || description.length > 2000)) {
    return NextResponse.json(
      { success: false, error: "description must be a string of at most 2000 characters" },
      { status: 400 }
    );
  }

  if (long_description !== undefined && long_description !== null
      && (typeof long_description !== "string" || long_description.length > MAX_LONG_DESCRIPTION)) {
    return NextResponse.json(
      { success: false, error: `long_description must be a string of at most ${MAX_LONG_DESCRIPTION} characters` },
      { status: 400 }
    );
  }

  let gallery: string[] = [];
  if (gallery_urls !== undefined) {
    const checked = validateGalleryUrls(gallery_urls);
    if ("error" in checked) {
      return NextResponse.json({ success: false, error: checked.error }, { status: 400 });
    }
    gallery = checked;
  }

  const holdDays = payout_hold_days ?? 0;
  if (!Number.isInteger(holdDays) || holdDays < 0 || holdDays > 90) {
    return NextResponse.json(
      { success: false, error: "payout_hold_days must be an integer between 0 and 90" },
      { status: 400 }
    );
  }

  // Re-entry lets guests leave and come back; the cooldown is what stops one
  // QR from walking a whole queue past the scanner.
  const reentryCooldown = reentry_cooldown_seconds ?? DEFAULT_REENTRY_COOLDOWN_SECONDS;
  if (!Number.isInteger(reentryCooldown) || reentryCooldown < 0 || reentryCooldown > MAX_REENTRY_COOLDOWN_SECONDS) {
    return NextResponse.json(
      { success: false, error: `reentry_cooldown_seconds must be an integer between 0 and ${MAX_REENTRY_COOLDOWN_SECONDS}` },
      { status: 400 }
    );
  }

  // Only URLs from our own upload endpoint end up in on-chain metadata.
  if (image_url !== undefined && image_url !== null
      && (typeof image_url !== "string" || !isOwnStorageUrl(image_url))) {
    return NextResponse.json(
      { success: false, error: "image_url must come from /api/events/upload-image" },
      { status: 400 }
    );
  }

  if (accent_hue !== undefined && accent_hue !== null && (!Number.isInteger(accent_hue) || accent_hue < 0 || accent_hue > 360)) {
    return NextResponse.json(
      { success: false, error: "accent_hue must be an integer between 0 and 360" },
      { status: 400 }
    );
  }

  if (border_style !== undefined && border_style !== null && !BORDER_STYLES.includes(border_style as typeof BORDER_STYLES[number])) {
    return NextResponse.json(
      { success: false, error: `border_style must be one of: ${BORDER_STYLES.join(", ")}` },
      { status: 400 }
    );
  }

  // Who carries the service fee. A tier priced below the fee's own share would
  // leave the organizer with nothing (or less than nothing), so the mode and
  // the tier prices have to be checked against each other.
  const feePayer: FeePayer = fee_payer === undefined ? "buyer" : (isFeePayer(fee_payer) ? fee_payer : "buyer");
  if (fee_payer !== undefined && !isFeePayer(fee_payer)) {
    return NextResponse.json(
      { success: false, error: "fee_payer must be one of: buyer, split, organizer" },
      { status: 400 }
    );
  }
  const tooCheap = tooCheapForFeePayer(tiers.map((t) => t.price_eur), feePayer);
  if (tooCheap !== null) {
    return NextResponse.json(
      {
        success: false,
        error: `fee_payer '${feePayer}' requires every paid tier to cost at least `
          + `${minUnitPriceCentsFor(feePayer)} cents (found ${tooCheap})`,
      },
      { status: 400 }
    );
  }

  // The caller must prove ownership of organizer_wallet via their Privy auth
  // token; otherwise anyone could create events in another organizer's name.
  if (!(await requestOwnsWallet(req, organizer_wallet))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Authoritative organizer gate; must be approved before creating events.
  // Incomplete Stripe Connect onboarding does NOT block event creation: paid
  // ticket sales are gated at checkout instead (/api/checkout/create returns
  // 503 until the organizer's Connect account has charges_enabled).
  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("status, plan")
    .eq("wallet_address", organizer_wallet)
    .eq("status", "approved")
    .maybeSingle();

  if (!organizer) {
    return NextResponse.json(
      { success: false, error: "Not an approved organizer" },
      { status: 403 }
    );
  }

  if (border_style && organizer.plan !== "pro") {
    return NextResponse.json({ success: false, error: "pro_required" }, { status: 403 });
  }

  // Free tickets carry no service fee but still cost a mint and a mail each, so
  // the giveaway is capped per event and per plan. Checked here rather than at
  // checkout: the guest must never be the one who runs into it.
  const freeOverflow = freeCapacityExceeded({ tiers, plan: organizer.plan as string | null });
  if (freeOverflow) {
    return NextResponse.json(
      {
        success: false,
        error: `free_ticket_cap: at most ${freeOverflow.cap} free tickets per event on this plan `
          + `(requested ${freeOverflow.requested})`,
      },
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
        start_time: start_time ?? null,
        price_eur,
        capacity,
        is_private: is_private === true,
        payout_hold_days: holdDays,
        image_url: image_url ?? null,
        gallery_urls: gallery,
        venue: venue?.trim() || null,
        description: description?.trim() || null,
        long_description: long_description?.trim() || null,
        accent_hue: accent_hue ?? null,
        border_style: border_style ?? null,
        resale_enabled: resale_enabled === true,
        fee_payer: feePayer,
        reentry_enabled: reentry_enabled === true,
        reentry_cooldown_seconds: reentryCooldown,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Tiers are the price authority at checkout; without them the event is
    // unsellable, so a failed insert removes the event again.
    const { error: tierError } = await supabaseAdmin.from("ticket_tiers").insert(
      tiers.map((t, i) => ({
        event_id: data.id,
        name: t.name,
        price_eur: t.price_eur,
        capacity: t.capacity,
        sort: i,
      })),
    );
    if (tierError) {
      await supabaseAdmin.from("events").delete().eq("id", data.id);
      return NextResponse.json(
        { success: false, error: tierError.message },
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
