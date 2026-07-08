/**
 * Pure subscription helpers — no server imports, safe to unit-test and to use
 * from any context.
 */

/** Maps a Stripe subscription status to the organizer plan. */
export function subscriptionPlanFromStatus(status: string): "pro" | "free" {
  return status === "active" || status === "trialing" ? "pro" : "free";
}
