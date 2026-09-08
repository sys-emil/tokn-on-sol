import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
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
 * **Eigenstaendig, wie `create-tree.ts`:** es baut seinen eigenen
 * Supabase-Client, statt `src/lib/eventMetadata.ts` zu importieren. Grund:
 * ts-node loest die `@/`-Pfadaliase aus der tsconfig zur Laufzeit nicht auf,
 * und `eventMetadata.ts` importiert `@/lib/supabase`. Ein Skript, das die
 * Alias-Kette anfasst, stirbt mit MODULE_NOT_FOUND.
 *
 * Geprueft wird ausserdem, dass die von `genericMetadataUri` **gerechnete**
 * URL exakt der entspricht, die Supabase selbst ausliefert. Genau die
 * gerechnete Form landet beim Mint dauerhaft in der Kette; ein Formfehler
 * waere hinterher nicht mehr zu korrigieren.
 */

// .env.local hat Vorrang, wie bei Next.js: die echten Werte stehen dort, das
// veraltete .env fuellt nur Luecken.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const BUCKET = "event-assets";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL ist nicht gesetzt");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt");

  const siteUrl = process.env.APP_URL ?? "https://getpassly.de";
  if (siteUrl.includes("localhost")) {
    throw new Error(
      `APP_URL zeigt auf ${siteUrl}. Die Datei landet oeffentlich und wuerde ein ` +
        "Bild von localhost verlinken. APP_URL setzen und erneut ausfuehren.",
    );
  }

  console.log(`Projekt:     ${url}`);
  console.log(`Bildverweis: ${siteUrl}/icon-512.png\n`);

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const files = [
    {
      path: GENERIC_TICKET_METADATA_PATH,
      body: {
        name: "Passly Ticket",
        symbol: "PSLY",
        description:
          "Digitales Ticket von Passly. Zu welcher Veranstaltung es gehoert, sieht nur der Inhaber in seinem Passly-Konto.",
        image: `${siteUrl}/icon-512.png`,
        attributes: [{ trait_type: "Typ", value: "Ticket" }],
      },
    },
    {
      path: GENERIC_BADGE_METADATA_PATH,
      body: {
        name: "Passly Abzeichen",
        symbol: "BADG",
        description:
          "Abzeichen von Passly. Wofuer es vergeben wurde, sieht nur der Inhaber in seinem Passly-Konto.",
        image: `${siteUrl}/icon-512.png`,
        attributes: [{ trait_type: "Typ", value: "Abzeichen" }],
      },
    },
  ];

  for (const file of files) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(file.path, JSON.stringify(file.body), {
        contentType: "application/json",
        cacheControl: "300",
        upsert: true,
      });
    if (error) throw new Error(`Upload von ${file.path} fehlgeschlagen: ${error.message}`);

    const served = supabase.storage.from(BUCKET).getPublicUrl(file.path).data.publicUrl;
    const stamped = genericMetadataUri(file.path);

    if (served !== stamped) {
      throw new Error(
        `URL-Form weicht ab.\n` +
          `  Supabase liefert: ${served}\n` +
          `  Mint stampft:     ${stamped}\n` +
          `Nicht minten, bevor das uebereinstimmt — die gestampfte URL ist dauerhaft.`,
      );
    }

    console.log(`hochgeladen  ${file.path}`);
    console.log(`             ${served}`);
  }

  console.log("\nForm stimmt mit dem ueberein, was der Mint stampft.");
  console.log("Erreichbarkeit pruefen:");
  for (const file of files) {
    console.log(`  curl -s ${genericMetadataUri(file.path)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
