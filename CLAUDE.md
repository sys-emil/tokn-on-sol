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
2. **QR verification** – Ticket detail page (`/tickets/[assetId]`) renders a signed QR token (`base64(payload).hexsig` using HMAC-SHA256). Doorman page (`/doorman/[eventId]`) scans it with jsQR and calls `/api/tickets/verify` which decodes + verifies the HMAC and sets `redeemed_at` in Supabase.
   - Token payload shape: `{ assetId, owner, exp }` where `exp = Date.now() + 300_000` (5-minute window).
   - HMAC key: `NEXTAUTH_SECRET`. The project doesn't use NextAuth — this is a legacy env var name; don't rename it, it's a breaking change for deployed instances.
   - Verification in `/api/tickets/verify` uses constant-time hex comparison.
3. **Organizer** – `/dashboard` lets authenticated organizers create events (saved to Supabase) and view sales.

### Routing

| Path | Who |
|------|-----|
| `/` | Public landing page |
| `/shop/[id]` | Public event listing & purchase |
| `/dashboard` | Organizer (Privy auth required) |
| `/my-tickets` | Buyer's ticket collection |
| `/tickets/[assetId]` | Individual ticket + QR code |
| `/doorman/[eventId]` | Camera scanner for venue staff |

### Authentication & wallets (Privy)

Root layout wraps everything in `PrivyProvider`. Email login auto-creates a Solana embedded wallet per user. All auth-gated pages check `usePrivy().authenticated` client-side.

### Blockchain

- **Network**: Solana **Devnet** only via Helius RPC (`NEXT_PUBLIC_HELIUS_RPC_URL`). No mainnet logic anywhere.
- **Minting**: `src/lib/mint.ts` — Metaplex Bubblegum cNFTs. The operator keypair (`OPERATOR_PRIVATE_KEY`) signs every mint; the buyer's embedded wallet receives the cNFT as `leafOwner`. The buyer never signs — don't change this to client-side signing.
- **Merkle tree**: single tree (`MERKLE_TREE_ADDRESS`); `npm run create-tree` initialises it once.
- **Asset queries**: Helius DAS API (`HELIUS_API_KEY`) for ownership and metadata lookups; always fetched with `cache: 'no-store'`.
- **cNFT metadata attributes**: use `trait_type: "Event Name"` and `trait_type: "Event Date"` (two words, title-case). Both `/api/tickets/metadata` (writer) and `/tickets/[assetId]/page.tsx` (reader) must match these exact strings.

### Database (Supabase)

Two main tables:
- `events`: `id, organizer_wallet, name, date, price_eur, capacity, tickets_sold`
- `purchases`: `event_id, buyer_wallet, asset_id, stripe_session_id, redeemed_at`

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
NEXTAUTH_SECRET        # HMAC key for QR token signing (legacy name — do not rename)
VERCEL_URL             # Auto-set by Vercel; used to build absolute metadata URLs
```
