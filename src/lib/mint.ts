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
  findLeafAssetIdPda,
  fetchTreeConfigFromSeeds,
} from "@metaplex-foundation/mpl-bubblegum";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { getOperatorKeypair } from "@/lib/solana";

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

  // Read the tree's current leaf count before minting — the new leaf will get
  // index = numMinted, letting us compute the assetId without parsing the tx.
  const treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree: merkleTreePk });
  const leafIndex = Number(treeConfig.numMinted);

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

  const signatureBase58 = Buffer.from(signature).toString("base64");

  // Derive assetId from the leaf index we read before minting — deterministic,
  // no polling required.
  const [assetIdPda] = findLeafAssetIdPda(umi, { merkleTree: merkleTreePk, leafIndex });
  const assetId = assetIdPda.toString();

  return { assetId, signature: signatureBase58 };
}
