import * as Sentry from "@sentry/nextjs";

/**
 * Next.js-Instrumentierung: laedt die Sentry-Serverkonfiguration einmal pro
 * Instanz und meldet ungefangene Route-Fehler. Alles hier ist ohne
 * SENTRY_DSN wirkungslos (siehe src/lib/observe.ts).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
