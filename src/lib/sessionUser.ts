import type { NextRequest } from "next/server";
import { getPrivyClient } from "@/lib/privyServer";
import { getOrCreateUser, type PasslyUser } from "@/lib/users";

/**
 * The Passly user behind a request, or null when the caller is not signed in.
 *
 * This is the single place that knows which provider is doing the
 * authenticating. Everything downstream works with `PasslyUser`, so the switch
 * from Privy to Supabase Auth changes this function and nothing else.
 */
export async function requestUser(req: NextRequest): Promise<PasslyUser | null> {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) return null;

  try {
    const privy = getPrivyClient();
    const verified = await privy.verifyAuthToken(authToken);
    const account = await privy.getUser(verified.userId);
    const email = account.email?.address
      ?? account.linkedAccounts.find((a) => a.type === "email")?.address
      ?? "";
    return await getOrCreateUser(verified.userId, email);
  } catch {
    return null;
  }
}
