import { createPrivateKey, hkdfSync, sign as ed25519Sign } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Per-user Solana keys, derived rather than stored.
 *
 * A buyer's key does exactly two things in this system: it signs the rotating
 * QR challenge and the backup-ticket challenge. It never signs a transaction —
 * the operator signs every mint, and the operator's delegation is what lets
 * Passly move a ticket without the owner. Custody was therefore never really
 * elsewhere; it was only rented from a wallet vendor at per-user prices.
 *
 * Deriving the key from the user id removes the entire wallet lifecycle: there
 * is nothing to create, store, back up, recover or lose. Everything downstream
 * is untouched — `leafOwner`, `purchases.buyer_wallet`, the Helius ownership
 * check and the verify route all still see an ordinary Solana address and an
 * ordinary Ed25519 signature.
 *
 * SERVER ONLY. This module reads WALLET_MASTER_SEED; never import it from a
 * client component.
 */

/** Fixed HKDF salt. Domain separation only — it is not a secret. */
const SALT = Buffer.from("passly-wallet-derivation");

/**
 * DER header for a PKCS#8-wrapped raw Ed25519 seed. Node's WebCrypto refuses a
 * raw private key ("raw" is import-only for public keys), so the 32 seed bytes
 * are wrapped before `createPrivateKey` will take them.
 */
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function masterSeed(): Buffer {
  const raw = process.env.WALLET_MASTER_SEED;
  if (!raw) throw new Error("WALLET_MASTER_SEED is not set");
  if (!/^[0-9a-f]{64}$/i.test(raw)) {
    // Loud rather than lenient: a truncated or base58 seed would still derive
    // *some* address, just not the one every existing ticket was minted to.
    throw new Error("WALLET_MASTER_SEED must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(raw, "hex");
}

/**
 * The derivation input. Lower-cased because Postgres hands out lower-case
 * UUIDs but a caller might not — and a case difference here is not a typo, it
 * is a different wallet holding none of the user's tickets.
 */
function info(userId: string, keyVersion: number): string {
  const id = userId.trim().toLowerCase();
  if (!id) throw new Error("userId is required");
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error("keyVersion must be an integer >= 1");
  }
  return `passly-wallet-v${keyVersion}:${id}`;
}

function deriveKeypair(userId: string, keyVersion: number): Keypair {
  const seed = hkdfSync("sha256", masterSeed(), SALT, info(userId, keyVersion), 32);
  return Keypair.fromSeed(new Uint8Array(seed));
}

/**
 * The user's Solana address. Deterministic: same id and version always yield
 * the same address, on any machine, with no state anywhere.
 *
 * Callers should still read the address from `users.wallet_address` rather
 * than recompute it — the stored value is the authority, so a change in this
 * function can never silently repoint someone's tickets.
 */
export function deriveAddress(userId: string, keyVersion = 1): string {
  return deriveKeypair(userId, keyVersion).publicKey.toBase58();
}

/**
 * Sign a challenge as the user. Returns a base58 signature, the format the QR
 * payload and `/api/tickets/verify` already use.
 */
export function signAsUser(userId: string, keyVersion: number, message: Uint8Array): string {
  const keypair = deriveKeypair(userId, keyVersion);
  const seed = keypair.secretKey.slice(0, 32);
  const key = createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(seed)]),
    format: "der",
    type: "pkcs8",
  });
  // Ed25519 takes no separate digest; `null` is how Node spells that.
  return bs58.encode(ed25519Sign(null, Buffer.from(message), key));
}
