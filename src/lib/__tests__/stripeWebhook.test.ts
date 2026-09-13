import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, eqValue, type FakeDb } from "./fakeSupabase";

/**
 * Der Stripe-Webhook gegen eine Datenbank-Attrappe: was schickt er an die
 * Datenbank, und wie reagiert er auf ihre Antworten. Signaturpruefung und
 * Stripe-API sind gemockt; `after()` ist ausserhalb einer Anfrage nicht
 * verfuegbar und wird zum No-op.
 */

let db: FakeDb;
const paymentIntents = { retrieve: vi.fn() };

vi.mock("@/lib/supabase", () => ({
  get supabaseAdmin() { return db; },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    paymentIntents,
  },
  PLATFORM_FEE_BPS: 300,
}));
vi.mock("next/server", async (importOriginal) => {
  const orig = await importOriginal<typeof import("next/server")>();
  return { ...orig, after: () => undefined };
});
vi.mock("@/lib/email", () => ({ sendAdminAlert: vi.fn(async () => undefined) }));
vi.mock("@/lib/mintJobs", () => ({ processMintJobs: vi.fn(async () => 0) }));
vi.mock("@/lib/waitlist", () => ({ notifyWaitlistIfSeats: vi.fn(async () => 0) }));
vi.mock("@/lib/guestOrders", () => ({ ensureGuestOrder: vi.fn(async () => undefined) }));
vi.mock("@/lib/platformFees", () => ({ bookChargebackFee: vi.fn(async () => "skipped") }));
vi.mock("@/lib/observe", () => ({ reportError: vi.fn(), reportAlert: vi.fn() }));

vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
vi.stubEnv("APP_URL", "https://example.test");

async function post(event: Record<string, unknown>): Promise<Response> {
  const { POST } = await import("@/app/api/webhooks/stripe/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://example.test/api/webhooks/stripe", {
    method: "POST",
    body: JSON.stringify(event),
    headers: { "stripe-signature": "sig" },
  });
  return POST(req);
}

const SESSION = {
  id: "cs_test_1",
  object: "checkout.session",
  mode: "payment",
  amount_total: 2_238, // 2 × (10,00 € + 1,19 € Gebühr)
  currency: "eur",
  payment_intent: "pi_1",
  customer_details: { email: "gast@example.test" },
  metadata: {
    eventId: "evt-1",
    buyerWallet: "Wallet111",
    quantity: "2",
    tierId: "tier-1",
    serviceFeeCents: "238",
    buyerFeeCents: "238",
    lang: "de",
  },
};

function completed(id = "evt_completed_1") {
  return { id, type: "checkout.session.completed", data: { object: SESSION } };
}

beforeEach(() => {
  paymentIntents.retrieve.mockReset();
  paymentIntents.retrieve.mockResolvedValue({
    latest_charge: { id: "ch_1", payment_method_details: { type: "card" } },
    payment_method_types: ["card"],
  });
});

describe("checkout.session.completed", () => {
  it("claims the event, finalizes the sale, books the payout and enqueues the mint", async () => {
    db = fakeDb({
      stripe_webhook_events: () => ({ data: null, error: null }),
      events: () => ({ data: { name: "Konzert", date: "2099-05-01", organizer_wallet: "Org1", payout_hold_days: 0 } }),
      organizers: () => ({ data: { stripe_account_id: "acct_1", first_payout_at: null } }),
      payouts: () => ({ data: null, error: null }),
      mint_jobs: () => ({ data: null, error: null }),
    });

    const res = await post(completed());
    expect(res.status).toBe(200);

    const finalize = db.rpcCalls.find((r) => r.name === "finalize_ticket_sale");
    expect(finalize?.args).toMatchObject({ p_session_id: "cs_test_1", p_event_id: "evt-1", p_quantity: 2, p_tier_id: "tier-1" });

    const payout = db.calls.find((c) => c.table === "payouts" && c.op === "upsert");
    expect(payout?.payload).toMatchObject({
      stripe_session_id: "cs_test_1",
      charge_id: "ch_1",
      payment_method: "card",
      gross_cents: 2_238,
      fee_cents: 238,
      buyer_fee_cents: 238,
      net_cents: 2_000,
      organizer_wallet: "Org1",
    });
    expect(payout?.options).toMatchObject({ onConflict: "stripe_session_id", ignoreDuplicates: true });

    const job = db.calls.find((c) => c.table === "mint_jobs" && c.op === "upsert");
    expect(job?.payload).toMatchObject({ stripe_session_id: "cs_test_1", quantity: 2, buyer_email: "gast@example.test", lang: "de" });
  });

  it("acknowledges a redelivered event without touching capacity", async () => {
    db = fakeDb({
      stripe_webhook_events: () => ({ data: null, error: { code: "23505", message: "duplicate key" } }),
    });
    const res = await post(completed());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("releases the claim and asks Stripe to retry when the sale cannot be finalized", async () => {
    db = fakeDb(
      {
        stripe_webhook_events: () => ({ data: null, error: null }),
        events: () => ({ data: { name: "Konzert", date: "2099-05-01", organizer_wallet: "Org1", payout_hold_days: 0 } }),
      },
      (name) => (name === "finalize_ticket_sale" ? { error: { message: "capacity mismatch" } } : undefined),
    );
    const res = await post(completed());
    expect(res.status).toBe(500);
    const release = db.calls.find((c) => c.table === "stripe_webhook_events" && c.op === "delete");
    expect(eqValue(release!, "id")).toBe("evt_completed_1");
    expect(db.calls.some((c) => c.table === "payouts")).toBe(false);
  });

  it("releases the claim when the payout row cannot be written", async () => {
    db = fakeDb({
      stripe_webhook_events: () => ({ data: null, error: null }),
      events: () => ({ data: { name: "Konzert", date: "2099-05-01", organizer_wallet: "Org1", payout_hold_days: 0 } }),
      organizers: () => ({ data: null }),
      payouts: () => ({ data: null, error: { message: "disk full" } }),
    });
    const res = await post(completed());
    expect(res.status).toBe(500);
    expect(db.calls.some((c) => c.table === "stripe_webhook_events" && c.op === "delete")).toBe(true);
    expect(db.calls.some((c) => c.table === "mint_jobs")).toBe(false);
  });

  it("never lets a subscription session reach the ticket path", async () => {
    db = fakeDb({
      stripe_webhook_events: () => ({ data: null, error: null }),
      organizers: () => ({ data: null, error: null }),
    });
    const res = await post({
      id: "evt_sub_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_sub", mode: "subscription", subscription: "sub_1", metadata: { purpose: "pro_subscription", organizerWallet: "Org1" } } },
    });
    expect(res.status).toBe(200);
    expect(db.rpcCalls).toHaveLength(0);
    const plan = db.calls.find((c) => c.table === "organizers" && c.op === "update");
    expect(plan?.payload).toMatchObject({ plan: "pro", stripe_subscription_id: "sub_1" });
  });
});

describe("checkout.session.expired", () => {
  it("releases the reservation", async () => {
    db = fakeDb({ stripe_webhook_events: () => ({ data: null, error: null }) });
    const res = await post({ id: "evt_exp_1", type: "checkout.session.expired", data: { object: { id: "cs_test_1", metadata: { eventId: "evt-1" } } } });
    expect(res.status).toBe(200);
    expect(db.rpcCalls).toEqual([{ name: "release_reservation", args: { p_session_id: "cs_test_1" } }]);
  });
});

describe("charge.refunded", () => {
  const payoutRow = {
    id: "po-1", status: "pending", stripe_session_id: "cs_test_1", event_id: "evt-1",
    currency: "eur", gross_cents: 2_238, fee_cents: 238, buyer_fee_cents: 238,
  };

  it("full refund: payout refunded, tickets revoked, seats freed, queued mint stopped", async () => {
    db = fakeDb({
      stripe_webhook_events: () => ({ data: null, error: null }),
      resale_offers: () => ({ data: null }),
      organizer_refunds: () => ({ data: null }),
      payouts: (c) => (c.op === "select" ? { data: payoutRow } : { data: null, error: null }),
      purchases: () => ({ data: null, error: null }),
      mint_jobs: () => ({ data: null, error: null }),
    });
    const res = await post({
      id: "evt_ref_1", type: "charge.refunded",
      data: { object: { id: "ch_1", amount: 2_238, amount_refunded: 2_238, refunded: true, payment_intent: "pi_1" } },
    });
    expect(res.status).toBe(200);
    const payoutUpdate = db.calls.find((c) => c.table === "payouts" && c.op === "update");
    expect(payoutUpdate?.payload).toMatchObject({ status: "refunded", net_cents: 0 });
    const revoke = db.calls.find((c) => c.table === "purchases" && c.op === "update");
    expect(eqValue(revoke!, "stripe_session_id")).toBe("cs_test_1");
    expect(db.rpcCalls).toEqual([{ name: "refund_ticket_sale", args: { p_session_id: "cs_test_1" } }]);
    const stopJob = db.calls.find((c) => c.table === "mint_jobs" && c.op === "update");
    expect(stopJob?.payload).toMatchObject({ status: "failed" });
  });

  it("partial refund: rescales gross, fee and net by the row's own ratio", async () => {
    db = fakeDb({
      stripe_webhook_events: () => ({ data: null, error: null }),
      resale_offers: () => ({ data: null }),
      organizer_refunds: () => ({ data: null }),
      payouts: (c) => (c.op === "select" ? { data: payoutRow } : { data: null, error: null }),
    });
    const res = await post({
      id: "evt_ref_2", type: "charge.refunded",
      data: { object: { id: "ch_1", amount: 2_238, amount_refunded: 1_119, refunded: false, payment_intent: "pi_1" } },
    });
    expect(res.status).toBe(200);
    const update = db.calls.find((c) => c.table === "payouts" && c.op === "update");
    // Half the charge stays: 1119 gross, fee 238 × 1119/2238 = 119, net 1000.
    expect(update?.payload).toMatchObject({ gross_cents: 1_119, fee_cents: 119, buyer_fee_cents: 119, net_cents: 1_000 });
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.calls.some((c) => c.table === "purchases")).toBe(false);
  });

  it("skips a refund the organizer triggered from the dashboard", async () => {
    db = fakeDb({
      stripe_webhook_events: () => ({ data: null, error: null }),
      resale_offers: () => ({ data: null }),
      organizer_refunds: () => ({ data: { id: "or-1" } }),
      payouts: () => { throw new Error("must not touch payouts"); },
    });
    const res = await post({
      id: "evt_ref_3", type: "charge.refunded",
      data: { object: { id: "ch_1", amount: 2_238, amount_refunded: 1_119, refunded: false, payment_intent: "pi_1" } },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, organizerRefund: true });
  });

  it("refund after the transfer only flags the row for manual recovery", async () => {
    db = fakeDb({
      stripe_webhook_events: () => ({ data: null, error: null }),
      resale_offers: () => ({ data: null }),
      organizer_refunds: () => ({ data: null }),
      payouts: (c) => (c.op === "select" ? { data: { ...payoutRow, status: "paid" } } : { data: null, error: null }),
    });
    const res = await post({
      id: "evt_ref_4", type: "charge.refunded",
      data: { object: { id: "ch_1", amount: 2_238, amount_refunded: 2_238, refunded: true, payment_intent: "pi_1" } },
    });
    expect(res.status).toBe(200);
    const update = db.calls.find((c) => c.table === "payouts" && c.op === "update");
    expect(update?.payload).not.toHaveProperty("status");
    expect(String((update?.payload as { failure_reason: string }).failure_reason)).toContain("AFTER transfer");
    expect(db.calls.some((c) => c.table === "purchases")).toBe(false);
  });
});

describe("unhandled and unknown events", () => {
  it("acknowledges an unhandled type without claiming it", async () => {
    db = fakeDb({});
    const res = await post({ id: "evt_x", type: "payment_intent.created", data: { object: {} } });
    expect(res.status).toBe(200);
    expect(db.calls).toHaveLength(0);
  });
});
