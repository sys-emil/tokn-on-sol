import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  createSignerFromKeypair,
  publicKey,
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
import { getOperatorKeypair } from "@/lib/solana";
import bs58 from "bs58";

const MERKLE_TREE = process.env.MERKLE_TREE_ADDRESS ?? "";
const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "";

export interface MintTicketParams {
  eventName: string;
  eventDate: string;
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

export async function mintTicket(params: MintTicketParams): Promise<MintTicketResult> {
  const { eventName, eventDate, ownerWallet, baseUrl } = params;

  if (!MERKLE_TREE) throw new Error("MERKLE_TREE_ADDRESS is not configured");
  if (!HELIUS_RPC) throw new Error("NEXT_PUBLIC_HELIUS_RPC_URL is not configured");

  const metadataUri = `${baseUrl}/api/tickets/metadata?name=${encodeURIComponent(eventName)}&date=${encodeURIComponent(eventDate)}`;

  const operatorKeypair = getOperatorKeypair();
  const umi = createUmi(HELIUS_RPC)
    .use(mplBubblegum())
    .use(mplTokenMetadata());

  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(operatorKeypair.secretKey);
  const operatorSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(keypairIdentity(umiKeypair));

  const merkleTreePk = publicKey(MERKLE_TREE);

  const builder = mintV1(umi, {
    leafOwner: publicKey(ownerWallet),
    leafDelegate: operatorSigner.publicKey,
    merkleTree: merkleTreePk,
    payer: operatorSigner,
    metadata: {
      name: eventName,
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

  const { signature } = await builder.sendAndConfirm(umi, {
    confirm: { commitment: "confirmed" },
  });

  // Parse the confirmed transaction to get the actual leaf index Bubblegum
  // assigned. This is authoritative — unlike reading numMinted before the mint,
  // it is never stale and is correct under concurrent mints to the same tree.
  const leaf = await parseLeafWithRetry(umi, signature);
  const leafIndex = Number(leaf.nonce);

  const [assetIdPda] = findLeafAssetIdPda(umi, { merkleTree: merkleTreePk, leafIndex });
  const assetId = assetIdPda.toString();
  const signatureEncoded = bs58.encode(signature);

  return { assetId, signature: signatureEncoded };
}
