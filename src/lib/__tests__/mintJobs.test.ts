import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, eqValue, type FakeDb } from "./fakeSupabase";

/**
 * Der Mint-Worker gegen die Datenbank-Attrappe: Lieferung, Wiederholung,
 * endgueltiges Scheitern mit einmaliger Auto-Erstattung. Solana, Mail, PDF
 * und Abzeichen sind gemockt — geprueft wird die Buchhaltung.
 */

let db: FakeDb;
const mintTicket = vi.fn();
const refundsCreate = vi.fn();
const sendTicketConfirmation = vi.fn<(args: unknown) => Promise<void>>(async () => undefined);
const sendAdminAlert = vi.fn<(args: unknown) => Promise<void>>(async () => undefined);

vi.mock("@/lib/supabase", () => ({ get supabaseAdmin() { return db; } }));
vi.mock("@/lib/stripe", () => ({ stripe: { refunds: { create: refundsCreate } }, PLATFORM_FEE_BPS: 300 }));
vi.mock("@/lib/mint", () => ({ mintTicket }));
vi.mock("@/lib/email", () => ({ sendTicketConfirmation, sendAdminAlert }));
vi.mock("@/lib/badges", () => ({ checkPurchaseBadges: vi.fn(async () => undefined) }));
vi.mock("@/lib/receipt", () => ({ loadReceiptInput: vi.fn(async () => null), buildReceiptPdf: vi.fn() }));
vi.mock("@/lib/resaleReturn", () => ({ settleReturnRefund: vi.fn(async () => null) }));
vi.mock("@/lib/seasonPass", () => ({ passEventDates: vi.fn(async () => []) }));
vi.mock("@/lib/observe", () => ({ reportError: vi.fn(), reportAlert: vi.fn() }));

const JOB = {
  id: "job-1",
  stripe_session_id: "cs_1",
  event_id: "evt-1",
  season_pass_id: null,
  tier_id: "tier-1",
  buyer_wallet: "Wallet111",
  buyer_email: "gast@example.test",
  quantity: 2,
  status: "processing",
  lang: "de",
  source: "online",
  admit_immediately: false,
  attempts: 1,
  last_error: null,
  refund_id: null,
};

const EVENT = { id: "evt-1", name: "Konzert", date: "2099-05-01", start_time: "20:00", venue: "Halle", description: null, metadata_uri: null };

type Handler = (c: import("./fakeSupabase").Call) => { data?: unknown; error?: { message: string } | null } | undefined;
type Tables = Record<string, Handler> & { _purchases: () => { asset_id: string }[] };

function baseTables(overrides: Record<string, Handler> = {}): Tables {
  const purchases: { asset_id: string }[] = [];
  return {
    events: () => ({ data: EVENT }),
    purchases: (c: import("./fakeSupabase").Call) => {
      if (c.op === "insert") { purchases.push({ asset_id: (c.payload as { asset_id: string }).asset_id }); return { data: null, error: null }; }
      return { data: purchases };
    },
    mint_jobs: () => ({ data: [], error: null }),
    guest_orders: () => ({ data: null }),
    ...overrides,
    _purchases: () => purchases,
  } as unknown as Tables;
}

beforeEach(() => {
  mintTicket.mockReset();
  refundsCreate.mockReset();
  sendTicketConfirmation.mockClear();
  sendAdminAlert.mockClear();
  // Kein echtes Warten im Backoff.
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => { fn(); return 0 as unknown as ReturnType<typeof setTimeout>; }) as typeof setTimeout);
});

describe("processMintJobs", () => {
  it("mints every ticket of a claimed job, marks it done and mails the buyer once", async () => {
    let n = 0;
    mintTicket.mockImplementation(async () => ({ assetId: `asset-${++n}`, signature: `sig-${n}` }));
    db = fakeDb(baseTables(), (name) => (name === "claim_mint_jobs" ? { data: [JOB] } : name === "claim_resale_offer" ? { data: null } : undefined));

    const { processMintJobs } = await import("@/lib/mintJobs");
    const result = await processMintJobs(5, "https://example.test");

    expect(result).toEqual({ claimed: 1, minted: 2 });
    const inserts = db.calls.filter((c) => c.table === "purchases" && c.op === "insert");
    expect(inserts).toHaveLength(2);
    expect(inserts[0].payload).toMatchObject({ event_id: "evt-1", tier_id: "tier-1", buyer_wallet: "Wallet111", stripe_session_id: "cs_1", source: "online" });
    const done = db.calls.find((c) => c.table === "mint_jobs" && c.op === "update" && (c.payload as { status?: string }).status === "done");
    expect(done).toBeDefined();
    expect(eqValue(done!, "id")).toBe("job-1");
    expect(sendTicketConfirmation).toHaveBeenCalledTimes(1);
    const mail = sendTicketConfirmation.mock.calls[0][0] as unknown as { assetIds: string[]; calendar: { eventId: string; ics: string } | null };
    expect(mail.assetIds).toEqual(["asset-1", "asset-2"]);
    expect(mail.calendar?.eventId).toBe("evt-1");
    expect(mail.calendar?.ics).toContain("BEGIN:VEVENT");
  });

  it("only mints what is still missing on a re-run", async () => {
    mintTicket.mockResolvedValue({ assetId: "asset-2", signature: "sig-2" });
    const tables = baseTables();
    // Ein Ticket aus dem ersten Lauf liegt schon in purchases.
    tables._purchases().push({ asset_id: "asset-1" });
    db = fakeDb(tables, (name) => (name === "claim_mint_jobs" ? { data: [JOB] } : { data: null }));

    const { processMintJobs } = await import("@/lib/mintJobs");
    const result = await processMintJobs(5, "https://example.test");
    expect(result.minted).toBe(1);
    expect(mintTicket).toHaveBeenCalledTimes(1);
  });

  it("re-queues a job whose mint keeps failing before the attempt limit, without refunding", async () => {
    mintTicket.mockRejectedValue(new Error("blockhash not found"));
    db = fakeDb(baseTables(), (name) => (name === "claim_mint_jobs" ? { data: [JOB] } : { data: null }));

    const { processMintJobs } = await import("@/lib/mintJobs");
    const result = await processMintJobs(5, "https://example.test");
    expect(result.minted).toBe(0);
    expect(mintTicket).toHaveBeenCalledTimes(3); // drei Versuche pro Ticket, dann Abbruch
    // Der erste mint_jobs-Update ist der Sweep haengender Jobs; gesucht ist der zu diesem Job.
    const update = db.calls.find((c) => c.table === "mint_jobs" && c.op === "update" && eqValue(c, "id") === "job-1");
    expect(update?.payload).toMatchObject({ status: "queued", last_error: "blockhash not found" });
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(sendAdminAlert).not.toHaveBeenCalled();
  });

  it("on the final attempt fails the job and refunds exactly the unminted share once", async () => {
    mintTicket.mockRejectedValue(new Error("tree full"));
    refundsCreate.mockResolvedValue({ id: "re_1" });
    const tables = baseTables({
      payouts: () => ({ data: { payment_intent_id: "pi_1", charge_id: "ch_1", gross_cents: 2_238, currency: "eur", status: "pending" } }),
      mint_jobs: (c) => {
        // Das Refund-Gate: nur der erste CAS auf refund_id IS NULL trifft.
        if (c.op === "update" && (c.payload as { refund_id?: string }).refund_id === "pending") return { data: [{ id: "job-1" }] };
        return { data: [], error: null };
      },
    });
    tables._purchases().push({ asset_id: "asset-1" }); // 1 von 2 geliefert
    db = fakeDb(tables, (name) => (name === "claim_mint_jobs" ? { data: [{ ...JOB, attempts: 5 }] } : { data: null }));

    const { processMintJobs } = await import("@/lib/mintJobs");
    await processMintJobs(5, "https://example.test");

    const failed = db.calls.find((c) => c.table === "mint_jobs" && c.op === "update" && (c.payload as { status?: string }).status === "failed");
    expect(failed).toBeDefined();
    expect(refundsCreate).toHaveBeenCalledTimes(1);
    const [params, opts] = refundsCreate.mock.calls[0] as [Record<string, unknown>, { idempotencyKey: string }];
    expect(params).toMatchObject({ payment_intent: "pi_1", amount: 1_119 }); // halber Brutto fuer das eine fehlende Ticket
    expect(opts.idempotencyKey).toBe("mint-refund-job-1");
    // Der Sitz des ungelieferten Tickets wird frei, weil ein Teil geliefert ist.
    expect(db.rpcCalls.some((r) => r.name === "release_sold_seats" && (r.args as { p_quantity: number }).p_quantity === 1)).toBe(true);
    expect(sendAdminAlert).toHaveBeenCalledTimes(1);
  });

  it("does not refund a job that already carries a refund id", async () => {
    mintTicket.mockRejectedValue(new Error("tree full"));
    const tables = baseTables({
      payouts: () => ({ data: { payment_intent_id: "pi_1", charge_id: "ch_1", gross_cents: 2_238, currency: "eur", status: "pending" } }),
      mint_jobs: () => ({ data: [], error: null }), // CAS trifft nichts: schon beansprucht
    });
    db = fakeDb(tables, (name) => (name === "claim_mint_jobs" ? { data: [{ ...JOB, attempts: 5 }] } : { data: null }));

    const { processMintJobs } = await import("@/lib/mintJobs");
    await processMintJobs(5, "https://example.test");
    expect(refundsCreate).not.toHaveBeenCalled();
    const alert = sendAdminAlert.mock.calls[0][0] as unknown as { text: string };
    expect(alert.text).toContain("Refund already issued");
  });

  it("never auto-refunds once the organizer has been paid", async () => {
    mintTicket.mockRejectedValue(new Error("tree full"));
    const tables = baseTables({
      payouts: () => ({ data: { payment_intent_id: "pi_1", charge_id: "ch_1", gross_cents: 2_238, currency: "eur", status: "paid" } }),
    });
    db = fakeDb(tables, (name) => (name === "claim_mint_jobs" ? { data: [{ ...JOB, attempts: 5 }] } : { data: null }));

    const { processMintJobs } = await import("@/lib/mintJobs");
    await processMintJobs(5, "https://example.test");
    expect(refundsCreate).not.toHaveBeenCalled();
    const alert = sendAdminAlert.mock.calls[0][0] as unknown as { text: string };
    expect(alert.text).toContain("NO auto-refund");
  });
});
