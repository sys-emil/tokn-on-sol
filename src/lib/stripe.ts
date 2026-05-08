import Stripe from "stripe";

export const PLATFORM_FEE_BPS = 300; // 3 % platform fee

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
