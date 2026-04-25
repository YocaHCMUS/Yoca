## Wallet AI Analysis: persist n8n response + 3h cache (2026-04-25)

### Goal
- **Persist** the n8n workflow response (raw + normalized) for wallet AI analysis in Postgres.
- **Add caching** in `server/src/services/wallet/walletAnalysis.service.ts` with **TTL = 3 hours**, so repeated requests don’t re-run the webhook call unnecessarily.

### Constraints / assumptions
- Backend uses **Drizzle + Postgres** (`server/src/db/index.ts`, `server/src/db/schema.ts`).
- n8n webhook result can be **object or array-wrapped** and may be wrapped under `output`; normalization already exists in `walletAnalysis.service.ts`.
- Cache should be **keyed by inputs that affect output**: wallet address + language + model/prompt versions.

### Plan
#### 1) Database schema
Add a new table in `server/src/db/schema.ts`:
- **Table**: `wallet_ai_analysis_cache`
- **Columns**:
  - `key` (PK): deterministic cache key string, e.g. `wai:<address>:<lang>:<modelVer>:<promptVer>`
  - `address` (varchar): wallet address
  - `language` (varchar): `en|vn`
  - `modelVersion` (varchar, nullable): from env `WALLET_AI_MODEL_VERSION`
  - `promptVersion` (varchar, nullable): from env `WALLET_AI_PROMPT_VERSION`
  - `raw` (jsonb): raw webhook payload (for debugging / reprocessing)
  - `normalized` (jsonb): normalized response returned to clients
  - `fetchedAt` (timestamp): when the webhook was fetched/stored
- Add a **unique index** over `(address, language, modelVersion, promptVersion)` for easy inspection and to guard against key mistakes.

Migration note:
- If this repo relies on manual SQL migrations, we’ll still commit schema changes in code first; missing-table handling should allow running without the migration temporarily.

#### 2) Service-level cache (3 hours)
Update `server/src/services/wallet/walletAnalysis.service.ts`:
- Add constants:
  - `WALLET_AI_ANALYSIS_CACHE_TTL_MS = 3 * 60 * 60 * 1000`
- Add helpers:
  - `createCacheKey(address, language, modelVersion?, promptVersion?)`
  - `getCachedAiAnalysis(key)`:
    - return cached `normalized` if `fetchedAt` is within TTL
    - validate cached JSON using existing zod schema (fail-safe fallback to re-fetch)
    - gracefully bypass cache if table doesn’t exist (warn once)
  - `saveCachedAiAnalysis(key, ...)`:
    - upsert row with `raw`, `normalized`, `fetchedAt=now`
- Main flow:
  1. validate address
  2. dependency checks (identity / first fund / portfolio / swaps)
  3. attempt cache lookup; if fresh return it
  4. call n8n via current path (`callViaAcms` wrapper)
  5. normalize payload
  6. upsert cache row
  7. return normalized

#### 3) Verification
- `server` typecheck/build (or equivalent) passes.
- Manual smoke:
  - first request hits webhook and stores cache
  - second request within 3h returns from cache (no webhook call)
  - changing `WALLET_AI_MODEL_VERSION` or `WALLET_AI_PROMPT_VERSION` produces a new cache key (miss → fetch → store)

