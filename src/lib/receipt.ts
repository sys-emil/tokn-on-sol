import { LineCapStyle, PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { GEIST_REGULAR, GEIST_SEMIBOLD, GEIST_EXTRABOLD } from "@/lib/pdfFonts";
import { supabaseAdmin } from "@/lib/supabase";
import { passEventDates } from "@/lib/seasonPass";

/**
 * Purchase receipt ("Beleg") for a completed order.
 *
 * **This is deliberately not an invoice.** It carries no VAT rate, no
 * §14-UStG mandatory fields and no small-business notice, because Passly is
 * not the seller of the ticket: the organizer is, and only they know their own
 * tax situation. What the document does is state plainly who received which
 * part of the money — the organizer gets the face price, Passly the service
 * fee — which is what a buyer needs for an expense claim and what an organizer
 * needs to reconcile a payout. The wording says so on the page, so nobody
 * files it as something it isn't.
 *
 * Design follows src/lib/backupTicket.ts: Geist, light surface, violet accent,
 * the Passly wordmark redrawn as vectors.
 */

export interface ReceiptInput {
  receiptNo: string;
  /** ISO date the order was paid. */
  purchasedAt: string;
  buyerEmail: string | null;
  organizerName: string;
  /** Event or season-pass name. */
  productName: string;
  /** Date + venue, or the pass validity. */
  productSubline: string | null;
  tierName: string | null;
  quantity: number;
  /** Face price the organizer receives, per unit. */
  unitPriceCents: number;
  /** Buyer-side service fee, total over all units. */
  serviceFeeCents: number;
  /** Face price total, i.e. the organizer's share. */
  organizerNetCents: number;
  /** What the order came to in total (organizer share + service fee). */
  totalCents: number;
  currency: string;
  paymentMethod: string | null;
  /** Part of the total was settled with Passly credit (amount not recorded). */
  creditUsed: boolean;
  /** 'refunded' / partial-refund note, shown as a status banner. */
  refundNote: string | null;
}

/**
 * Assembles the receipt for one checkout session, or null when there is
 * nothing to receipt.
 *
 * `payouts` is the money authority: it holds what the buyer owed (gross),
 * what Passly kept (fee) and what the organizer gets (net), already adjusted
 * by any partial refund. Two cases legitimately have no row and therefore no
 * receipt: free tickets, and box-office sales — the cash never passed through
 * Passly, so a Passly receipt for it would be a false document.
 */
export async function loadReceiptInput(stripeSessionId: string): Promise<ReceiptInput | null> {
  const { data: payout } = await supabaseAdmin
    .from("payouts")
    .select("stripe_session_id, event_id, season_pass_id, organizer_wallet, gross_cents, fee_cents, net_cents, currency, status, payment_method, skip_source_transaction, failure_reason, created_at")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();
  if (!payout) return null;

  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("tier_id, created_at")
    .eq("stripe_session_id", stripeSessionId);
  const quantity = Math.max(1, purchases?.length ?? 1);
  const tierId = ((purchases ?? []) as { tier_id: string | null }[]).find((p) => p.tier_id)?.tier_id ?? null;

  const [{ data: organizer }, { data: job }, { data: tier }] = await Promise.all([
    supabaseAdmin
      .from("organizers")
      .select("name, business_name, type, public_name")
      .eq("wallet_address", payout.organizer_wallet)
      .maybeSingle(),
    supabaseAdmin
      .from("mint_jobs")
      .select("buyer_email")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle(),
    tierId
      ? supabaseAdmin.from("ticket_tiers").select("name").eq("id", tierId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let productName = "Ticket";
  let productSubline: string | null = null;
  if (payout.season_pass_id) {
    const [{ data: pass }, dates] = await Promise.all([
      supabaseAdmin.from("season_passes").select("name").eq("id", payout.season_pass_id).maybeSingle(),
      passEventDates(payout.season_pass_id as string),
    ]);
    productName = (pass?.name as string | undefined) ?? "Saisonpass";
    productSubline = `Saisonpass · ${dates.length} ${dates.length === 1 ? "Termin" : "Termine"}`;
  } else if (payout.event_id) {
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("name, date, venue")
      .eq("id", payout.event_id)
      .maybeSingle();
    productName = (event?.name as string | undefined) ?? "Ticket";
    productSubline = event
      ? [formatGermanDate(`${event.date as string}T12:00:00Z`), event.venue as string | null]
          .filter(Boolean).join(" · ")
      : null;
  }

  const organizerName = organizer
    ? (organizer.public_name as string | null)?.trim()
        || (organizer.type === "business" && organizer.business_name
              ? (organizer.business_name as string)
              : (organizer.name as string))
    : "Veranstalter";

  const netCents = payout.net_cents as number;
  const refundNote = payout.status === "refunded"
    ? "Diese Bestellung wurde vollständig erstattet."
    : typeof payout.failure_reason === "string" && payout.failure_reason.startsWith("Partially refunded")
      ? "Teilweise erstattet; die Beträge oben sind bereits angepasst."
      : null;

  return {
    receiptNo: receiptNumber(stripeSessionId, payout.created_at as string),
    purchasedAt: payout.created_at as string,
    buyerEmail: (job?.buyer_email as string | null) ?? null,
    organizerName,
    productName,
    productSubline,
    tierName: (tier?.name as string | undefined) ?? null,
    quantity,
    unitPriceCents: Math.round(netCents / quantity),
    serviceFeeCents: payout.fee_cents as number,
    organizerNetCents: netCents,
    totalCents: payout.gross_cents as number,
    currency: (payout.currency as string | null) ?? "eur",
    paymentMethod: (payout.payment_method as string | null) ?? null,
    creditUsed: payout.skip_source_transaction === true,
    refundNote,
  };
}

/** Stable, human-readable receipt number: PSL-YYYYMMDD-<last 6 of the session>. */
function receiptNumber(sessionId: string, createdAt: string): string {
  const t = Date.parse(createdAt);
  const day = Number.isNaN(t)
    ? "00000000"
    : new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
  return `PSL-${day}-${sessionId.slice(-6).toUpperCase()}`;
}

const A4: [number, number] = [595.28, 841.89];

const hex = (h: string): Color => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

// Same palette as the backup ticket (globals.css / passly-logo.svg)
const INK = hex("#13151F");
const MUTED = hex("#6E6D80");
const FAINT = hex("#9C9AAD");
const LINE = hex("#E8E6F0");
const ACCENT = hex("#5F38DD");
const ACCENT_DARK = hex("#5624D4");
const ACCENT_LIGHT = hex("#694CE6");
const ACCENT_WASH = hex("#F1EDFB");
const WARN_BG = hex("#FDF6EC");
const WARN_LINE = hex("#EBD3AE");
const WARN_INK = hex("#8A5A12");
const PAGE_BG = hex("#F7F6FB");
const WHITE = rgb(1, 1, 1);

const PAYMENT_LABELS: Record<string, string> = {
  card: "Karte",
  paypal: "PayPal",
  klarna: "Klarna",
  sepa_debit: "SEPA-Lastschrift",
  link: "Link",
  giropay: "giropay",
  sofort: "Sofortüberweisung",
};

function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}

function formatGermanDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function roundedRectPath(w: number, h: number, r: number): string {
  return `M ${r},0 H ${w - r} A ${r},${r} 0 0 1 ${w},${r} V ${h - r} A ${r},${r} 0 0 1 ${w - r},${h} H ${r} A ${r},${r} 0 0 1 0,${h - r} V ${r} A ${r},${r} 0 0 1 ${r},0 Z`;
}

/** Letter-spaced text (pdf-lib has no tracking option). */
function drawTracked(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: Color, tracking: number): void {
  let cx = x;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

function drawRight(page: PDFPage, text: string, xRight: number, y: number, font: PDFFont, size: number, color: Color): void {
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color });
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color: Color): void {
  page.drawText(text, { x: (A4[0] - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
}

// Frame strokes from public/passly-logo.svg (viewBox 330×92, stroke 7).
const LOGO_FRAME: { d: string; color: Color }[] = [
  { d: "M3.5,33.5 L3.5,17.5 A14,14 0 0 1 17.5,3.5 L33.5,3.5", color: ACCENT_DARK },
  { d: "M58.5,3.5 L74.5,3.5 A14,14 0 0 1 88.5,17.5 L88.5,33.5", color: ACCENT_LIGHT },
  { d: "M3.5,58.5 L3.5,74.5 A14,14 0 0 0 17.5,88.5 L33.5,88.5", color: ACCENT_DARK },
  { d: "M58.5,88.5 L74.5,88.5 A14,14 0 0 0 88.5,74.5 L88.5,58.5", color: ACCENT_LIGHT },
];

function drawLogo(page: PDFPage, x: number, yTop: number, height: number, extraBold: PDFFont): void {
  const s = height / 92;
  for (const path of LOGO_FRAME) {
    page.drawSvgPath(path.d, {
      x, y: yTop, scale: s,
      borderColor: path.color,
      borderWidth: 7 * s,
      borderLineCap: LineCapStyle.Round,
    });
  }
  const centerY = yTop - 47 * s;
  const pSize = 52 * s;
  const pWidth = extraBold.widthOfTextAtSize("P", pSize);
  page.drawText("P", { x: x + 46 * s - pWidth / 2, y: centerY - pSize * 0.355, size: pSize, font: extraBold, color: INK });
  const wordSize = 58 * s;
  page.drawText("passly", { x: x + 112 * s, y: centerY - wordSize * 0.355, size: wordSize, font: extraBold, color: INK });
}

export async function buildReceiptPdf(input: ReceiptInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(GEIST_REGULAR, { subset: true });
  const semibold = await doc.embedFont(GEIST_SEMIBOLD, { subset: true });
  const extrabold = await doc.embedFont(GEIST_EXTRABOLD, { subset: true });

  const page = doc.addPage(A4);
  const cardX = 68;
  const cardW = A4[0] - 2 * cardX;
  const cardTop = A4[1] - 78;
  const cardH = 660;
  const cardBottom = cardTop - cardH;
  const pad = 32;
  const left = cardX + pad;
  const right = cardX + cardW - pad;

  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: PAGE_BG });
  page.drawSvgPath(roundedRectPath(cardW, cardH, 18), {
    x: cardX, y: cardTop, color: WHITE, borderColor: LINE, borderWidth: 1.2,
  });

  // ── Head: logo + "BELEG" tag ───────────────────────────────────────
  drawLogo(page, left, cardTop - 30, 24, extrabold);
  const tagW = 58;
  const tagH = 19;
  page.drawSvgPath(roundedRectPath(tagW, tagH, 6), {
    x: right - tagW, y: cardTop - 33, color: ACCENT_WASH,
  });
  drawTracked(page, "BELEG", right - tagW + 13, cardTop - 33 - tagH + 6.5, semibold, 7.5, ACCENT, 1.2);

  page.drawLine({
    start: { x: left, y: cardTop - 78 }, end: { x: right, y: cardTop - 78 },
    thickness: 1, color: LINE,
  });

  // ── Order meta ─────────────────────────────────────────────────────
  let y = cardTop - 104;
  drawTracked(page, "BELEG-NR.", left, y, semibold, 7.5, FAINT, 1.4);
  drawTracked(page, "KAUFDATUM", left + 200, y, semibold, 7.5, FAINT, 1.4);
  y -= 16;
  page.drawText(input.receiptNo, { x: left, y, size: 11, font: semibold, color: INK });
  page.drawText(formatGermanDate(input.purchasedAt), { x: left + 200, y, size: 11, font: semibold, color: INK });

  if (input.buyerEmail) {
    y -= 26;
    drawTracked(page, "KÄUFER", left, y, semibold, 7.5, FAINT, 1.4);
    y -= 16;
    page.drawText(input.buyerEmail, { x: left, y, size: 11, font: regular, color: MUTED });
  }

  y -= 30;
  drawTracked(page, "VERANSTALTER", left, y, semibold, 7.5, FAINT, 1.4);
  y -= 16;
  page.drawText(input.organizerName, { x: left, y, size: 11, font: semibold, color: INK });
  y -= 14;
  page.drawText("Vertragspartner für die Veranstaltung", { x: left, y, size: 9, font: regular, color: FAINT });

  // ── Line items ─────────────────────────────────────────────────────
  y -= 34;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 18;
  drawTracked(page, "POSITION", left, y, semibold, 7.5, FAINT, 1.4);
  drawRight(page, "BETRAG", right, y, semibold, 7.5, FAINT);

  y -= 24;
  const itemLabel = input.tierName ? `${input.productName} · ${input.tierName}` : input.productName;
  page.drawText(`${input.quantity} × ${itemLabel}`, {
    x: left, y, size: 11.5, font: semibold, color: INK, maxWidth: cardW - 2 * pad - 90,
  });
  drawRight(page, money(input.organizerNetCents, input.currency), right, y, semibold, 11.5, INK);
  y -= 14;
  const unitLine = `à ${money(input.unitPriceCents, input.currency)}`;
  page.drawText(
    input.productSubline ? `${input.productSubline}  ·  ${unitLine}` : unitLine,
    { x: left, y, size: 9.5, font: regular, color: MUTED },
  );
  y -= 13;
  page.drawText("geht an den Veranstalter", { x: left, y, size: 9, font: regular, color: FAINT });

  if (input.serviceFeeCents > 0) {
    y -= 26;
    page.drawText("Servicegebühr", { x: left, y, size: 11.5, font: semibold, color: INK });
    drawRight(page, money(input.serviceFeeCents, input.currency), right, y, semibold, 11.5, INK);
    y -= 13;
    page.drawText("Vermittlung, Zahlungsabwicklung und Einlasskontrolle · geht an Passly", {
      x: left, y, size: 9, font: regular, color: FAINT,
    });
  }

  // ── Total ──────────────────────────────────────────────────────────
  y -= 26;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 22;
  page.drawText("Gesamtbetrag", { x: left, y, size: 13, font: semibold, color: INK });
  drawRight(page, money(input.totalCents, input.currency), right, y, semibold, 15, INK);

  y -= 18;
  const payLabel = input.paymentMethod
    ? PAYMENT_LABELS[input.paymentMethod] ?? input.paymentMethod
    : null;
  const payLine = [
    payLabel ? `Bezahlt per ${payLabel}` : "Bezahlt",
    input.creditUsed ? "teilweise mit Passly-Guthaben beglichen" : null,
  ].filter(Boolean).join(" · ");
  page.drawText(payLine, { x: left, y, size: 9.5, font: regular, color: MUTED });

  // ── Refund banner ──────────────────────────────────────────────────
  if (input.refundNote) {
    y -= 34;
    const bannerH = 34;
    page.drawSvgPath(roundedRectPath(cardW - 2 * pad, bannerH, 8), {
      x: left, y: y + 10, color: WARN_BG, borderColor: WARN_LINE, borderWidth: 1,
    });
    page.drawText(input.refundNote, { x: left + 14, y: y - 8, size: 10, font: semibold, color: WARN_INK });
  }

  // ── The "this is not an invoice" block ─────────────────────────────
  const noteH = 88;
  const noteTop = cardBottom + 26 + noteH;
  page.drawSvgPath(roundedRectPath(cardW - 2 * 26, noteH, 12), {
    x: cardX + 26, y: noteTop, color: PAGE_BG, borderColor: LINE, borderWidth: 1,
  });
  page.drawText("Hinweis zur Verwendung", { x: cardX + 40, y: noteTop - 24, size: 10, font: semibold, color: INK });
  page.drawText(
    "Dies ist ein Zahlungsbeleg, keine Rechnung: Er weist keine Umsatzsteuer aus und enthält",
    { x: cardX + 40, y: noteTop - 41, size: 8.5, font: regular, color: MUTED },
  );
  page.drawText(
    "keine Pflichtangaben nach § 14 UStG. Für eine Rechnung über den Ticketpreis wende dich an",
    { x: cardX + 40, y: noteTop - 54, size: 8.5, font: regular, color: MUTED },
  );
  page.drawText(
    "den Veranstalter; er ist dein Vertragspartner. Über die Servicegebühr rechnet Passly ab.",
    { x: cardX + 40, y: noteTop - 67, size: 8.5, font: regular, color: MUTED },
  );

  drawCentered(
    page,
    `Erstellt am ${formatGermanDate(new Date().toISOString())}  ·  getpassly.de`,
    cardBottom - 26, regular, 8.5, FAINT,
  );

  return doc.save();
}
