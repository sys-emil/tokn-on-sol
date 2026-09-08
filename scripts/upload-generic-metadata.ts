import { uploadGenericMetadata } from "../src/lib/eventMetadata";
import {
  genericMetadataUri,
  GENERIC_TICKET_METADATA_PATH,
  GENERIC_BADGE_METADATA_PATH,
} from "../src/lib/genericMetadata";

/**
 * Legt die beiden generischen cNFT-Metadaten-Dateien im oeffentlichen Bucket
 * ab, auf die seit dem minimalen Mint jedes Ticket und jedes Abzeichen zeigt
 * (Begruendung in `src/lib/mint.ts`).
 *
 * Einmalig auszufuehren, danach nur noch, wenn sich Text oder Bild aendern
 * sollen — die Dateien sind aenderbar, die on-chain gestampfte URL nicht. Das
 * Skript ist idempotent (upsert), ein zweiter Lauf schadet nicht.
 *
 * Es prueft ausserdem, dass die von `genericMetadataUri` gerechnete URL exakt
 * der entspricht, die Supabase selbst ausliefert. Genau diese gerechnete Form
 * landet beim Mint dauerhaft in der Kette; ein Formfehler waere hinterher
 * nicht mehr zu korrigieren.
 */
async function main() {
  const siteUrl =
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  console.log(`Bild-Verweis zeigt auf ${siteUrl}/icon-512.png`);

  const uploaded = await uploadGenericMetadata(siteUrl);

  const expected = {
    ticket: genericMetadataUri(GENERIC_TICKET_METADATA_PATH),
    badge: genericMetadataUri(GENERIC_BADGE_METADATA_PATH),
  };

  for (const key of ["ticket", "badge"] as const) {
    if (uploaded[key] !== expected[key]) {
      throw new Error(
        `URL-Form weicht ab (${key}).\n` +
          `  Supabase liefert: ${uploaded[key]}\n` +
          `  Mint stampft:     ${expected[key]}\n` +
          `Nicht minten, bevor das uebereinstimmt — die gestampfte URL ist dauerhaft.`,
      );
    }
  }

  console.log("Ticket-Metadaten:  ", uploaded.ticket);
  console.log("Abzeichen-Metadaten:", uploaded.badge);
  console.log("\nForm stimmt mit dem ueberein, was der Mint stampft. Erreichbarkeit pruefen:");
  console.log(`  curl -s ${uploaded.ticket}`);
  console.log(`  curl -s ${uploaded.badge}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
