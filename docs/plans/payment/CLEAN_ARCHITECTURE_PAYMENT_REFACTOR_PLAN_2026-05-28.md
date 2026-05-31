# Clean Architecture Payment Refactor Plan

Date: 2026-05-28
Last Updated: 2026-05-28

## Summary

Refactor the payment code to strictly separate client and server responsibilities based on clean architecture principles. This ensures that sensitive backend logic (e.g., on-chain transaction verification, database tier updates, sensitive API configurations) is securely handled by the server, while the client focuses purely on UI rendering and wallet interaction.

---

## Audit Findings

| Area | Status | Action |
|------|--------|--------|
| `getParsedTransaction` in client | ✅ Not present | Already server-only — no change needed |
| Subscription DB logic in client | ✅ Not present | Already server-only — no change needed |
| `HELIUS_API_KEY` in client | ✅ Not present | Already server-only — no change needed |
| `STRIPE_SECRET_KEY` in client | ✅ Not present | Already server-only — no change needed |
| `TIER_SOL_AMOUNTS` mismatch | 🔴 **Critical bug** | **Fixed** — server was 10x lower than client |
| `BIRDEYE_API_KEY` in `client/.env` | ⚠️ Dead code | **Removed** — no `VITE_` prefix, Vite cannot read it |
| `SOLANA_NETWORK` cross-validation | ❌ Missing | **Added** — server now rejects mismatched network claims |
| `client/.env.example` | ⚠️ Incomplete | **Updated** — now documents all VITE_ vars with security notes |
| `server/.env.example` | ⚠️ Missing entries | **Updated** — added Stripe, Helius, and Solana sections |

---

## Changes Made

### 1. `TIER_SOL_AMOUNTS` Sync Fix (Critical)

**Problem:** `server/src/services/solana-payment.service.ts` had `Lite=0.0001, Plus=0.0005, Pro=0.001` while the client had `Lite=0.001, Plus=0.005, Pro=0.01`. The server would see a valid amount and reject it as too small.

**Fix:** Updated server amounts to match client. Added `⚠️ MUST stay in sync` warnings in both files pointing to each other.

### 2. `SOLANA_NETWORK` Server Guard (New Security Check)

**Problem:** Server accepted any `network` field from the client with no cross-check against its own configuration.

**Fix:**
- Added `SOLANA_NETWORK=testnet` to `server/.env`
- Server reads `CONFIGURED_NETWORK` from `process.env.SOLANA_NETWORK`
- `verifySolanaTransaction()` now rejects requests where `network !== CONFIGURED_NETWORK`
- Added `SOLANA_NETWORK` to `server/.env.example`

### 3. `client/.env` Cleanup

- Removed orphaned `BIRDEYE_API_KEY` (no `VITE_` prefix, invisible to Vite)
- Restored `VITE_SOLANA_MERCHANT_ADDRESS` with a clear comment explaining it is a **public** address (not a secret) needed to construct the `SystemProgram.transfer` instruction
- Fixed `VITE_SOLANA_RPC_URL` to point to testnet (was incorrectly pointing to devnet)

### 4. `client/.env.example` Rewrite

Fully documents all VITE_ variables with descriptions, and includes a warning block listing secrets that must NEVER appear in the client env.

### 5. `server/.env.example` Update

Added missing sections for: Stripe keys, Solana payment vars (`SOLANA_MERCHANT_ADDRESS`, `HELIUS_API_KEY`, `SOLANA_NETWORK`), Helius webhook keys, Birdeye, Moralis, and server port.

---

## Architecture Contract (Reference)

### Client Responsibilities (Enforced)
- Render payment UI and tier selection
- Connect Solana wallet (Phantom / Solflare)
- Validate network via `VITE_SOLANA_NETWORK` before signing
- Build and sign `VersionedTransaction` → `sendTransaction()`
- Call `POST /api/payment/verify-solana` with `{ txId, tier, network }`
- Display result from server

### Server Responsibilities (Enforced)
- Authenticate user via JWT
- Validate `{ txId, tier, network }` payload via Zod schema
- Cross-check `network` against `SOLANA_NETWORK` env var
- Fetch and parse the transaction from Helius RPC (`getParsedTransaction`)
- Verify recipient address matches `SOLANA_MERCHANT_ADDRESS` (server env)
- Verify transferred lamports ≥ expected amount for tier
- Insert/update subscription record in DB
- Insert payment history record
- Return `{ success, subscriptionId, status, txId }`

