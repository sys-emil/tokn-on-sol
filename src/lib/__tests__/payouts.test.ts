import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  buildPayoutRow,
  claimWebhookEvent,
  computeAvailableAt,
  computeFeeSplit,
} from "@/lib/payouts";
import { serviceFeePerTicketCents, serviceFeeTotalCents } from "@/lib/fees";

describe("serviceFeePerTicketCents (buyer-side €1 + 4% fee)", () => {
  it("charges €1 + 4% per ticket", () => {
    expect(serviceFeePerTicketCents(500)).toBe(120); // €5 → €1.20
    expect(serviceFeePerTicketCents(1_500)).toBe(160); // €15 → €1.60
    expect(serviceFeePerTicketCents(5_000)).toBe(300); // €50 → €3.00
  });

  it("free tickets carry no fee", () => {
    expect(serviceFeePerTicketCents(0)).toBe(0);
  });

  it("rounds the percentage part to the nearest cent", () => {
    // €0.33 → 4% = 1.32 cents → 1 cent + 100 base
    expect(serviceFeePerTicketCents(33)).toBe(101);
  });

  it("rejects negative or fractional prices", () => {
    expect(() => serviceFeePerTicketCents(-1)).toThrow();
    expect(() => serviceFeePerTicketCents(10.5)).toThrow();
  });
});

describe("serviceFeeTotalCents", () => {
  it("multiplies the per-ticket fee by quantity", () => {
    expect(serviceFeeTotalCents(500, 4)).toBe(480);
    expect(serviceFeeTotalCents(0, 4)).toBe(0);
  });

  it("rejects non-positive quantities", () => {
    expect(() => serviceFeeTotalCents(500, 0)).toThrow();
    expect(() => serviceFeeTotalCents(500, 1.5)).toThrow();
  });
});

describe("computeFeeSplit (legacy 3% platform fee)", () => {
  it("splits a round amount", () => {
    expect(computeFeeSplit(10_000)).toEqual({ feeCents: 300, netCents: 9_700 }); // €100
  });

  it("rounds to the nearest cent and always sums back to gross", () => {
    // €0.33 → fee 0.99 cents → rounds to 1 cent
    expect(computeFeeSplit(33)).toEqual({ feeCents: 1, netCents: 32 });
    // €0.16 → fee 0.48 cents → rounds to 0
    expect(computeFeeSplit(16)).toEqual({ feeCents: 0, netCents: 16 });
    for (const gross of [1, 7, 99, 101, 1234, 999_999]) {
      const { feeCents, netCents } = computeFeeSplit(gross);
      expect(feeCents + netCents).toBe(gross);
      expect(feeCents).toBeGreaterThanOrEqual(0);
      expect(netCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles zero", () => {
    expect(computeFeeSplit(0)).toEqual({ feeCents: 0, netCents: 0 });
  });

  it("rejects negative or fractional amounts", () => {
    expect(() => computeFeeSplit(-1)).toThrow();
    expect(() => computeFeeSplit(10.5)).toThrow();
  });
});

describe("computeAvailableAt (payout hold period)", () => {
  const now = new Date("2026-07-01T12:00:00Z");

  it("holdDays = 0 → available immediately (daily automatic payout)", () => {
    expect(computeAvailableAt("2026-08-15", 0, now)).toEqual(now);
  });

  it("holdDays > 0 → event date + N days at midnight UTC", () => {
    const available = computeAvailableAt("2026-08-15", 7, now);
    expect(available.toISOString()).toBe("2026-08-22T00:00:00.000Z");
  });

  it("purchase after the event: hold never releases before now", () => {
    // Event was 2026-06-01, hold 7 days → would be 2026-06-08, but "now" is
    // 2026-07-01 → clamps to now (no retroactive early release).
    const available = computeAvailableAt("2026-06-01", 7, now);
    expect(available).toEqual(now);
  });

  it("malformed event date falls back to now as anchor", () => {
    const available = computeAvailableAt("not-a-date", 3, now);
    expect(available.toISOString()).toBe("2026-07-04T12:00:00.000Z");
  });

  it("rejects negative or fractional hold days", () => {
    expect(() => computeAvailableAt("2026-08-15", -1, now)).toThrow();
    expect(() => computeAvailableAt("2026-08-15", 2.5, now)).toThrow();
  });
});

describe("buildPayoutRow (from Stripe test-mode checkout session)", () => {
  // Shape taken from a Stripe test-mode checkout.session.completed event.
  const session = {
    id: "cs_test_a1b2c3d4e5",
    amount_total: 5_000, // 2 × €25.00
    currency: "eur",
    payment_intent: "pi_3QTest123",
  } as Pick<Stripe.Checkout.Session, "id" | "amount_total" | "currency" | "payment_intent">;

  const now = new Date("2026-07-01T12:00:00Z");

  it("uses the buyer-side service fee from the checkout metadata: organizer nets the full face price", () => {
    // 2 × €25.00 face + 2 × €2.00 service fee (100 + 4% of 2500) = €54.00 gross
    const row = buildPayoutRow({
      session: { ...session, amount_total: 5_400 },
      chargeId: "ch_3QTest123",
      eventId: "evt-uuid",
      eventDate: "2026-08-15",
      organizerWallet: "So1anaWa11etXYZ",
      stripeAccountId: "acct_1Test",
      holdDays: 14,
      serviceFeeCents: 400,
      now,
    });
    expect(row).toMatchObject({
      gross_cents: 5_400,
      fee_cents: 400,
      net_cents: 5_000,
    });
  });

  it("ignores an implausible service fee (larger than gross) and falls back to the legacy split", () => {
    const row = buildPayoutRow({
      session,
      chargeId: "ch_3QTest123",
      eventId: "evt-uuid",
      eventDate: "2026-08-15",
      organizerWallet: "So1anaWa11etXYZ",
      stripeAccountId: "acct_1Test",
      holdDays: 14,
      serviceFeeCents: 6_000,
      now,
    });
    expect(row).toMatchObject({ gross_cents: 5_000, fee_cents: 150, net_cents: 4_850 });
  });

  it("builds a complete legacy row (no service fee metadata) with 3% split and hold-based availability", () => {
    const row = buildPayoutRow({
      session,
      chargeId: "ch_3QTest123",
      eventId: "evt-uuid",
      eventDate: "2026-08-15",
      organizerWallet: "So1anaWa11etXYZ",
      stripeAccountId: "acct_1Test",
      holdDays: 14,
      now,
    });
    expect(row).toEqual({
      stripe_session_id: "cs_test_a1b2c3d4e5",
      payment_intent_id: "pi_3QTest123",
      charge_id: "ch_3QTest123",
      event_id: "evt-uuid",
      organizer_wallet: "So1anaWa11etXYZ",
      stripe_account_id: "acct_1Test",
      gross_cents: 5_000,
      fee_cents: 150,
      net_cents: 4_850,
      currency: "eur",
      available_at: "2026-08-29T00:00:00.000Z",
    });
  });

  it("returns null for free sessions; nothing to pay out", () => {
    const row = buildPayoutRow({
      session: { ...session, amount_total: 0 },
      chargeId: null,
      eventId: "evt-uuid",
      eventDate: "2026-08-15",
      organizerWallet: "So1anaWa11etXYZ",
      stripeAccountId: null,
      holdDays: 0,
      now,
    });
    expect(row).toBeNull();
  });
});

describe("claimWebhookEvent (idempotent webhook processing)", () => {
  function fakeDb(insertResult: { error: { code?: string; message: string } | null }) {
    const insert = vi.fn().mockResolvedValue(insertResult);
    const from = vi.fn().mockReturnValue({ insert });
    return { db: { from } as unknown as SupabaseClient, insert, from };
  }

  const event = { id: "evt_test_webhook_1", type: "checkout.session.completed" };

  it("claims an unseen event ID", async () => {
    const { db, insert } = fakeDb({ error: null });
    await expect(claimWebhookEvent(db, event)).resolves.toBe(true);
    expect(insert).toHaveBeenCalledWith({
      id: "evt_test_webhook_1",
      type: "checkout.session.completed",
      account: null,
    });
  });

  it("refuses a duplicate delivery (unique violation)", async () => {
    const { db } = fakeDb({ error: { code: "23505", message: "duplicate key" } });
    await expect(claimWebhookEvent(db, event)).resolves.toBe(false);
  });

  it("throws on any other database error so the webhook returns 500 and Stripe retries", async () => {
    const { db } = fakeDb({ error: { code: "57014", message: "timeout" } });
    await expect(claimWebhookEvent(db, event)).rejects.toThrow(/timeout/);
  });

  it("records the connected account for Connect events", async () => {
    const { db, insert } = fakeDb({ error: null });
    await claimWebhookEvent(db, { id: "evt_1", type: "payout.paid", account: "acct_1Test" });
    expect(insert).toHaveBeenCalledWith({ id: "evt_1", type: "payout.paid", account: "acct_1Test" });
  });
});
