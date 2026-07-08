import { describe, expect, it } from "vitest";
import { subscriptionPlanFromStatus } from "@/lib/subscription";

describe("subscriptionPlanFromStatus", () => {
  it("grants pro for active and trialing subscriptions", () => {
    expect(subscriptionPlanFromStatus("active")).toBe("pro");
    expect(subscriptionPlanFromStatus("trialing")).toBe("pro");
  });

  it("downgrades every non-running status to free", () => {
    for (const status of ["past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused", ""]) {
      expect(subscriptionPlanFromStatus(status)).toBe("free");
    }
  });
});
