import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  createSignerFromKeypair,
  publicKey,
  type TransactionBuilder,
  type TransactionSignature,
  type Umi,
} from "@metaplex-foundation/umi";
import {
  mplBubblegum,
  mintV1,
  TokenProgramVersion,
  findLeafAssetIdPda,
  parseLeafFromMintV1Transaction,
} from "@metaplex-foundation/mpl-bubblegum";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { setComputeUnitLimit, setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { getOperatorKeypair, pickMerkleTree, heliusRpcUrl } from "@/lib/solana";
import {
  PRIORITY_CU_LIMIT,
  priorityFeeMicroLamports,
} from "@/lib/operatorBalance";
import {
  genericMetadataUri,
  GENERIC_TICKET_METADATA_PATH,
  GENERIC_BADGE_METADATA_PATH,
} from "@/lib/genericMetadata";
import bs58 from "bs58";

export interface MintTicketParams {
  eventName: string;
  eventDate: string;
  ownerWallet: string;
  baseUrl: string;
  /** Static per-event metadata JSON (Supabase Storage). Falls back to the legacy dynamic route when absent (pre-existing events). */
  metadataUri?: string | null;
}

export interface MintBadgeParams {
  badgeType: string;
  badgeName: string;
  ownerWallet: string;
  baseUrl: string;
}

export interface MintTicketResult {
  assetId: string;
  signature: string;
}

// Parse the confirmed transaction to get the actual leaf index assigned by
// Bubblegum. The RPC may not surface the tx immediately after confirmation
// (read-replica lag), so we retry for up to ~22s before giving up.
async function parseLeafWithRetry(umi: Umi, signature: TransactionSignature) {
  const MAX_ATTEMPTS = 15;
  let lastError: unknown;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      return await parseLeafFromMintV1Transaction(umi, signature);
    } catch (err) {
      lastError = err;
    }
  }
  const sig = bs58.encode(signature);
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Could not parse leaf from tx ${sig} after ${MAX_ATTEMPTS} attempts: ${msg}`);
}

/**
 * **Minimaler Mint (seit 2026-09-08).**
 *
 * `name` und `uri` sind die beiden inhaltlichen Felder, die dauerhaft und
 * oeffentlich in der Mint-Transaktion stehen. Frueher trugen sie den
 * Eventnamen und eine URL mit der Event-ID im Pfad. Weil alle Tickets und
 * Abzeichen einer Person unter derselben pseudonymen Adresse liegen und diese
 * Adresse im QR-Code des Tickets steht, konnte jeder, der einmal ein Ticket
 * abfotografiert hatte, die **vollstaendige Besuchshistorie** dieser Person
 * mit Datum und Ort nachschlagen — unloeschbar.
 *
 * Der Eventname on-chain war dabei fuer niemanden ein Gewinn: Passly-Nutzer
 * haben keine Wallet-App (abgeleitete Schluessel, keine Seed Phrase, nichts zu
 * importieren), und jede Passly-Oberflaeche liest zuerst die Datenbank. Genau
 * eine Stelle im Projekt liest ueberhaupt On-Chain-Metadaten
 * (`/tickets/[assetId]`), und dort erst als dritter Fallback.
 *
 * Sichtbar bleibt damit, **wie viele** Passly-Assets eine Adresse haelt — das
 * laesst sich nicht verbergen, weil `numMinted` auf dem Merkle-Baum steht.
 * Unsichtbar wird, **welche**.
 *
 * Nicht angetastet, weil daran echte Funktion haengt: `creators` (Zaehlbarkeit
 * aendert sich dadurch ohnehin nicht, die Baum-Autoritaet zaehlt weiter) und
 * die Nicht-Leere der Felder — `getAssetWithProof` in `transfer.ts` (Teilen,
 * Neuausstellung) braucht ein sauber indiziertes Asset, und ein leerer `uri`
 * ist der Fall, bei dem Indexer unberechenbar werden.
 *
 * **Wirkt nur nach vorn.** Vor diesem Datum geminteten Assets ist nicht mehr
 * beizukommen. Zurueckdrehen heisst: die zwei Konstanten unten wieder durch
 * `onChainName(eventName)` und `params.metadataUri` ersetzen.
 */
const GENERIC_TICKET_NAME = "Passly Ticket";
const GENERIC_BADGE_NAME = "Passly Abzeichen";

// Bubblegum caps the on-chain metadata name at 32 BYTES (error 6012
// MetadataNameTooLong); long event names must be truncated UTF-8-safely
// (umlauts are 2 bytes). Seit dem minimalen Mint steht dort ein konstanter
// Name, der die Grenze sicher einhaelt; die Funktion bleibt fuer den
// Rueckweg und ihren Test.
const MAX_ONCHAIN_NAME_BYTES = 32;
const utf8 = new TextEncoder();

export function onChainName(name: string): string {
  if (utf8.encode(name).length <= MAX_ONCHAIN_NAME_BYTES) return name;
  let out = "";
  for (const ch of name) {
    if (utf8.encode(out + ch + "…").length > MAX_ONCHAIN_NAME_BYTES) break;
    out += ch;
  }
  return out.trimEnd() + "…";
}

export async function mintTicket(params: MintTicketParams): Promise<MintTicketResult> {
  // Bewusst werden nur `ownerWallet` gelesen: `eventName`, `eventDate`,
  // `baseUrl` und `metadataUri` bleiben in der Signatur, damit die vier
  // Aufrufer (Mint-Worker, Gast-Claim, Rueckgabe-Neumint, Admin-Mint)
  // unveraendert bleiben und das Zurueckdrehen zwei Zeilen ist.
  const { ownerWallet } = params;

  const metadataUri = genericMetadataUri(GENERIC_TICKET_METADATA_PATH);

  const operatorKeypair = getOperatorKeypair();
  const umi = createUmi(heliusRpcUrl())
    .use(mplBubblegum())
    .use(mplTokenMetadata());

  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(operatorKeypair.secretKey);
  const operatorSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(keypairIdentity(umiKeypair));

  const merkleTreePk = publicKey(pickMerkleTree());

  const builder = mintV1(umi, {
    leafOwner: publicKey(ownerWallet),
    leafDelegate: operatorSigner.publicKey,
    merkleTree: merkleTreePk,
    payer: operatorSigner,
    metadata: {
      name: GENERIC_TICKET_NAME,
      symbol: "PSLY",
      uri: metadataUri,
      sellerFeeBasisPoints: 0,
      collection: null,
      creators: [{ address: operatorSigner.publicKey, verified: true, share: 100 }],
      isMutable: true,
      primarySaleHappened: false,
      editionNonce: 0,
      uses: null,
      tokenProgramVersion: TokenProgramVersion.Original,
      tokenStandard: null,
    },
  });

  const { signature } = await withPriorityFee(umi, builder).sendAndConfirm(umi, {
    confirm: { commitment: "confirmed" },
  });

  // Parse the confirmed transaction to get the actual leaf index Bubblegum
  // assigned. This is authoritative; unlike reading numMinted before the mint,
  // it is never stale and is correct under concurrent mints to the same tree.
  const leaf = await parseLeafWithRetry(umi, signature);
  const leafIndex = Number(leaf.nonce);

  const [assetIdPda] = findLeafAssetIdPda(umi, { merkleTree: merkleTreePk, leafIndex });
  const assetId = assetIdPda.toString();
  const signatureEncoded = bs58.encode(signature);

  return { assetId, signature: signatureEncoded };
}

export async function mintBadge(params: MintBadgeParams): Promise<MintTicketResult> {
  // Wie bei mintTicket: `badgeType`, `badgeName` und `baseUrl` bleiben in der
  // Signatur, werden aber nicht mehr gestampft. Der alte `?type=`-Parameter
  // haette sonst genau das verraten, was der minimale Mint verbergen soll.
  const { ownerWallet } = params;

  const metadataUri = genericMetadataUri(GENERIC_BADGE_METADATA_PATH);

  const operatorKeypair = getOperatorKeypair();
  const umi = createUmi(heliusRpcUrl())
    .use(mplBubblegum())
    .use(mplTokenMetadata());

  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(operatorKeypair.secretKey);
  const operatorSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(keypairIdentity(umiKeypair));

  const merkleTreePk = publicKey(pickMerkleTree());

  const builder = mintV1(umi, {
    leafOwner: publicKey(ownerWallet),
    leafDelegate: operatorSigner.publicKey,
    merkleTree: merkleTreePk,
    payer: operatorSigner,
    metadata: {
      name: GENERIC_BADGE_NAME,
      symbol: "BADG",
      uri: metadataUri,
      sellerFeeBasisPoints: 0,
      collection: null,
      creators: [{ address: operatorSigner.publicKey, verified: true, share: 100 }],
      isMutable: false,
      primarySaleHappened: false,
      editionNonce: 0,
      uses: null,
      tokenProgramVersion: TokenProgramVersion.Original,
      tokenStandard: null,
    },
  });

  const { signature } = await withPriorityFee(umi, builder).sendAndConfirm(umi, {
    confirm: { commitment: "confirmed" },
  });

  const leaf = await parseLeafWithRetry(umi, signature);
  const leafIndex = Number(leaf.nonce);
  const [assetIdPda] = findLeafAssetIdPda(umi, { merkleTree: merkleTreePk, leafIndex });
  const assetId = assetIdPda.toString();
  const signatureEncoded = bs58.encode(signature);

  return { assetId, signature: signatureEncoded };
}

/**
 * Prepend the ComputeBudget instructions to a mint. Without them a transaction
 * carries only the base signature fee, and during mainnet congestion it can
 * fail to land repeatedly — which the worker's retries hide slowly before
 * auto-refunding a buyer whose ticket was never actually a problem.
 *
 * See `src/lib/operatorBalance.ts` for why the CU limit is a cost multiplier.
 */
function withPriorityFee(umi: Umi, builder: TransactionBuilder): TransactionBuilder {
  return setComputeUnitLimit(umi, { units: PRIORITY_CU_LIMIT })
    .add(setComputeUnitPrice(umi, { microLamports: priorityFeeMicroLamports() }))
    .add(builder);
}
