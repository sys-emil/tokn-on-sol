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
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) throw new Error("HELIUS_API_KEY is not set");

  const operatorKeypair = getOperatorKeypair();

  const umi = createUmi(
    `https://devnet.helius-rpc.com/?api-key=${apiKey}`
  ).use(mplBubblegum());

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
    "Add this to your .env file:\n" +
      `MERKLE_TREE_ADDRESS=${merkleTree.publicKey.toString()}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
