import Stripe from "stripe";

export const PLATFORM_FEE_BPS = 300; // 3 % platform fee
// Events where price_eur (cents) × capacity exceeds this require Stripe Connect.
export const CONNECT_THRESHOLD_CENTS = 20_000; // €200

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
