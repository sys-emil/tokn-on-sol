import { Resend } from "resend";
import { normalizeLang, t, type Lang } from "@/lib/i18n";
import { reportAlert } from "@/lib/observe";
import { formatEventDates } from "@/lib/eventDates";
import { esc, monoLink, renderMail, MAIL, type Block, type MailSpec } from "@/lib/mailLayout";

// Absender aller ausgehenden Mails. Die Domain muss in Resend verifiziert
// sein, sonst lehnt Resend den Versand ab — der Fallback zeigt deshalb auf
// die verifizierte Subdomain und nicht mehr auf die alte passly.xyz, die uns
// nicht gehoert: eine vergessene Env-Variable haette sonst jede Mail
// verschluckt, von der Kaufbestaetigung bis zum Admin-Alarm.
const FROM = process.env.EMAIL_FROM ?? "Passly <tickets@contact.getpassly.de>";

// Der Absender ist eine reine Versand-Subdomain ohne Postfach. Ohne reply_to
// liefen Antworten von Gaesten und Veranstaltern dorthin und damit ins Leere —
// jemand, der auf seine Ticketbestaetigung antwortet, erwartet zu Recht, dass
// das gelesen wird.
const REPLY_TO = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@getpassly.de";

// Impressums-Angaben für den E-Mail-Footer (geschäftliche E-Mails müssen den
// Absender erkennen lassen). Muss mit /impressum übereinstimmen.
const LEGAL_NAME = "Emil Lange";
const LEGAL_ADDRESS = "Vingerstr. 47, 81375 München";

const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@getpassly.de";

/**
 * Alle Mails teilen ein Layout (`src/lib/mailLayout.ts`); jeder Sender
 * beschreibt nur noch Überschrift, Blöcke und Fußnoten. `mail()` hängt die
 * Impressumszeile an und liefert HTML plus die daraus abgeleitete Textfassung.
 */
function mail(spec: Omit<MailSpec, "footer"> & { baseUrl: string; notes?: string[]; agb?: boolean }): { html: string; text: string } {
  const { baseUrl, notes, agb, ...rest } = spec;
  return renderMail({
    ...rest,
    footer: { baseUrl, notes, agb, legalName: LEGAL_NAME, legalAddress: LEGAL_ADDRESS },
  });
}

function formatDate(iso: string, lang: Lang = "de"): string {
  if (!iso) return iso;
  const [year, month, day] = iso.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(lang === "en" ? "en-GB" : "de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ticketRow(assetId: string, baseUrl: string, index: number, total: number, lang: Lang): Block {
  const url = `${baseUrl}/tickets/${assetId}`;
  const label = total > 1
    ? t(lang, "mail.ticketNo", { index: index + 1, total })
    : t(lang, "mail.yourTicket");
  // Bei einem einzelnen Ticket steht das Label schon als Eyebrow darüber;
  // die Zeile zeigt dann nur den Link.
  return {
    type: "raw",
    html: `<table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="padding:${total > 1 ? 12 : 4}px 0 12px;border-bottom:1px solid ${MAIL.line2};">
        ${total > 1 ? `<span style="font-family:'SF Mono',Menlo,monospace;font-size:12px;color:${MAIL.ink3};">${esc(label)}</span><br/>` : ""}
        ${monoLink(url)}
      </td>
    </tr></table>`,
    text: `${label}: ${url}`,
  };
}

/**
 * Guest orders: the buyer paid without an account, so the mail carries one link
 * for the whole order. The link is not the ticket — it opens the page where the
 * ticket is unlocked after signing in. Saying so prevents people from turning
 * up at the door with just this mail.
 */
function orderRow(token: string, baseUrl: string, total: number, lang: Lang): Block {
  const url = `${baseUrl}/order/${token}`;
  const label = total > 1 ? t(lang, "mail.yourTickets") : t(lang, "mail.yourTicket");
  const note = t(lang, "success.guestNote");
  return {
    type: "raw",
    html: `<table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="padding:4px 0 12px;border-bottom:1px solid ${MAIL.line2};">
        ${monoLink(url)}<br/>
        <span style="font-size:12px;color:${MAIL.ink3};line-height:1.5;">${esc(note)}</span>
      </td>
    </tr></table>`,
    text: `${label}: ${url}\n${note}`,
  };
}

// Plain-text operational alert to the platform admin (mint failures etc.).
// Requires ADMIN_ALERT_EMAIL; silently skipped when unset so non-critical
// environments don't need it. Bewusst ohne Layout: ein Alarm wird auf dem
// Handy überflogen, und Stacktraces gehören in Monospace, nicht in eine Karte.
export async function sendAdminAlert({ subject, text }: { subject: string; text: string }): Promise<void> {
  // Jeder betriebliche Alarm auch nach Sentry, damit er nicht nur im Postfach liegt.
  reportAlert(subject, text);
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!process.env.RESEND_API_KEY || !to) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: FROM, replyTo: REPLY_TO, to, subject: `[Passly Alert] ${subject}`, text });
}

/**
 * Pro feature: an organizer's message to all ticket holders of one event.
 * The organizer's text goes through the layout as an escaped paragraph, so
 * there is no HTML injection surface; one e-mail per recipient so addresses
 * never leak to each other. Recipients are chunked through Resend's batch
 * endpoint.
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
  const body = mail({
    eyebrow: `Nachricht von ${organizerName}`,
    heading: subject,
    intro: `Zu „${eventName}“`,
    sections: [
      [{ type: "p", text }],
      [{ type: "button", label: "Meine Tickets", url: `${baseUrl}/my-tickets` }],
    ],
    notes: [`Diese Nachricht wurde von ${organizerName} über Passly an die Ticketinhaber von „${eventName}“ gesendet. Antworten gehen an Passly, nicht an den Veranstalter.`],
    baseUrl,
  });

  let sent = 0;
  const CHUNK = 50;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from: FROM,
        replyTo: REPLY_TO,
        to,
        subject: `[${eventName}] ${subject}`,
        ...body,
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
 * Pro segment campaign: one mail to a customer segment (Stammgäste,
 * Gefährdet, …). Unlike `sendOrganizerMessage` this is not tied to a single
 * event, so the footer names the organizer as the reason the guest is hearing
 * from them and points at the ticket collection.
 */
export async function sendOrganizerCampaign({
  recipients,
  organizerName,
  segmentLabel,
  subject,
  text,
  baseUrl,
}: {
  recipients: string[];
  organizerName: string;
  segmentLabel: string;
  subject: string;
  text: string;
  baseUrl: string;
}): Promise<number> {
  if (!process.env.RESEND_API_KEY || recipients.length === 0) return 0;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = mail({
    eyebrow: `Nachricht von ${organizerName}`,
    heading: subject,
    sections: [
      [{ type: "p", text }],
      [{ type: "button", label: "Meine Tickets", url: `${baseUrl}/my-tickets` }],
    ],
    notes: [`Du bekommst diese E-Mail, weil du bereits Tickets von ${organizerName} über Passly gekauft hast (Segment: ${segmentLabel}).`],
    baseUrl,
  });

  let sent = 0;
  const CHUNK = 50;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from: FROM,
        replyTo: REPLY_TO,
        to,
        subject: `${organizerName}: ${subject}`,
        ...body,
      })),
    );
    if (error) {
      console.error("Organizer campaign batch failed:", error.message);
      continue;
    }
    sent += chunk.length;
  }
  return sent;
}

/**
 * Retention nudge after a check-in: "one more event until your next badge".
 * Sent at most once per redemption path (the caller guards against repeats).
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
  const body = mail({
    heading: headline,
    sections: [
      [
        { type: "p", text: detail },
        { type: "button", label: "Meine Sammlung", url: `${baseUrl}/my-tickets` },
      ],
    ],
    notes: ["Du bekommst diese E-Mail, weil du gerade ein Ticket über Passly eingelöst hast."],
    baseUrl,
  });

  await resend.emails.send({ from: FROM, replyTo: REPLY_TO, to, subject: headline, ...body });
}

/**
 * Begruessung nach der Registrierung als Veranstalter. Seit der Wegfall der
 * manuellen Freigabe (2026-09-07) ist das der einzige Brief, den ein neuer
 * Veranstalter bekommt — deshalb nennt er die zwei Schritte, die zwischen
 * Anmeldung und erstem Verkauf stehen, statt nur „willkommen“ zu sagen.
 */
export async function sendOrganizerWelcome({
  to,
  name,
  baseUrl,
}: {
  to: string;
  name: string;
  baseUrl: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = mail({
    heading: "Willkommen bei Passly",
    intro: `Hallo ${name}, dein Veranstalter-Konto steht.`,
    sections: [
      [
        { type: "p", text: "Zwei Schritte trennen dich vom ersten verkauften Ticket:" },
        {
          type: "steps",
          items: [
            {
              title: "Veranstaltung anlegen",
              text: "Name, Datum, Preis. Das Event ist sofort teilbar, als Link oder eingebettet auf deiner Website.",
              url: `${baseUrl}/dashboard/events/neu`,
            },
            {
              title: "Auszahlungen einrichten",
              text: "Dafür verifiziert dich Stripe einmalig. Solange das läuft, kannst du dein Event schon anlegen und teilen; bezahlte Tickets werden erst danach verkauft.",
              url: `${baseUrl}/dashboard`,
            },
          ],
        },
        { type: "button", label: "Zum Dashboard", url: `${baseUrl}/dashboard` },
      ],
      [
        {
          type: "p",
          muted: true,
          text: "Deine Einnahmen überweisen wir nach dem Event. Beim ersten Event halten wir sie drei Tage länger zurück; brauchst du das Geld vorher, kannst du unter „Auszahlungen“ eine Sofort-Auszahlung anfragen.",
        },
      ],
    ],
    notes: [`Fragen? Antworte einfach auf diese Mail oder schreib an ${SUPPORT}.`],
    baseUrl,
  });

  await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: "Willkommen bei Passly",
    ...body,
  });
}

export interface DigestEventLine {
  eventId: string;
  name: string;
  date: string;
  soldYesterday: number;
  soldTotal: number;
  capacity: number;
  daysUntil: number;
}

/**
 * Taegliche Verkaufszusammenfassung, siehe `src/lib/salesDigest.ts`. Nur an
 * Tagen mit Verkaeufen; abschaltbar unter /dashboard/profile.
 */
export async function sendSalesDigest({
  to,
  name,
  events,
  baseUrl,
}: {
  to: string;
  name: string;
  events: DigestEventLine[];
  baseUrl: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const total = events.reduce((n, e) => n + e.soldYesterday, 0);
  const tickets = (n: number) => n === 1 ? "1 Ticket" : `${n} Tickets`;
  const when = (d: number) => d === 0 ? "heute" : d === 1 ? "morgen" : d < 0 ? "vorbei" : `in ${d} Tagen`;
  const shortDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  };

  const heading = `Gestern: ${tickets(total)} verkauft`;
  const body = mail({
    heading,
    intro: `Hallo ${name}, so lief der Vorverkauf in den letzten 24 Stunden.`,
    sections: [
      [{
        type: "stats",
        items: events.map((e) => ({
          label: e.name,
          value: `+${e.soldYesterday}`,
          sub: `${shortDate(e.date)} · ${when(e.daysUntil)} · ${e.soldTotal} von ${e.capacity} verkauft`,
          progress: e.capacity > 0 ? e.soldTotal / e.capacity : 0,
          url: `${baseUrl}/dashboard/events/${e.eventId}`,
        })),
      }],
      [{ type: "button", label: "Alle Zahlen im Dashboard", url: `${baseUrl}/dashboard` }],
    ],
    notes: [`Diese Zusammenfassung kommt nur an Tagen mit Verkäufen. Abschalten kannst du sie unter ${baseUrl}/dashboard/profile.`],
    baseUrl,
  });

  await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: heading,
    ...body,
  });
}

/**
 * Taegliche Anmelde-Zusammenfassung an den Admin (siehe signupDigest.ts).
 * Bewusst nicht ueber sendAdminAlert: das ist kein Alarm und gehoert nicht
 * als Warnung nach Sentry. Gleiche Empfaenger-Variable, gleiches Schweigen,
 * wenn sie fehlt.
 */
export async function sendAdminSignupDigest({
  signups,
  organizers,
  total,
  baseUrl,
}: {
  signups: number;
  organizers: number;
  total: number;
  baseUrl: string;
}): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!process.env.RESEND_API_KEY || !to) return;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const konto = (n: number) => n === 1 ? "1 neues Konto" : `${n} neue Konten`;
  const heading = `Gestern: ${konto(signups)}`;
  const body = mail({
    heading,
    sections: [
      [{
        type: "stats",
        items: [
          { label: "Neue Konten", value: `+${signups}`, sub: "Erster Login in den letzten 24 Stunden" },
          { label: "davon Veranstalter", value: `${organizers}`, url: `${baseUrl}/admin?tab=organizers` },
          { label: "Konten gesamt", value: `${total}` },
        ],
      }],
    ],
    notes: ["Diese Zusammenfassung kommt nur an Tagen mit mindestens einer Anmeldung."],
    baseUrl,
  });

  await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `[Passly] ${heading}`,
    ...body,
  });
}

/**
 * Entscheidung ueber eine angefragte Sofort-Auszahlung (siehe
 * /dashboard/payouts und den Admin-Tab). Freigegebenes Geld geht mit dem
 * naechsten taeglichen Auszahlungslauf raus, nicht sofort.
 */
export async function sendPayoutRequestDecision({
  to,
  name,
  eventName,
  approved,
  baseUrl,
}: {
  to: string;
  name: string;
  eventName: string;
  approved: boolean;
  baseUrl: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const heading = approved ? "Sofort-Auszahlung freigegeben" : "Sofort-Auszahlung abgelehnt";
  const body = mail({
    heading,
    intro: `Hallo ${name},`,
    sections: [
      approved
        ? [
          { type: "meta", label: "Event", value: eventName },
          { type: "p", text: "Deine Sofort-Auszahlung ist freigegeben. Das Geld geht mit dem nächsten Auszahlungslauf raus, spätestens morgen früh." },
          { type: "button", label: "Auszahlungen ansehen", url: `${baseUrl}/dashboard/payouts` },
        ]
        : [
          { type: "meta", label: "Event", value: eventName },
          { type: "p", text: "Deine Sofort-Auszahlung konnten wir nicht freigeben. Die Einnahmen werden wie geplant nach dem Event überwiesen." },
          { type: "p", muted: true, text: `Fragen dazu beantworten wir gerne unter ${SUPPORT}.` },
        ],
    ],
    baseUrl,
  });

  await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: heading,
    ...body,
  });
}

/**
 * Result of the manual organizer-application review (/admin/organizers).
 * Nur noch fuer Altbestand mit `pending`-Status; Neuanmeldungen sind seit
 * 2026-09-07 sofort freigegeben.
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
  const heading = approved ? "Deine Veranstalter-Bewerbung ist freigegeben" : "Update zu deiner Veranstalter-Bewerbung";
  const body = mail({
    heading,
    intro: `Hallo ${name},`,
    sections: [
      approved
        ? [
          { type: "p", text: "Du kannst ab sofort Events anlegen und Tickets verkaufen." },
          { type: "button", label: "Zum Dashboard", url: `${baseUrl}/dashboard` },
        ]
        : [
          { type: "p", text: "Wir konnten deine Bewerbung als Veranstalter bei Passly aktuell leider nicht freigeben." },
          ...(reason ? [{ type: "meta", label: "Grund", value: reason } as Block] : []),
          { type: "p", muted: true, text: `Fragen dazu beantworten wir gerne unter ${SUPPORT}.` },
        ],
    ],
    baseUrl,
  });

  await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: heading,
    ...body,
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
  lang: rawLang,
}: {
  recipients: string[];
  eventName: string;
  eventDate: string;
  startTime?: string | null;
  venue: string | null;
  baseUrl: string;
  /** Language of THIS batch; callers group their recipients by it. */
  lang?: string | null;
}): Promise<number> {
  if (!process.env.RESEND_API_KEY || recipients.length === 0) return 0;

  const lang: Lang = normalizeLang(rawLang);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = t(lang, "mail.reminderSubject", { event: eventName });
  const sub = [`${formatDate(eventDate, lang)}${startTime ? ` · ${startTime}` : ""}`];
  if (venue) sub.push(venue);
  const body = mail({
    lang,
    heading: t(lang, "mail.reminderHeading"),
    sections: [
      [{ type: "meta", label: t(lang, "mail.event"), value: eventName, sub }],
      [
        { type: "p", text: t(lang, "mail.reminderText") },
        { type: "button", label: t(lang, "mail.myTickets"), url: `${baseUrl}/my-tickets` },
      ],
    ],
    baseUrl,
  });

  let sent = 0;
  const CHUNK = 50;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from: FROM,
        replyTo: REPLY_TO,
        to,
        subject,
        ...body,
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
  lang: rawLang,
}: {
  recipients: string[];
  eventName: string;
  eventId: string;
  baseUrl: string;
  /** Language of THIS batch; callers group their recipients by it. */
  lang?: string | null;
}): Promise<number> {
  if (!process.env.RESEND_API_KEY || recipients.length === 0) return 0;

  const lang: Lang = normalizeLang(rawLang);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = t(lang, "mail.waitlistSubject", { event: eventName });
  const body = mail({
    lang,
    heading: t(lang, "mail.waitlistHeading"),
    sections: [
      [{ type: "meta", label: t(lang, "mail.event"), value: eventName }],
      [
        { type: "p", text: t(lang, "mail.waitlistText", { event: eventName }) },
        { type: "button", label: t(lang, "mail.toEvent"), url: `${baseUrl}/event/${eventId}` },
      ],
    ],
    baseUrl,
  });

  let sent = 0;
  const CHUNK = 50;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from: FROM,
        replyTo: REPLY_TO,
        to,
        subject,
        ...body,
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
  const body = mail({
    heading: "Dein Backup-Ticket liegt bei",
    sections: [
      [{ type: "meta", label: "Event", value: eventName, sub: ["Als PDF im Anhang dieser E-Mail"] }],
      [
        { type: "p", text: "Es ist für Veranstaltungsorte ohne Empfang gedacht: Speichere es auf deinem Handy oder drucke es aus." },
        { type: "p", text: "Es ist auf dich personalisiert und nur zusammen mit deinem Ausweis gültig, nicht zum Weitergeben oder Teilen gedacht, Weiterverkauf verboten. Es gilt der erste Scan." },
        { type: "p", muted: true, text: "Dein normales Ticket bleibt unverändert gültig." },
        { type: "button", label: "Meine Tickets", url: `${baseUrl}/my-tickets` },
      ],
    ],
    baseUrl,
  });

  await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Dein Backup-Ticket für ${eventName}`,
    ...body,
    attachments: [{ filename: "passly-backup-ticket.pdf", content: Buffer.from(pdf) }],
  });
}

export async function sendTicketConfirmation({
  to,
  eventName,
  eventDate,
  eventEndDate,
  organizerName,
  assetIds,
  baseUrl,
  orderToken,
  receiptPdf,
  calendar,
  lang: rawLang,
}: {
  to: string;
  eventName: string;
  eventDate: string;
  /** Last day of a multi-day event; the mail then shows the range. */
  eventEndDate?: string | null;
  /**
   * Named in the mail because the guest's contract is with the organizer, not
   * with Passly; see src/lib/organizerIdentity.ts.
   */
  organizerName?: string | null;
  assetIds: string[];
  baseUrl: string;
  /** Guest orders: one link to all tickets, since the buyer has no account. */
  orderToken?: string | null;
  /** Purchase receipt, attached when the order actually cost money. */
  receiptPdf?: Uint8Array | null;
  /**
   * Calendar entry (.ics) for the event, attached and linked; null for season
   * passes, which span many dates. Same file as the ticket page's download.
   */
  calendar?: { eventId: string; ics: string } | null;
  /** Buyer's language, carried on the order since the mail goes out later. */
  lang?: string | null;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const lang: Lang = normalizeLang(rawLang);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const plural = assetIds.length > 1;

  const eventSub: string[] = [];
  if (eventDate) eventSub.push(formatEventDates({ date: eventDate, end_date: eventEndDate ?? null }, lang));
  if (organizerName) eventSub.push(`${t(lang, "mail.organizer")}: ${organizerName}`);

  const ticketRows: Block[] = orderToken
    ? [orderRow(orderToken, baseUrl, assetIds.length, lang)]
    : assetIds.map((id, i) => ticketRow(id, baseUrl, i, assetIds.length, lang));

  // Ein Knopf, wo es genau ein Ziel gibt: die Gastbestellung oder das eine
  // Ticket. Bei mehreren Tickets bleiben die Zeilen die Navigation.
  const cta: Block[] = orderToken
    ? [{ type: "button", label: t(lang, "mail.openOrder"), url: `${baseUrl}/order/${orderToken}` }]
    : assetIds.length === 1
      ? [{ type: "button", label: t(lang, "mail.openTicket"), url: `${baseUrl}/tickets/${assetIds[0]}` }]
      : [];

  const body = mail({
    lang,
    heading: plural ? t(lang, "mail.ticketHeadingMany") : t(lang, "mail.ticketHeadingOne"),
    sections: [
      [
        { type: "meta", label: t(lang, "mail.event"), value: eventName, sub: eventSub },
        ...(calendar ? [{ type: "link", label: t(lang, "mail.addToCalendar"), url: `${baseUrl}/api/events/${calendar.eventId}/ics` } as Block] : []),
      ],
      [
        {
          type: "raw",
          html: `<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MAIL.ink3};">${esc(plural ? t(lang, "mail.yourTickets") : t(lang, "mail.yourTicket"))}</p>`,
          text: "",
        },
        ...ticketRows,
        { type: "raw", html: `<p style="margin:0 0 10px;"></p>`, text: "" },
        ...cta,
        { type: "p", muted: true, text: t(lang, "mail.ticketHint") },
        ...(receiptPdf ? [{ type: "p", muted: true, text: t(lang, "mail.receiptHint") } as Block] : []),
      ],
    ],
    notes: [
      `${t(lang, "mail.ticketFooter")} ${organizerName ? t(lang, "mail.contractPartner", { organizer: organizerName }) : t(lang, "mail.contractPartnerGeneric")}`,
    ],
    agb: true,
    baseUrl,
  });

  const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
  if (receiptPdf) attachments.push({ filename: "passly-beleg.pdf", content: Buffer.from(receiptPdf) });
  if (calendar) {
    attachments.push({
      filename: `passly-${eventDate.replace(/-/g, "")}.ics`,
      content: Buffer.from(calendar.ics, "utf8"),
      contentType: "text/calendar",
    });
  }

  await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: plural
      ? t(lang, "mail.ticketSubjectMany", { count: assetIds.length, event: eventName })
      : t(lang, "mail.ticketSubjectOne", { event: eventName }),
    ...body,
    // The receipt and the calendar entry ride along with the confirmation so
    // the buyer never has to come back for them; the receipt is absent for
    // free tickets, which have nothing to receipt.
    ...(attachments.length > 0 ? { attachments } : {}),
  });
}
