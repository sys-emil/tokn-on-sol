import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {};

// Sets up the proxy rewrites BotID needs. Which paths are actually protected is
// declared in src/instrumentation-client.ts and enforced server-side in each
// route via src/lib/botCheck.ts.
export default withBotId(nextConfig);
