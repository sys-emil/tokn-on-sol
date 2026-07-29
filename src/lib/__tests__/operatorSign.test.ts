import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { signEd25519 } from "@/lib/operatorSign";
import { backupChallenge } from "@/lib/backupChallenge";

/**
 * Guest tickets stand or fall on this: the server signs the ticket challenge
 * with the operator key, and /api/tickets/verify checks it with
 * `crypto.subtle.verify`. If those two ever disagree, every guest ticket is
 * rejected at the door. These tests pin the two together.
 */

/** Raw 32-byte seed + raw 32-byte public key from a fresh Ed25519 keypair. */
function freshKeypair(): { seed: Uint8Array; publicKey: Uint8Array } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  // PKCS#8 DER: the last 32 bytes are the seed; SPKI DER: the last 32 the key.
  const seed = new Uint8Array(privateKey.export({ format: "der", type: "pkcs8" })).slice(-32);
  const pub = new Uint8Array(publicKey.export({ format: "der", type: "spki" })).slice(-32);
  return { seed, publicKey: pub };
}

async function verifyWithSubtle(
  publicKey: Uint8Array,
  signature: Uint8Array,
  message: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    publicKey as Uint8Array<ArrayBuffer>,
    "Ed25519",
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "Ed25519",
    key,
    signature as Uint8Array<ArrayBuffer>,
    new TextEncoder().encode(message),
  );
}

describe("signEd25519", () => {
  it("produces a signature the verify route's crypto.subtle accepts", async () => {
    const { seed, publicKey } = freshKeypair();
    const message = backupChallenge("AssetIdXyz", null);

    const signature = signEd25519(seed, message);

    expect(signature).toHaveLength(64);
    await expect(verifyWithSubtle(publicKey, signature, message)).resolves.toBe(true);
  });

  it("signs the person-bound challenge distinctly from the bare one", async () => {
    const { seed, publicKey } = freshKeypair();
    const person = { firstName: "Alex", lastName: "Muster", birthDate: "1990-05-01" };
    const bound = backupChallenge("AssetIdXyz", person);

    const signature = signEd25519(seed, bound);

    await expect(verifyWithSubtle(publicKey, signature, bound)).resolves.toBe(true);
    // Stripping the identity must break the signature, otherwise a shared QR
    // could be edited to name someone else.
    await expect(
      verifyWithSubtle(publicKey, signature, backupChallenge("AssetIdXyz", null)),
    ).resolves.toBe(false);
  });

  it("rejects a seed of the wrong length instead of signing garbage", () => {
    expect(() => signEd25519(new Uint8Array(64), "hi")).toThrow(/32 bytes/);
  });
});
