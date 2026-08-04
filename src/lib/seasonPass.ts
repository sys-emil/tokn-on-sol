import { supabaseAdmin } from "@/lib/supabase";

/**
 * Season passes: one ticket that admits to many dates.
 *
 * A pass ticket is an ordinary cNFT in `purchases`, but with `event_id` NULL
 * and `season_pass_id` set. `purchases.redeemed_at` is single-use and
 * therefore useless here, so admission is recorded per date in
 * `pass_redemptions (purchase_id, event_id)` — the unique index on that pair
 * is the once-per-event gate, exactly like `redeemed_at IS NULL` is for a
 * normal ticket.
 *
 * Capacity v1: the pass has its own pot (`season_passes.capacity`) and claims
 * NO seats in the member events. Hard room limits would need a block
 * reservation per date; deliberately postponed.
 */

/**
 * What "Gilt für N Termine" means on every sale surface: dates that are still
 * ahead and not cancelled — the dates a buyer paying today can actually still
 * attend.
 *
 * The four sale surfaces (`/events`, `/shop/[id]`, `/@handle`, `/pass/[id]`)
 * each used to count this themselves and disagreed: three counted every row
 * in `season_pass_events` including cancelled and long-past dates, the pass
 * page counted non-cancelled ones including past dates. So the same pass
 * could advertise three different numbers, all of them larger than what was
 * left to attend. This helper is the only place that decides it now.
 *
 * The pass detail page still LISTS the past dates (dimmed) — that is context,
 * not a promise. Owner-facing views (`/my-tickets`, `/tickets/[assetId]`)
 * deliberately keep counting the full series: there the question is "what did
 * I buy and what have I used", not "what am I getting".
 */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True when this date can still be attended. `events.date` is a text column. */
export function isSellableDate(date: string, cancelledAt: string | null): boolean {
  return !cancelledAt && date >= todayIso();
}

/** Sellable date count per pass; passes with none are absent from the map. */
export async function countSellablePassDates(passIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (passIds.length === 0) return counts;

  const { data } = await supabaseAdmin
    .from("season_pass_events")
    .select("pass_id, events(date, cancelled_at)")
    .in("pass_id", passIds);

  type Row = { pass_id: string; events: { date: string; cancelled_at: string | null } | { date: string; cancelled_at: string | null }[] | null };
  for (const row of (data ?? []) as Row[]) {
    const ev = Array.isArray(row.events) ? row.events[0] : row.events;
    if (!ev || !isSellableDate(ev.date, ev.cancelled_at)) continue;
    counts.set(row.pass_id, (counts.get(row.pass_id) ?? 0) + 1);
  }
  return counts;
}

/** A pass ticket that was scanned, resolved far enough to decide admission. */
export interface PassTicket {
  purchaseId: string;
  passId: string;
  passName: string;
  buyerWallet: string;
  revokedAt: string | null;
}

/** Loads the pass ticket behind an asset ID, or null if it isn't one. */
export async function loadPassTicket(assetId: string): Promise<PassTicket | null> {
  const { data } = await supabaseAdmin
    .from("purchases")
    .select("id, season_pass_id, buyer_wallet, revoked_at, season_passes(name)")
    .eq("asset_id", assetId)
    .not("season_pass_id", "is", null)
    .maybeSingle();
  if (!data?.season_pass_id) return null;

  const pass = Array.isArray(data.season_passes) ? data.season_passes[0] : data.season_passes;
  return {
    purchaseId: data.id as string,
    passId: data.season_pass_id as string,
    passName: (pass?.name as string | undefined) ?? "Saisonpass",
    buyerWallet: data.buyer_wallet as string,
    revokedAt: (data.revoked_at as string | null) ?? null,
  };
}

/** True when the pass admits to this event. */
export async function passCoversEvent(passId: string, eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("season_pass_events")
    .select("event_id")
    .eq("pass_id", passId)
    .eq("event_id", eventId)
    .maybeSingle();
  return Boolean(data);
}

export type PassRedemptionResult =
  | { ok: true; redeemedAt: string }
  | { ok: false; redeemedAt: string | null };

/**
 * Admits a pass ticket to one event, exactly once. The unique index on
 * (purchase_id, event_id) is the race-free gate: a second scan hits 23505 and
 * comes back as an already-redeemed result carrying the first admission time.
 */
export async function redeemPassForEvent(
  purchaseId: string,
  eventId: string,
  at: string = new Date().toISOString(),
): Promise<PassRedemptionResult> {
  const { error } = await supabaseAdmin
    .from("pass_redemptions")
    .insert({ purchase_id: purchaseId, event_id: eventId, redeemed_at: at });

  if (!error) return { ok: true, redeemedAt: at };
  if (error.code !== "23505") throw new Error(error.message);

  const { data: existing } = await supabaseAdmin
    .from("pass_redemptions")
    .select("redeemed_at")
    .eq("purchase_id", purchaseId)
    .eq("event_id", eventId)
    .maybeSingle();
  return { ok: false, redeemedAt: (existing?.redeemed_at as string | null) ?? null };
}

/** Event IDs a pass admits to, ordered by event date. */
export async function passEventIds(passId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("season_pass_events")
    .select("event_id, events(date)")
    .eq("pass_id", passId);

  return ((data ?? []) as { event_id: string; events: { date: string } | { date: string }[] | null }[])
    .map((row) => {
      const ev = Array.isArray(row.events) ? row.events[0] : row.events;
      return { id: row.event_id, date: (ev?.date as string | undefined) ?? "" };
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => row.id);
}

/** Dates (YYYY-MM-DD) of a pass's events, ascending. */
export async function passEventDates(passId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("season_pass_events")
    .select("events(date)")
    .eq("pass_id", passId);

  return ((data ?? []) as { events: { date: string } | { date: string }[] | null }[])
    .map((row) => {
      const ev = Array.isArray(row.events) ? row.events[0] : row.events;
      return (ev?.date as string | undefined) ?? "";
    })
    .filter(Boolean)
    .sort();
}

/** Pass tickets valid for one event, with this event's admission state. */
export interface EventPassTicket {
  purchaseId: string;
  assetId: string;
  buyerWallet: string;
  redeemedHere: boolean;
  revoked: boolean;
}

/**
 * Every pass ticket that admits to `eventId`, flagged with whether it has
 * already been used *for this date*. The doorman snapshot folds these into its
 * normal ticket list, so the offline verifier needs no pass logic at all.
 */
export async function passTicketsForEvent(eventId: string): Promise<EventPassTicket[]> {
  const { data: links } = await supabaseAdmin
    .from("season_pass_events")
    .select("pass_id")
    .eq("event_id", eventId);

  const passIds = ((links ?? []) as { pass_id: string }[]).map((l) => l.pass_id);
  if (passIds.length === 0) return [];

  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("id, asset_id, buyer_wallet, revoked_at")
    .in("season_pass_id", passIds)
    .limit(10000);

  const rows = (purchases ?? []) as {
    id: string; asset_id: string; buyer_wallet: string; revoked_at: string | null;
  }[];
  if (rows.length === 0) return [];

  const { data: redemptions } = await supabaseAdmin
    .from("pass_redemptions")
    .select("purchase_id")
    .eq("event_id", eventId)
    .in("purchase_id", rows.map((r) => r.id));

  const used = new Set(((redemptions ?? []) as { purchase_id: string }[]).map((r) => r.purchase_id));

  return rows.map((r) => ({
    purchaseId: r.id,
    assetId: r.asset_id,
    buyerWallet: r.buyer_wallet,
    redeemedHere: used.has(r.id),
    revoked: Boolean(r.revoked_at),
  }));
}
