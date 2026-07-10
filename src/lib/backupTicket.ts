import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

/**
 * Backup-ticket PDF for events with bad connectivity: a static, personalized
 * QR the guest saves in advance. The QR carries a signature over
 * `passly:backup:<assetId>` (no time window); the printed name + birth date
 * let the door check an ID — that offsets the shareability of a static code.
 * Nothing of the personalization is stored server-side; it exists only on
 * this document.
 */

export interface BackupTicketInput {
  eventName: string;
  eventDate: string; // YYYY-MM-DD
  venue: string | null;
  person: { firstName: string; lastName: string; birthDate: string /* YYYY-MM-DD */ };
  tickets: { assetId: string; qrPayload: string }[];
}

const A4: [number, number] = [595.28, 841.89];
const INK = rgb(0.14, 0.15, 0.24);
const MUTED = rgb(0.5, 0.5, 0.58);
const ACCENT = rgb(0.49, 0.23, 0.93);
const BAD = rgb(0.76, 0.16, 0.16);

function formatGermanDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function serial(assetId: string): string {
  return `#PSL-${assetId.slice(-4).toUpperCase()}`;
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (A4[0] - width) / 2, y, size, font, color });
}

export async function buildBackupPdf(input: BackupTicketInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const personLine = `${input.person.firstName} ${input.person.lastName} · geboren am ${formatGermanDate(input.person.birthDate)}`;

  for (let i = 0; i < input.tickets.length; i++) {
    const ticket = input.tickets[i];
    const page = doc.addPage(A4);

    // Header
    page.drawText("PASSLY", { x: 56, y: 780, size: 13, font: bold, color: ACCENT });
    const badge = input.tickets.length > 1 ? `Backup-Ticket ${i + 1} von ${input.tickets.length}` : "Backup-Ticket";
    const badgeWidth = bold.widthOfTextAtSize(badge, 10);
    page.drawText(badge, { x: A4[0] - 56 - badgeWidth, y: 781, size: 10, font: bold, color: MUTED });
    page.drawLine({ start: { x: 56, y: 768 }, end: { x: A4[0] - 56, y: 768 }, thickness: 1, color: rgb(0.9, 0.9, 0.93) });

    // Event block
    drawCentered(page, input.eventName, 710, bold, 24);
    drawCentered(page, formatGermanDate(input.eventDate) + (input.venue ? ` · ${input.venue}` : ""), 686, font, 13, MUTED);

    // QR
    const qrDataUrl = await QRCode.toDataURL(ticket.qrPayload, { width: 640, margin: 2, errorCorrectionLevel: "M" });
    const qrImage = await doc.embedPng(qrDataUrl);
    const qrSize = 280;
    page.drawImage(qrImage, { x: (A4[0] - qrSize) / 2, y: 370, width: qrSize, height: qrSize });
    drawCentered(page, serial(ticket.assetId), 348, bold, 12, MUTED);

    // Personalization
    drawCentered(page, "Dieses Ticket ist personalisiert für:", 300, font, 11, MUTED);
    drawCentered(page, personLine, 282, bold, 14);

    // Warning box
    const boxTop = 250;
    const boxHeight = 96;
    page.drawRectangle({
      x: 56,
      y: boxTop - boxHeight,
      width: A4[0] - 112,
      height: boxHeight,
      borderColor: BAD,
      borderWidth: 1,
      color: rgb(0.99, 0.95, 0.95),
    });
    drawCentered(page, "Nicht zum Weitergeben oder Teilen gedacht — Weiterverkauf verboten.", boxTop - 26, bold, 12, BAD);
    drawCentered(page, "Nur gültig zusammen mit einem amtlichen Ausweis der oben genannten Person.", boxTop - 48, font, 10.5, INK);
    drawCentered(page, "Es gilt der erste Scan — Kopien werden am Einlass automatisch abgelehnt.", boxTop - 64, font, 10.5, INK);
    drawCentered(page, "Dein Ticket in der App bleibt unverändert gültig.", boxTop - 80, font, 10.5, MUTED);

    // Footer
    drawCentered(
      page,
      `Backup für Veranstaltungen ohne Empfang · erstellt am ${formatGermanDate(new Date().toISOString().slice(0, 10))} · getpassly.de`,
      64,
      font,
      9,
      MUTED,
    );
  }

  return doc.save();
}
