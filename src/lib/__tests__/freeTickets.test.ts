import { describe, expect, it } from "vitest";
import {
  FREE_TICKET_CAP_FREE_PLAN,
  FREE_TICKET_CAP_PRO,
  freeCapacityExceeded,
  freeCapacityOf,
  freeTicketCapFor,
} from "@/lib/freeTickets";

const free = (capacity: number) => ({ price_eur: 0, capacity });
const paid = (capacity: number, price_eur = 1_500) => ({ price_eur, capacity });

describe("freeCapacityOf", () => {
  it("counts only tiers priced at zero", () => {
    expect(freeCapacityOf([free(100), paid(900)])).toBe(100);
  });

  it("adds up several free tiers", () => {
    // Ein Event darf mehrere Gratis-Kategorien haben (Presse, Gästeliste …).
    expect(freeCapacityOf([free(50), free(70), paid(1_000)])).toBe(120);
  });

  it("is zero for an all-paid event", () => {
    expect(freeCapacityOf([paid(5_000), paid(3_000, 2_500)])).toBe(0);
  });
});

describe("freeTicketCapFor", () => {
  it("gives Pro the higher ceiling", () => {
    expect(freeTicketCapFor("pro")).toBe(FREE_TICKET_CAP_PRO);
  });

  it("treats anything else as the free plan", () => {
    // Unbekannte oder fehlende Plaene duerfen nie das hoehere Limit erben.
    for (const plan of ["free", "", null, undefined, "PRO", "enterprise"]) {
      expect(freeTicketCapFor(plan)).toBe(FREE_TICKET_CAP_FREE_PLAN);
    }
  });
});

describe("freeCapacityExceeded", () => {
  it("passes an event at the ceiling", () => {
    expect(freeCapacityExceeded({
      tiers: [free(FREE_TICKET_CAP_FREE_PLAN)], plan: "free",
    })).toBeNull();
  });

  it("reports one seat over", () => {
    expect(freeCapacityExceeded({
      tiers: [free(FREE_TICKET_CAP_FREE_PLAN + 1)], plan: "free",
    })).toEqual({ requested: FREE_TICKET_CAP_FREE_PLAN + 1, cap: FREE_TICKET_CAP_FREE_PLAN });
  });

  it("never limits paid capacity", () => {
    // 10.000 bezahlte Tickets sind erlaubt; die Grenze gilt nur fuer Gratis.
    expect(freeCapacityExceeded({ tiers: [paid(10_000)], plan: "free" })).toBeNull();
  });

  it("lets Pro go further", () => {
    const tiers = [free(FREE_TICKET_CAP_FREE_PLAN + 100)];
    expect(freeCapacityExceeded({ tiers, plan: "free" })).not.toBeNull();
    expect(freeCapacityExceeded({ tiers, plan: "pro" })).toBeNull();
  });

  it("imposes no second limit on Pro below the event capacity ceiling", () => {
    // Ueber 500 ist das Abo der Preis; danach darf keine zweite, ungenannte
    // Grenze mehr kommen. 10.000 ist zugleich die Kapazitaetsgrenze eines
    // Events, ein Gratis-Event kann also nie an DIESER Regel scheitern.
    expect(FREE_TICKET_CAP_PRO).toBe(10_000);
    expect(freeCapacityExceeded({
      tiers: [free(FREE_TICKET_CAP_PRO)], plan: "pro",
    })).toBeNull();
  });

  it("grandfathers an existing event that does not grow", () => {
    // Bestandsevent mit 900 Gratis-Tickets: Bearbeiten bleibt moeglich …
    expect(freeCapacityExceeded({
      tiers: [free(900)], plan: "free", previousFreeCapacity: 900,
    })).toBeNull();
    // … auch beim Verkleinern …
    expect(freeCapacityExceeded({
      tiers: [free(800)], plan: "free", previousFreeCapacity: 900,
    })).toBeNull();
    // … aber nicht beim Vergroessern.
    expect(freeCapacityExceeded({
      tiers: [free(901)], plan: "free", previousFreeCapacity: 900,
    })).toEqual({ requested: 901, cap: FREE_TICKET_CAP_FREE_PLAN });
  });

  it("still applies the cap to a compliant event being edited", () => {
    // Grandfathering darf kein Schlupfloch sein: wer heute unter der Grenze
    // liegt, darf beim Bearbeiten nicht darueber springen.
    expect(freeCapacityExceeded({
      tiers: [free(FREE_TICKET_CAP_FREE_PLAN + 1)], plan: "free", previousFreeCapacity: 100,
    })).toEqual({ requested: FREE_TICKET_CAP_FREE_PLAN + 1, cap: FREE_TICKET_CAP_FREE_PLAN });
  });
});
