import { beforeAll, describe, expect, it } from "vitest";
import bs58 from "bs58";
import { backupChallenge } from "@/lib/backupChallenge";
import { deriveAddress, signAsUser } from "@/lib/wallet";

const SEED_A = "11".repeat(32);
const SEED_B = "22".repeat(32);

const ALICE = "3f2b1c8e-9a4d-4e77-8b21-0c5d6e7f8a90";
const BOB = "7d4e5f60-1a2b-4c3d-9e8f-0a1b2c3d4e5f";
const ASSET = "GkT9uY2mQ1rP7wX4vN6cB8dF3sH5jK0lZaEeRtYuIoPq";

beforeAll(() => {
  process.env.WALLET_MASTER_SEED = SEED_A;
});

/**
 * The verification half of `/api/tickets/verify`, replicated byte for byte
 * (route.ts steps 3). This is the whole point of the derivation: if these
 * assertions pass, the route needs no change at all.
 */
async function verifyLikeTheDoorman(
  address: string,
  signatureBase58: string,
  challenge: string,
): Promise<boolean> {
  const pubkeyBytes = Uint8Array.from(bs58.decode(address));
  const sigBytes = Uint8Array.from(bs58.decode(signatureBase58));
  const key = await crypto.subtle.importKey("raw", pubkeyBytes, "Ed25519", false, ["verify"]);
  return crypto.subtle.verify("Ed25519", key, sigBytes, new TextEncoder().encode(challenge));
}

describe("deriveAddress", () => {
  it("is deterministic for the same user and version", () => {
    expect(deriveAddress(ALICE)).toBe(deriveAddress(ALICE));
  });

  it("gives different users different addresses", () => {
    expect(deriveAddress(ALICE)).not.toBe(deriveAddress(BOB));
  });

  it("gives a different address per key version, so a seed rotation is possible", () => {
    expect(deriveAddress(ALICE, 1)).not.toBe(deriveAddress(ALICE, 2));
  });

  it("ignores casing and surrounding space in the user id", () => {
    expect(deriveAddress(ALICE.toUpperCase())).toBe(deriveAddress(ALICE));
    expect(deriveAddress(`  ${ALICE}  `)).toBe(deriveAddress(ALICE));
  });

  it("produces a 32-byte base58 Solana address", () => {
    expect(bs58.decode(deriveAddress(ALICE))).toHaveLength(32);
  });

  it("changes completely with the master seed", () => {
    const withA = deriveAddress(ALICE);
    process.env.WALLET_MASTER_SEED = SEED_B;
    const withB = deriveAddress(ALICE);
    process.env.WALLET_MASTER_SEED = SEED_A;
    expect(withB).not.toBe(withA);
  });

  it("refuses a missing or malformed seed instead of deriving the wrong wallet", () => {
    delete process.env.WALLET_MASTER_SEED;
    expect(() => deriveAddress(ALICE)).toThrow(/not set/);
    process.env.WALLET_MASTER_SEED = "abc";
    expect(() => deriveAddress(ALICE)).toThrow(/64 hex/);
    process.env.WALLET_MASTER_SEED = SEED_A;
  });

  it("rejects an empty user id and a nonsense key version", () => {
    expect(() => deriveAddress("   ")).toThrow(/userId/);
    expect(() => deriveAddress(ALICE, 0)).toThrow(/keyVersion/);
    expect(() => deriveAddress(ALICE, 1.5)).toThrow(/keyVersion/);
  });
});

describe("signAsUser against the unchanged verify route", () => {
  it("passes the doorman's Ed25519 check for the rotating QR challenge", async () => {
    const t = Math.floor(Date.now() / 60000);
    const challenge = `passly:verify:${ASSET}:${t}`;
    const address = deriveAddress(ALICE);
    const signature = signAsUser(ALICE, 1, new TextEncoder().encode(challenge));

    await expect(verifyLikeTheDoorman(address, signature, challenge)).resolves.toBe(true);
  });

  it("passes it for the person-bound backup-ticket challenge", async () => {
    const person = { firstName: "Lena", lastName: "Brandt", birthDate: "1998-04-12" };
    const challenge = backupChallenge(ASSET, person);
    const address = deriveAddress(ALICE);
    const signature = signAsUser(ALICE, 1, new TextEncoder().encode(challenge));

    await expect(verifyLikeTheDoorman(address, signature, challenge)).resolves.toBe(true);
  });

  it("fails for the next minute, so the 60-second window still bites", async () => {
    const t = Math.floor(Date.now() / 60000);
    const address = deriveAddress(ALICE);
    const signature = signAsUser(ALICE, 1, new TextEncoder().encode(`passly:verify:${ASSET}:${t}`));

    await expect(
      verifyLikeTheDoorman(address, signature, `passly:verify:${ASSET}:${t + 2}`),
    ).resolves.toBe(false);
  });

  it("fails when another user signed the same challenge", async () => {
    const t = Math.floor(Date.now() / 60000);
    const challenge = `passly:verify:${ASSET}:${t}`;
    const signature = signAsUser(BOB, 1, new TextEncoder().encode(challenge));

    await expect(verifyLikeTheDoorman(deriveAddress(ALICE), signature, challenge)).resolves.toBe(false);
  });

  it("fails when the signature came from a different key version", async () => {
    const t = Math.floor(Date.now() / 60000);
    const challenge = `passly:verify:${ASSET}:${t}`;
    const signature = signAsUser(ALICE, 2, new TextEncoder().encode(challenge));

    await expect(verifyLikeTheDoorman(deriveAddress(ALICE, 1), signature, challenge)).resolves.toBe(false);
  });
});
