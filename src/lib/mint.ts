import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  createSignerFromKeypair,
  publicKey,
} from "@metaplex-foundation/umi";
import {
  mplBubblegum,
  mintV1,
  TokenProgramVersion,
  getLeafSchemaSerializer,
} from "@metaplex-foundation/mpl-bubblegum";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { getOperatorKeypair } from "@/lib/solana";
import { clusterApiUrl } from "@solana/web3.js";

const MERKLE_TREE = process.env.MERKLE_TREE_ADDRESS ?? "";

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

export async function mintTicket(params: MintTicketParams): Promise<MintTicketResult> {
  const { eventName, eventDate, ownerWallet, baseUrl } = params;

  if (!MERKLE_TREE) throw new Error("MERKLE_TREE_ADDRESS is not configured");

  const metadataUri = `${baseUrl}/api/tickets/metadata?name=${encodeURIComponent(eventName)}&date=${encodeURIComponent(eventDate)}`;

  const operatorKeypair = getOperatorKeypair();
  const umi = createUmi(clusterApiUrl("devnet"))
    .use(mplBubblegum())
    .use(mplTokenMetadata());

  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(operatorKeypair.secretKey);
  const operatorSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(keypairIdentity(umiKeypair));

  const builder = mintV1(umi, {
    leafOwner: publicKey(ownerWallet),
    leafDelegate: operatorSigner.publicKey,
    merkleTree: publicKey(MERKLE_TREE),
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

  const signatureBase58 = Buffer.from(signature).toString("base64");

  let assetId = "";
  let parseError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      const tx = await umi.rpc.getTransaction(signature, { commitment: "confirmed" });
      const innerIx = tx?.meta?.innerInstructions?.[0]?.instructions?.[0];
      if (!innerIx) {
        parseError = new Error("inner instruction not yet available");
        continue;
      }
      const [leaf] = getLeafSchemaSerializer().deserialize(innerIx.data.slice(8));
      assetId = leaf.id.toString();
      if (assetId) break;
    } catch (err) {
      parseError = err;
    }
  }

  if (!assetId) {
    const message = parseError instanceof Error ? parseError.message : "leaf parse failed";
    throw new Error(`Could not derive assetId from transaction: ${message}`);
  }

  return { assetId, signature: signatureBase58 };
}
