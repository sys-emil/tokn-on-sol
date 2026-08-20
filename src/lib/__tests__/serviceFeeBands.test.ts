import { describe, expect, it } from "vitest";
import {
  MIN_SERVICE_FEE_CENTS,
  SERVICE_FEE_BANDS,
  serviceFeePerTicketCents,
} from "@/lib/fees";

/**
 * Guards the *shape* of the fee schedule rather than single values: it must
 * never fall as the price rises, and it must always out-earn the payment
 * provider. Both are properties a future "let's just lower the percentage a bit"
 * change can break silently, which is exactly what these tests are here for.
 */
describe("service fee bands", () => {
  it("never falls as the price rises", () => {
    let previous = -1;
    for (let price = 0; price <= 50_000; price++) {
      const fee = serviceFeePerTicketCents(price);
      expect(fee).toBeGreaterThanOrEqual(previous);
      previous = fee;
    }
  });

  it("charges exactly the marginal bands at their edges", () => {
    expect(serviceFeePerTicketCents(1_500)).toBe(119); // 7.9% of €15
    expect(serviceFeePerTicketCents(5_000)).toBe(325); // + 5.9% of €35
    expect(serviceFeePerTicketCents(10_000)).toBe(550); // + 4.5% of €50
  });

  it("holds the floor until the percentage overtakes it, then lets go", () => {
    // Crossover is derived, not hardcoded, so it follows the bands.
    let crossover = 0;
    for (let price = 1; price <= 5_000; price++) {
      if (serviceFeePerTicketCents(price) > MIN_SERVICE_FEE_CENTS) { crossover = price; break; }
    }
    expect(crossover).toBeGreaterThan(1_200); // ≈ €12.60 at 7.9%
    for (let price = 1; price < crossover; price++) {
      expect(serviceFeePerTicketCents(price)).toBe(MIN_SERVICE_FEE_CENTS);
    }
  });

  /**
   * PayPal is the most expensive method we accept (≈2.99% + €0.35 on the total
   * the buyer pays). If the fee ever dipped below that, a sale would cost money
   * to make. Card and Klarna are cheaper, so clearing PayPal clears all of them.
   */
  it("out-earns PayPal at every price", () => {
    for (let price = 1; price <= 50_000; price += 3) {
      const fee = serviceFeePerTicketCents(price);
      const stripeCost = 0.0299 * (price + fee) + 35;
      expect(fee).toBeGreaterThan(stripeCost);
    }
  });

  it("keeps the lowest marginal rate above the payment cost", () => {
    const lowest = SERVICE_FEE_BANDS[SERVICE_FEE_BANDS.length - 1];
    // An absolute cap would be a rate of 0% on the excess and would eventually
    // lose money; the open-ended band must stay clear of PayPal's 2.99%.
    expect(lowest.upToCents).toBe(Number.POSITIVE_INFINITY);
    expect(lowest.bps).toBeGreaterThan(299);
  });

  it("keeps the bands ordered and open-ended", () => {
    for (let i = 1; i < SERVICE_FEE_BANDS.length; i++) {
      expect(SERVICE_FEE_BANDS[i].upToCents).toBeGreaterThan(SERVICE_FEE_BANDS[i - 1].upToCents);
      expect(SERVICE_FEE_BANDS[i].bps).toBeLessThan(SERVICE_FEE_BANDS[i - 1].bps);
    }
  });
});
