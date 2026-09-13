import * as Sentry from "@sentry/nextjs";

/**
 * Fehler-Tracking (seit 2026-09-13), Sentry, **schlafend ohne DSN**.
 *
 * Vorher existierte ein Fehler im Webhook oder im Mint-Worker nur in den
 * Vercel-Logs, die nach einem Tag weg sind. Jetzt landet er zusaetzlich in
 * Sentry — wenn `SENTRY_DSN` (Server) bzw. `NEXT_PUBLIC_SENTRY_DSN` (Browser)
 * gesetzt ist. Ohne die beiden Variablen ist jeder Aufruf hier ein reines
 * `console.error`; nichts verlaesst den Rechner, kein Build haengt davon ab.
 *
 * Bewusst **ohne** `withSentryConfig` in `next.config.ts`: das braucht ein
 * Auth-Token fuer den Source-Map-Upload und wuerde jeden Build daran haengen.
 * Stacktraces sind damit minifiziert, aber vorhanden — fuer „der Webhook
 * scheitert seit 3 Uhr an X" reicht das.
 *
 * `reportError` ist fuer **gefangene** Fehler an den Geldpfaden gedacht: dort
 * wird alles gefangen (der Webhook muss antworten, der Cron weiterlaufen), und
 * gefangene Fehler sieht Sentry sonst nie. Ungefangene Route-Fehler kommen
 * ueber `onRequestError` in `src/instrumentation.ts` von selbst.
 */
export function reportError(message: string, err: unknown, extra?: Record<string, unknown>): void {
  console.error(message, err instanceof Error ? err.message : err);
  try {
    Sentry.withScope((scope) => {
      scope.setExtra("message", message);
      if (extra) for (const [k, v] of Object.entries(extra)) scope.setExtra(k, v);
      if (err instanceof Error) Sentry.captureException(err);
      else Sentry.captureMessage(`${message} ${String(err)}`, "error");
    });
  } catch {
    // Sentry darf nie selbst zum Fehler werden.
  }
}

/** Ein betrieblicher Alarm als Sentry-Meldung; laeuft neben der Admin-Mail. */
export function reportAlert(subject: string, text: string): void {
  try {
    Sentry.captureMessage(subject, { level: "warning", extra: { text } });
  } catch {
    // s. o.
  }
}
