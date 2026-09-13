import * as Sentry from "@sentry/nextjs";

// Serverseite. Ohne SENTRY_DSN bleibt der Client abgeschaltet (`enabled`),
// siehe src/lib/observe.ts. Kein Tracing: wir wollen Fehler, keine Kosten.
const dsn = process.env.SENTRY_DSN?.trim() || undefined;
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
