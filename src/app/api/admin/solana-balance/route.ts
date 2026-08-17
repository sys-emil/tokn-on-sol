import { NextRequest, NextResponse } from "next/server";
import { getOperatorKeypair, heliusRpcUrl } from "@/lib/solana";
import { checkOperatorBalance } from "@/lib/operatorBalance";
import { fetchTreeCapacities, type TreeCapacity } from "@/lib/treeCapacity";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/**
 * Admin Solana-balance API: live SOL balance of the operator wallet that signs
 * every mint. Lets the admin see whether minting can still proceed. Gated by
 * ADMIN_SECRET via the x-admin-secret header, same pattern as the other
 * /api/admin/* routes.
 *
 * A compressed-NFT (Bubblegum) mint costs the base transaction fee plus the
 * priority fee — the Merkle trees are pre-funded, so leaves need no rent. Both
 * numbers come from src/lib/operatorBalance.ts, the same module mint.ts reads
 * when it sets the fee, so this estimate can never drift away from what a mint
 * actually costs.
 */

export type SolanaBalance = {
  address: string;
  lamports: number;
  sol: number;
  network: "devnet" | "mainnet";
  estMintsRemaining: number;
  lamportsPerMint: number;
  low: boolean;
  /** On-chain Merkle-tree capacity — the hard ceiling on mintable tickets. */
  trees: TreeCapacity[];
  treeCapacity: number;
  treeMinted: number;
  treeRemaining: number;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let address: string;
  try {
    address = getOperatorKeypair().publicKey.toBase58();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Operator-Wallet nicht konfiguriert." },
      { status: 500 },
    );
  }

  try {
    const [balance, trees] = await Promise.all([
      checkOperatorBalance(),
      fetchTreeCapacities(),
    ]);
    const network: SolanaBalance["network"] = /devnet/i.test(heliusRpcUrl()) ? "devnet" : "mainnet";
    const ok = trees.filter((t) => !t.error);
    const treeCapacity = ok.reduce((s, t) => s + t.capacity, 0);
    const treeMinted = ok.reduce((s, t) => s + t.minted, 0);
    const payload: SolanaBalance = {
      address,
      lamports: balance.lamports,
      sol: balance.sol,
      network,
      estMintsRemaining: balance.estMintsRemaining,
      lamportsPerMint: balance.lamportsPerMint,
      low: balance.low,
      trees,
      treeCapacity,
      treeMinted,
      treeRemaining: Math.max(0, treeCapacity - treeMinted),
    };
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Balance konnte nicht geladen werden." },
      { status: 502 },
    );
  }
}
