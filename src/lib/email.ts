import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "Passly <tickets@passly.xyz>";

function formatDate(iso: string): string {
  if (!iso) return iso;
  const [year, month, day] = iso.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ticketRow(assetId: string, baseUrl: string, index: number, total: number): string {
  const url = `${baseUrl}/tickets/${assetId}`;
  const label = total > 1 ? `Ticket ${index + 1} of ${total}` : "Your Ticket";
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #2a2a3a;">
        <span style="font-family:monospace;font-size:12px;color:#888;">${label}</span><br/>
        <a href="${url}" style="font-size:14px;color:#d4a85a;text-decoration:none;word-break:break-all;">${url}</a>
      </td>
    </tr>`;
}

// Plain-text operational alert to the platform admin (mint failures etc.).
// Requires ADMIN_ALERT_EMAIL — silently skipped when unset so non-critical
// environments don't need it.
export async function sendAdminAlert({ subject, text }: { subject: string; text: string }): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!process.env.RESEND_API_KEY || !to) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: FROM, to, subject: `[Passly Alert] ${subject}`, text });
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
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0d0d18;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d18;padding:48px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#15151f;border:1px solid #2a2a3a;max-width:520px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #2a2a3a;">
            <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#d4a85a;">Passly</p>
            <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-0.02em;color:#f5f3ee;line-height:1.2;">
              ${plural ? `Your tickets are confirmed` : `Your ticket is confirmed`}
            </h1>
          </td>
        </tr>

        <!-- Event info -->
        <tr>
          <td style="padding:24px 40px;border-bottom:1px solid #2a2a3a;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#666;">Event</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#f5f3ee;">${eventName}</p>
            ${eventDate ? `<p style="margin:6px 0 0;font-size:13px;color:#888;">${formatDate(eventDate)}</p>` : ""}
          </td>
        </tr>

        <!-- Ticket links -->
        <tr>
          <td style="padding:24px 40px 16px;border-bottom:1px solid #2a2a3a;">
            <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#666;">
              ${plural ? "Your tickets" : "Your ticket"}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${ticketRows}
            </table>
            <p style="margin:16px 0 0;font-size:12px;color:#555;line-height:1.6;">
              Open the link${plural ? "s" : ""} on your phone to show your QR code at the door. No app needed.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;">
            <p style="margin:0;font-size:11px;color:#444;line-height:1.6;">
              Tickets are tied to your wallet and verified on-chain. Keep this email as a backup link.
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
    subject: `Your ${plural ? `${assetIds.length} tickets` : "ticket"} for ${eventName}`,
    html,
  });
}
