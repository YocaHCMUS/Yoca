# API Call Management System (ACMS) Implementation Plan

## 1. Problem Statement

The backend currently suffers from 429 (Too Many Requests) errors due to:
- Redundant, simultaneous calls for the same data (Cache Stampede).
- Lack of a centralized coordination layer between disparate services (Birdeye, Helius, CoinGecko).
- Inevitable waste of API key credits on duplicate data.

## 2. System Architecture

The ACMS will act as a "Gatekeeper" between business logic and external providers. It implements a three-layer defense:
- **Memory/Redis Cache:** Immediate return for "hot" data.
- **In-Flight Coalescer:** Merges identical concurrent requests into one.
- **Throttled Queue (Per-Provider):** Ensures outbound calls stay below provider-specific limits (e.g., 1 req/sec).

## 3. Directory Structure

Following the category-first convention:

```
server/src/services/api-manager/
├── providers/                # Provider-specific configs (limits, keys, static error handling)
│   ├── birdeye.config.ts
│   └── helius.config.ts
├── internal/                 # Core logic
│   ├── cache.ts              # Redis / In-memory wrapper
│   ├── coalescer.ts          # Promise tracking map
│   └── queue.ts              # Per-provider rate-limit logic
├── api-manager.service.ts    # Main entry point (The "Gatekeeper")
└── types.ts                  # Zod schemas for request/response
```

## 4. Implementation Logic

### Phase A: The Coalescer (Immediate Impact)
- Maintain a `Map<string, Promise<any>>`.
- The key is a hash of (provider + endpoint + params).
- If a key exists, return the existing Promise instead of starting a new fetch.

### Phase B: Redis + DB Integration
- **Strategy:** Cache-Aside.
- **Logic:**
  1. Check Redis.
  2. If miss, check PostgreSQL (Drizzle).
  3. If miss, trigger Coalescer -> API.
  4. On success, update both DB and Redis.

### Phase C: The Throttled Queue (Per-Provider)
- Implement a Token Bucket or Leaky Bucket algorithm for each provider.
- Requests are pushed into a queue and "popped" only when the provider's rate-limit window allows.
- Each provider has its own queue and rate-limit logic.

### Types & Validation
- Define Zod schemas in `types.ts` for request/response validation.

### Provider Configs & Error Handling
- Provider config files (e.g., `birdeye.config.ts`, `helius.config.ts`) define limits, keys, endpoints, and static error format handling.
- Error handling is static per provider for easier implementation.

## 5. Technical Specifications

| Component         | Responsibility                                 | Technology/Pattern                |
|-------------------|-----------------------------------------------|-----------------------------------|
| Request Keying    | Generate unique IDs for every unique API call  | crypto.createHash('sha256')       |
| Locking           | Prevent multiple servers from fetching same data| Redis SET NX (Distributed Lock)   |
| Persistence       | Long-term storage of history                   | PostgreSQL + Drizzle              |
| Validation        | Ensure external data matches project types      | Zod                               |
| Error Handling    | Provider-specific, static error formats         | Static config per provider        |

## 6. Acceptance Criteria (Matching Test Coverage)

- [ ] **Unit:** Coalescer must return the exact same Promise object for two calls made within 1ms.
- [ ] **Integration:** Calling getWalletBalance 10 times in a burst results in exactly 1 Birdeye credit used.
- [ ] **Reliability:** If the API returns a 429, the Queue must back off and retry after the retry-after duration without crashing the worker.
- [ ] **Performance:** Redis hits must resolve in under 5ms.

## 7. Decisions
- ACMS will be a new, centralized service layer.
- All external provider calls must go through the ACMS.
- Redis and PostgreSQL are the cache and persistence layers.
- Zod is used for type validation.
- Provider configs are static and environment-driven.
- Queue logic is per-provider.
- Provider-specific error formats are handled statically for easier implementation.

## 8. Further Considerations
- Dynamic provider addition is not required at this stage; start static, refactor for dynamic if needed.
- Error handling and retry logic are static per provider for simplicity and maintainability.
- Queue logic is per-provider for flexibility and clarity.

---

This plan is tailored for the current backend codebase and ready for implementation.
