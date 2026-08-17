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

// Bubblegum caps the on-chain metadata name at 32 BYTES (error 6012
// MetadataNameTooLong); long event names must be truncated UTF-8-safely
// (umlauts are 2 bytes). Display everywhere uses the DB / off-chain JSON,
// so only the on-chain field is shortened.
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
  const { eventName, eventDate, ownerWallet, baseUrl } = params;

  const metadataUri = params.metadataUri
    ?? `${baseUrl}/api/tickets/metadata?name=${encodeURIComponent(eventName)}&date=${encodeURIComponent(eventDate)}`;

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
      name: onChainName(eventName),
      symbol: "TOKN",
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
  const { badgeType, badgeName, ownerWallet, baseUrl } = params;

  const metadataUri = `${baseUrl}/api/badges/metadata?type=${encodeURIComponent(badgeType)}`;

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
      name: onChainName(badgeName),
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
