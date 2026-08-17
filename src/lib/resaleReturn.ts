import { supabaseAdmin } from "@/lib/supabase";
import { heliusRpcUrl } from "@/lib/solana";
import { returnBreakdown, type ReturnBreakdown } from "@/lib/fees";

/**
 * „Rückgabe & Neuverkauf" — der Weiterverkauf ohne Merchant-of-Record-Rolle.
 *
 * Der Verkäufer gibt sein Ticket zurück (es wird widerrufen, der Platz wird
 * frei), der Veranstalter verkauft den Platz ganz normal neu, und der
 * Verkäufer wird auf **seine ursprüngliche Zahlungsmethode** erstattet, abzüglich
 * der Rückgabegebühr.
 *
 * Warum diese Form: eine Erstattung ist juristisch keine Auszahlung an einen
 * Dritten, sondern die Umkehrung einer Zahlung desselben Menschen. Die Karte ist
 * bereits von seiner Bank identifiziert — also kein KYC (GwG), kein
 * gespeicherter Wert (ZAG) und keine Chargeback-Haftung für eine
 * C2C-Transaktion. Der Vorgänger (`archive/resale-v1/`) hatte alle drei Probleme.
 *
 * Zwei Dinge folgen daraus und sind keine Nachlässigkeit:
 *
 * - **Kein Aufpreis.** Stripe erstattet nie mehr als den ursprünglichen Charge,
 *   also gibt es Weiterverkauf nur zum Originalpreis.
 * - **Kein Ticket-Transfer.** Der Käufer bekommt ein frisch gemintetes Ticket,
 *   das alte wird widerrufen. Das kostet unter einem Cent und ist aus zwei
 *   Gründen besser als das escrowte cNFT weiterzureichen: Bubblegums `transfer`
 *   löscht die Operator-Delegation (ein übertragenes Ticket liesse sich nie
 *   wieder zurückgeben), und ein Widerruf macht eine bereits gedruckte
 *   Backup-PDF absolut ungültig statt nur über die Wallet-Prüfung.
 */

/**
 * Wie lange nach dem Kauf eine Rückgabe noch möglich ist.
 *
 * Erstattungen auf die Originalkarte werden nach etwa einem halben Jahr
 * unzuverlässig. Lieber hier ablehnen als später an der Erstattung scheitern —
 * sonst stünde ein widerrufenes Ticket ohne Geld dagegen.
 */
export const RETURN_WINDOW_DAYS = 150;

export interface OfferEligibility {
  purchaseId: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  tierId: string | null;
  originSessionId: string;
  originChargeId: string | null;
  originPaymentIntentId: string | null;
  currency: string;
  /** Ob für dieses Ticket je eine Offline-PDF erzeugt wurde. */
  backupIssued: boolean;
  breakdown: ReturnBreakdown;
}

export type OfferEligibilityResult =
  | { ok: true; data: OfferEligibility }
  | { ok: false; status: number; error: string };

interface DasAsset {
  result?: { ownership?: { owner?: string } };
}

/** Aktueller On-Chain-Besitzer eines cNFT, oder null wenn nicht ermittelbar. */
export async function getAssetOwner(assetId: string): Promise<string | null> {
  const res = await fetch(heliusRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "asset-owner",
      method: "getAsset",
      params: { id: assetId },
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as DasAsset;
  return json.result?.ownership?.owner ?? null;
}

/** Kalenderdatum des Events liegt nach heute (Rückgabe am Eventtag ist zu spät). */
function eventIsFuture(eventDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsed = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() > today.getTime();
}

/**
 * Wie viele Tickets die ursprüngliche Bestellung umfasste.
 *
 * Aus `mint_jobs`, nicht durch Zählen von `purchases`: eine Kaufzeile kann
 * widerrufen werden oder (beim Gast-Claim) auf ein neu gemintetes Ticket
 * umgebogen werden. Der Job hält die bestellte Menge unveränderlich fest, und
 * genau die ist der richtige Teiler für den Preis pro Ticket.
 */
async function orderQuantity(sessionId: string): Promise<number> {
  const { data: job } = await supabaseAdmin
    .from("mint_jobs")
    .select("quantity")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (job?.quantity) return Math.max(1, job.quantity as number);

  const { count } = await supabaseAdmin
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("stripe_session_id", sessionId);
  return Math.max(1, count ?? 1);
}

/**
 * Was der Verkäufer für **ein** Ticket dieser Session gezahlt hat.
 *
 * Autorität ist die `payouts`-Zeile, wie beim Beleg: `gross_cents` ist was der
 * Käufer schuldete, und der Ticketpreis ergibt sich als
 * `gross − coalesce(buyer_fee_cents, fee_cents)`. Niemals aus `net_cents` — das
 * ist der Ertrag des Veranstalters und weicht ab, sobald er einen Teil der
 * Gebühr selbst trägt.
 *
 * Ohne payouts-Zeile gibt es nichts zu erstatten: Freitickets und
 * Abendkassen-Verkäufe sind nie durch Passlys Kasse gelaufen.
 */
async function paidCentsPerTicket(
  sessionId: string,
): Promise<{ cents: number; currency: string; chargeId: string | null; paymentIntentId: string | null } | null> {
  const { data: payout } = await supabaseAdmin
    .from("payouts")
    .select("gross_cents, fee_cents, buyer_fee_cents, currency, charge_id, payment_intent_id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (!payout) return null;

  const gross = (payout.gross_cents as number) ?? 0;
  const buyerFee = (payout.buyer_fee_cents as number | null) ?? (payout.fee_cents as number) ?? 0;
  const ticketTotal = Math.max(0, gross - buyerFee);

  const quantity = await orderQuantity(sessionId);

  return {
    cents: Math.floor(ticketTotal / quantity),
    currency: (payout.currency as string | null) ?? "eur",
    chargeId: (payout.charge_id as string | null) ?? null,
    paymentIntentId: (payout.payment_intent_id as string | null) ?? null,
  };
}

/**
 * Darf `sellerWallet` das Ticket `assetId` zurückgeben, und was bekäme es dafür?
 *
 * Anders als beim alten Weiterverkauf wird **keine** Operator-Delegation
 * verlangt: es wird nichts übertragen. Damit lässt sich auch ein Ticket
 * zurückgeben, das einmal aus der Escrow kam (Gast-Checkout, Teilen-Link) und
 * dessen Delegation Bubblegum beim Transfer gelöscht hat.
 */
export async function checkOfferEligibility(
  assetId: string,
  sellerWallet: string,
): Promise<OfferEligibilityResult> {
  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("id, event_id, season_pass_id, tier_id, buyer_wallet, redeemed_at, revoked_at, stripe_session_id, source, backup_issued_at, created_at")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (!purchase) return { ok: false, status: 404, error: "Ticket nicht gefunden." };
  if (purchase.buyer_wallet !== sellerWallet) {
    return { ok: false, status: 403, error: "Dieses Ticket gehört nicht zu deinem Konto." };
  }
  if (purchase.redeemed_at) {
    return { ok: false, status: 409, error: "Dieses Ticket wurde bereits eingelöst." };
  }
  if (purchase.revoked_at) {
    return { ok: false, status: 409, error: "Dieses Ticket ist nicht mehr gültig." };
  }
  if (purchase.season_pass_id) {
    return { ok: false, status: 403, error: "Saisonpässe können nicht zurückgegeben werden." };
  }

  // Der Besitz muss auch on-chain noch stimmen. Wer sein cNFT selbst
  // weitergegeben hat, soll es nicht zusätzlich zu Geld machen können.
  const onChainOwner = await getAssetOwner(assetId);
  if (onChainOwner && onChainOwner !== sellerWallet) {
    return { ok: false, status: 403, error: "Dieses Ticket liegt nicht mehr in deinem Konto." };
  }

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, name, date, cancelled_at, resale_enabled")
    .eq("id", purchase.event_id)
    .maybeSingle();

  if (!event) return { ok: false, status: 404, error: "Event nicht gefunden." };
  if (event.cancelled_at) {
    return { ok: false, status: 410, error: "Das Event wurde abgesagt." };
  }
  if (event.resale_enabled !== true) {
    return { ok: false, status: 403, error: "Für dieses Event ist die Rückgabe nicht freigeschaltet." };
  }
  // Am Eventtag selbst nicht mehr: der Aufräumlauf, der unverkaufte Angebote
  // zurückgibt, läuft nachts. Ein Angebot vom Eventtag käme zu spät zurück und
  // der Verkäufer stünde ohne gültiges Ticket vor der Tür.
  if (!eventIsFuture(event.date as string)) {
    return { ok: false, status: 410, error: "So kurz vor dem Event ist keine Rückgabe mehr möglich." };
  }

  if (!purchase.stripe_session_id) {
    return { ok: false, status: 403, error: "Für dieses Ticket liegt keine erstattbare Zahlung vor." };
  }
  const boughtAt = Date.parse(purchase.created_at as string);
  if (Number.isFinite(boughtAt)) {
    const ageDays = (Date.now() - boughtAt) / 86_400_000;
    if (ageDays > RETURN_WINDOW_DAYS) {
      return { ok: false, status: 410, error: "Der Kauf liegt zu lange zurück für eine Erstattung." };
    }
  }

  const paid = await paidCentsPerTicket(purchase.stripe_session_id as string);
  if (!paid || paid.cents <= 0) {
    return { ok: false, status: 403, error: "Für dieses Ticket liegt keine erstattbare Zahlung vor." };
  }
  if (!paid.chargeId && !paid.paymentIntentId) {
    return { ok: false, status: 403, error: "Die ursprüngliche Zahlung lässt sich nicht zuordnen." };
  }

  return {
    ok: true,
    data: {
      purchaseId: purchase.id as string,
      eventId: event.id as string,
      eventName: event.name as string,
      eventDate: event.date as string,
      tierId: (purchase.tier_id as string | null) ?? null,
      originSessionId: purchase.stripe_session_id as string,
      originChargeId: paid.chargeId,
      originPaymentIntentId: paid.paymentIntentId,
      currency: paid.currency,
      backupIssued: purchase.backup_issued_at != null,
      breakdown: returnBreakdown(paid.cents),
    },
  };
}

export interface ResaleOfferRow {
  id: string;
  purchase_id: string;
  asset_id: string;
  event_id: string;
  tier_id: string | null;
  seller_wallet: string;
  origin_session_id: string;
  origin_charge_id: string | null;
  origin_payment_intent_id: string | null;
  paid_cents: number;
  return_fee_cents: number;
  refund_cents: number;
  currency: string;
  status: "active" | "sold" | "withdrawn" | "expired";
  refund_id: string | null;
}

/**
 * Zahlt einem Verkäufer sein Geld aus, dessen Angebot verkauft wurde.
 *
 * Zwingend NACH der Zuteilung: erst muss ein neues Ticket beim Käufer sein,
 * dann fliesst Geld zurück. Andersherum wäre der Verkäufer bezahlt, während
 * der Käufer nichts hat.
 *
 * `refund_id` ist das Einmal-Gate (wie `mint_jobs.refund_id`), zusätzlich
 * abgesichert durch einen Idempotenzschlüssel aus der Angebots-ID. Schlägt es
 * fehl, bleibt das Angebot `sold` ohne `refund_id` und der Payout-Cron holt es
 * nach — deshalb ist ein Fehler hier kein Grund, den Kauf scheitern zu lassen.
 */
export async function settleReturnRefund(offer: ResaleOfferRow): Promise<string | null> {
  if (offer.refund_id) return offer.refund_id;
  if (offer.refund_cents <= 0) return null;
  if (!offer.origin_charge_id && !offer.origin_payment_intent_id) return null;

  // Einmal beanspruchen, bevor Stripe gerufen wird.
  const { data: claimed } = await supabaseAdmin
    .from("resale_offers")
    .update({ refund_id: "pending", updated_at: new Date().toISOString() })
    .eq("id", offer.id)
    .is("refund_id", null)
    .select("id");
  if (!claimed || claimed.length === 0) return null;

  const { stripe } = await import("@/lib/stripe");
  try {
    const refund = await stripe.refunds.create(
      {
        ...(offer.origin_payment_intent_id
          ? { payment_intent: offer.origin_payment_intent_id }
          : { charge: offer.origin_charge_id as string }),
        amount: offer.refund_cents,
        metadata: { resale_offer_id: offer.id, cause: "resale_return" },
      },
      { idempotencyKey: `resale-return-${offer.id}` },
    );
    await supabaseAdmin
      .from("resale_offers")
      .update({ refund_id: refund.id, refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", offer.id);

    await unbookOrganizerShare(offer);
    return refund.id;
  } catch (err) {
    // Anspruch zurückgeben, damit der Cron es erneut versuchen kann.
    await supabaseAdmin
      .from("resale_offers")
      .update({ refund_id: null, updated_at: new Date().toISOString() })
      .eq("id", offer.id);
    throw err;
  }
}

/**
 * Nimmt dem Veranstalter den Anteil des zurückgegebenen Tickets wieder ab.
 *
 * **Ohne diesen Schritt wird der Platz zweimal bezahlt.** Der neue Käufer läuft
 * durch die ganz normale Kaufstrecke und erzeugt eine ganz normale
 * `payouts`-Zeile — der Veranstalter bekäme also ein zweites Mal Geld für einen
 * Platz, den er einmal verkauft hat, und Passly müsste die Erstattung des
 * Verkäufers aus eigener Tasche zahlen.
 *
 * Möglich ist das, weil `computeAvailableAt` die Auszahlung am **Eventdatum**
 * verankert und eine Rückgabe nur vor dem Eventtag erlaubt ist: die
 * ursprüngliche Auszahlung steht damit immer noch auf `pending` und ist noch
 * nicht überwiesen.
 *
 * Gerechnet wird so, dass die Invariante `net = gross − fee` erhalten bleibt:
 * - `gross` sinkt um den erstatteten Betrag (so viel hat der Käufer effektiv
 *   nicht mehr bezahlt),
 * - `net` sinkt um genau den Netto-Anteil dieses einen Tickets,
 * - `fee` ist die Differenz — also die ursprüngliche Servicegebühr plus die
 *   Rückgabegebühr, was Passly tatsächlich behält.
 *
 * Beispiel (25 € Ticket, Gast trägt die Gebühr): aus gross 2700 / fee 200 /
 * net 2500 wird gross 450 / fee 450 / net 0.
 */
async function unbookOrganizerShare(offer: ResaleOfferRow): Promise<void> {
  const { data: payout } = await supabaseAdmin
    .from("payouts")
    .select("id, status, gross_cents, fee_cents, buyer_fee_cents, net_cents, stripe_session_id")
    .eq("stripe_session_id", offer.origin_session_id)
    .maybeSingle();
  if (!payout) return;

  // Sollte durch die Eventtag-Regel unerreichbar sein. Falls doch: das Geld ist
  // beim Veranstalter, und ein Mensch muss es zurückholen.
  if (payout.status === "paid") {
    const { sendAdminAlert } = await import("@/lib/email");
    void sendAdminAlert({
      subject: `Rückgabe nach Auszahlung; Angebot ${offer.id}`,
      text: `Ticket ${offer.asset_id} wurde zurückgegeben und der Käufer erstattet, `
        + `aber die ursprüngliche Auszahlung an den Veranstalter ist bereits gelaufen `
        + `(Payout ${payout.id}, Session ${offer.origin_session_id}).
`
        + `Der Platz wurde neu verkauft, der Veranstalter wurde also zweimal bezahlt. `
        + `${offer.refund_cents} Cent manuell zurückholen.`,
    }).catch((err) => console.error("Admin alert failed:", err));
    return;
  }

  const quantity = await orderQuantity(offer.origin_session_id);

  const netPerTicket = Math.round((payout.net_cents as number) / quantity);
  const newGross = Math.max(0, (payout.gross_cents as number) - offer.refund_cents);
  const newNet = Math.max(0, (payout.net_cents as number) - netPerTicket);
  const newFee = Math.max(0, newGross - newNet);

  // Der Käuferanteil der Gebühr schrumpft mit, sonst leitet der Beleg einen
  // falschen Ticketpreis aus `gross − buyer_fee_cents` ab.
  const buyerFee = payout.buyer_fee_cents as number | null;
  const newBuyerFee = buyerFee == null
    ? null
    : Math.min(newFee, Math.max(0, buyerFee - Math.round(buyerFee / quantity)));

  const { error } = await supabaseAdmin
    .from("payouts")
    .update({
      gross_cents: newGross,
      fee_cents: newFee,
      buyer_fee_cents: newBuyerFee,
      net_cents: newNet,
      ...(newNet === 0 ? { status: "refunded" } : {}),
      failure_reason: `Ticket zurückgegeben und neu verkauft (Angebot ${offer.id})`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payout.id);
  if (error) {
    console.error(`Payout adjust after return failed for offer ${offer.id}:`, error.message);
  }
}

/**
 * Gibt ein Angebot an den Verkäufer zurück: Ticket wieder gültig, Platz wieder
 * belegt. Gemeinsame Endstrecke von Rückzug (`withdrawn`) und Ablauf
 * (`expired`) — beide Male hat der Verkäufer sein Ticket behalten und kein Geld
 * bekommen.
 *
 * **Der Statuswechsel ist der Anspruch** und steht deshalb zuerst: er ist ein
 * bedingtes Update auf `status = 'active'`. Ohne das würden zwei gleichzeitige
 * Rückzüge (oder ein Rückzug und der Aufräumlauf) den Platz doppelt zurückbuchen
 * und die Kapazität des Events still verfälschen. Gibt `false` zurück, wenn ein
 * anderer Vorgang schneller war.
 */
export async function releaseOfferBackToSeller(
  offer: Pick<ResaleOfferRow, "id" | "purchase_id" | "event_id" | "tier_id">,
  status: "withdrawn" | "expired",
): Promise<boolean> {
  const now = new Date().toISOString();

  const { data: claimed } = await supabaseAdmin
    .from("resale_offers")
    .update({ status, closed_at: now, updated_at: now })
    .eq("id", offer.id)
    .eq("status", "active")
    .select("id");
  if (!claimed || claimed.length === 0) return false;

  await supabaseAdmin
    .from("purchases")
    .update({ revoked_at: null })
    .eq("id", offer.purchase_id);
  await supabaseAdmin.rpc("reclaim_sold_seat", {
    p_event_id: offer.event_id,
    p_quantity: 1,
    p_tier_id: offer.tier_id,
  });
  return true;
}

/**
 * Aufräumen im Payout-Cron, zwei Dinge:
 *
 * 1. Angebote, die bis zum Eventtag niemand gekauft hat, gehen zurück an den
 *    Verkäufer. Niemand darf sein Ticket dadurch verlieren, dass es sich nicht
 *    verkauft hat — das ist der wichtigste Teil hier.
 * 2. Verkaufte Angebote, deren Erstattung hängengeblieben ist, werden erneut
 *    versucht.
 */
export async function sweepResaleOffers(): Promise<{ expired: number; refunded: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: due } = await supabaseAdmin
    .from("resale_offers")
    .select("id, purchase_id, event_id, tier_id, events!inner(date)")
    .eq("status", "active")
    .lte("events.date", today);

  let expired = 0;
  for (const row of (due ?? []) as unknown as ResaleOfferRow[]) {
    try {
      if (await releaseOfferBackToSeller(row, "expired")) expired++;
    } catch (err) {
      console.error(`Resale offer ${row.id} expiry failed:`, err);
    }
  }

  const { data: unpaid } = await supabaseAdmin
    .from("resale_offers")
    .select("*")
    .eq("status", "sold")
    .is("refund_id", null)
    .limit(50);

  let refunded = 0;
  for (const row of (unpaid ?? []) as ResaleOfferRow[]) {
    try {
      if (await settleReturnRefund(row)) refunded++;
    } catch (err) {
      console.error(`Resale refund retry failed for offer ${row.id}:`, err);
    }
  }

  return { expired, refunded };
}
