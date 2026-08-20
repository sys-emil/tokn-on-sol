import { describe, expect, it } from "vitest";
import {
  RETURN_FEE_BPS,
  RETURN_FEE_MIN_CENTS,
  returnBreakdown,
  serviceFeePerTicketCents,
  splitServiceFee,
  FEE_PAYERS,
  type FeePayer,
} from "@/lib/fees";

describe("returnBreakdown", () => {
  it("takes 10 % off a normal ticket", () => {
    // 25 € Ticket → 2,50 € Gebühr, 22,50 € zurück
    expect(returnBreakdown(2_500)).toEqual({
      paidCents: 2_500, returnFeeCents: 250, refundCents: 2_250,
    });
  });

  it("applies the €1 floor on cheap tickets", () => {
    // 10 % von 5 € wären 50 Cent; der Mindestbetrag deckt Stripes Fixkosten.
    expect(returnBreakdown(500)).toEqual({
      paidCents: 500, returnFeeCents: RETURN_FEE_MIN_CENTS, refundCents: 400,
    });
  });

  it("switches from floor to percentage at the crossover", () => {
    // Ab 10 € schlägt der Prozentsatz den Mindestbetrag.
    expect(returnBreakdown(1_000).returnFeeCents).toBe(RETURN_FEE_MIN_CENTS);
    expect(returnBreakdown(1_100).returnFeeCents).toBe(110);
  });

  // Der Verkäufer darf niemals Geld schulden: bei einem Ticket unter dem
  // Mindestbetrag wird die Gebühr gedeckelt statt die Erstattung negativ.
  it("never produces a negative refund", () => {
    expect(returnBreakdown(50)).toEqual({ paidCents: 50, returnFeeCents: 50, refundCents: 0 });
    expect(returnBreakdown(0)).toEqual({ paidCents: 0, returnFeeCents: 0, refundCents: 0 });
  });

  // Die harte Grenze des ganzen Modells: Stripe erstattet nie mehr als den
  // ursprünglichen Charge. Wäre das verletzt, wäre es ein echter Verlust.
  it("never refunds more than was paid", () => {
    for (const paid of [1, 49, 100, 999, 2_500, 12_345, 100_000]) {
      const b = returnBreakdown(paid);
      expect(b.refundCents).toBeLessThanOrEqual(paid);
      expect(b.refundCents + b.returnFeeCents).toBe(paid);
    }
  });

  it("rejects nonsensical input rather than guessing", () => {
    expect(() => returnBreakdown(-1)).toThrow();
    expect(() => returnBreakdown(12.5)).toThrow();
  });

  it("uses the documented rate", () => {
    expect(RETURN_FEE_BPS).toBe(1_000);
    expect(returnBreakdown(10_000).returnFeeCents).toBe(1_000);
  });
});

describe("Zahlungsfähigkeit des Weiterverkaufs", () => {
  // Der Käufer zahlt den normalen Primärpreis, der Verkäufer bekommt
  // (gezahlt − Gebühr). Passly darf in keinem Gebührenmodell draufzahlen:
  // was hereinkommt, muss die Erstattung decken.
  it.each(FEE_PAYERS)("stays solvent when the organizer chose %o", (payer: FeePayer) => {
    for (const face of [500, 1_000, 2_500, 5_000, 20_000]) {
      const { buyerCents } = splitServiceFee(face, payer);
      const buyerPays = face + buyerCents;
      // Der zurückgebende Gast hat seinerzeit denselben Preis gezahlt.
      const { refundCents } = returnBreakdown(face);
      expect(buyerPays).toBeGreaterThanOrEqual(refundCents);
      // Und es bleibt echte Marge übrig, nicht nur eine Punktlandung.
      expect(buyerPays - refundCents).toBeGreaterThan(0);
    }
  });

  it("earns the return fee on top of the ordinary service fee", () => {
    // 25 € Ticket, Gast trägt die Gebühr: 1,78 € Servicegebühr vom Käufer plus
    // 2,50 € Rückgabegebühr vom Verkäufer.
    const face = 2_500;
    const serviceFee = serviceFeePerTicketCents(face);
    const { returnFeeCents } = returnBreakdown(face);
    expect(serviceFee).toBe(178);
    expect(returnFeeCents).toBe(250);
    expect(serviceFee + returnFeeCents).toBe(428);
  });

  // Ein rabattiert gekauftes Ticket ist der Grund, warum die Gebühr gegen den
  // GEZAHLTEN Preis rechnet und nicht gegen den Nennwert.
  it("prices a discounted ticket off what was actually paid", () => {
    const face = 2_500;
    const paidWithHalfOff = 1_250;
    const b = returnBreakdown(paidWithHalfOff);
    expect(b.refundCents).toBe(1_125);
    // Gegen den Nennwert gerechnet wäre die Erstattung höher als der Charge.
    expect(returnBreakdown(face).refundCents).toBeGreaterThan(paidWithHalfOff);
  });
});
