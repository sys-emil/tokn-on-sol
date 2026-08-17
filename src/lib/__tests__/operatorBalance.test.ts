import { afterEach, describe, expect, it } from "vitest";
import {
  BASE_TX_FEE_LAMPORTS,
  PRIORITY_CU_LIMIT,
  lamportsPerMint,
  priorityFeeMicroLamports,
} from "@/lib/operatorBalance";

const ENV_KEY = "SOLANA_PRIORITY_FEE_MICROLAMPORTS";

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("priorityFeeMicroLamports", () => {
  it("falls back to the default when unset", () => {
    expect(priorityFeeMicroLamports()).toBe(50_000);
  });

  it("honours a valid override", () => {
    process.env[ENV_KEY] = "120000";
    expect(priorityFeeMicroLamports()).toBe(120_000);
  });

  it("allows switching the priority fee off entirely", () => {
    process.env[ENV_KEY] = "0";
    expect(priorityFeeMicroLamports()).toBe(0);
  });

  // A malformed value must never make a mint free (and therefore unlandable)
  // or, worse, NaN its way into the transaction.
  it.each(["", "abc", "-1", "1e5x"])("ignores the unusable value %o", (value) => {
    process.env[ENV_KEY] = value;
    expect(priorityFeeMicroLamports()).toBe(50_000);
  });
});

describe("lamportsPerMint", () => {
  it("is the base fee plus the priority fee implied by the CU limit", () => {
    // 250_000 CU × 50_000 µLamports / 1e6 = 12_500 lamports
    expect(lamportsPerMint()).toBe(BASE_TX_FEE_LAMPORTS + 12_500);
  });

  it("collapses to the bare base fee when the priority fee is off", () => {
    process.env[ENV_KEY] = "0";
    expect(lamportsPerMint()).toBe(BASE_TX_FEE_LAMPORTS);
  });

  // The whole point of the constant: the fee scales with the *requested* CU
  // limit, so raising the limit raises the price of every mint.
  it("scales linearly with the configured fee", () => {
    process.env[ENV_KEY] = "100000";
    const doubled = lamportsPerMint() - BASE_TX_FEE_LAMPORTS;
    process.env[ENV_KEY] = "50000";
    const single = lamportsPerMint() - BASE_TX_FEE_LAMPORTS;
    expect(doubled).toBe(single * 2);
  });

  it("keeps the estimate above the base fee for any sane configuration", () => {
    expect(lamportsPerMint()).toBeGreaterThanOrEqual(BASE_TX_FEE_LAMPORTS);
    expect(PRIORITY_CU_LIMIT).toBeGreaterThan(0);
  });
});
