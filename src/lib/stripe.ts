import Stripe from "stripe";

export { PLATFORM_FEE_BPS } from "@/lib/payouts";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
