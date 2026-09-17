/**
 * How long a buyer's seats are held after they click "Kaufen", in minutes.
 *
 * Client-safe on purpose: both checkout routes compute `expiresAt` from it,
 * and the shop's hold timer draws its progress bar against the same number.
 * Stripe's session itself lives 30 minutes (its minimum); this is the shorter
 * promise made to the buyer, enforced on demand by `expireStaleReservations`
 * in /api/checkout/create.
 */
export const HOLD_MINUTES = 5;
