import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import type { TicketTier } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/sessionUser";
import {
  uploadEventMetadata,
  isOwnStorageUrl,
  validateGalleryUrls,
  MAX_LONG_DESCRIPTION,
} from "@/lib/eventMetadata";
import { sendAdminAlert } from "@/lib/email";
import { MAX_REENTRY_COOLDOWN_SECONDS } from "@/lib/reentry";
import { isFeePayer, minUnitPriceCentsFor, tooCheapForFeePayer, type FeePayer } from "@/lib/fees";
import { bookCancellationFee } from "@/lib/platformFees";
import { FREE_TICKET_CAP_FREE_PLAN, freeCapacityExceeded, freeCapacityOf } from "@/lib/freeTickets";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // cancel refunds many charges sequentially

interface TierEdit {
  /** Existing tier when set; a new tier otherwise. Omitted tiers are deleted (only allowed while unsold). */
  id?: string;
  name: string;
  price_eur: number;
  capacity: number;
}

interface UpdateEventBody {
  eventId: string;
  organizer_wallet: string;
  action: "update" | "cancel";
  fields?: {
    name?: string;
    date?: string;
    start_time?: string | null;
    venue?: string | null;
    description?: string | null;
    /** Showcase-Langtext; `description` bleibt der kurze Teaser. */
    long_description?: string | null;
    /** Titelbild. Bis zur Showcase-Seite gab es dafuer keinen Bearbeitungsweg. */
    image_url?: string | null;
    /** Bildergalerie der Showcase-Seite; ersetzt die Liste vollstaendig. */
    gallery_urls?: string[];
    is_private?: boolean;
    payout_hold_days?: number;
    accent_hue?: number | null;
    border_style?: string | null;
    resale_enabled?: boolean;
    /** Who carries the service fee: 'buyer', 'split' or 'organizer'. */
    fee_payer?: string;
    guest_checkout_enabled?: boolean;
    queue_enabled?: boolean;
    queue_slots?: number;
    reentry_enabled?: boolean;
    reentry_cooldown_seconds?: number;
  };
  tiers?: TierEdit[];
}

const MAX_TIERS = 5;
const BORDER_STYLES = ["gold", "chrome", "aurora", "neon"] as const;

/**
 * Organizer event management: edit core fields and ticket tiers, or cancel
 * the event entirely.
 *
 * Cancellation refunds every not-yet-transferred charge in full; the
 * charge.refunded webhook then does the bookkeeping it already knows
 * (revoke tickets, free seats, mark payout refunded). Charges whose payout
 * was already transferred are reported back for manual handling instead of
 * refunded blindly; that money already left the platform.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: UpdateEventBody;
  try {
    body = (await req.json()) as UpdateEventBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId, organizer_wallet, action } = body;
  if (!eventId || !organizer_wallet || !action) {
    return NextResponse.json(
      { success: false, error: "eventId, organizer_wallet and action are required" },
      { status: 400 },
    );
  }

  if (!(await requestOwnsWallet(req, organizer_wallet))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (eventError || !event) {
    return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
  }
  if (event.organizer_wallet !== organizer_wallet) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (action === "cancel") {
    return cancelEvent(eventId, event as { cancelled_at: string | null; name: string; organizer_wallet: string });
  }

  if (event.cancelled_at) {
    return NextResponse.json(
      { success: false, error: "Ein abgesagtes Event kann nicht mehr bearbeitet werden." },
      { status: 409 },
    );
  }

  const fields = body.fields ?? {};
  const update: Record<string, unknown> = {};

  if (fields.name !== undefined) {
    const name = typeof fields.name === "string" ? fields.name.trim() : "";
    if (!name || name.length > 120) {
      return NextResponse.json({ success: false, error: "name must be 1–120 characters" }, { status: 400 });
    }
    update.name = name;
  }
  if (fields.date !== undefined) {
    if (typeof fields.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) {
      return NextResponse.json({ success: false, error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    update.date = fields.date;
  }
  if (fields.start_time !== undefined) {
    if (fields.start_time !== null && (typeof fields.start_time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.start_time))) {
      return NextResponse.json({ success: false, error: "start_time must be HH:MM (24h)" }, { status: 400 });
    }
    update.start_time = fields.start_time;
  }
  if (fields.venue !== undefined) {
    if (fields.venue !== null && (typeof fields.venue !== "string" || fields.venue.length > 200)) {
      return NextResponse.json({ success: false, error: "venue must be at most 200 characters" }, { status: 400 });
    }
    update.venue = typeof fields.venue === "string" ? fields.venue.trim() || null : null;
  }
  if (fields.description !== undefined) {
    if (fields.description !== null && (typeof fields.description !== "string" || fields.description.length > 2000)) {
      return NextResponse.json({ success: false, error: "description must be at most 2000 characters" }, { status: 400 });
    }
    update.description = typeof fields.description === "string" ? fields.description.trim() || null : null;
  }
  if (fields.long_description !== undefined) {
    if (fields.long_description !== null
        && (typeof fields.long_description !== "string" || fields.long_description.length > MAX_LONG_DESCRIPTION)) {
      return NextResponse.json({ success: false, error: `long_description must be at most ${MAX_LONG_DESCRIPTION} characters` }, { status: 400 });
    }
    update.long_description = typeof fields.long_description === "string" ? fields.long_description.trim() || null : null;
  }
  // Only URLs from our own upload endpoint end up on a Passly page or in
  // on-chain metadata — same gate as at creation.
  if (fields.image_url !== undefined) {
    if (fields.image_url !== null && (typeof fields.image_url !== "string" || !isOwnStorageUrl(fields.image_url))) {
      return NextResponse.json({ success: false, error: "image_url must come from /api/events/upload-image" }, { status: 400 });
    }
    update.image_url = fields.image_url;
  }
  if (fields.gallery_urls !== undefined) {
    const checked = validateGalleryUrls(fields.gallery_urls);
    if ("error" in checked) {
      return NextResponse.json({ success: false, error: checked.error }, { status: 400 });
    }
    update.gallery_urls = checked;
  }
  if (fields.is_private !== undefined) {
    update.is_private = fields.is_private === true;
  }
  if (fields.payout_hold_days !== undefined) {
    if (!Number.isInteger(fields.payout_hold_days) || fields.payout_hold_days < 0 || fields.payout_hold_days > 90) {
      return NextResponse.json({ success: false, error: "payout_hold_days must be 0–90" }, { status: 400 });
    }
    update.payout_hold_days = fields.payout_hold_days;
  }
  if (fields.resale_enabled !== undefined) {
    update.resale_enabled = fields.resale_enabled === true;
  }
  if (fields.fee_payer !== undefined) {
    if (!isFeePayer(fields.fee_payer)) {
      return NextResponse.json(
        { success: false, error: "fee_payer must be one of: buyer, split, organizer" },
        { status: 400 },
      );
    }
    update.fee_payer = fields.fee_payer;
  }
  if (fields.guest_checkout_enabled !== undefined) {
    update.guest_checkout_enabled = fields.guest_checkout_enabled === true;
  }
  if (fields.queue_enabled !== undefined) {
    update.queue_enabled = fields.queue_enabled === true;
  }
  if (fields.queue_slots !== undefined) {
    if (!Number.isInteger(fields.queue_slots) || fields.queue_slots < 1 || fields.queue_slots > 1000) {
      return NextResponse.json({ success: false, error: "queue_slots must be 1–1000" }, { status: 400 });
    }
    update.queue_slots = fields.queue_slots;
  }
  if (fields.reentry_enabled !== undefined) {
    update.reentry_enabled = fields.reentry_enabled === true;
  }
  if (fields.reentry_cooldown_seconds !== undefined) {
    if (!Number.isInteger(fields.reentry_cooldown_seconds)
        || fields.reentry_cooldown_seconds < 0
        || fields.reentry_cooldown_seconds > MAX_REENTRY_COOLDOWN_SECONDS) {
      return NextResponse.json(
        { success: false, error: `reentry_cooldown_seconds must be 0–${MAX_REENTRY_COOLDOWN_SECONDS}` },
        { status: 400 },
      );
    }
    update.reentry_cooldown_seconds = fields.reentry_cooldown_seconds;
  }
  if (fields.accent_hue !== undefined) {
    if (fields.accent_hue !== null && (!Number.isInteger(fields.accent_hue) || fields.accent_hue < 0 || fields.accent_hue > 360)) {
      return NextResponse.json({ success: false, error: "accent_hue must be an integer between 0 and 360" }, { status: 400 });
    }
    update.accent_hue = fields.accent_hue;
  }
  if (fields.border_style !== undefined) {
    if (fields.border_style !== null && !BORDER_STYLES.includes(fields.border_style as typeof BORDER_STYLES[number])) {
      return NextResponse.json({ success: false, error: `border_style must be one of: ${BORDER_STYLES.join(", ")}` }, { status: 400 });
    }
    if (fields.border_style) {
      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("plan")
        .eq("wallet_address", organizer_wallet)
        .maybeSingle();
      if (organizer?.plan !== "pro") {
        return NextResponse.json({ success: false, error: "pro_required" }, { status: 403 });
      }
    }
    update.border_style = fields.border_style;
  }

  // ── Tier edits ─────────────────────────────────────────────────────────
  const { data: existingTiersRaw } = await supabaseAdmin
    .from("ticket_tiers")
    .select("*")
    .eq("event_id", eventId)
    .order("sort")
    .order("created_at");
  const existingTiers = (existingTiersRaw ?? []) as TicketTier[];

  // Fee payer vs. tier prices, checked against the EFFECTIVE state rather than
  // the payload: the two arrive independently, so someone could switch to an
  // absorbed fee today and cut a tier below its own fee tomorrow, with each
  // request looking harmless on its own.
  const effectiveFeePayer: FeePayer = isFeePayer(update.fee_payer)
    ? update.fee_payer
    : (isFeePayer(event.fee_payer) ? event.fee_payer : "buyer");
  const effectivePrices = body.tiers !== undefined && Array.isArray(body.tiers)
    ? body.tiers.map((t) => t?.price_eur).filter((p): p is number => typeof p === "number")
    : existingTiers.map((t) => t.price_eur);
  const tooCheap = tooCheapForFeePayer(effectivePrices, effectiveFeePayer);
  if (tooCheap !== null) {
    return NextResponse.json(
      {
        success: false,
        error: `fee_payer '${effectiveFeePayer}' requires every paid tier to cost at least `
          + `${minUnitPriceCentsFor(effectiveFeePayer)} cents (found ${tooCheap})`,
      },
      { status: 400 },
    );
  }

  // Free-ticket ceiling, on the EFFECTIVE tiers for the same reason as above:
  // prices and capacities arrive independently of each other. Only looked up
  // when the event could possibly be over the lowest ceiling, so the ordinary
  // edit still costs no extra query.
  const effectiveTiers = body.tiers !== undefined && Array.isArray(body.tiers)
    ? body.tiers
      .filter((t) => typeof t?.price_eur === "number" && typeof t?.capacity === "number")
      .map((t) => ({ price_eur: t.price_eur, capacity: t.capacity }))
    : existingTiers.map((t) => ({ price_eur: t.price_eur, capacity: t.capacity }));
  if (freeCapacityOf(effectiveTiers) > FREE_TICKET_CAP_FREE_PLAN) {
    const { data: planRow } = await supabaseAdmin
      .from("organizers")
      .select("plan")
      .eq("wallet_address", organizer_wallet)
      .maybeSingle();
    // Grandfathered against what the event already holds: an event that was
    // created before the ceiling existed stays editable while it does not grow.
    const freeOverflow = freeCapacityExceeded({
      tiers: effectiveTiers,
      plan: (planRow?.plan as string | null) ?? null,
      previousFreeCapacity: freeCapacityOf(existingTiers),
    });
    if (freeOverflow) {
      return NextResponse.json(
        {
          success: false,
          error: `free_ticket_cap: at most ${freeOverflow.cap} free tickets per event on this plan `
            + `(requested ${freeOverflow.requested})`,
        },
        { status: 403 },
      );
    }
  }

  if (body.tiers !== undefined) {
    const edits = body.tiers;
    if (!Array.isArray(edits) || edits.length === 0 || edits.length > MAX_TIERS) {
      return NextResponse.json(
        { success: false, error: `tiers must contain 1–${MAX_TIERS} entries` },
        { status: 400 },
      );
    }

    const byId = new Map(existingTiers.map((t) => [t.id, t]));
    const seenIds = new Set<string>();
    const names = new Set<string>();
    let totalCapacity = 0;

    for (const t of edits) {
      const name = typeof t.name === "string" ? t.name.trim() : "";
      if (!name || name.length > 80) {
        return NextResponse.json({ success: false, error: "each tier needs a name of 1–80 characters" }, { status: 400 });
      }
      if (names.has(name.toLowerCase())) {
        return NextResponse.json({ success: false, error: "tier names must be unique" }, { status: 400 });
      }
      names.add(name.toLowerCase());
      if (!Number.isInteger(t.price_eur) || t.price_eur < 0) {
        return NextResponse.json({ success: false, error: "tier price_eur must be a non-negative integer (cents)" }, { status: 400 });
      }
      if (!Number.isInteger(t.capacity) || t.capacity < 1) {
        return NextResponse.json({ success: false, error: "tier capacity must be a positive integer" }, { status: 400 });
      }
      totalCapacity += t.capacity;

      if (t.id) {
        const existing = byId.get(t.id);
        if (!existing) {
          return NextResponse.json({ success: false, error: `unknown tier ${t.id}` }, { status: 400 });
        }
        seenIds.add(t.id);
        const committed = existing.tickets_sold + existing.tickets_reserved;
        if (t.capacity < committed) {
          return NextResponse.json(
            { success: false, error: `Kapazität von „${name}" kann nicht unter ${committed} (verkauft + reserviert) sinken.` },
            { status: 400 },
          );
        }
      }
    }
    if (totalCapacity > 10000) {
      return NextResponse.json({ success: false, error: "total capacity must be at most 10000" }, { status: 400 });
    }

    // Deleting a tier that already sold tickets would orphan its purchases.
    for (const existing of existingTiers) {
      if (!seenIds.has(existing.id) && existing.tickets_sold + existing.tickets_reserved > 0) {
        return NextResponse.json(
          { success: false, error: `Kategorie „${existing.name}" hat bereits Verkäufe und kann nicht entfernt werden.` },
          { status: 400 },
        );
      }
    }

    // Apply: update / insert / delete, then recompute the event aggregate.
    for (let i = 0; i < edits.length; i++) {
      const t = edits[i];
      if (t.id) {
        const { error } = await supabaseAdmin
          .from("ticket_tiers")
          .update({ name: t.name.trim(), price_eur: t.price_eur, capacity: t.capacity, sort: i })
          .eq("id", t.id)
          .eq("event_id", eventId);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      } else {
        const { error } = await supabaseAdmin
          .from("ticket_tiers")
          .insert({ event_id: eventId, name: t.name.trim(), price_eur: t.price_eur, capacity: t.capacity, sort: i });
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }
    for (const existing of existingTiers) {
      if (!seenIds.has(existing.id)) {
        const { error } = await supabaseAdmin
          .from("ticket_tiers")
          .delete()
          .eq("id", existing.id)
          .eq("event_id", eventId)
          .eq("tickets_sold", 0)
          .eq("tickets_reserved", 0);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    update.capacity = totalCapacity;
    update.price_eur = Math.min(...edits.map((t) => t.price_eur));
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin.from("events").update(update).eq("id", eventId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Regenerate the static cNFT metadata when displayed fields changed;
  // upsert: true overwrites metadata/<eventId>.json in place, so already
  // minted tickets pick the change up too. Best effort, like at creation.
  if (update.name !== undefined || update.date !== undefined || update.venue !== undefined
      || update.description !== undefined || update.image_url !== undefined) {
    try {
      await uploadEventMetadata({
        eventId,
        name: (update.name as string | undefined) ?? (event.name as string),
        date: (update.date as string | undefined) ?? (event.date as string),
        imageUrl: (update.image_url as string | null | undefined) ?? ((event.image_url as string | null) ?? null),
        venue: (update.venue as string | null | undefined) ?? ((event.venue as string | null) ?? null),
        description: (update.description as string | null | undefined) ?? ((event.description as string | null) ?? null),
      });
    } catch (err) {
      console.error(`Metadata re-upload for event ${eventId} failed:`, err);
    }
  }

  return NextResponse.json({ success: true });
}

async function cancelEvent(
  eventId: string,
  event: { cancelled_at: string | null; name: string; organizer_wallet: string },
): Promise<NextResponse> {
  if (event.cancelled_at) {
    return NextResponse.json({ success: false, error: "Event ist bereits abgesagt." }, { status: 409 });
  }

  const now = new Date().toISOString();
  // Claim the cancellation exactly once; a double-submit must not run the
  // refund loop twice (the Stripe idempotency keys would catch it, but this
  // keeps the response deterministic too).
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("events")
    .update({ cancelled_at: now })
    .eq("id", eventId)
    .is("cancelled_at", null)
    .select("id");
  if (claimError) {
    return NextResponse.json({ success: false, error: claimError.message }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ success: false, error: "Event ist bereits abgesagt." }, { status: 409 });
  }

  // Expire open checkout sessions so nobody pays for a cancelled event; the
  // checkout.session.expired webhook frees the reservations.
  const { data: openReservations } = await supabaseAdmin
    .from("ticket_reservations")
    .select("stripe_session_id")
    .eq("event_id", eventId)
    .eq("status", "reserved");
  for (const r of openReservations ?? []) {
    try {
      await stripe.checkout.sessions.expire(r.stripe_session_id as string);
    } catch {
      // best effort; sessions die on their own after 30 minutes
    }
  }

  // Refund every not-yet-transferred charge in full. The charge.refunded
  // webhook revokes the tickets, frees the seats and marks the payout.
  const { data: payouts } = await supabaseAdmin
    .from("payouts")
    .select("id, status, payment_intent_id, charge_id, stripe_session_id, currency")
    .eq("event_id", eventId);

  // Ticket counts per session, for the `platform_fees_due` rows below. Fetched
  // once instead of per refund: the loop already makes one Stripe call per row
  // and shares a 300 s budget with them.
  const { data: jobs } = await supabaseAdmin
    .from("mint_jobs")
    .select("stripe_session_id, quantity")
    .eq("event_id", eventId);
  const quantityBySession = new Map(
    ((jobs ?? []) as { stripe_session_id: string; quantity: number | null }[])
      .map((j) => [j.stripe_session_id, j.quantity ?? 1]),
  );

  let refunded = 0;
  /** Stripe fees passed on to the organizer, and the ones we could not read. */
  let feesBookedCents = 0;
  const feeUnknown: string[] = [];
  const skipped: { session: string; reason: string }[] = [];
  const failed: { session: string; error: string }[] = [];

  for (const p of payouts ?? []) {
    if (p.status === "refunded") continue;
    if (p.status === "paid") {
      skipped.push({ session: p.stripe_session_id as string, reason: "Auszahlung bereits transferiert, manuell klären" });
      continue;
    }
    if (p.status === "disputed") {
      skipped.push({ session: p.stripe_session_id as string, reason: "Chargeback läuft, erst Dispute klären" });
      continue;
    }
    if (!p.payment_intent_id && !p.charge_id) {
      skipped.push({ session: p.stripe_session_id as string, reason: "Keine Zahlungsreferenz" });
      continue;
    }
    try {
      const refund = await stripe.refunds.create(
        {
          ...(p.payment_intent_id
            ? { payment_intent: p.payment_intent_id as string }
            : { charge: p.charge_id as string }),
          metadata: { event_id: eventId, cause: "event_cancelled" },
          // Stripe keeps its processing fee on a refund, so the original
          // charge's balance transaction is the exact amount Passly is out of
          // pocket. Expanded here rather than fetched afterwards: a second
          // round trip per refund would double the run time of a sold-out
          // event's cancellation.
          expand: ["charge.balance_transaction"],
        },
        { idempotencyKey: `cancel-refund-${p.id}` },
      );
      refunded++;

      const sessionId = p.stripe_session_id as string;
      const charge = typeof refund.charge === "object" && refund.charge !== null ? refund.charge : null;
      const balanceTransaction = charge && typeof charge.balance_transaction === "object"
        ? charge.balance_transaction
        : null;
      if (!balanceTransaction) {
        // Never guess a fee from a rate table: an invented amount deducted from
        // someone's payout is worse than an uncollected one.
        feeUnknown.push(sessionId);
      } else {
        const outcome = await bookCancellationFee({
          organizerWallet: event.organizer_wallet,
          eventId,
          sessionId,
          quantity: quantityBySession.get(sessionId) ?? 1,
          feeCents: balanceTransaction.fee,
          currency: balanceTransaction.currency ?? (p.currency as string) ?? "eur",
        });
        if (outcome === "booked") feesBookedCents += balanceTransaction.fee;
        if (outcome === "failed") feeUnknown.push(sessionId);
      }
    } catch (err) {
      failed.push({
        session: p.stripe_session_id as string,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Free tickets have no payout row; revoke their purchases directly and
  // stop queued mints.
  const paidSessions = new Set((payouts ?? []).map((p) => p.stripe_session_id as string));
  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("id, stripe_session_id")
    .eq("event_id", eventId)
    .is("revoked_at", null);
  const freePurchaseIds = (purchases ?? [])
    .filter((p) => !paidSessions.has(p.stripe_session_id as string))
    .map((p) => p.id as string);
  if (freePurchaseIds.length > 0) {
    await supabaseAdmin.from("purchases").update({ revoked_at: now }).in("id", freePurchaseIds);
  }
  await supabaseAdmin
    .from("mint_jobs")
    .update({ status: "failed", last_error: "Event cancelled", updated_at: now })
    .eq("event_id", eventId)
    .eq("status", "queued");

  // Anything the automatic refund loop could not settle needs a human.
  if (skipped.length > 0 || failed.length > 0 || feeUnknown.length > 0) {
    void sendAdminAlert({
      subject: `Event abgesagt; ${skipped.length + failed.length + feeUnknown.length} Vorgang/Vorgänge brauchen manuelle Klärung`,
      text: `Event „${event.name}" (${eventId}) wurde abgesagt; ${refunded} Zahlung(en) automatisch erstattet.\n`
        + `Von Stripe einbehaltene Gebühren, die dem Veranstalter belastet wurden: ${(feesBookedCents / 100).toFixed(2)} €.\n\n`
        + (skipped.length > 0
          ? `Übersprungen:\n${skipped.map((s) => `- ${s.session}: ${s.reason}`).join("\n")}\n\n`
          : "")
        + (failed.length > 0
          ? `Fehlgeschlagen:\n${failed.map((f) => `- ${f.session}: ${f.error}`).join("\n")}\n\n`
          : "")
        + (feeUnknown.length > 0
          ? `Stripe-Gebühr nicht auslesbar, nicht belastet (Passly trägt sie):\n`
            + `${feeUnknown.map((s) => `- ${s}`).join("\n")}`
          : ""),
    }).catch((err) => console.error("Admin alert failed:", err));
  }

  return NextResponse.json({ success: true, refunded, skipped, failed, feesBookedCents });
}
