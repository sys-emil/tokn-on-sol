import { describe, expect, it } from "vitest";
import { eventCardView, daysUntil, isRecent } from "@/lib/eventCardView";
import { isVipTier } from "@/lib/tier";

const NOW = new Date("2026-08-03T12:00:00Z");
const base = { capacity: 100, ticketsSold: 0, date: "2026-12-01", now: NOW };

describe("eventCardView", () => {
  it("zaehlt Reservierungen als belegt", () => {
    const v = eventCardView({ ...base, ticketsSold: 40, ticketsReserved: 10 });
    expect(v.pctSold).toBe(50);
    expect(v.pctLeft).toBe(50);
    expect(v.soldOut).toBe(false);
    expect(v.barColor).toBe("var(--accent)");
  });

  it("ist ausverkauft, sobald verkauft plus reserviert die Kapazitaet erreicht", () => {
    const v = eventCardView({ ...base, ticketsSold: 95, ticketsReserved: 5 });
    expect(v.soldOut).toBe(true);
    expect(v.fillPct).toBe(100);
    expect(v.barColor).toBe("var(--ink-4)");
    expect(v.progress).toEqual({ key: "events.soldOutZero" });
  });

  it("bietet ausverkauft die Warteliste an, wenn der Veranstalter Pro hat", () => {
    const withList = eventCardView({ ...base, ticketsSold: 100, hasWaitlist: true });
    const without = eventCardView({ ...base, ticketsSold: 100, hasWaitlist: false });
    expect(withList.badge).toEqual({ key: "events.waitlistBadge" });
    expect(without.badge).toEqual({ key: "events.soldOut" });
  });

  it("warnt ab 95 Prozent, aber nur solange nicht ausverkauft", () => {
    const v = eventCardView({ ...base, ticketsSold: 96 });
    expect(v.urgent).toBe(true);
    expect(v.barColor).toBe("var(--bad)");
    expect(v.progress).toEqual({ key: "events.almostSoldOut" });
    expect(eventCardView({ ...base, ticketsSold: 100 }).urgent).toBe(false);
  });

  it("laesst Naehe vor Neuheit vor Restmenge gewinnen", () => {
    const today = eventCardView({ ...base, date: "2026-08-03", createdAt: NOW.toISOString() });
    expect(today.badge).toEqual({ key: "events.today" });

    const tomorrow = eventCardView({ ...base, date: "2026-08-04" });
    expect(tomorrow.badge).toEqual({ key: "events.tomorrow" });

    const fresh = eventCardView({ ...base, createdAt: "2026-08-01T09:00:00Z" });
    expect(fresh.badge).toEqual({ key: "events.isNew" });

    const plain = eventCardView({ ...base, ticketsSold: 30, createdAt: "2026-01-01T00:00:00Z" });
    expect(plain.badge).toEqual({ key: "events.percentLeft", vars: { percent: 70 } });
  });

  it("zeigt nie 0 Prozent Rest, solange noch etwas frei ist", () => {
    // 999 von 1000 sind gerundet 100 % verkauft, aber ein Platz ist noch da.
    const v = eventCardView({ ...base, capacity: 1000, ticketsSold: 999 });
    expect(v.soldOut).toBe(false);
    expect(v.pctLeft).toBe(1);
  });

  it("behandelt Kapazitaet 0 als ausverkauft und zeigt keinen Balken", () => {
    const v = eventCardView({ ...base, capacity: 0 });
    expect(v.soldOut).toBe(true);
    expect(v.progress).toBeNull();
    expect(v.badge).toEqual({ key: "events.soldOut" });
    expect(v.urgent).toBe(false);
  });
});

describe("daysUntil / isRecent", () => {
  it("rechnet in ganzen Tagen ab Mitternacht", () => {
    expect(daysUntil("2026-08-03", NOW)).toBe(0);
    expect(daysUntil("2026-08-04", NOW)).toBe(1);
    expect(daysUntil("2026-08-10", NOW)).toBe(7);
  });

  it("nennt nur die letzten sieben Tage neu", () => {
    expect(isRecent("2026-08-01T00:00:00Z", NOW)).toBe(true);
    expect(isRecent("2026-07-20T00:00:00Z", NOW)).toBe(false);
    expect(isRecent(null, NOW)).toBe(false);
  });
});

describe("isVipTier", () => {
  it("erkennt VIP als eigenes Wort, unabhaengig von Gross- und Kleinschreibung", () => {
    expect(isVipTier("VIP")).toBe(true);
    expect(isVipTier("vip lounge")).toBe(true);
    expect(isVipTier("Early Bird VIP")).toBe(true);
  });

  it("faellt nicht auf Woerter herein, die VIP nur enthalten", () => {
    expect(isVipTier("Vipassana-Retreat")).toBe(false);
    expect(isVipTier("Standard")).toBe(false);
    expect(isVipTier(null)).toBe(false);
  });
});
