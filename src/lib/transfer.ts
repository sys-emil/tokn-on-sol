import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, createSignerFromKeypair, publicKey, type Context } from "@metaplex-foundation/umi";
import { mplBubblegum, getAssetWithProof, transfer } from "@metaplex-foundation/mpl-bubblegum";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { dasApi, type DasApiInterface } from "@metaplex-foundation/digital-asset-standard-api";
import { getOperatorKeypair } from "@/lib/solana";

function getHeliusRpc(): string {
  const key = process.env.HELIUS_API_KEY ?? "";
  return `https://devnet.helius-rpc.com/?api-key=${key}`;
}

function buildUmi() {
  const operatorKeypair = getOperatorKeypair();
  const umi = createUmi(getHeliusRpc())
    .use(mplBubblegum())
    .use(mplTokenMetadata())
    .use(dasApi());

  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(operatorKeypair.secretKey);
  const operatorSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(keypairIdentity(umiKeypair));
  return { umi, operatorSigner };
}

export function getOperatorWalletAddress(): string {
  return getOperatorKeypair().publicKey.toBase58();
}

export async function transferCnft(args: {
  assetId: string;
  fromWallet: string;
  toWallet: string;
}): Promise<{ signature: string }> {
  const { assetId, fromWallet, toWallet } = args;
  const { umi, operatorSigner } = buildUmi();

  const umiWithDas = umi as unknown as Pick<Context, "rpc"> & { rpc: DasApiInterface };
  const asset = await getAssetWithProof(umiWithDas, publicKey(assetId));

  const operatorAddress = getOperatorKeypair().publicKey.toBase58();
  const fromIsOperator = fromWallet === operatorAddress;

  const { signature } = await transfer(umi, {
    ...asset,
    // When the operator is the current owner, it signs as leafOwner (Signer).
    // When the buyer is the owner, operator signs as leafDelegate (Signer).
    leafOwner: fromIsOperator ? operatorSigner : publicKey(fromWallet),
    leafDelegate: operatorSigner,
    newLeafOwner: publicKey(toWallet),
  }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

  return { signature: Buffer.from(signature).toString("base64") };
}
