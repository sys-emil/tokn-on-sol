import { describe, expect, it } from "vitest";
import {
  buildCohorts,
  channelFromReferrer,
  dayKey,
  dayKeys,
  forecastEvent,
  inSegment,
  monthsBetween,
  parseRange,
  parseSegment,
  pctChange,
  recentMonths,
  share,
  startOfDay,
  type CustomerStats,
} from "@/lib/proAnalytics";

describe("parseRange", () => {
  it("accepts the selectable windows and falls back to 30", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("365")).toBe(365);
    expect(parseRange("31")).toBe(30);
    expect(parseRange(null)).toBe(30);
  });
});

describe("day buckets", () => {
  it("uses UTC everywhere, so generated keys match Postgres timestamps", () => {
    // 00:30 Berlin on 2026-07-26 is 22:30 UTC on the 25th; both sides of the
    // series must agree on which bucket that is.
    const berlinMidnight = new Date("2026-07-26T00:30:00+02:00");
    expect(dayKey(startOfDay(berlinMidnight))).toBe(dayKey(berlinMidnight));
  });

  it("lists consecutive days oldest first, ending today", () => {
    const keys = dayKeys(3, new Date("2026-07-26T12:00:00Z"));
    expect(keys).toEqual(["2026-07-24", "2026-07-25", "2026-07-26"]);
  });
});

describe("pctChange / share", () => {
  it("rounds to one decimal", () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(133, 100)).toBe(33);
    expect(pctChange(1, 3)).toBe(-66.7);
  });

  it("has no baseline when the previous period was empty", () => {
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
  });

  it("never divides by zero", () => {
    expect(share(3, 0)).toBe(0);
    expect(share(1, 3)).toBe(33.3);
  });
});

describe("channelFromReferrer", () => {
  it("maps known networks", () => {
    expect(channelFromReferrer("https://www.instagram.com/p/abc")).toBe("Instagram");
    expect(channelFromReferrer("https://l.instagram.com/?u=x")).toBe("Instagram");
    expect(channelFromReferrer("https://www.tiktok.com/@x")).toBe("TikTok");
    expect(channelFromReferrer("https://www.google.de/search?q=x")).toBe("Google");
    expect(channelFromReferrer("https://wa.me/123")).toBe("WhatsApp");
  });

  it("treats no referrer and own pages as direct traffic", () => {
    expect(channelFromReferrer(null)).toBe("Direkt / Link");
    expect(channelFromReferrer("")).toBe("Direkt / Link");
    expect(channelFromReferrer("https://getpassly.de/events", "getpassly.de")).toBe("Direkt / Link");
    expect(channelFromReferrer("https://www.getpassly.de/@club", "getpassly.de")).toBe("Direkt / Link");
  });

  it("buckets everything else", () => {
    expect(channelFromReferrer("https://news.example.com/x")).toBe("Sonstige");
    expect(channelFromReferrer("nonsense")).toBe("Sonstige");
  });
});

describe("forecastEvent", () => {
  const recent = (perDay: number, days = 14) => new Array<number>(days).fill(perDay);

  it("projects the recent pace to the event date", () => {
    const f = forecastEvent({ sold: 100, capacity: 200, recentSales: recent(5), daysLeft: 10 });
    expect(f.forecastPct).toBe(75); // 100 + 5 * 10 = 150 von 200
    expect(f.daysToSellOut).toBe(20);
  });

  it("caps the projection at capacity and reports the sell-out day", () => {
    const f = forecastEvent({ sold: 180, capacity: 200, recentSales: recent(10), daysLeft: 10 });
    expect(f.forecastPct).toBe(100);
    expect(f.daysToSellOut).toBe(2);
    expect(f.kind).toBe("ok");
  });

  it("flags a stalling event", () => {
    const f = forecastEvent({ sold: 40, capacity: 400, recentSales: recent(1), daysLeft: 10 });
    expect(f.forecastPct).toBe(13);
    expect(f.kind).toBe("warn");
  });

  it("stays neutral without enough history", () => {
    expect(forecastEvent({ sold: 2, capacity: 100, recentSales: [1, 1], daysLeft: 30 }).kind).toBe("neutral");
  });

  it("does not project into the past", () => {
    const f = forecastEvent({ sold: 90, capacity: 100, recentSales: recent(3), daysLeft: 0 });
    expect(f.forecastPct).toBe(90);
    expect(f.daysToSellOut).toBeNull();
    expect(f.kind).toBe("neutral");
  });
});

describe("inSegment", () => {
  const base: CustomerStats = { events: 1, spendCents: 1000, daysSinceLast: 5, daysSinceFirst: 5 };

  it("matches Stammgäste from three events", () => {
    expect(inSegment("stamm", { ...base, events: 2 })).toBe(false);
    expect(inSegment("stamm", { ...base, events: 3 })).toBe(true);
  });

  it("only puts returning guests at risk", () => {
    expect(inSegment("risk", { ...base, events: 1, daysSinceLast: 90 })).toBe(false);
    expect(inSegment("risk", { ...base, events: 2, daysSinceLast: 90 })).toBe(true);
    expect(inSegment("risk", { ...base, events: 2, daysSinceLast: 59 })).toBe(false);
  });

  it("uses lifetime spend for VIPs", () => {
    expect(inSegment("vip", { ...base, spendCents: 49_999 })).toBe(false);
    expect(inSegment("vip", { ...base, spendCents: 50_000 })).toBe(true);
  });

  it("passes everyone through for 'alle'", () => {
    expect(inSegment("alle", base)).toBe(true);
  });

  it("falls back to 'alle' for unknown ids", () => {
    expect(parseSegment("bogus")).toBe("alle");
    expect(parseSegment("vip")).toBe("vip");
  });
});

describe("cohorts", () => {
  it("counts whole months between keys", () => {
    expect(monthsBetween("2026-01", "2026-03")).toBe(2);
    expect(monthsBetween("2025-11", "2026-02")).toBe(3);
  });

  it("lists the trailing months oldest first", () => {
    expect(recentMonths(3, new Date(Date.UTC(2026, 6, 26)))).toEqual(["2026-05", "2026-06", "2026-07"]);
  });

  it("reports retention per cohort and leaves the future empty", () => {
    const now = new Date(Date.UTC(2026, 6, 26)); // Juli 2026
    const months = recentMonths(3, now); // Mai, Juni, Juli
    const rows = buildCohorts(
      [
        { wallet: "a", months: new Set(["2026-05", "2026-06"]) },
        { wallet: "b", months: new Set(["2026-05"]) },
        { wallet: "c", months: new Set(["2026-07"]) },
      ],
      months,
      3,
      now,
    );

    const mai = rows[0];
    expect(mai.month).toBe("2026-05");
    expect(mai.size).toBe(2);
    expect(mai.cells[0]).toBe(100);
    expect(mai.cells[1]).toBe(50); // nur Wallet a kam im Folgemonat wieder
    expect(mai.cells[2]).toBe(0);

    const juli = rows[2];
    expect(juli.size).toBe(1);
    expect(juli.cells[0]).toBe(100);
    // +1 und +2 liegen in der Zukunft und sind noch unbekannt, nicht 0.
    expect(juli.cells[1]).toBeNull();
    expect(juli.cells[2]).toBeNull();
  });
});
