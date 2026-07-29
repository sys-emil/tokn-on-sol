import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { SeasonPass } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";
import { uploadPassMetadata } from "@/lib/eventMetadata";

export const dynamic = "force-dynamic";

/**
 * Season-pass CRUD for organizers. Free for every approved organizer (like
 * resale, unlike discount codes) — a pass is a way to sell a series, not a
 * dashboard analytic.
 *
 * The pass's capacity is its own pot and claims no seats in the member events;
 * see src/lib/seasonPass.ts for why.
 */

const MAX_PASSES = 10;
const MAX_EVENTS_PER_PASS = 60;

interface PassBody {
  walletAddress?: string;
  passId?: string;
  name?: string;
  description?: string | null;
  priceEur?: number;
  capacity?: number;
  payoutHoldDays?: number;
  active?: boolean;
  eventIds?: string[];
}

type Gate = { organizerWallet: string } | NextResponse;

/** Privy token must own the wallet AND that wallet must be an approved organizer. */
async function gate(req: NextRequest, walletAddress: string): Promise<Gate> {
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }
  if (!(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("id")
    .eq("wallet_address", walletAddress)
    .eq("status", "approved")
    .maybeSingle();
  if (!organizer) {
    return NextResponse.json({ error: "Not an approved organizer" }, { status: 403 });
  }
  return { organizerWallet: walletAddress };
}

function passView(row: SeasonPass, eventIds: string[]) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_eur,
    capacity: row.capacity,
    ticketsSold: row.tickets_sold,
    ticketsReserved: row.tickets_reserved,
    active: row.active,
    payoutHoldDays: row.payout_hold_days,
    createdAt: row.created_at,
    eventIds,
  };
}

/** Validates the editable fields; returns an error message or null. */
function validate(body: PassBody, { requireAll }: { requireAll: boolean }): string | null {
  if (requireAll || body.name !== undefined) {
    const name = (body.name ?? "").trim();
    if (!name || name.length > 80) return "Der Name muss 1–80 Zeichen lang sein.";
  }
  if (requireAll || body.priceEur !== undefined) {
    if (!Number.isInteger(body.priceEur) || (body.priceEur as number) < 0) {
      return "Der Preis muss eine ganze Zahl in Cent sein.";
    }
  }
  if (requireAll || body.capacity !== undefined) {
    if (!Number.isInteger(body.capacity) || (body.capacity as number) < 1 || (body.capacity as number) > 10000) {
      return "Die Stückzahl muss zwischen 1 und 10000 liegen.";
    }
  }
  if (body.payoutHoldDays !== undefined && body.payoutHoldDays !== null) {
    if (!Number.isInteger(body.payoutHoldDays) || body.payoutHoldDays < 0 || body.payoutHoldDays > 90) {
      return "Der Auszahlungs-Puffer muss zwischen 0 und 90 Tagen liegen.";
    }
  }
  if (body.description != null && body.description.length > 2000) {
    return "Die Beschreibung ist zu lang.";
  }
  return null;
}

/**
 * Replaces the pass's dates. Every event must belong to the same organizer,
 * otherwise a pass could grant admission to somebody else's show.
 */
async function setPassEvents(
  passId: string,
  organizerWallet: string,
  eventIds: string[],
): Promise<string | null> {
  const unique = [...new Set(eventIds)];
  if (unique.length > MAX_EVENTS_PER_PASS) {
    return `Ein Pass kann höchstens ${MAX_EVENTS_PER_PASS} Termine enthalten.`;
  }

  if (unique.length > 0) {
    const { data: owned } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("organizer_wallet", organizerWallet)
      .in("id", unique);
    if ((owned?.length ?? 0) !== unique.length) {
      return "Mindestens ein Termin gehört nicht zu deinem Konto.";
    }
  }

  await supabaseAdmin.from("season_pass_events").delete().eq("pass_id", passId);
  if (unique.length > 0) {
    const { error } = await supabaseAdmin
      .from("season_pass_events")
      .insert(unique.map((eventId) => ({ pass_id: passId, event_id: eventId })));
    if (error) return error.message;
  }
  return null;
}

/** Dates of the pass's events, ascending; also used to refresh the cNFT metadata. */
async function eventsOfPass(passId: string): Promise<{ ids: string[]; dates: string[] }> {
  const { data } = await supabaseAdmin
    .from("season_pass_events")
    .select("event_id, events(date)")
    .eq("pass_id", passId);

  const rows = ((data ?? []) as { event_id: string; events: { date: string } | { date: string }[] | null }[])
    .map((row) => {
      const ev = Array.isArray(row.events) ? row.events[0] : row.events;
      return { id: row.event_id, date: (ev?.date as string | undefined) ?? "" };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return { ids: rows.map((r) => r.id), dates: rows.map((r) => r.date).filter(Boolean) };
}

/**
 * (Re)writes the pass metadata JSON. Best-effort on edits: the file is only
 * read by wallets, so a storage hiccup must not block the organizer's change.
 */
async function refreshMetadata(pass: SeasonPass, dates: string[]): Promise<string | null> {
  try {
    return await uploadPassMetadata({
      passId: pass.id,
      name: pass.name,
      description: pass.description,
      imageUrl: pass.image_url,
      eventDates: dates,
    });
  } catch (err) {
    console.error(`Pass metadata upload failed for ${pass.id}:`, err);
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const walletAddress = new URL(req.url).searchParams.get("walletAddress") ?? "";
  const gated = await gate(req, walletAddress);
  if (gated instanceof NextResponse) return gated;

  const { data } = await supabaseAdmin
    .from("season_passes")
    .select("*")
    .eq("organizer_wallet", walletAddress)
    .order("created_at", { ascending: false });

  const passes = (data ?? []) as SeasonPass[];
  const links = passes.length > 0
    ? (await supabaseAdmin
        .from("season_pass_events")
        .select("pass_id, event_id")
        .in("pass_id", passes.map((p) => p.id))).data ?? []
    : [];

  const byPass = new Map<string, string[]>();
  for (const l of links as { pass_id: string; event_id: string }[]) {
    byPass.set(l.pass_id, [...(byPass.get(l.pass_id) ?? []), l.event_id]);
  }

  return NextResponse.json({
    passes: passes.map((p) => passView(p, byPass.get(p.id) ?? [])),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PassBody;
  try {
    body = (await req.json()) as PassBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const gated = await gate(req, body.walletAddress ?? "");
  if (gated instanceof NextResponse) return gated;

  const invalid = validate(body, { requireAll: true });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { count } = await supabaseAdmin
    .from("season_passes")
    .select("id", { count: "exact", head: true })
    .eq("organizer_wallet", gated.organizerWallet)
    .eq("active", true);
  if ((count ?? 0) >= MAX_PASSES) {
    return NextResponse.json(
      { error: `Maximal ${MAX_PASSES} aktive Saisonpässe.` },
      { status: 409 },
    );
  }

  const { data: created, error } = await supabaseAdmin
    .from("season_passes")
    .insert({
      organizer_wallet: gated.organizerWallet,
      name: (body.name as string).trim(),
      description: body.description?.trim() || null,
      price_eur: body.priceEur,
      capacity: body.capacity,
      payout_hold_days: body.payoutHoldDays ?? 0,
    })
    .select("*")
    .single();
  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Anlegen fehlgeschlagen" }, { status: 500 });
  }
  const pass = created as SeasonPass;

  const linkError = await setPassEvents(pass.id, gated.organizerWallet, body.eventIds ?? []);
  if (linkError) {
    await supabaseAdmin.from("season_passes").delete().eq("id", pass.id);
    return NextResponse.json({ error: linkError }, { status: 400 });
  }

  const { ids, dates } = await eventsOfPass(pass.id);
  const metadataUri = await refreshMetadata(pass, dates);
  if (metadataUri) {
    await supabaseAdmin.from("season_passes").update({ metadata_uri: metadataUri }).eq("id", pass.id);
  }

  return NextResponse.json({ pass: passView(pass, ids) });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: PassBody;
  try {
    body = (await req.json()) as PassBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const gated = await gate(req, body.walletAddress ?? "");
  if (gated instanceof NextResponse) return gated;
  if (!body.passId) return NextResponse.json({ error: "passId is required" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("season_passes")
    .select("*")
    .eq("id", body.passId)
    .eq("organizer_wallet", gated.organizerWallet)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Pass nicht gefunden" }, { status: 404 });
  const current = existing as SeasonPass;

  const invalid = validate(body, { requireAll: false });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Capacity may never fall below what is already sold or held in checkout;
  // same rule as ticket tiers.
  if (body.capacity !== undefined) {
    const claimed = current.tickets_sold + current.tickets_reserved;
    if ((body.capacity as number) < claimed) {
      return NextResponse.json(
        { error: `Es sind schon ${claimed} Pässe vergeben; die Stückzahl kann nicht darunter.` },
        { status: 409 },
      );
    }
  }

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.description !== undefined) update.description = body.description?.trim() || null;
  if (body.priceEur !== undefined) update.price_eur = body.priceEur;
  if (body.capacity !== undefined) update.capacity = body.capacity;
  if (body.payoutHoldDays !== undefined) update.payout_hold_days = body.payoutHoldDays;
  if (body.active !== undefined) update.active = body.active;

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin
      .from("season_passes")
      .update(update)
      .eq("id", current.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.eventIds !== undefined) {
    const linkError = await setPassEvents(current.id, gated.organizerWallet, body.eventIds);
    if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });
  }

  const { data: fresh } = await supabaseAdmin
    .from("season_passes")
    .select("*")
    .eq("id", current.id)
    .single();
  const pass = (fresh ?? current) as SeasonPass;

  const { ids, dates } = await eventsOfPass(pass.id);
  const metadataUri = await refreshMetadata(pass, dates);
  if (metadataUri && metadataUri !== pass.metadata_uri) {
    await supabaseAdmin.from("season_passes").update({ metadata_uri: metadataUri }).eq("id", pass.id);
  }

  return NextResponse.json({ pass: passView(pass, ids) });
}

/**
 * Deactivates a pass (stops the sale). A pass that was already sold is never
 * deleted — the tickets in people's accounts must keep resolving.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: PassBody;
  try {
    body = (await req.json()) as PassBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const gated = await gate(req, body.walletAddress ?? "");
  if (gated instanceof NextResponse) return gated;
  if (!body.passId) return NextResponse.json({ error: "passId is required" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("season_passes")
    .select("id, tickets_sold")
    .eq("id", body.passId)
    .eq("organizer_wallet", gated.organizerWallet)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Pass nicht gefunden" }, { status: 404 });

  if ((existing.tickets_sold as number) > 0) {
    await supabaseAdmin.from("season_passes").update({ active: false }).eq("id", existing.id);
    return NextResponse.json({ deactivated: true });
  }

  await supabaseAdmin.from("season_pass_events").delete().eq("pass_id", existing.id);
  await supabaseAdmin.from("season_passes").delete().eq("id", existing.id);
  return NextResponse.json({ deleted: true });
}
