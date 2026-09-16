import { supabaseAdmin } from "@/lib/supabase";

/**
 * The organizer as the guest must see them: Passly only brokers the sale, the
 * contract for the event is with the organizer, and umsatzsteuerlich that
 * holds up only if every document the guest sees says so (UStAE 3.7: acting
 * in someone else's NAME, not just for their account). So the organizer is
 * named on the Stripe line item, on the card statement and in the
 * confirmation mail — the three things a guest actually looks at.
 */
export async function organizerDisplayName(wallet: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organizers")
    .select("public_name, name, business_name")
    .eq("wallet_address", wallet)
    .maybeSingle();
  const name = (data?.public_name ?? data?.business_name ?? data?.name) as string | null | undefined;
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

/**
 * `statement_descriptor_suffix` for the checkout: the guest's bank statement
 * then reads "PASSLY* TV PLANEGG" instead of a bare "PASSLY". Stripe allows
 * only letters, digits and spaces here and caps prefix + suffix at 22
 * characters; the account prefix is set in the Dashboard and not known here,
 * so the suffix stays short enough for any plausible prefix.
 */
export function statementSuffix(name: string | null): string | null {
  if (!name) return null;
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 12)
    .trim();
  return clean.length >= 2 ? clean : null;
}
