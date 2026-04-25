import { Keypair, Connection, clusterApiUrl } from "@solana/web3.js";

export const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

export function getOperatorKeypair(): Keypair {
  const raw = process.env.OPERATOR_PRIVATE_KEY;
  if (!raw) throw new Error("OPERATOR_PRIVATE_KEY is not set");
  const secretKey = Uint8Array.from(JSON.parse(raw) as number[]);
  return Keypair.fromSecretKey(secretKey);
}
