import { describe, expect, it } from "vitest";
import {
  resaleFeeBps,
  resaleFeeCents,
  resaleNetProceedsCents,
  maxResalePriceCents,
} from "@/lib/fees";

describe("resaleFeeBps (markup-scaled percentage)", () => {
  it("charges the 8% base below 10% markup", () => {
    expect(resaleFeeBps(0)).toBe(800);
    expect(resaleFeeBps(500)).toBe(800); // 5%
    expect(resaleFeeBps(999)).toBe(800); // 9.99%
  });

  it("jumps to 12% at exactly 10% markup", () => {
    expect(resaleFeeBps(1_000)).toBe(1_200);
    expect(resaleFeeBps(1_499)).toBe(1_200); // still within the 10–14.99% band
  });

  it("adds 2% for every further 5% of markup", () => {
    expect(resaleFeeBps(1_500)).toBe(1_400); // 15% → 14%
    expect(resaleFeeBps(2_000)).toBe(1_600); // 20% → 16%
    expect(resaleFeeBps(2_500)).toBe(1_800); // 25% → 18%
    expect(resaleFeeBps(5_000)).toBe(2_800); // 50% → 28%
  });
});

describe("resaleFeeCents (€1 base + markup-scaled % of list price)", () => {
  it("uses the 8% base when selling at face value", () => {
    // €50 face, €50 list → €1 + 8% of €50 = €1 + €4 = €5
    expect(resaleFeeCents(5_000, 5_000)).toBe(500);
    expect(resaleNetProceedsCents(5_000, 5_000)).toBe(4_500);
  });

  it("stays at the base rate when selling below face value", () => {
    // €40 list, €50 face → markup clamped to 0 → €1 + 8% of €40 = €4.20
    expect(resaleFeeCents(4_000, 5_000)).toBe(420);
    expect(resaleNetProceedsCents(4_000, 5_000)).toBe(3_580);
  });

  it("charges 12% at a 10% markup", () => {
    // €55 list, €50 face (10%) → €1 + 12% of €55 = €1 + €6.60 = €7.60
    expect(resaleFeeCents(5_500, 5_000)).toBe(760);
  });

  it("charges 14% at a 15% markup, 16% at 20%", () => {
    expect(resaleFeeCents(5_750, 5_000)).toBe(905); // €1 + 14% of €57.50
    expect(resaleFeeCents(6_000, 5_000)).toBe(1_060); // €1 + 16% of €60
  });

  it("falls back to the base rate when face value is unknown (0)", () => {
    expect(resaleFeeCents(5_000, 0)).toBe(500); // €1 + 8% of €50
  });

  it("rejects invalid inputs", () => {
    expect(() => resaleFeeCents(0, 5_000)).toThrow();
    expect(() => resaleFeeCents(-1, 5_000)).toThrow();
    expect(() => resaleFeeCents(5_000, -1)).toThrow();
    expect(() => resaleFeeCents(50.5, 5_000)).toThrow();
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
