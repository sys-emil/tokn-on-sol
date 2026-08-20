import { describe, expect, it } from "vitest";
import {
  FEE_PAYERS,
  MIN_ORGANIZER_NET_CENTS,
  minUnitPriceCentsFor,
  serviceFeePerTicketCents,
  splitServiceFee,
  type FeePayer,
} from "@/lib/fees";

describe("splitServiceFee", () => {
  it("buyer mode puts the whole fee on the buyer", () => {
    expect(splitServiceFee(2_500, "buyer")).toEqual({
      buyerCents: 178, organizerCents: 0, totalCents: 178,
    });
  });

  it("organizer mode puts the whole fee on the organizer", () => {
    expect(splitServiceFee(2_500, "organizer")).toEqual({
      buyerCents: 0, organizerCents: 178, totalCents: 178,
    });
  });

  it("splits an even fee down the middle", () => {
    // €20 → fee €1.48
    expect(splitServiceFee(2_000, "split")).toEqual({
      buyerCents: 74, organizerCents: 74, totalCents: 148,
    });
  });

  it("gives the odd cent of a split to the organizer", () => {
    // €0.75 → the 99-cent floor; above the 51-cent price floor, clamp idle.
    expect(serviceFeePerTicketCents(75)).toBe(99);
    expect(splitServiceFee(75, "split")).toEqual({
      buyerCents: 49, organizerCents: 50, totalCents: 99,
    });
  });

  it("free tickets carry no fee in any mode", () => {
    for (const payer of FEE_PAYERS) {
      expect(splitServiceFee(0, payer)).toEqual({
        buyerCents: 0, organizerCents: 0, totalCents: 0,
      });
    }
  });

  it("rolls the organizer's excess share over to the buyer (deep discount)", () => {
    // A 90% code on a €5 ticket: fee 99 > price 50, so the organizer's share
    // caps at the price and the buyer covers the rest. Net stays 0, never
    // negative, and the platform still collects its full 99.
    expect(splitServiceFee(50, "organizer")).toEqual({
      buyerCents: 49, organizerCents: 50, totalCents: 99,
    });
    expect(splitServiceFee(40, "split")).toEqual({
      buyerCents: 59, organizerCents: 40, totalCents: 99,
    });
  });

  it("conserves the platform take and never goes negative", () => {
    for (let price = 0; price <= 5_000; price += 7) {
      for (const payer of FEE_PAYERS) {
        const { buyerCents, organizerCents, totalCents } = splitServiceFee(price, payer);
        expect(buyerCents + organizerCents).toBe(totalCents);
        expect(totalCents).toBe(serviceFeePerTicketCents(price));
        expect(buyerCents).toBeGreaterThanOrEqual(0);
        expect(organizerCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("keeps gross >= fee, so a payout row can never book more fee than gross", () => {
    for (let price = 0; price <= 5_000; price += 7) {
      for (const payer of FEE_PAYERS) {
        const { buyerCents, organizerCents, totalCents } = splitServiceFee(price, payer);
        expect(price + buyerCents).toBeGreaterThanOrEqual(totalCents);
        expect(price - organizerCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("minUnitPriceCentsFor", () => {
  it("has no floor when the buyer pays", () => {
    expect(minUnitPriceCentsFor("buyer")).toBe(0);
  });

  it("floors a split at 51 cents and an absorbed fee at 100 cents", () => {
    expect(minUnitPriceCentsFor("split")).toBe(51);
    expect(minUnitPriceCentsFor("organizer")).toBe(100);
  });

  it("leaves the organizer something at the floor and nothing one cent below", () => {
    for (const payer of ["split", "organizer"] as FeePayer[]) {
      const floor = minUnitPriceCentsFor(payer);
      const at = floor - splitServiceFee(floor, payer).organizerCents;
      const below = (floor - 1) - splitServiceFee(floor - 1, payer).organizerCents;
      expect(at).toBeGreaterThanOrEqual(MIN_ORGANIZER_NET_CENTS);
      expect(below).toBeLessThan(MIN_ORGANIZER_NET_CENTS);
    }
  });
});
