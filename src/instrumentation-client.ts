import { initBotId } from "botid/client/core";
import * as Sentry from "@sentry/nextjs";

// Browserseite des Fehler-Trackings; schlafend ohne NEXT_PUBLIC_SENTRY_DSN
// (siehe src/lib/observe.ts). Kein Session-Replay, kein Tracing: nur Fehler.
try {
  // getrimmt: ein beim Einfuegen mitkopiertes Leerzeichen liess den DSN-Parser
  // stumm scheitern — Client aktiv, aber ohne Ziel (gesehen am 2026-09-13).
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
} catch (err) {
  console.error("Sentry client init failed:", err);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

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
      { path: "/api/resale/offer", method: "POST" },
      { path: "/api/resale/withdraw", method: "POST" },
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
