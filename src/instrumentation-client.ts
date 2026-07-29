import { initBotId } from "botid/client/core";

/**
 * Client half of Vercel BotID: the listed routes get a proof-of-humanity
 * challenge attached before the request leaves the browser. The server half
 * lives in `src/lib/botCheck.ts` and every path here must call it, otherwise
 * the check is decorative.
 *
 * Scope is the abuse-prone entry points — the ones that cost money, mint
 * on-chain assets, or send mail. Deliberately NOT included: the door routes
 * (a doorman scanner is not a browser session we control) and /api/track
 * (analytics noise is cheap, and its own rate limit is enough).
 */
// Wrapped defensively: this file runs before hydration, so an exception here
// would take the whole app down. Bot protection failing to arm is acceptable
// (the server side fails open too, see botCheck.ts); a blank page is not.
try {
  initBotId({
    protect: [
      { path: "/api/checkout/create", method: "POST" },
      { path: "/api/checkout/pass", method: "POST" },
      { path: "/api/resale/checkout", method: "POST" },
      { path: "/api/resale/list", method: "POST" },
      { path: "/api/claims/create", method: "POST" },
      { path: "/api/guest-order/claim", method: "POST" },
      { path: "/api/organizers/apply", method: "POST" },
      { path: "/api/waitlist/join", method: "POST" },
      { path: "/api/tickets/backup", method: "POST" },
    ],
  });
} catch (err) {
  console.error("BotID client init failed; requests proceed unprotected:", err);
}
