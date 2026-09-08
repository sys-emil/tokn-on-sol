/**
 * Die generischen cNFT-Metadaten-URLs des minimalen Mints.
 *
 * Eigenes Modul und **bewusst ohne Abhaengigkeiten**: `mint.ts` braucht nur
 * diese zwei URLs, und `eventMetadata.ts` daneben legt beim Import einen
 * Supabase-Client an. Zoege `mint.ts` den herein, haenge auch der reine
 * Namenskuerzungs-Test (`mintName.test.ts`) an Supabase-Umgebungsvariablen —
 * ein Unit-Test, der eine Zeichenkette prueft, darf keine Clients bauen.
 *
 * Die URL wird gerechnet, nicht abgefragt: der Mint darf nicht daran haengen,
 * dass die Datei existiert. Fehlt sie, zeigt der on-chain gestampfte Link ins
 * Leere und Explorer stellen nichts dar — an Passly selbst bricht nichts, weil
 * Tuer, QR-Code und Ticketseite ihn nie lesen.
 *
 * Dass die hier gebaute Form mit dem uebereinstimmt, was Supabase selbst
 * ausliefert, prueft `npm run upload-generic-metadata` beim Hochladen und
 * bricht sonst ab. Ein Formfehler waere teuer: die URL steht danach dauerhaft
 * in jeder Mint-Transaktion.
 */

const BUCKET = "event-assets";

export const GENERIC_TICKET_METADATA_PATH = "metadata/passly-ticket.json";
export const GENERIC_BADGE_METADATA_PATH = "metadata/passly-badge.json";

export function genericMetadataUri(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}
