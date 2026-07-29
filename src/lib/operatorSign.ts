import { createPrivateKey, sign as nodeSign } from "node:crypto";
import bs58 from "bs58";
import { getOperatorKeypair } from "@/lib/solana";

/**
 * Server-side Ed25519 signing with the operator key.
 *
 * Needed for guest tickets: a guest has no wallet, so nobody can produce the
 * rotating QR that `TicketClient.tsx` signs client-side. Instead the cNFT sits
 * in operator escrow and the operator signs the ticket's static backup
 * challenge here. The door already accepts that format (`b: 1`), so no change
 * to the verification path was needed.
 *
 * Node's crypto does Ed25519 natively, but only through a KeyObject, and it
 * wants PKCS#8 DER rather than the raw seed a Solana keypair carries. The
 * prefix below is the fixed RFC 8410 header for a 32-byte Ed25519 private key;
 * concatenated with the seed it forms a valid PKCS#8 document.
 */
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

/**
 * Signs `message` (UTF-8) with a raw 32-byte Ed25519 seed and returns the
 * 64-byte signature. Split out from `signAsOperator` so it can be unit-tested
 * against `crypto.subtle.verify` without needing the operator key.
 */
export function signEd25519(seed: Uint8Array, message: string): Uint8Array {
  if (seed.length !== 32) {
    throw new Error(`Ed25519 seed must be 32 bytes, got ${seed.length}`);
  }
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(seed)]);
  const key = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  return new Uint8Array(nodeSign(null, Buffer.from(message, "utf8"), key));
}

/** Base58 signature over `message`, made with the operator key. */
export function signAsOperator(message: string): string {
  // A Solana secret key is seed(32) || publicKey(32); Ed25519 wants the seed.
  const seed = getOperatorKeypair().secretKey.slice(0, 32);
  return bs58.encode(signEd25519(seed, message));
}
