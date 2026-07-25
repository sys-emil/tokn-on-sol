import { NextRequest, NextResponse } from "next/server";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { connection, getOperatorKeypair, heliusRpcUrl } from "@/lib/solana";
import { fetchTreeCapacities, type TreeCapacity } from "@/lib/treeCapacity";

export const dynamic = "force-dynamic";

/**
 * Admin Solana-balance API: live SOL balance of the operator wallet that signs
 * every mint. Lets the admin see whether minting can still proceed. Gated by
 * ADMIN_SECRET via the x-admin-secret header, same pattern as the other
 * /api/admin/* routes.
 *
 * A compressed-NFT (Bubblegum) mint costs essentially just the base transaction
 * fee — the Merkle trees are pre-funded, so leaves need no rent. With no
 * priority fee in mint.ts, the marginal cost is the 5000-lamport base signature
 * fee. We use a slightly padded estimate so the "remaining mints" figure stays
 * conservative against occasional retries.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

// Padded estimate of the per-mint cost in lamports (base fee is 5000; the
// padding absorbs the odd retry / minor priority fee so the estimate errs low).
const LAMPORTS_PER_MINT = 7000;

// Below this the operator wallet should be topped up before it can run dry.
const LOW_BALANCE_LAMPORTS = 0.05 * LAMPORTS_PER_SOL;

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
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const [lamports, trees] = await Promise.all([
      connection.getBalance(getOperatorKeypair().publicKey),
      fetchTreeCapacities(),
    ]);
    const network: SolanaBalance["network"] = /devnet/i.test(heliusRpcUrl()) ? "devnet" : "mainnet";
    const ok = trees.filter((t) => !t.error);
    const treeCapacity = ok.reduce((s, t) => s + t.capacity, 0);
    const treeMinted = ok.reduce((s, t) => s + t.minted, 0);
    const payload: SolanaBalance = {
      address,
      lamports,
      sol: lamports / LAMPORTS_PER_SOL,
      network,
      estMintsRemaining: Math.floor(lamports / LAMPORTS_PER_MINT),
      lamportsPerMint: LAMPORTS_PER_MINT,
      low: lamports < LOW_BALANCE_LAMPORTS,
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
