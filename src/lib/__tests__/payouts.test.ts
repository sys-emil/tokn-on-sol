import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  buildPayoutRow,
  claimWebhookEvent,
  disputeFeeCents,
  computeAvailableAt,
  computeFeeSplit,
  resolveFeeCents,
} from "@/lib/payouts";
import { serviceFeePerTicketCents, serviceFeeTotalCents } from "@/lib/fees";

describe("serviceFeePerTicketCents (degressive bands, floor \u20ac0.99)", () => {
  it("applies the marginal bands", () => {
    expect(serviceFeePerTicketCents(500)).toBe(99); // \u20ac5 \u2192 floor
    expect(serviceFeePerTicketCents(1_500)).toBe(119); // \u20ac15 \u2192 7.9%
    expect(serviceFeePerTicketCents(5_000)).toBe(325); // \u20ac50 \u2192 1.19 + 5.9% of 35
    expect(serviceFeePerTicketCents(12_000)).toBe(640); // \u20ac120 \u2192 3.25 + 4.5% of 70
  });

  it("free tickets carry no fee", () => {
    expect(serviceFeePerTicketCents(0)).toBe(0);
  });

  it("never charges less than the floor on a paid ticket", () => {
    // 7.9% only overtakes \u20ac0.99 at \u20ac12.53.
    expect(serviceFeePerTicketCents(1)).toBe(99);
    expect(serviceFeePerTicketCents(33)).toBe(99);
    expect(serviceFeePerTicketCents(1_250)).toBe(99);
    expect(serviceFeePerTicketCents(1_300)).toBe(103);
  });

  it("rejects negative or fractional prices", () => {
    expect(() => serviceFeePerTicketCents(-1)).toThrow();
    expect(() => serviceFeePerTicketCents(10.5)).toThrow();
  });
});

describe("serviceFeeTotalCents", () => {
  it("multiplies the per-ticket fee by quantity", () => {
    expect(serviceFeeTotalCents(500, 4)).toBe(396);
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

describe("resolveFeeCents", () => {
  it("takes a plausible fee straight from the metadata", () => {
    expect(resolveFeeCents(5_400, 400)).toEqual({ feeCents: 400, source: "metadata" });
    expect(resolveFeeCents(5_000, 0)).toEqual({ feeCents: 0, source: "metadata" });
  });

  it("falls back to the legacy 3% only when there is no usable metadata", () => {
    expect(resolveFeeCents(5_000)).toEqual({ feeCents: 150, source: "legacy" });
    expect(resolveFeeCents(5_000, null)).toEqual({ feeCents: 150, source: "legacy" });
    expect(resolveFeeCents(5_000, -1)).toEqual({ feeCents: 150, source: "legacy" });
    expect(resolveFeeCents(5_000, 12.5)).toEqual({ feeCents: 150, source: "legacy" });
  });

  it("clamps rather than reinterprets a fee above the gross", () => {
    expect(resolveFeeCents(5_000, 6_000)).toEqual({ feeCents: 5_000, source: "clamped" });
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

  it("buyer mode: the organizer nets the full face price", () => {
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
      buyerFeeCents: 400,
      now,
    });
    expect(row).toMatchObject({
      gross_cents: 5_400,
      fee_cents: 400,
      buyer_fee_cents: 400,
      net_cents: 5_000,
    });
  });

  it("organizer mode: the fee comes out of the face price, and the buyer paid none of it", () => {
    // 2 × €25.00 is the whole charge; the €4.00 fee is the organizer's.
    const row = buildPayoutRow({
      session,
      chargeId: "ch_3QTest123",
      eventId: "evt-uuid",
      eventDate: "2026-08-15",
      organizerWallet: "So1anaWa11etXYZ",
      stripeAccountId: "acct_1Test",
      holdDays: 14,
      serviceFeeCents: 400,
      buyerFeeCents: 0,
      now,
    });
    expect(row).toMatchObject({
      gross_cents: 5_000,
      fee_cents: 400,
      buyer_fee_cents: 0,
      net_cents: 4_600,
    });
  });

  it("split mode: each side carries half", () => {
    const row = buildPayoutRow({
      session: { ...session, amount_total: 5_200 },
      chargeId: "ch_3QTest123",
      eventId: "evt-uuid",
      eventDate: "2026-08-15",
      organizerWallet: "So1anaWa11etXYZ",
      stripeAccountId: "acct_1Test",
      holdDays: 14,
      serviceFeeCents: 400,
      buyerFeeCents: 200,
      now,
    });
    expect(row).toMatchObject({
      gross_cents: 5_200,
      fee_cents: 400,
      buyer_fee_cents: 200,
      net_cents: 4_800,
    });
  });

  it("clamps a fee larger than gross instead of reinterpreting it as the legacy 3%", () => {
    // Structurally impossible via splitServiceFee; a 3% fallback here would
    // silently overpay the organizer under an absorbed fee.
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
    expect(row).toMatchObject({ gross_cents: 5_000, fee_cents: 5_000, net_cents: 0 });
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
      buyer_fee_cents: null,
      net_cents: 4_850,
      currency: "eur",
      available_at: "2026-08-29T00:00:00.000Z",
      payment_method: null,
    });
  });

  it("records the funding payment method when the webhook resolved one", () => {
    const row = buildPayoutRow({
      session,
      chargeId: "ch_3QTest123",
      eventId: "evt-uuid",
      eventDate: "2026-08-15",
      organizerWallet: "So1anaWa11etXYZ",
      stripeAccountId: "acct_1Test",
      holdDays: 0,
      paymentMethod: "paypal",
      now,
    });
    expect(row).toMatchObject({ payment_method: "paypal" });
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

describe("disputeFeeCents", () => {
  it("is the flat fee while a dispute stands", () => {
    // Ein offener oder verlorener Chargeback: 15 € Stripe-Gebuehr bleiben.
    expect(disputeFeeCents([{ fee: 1_500 }])).toBe(1_500);
  });

  it("is zero once a won dispute has been compensated", () => {
    // Stripe bucht die Gebuehr bei Gewinn mit einer zweiten Zeile zurueck.
    expect(disputeFeeCents([{ fee: 1_500 }, { fee: -1_500 }])).toBe(0);
  });

  it("never returns a negative amount", () => {
    // Eine negative Forderung waere eine Gutschrift an den Veranstalter.
    expect(disputeFeeCents([{ fee: -1_500 }])).toBe(0);
  });

  it("treats a missing or empty list as nothing to pass on", () => {
    expect(disputeFeeCents([])).toBe(0);
    expect(disputeFeeCents(null)).toBe(0);
    expect(disputeFeeCents(undefined)).toBe(0);
    expect(disputeFeeCents([{ fee: null }, {}])).toBe(0);
  });
});
