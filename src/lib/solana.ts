import { Keypair, Connection } from "@solana/web3.js";

// Single source of truth for the Solana network. NEXT_PUBLIC_HELIUS_RPC_URL
// decides devnet vs mainnet; no other file may hardcode an RPC host, so the
// network switch is purely an env-var change.
export function heliusRpcUrl(): string {
  const url = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (url) return url;
  const key = process.env.HELIUS_API_KEY ?? "";
  return `https://devnet.helius-rpc.com/?api-key=${key}`;
}

export const connection = new Connection(heliusRpcUrl(), "confirmed");

export function getOperatorKeypair(): Keypair {
  const raw = process.env.OPERATOR_PRIVATE_KEY;
  if (!raw) throw new Error("OPERATOR_PRIVATE_KEY is not set");
  const secretKey = Uint8Array.from(JSON.parse(raw) as number[]);
  return Keypair.fromSecretKey(secretKey);
}

// Merkle trees: MERKLE_TREE_ADDRESSES (comma-separated) with round-robin-by-
// random pick spreads concurrent mints across trees so their transactions
// don't conflict. Falls back to the single legacy MERKLE_TREE_ADDRESS.
export function pickMerkleTree(): string {
  const list = (process.env.MERKLE_TREE_ADDRESSES ?? process.env.MERKLE_TREE_ADDRESS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) throw new Error("MERKLE_TREE_ADDRESSES / MERKLE_TREE_ADDRESS is not configured");
  return list[Math.floor(Math.random() * list.length)];
}
