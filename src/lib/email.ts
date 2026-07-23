import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "Passly <tickets@passly.xyz>";

// Impressums-Angaben für den E-Mail-Footer (geschäftliche E-Mails müssen den
// Absender erkennen lassen). VOR GO-LIVE ausfüllen, grep nach "PLATZHALTER".
const LEGAL_NAME = "[PLATZHALTER: Vor- und Nachname]";
const LEGAL_ADDRESS = "[PLATZHALTER: Straße Nr., PLZ Ort]";

function formatDate(iso: string): string {
  if (!iso) return iso;
  const [year, month, day] = iso.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ticketRow(assetId: string, baseUrl: string, index: number, total: number): string {
  const url = `${baseUrl}/tickets/${assetId}`;
  const label = total > 1 ? `Ticket ${index + 1} von ${total}` : "Dein Ticket";
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #ececf2;">
        <span style="font-family:'SF Mono',Menlo,monospace;font-size:12px;color:#8a8a99;">${label}</span><br/>
        <a href="${url}" style="font-size:14px;color:#7c3aed;text-decoration:none;word-break:break-all;">${url}</a>
      </td>
    </tr>`;
}

// Plain-text operational alert to the platform admin (mint failures etc.).
// Requires ADMIN_ALERT_EMAIL; silently skipped when unset so non-critical
// environments don't need it.
export async function sendAdminAlert({ subject, text }: { subject: string; text: string }): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!process.env.RESEND_API_KEY || !to) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: FROM, to, subject: `[Passly Alert] ${subject}`, text });
}

/**
 * Pro feature: an organizer's message to all ticket holders of one event.
 * Plaintext only (no HTML injection surface); one e-mail per recipient so
 * addresses never leak to each other. Recipients are chunked through Resend's
 * batch endpoint.
 */
export async function sendOrganizerMessage({
  recipients,
  organizerName,
  eventName,
  subject,
  text,
  baseUrl,
}: {
  recipients: string[];
  organizerName: string;
  eventName: string;
  subject: string;
  text: string;
  baseUrl: string;
}): Promise<number> {
  if (!process.env.RESEND_API_KEY || recipients.length === 0) return 0;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = `${text}\n\n--\nDiese Nachricht wurde von ${organizerName} über Passly an die Ticketinhaber von „${eventName}“ gesendet.\n${baseUrl}/my-tickets\n\nPassly · ${LEGAL_NAME} · ${LEGAL_ADDRESS}\nImpressum: ${baseUrl}/impressum · Datenschutz: ${baseUrl}/datenschutz`;

  let sent = 0;
  const CHUNK = 50;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from: FROM,
        to,
        subject: `[${eventName}] ${subject}`,
        text: body,
      })),
    );
    if (error) {
      console.error("Organizer message batch failed:", error.message);
      continue;
    }
    sent += chunk.length;
  }
  return sent;
}

/**
 * Retention nudge after a check-in: "one more event until your next badge".
 * Sent at most once per redemption path (the caller guards against repeats);
 * plaintext like the organizer messages, no HTML injection surface.
 */
export async function sendBadgeProgressEmail({
  to,
  headline,
  detail,
  baseUrl,
}: {
  to: string;
  headline: string;
  detail: string;
  baseUrl: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = `${detail}\n\nDeine Sammlung und alle Abzeichen findest du hier:\n${baseUrl}/my-tickets\n\n--\nDu bekommst diese E-Mail, weil du gerade ein Ticket über Passly eingelöst hast.\n\nPassly · ${LEGAL_NAME} · ${LEGAL_ADDRESS}\nImpressum: ${baseUrl}/impressum · Datenschutz: ${baseUrl}/datenschutz`;

  await resend.emails.send({ from: FROM, to, subject: headline, text: body });
}

/**
 * Result of the manual organizer-application review (/admin/organizers).
 * Plaintext, single recipient, the applicant themselves.
 */
export async function sendOrganizerApplicationDecision({
  to,
  name,
  approved,
  reason,
  baseUrl,
}: {
  to: string;
  name: string;
  approved: boolean;
  reason?: string;
  baseUrl: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = approved
    ? `Hallo ${name},\n\ndeine Bewerbung als Veranstalter bei Passly ist freigegeben. Du kannst ab sofort Events anlegen und Tickets verkaufen:\n${baseUrl}/dashboard\n\n--\nPassly · ${LEGAL_NAME} · ${LEGAL_ADDRESS}\nImpressum: ${baseUrl}/impressum · Datenschutz: ${baseUrl}/datenschutz`
    : `Hallo ${name},\n\nwir konnten deine Bewerbung als Veranstalter bei Passly aktuell leider nicht freigeben.${reason ? `\n\nGrund: ${reason}` : ""}\n\nFragen dazu beantworten wir gerne unter ${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@getpassly.de"}.\n\n--\nPassly · ${LEGAL_NAME} · ${LEGAL_ADDRESS}\nImpressum: ${baseUrl}/impressum · Datenschutz: ${baseUrl}/datenschutz`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: approved ? "Deine Veranstalter-Bewerbung ist freigegeben" : "Update zu deiner Veranstalter-Bewerbung",
    text: body,
  });
}

/**
 * "Morgen ist es soweit", day-before reminder to every ticket holder of an
 * event. One e-mail per recipient (addresses never leak to each other),
 * chunked through Resend's batch endpoint like the organizer messages.
 */
export async function sendEventReminder({
  recipients,
  eventName,
  eventDate,
  startTime,
  venue,
  baseUrl,
}: {
  recipients: string[];
  eventName: string;
  eventDate: string;
  startTime?: string | null;
  venue: string | null;
  baseUrl: string;
}): Promise<number> {
  if (!process.env.RESEND_API_KEY || recipients.length === 0) return 0;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = `Morgen ist es soweit: ${eventName}\n${formatDate(eventDate)}${startTime ? ` · Beginn ${startTime} Uhr` : ""}${venue ? `\n${venue}` : ""}\n\nDein Ticket hast du in deiner Ticketübersicht, öffne sie am besten auf dem Handy, dann zeigst du am Einlass einfach deinen QR-Code:\n${baseUrl}/my-tickets\n\nViel Spaß!\n\n--\nDu bekommst diese Erinnerung, weil du ein Ticket für dieses Event hast.\nVertragspartner für die Veranstaltung ist der jeweilige Veranstalter.\n\nPassly · ${LEGAL_NAME} · ${LEGAL_ADDRESS}\nImpressum: ${baseUrl}/impressum · Datenschutz: ${baseUrl}/datenschutz`;

  let sent = 0;
  const CHUNK = 50;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from: FROM,
        to,
        subject: `Morgen ist es soweit: ${eventName}`,
        text: body,
      })),
    );
    if (error) {
      console.error("Event reminder batch failed:", error.message);
      continue;
    }
    sent += chunk.length;
  }
  return sent;
}

/** "Es sind wieder Tickets frei", one-shot note to waitlisted buyers. */
export async function sendWaitlistEmail({
  recipients,
  eventName,
  eventId,
  baseUrl,
}: {
  recipients: string[];
  eventName: string;
  eventId: string;
  baseUrl: string;
}): Promise<number> {
  if (!process.env.RESEND_API_KEY || recipients.length === 0) return 0;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = `Gute Nachrichten: Für „${eventName}“ sind wieder Tickets verfügbar.\n\nSchnell sein lohnt sich, wer zuerst kommt, bekommt den Platz:\n${baseUrl}/shop/${eventId}\n\n--\nDu bekommst diese E-Mail einmalig, weil du dich auf die Warteliste für dieses Event eingetragen hast.\n\nPassly · ${LEGAL_NAME} · ${LEGAL_ADDRESS}\nImpressum: ${baseUrl}/impressum · Datenschutz: ${baseUrl}/datenschutz`;

  let sent = 0;
  const CHUNK = 50;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from: FROM,
        to,
        subject: `Wieder Tickets verfügbar: ${eventName}`,
        text: body,
      })),
    );
    if (error) {
      console.error("Waitlist batch failed:", error.message);
      continue;
    }
    sent += chunk.length;
  }
  return sent;
}

/** Backup ticket PDF as attachment, requested explicitly by the buyer. */
export async function sendBackupTicketEmail({
  to,
  eventName,
  pdf,
  baseUrl,
}: {
  to: string;
  eventName: string;
  pdf: Uint8Array;
  baseUrl: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = `Im Anhang findest du dein Backup-Ticket für „${eventName}“ als PDF.\n\nEs ist für Veranstaltungsorte ohne Empfang gedacht: Speichere es auf deinem Handy oder drucke es aus. Es ist auf dich personalisiert und nur zusammen mit deinem Ausweis gültig, nicht zum Weitergeben oder Teilen gedacht, Weiterverkauf verboten. Es gilt der erste Scan.\n\nDein normales Ticket bleibt unverändert gültig:\n${baseUrl}/my-tickets\n\nPassly · ${LEGAL_NAME} · ${LEGAL_ADDRESS}\nImpressum: ${baseUrl}/impressum · Datenschutz: ${baseUrl}/datenschutz`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Dein Backup-Ticket für ${eventName}`,
    text: body,
    attachments: [{ filename: "passly-backup-ticket.pdf", content: Buffer.from(pdf) }],
  });
}

export async function sendTicketConfirmation({
  to,
  eventName,
  eventDate,
  assetIds,
  baseUrl,
}: {
  to: string;
  eventName: string;
  eventDate: string;
  assetIds: string[];
  baseUrl: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const plural = assetIds.length > 1;
  const ticketRows = assetIds.map((id, i) => ticketRow(id, baseUrl, i, assetIds.length)).join("");

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f7f7fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7fb;padding:48px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e8ef;border-radius:14px;max-width:520px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #ececf2;">
            <p style="margin:0 0 16px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7c3aed;font-weight:700;">Passly</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#1c1c2b;line-height:1.2;">
              ${plural ? "Deine Tickets sind da" : "Dein Ticket ist da"}
            </h1>
          </td>
        </tr>

        <!-- Event info -->
        <tr>
          <td style="padding:24px 40px;border-bottom:1px solid #ececf2;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8a99;">Event</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#1c1c2b;">${eventName}</p>
            ${eventDate ? `<p style="margin:6px 0 0;font-size:13px;color:#6d6d7f;">${formatDate(eventDate)}</p>` : ""}
          </td>
        </tr>

        <!-- Ticket links -->
        <tr>
          <td style="padding:24px 40px 16px;border-bottom:1px solid #ececf2;">
            <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8a99;">
              ${plural ? "Deine Tickets" : "Dein Ticket"}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${ticketRows}
            </table>
            <p style="margin:16px 0 0;font-size:12px;color:#6d6d7f;line-height:1.6;">
              Öffne den Link am besten auf deinem Handy, dort zeigst du am Einlass
              einfach deinen QR-Code. Keine App nötig. Du findest ${plural ? "die Tickets" : "das Ticket"}
              jederzeit auch unter <a href="${baseUrl}/my-tickets" style="color:#7c3aed;text-decoration:none;">Meine Tickets</a>.
            </p>
          </td>
        </tr>

        <!-- Legal footer -->
        <tr>
          <td style="padding:20px 40px 24px;">
            <p style="margin:0;font-size:11px;color:#9a9aa9;line-height:1.7;">
              Dein Ticket ist einzigartig und fälschungssicher, bewahre diese E-Mail als Zugangs-Backup auf.<br/>
              Vertragspartner für die Veranstaltung ist der jeweilige Veranstalter.
            </p>
            <p style="margin:12px 0 0;font-size:11px;color:#9a9aa9;line-height:1.7;">
              Passly · ${LEGAL_NAME} · ${LEGAL_ADDRESS}<br/>
              <a href="${baseUrl}/impressum" style="color:#8a8a99;">Impressum</a> ·
              <a href="${baseUrl}/datenschutz" style="color:#8a8a99;">Datenschutz</a> ·
              <a href="${baseUrl}/agb" style="color:#8a8a99;">AGB</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: plural
      ? `Deine ${assetIds.length} Tickets für ${eventName}`
      : `Dein Ticket für ${eventName}`,
    html,
  });
}
