# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

Package name is `tokn-on-sol` (legacy). The product is branded **Passly** throughout the UI. Use "Passly" for all user-facing copy, component names, and docs. Don't rename the package.

## Verification workflow

Don't run the dev server or build. Verify changes with:

```bash
npx tsc --noEmit   # type-check
npm run lint       # ESLint (Next.js recommended + TypeScript strict)
```

The user pushes to git and checks Vercel deploys manually.

```bash
npm run create-tree  # One-time: deploy a Merkle tree to Solana devnet
```

## Architecture

Passly is a Next.js 16 App Router application for minting Solana compressed NFT (cNFT) tickets. Buyers pay via Stripe (EUR); a Stripe webhook mints the ticket on-chain. Doormen scan QR codes to verify and redeem tickets.

### Key flows

1. **Purchase** – `/shop/[id]` → `/api/checkout/create` (Stripe session) → Stripe webhook `/api/webhooks/stripe` mints cNFT via Metaplex Bubblegum and writes a `purchases` row to Supabase.
2. **QR verification** – `src/app/tickets/[assetId]/TicketClient.tsx` generates a QR code by signing a challenge with the buyer's embedded Solana wallet (Ed25519). Doorman page (`/doorman/[eventId]`) scans it with jsQR and calls `/api/tickets/verify`.
   - Token format: compact JSON `{ a: assetId, t: minuteTimestamp, w: walletAddress, s: base58Signature }`
   - Challenge signed by the wallet: `` `passly:verify:${assetId}:${t}` `` where `t = Math.floor(Date.now() / 60000)`
   - Verify route steps: (1) replay protection — accept current or previous minute, (2) reconstruct challenge, (3) verify Ed25519 signature via `crypto.subtle`, (4) on-chain ownership check via Helius DAS, (5) atomic redemption — sets `redeemed_at` only if currently NULL.
   - `NEXTAUTH_SECRET` is present in env but **not used** for QR verification (legacy name, do not remove — may be referenced elsewhere).
3. **Organizer gate** – New organizers apply at `/become-organizer`. The POST handler at `/api/organizers/apply` verifies the Privy auth token server-side (`@privy-io/server-auth`), checks that the user has a verified email address on their Privy account, then inserts into the `organizers` table at `status: 'approved'`. `/dashboard` requires approved organizer status.
4. **Organizer dashboard** – `/dashboard` lets approved organizers create events (saved to Supabase) and view sales. Events can be marked **private** at creation — private events are excluded from the public listing but remain purchasable via direct link.

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

### Authentication & wallets (Privy)

Root layout wraps everything in `PrivyProvider`. Login method is **email only** (`loginMethods: ['email']`). Email login auto-creates a Solana embedded wallet per user. All auth-gated pages check `usePrivy().authenticated` client-side. Server-side token verification uses `PrivyClient` from `@privy-io/server-auth` (requires `PRIVY_APP_SECRET`).

### Blockchain

- **Network**: Solana **Devnet** only via Helius RPC (`NEXT_PUBLIC_HELIUS_RPC_URL`). No mainnet logic anywhere.
- **Minting**: `src/lib/mint.ts` — Metaplex Bubblegum cNFTs. The operator keypair (`OPERATOR_PRIVATE_KEY`) signs every mint; the buyer's embedded wallet receives the cNFT as `leafOwner`. The buyer never signs — don't change this to client-side signing.
- **Merkle tree**: single tree (`MERKLE_TREE_ADDRESS`); `npm run create-tree` initialises it once.
- **Asset queries**: Helius DAS API (`HELIUS_API_KEY`) for ownership and metadata lookups; always fetched with `cache: 'no-store'`.
- **cNFT metadata attributes**: use `trait_type: "Event Name"` and `trait_type: "Event Date"` (two words, title-case). Both `/api/tickets/metadata` (writer) and `/tickets/[assetId]/page.tsx` (reader) must match these exact strings.

### Database (Supabase)

Three tables:
- `events`: `id, organizer_wallet, name, date, price_eur, capacity, tickets_sold, is_private, created_at`
  - `is_private boolean default false` — private events are excluded from `/api/events/public` but still purchasable via direct link.
- `purchases`: `event_id, buyer_wallet, asset_id, stripe_session_id, redeemed_at`
- `organizers`: `id, wallet_address, email, name, type (private|business), business_name, status (approved), created_at`

**Security model** — intentional, don't change:
- All Supabase writes go through the service-role admin client. **No RLS — this is intentional.** Don't add row-level security policies.
- Public reads use the anon client.

### Conventions

- **Styling**: Pages use inline `<style>{`...`}</style>` blocks with the OKLCH design-token palette: `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-bg`. Don't introduce Tailwind utility classes on new pages — match the existing inline-style pattern.
- **Fonts**: Loaded via `next/font/google` per-page (Unbounded → `--font-display`, Epilogue → `--font-body`) and applied by spreading `${unbounded.variable} ${epilogue.variable}` onto the root div.
- **Client vs server**: Most pages are `'use client'` because of Privy hooks. Server components are limited to `/shop/[id]/page.tsx`, `/tickets/[assetId]/page.tsx` (data fetching), and all `/api/*` routes.
- **Stack versions**: Next.js 16 App Router, React 19, Tailwind 4 (PostCSS only, no config file). Don't suggest patterns that assume older versions.

### Path alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

### Environment variables

```
NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET
NEXT_PUBLIC_HELIUS_RPC_URL / HELIUS_API_KEY
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
OPERATOR_PRIVATE_KEY
MERKLE_TREE_ADDRESS
STRIPE_SECRET_KEY / STRIPE_PUBLIC_KEY / STRIPE_WEBHOOK_SECRET
NEXTAUTH_SECRET        # Legacy name — no longer used for QR signing; do not remove
VERCEL_URL             # Auto-set by Vercel; used to build absolute metadata URLs
```
