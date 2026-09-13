import { describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb } from "./fakeSupabase";

/** Die Einzelerstattung: Betrag, Zulaessigkeit und Buchung gegen die Attrappe. */

let db: FakeDb;
const refundsCreate = vi.fn();
vi.mock("@/lib/supabase", () => ({ get supabaseAdmin() { return db; } }));
vi.mock("@/lib/stripe", () => ({ stripe: { refunds: { create: refundsCreate } }, PLATFORM_FEE_BPS: 300 }));
vi.mock("@/lib/platformFees", () => ({ bookCancellationFee: vi.fn(async () => "booked") }));

const PURCHASE = { id: "p-1", asset_id: "asset-1", event_id: "evt-1", tier_id: "tier-1", stripe_session_id: "cs_1", source: "online", season_pass_id: null, redeemed_at: null, revoked_at: null };
const EVENT = { id: "evt-1", organizer_wallet: "Org1", cancelled_at: null };
// 4 Tickets à 10 € + je 1,19 € Gebuehr, Gast zahlt die Gebuehr.
const PAYOUT = { id: "po-1", status: "pending", currency: "eur", gross_cents: 4_476, fee_cents: 476, buyer_fee_cents: 476, net_cents: 4_000, payment_intent_id: "pi_1", charge_id: "ch_1" };

function tables(overrides: Record<string, unknown> = {}, liveCount = 4) {
  return {
    purchases: (c: { op: string; options?: unknown }) => (c.op === "select" && c.options ? { data: null, count: liveCount } : { data: PURCHASE }),
    events: () => ({ data: EVENT }),
    organizer_refunds: () => ({ data: null }),
    payouts: () => ({ data: PAYOUT }),
    ...overrides,
  } as Parameters<typeof fakeDb>[0];
}

describe("quoteOrganizerRefund", () => {
  it("refunds this ticket's share of the current gross, service fee included", async () => {
    db = fakeDb(tables());
    const { quoteOrganizerRefund } = await import("@/lib/organizerRefund");
    const q = await quoteOrganizerRefund("asset-1", "Org1");
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    expect(q.quote.refundCents).toBe(1_119);
    expect(q.quote.netShareCents).toBe(1_000);
    expect(q.quote.fullRefund).toBe(false);
  });

  it("refunds the whole remainder when it is the last live ticket of the order", async () => {
    db = fakeDb(tables({ payouts: () => ({ data: { ...PAYOUT, gross_cents: 1_119, fee_cents: 119, buyer_fee_cents: 119, net_cents: 1_000 } }) }, 1));
    const { quoteOrganizerRefund } = await import("@/lib/organizerRefund");
    const q = await quoteOrganizerRefund("asset-1", "Org1");
    expect(q.ok && q.quote.fullRefund).toBe(true);
    expect(q.ok && q.quote.refundCents).toBe(1_119);
  });

  it.each([
    ["not_owner", {}, { events: () => ({ data: { ...EVENT, organizer_wallet: "Somebody" } }) }],
    ["redeemed", { redeemed_at: "2026-01-01" }, {}],
    ["revoked", { revoked_at: "2026-01-01" }, {}],
    ["box_office", { source: "box_office" }, {}],
    ["season_pass", { season_pass_id: "pass-1", event_id: null }, {}],
    ["free_ticket", { stripe_session_id: null }, {}],
    ["event_cancelled", {}, { events: () => ({ data: { ...EVENT, cancelled_at: "2026-01-01" } }) }],
    ["payout_not_pending", {}, { payouts: () => ({ data: { ...PAYOUT, status: "paid" } }) }],
    ["already_refunded", {}, { organizer_refunds: () => ({ data: { id: "or-1" } }) }],
  ] as const)("rejects %s", async (reason, purchasePatch, tablePatch) => {
    db = fakeDb(tables({
      purchases: (c: { op: string; options?: unknown }) => (c.op === "select" && c.options ? { data: null, count: 4 } : { data: { ...PURCHASE, ...purchasePatch } }),
      ...tablePatch,
    }));
    const { quoteOrganizerRefund } = await import("@/lib/organizerRefund");
    const q = await quoteOrganizerRefund("asset-1", "Org1");
    expect(q).toEqual({ ok: false, reason });
  });
});

describe("executeOrganizerRefund", () => {
  it("revokes, refunds via Stripe, frees one seat and rescales the payout row", async () => {
    refundsCreate.mockReset();
    refundsCreate.mockResolvedValue({ id: "re_1", charge: { id: "ch_1", amount: 4_476, balance_transaction: { fee: 92 } } });
    db = fakeDb(tables({
      purchases: (c: { op: string; options?: unknown }) => c.op === "update" ? { data: [{ id: "p-1" }] } : (c.options ? { data: null, count: 4 } : { data: PURCHASE }),
      organizer_refunds: (c: { op: string }) => c.op === "insert" ? { data: { id: "or-1" } } : { data: null },
      payouts: () => ({ data: PAYOUT, error: null }),
      mint_jobs: () => ({ data: null, error: null }),
    }));
    const { quoteOrganizerRefund, executeOrganizerRefund } = await import("@/lib/organizerRefund");
    const q = await quoteOrganizerRefund("asset-1", "Org1");
    if (!q.ok) throw new Error(q.reason);
    const out = await executeOrganizerRefund(q.quote);

    expect(out.refundId).toBe("re_1");
    expect(out.refundCents).toBe(1_119);
    // Stripe-Gebuehr anteilig: 92 × 1119 / 4476 = 23
    expect(out.stripeFeeCents).toBe(23);
    const [params, opts] = refundsCreate.mock.calls[0] as [Record<string, unknown>, { idempotencyKey: string }];
    expect(params).toMatchObject({ payment_intent: "pi_1", amount: 1_119 });
    expect(opts.idempotencyKey).toBe("organizer-refund-or-1");
    expect(db.rpcCalls).toEqual([{ name: "release_sold_seats", args: { p_event_id: "evt-1", p_quantity: 1, p_tier_id: "tier-1" } }]);
    const payoutUpdate = db.calls.find((c) => c.table === "payouts" && c.op === "update");
    // gross 4476−1119 = 3357, net 4000−1000 = 3000, fee = 357; Invariante net = gross − fee.
    expect(payoutUpdate?.payload).toMatchObject({ gross_cents: 3_357, net_cents: 3_000, fee_cents: 357, buyer_fee_cents: 357 });
  });

  it("rolls back the revocation when Stripe refuses", async () => {
    refundsCreate.mockReset();
    refundsCreate.mockRejectedValue(new Error("charge_already_refunded"));
    db = fakeDb(tables({
      purchases: (c: { op: string; options?: unknown }) => c.op === "update" ? { data: [{ id: "p-1" }] } : (c.options ? { data: null, count: 4 } : { data: PURCHASE }),
      organizer_refunds: (c: { op: string }) => c.op === "insert" ? { data: { id: "or-1" } } : { data: null },
    }));
    const { quoteOrganizerRefund, executeOrganizerRefund } = await import("@/lib/organizerRefund");
    const q = await quoteOrganizerRefund("asset-1", "Org1");
    if (!q.ok) throw new Error(q.reason);
    await expect(executeOrganizerRefund(q.quote)).rejects.toThrow("charge_already_refunded");
    const unrevoke = db.calls.find((c) => c.table === "purchases" && c.op === "update" && (c.payload as { revoked_at: unknown }).revoked_at === null);
    expect(unrevoke).toBeDefined();
    expect(db.calls.some((c) => c.table === "organizer_refunds" && c.op === "delete")).toBe(true);
    expect(db.rpcCalls).toHaveLength(0);
  });
});
