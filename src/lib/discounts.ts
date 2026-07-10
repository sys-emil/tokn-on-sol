import { supabaseAdmin } from "@/lib/supabase";

/**
 * Discount code validation — the single authority used by the public
 * validate endpoint AND the checkout session creation, so the preview a
 * buyer sees can never diverge from what the checkout actually applies.
 */

export interface ValidDiscount {
  id: string;
  code: string;
  percentOff: number;
}

export type DiscountResult =
  | { ok: true; discount: ValidDiscount }
  | { ok: false; error: string };

export async function findValidDiscount(
  eventId: string,
  rawCode: string,
  quantity: number,
): Promise<DiscountResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Kein Code angegeben." };

  const { data } = await supabaseAdmin
    .from("discount_codes")
    .select("id, code, percent_off, max_uses, uses, active")
    .eq("event_id", eventId)
    .ilike("code", code)
    .maybeSingle();

  if (!data || !data.active) {
    return { ok: false, error: "Dieser Code ist ungültig." };
  }
  const maxUses = data.max_uses as number | null;
  if (maxUses !== null) {
    const remaining = maxUses - (data.uses as number);
    if (remaining <= 0) return { ok: false, error: "Dieser Code wurde bereits vollständig eingelöst." };
    if (remaining < quantity) {
      return { ok: false, error: `Dieser Code gilt nur noch für ${remaining} Ticket${remaining === 1 ? "" : "s"}.` };
    }
  }

  return {
    ok: true,
    discount: { id: data.id as string, code: data.code as string, percentOff: data.percent_off as number },
  };
}

export function discountedUnitPrice(unitPriceCents: number, percentOff: number): number {
  return Math.max(0, Math.round((unitPriceCents * (100 - percentOff)) / 100));
}
