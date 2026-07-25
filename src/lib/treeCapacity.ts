import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import { fetchMerkleTree } from "@metaplex-foundation/spl-account-compression";
import { heliusRpcUrl, listMerkleTrees } from "@/lib/solana";

/**
 * Read the on-chain state of each configured Bubblegum Merkle tree to see how
 * much minting capacity is left. This is the *hard* ceiling on how many tickets
 * can still be minted — unlike the operator SOL balance, which only pays the tx
 * fee. Each tree stores up to 2^maxDepth leaves; the concurrent-merkle-tree
 * account's rightMostPath.index is the number of leaves already appended
 * (burns don't decrement it, so it only ever grows).
 */
export type TreeCapacity = {
  address: string;
  maxDepth: number;
  capacity: number;
  minted: number;
  remaining: number;
  /** Set when the account couldn't be read/deserialized (e.g. wrong address). */
  error?: string;
};

export async function fetchTreeCapacities(): Promise<TreeCapacity[]> {
  const addresses = listMerkleTrees();
  if (addresses.length === 0) return [];

  const umi = createUmi(heliusRpcUrl());

  return Promise.all(
    addresses.map(async (address): Promise<TreeCapacity> => {
      try {
        const tree = await fetchMerkleTree(umi, publicKey(address));
        const maxDepth = tree.treeHeader.maxDepth;
        const capacity = 2 ** maxDepth;
        const minted = Number(tree.tree.rightMostPath.index);
        return { address, maxDepth, capacity, minted, remaining: Math.max(0, capacity - minted) };
      } catch (err) {
        return {
          address,
          maxDepth: 0,
          capacity: 0,
          minted: 0,
          remaining: 0,
          error: err instanceof Error ? err.message : "Tree konnte nicht gelesen werden.",
        };
      }
    }),
  );
}
