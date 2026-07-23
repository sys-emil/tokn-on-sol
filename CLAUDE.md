# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

Package name is `tokn-on-sol` (legacy). The product is branded **Passly** throughout the UI. Use "Passly" for all user-facing copy, component names, and docs. Don't rename the package.

## Verification workflow

Don't run the dev server or build. Verify changes with:

```bash
npx tsc --noEmit   # type-check
npm run lint       # ESLint (Next.js recommended + TypeScript strict)
npm test           # Vitest; payout fee/hold/idempotency unit tests
```

The user pushes to git and checks Vercel deploys manually.

```bash
npm run create-tree  # One-time: deploy a Merkle tree to Solana devnet
```

## Architecture

Passly is a Next.js 16 App Router application for minting Solana compressed NFT (cNFT) tickets. Buyers pay via Stripe (EUR); a Stripe webhook mints the ticket on-chain. Doormen scan QR codes to verify and redeem tickets.

### Key flows

1. **Purchase** – `/shop/[id]` → `/api/checkout/create` (reserves capacity atomically via `reserve_tickets` SQL function, then creates a 30-min Stripe session; Stripe's minimum lifetime. The buyer-facing hold is **5 minutes** (`HOLD_MINUTES`): enforced on demand; when a reserve attempt hits exhausted capacity, `expireStaleReservations` expires this event's sessions older than the hold via the Stripe API and releases their seats (a session that already completed payment throws on expire and is left alone), then retries once. The shop resume-banner counts down these 5 minutes.) → Stripe webhook `/api/webhooks/stripe` converts the reservation to a sale (`finalize_ticket_sale`), enqueues a `mint_jobs` row and returns immediately. Minting runs async: `after()` in the webhook invocation processes the job (`src/lib/mintJobs.ts`); `/api/checkout/confirm` (polled by the success page) kicks the worker again when tickets are missing, and the daily cron `/api/cron/mint` is the final safety net (Vercel Hobby plan; sub-daily crons are not allowed). Max 5 attempts with 2-min backoff, then status `failed` → auto-refund of the unminted share (`autoRefundFailedJob`; skipped when the payout was already transferred or is disputed) + admin alert email with the refund outcome. `checkout.session.expired` releases the reservation; `release_expired_reservations()` in the payout cron is the safety net for missed expiry webhooks.
2. **QR verification** – `src/app/tickets/[assetId]/TicketClient.tsx` generates a QR code by signing a challenge with the buyer's embedded Solana wallet (Ed25519). Doorman page (`/doorman/[eventId]`) scans it with jsQR and calls `/api/tickets/verify`.
   - Token format: compact JSON `{ a: assetId, t: minuteTimestamp, w: walletAddress, s: base58Signature }`
   - Challenge signed by the wallet: `` `passly:verify:${assetId}:${t}` `` where `t = Math.floor(Date.now() / 60000)`
   - The doorman POSTs `{ token, eventId }` with its organizer Privy Bearer token **or** a door-access-link token (`x-door-token` header). `/api/tickets/verify` is **door-gated**: it loads the event and requires `requestMayWorkTheDoor` (`src/lib/doorAccess.ts`; organizer `requestOwnsWallet` OR a valid `door_access_links` row for exactly this event) before doing anything (a valid QR alone must not let a stranger burn a ticket). Keep this gate. Door tokens unlock ONLY the door surface (verify, snapshot, redeem-offline); never other organizer routes.
   - Verify route steps: (0) organizer auth for `eventId`, (1) replay protection; accept current or previous minute, (2) reconstruct challenge, (3) verify Ed25519 signature via `crypto.subtle`, (4) on-chain ownership check via Helius DAS, (5) atomic redemption; sets `redeemed_at` only if currently NULL, scoped to `event_id = eventId`.
   - **Backup tickets** (offline fallback for venues without connectivity): static token `{ a, w, s, b: 1 }` with challenge `` `passly:backup:${assetId}` ``; no time window by design; once-only redemption + printed personalization (name/birth date on the PDF, ID check at the door) carry the security. Issued via `POST /api/tickets/backup` (auth = the signatures themselves; personalization is printed/mailed, never stored) → PDF (`src/lib/backupTicket.ts`, pdf-lib) as download + mail attachment. UI: `BackupTicketModal` on the checkout success page. Verify route and doorman offline verifier both accept `b: 1`; the doorman shows "Backup-Ticket; Ausweis abgleichen" on such scans.
   - `NEXTAUTH_SECRET` is present in env but **not used** for QR verification (legacy name, do not remove; may be referenced elsewhere).
3. **Organizer gate** – New organizers apply at `/become-organizer`. The POST handler at `/api/organizers/apply` verifies the Privy auth token server-side (`@privy-io/server-auth`), checks that the user has a verified email address on their Privy account, then inserts into the `organizers` table at `status: 'pending'` (+ admin alert e-mail). **Approval is manual** (fraud gate; since 2026-07-14): the admin reviews at `/admin/organizers` (`ADMIN_SECRET`-gated, API `/api/admin/organizers`), approve/reject sends the applicant a decision e-mail (`sendOrganizerApplicationDecision`). `/become-organizer` renders pending/rejected states; `/dashboard` and all organizer APIs require `status: 'approved'`.
4. **Organizer dashboard** – `/dashboard` lets approved organizers create events (saved to Supabase) and view sales. `/api/events/create` requires a Privy Bearer token proving ownership of `organizer_wallet` (`requestOwnsWallet` in `src/lib/privyServer.ts`; use this helper for any new writing organizer route). Events can be marked **private** at creation; private events are excluded from the public listing but remain purchasable via direct link.

### Routing

| Path | Who |
|------|-----|
| `/` | Public landing page |
| `/shop/[id]` | Public event listing & purchase |
| `/become-organizer` | Organizer application (Privy auth required) |
| `/dashboard` | Organizer dashboard (approved organizer required) |
| `/my-tickets` | Buyer's ticket collection |
| `/tickets/[assetId]` | Individual ticket + QR code |
| `/doorman/[eventId]` | Camera scanner for venue staff |
| `/dashboard/events/[id]` | Organizer event detail (tickets, redemption, quick actions) |
| `/admin/organizers` | Admin review of organizer applications (`ADMIN_SECRET`) |
| `/admin/payouts` | Admin payout resolution (`ADMIN_SECRET`) |

### Authentication & wallets (Privy)

The root layout is a **server component** (global `metadata`/OG tags); `PrivyProvider` + consent banner live in the client component `src/app/components/Providers.tsx`, which wraps everything. Login method is **email only** (`loginMethods: ['email']`). Email login auto-creates a Solana embedded wallet per user. All auth-gated pages check `usePrivy().authenticated` client-side. Server-side token verification uses `PrivyClient` from `@privy-io/server-auth` (requires `PRIVY_APP_SECRET`).

### Blockchain

- **Network**: decided solely by `NEXT_PUBLIC_HELIUS_RPC_URL` via `heliusRpcUrl()` in `src/lib/solana.ts`; never hardcode an RPC host. Currently pointed at **Devnet**; the mainnet switch is an env-var change plus new trees/operator key (see backlog memory).
- **Minting**: `src/lib/mint.ts`; Metaplex Bubblegum cNFTs. The operator keypair (`OPERATOR_PRIVATE_KEY`) signs every mint; the buyer's embedded wallet receives the cNFT as `leafOwner`. The buyer never signs; don't change this to client-side signing.
- **Merkle trees**: `MERKLE_TREE_ADDRESSES` (comma-separated; each mint picks one at random via `pickMerkleTree()`; spreads concurrent mints so tree transactions don't conflict). Legacy fallback: `MERKLE_TREE_ADDRESS`. `npm run create-tree` creates one tree on the network `NEXT_PUBLIC_HELIUS_RPC_URL` points at (~0.1 SOL on mainnet, depth 14 = 16,384 tickets).
- **Asset queries**: Helius DAS API (`HELIUS_API_KEY`) for ownership and metadata lookups; always fetched with `cache: 'no-store'`.
- **cNFT metadata**: static per-event JSON in the public Supabase Storage bucket `event-assets` (`metadata/<eventId>.json`, written by `uploadEventMetadata` in `src/lib/eventMetadata.ts` during `/api/events/create`; `events.metadata_uri` stores the URL, `events.image_url` the optional event image uploaded via `/api/events/upload-image`). The mint uses `metadata_uri`; the legacy dynamic route `/api/tickets/metadata?name=&date=` remains as fallback for events created before it existed (their minted assets point at it on-chain; don't remove).
- **cNFT metadata attributes**: use `trait_type: "Event Name"` and `trait_type: "Event Date"` (two words, title-case). All writers (`uploadEventMetadata`, `/api/tickets/metadata`) and the reader `/tickets/[assetId]/page.tsx` must match these exact strings.

### Database (Supabase)

Tables:
- `events`: `id, organizer_wallet, name, date, start_time, price_eur, capacity, tickets_sold, tickets_reserved, is_private, payout_hold_days, image_url, metadata_uri, venue, description, cancelled_at, reminder_sent_at, created_at`
  - `start_time text` (nullable, `HH:MM`, Europe/Berlin); optional event start; shown on shop/ticket/listing pages, in the reminder mail and in the calendar export `GET /api/events/[eventId]/ics` (public .ics download, linked from ticket + checkout-success pages; all-day entry when NULL).
  - `reminder_sent_at`; once-only claim for the day-before reminder e-mail batch (`sendDueEventReminders` in `src/lib/reminders.ts`, runs inside the payout cron because both Hobby cron slots are taken; recipients via purchases→mint_jobs like the organizer messaging).
  - `is_private boolean default false`; private events are excluded from `/api/events/public` but still purchasable via direct link.
  - `image_url` / `metadata_uri`; public Supabase Storage URLs (bucket `event-assets`); `metadata_uri` is stamped on-chain at mint, NULL for pre-existing events (mint falls back to the legacy dynamic metadata route).
  - `payout_hold_days int default 0 (0–90)`; days after the event date before ticket revenue is transferred to the organizer (chargeback protection). 0 = transferred by the next daily payout cron.
  - `resale_max_markup_pct int` (nullable, 0–200): max resale markup over face value in percent. **NULL = resale disabled** for this event; a value enables the regulated secondary market (see Ticket resale below).
  - `tickets_reserved int default 0`; capacity claimed by open checkout sessions. Available = `capacity - tickets_sold - tickets_reserved`. Never update `tickets_sold`/`tickets_reserved` directly from code; always go through the SQL functions `reserve_tickets`, `unreserve_tickets`, `finalize_ticket_sale`, `release_reservation`, `release_expired_reservations` (atomic, race-free).
  - `capacity` / `price_eur` are the **aggregate** over the event's tiers since 2026-07-07: capacity = sum of tier capacities, price_eur = min tier price ("ab"-price for listings). The tier is the price authority at checkout.
  - `cancelled_at`; set once via `/api/events/update` (action `cancel`): sales stop (checkout 410), event leaves the public listing, every not-yet-transferred charge is refunded in full (the `charge.refunded` webhook does revoke + seats), free-ticket purchases revoked directly, open sessions expired. Payouts in `paid`/`disputed` are reported for manual handling, not auto-refunded.
- `ticket_tiers`: price categories per event; `id, event_id, name, price_eur, capacity, tickets_sold, tickets_reserved, sort`. Every event has ≥1 tier (legacy events got a backfilled 'Standard' tier); max 5, names unique per event. Tier counters follow the same rule as event counters: only via the SQL functions (all take an optional `p_tier_id` and keep tier + event aggregate in sync; the event-level total remains the hard overselling gate). Editing: capacity can't drop below sold+reserved, tiers with sales can't be deleted.
- `ticket_reservations`: one row per checkout session; `stripe_session_id (PK), event_id, tier_id, quantity, status (reserved|finalized|released|refunded), expires_at`. State transitions happen only inside the SQL functions above.
- `mint_jobs`: async mint queue; `stripe_session_id (unique), event_id, tier_id, buyer_wallet, buyer_email, quantity, status (queued|processing|done|failed), attempts, last_error, refund_id`. Claimed via `claim_mint_jobs(limit, max_attempts)` (FOR UPDATE SKIP LOCKED). `refund_id` is the once-only gate for the auto-refund on permanent failure. Worker: `src/lib/mintJobs.ts`.
- `purchases`: `event_id, tier_id, buyer_wallet, asset_id, stripe_session_id, redeemed_at, revoked_at`; `revoked_at` is set when the charge is fully refunded; the doorman verify route rejects revoked tickets.
- `organizers`: `id, wallet_address, email, name, type (private|business), business_name, status (pending|approved|rejected), stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, plan (free|pro), stripe_customer_id, stripe_subscription_id, plan_period_end, plan_cancel_at_period_end, created_at`
- `badges`: buyer achievements; `id, wallet_address, badge_type, asset_id, earned_at, event_id, organizer_wallet` (partial unique indexes dedupe awards; see Badges section)
- `organizer_messages` / `loyalty_programs` / `loyalty_claims` / `analytics_events`: see Dashboard Pro & analytics sections
- `profiles`: buyer/organizer account profile; `wallet_address (PK), display_name, bio, is_private`. Edited on `/account` (GET/PUT `/api/profile`, auth `requestOwnsWallet`); read server-side by the public profile `/collection/[walletAddress]` (`is_private` hides the page, `display_name` replaces the wallet ID). `ProfileNudge` (mounted on `/my-tickets` + `/dashboard`) prompts accounts without a display name once per device; `AccountMenu` is the avatar dropdown in all signed-in topbars.
- `payouts`: one row per paid checkout session; `stripe_session_id (unique), payment_intent_id, charge_id, event_id, organizer_wallet, stripe_account_id, gross_cents, fee_cents, net_cents, currency, available_at, status (pending|paid|held|disputed|failed|refunded), transfer_id, dispute_id, failure_reason`
- `discount_codes`: Pro feature; `id, event_id, code (unique per event, case-insensitive), percent_off (1–100; 100 = guest list), max_uses (soft cap), uses, active`. Validation authority: `findValidDiscount`/`discountedUnitPrice` in `src/lib/discounts.ts`, used by BOTH `/api/checkout/validate-code` (public preview, rate-limited) and `/api/checkout/create` (`discountCode` in body scales the tier price + recomputes the service fee; metadata `discountCodeId`/`discountPercent`). Uses are incremented by the completed webhook via SQL function `increment_discount_uses` (webhook idempotency claim = dedupe). CRUD: `/api/organizer/discount-codes` (Pro-gated); DELETE deactivates.
- `waitlist_entries`: Pro feature; `id, event_id, email, notified_at, unique(event_id, email)`. Signup: `POST /api/waitlist/join` (public, rate-limited, only when sold out AND organizer plan = pro; shop page shows the form via server-side plan check). Notification (`src/lib/waitlist.ts`): `notifyWaitlistIfSeats` claims entries atomically (notified_at while NULL) and mails "wieder verfügbar"; hooked into `charge.refunded` (full refund), `checkout.session.expired`, and the daily `sweepWaitlists` in the payout cron. One mail per entry, ever; the mail reserves nothing.
- `door_access_links`: time-limited doorman access; `id, event_id, token (unique plaintext bearer), label, expires_at (event date + 2 days), revoked_at`. Managed via `/api/organizer/door-links` (GET/POST/DELETE, organizer-gated, max 10 active/event; DELETE revokes instead of deleting). Doorman opens `/doorman/[eventId]?key=<token>` without Privy login; the key is validated via the snapshot route.
- `stripe_webhook_events`: processed Stripe event IDs (`id` = evt_… primary key); the webhook idempotency gate.
- `resale_listings`: secondary-market listings; `id, asset_id, event_id, tier_id, seller_wallet, list_price_cents, face_value_cents, fee_cents, net_cents, currency, status (active|reserved|sold|cancelled), stripe_session_id, reserved_until, buyer_wallet, transferred_at, credited_at, sold_at`. Partial-unique index on `asset_id WHERE status IN ('active','reserved')`; one live listing per ticket. State via SQL functions `reserve_resale_listing`/`release_resale_listing`/`release_expired_resale_listings`.
- `user_credits` / `credit_ledger` / `credit_holds`: Passly-credit balance (materialized, per wallet), append-only audit ledger, and per-checkout-session holds. Balance changes ONLY via the SQL functions `add_credit`/`reserve_credit`/`release_credit`/`redeem_credit` (available = balance − active holds).

### Stripe Connect payouts

- **Model**: Separate Charges & Transfers (NOT destination charges); rationale documented in `src/lib/payouts.ts`. The platform charges the buyer; the webhook writes a `payouts` row; `/api/cron/payouts` (Vercel Cron, daily 03:00 UTC, auth `Bearer CRON_SECRET`) transfers `net_cents` to the organizer's Express account once `available_at` has passed, using `source_transaction` and idempotency key `payout-transfer-<payout id>`.
- **Fees**: buyer-side service fee €1.00 + 4% **per ticket** (`src/lib/fees.ts`; client-safe, imported by the shop UI) added as a second Stripe line item; the organizer nets 100% of the face price. The fee total is stored in the session metadata (`serviceFeeCents`) and booked as `fee_cents` by the webhook. Sessions without that metadata (pre-fee) fall back to the legacy organizer-side 3% split (`computeFeeSplit`, `PLATFORM_FEE_BPS`; keep for legacy rows). Free tickets carry no fee. Partial refunds rescale fee/net by the payout row's own fee ratio.
- **KYC gate**: organizers can always create events; `/api/checkout/create` returns 503 for paid events until the organizer's Connect account has `charges_enabled`.
- **Failure handling**: failed transfers (restricted account etc.) → status `held`, funds stay on the platform balance. `charge.dispute.created` blocks a pending transfer (`disputed`). Admin resolution UI at `/admin/payouts` (gated by `ADMIN_SECRET`, sent as `x-admin-secret`): retry / release / cancel.
- **Webhook idempotency**: every handled event ID is claimed via PK insert into `stripe_webhook_events` before processing. On payout-row/finalize/enqueue failures the claim is released and a 500 returned so Stripe retries. Mint retries are handled by the `mint_jobs` queue, not by Stripe redelivery.
- **Refunds** (`charge.refunded`): full refund before transfer → payout `refunded` (terminal), tickets revoked (`purchases.revoked_at`), seats freed via `refund_ticket_sale`; partial refund → organizer share recomputed from the remaining amount; refund after transfer → flagged for manual recovery.
- The Stripe webhook endpoint must be subscribed to `checkout.session.completed`, `checkout.session.expired`, `account.updated`, `charge.dispute.created`, `charge.refunded`, `customer.subscription.created/updated/deleted` and (Connect) `payout.paid`, `payout.failed`.

### Ticket resale (regulated secondary market)

Lets a buyer who can't attend resell their ticket instead of losing the whole cost, while capping scalping. Available to **all** organizers (not Pro-gated). Reuses the operator-escrow cNFT transfer of the claim/share flow (`transferCnft`, `src/lib/transfer.ts`) and the Stripe checkout rail.

- **Organizer config**: `events.resale_max_markup_pct` (NULL = off; 0–200 = max markup % over face value). Set in `/api/events/create` + `/api/events/update` and both dashboard forms (create drawer + event-detail edit drawer, next to "Auszahlungs-Puffer").
- **Face value** = the ticket's tier price (`purchases.tier_id → ticket_tiers.price_eur`, event `price_eur` fallback). The markup cap and fee scale are computed against face value, **not** the possibly-discounted paid amount.
- **Split fee** (`src/lib/fees.ts`, unit-tested, client-safe): a percentage of the list price, split **50/50** between buyer and seller. Base **8%** at or below face value, rising **1 percentage point per 5%** of markup over face value, capped at **15%**, with a **€0.50 minimum** (`RESALE_FEE_MIN_CENTS`) so cheap resales still cover Stripe's fixed per-charge cost (below ~€4 the 8% alone goes underwater). The platform (merchant of record) bears the Stripe fee out of this margin in every flow. The buyer pays `list + their half` (buyerTotal = sellerNet + totalFee), the seller receives `list − their half` as credit. `resaleFeeBreakdown` is the authority (returns totalFee/buyerFee/sellerFee/sellerNet/buyerTotal); `resaleFeeCents`/`resaleNetProceedsCents`/`maxResalePriceCents`/`resaleFeeBps` are thin helpers. Anti-scalping is the organizer's markup cap, not this fee. `resale_listings.fee_cents` stores the full fee, `net_cents` the seller's proceeds.
- **Listing** (`POST /api/resale/list`, Privy-auth seller): eligibility via `checkResaleEligibility` in `src/lib/resale.ts` (on-chain owner==seller & delegate==operator, not redeemed/revoked, event live & future, resale enabled, price ≤ cap) → insert `resale_listings` → `transferCnft(seller→operator)` (escrow), rollback on transfer failure. Withdraw: `POST /api/resale/cancel` (active only → operator→seller). Public list: `GET /api/resale/event/[eventId]` (active, cheapest first). Buyer flow: `POST /api/resale/checkout` reserves the listing under a Stripe session (`metadata.purpose='resale'`).
- **Settlement**: the Stripe webhook has a `purpose==='resale'` branch (before the primary ticket path, like the subscription branch) → `handleResaleCompleted`: mark listing sold, record `charge_id`, `transferCnft(operator→buyer)` (idempotent via `getAssetOwner` re-check + `transferred_at`/`credited_at` marker columns), repoint `purchases.buyer_wallet`, `add_credit(seller, net)`. No `payouts` row and no mint, since the organizer was already paid at the first sale and the platform keeps the fee. Resale-session expiry releases the listing; the payout cron's `release_expired_resale_listings()` is the safety net.
- **Resale refunds/disputes**: `charge.refunded`/`charge.dispute.created` find no `payouts` row for a resale charge, so they fall through to `handleResaleRefund`/`handleResaleDispute` (look up `resale_listings.charge_id`): reverse the seller's credit (proportional to the buyer total for partial refunds, full for disputes; idempotent via `credit_reversed_cents` since `amount_refunded` is cumulative, and a negative `add_credit` clamps the balance at 0 if the seller already spent it), revoke the resold ticket on full refund, and `sendAdminAlert` for manual ticket-possession review.
- **Seller proceeds = Passly credit** (no KYC): `user_credits`/`credit_ledger`/`credit_holds`. UI: credit chip + "Verkaufen"/"Zurückziehen" actions + "Zum Verkauf angeboten" state on `/my-tickets`; "Von Fans weiterverkauft" section on `/shop/[id]`.
- **Credit redemption at checkout** (`useCredit` in `/api/checkout/create`, gated by `requestOwnsWallet`): holds credit under a `creditHoldId` (not the Stripe session id) before session creation, applies it as a one-time Stripe `amount_off` coupon, never leaving a card charge in the sub-€0.50 dead zone. The completed webhook `redeem_credit`s it (a hard step, since the coupon already discounted, so a failed deduct would double-spend and forces a 500-retry); expiry `release_credit`s it. The organizer is still paid **full face value**: the payout row uses the notional gross (`amount_total + creditAppliedCents`) and sets `payouts.skip_source_transaction=true` so the cron funds it from the platform balance instead of the smaller card charge.

### Dashboard Pro (subscription)

- `organizers.plan ('free'|'pro')` + `stripe_customer_id/stripe_subscription_id/plan_period_end/plan_cancel_at_period_end`. **Only the Stripe webhook writes `plan`** (subscription-mode `checkout.session.completed` + `customer.subscription.*`; `active`/`trialing` → pro via `subscriptionPlanFromStatus` in `src/lib/subscription.ts`; pure, unit-tested).
- The webhook branches on `session.mode === 'subscription'` (or `metadata.purpose === 'pro_subscription'`) right after the idempotency claim; subscription sessions must NEVER fall through to the ticket path (`release_reservation`/finalize).
- Billing routes: `POST /api/organizer/billing/checkout` (creates/reuses Stripe Customer, subscription-mode Checkout), `POST /api/organizer/billing/portal` (Billing Portal; must be configured once in the Stripe dashboard). Auth: `requestOwnsWallet`.
- Pro gate for API routes: `requireProOrganizer(req, walletAddress)` in `src/lib/plan.ts` (401/403 `pro_required`); client UI reads `plan` from `/api/organizers/status` (also returns `plan_period_end`, `plan_cancel_at_period_end`).
- Pro features: `GET /api/organizer/analytics` (cross-event revenue/redemption/repeat-customer stats, top customers, conversion funnel from `analytics_events`; distinct cid per stage, matched by `/shop/<id>` path), `POST /api/organizer/message` (plaintext e-mail to all ticket holders of an event; max 2/event/24h; audit table `organizer_messages`), discount codes, waitlist, loyalty program (below). UI: `/dashboard/analytics` (upsell for free plan) + „Gäste kontaktieren" modal and Rabattcode card on the event detail page.
- **Payout transparency** (free, all organizers): `GET /api/organizer/payouts` (`requestOwnsWallet`) + `/dashboard/payouts`; pending/paid/held summary and per-sale payout list.
- **Loyalty**: `loyalty_programs` (one per organizer: threshold 2–20, benefit, active) + `loyalty_claims` (one per customer per program, unique 6-char `code`, atomic `redeemed_at`). Qualification = distinct redeemed events at the organizer (`src/lib/loyalty.ts`); same signal as the Stammgast badge. Buyers see/claim on `/my-tickets` via `GET /api/loyalty/status` + `POST /api/loyalty/claim`; benefits are hidden at read time when the organizer's plan lapses. Organizer config/redeem via `/api/organizer/loyalty[/redeem]`.

### Badges (buyer gamification)

- Single source of truth: `src/lib/badgeMeta.ts` (client-safe; `BadgeType`, `BADGE_META`, `MILESTONES`, thresholds; `supabase.ts` re-exports `BadgeType` from it). Never duplicate badge display maps in pages.
- Types: `first_show/show_5/show_10` (redeemed-ticket milestones), `loyal_organizer` („Stammgast", 3 distinct redeemed events **per organizer**, `badges.organizer_wallet` set), `sold_out_show` (redeemed at a sold-out event); all awarded on redemption (`checkRedemptionBadges`, called from ticket verify AND offline-redeem sync); `first_ticket`/`early_bird` (purchase ≤1h after event creation); awarded at mint time (`checkPurchaseBadges` from `mintJobs`). All calls fire-and-forget.
- Dedupe via partial unique indexes on `badges` (wallet+type global, wallet+type+organizer for Stammgast); inserts tolerate 23505. Badge cNFT minted async (`mintBadge`), images in `public/badges/<type>.png`, metadata route `/api/badges/metadata` (German, immutable-cached).
- `/api/my-tickets` returns a `progress` object (attended count, next milestone, best Stammgast candidate by organizer display name) rendered as progress bars on `/my-tickets`.
- **Nudge-Mail**: `maybeSendBadgeNudge` (in `src/lib/badges.ts`, called at the end of `checkRedemptionBadges`) e-mails the guest after check-in when exactly 1 event remains to the Stammgast badge or the next milestone; only on the wallet's first redeemed ticket at that event (guards against multi-ticket re-sends). Best-effort; never fails the redemption path.
- **Public profile share card**: `/collection/[walletAddress]/opengraph-image.tsx` renders the OG image (name, attended count, badge symbols); private profiles get a generic card. `generateMetadata` on the page supplies title/description; `ShareButton` (client) does navigator.share/clipboard.

### First-party analytics (consent-gated)

- Cookies `passly_consent` (`granted|denied`, 12 months) + `passly_cid` (UUID, only while granted); set client-side by `ConsentBanner` (`src/app/components/ConsentBanner.tsx`, mounted in the root layout with `PageViewTracker`). `track()` in `src/lib/track.ts` is a no-op without consent.
- `POST /api/track` requires both cookies, enforces an event-name allowlist (`page_view`, `checkout_started`, `purchase_completed`, `ticket_viewed`), caps props at 1 KB, always answers 204. Table `analytics_events` (no wallets/e-mails/IPs; `cid` is the only identifier).
- `/datenschutz` Ziffer 10 documents the cookie + withdrawal (`ConsentSettingsButton`); the page and any tracking change MUST ship in the same deploy. Doorman pages are never tracked.
- **Alerting**: operational failures e-mail `ADMIN_ALERT_EMAIL` via `sendAdminAlert` (src/lib/email.ts); held transfers (payout cron), refund-after-transfer, dispute created, refund/payout-row webhook failures, Connect bank-payout failures, unresolved refunds on event cancellation, permanently failed mint jobs. Always fire-and-forget (`void …().catch(…)`), never block the money path on Resend.

### Doorman offline buffer

`/doorman/[eventId]` keeps admitting guests without connectivity: while online it refreshes a ticket snapshot every 60 s (`/api/organizer/event/snapshot`, cached in localStorage). When the live verify call fails (5 s timeout), verification runs locally (`src/app/doorman/[eventId]/offline.ts`): same Ed25519 challenge + minute window as the server, ownership against `purchases.buyer_wallet` (kept current by claims), once-only redemption against snapshot + local queue. Queued offline scans sync via `/api/tickets/redeem-offline` (atomic redeem; conflicts reported when another device was first). Known trade-off: two offline devices can't see each other's scans.

### Support

- `/hilfe`; public FAQ + support address (`NEXT_PUBLIC_SUPPORT_EMAIL`, default support@getpassly.de), linked from all footers.
- **Ticket re-issue** (buyer lost e-mail access): verify identity out-of-band (Stripe receipt), then `POST /api/admin/reissue` (`x-admin-secret`, body `{"assetId"}`) → returns a one-time claim link for the buyer's new account. Uses the existing claims/escrow flow; blocked for redeemed/revoked tickets.

**Security model**; intentional, don't change:
- All Supabase reads/writes go through the service-role admin client (bypasses RLS).
- **RLS is enabled on every table** (since 2026-07-05). The only anon policy is SELECT on non-private `events`. New tables must enable RLS in their migration. The exported `supabasePublic` anon client is currently unused by the app.
- **Any route keyed by a `walletAddress`/`buyerWallet`/`ownerWallet` param that returns personal data must gate on `requestOwnsWallet`**; a wallet address is public, so the param alone proves nothing. This covers reads too, not just writes (`/api/my-tickets`, `/api/loyalty/status`, `/api/tickets/events`, `/api/profile`). The public profile at `/collection/[wallet]` is the deliberate exception and self-censors via `profiles.is_private`.
- **Best-effort rate limiting** via `src/lib/rateLimit.ts` (in-memory, per warm instance) guards the abuse-prone unauthenticated/entry routes: `/api/checkout/create` (reservation exhaustion), `/api/claims/create`, `/api/organizers/apply`, `/api/track`. Not a hard global quota; back with Redis if a stricter limit is ever needed.

### Conventions

- **Design system ("Tokn Based" light template, fully migrated 2026-07-06)**: light theme, violet accent via `--hue: 285`, Geist fonts. Design tokens (`--ink*/--surface*/--accent*`, radii, shadows) **and** the shared component CSS (`.topbar`, `.card`, `.btn`, `.chip`, `.event-card`, `.modal`, `.drawer`, `.field/.input`, `.aurora`, utilities …) live in `src/app/globals.css`. `Icon` (stroke icon set) and `Spark` (sparkline) live in `src/app/components/passlyUi.tsx`. Page archetypes: app pages = `.app > .topbar > .main > .aurora + .container` with `.hero`; mobile pages (ticket, doorman, shop, claim, success) = centered card on `radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2)`.
- **Language**: all user-facing copy is **German** (getpassly.de), du-Form. No crypto/web3/Solana wording anywhere in the UI; framing is "fälschungssicher"; say "Konto"/"Ticket" instead of wallet/NFT.
- **Styling**: page-specific styles go in inline `<style>{`...`}</style>` blocks referencing the global tokens/classes. Don't introduce Tailwind utility classes on new pages.
- **Fonts**: Geist + Geist Mono loaded once in the root layout (`--font-geist`, `--font-geist-mono`, referenced as `--font`/`--mono`). No other fonts.
- **Client vs server**: Most pages are `'use client'` because of Privy hooks. Server components are limited to the root layout, `/`, `/events`, `/shop/[id]/page.tsx`, `/tickets/[assetId]/page.tsx`, `/collection/[walletAddress]` (data fetching) and all `/api/*` routes.
- **SEO**: `src/app/sitemap.ts` (public events, `force-dynamic`; never let it go static or the event list freezes at build) + `src/app/robots.ts` (app/admin surfaces disallowed; keep sitemap and robots consistent; an auth-gated route must not appear in the sitemap). `/shop/[id]` builds per-event OG tags in `generateMetadata`. Route handlers without request APIs (e.g. `/api/organizer/billing/price`) need `export const dynamic = 'force-dynamic'` or Next prerenders them at build time.
- **Stack versions**: Next.js 16 App Router, React 19, Tailwind 4 (PostCSS only, no config file). Don't suggest patterns that assume older versions.

### Path alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

### Environment variables

```
NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET
NEXT_PUBLIC_HELIUS_RPC_URL / HELIUS_API_KEY
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
OPERATOR_PRIVATE_KEY
MERKLE_TREE_ADDRESSES  # Comma-separated list; legacy MERKLE_TREE_ADDRESS still works as single-tree fallback
STRIPE_SECRET_KEY / STRIPE_PUBLIC_KEY / STRIPE_WEBHOOK_SECRET
STRIPE_CONNECT_WEBHOOK_SECRET  # Signing secret of the second (Connect) webhook endpoint
STRIPE_PRO_PRICE_ID    # Monthly recurring Price for the Dashboard-Pro subscription; billing checkout returns 503 when unset
CRON_SECRET            # Auth for /api/cron/payouts + /api/cron/mint (Vercel Cron sends it as Bearer token)
ADMIN_ALERT_EMAIL      # Recipient for operational alerts (permanently failed mint jobs); alerts are skipped when unset
ADMIN_SECRET           # Auth for /admin/payouts + /admin/organizers and their /api/admin/* routes (x-admin-secret header)
NEXT_PUBLIC_SUPPORT_EMAIL  # Shown on /hilfe; defaults to support@getpassly.de when unset
NEXTAUTH_SECRET        # Legacy name; no longer used for QR signing; do not remove
VERCEL_URL             # Auto-set by Vercel; fallback for building absolute URLs
APP_URL                # Stable production domain (e.g. https://passly.app); takes priority over VERCEL_URL for metadata URIs, claim links, and email links
```
