import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { connection, getOperatorKeypair } from "@/lib/solana";

/**
 * Cost and health of the operator wallet that signs every mint.
 *
 * This lives in its own module because two very different callers need the
 * same numbers: `src/lib/mint.ts` sets the priority fee, and the admin balance
 * route plus the payout cron estimate how many mints the wallet can still pay
 * for. Keeping the constants in one place is what stops the estimate from
 * silently drifting away from what a mint actually costs — which is exactly
 * what happened before the priority fee existed.
 */

/**
 * Compute-unit ceiling requested per mint transaction.
 *
 * IMPORTANT: the priority fee is charged on the *requested* limit, not on the
 * units actually consumed, so this number is a direct cost multiplier. A
 * Bubblegum mint fits comfortably below it; raising it "to be safe" raises the
 * price of every single mint for no benefit.
 */
export const PRIORITY_CU_LIMIT = 250_000;

/** Solana's base signature fee; the floor under every transaction. */
export const BASE_TX_FEE_LAMPORTS = 5_000;

/** Below this the operator wallet should be topped up before it runs dry. */
export const LOW_BALANCE_LAMPORTS = 0.05 * LAMPORTS_PER_SOL;

/** Default priority fee. Overridable per environment for congested periods. */
const DEFAULT_PRIORITY_MICROLAMPORTS = 50_000;

/**
 * Price per compute unit, in micro-lamports. Without a priority fee a mint
 * carries only the base fee and can fail to land for minutes during mainnet
 * congestion — which the mint worker's retries mask slowly and eventually
 * turns into an automatic refund for a buyer whose ticket was fine.
 */
export function priorityFeeMicroLamports(): number {
  const raw = process.env.SOLANA_PRIORITY_FEE_MICROLAMPORTS;
  // Deliberately strict rather than parseInt: parseInt("1e5", 10) is 1, so a
  // plausible-looking typo would silently drop the priority fee to nothing and
  // reintroduce exactly the failure this constant exists to prevent. Same
  // digits-only guard the Stripe webhook uses for its fee metadata.
  if (!raw || !/^\d+$/.test(raw.trim())) return DEFAULT_PRIORITY_MICROLAMPORTS;
  return Number.parseInt(raw, 10);
}

/**
 * What one mint costs the operator wallet: base fee plus the priority fee
 * implied by the requested compute-unit limit. cNFT leaves need no rent (the
 * Merkle trees are pre-funded), so this is the whole marginal cost.
 */
export function lamportsPerMint(): number {
  const priority = Math.ceil((PRIORITY_CU_LIMIT * priorityFeeMicroLamports()) / 1_000_000);
  return BASE_TX_FEE_LAMPORTS + priority;
}

export type OperatorBalance = {
  address: string;
  lamports: number;
  sol: number;
  /** Conservative: uses the full per-mint cost including the priority fee. */
  estMintsRemaining: number;
  lamportsPerMint: number;
  low: boolean;
};

/**
 * Live balance of the operator wallet. Throws when the key is unconfigured or
 * the RPC is unreachable; callers decide whether that is fatal (admin route)
 * or merely worth logging (payout cron).
 */
export async function checkOperatorBalance(): Promise<OperatorBalance> {
  const address = getOperatorKeypair().publicKey;
  const lamports = await connection.getBalance(address);
  const perMint = lamportsPerMint();
  return {
    address: address.toBase58(),
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
    estMintsRemaining: Math.floor(lamports / perMint),
    lamportsPerMint: perMint,
    low: lamports < LOW_BALANCE_LAMPORTS,
  };
}
