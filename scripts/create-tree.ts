import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  generateSigner,
} from "@metaplex-foundation/umi";
import {
  mplBubblegum,
  createTree,
} from "@metaplex-foundation/mpl-bubblegum";
import { getOperatorKeypair } from "../src/lib/solana";

async function main() {
  // Network comes from NEXT_PUBLIC_HELIUS_RPC_URL (mainnet or devnet) — point
  // it at the target network before running. Cost on mainnet for this tree
  // size (depth 14 = 16,384 leaves, no canopy): roughly 0.1 SOL.
  const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_HELIUS_RPC_URL is not set");
  console.log(`Creating tree via ${rpcUrl.split("?")[0]}`);

  const operatorKeypair = getOperatorKeypair();

  const umi = createUmi(rpcUrl).use(mplBubblegum());

  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(
    operatorKeypair.secretKey
  );
  umi.use(keypairIdentity(umiKeypair));

  const merkleTree = generateSigner(umi);

  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
  });

  await builder.sendAndConfirm(umi, {
    confirm: { commitment: "confirmed" },
  });

  console.log("Merkle tree created:", merkleTree.publicKey.toString());
  console.log(
    "Add it to MERKLE_TREE_ADDRESSES (comma-separated, mints are spread across " +
      "all listed trees) or set it as the single MERKLE_TREE_ADDRESS:\n" +
      `MERKLE_TREE_ADDRESSES=${merkleTree.publicKey.toString()}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
