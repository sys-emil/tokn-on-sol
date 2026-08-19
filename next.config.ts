import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

/**
 * Security headers.
 *
 * Privy requires a Content-Security-Policy that lets its embedded-wallet iframe
 * load while locking everything else down; the policy below is Privy's
 * recommended baseline plus the two origins Passly genuinely needs.
 *
 * Two Passly-specific traps are deliberately avoided here:
 *
 * 1. **The doorman needs the camera.** `/doorman/[eventId]` scans QR codes via
 *    `getUserMedia`, so `Permissions-Policy` must keep `camera=(self)`. A
 *    copy-pasted "lock everything down" policy would silently break the door.
 * 2. **Event images come from Supabase Storage**, so `img-src` needs that host
 *    on top of `'self'`. Derived from NEXT_PUBLIC_SUPABASE_URL at build time
 *    rather than hardcoded, so it follows the project.
 *
 * `'unsafe-inline'` appears twice, both times unavoidable rather than lazy:
 * - `style-src`, because every page ships its styles in an inline `<style>`
 *   block (the documented convention in CLAUDE.md).
 * - `script-src`, because Next.js injects inline bootstrap/hydration scripts.
 *   Removing it needs a nonce handed through middleware, which this app has
 *   deliberately never had. The iframe protection that Privy actually cares
 *   about (`frame-src`, `frame-ancestors`) is unaffected by it.
 *
 * WalletConnect and Cloudflare origins are kept from Privy's list even though
 * login is email-only, because a missing origin breaks authentication while a
 * spare one costs nothing.
 */
const supabaseOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

/**
 * Privy runs on a subdomain of OUR domain (e.g. https://privy.getpassly.de),
 * not on auth.privy.io.
 *
 * That is what verifying the domain for HttpOnly cookies does: so the session
 * cookie is first-party, Privy proxies its API and wallet iframe through a
 * subdomain we point at them. Privy's published sample CSP predates that setup
 * and only lists auth.privy.io, which is why a policy copied straight from
 * their docs blocks the login with
 *   "Fetch API cannot load https://privy.<domain>/api/v1/passwordless/init"
 * — `connect-src 'self'` matches the exact host only, never subdomains.
 *
 * A wildcard over our own apex rather than one hardcoded hostname: we control
 * this DNS zone, and Privy may add further hosts to the custom-domain setup
 * without warning. Every other origin stays explicitly listed.
 */
const ownDomainWildcard = (() => {
  const raw = process.env.APP_URL;
  try {
    const host = raw ? new URL(raw).hostname : "getpassly.de";
    const apex = host.split(".").slice(-2).join(".");
    return `https://*.${apex}`;
  } catch {
    return "https://*.getpassly.de";
  }
})();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Modern equivalent of X-Frame-Options: DENY. Nothing may embed Passly.
  "frame-ancestors 'none'",
  `child-src ${ownDomainWildcard} https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org`,
  `frame-src ${ownDomainWildcard} https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com`,
  `connect-src 'self' ${ownDomainWildcard} https://auth.privy.io https://*.rpc.privy.systems wss://relay.walletconnect.com wss://relay.walletconnect.org wss://www.walletlink.org https://explorer-api.walletconnect.com`,
  "worker-src 'self'",
  "manifest-src 'self'",
].join("; ");

// Enforcing by default. Set CSP_REPORT_ONLY=1 to ship the policy without
// blocking anything — violations then only show up in the browser console.
// The secure state is the default on purpose: an env var you must REMOVE to
// become safe is one everybody forgets.
const cspHeaderName = process.env.CSP_REPORT_ONLY === "1"
  ? "Content-Security-Policy-Report-Only"
  : "Content-Security-Policy";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: cspHeaderName, value: csp },
          // Kept alongside frame-ancestors for browsers that predate it.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera=(self) is load-bearing: the doorman scanner needs it.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

// Sets up the proxy rewrites BotID needs. Which paths are actually protected is
// declared in src/instrumentation-client.ts and enforced server-side in each
// route via src/lib/botCheck.ts.
export default withBotId(nextConfig);
