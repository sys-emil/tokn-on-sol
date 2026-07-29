import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";

/**
 * Server half of Vercel BotID.
 *
 * **Fails open on purpose.** These checks sit on the checkout and minting
 * paths, so a BotID outage, a misconfiguration, or a plan that doesn't include
 * it must never stop people from buying tickets. Bot protection here is a
 * second layer on top of `src/lib/rateLimit.ts`, which keeps working
 * regardless; losing the second layer for a while is a far smaller problem
 * than losing sales.
 *
 * Returns true only when BotID positively identified a bot.
 */
export async function isBot(): Promise<boolean> {
  try {
    const verification = await checkBotId();
    return verification.isBot === true;
  } catch (err) {
    console.error("BotID check failed, allowing the request:", err);
    return false;
  }
}

/** Standard 403 for a request BotID rejected. */
export function botDenied(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Anfrage abgelehnt. Bitte lade die Seite neu und versuch es erneut." },
    { status: 403 },
  );
}
