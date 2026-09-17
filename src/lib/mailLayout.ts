/**
 * Ein Layout für jede Mail, die Passly verschickt (seit 2026-09-17).
 *
 * Vorher hatte nur die Kaufbestätigung ein gestaltetes Template; Erinnerung,
 * Warteliste, Verkaufs-Digest, Willkommensbrief und die Veranstalter-
 * Nachrichten gingen als nackter Text raus, und nebeneinander im Postfach
 * sahen sie aus wie zwei verschiedene Absender. Jetzt beschreibt jeder Sender
 * seine Mail als Blöcke, und `renderMail` baut daraus **HTML und Text in
 * einem Zug** — der Text-Teil ist kein Abfallprodukt, sondern die Fassung, die
 * Spam-Filter und Textclients lesen, und darf nie vom HTML abweichen.
 *
 * Die Palette ist die des Designsystems in Hex (E-Mail kann kein oklch):
 * heller Grund, weiße Karte, Violett als einziger Akzent, keine Pillen. Geist
 * lässt sich in Mails nicht laden, deshalb der Systemstapel; Menlo/SF Mono für
 * Links und Codes wie im Ticket-Template.
 *
 * Alles, was in einen Block kommt, wird hier escaped. Veranstalter-Text landet
 * als `p`-Block und ist damit im HTML genauso ungefährlich wie im Text.
 */

export const MAIL = {
  bg: "#f7f7fb",
  card: "#ffffff",
  line: "#e8e8ef",
  line2: "#ececf2",
  ink: "#1c1c2b",
  ink2: "#6d6d7f",
  ink3: "#8a8a99",
  ink4: "#9a9aa9",
  accent: "#7c3aed",
  accentInk: "#5b21b6",
  wash: "#f5f0fc",
  washLine: "#e6dcf7",
} as const;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',Menlo,Consolas,monospace";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escaped, mit Zeilenumbrüchen als <br/>; für Fließtext, auch fremden. */
function para(s: string): string {
  return esc(s).replace(/\r?\n/g, "<br/>");
}

export type Block =
  | { type: "p"; text: string; muted?: boolean }
  /** Eyebrow-Label über einem starken Wert, darunter leise Zusatzzeilen. */
  | { type: "meta"; label: string; value: string; sub?: string[] }
  | { type: "button"; label: string; url: string }
  /** Pfeil-Link in Akzentfarbe, z. B. „Zum Kalender hinzufügen →“. */
  | { type: "link"; label: string; url: string }
  | { type: "steps"; items: { title: string; text?: string; url?: string }[] }
  /**
   * Kennzahlen-Zeilen: großer Wert, Label, Zusatz; optional ein Balken (0–1)
   * und ein Link auf der Zeile. Für den Verkaufs-Digest und den Admin-Digest.
   */
  | { type: "stats"; items: { label: string; value: string; sub?: string; progress?: number; url?: string }[] }
  /** Fertiges HTML mit eigener Textfassung; nur für die Ticket-Zeilen. */
  | { type: "raw"; html: string; text: string };

export interface MailSpec {
  lang?: "de" | "en";
  /** Zeile über der Überschrift; Standard „Passly“. */
  eyebrow?: string;
  heading: string;
  /** Leise Zeile direkt unter der Überschrift. */
  intro?: string;
  sections: Block[][];
  footer: {
    /** Kleingedrucktes über der Impressumszeile (Grund der Mail, Hinweise). */
    notes?: string[];
    baseUrl: string;
    /** AGB-Link mit aufführen (Kaufbestätigung). */
    agb?: boolean;
    legalName: string;
    legalAddress: string;
  };
}

function renderBlockHtml(b: Block): string {
  switch (b.type) {
    case "p":
      return `<p style="margin:0 0 14px;font-size:${b.muted ? 13 : 15}px;line-height:1.6;color:${b.muted ? MAIL.ink2 : MAIL.ink};">${para(b.text)}</p>`;
    case "meta":
      return `<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MAIL.ink3};">${esc(b.label)}</p>
<p style="margin:0;font-size:18px;font-weight:700;color:${MAIL.ink};line-height:1.3;">${esc(b.value)}</p>
${(b.sub ?? []).map((s) => `<p style="margin:6px 0 0;font-size:13px;color:${MAIL.ink2};line-height:1.5;">${para(s)}</p>`).join("\n")}
<p style="margin:0 0 14px;"></p>`;
    case "button":
      return `<table cellpadding="0" cellspacing="0" style="margin:4px 0 14px;"><tr><td style="background:${MAIL.accent};border-radius:10px;">
<a href="${esc(b.url)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(b.label)}</a>
</td></tr></table>`;
    case "link":
      return `<p style="margin:0 0 14px;font-size:13px;"><a href="${esc(b.url)}" style="color:${MAIL.accent};font-weight:600;text-decoration:none;">${esc(b.label)} &rarr;</a></p>`;
    case "steps":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">${b.items.map((it, i) => `
<tr>
  <td valign="top" width="36" style="padding:0 0 16px;">
    <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:8px;background:${MAIL.wash};color:${MAIL.accentInk};font-size:13px;font-weight:700;">${i + 1}</span>
  </td>
  <td valign="top" style="padding:2px 0 16px;">
    <p style="margin:0;font-size:15px;font-weight:600;color:${MAIL.ink};line-height:1.4;">${esc(it.title)}</p>
    ${it.text ? `<p style="margin:4px 0 0;font-size:13px;color:${MAIL.ink2};line-height:1.55;">${para(it.text)}</p>` : ""}
    ${it.url ? `<p style="margin:6px 0 0;font-size:13px;"><a href="${esc(it.url)}" style="color:${MAIL.accent};font-weight:600;text-decoration:none;">${esc(it.url)}</a></p>` : ""}
  </td>
</tr>`).join("")}</table>`;
    case "stats":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">${b.items.map((it, i, all) => {
        const pct = it.progress === undefined ? null : Math.max(0, Math.min(100, Math.round(it.progress * 100)));
        const bar = pct === null ? "" : `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;background:${MAIL.line2};border-radius:3px;"><tr>
      ${pct > 0 ? `<td width="${pct}%" style="height:6px;background:${MAIL.accent};border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>` : ""}
      <td style="height:6px;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>`;
        const label = it.url
          ? `<a href="${esc(it.url)}" style="color:${MAIL.ink};text-decoration:none;">${esc(it.label)}</a>`
          : esc(it.label);
        return `
<tr><td style="padding:14px 0;${i < all.length - 1 ? `border-bottom:1px solid ${MAIL.line2};` : ""}">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="top"><p style="margin:0;font-size:15px;font-weight:600;color:${MAIL.ink};line-height:1.4;">${label}</p>
    ${it.sub ? `<p style="margin:3px 0 0;font-size:12px;color:${MAIL.ink3};line-height:1.5;">${esc(it.sub)}</p>` : ""}</td>
    <td valign="top" align="right" style="padding-left:16px;white-space:nowrap;"><p style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${MAIL.accentInk};line-height:1.2;">${esc(it.value)}</p></td>
  </tr></table>${bar}
</td></tr>`;
      }).join("")}</table>`;
    case "raw":
      return b.html;
  }
}

function renderBlockText(b: Block): string {
  switch (b.type) {
    case "p":
      return b.text;
    case "meta":
      return [`${b.label.toUpperCase()}: ${b.value}`, ...(b.sub ?? [])].join("\n");
    case "button":
    case "link":
      return `${b.label}: ${b.url}`;
    case "steps":
      return b.items.map((it, i) =>
        [`${i + 1}. ${it.title}`, it.text ? `   ${it.text.replace(/\n/g, "\n   ")}` : "", it.url ? `   ${it.url}` : ""]
          .filter(Boolean).join("\n"),
      ).join("\n\n");
    case "stats":
      return b.items.map((it) =>
        [`${it.label}: ${it.value}`, it.sub ? `  ${it.sub}` : "", it.url ? `  ${it.url}` : ""].filter(Boolean).join("\n"),
      ).join("\n");
    case "raw":
      return b.text;
  }
}

export function renderMail(spec: MailSpec): { html: string; text: string } {
  const { footer } = spec;
  const eyebrow = spec.eyebrow ?? "Passly";

  const sectionsHtml = spec.sections
    .filter((blocks) => blocks.length > 0)
    .map((blocks) => `
        <tr>
          <td style="padding:24px 40px 10px;border-bottom:1px solid ${MAIL.line2};">
            ${blocks.map(renderBlockHtml).join("\n")}
          </td>
        </tr>`)
    .join("");

  const notesHtml = (footer.notes ?? [])
    .map((n) => `<p style="margin:0 0 10px;font-size:11px;color:${MAIL.ink4};line-height:1.7;">${para(n)}</p>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="${spec.lang ?? "de"}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>${esc(spec.heading)}</title></head>
<body style="margin:0;padding:0;background:${MAIL.bg};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${MAIL.bg};">${esc(spec.intro ?? spec.heading)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${MAIL.bg};padding:48px 0;">
    <tr><td align="center" style="padding:0 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:${MAIL.card};border:1px solid ${MAIL.line};border-radius:14px;max-width:520px;width:100%;">

        <!-- Akzentlinie: ein Balken statt border-top, damit die Ecken rund bleiben -->
        <tr><td style="height:4px;background:${MAIL.accent};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header -->
        <tr>
          <td style="padding:30px 40px 24px;border-bottom:1px solid ${MAIL.line2};">
            <p style="margin:0 0 16px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${MAIL.accent};font-weight:700;">${esc(eyebrow)}</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${MAIL.ink};line-height:1.25;">${esc(spec.heading)}</h1>
            ${spec.intro ? `<p style="margin:8px 0 0;font-size:14px;color:${MAIL.ink2};line-height:1.5;">${para(spec.intro)}</p>` : ""}
          </td>
        </tr>
${sectionsHtml}

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 24px;">
            ${notesHtml}
            <p style="margin:${notesHtml ? 4 : 0}px 0 0;font-size:11px;color:${MAIL.ink4};line-height:1.7;">
              Passly · ${esc(footer.legalName)} · ${esc(footer.legalAddress)}<br/>
              <a href="${esc(footer.baseUrl)}/impressum" style="color:${MAIL.ink3};">Impressum</a> ·
              <a href="${esc(footer.baseUrl)}/datenschutz" style="color:${MAIL.ink3};">Datenschutz</a>${footer.agb ? ` ·
              <a href="${esc(footer.baseUrl)}/agb" style="color:${MAIL.ink3};">AGB</a>` : ""}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textSections = spec.sections
    .filter((blocks) => blocks.length > 0)
    .map((blocks) => blocks.map(renderBlockText).filter(Boolean).join("\n\n"));
  const text = [
    spec.heading,
    ...(spec.intro ? [spec.intro] : []),
    ...textSections,
    `--\n${[...(footer.notes ?? []), `Passly · ${footer.legalName} · ${footer.legalAddress}`].join("\n")}\nImpressum: ${footer.baseUrl}/impressum · Datenschutz: ${footer.baseUrl}/datenschutz${footer.agb ? ` · AGB: ${footer.baseUrl}/agb` : ""}`,
  ].join("\n\n");

  return { html, text };
}

/** Monospace-Link wie in den Ticket-Zeilen; für URLs, die man auch abtippen können soll. */
export function monoLink(url: string): string {
  return `<a href="${esc(url)}" style="font-family:${MONO};font-size:13px;color:${MAIL.accent};text-decoration:none;word-break:break-all;">${esc(url)}</a>`;
}
