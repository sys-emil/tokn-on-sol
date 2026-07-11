import { LineCapStyle, PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { GEIST_REGULAR, GEIST_SEMIBOLD, GEIST_EXTRABOLD } from "@/lib/pdfFonts";

/**
 * Backup-ticket PDF for events with bad connectivity: a static, personalized
 * QR the guest saves in advance. The QR carries a signature over
 * `passly:backup:<assetId>` (no time window); the printed name + birth date
 * let the door check an ID — that offsets the shareability of a static code.
 * Nothing of the personalization is stored server-side; it exists only on
 * this document.
 *
 * Design: brand identity of the site — Geist, light surface, violet accent,
 * the Passly logo redrawn as vectors (frame strokes from passly-logo.svg,
 * lettering in Geist ExtraBold).
 */

export interface BackupTicketInput {
  eventName: string;
  eventDate: string; // YYYY-MM-DD
  venue: string | null;
  person: { firstName: string; lastName: string; birthDate: string /* YYYY-MM-DD */ };
  tickets: { assetId: string; qrPayload: string }[];
}

const A4: [number, number] = [595.28, 841.89];

const hex = (h: string): Color => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

// Palette lifted from globals.css / passly-logo.svg
const INK = hex("#13151F");
const MUTED = hex("#6E6D80");
const FAINT = hex("#9C9AAD");
const LINE = hex("#E8E6F0");
const ACCENT = hex("#5F38DD");
const ACCENT_DARK = hex("#5624D4");
const ACCENT_LIGHT = hex("#694CE6");
const ACCENT_WASH = hex("#F1EDFB");
const ROSE_BG = hex("#FCF2F2");
const ROSE_LINE = hex("#EFC9C9");
const RED = hex("#B42B2B");
const PAGE_BG = hex("#F7F6FB");
const WHITE = rgb(1, 1, 1);

function formatGermanDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function formatLongDate(iso: string): string {
  const t = Date.parse(`${iso}T12:00:00Z`);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("de-DE", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function serial(assetId: string): string {
  return `PSL-${assetId.slice(-4).toUpperCase()}`;
}

function roundedRectPath(w: number, h: number, r: number): string {
  return `M ${r},0 H ${w - r} A ${r},${r} 0 0 1 ${w},${r} V ${h - r} A ${r},${r} 0 0 1 ${w - r},${h} H ${r} A ${r},${r} 0 0 1 0,${h - r} V ${r} A ${r},${r} 0 0 1 ${r},0 Z`;
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color: Color): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (A4[0] - width) / 2, y, size, font, color });
}

/** Letter-spaced text (pdf-lib has no tracking option) — returns total width. */
function trackedWidth(text: string, font: PDFFont, size: number, tracking: number): number {
  let w = 0;
  for (const ch of text) w += font.widthOfTextAtSize(ch, size) + tracking;
  return w - tracking;
}

function drawTracked(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: Color, tracking: number): void {
  let cx = x;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

function drawTrackedCentered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color: Color, tracking: number): void {
  const w = trackedWidth(text, font, size, tracking);
  drawTracked(page, text, (A4[0] - w) / 2, y, font, size, color, tracking);
}

// Frame strokes from public/passly-logo.svg (viewBox 330×92, stroke 7).
const LOGO_FRAME: { d: string; color: Color }[] = [
  { d: "M3.5,33.5 L3.5,17.5 A14,14 0 0 1 17.5,3.5 L33.5,3.5", color: ACCENT_DARK },
  { d: "M58.5,3.5 L74.5,3.5 A14,14 0 0 1 88.5,17.5 L88.5,33.5", color: ACCENT_LIGHT },
  { d: "M3.5,58.5 L3.5,74.5 A14,14 0 0 0 17.5,88.5 L33.5,88.5", color: ACCENT_DARK },
  { d: "M58.5,88.5 L74.5,88.5 A14,14 0 0 0 88.5,74.5 L88.5,58.5", color: ACCENT_LIGHT },
];

/** Vector redraw of the Passly wordmark; (x, yTop) is the logo's top-left. */
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

export async function buildBackupPdf(input: BackupTicketInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(GEIST_REGULAR, { subset: true });
  const semibold = await doc.embedFont(GEIST_SEMIBOLD, { subset: true });
  const extrabold = await doc.embedFont(GEIST_EXTRABOLD, { subset: true });

  const personLine = `${input.person.firstName} ${input.person.lastName}`;
  const birthLine = `geboren am ${formatGermanDate(input.person.birthDate)}`;

  // Card geometry (page coordinates, y up)
  const cardX = 68;
  const cardW = A4[0] - 2 * cardX;
  const cardTop = A4[1] - 78;
  const cardH = 660;
  const cardBottom = cardTop - cardH;
  const pad = 32;

  for (let i = 0; i < input.tickets.length; i++) {
    const ticket = input.tickets[i];
    const page = doc.addPage(A4);

    // Soft brand-wash background + white ticket card
    page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: PAGE_BG });
    page.drawSvgPath(roundedRectPath(cardW, cardH, 18), {
      x: cardX, y: cardTop, color: WHITE, borderColor: LINE, borderWidth: 1.2,
    });

    // ── Head: logo + pill ────────────────────────────────────────────
    drawLogo(page, cardX + pad, cardTop - 30, 24, extrabold);
    const pillText = input.tickets.length > 1 ? `BACKUP-TICKET ${i + 1}/${input.tickets.length}` : "BACKUP-TICKET";
    const pillSize = 7.5;
    const pillTextW = trackedWidth(pillText, semibold, pillSize, 0.9);
    const pillW = pillTextW + 24;
    const pillH = 19;
    page.drawSvgPath(roundedRectPath(pillW, pillH, pillH / 2), {
      x: cardX + cardW - pad - pillW, y: cardTop - 33, color: ACCENT_WASH,
    });
    drawTracked(page, pillText, cardX + cardW - pad - pillW + 12, cardTop - 33 - pillH + 6.5, semibold, pillSize, ACCENT, 0.9);

    page.drawLine({
      start: { x: cardX + pad, y: cardTop - 78 },
      end: { x: cardX + cardW - pad, y: cardTop - 78 },
      thickness: 1, color: LINE,
    });

    // ── Event block ──────────────────────────────────────────────────
    drawTracked(page, "EVENT", cardX + pad, cardTop - 104, semibold, 7.5, FAINT, 1.4);
    page.drawText(input.eventName, {
      x: cardX + pad, y: cardTop - 130, size: 22, font: semibold, color: INK,
      maxWidth: cardW - 2 * pad, lineHeight: 26,
    });
    page.drawText(formatLongDate(input.eventDate) + (input.venue ? `  ·  ${input.venue}` : ""), {
      x: cardX + pad, y: cardTop - 152, size: 11, font: regular, color: MUTED,
    });

    // ── Perforation ──────────────────────────────────────────────────
    const perfY = cardTop - 182;
    page.drawLine({
      start: { x: cardX + 18, y: perfY }, end: { x: cardX + cardW - 18, y: perfY },
      thickness: 1, color: LINE, dashArray: [4, 5],
    });
    for (const nx of [cardX, cardX + cardW]) {
      page.drawCircle({ x: nx, y: perfY, size: 9, color: PAGE_BG, borderColor: LINE, borderWidth: 1.2 });
    }

    // ── QR ───────────────────────────────────────────────────────────
    const qrDataUrl = await QRCode.toDataURL(ticket.qrPayload, {
      width: 720, margin: 0, errorCorrectionLevel: "M",
      color: { dark: "#1B1830", light: "#ffffff" },
    });
    const qrImage = await doc.embedPng(qrDataUrl);
    const qrSize = 198;
    const qrTop = perfY - 34;
    // Hairline frame around the code, like the QR tile on the ticket page
    page.drawSvgPath(roundedRectPath(qrSize + 32, qrSize + 32, 14), {
      x: (A4[0] - qrSize - 32) / 2, y: qrTop + 16, color: WHITE, borderColor: LINE, borderWidth: 1.2,
    });
    page.drawImage(qrImage, { x: (A4[0] - qrSize) / 2, y: qrTop - qrSize, width: qrSize, height: qrSize });
    drawTrackedCentered(page, serial(ticket.assetId), qrTop - qrSize - 34, semibold, 10, FAINT, 2.2);

    // ── Personalization ──────────────────────────────────────────────
    const persY = qrTop - qrSize - 68;
    drawTrackedCentered(page, "PERSONALISIERT FÜR", persY, semibold, 7.5, FAINT, 1.4);
    drawCentered(page, personLine, persY - 19, semibold, 15, INK);
    drawCentered(page, birthLine, persY - 35, regular, 10.5, MUTED);

    // ── Warning ──────────────────────────────────────────────────────
    const warnH = 92;
    const warnTop = cardBottom + 26 + warnH;
    page.drawSvgPath(roundedRectPath(cardW - 2 * 26, warnH, 12), {
      x: cardX + 26, y: warnTop, color: ROSE_BG, borderColor: ROSE_LINE, borderWidth: 1,
    });
    drawCentered(page, "Nicht zum Weitergeben oder Teilen gedacht — Weiterverkauf verboten.", warnTop - 26, semibold, 10.5, RED);
    drawCentered(page, "Nur gültig zusammen mit einem amtlichen Ausweis der oben genannten Person.", warnTop - 45, regular, 9, INK);
    drawCentered(page, "Es gilt der erste Scan — Kopien werden am Einlass automatisch abgelehnt.", warnTop - 59, regular, 9, INK);
    drawCentered(page, "Dein Ticket in der App bleibt unverändert gültig.", warnTop - 76, regular, 9, MUTED);

    // ── Footer (outside the card) ────────────────────────────────────
    drawCentered(
      page,
      `Backup für Veranstaltungsorte ohne Empfang  ·  erstellt am ${formatGermanDate(new Date().toISOString().slice(0, 10))}  ·  getpassly.de`,
      cardBottom - 26, regular, 8.5, FAINT,
    );
  }

  return doc.save();
}
