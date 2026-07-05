import { PrivyClient } from "@privy-io/server-auth";
import type { NextRequest } from "next/server";

let client: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!client) {
    client = new PrivyClient(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
      process.env.PRIVY_APP_SECRET!,
    );
  }
  return client;
}

/**
 * Verify that the request carries a valid Privy auth token AND that the given
 * wallet address belongs to that Privy user. This is the gate for all writing
 * organizer routes — a wallet address in the request body is meaningless on
 * its own, anyone can send one.
 */
export async function requestOwnsWallet(req: NextRequest, walletAddress: string): Promise<boolean> {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken || !walletAddress) return false;

  try {
    const privy = getPrivyClient();
    const verified = await privy.verifyAuthToken(authToken);
    const user = await privy.getUser(verified.userId);
    return user.linkedAccounts.some(
      (account) => "address" in account && account.address === walletAddress,
    );
  } catch {
    return false;
  }
}
