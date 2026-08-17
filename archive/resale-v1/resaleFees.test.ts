import { describe, expect, it } from "vitest";
import {
  resaleFeeBps,
  resaleFeeCents,
  resaleFeeBreakdown,
  resaleNetProceedsCents,
  maxResalePriceCents,
} from "@/lib/fees";

describe("resaleFeeBps (gentle markup ramp)", () => {
  it("charges the 8% base at or below face value", () => {
    expect(resaleFeeBps(0)).toBe(800);
    expect(resaleFeeBps(-500)).toBe(800); // clamped
    expect(resaleFeeBps(499)).toBe(800); // < 5% markup, still base
  });

  it("adds 1 percentage point per 5% of markup", () => {
    expect(resaleFeeBps(500)).toBe(900); // 5% -> 9%
    expect(resaleFeeBps(1_000)).toBe(1_000); // 10% -> 10%
    expect(resaleFeeBps(2_000)).toBe(1_200); // 20% -> 12%
  });

  it("caps the rate at 15%", () => {
    expect(resaleFeeBps(7_000)).toBe(1_500); // 70% would be 22% -> capped
    expect(resaleFeeBps(20_000)).toBe(1_500);
  });
});

describe("resaleFeeBreakdown (50/50 split)", () => {
  it("splits an 8% fee at face value and conserves money", () => {
    // €40 face, €40 list -> 8% = €3.20 total, €1.60 each.
    const b = resaleFeeBreakdown(4_000, 4_000);
    expect(b.totalFeeCents).toBe(320);
    expect(b.buyerFeeCents).toBe(160);
    expect(b.sellerFeeCents).toBe(160);
    expect(b.sellerNetCents).toBe(3_840); // seller receives list - half
    expect(b.buyerTotalCents).toBe(4_160); // buyer pays list + half
    // Money is conserved.
    expect(b.buyerTotalCents).toBe(b.sellerNetCents + b.totalFeeCents);
  });

  it("applies the markup ramp on a profitable resale", () => {
    // €40 face, €48 list (20% markup) -> 12% = €5.76 total.
    const b = resaleFeeBreakdown(4_800, 4_000);
    expect(b.totalFeeCents).toBe(576);
    expect(b.buyerFeeCents).toBe(288);
    expect(b.sellerFeeCents).toBe(288);
    expect(b.sellerNetCents).toBe(4_512);
    expect(b.buyerTotalCents).toBe(5_088);
  });

  it("stays at the base rate below face value", () => {
    // €50 face, €40 list -> markup clamped to 0 -> 8% = €3.20.
    const b = resaleFeeBreakdown(4_000, 5_000);
    expect(b.totalFeeCents).toBe(320);
    expect(b.sellerNetCents).toBe(3_840);
  });

  it("splits an odd fee so the two halves still sum to the total", () => {
    // A total that is odd in cents: buyer half rounds up, seller half is the rest.
    const b = resaleFeeBreakdown(501, 501); // 8% of 501 = 40.08 -> 40 cents
    expect(b.buyerFeeCents + b.sellerFeeCents).toBe(b.totalFeeCents);
  });

  it("floors the fee at €0.50 for cheap resales", () => {
    // €5 face, €5 list -> 8% = €0.40, below the €0.50 floor -> €0.50 total.
    const b = resaleFeeCents(500, 500);
    expect(b).toBe(50);
    // Seller keeps list minus their (floored) half.
    expect(resaleNetProceedsCents(500, 500)).toBe(475);
  });

  it("uses the percentage once it exceeds the floor", () => {
    // €7 list -> 8% = €0.56, above the €0.50 floor -> percentage wins.
    expect(resaleFeeCents(700, 700)).toBe(56);
  });

  it("falls back to the base rate when face value is unknown (0)", () => {
    expect(resaleFeeCents(5_000, 0)).toBe(400); // 8% of €50
  });

  it("rejects invalid inputs", () => {
    expect(() => resaleFeeBreakdown(0, 5_000)).toThrow();
    expect(() => resaleFeeBreakdown(-1, 5_000)).toThrow();
    expect(() => resaleFeeBreakdown(5_000, -1)).toThrow();
    expect(() => resaleFeeBreakdown(50.5, 5_000)).toThrow();
  });
});

describe("maxResalePriceCents (organizer markup cap)", () => {
  it("returns face value plus the capped markup", () => {
    expect(maxResalePriceCents(5_000, 20)).toBe(6_000); // €50 + 20%
    expect(maxResalePriceCents(5_000, 0)).toBe(5_000); // no markup allowed
    expect(maxResalePriceCents(3_333, 10)).toBe(3_666); // floor of the markup
  });

  it("rejects invalid inputs", () => {
    expect(() => maxResalePriceCents(-1, 20)).toThrow();
    expect(() => maxResalePriceCents(5_000, -1)).toThrow();
  });
});
