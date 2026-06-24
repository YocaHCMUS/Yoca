# AI Feature Rate Limit Plan

Date: 2026-06-23  
Status: All current AI feature limits implemented

## Architecture

- PostgreSQL table `ai_daily_usage` stores one counter per user, feature, and UTC date.
- Feature limits live in `server/src/services/ai-usage.service.ts`.
- `AI_USAGE_LIMIT_ENABLED=false` disables usage enforcement and premium AI locks without changing authentication requirements. Default is enabled; set `AI_USAGE_LIMIT_ENABLED=true` in normal environments.
- A conditional upsert reserves usage atomically before AI work starts.
- Failed AI requests release reserved usage.
- Cache charging is feature-specific: Ask Yoca AI counts successful cache hits; Volatility Signal Summary does not.
- Wallet AI Swap Summary and its token-level AI Analysis share one daily counter; cache hits do not count.
- Wallet AI Analysis and Wash Trading AI Analysis are locked until Plus; locked tiers receive `403 AI_FEATURE_LOCKED` and do not write usage.
- Daily counters reset at `00:00 UTC`.
- Existing short-window IP throttles remain separate abuse protection.
- Users without a valid paid subscription use the Free tier.
- Paid tiers require status `active` or `trialing` and an unexpired subscription period.

## Feature Registry

| Feature | Key | Free | Lite | Plus | Pro | Status |
|---|---|---:|---:|---:|---:|---|
| Ask Yoca AI | `ask_yoca_ai` | 5 | 20 | 50 | 100 | Enforced |
| General AI Chat | `general_ai_chat` | 5 | 20 | 50 | 100 | Enforced |
| Wallet AI Analysis | `wallet_ai_analysis` | Locked | Locked | 50 | 100 | Enforced |
| Wallet AI Swap Summary | `wallet_ai_swap_summary` | 10 | 20 | 50 | 100 | Enforced |
| Wash Trading AI Analysis | `wash_trading_ai_analysis` | Locked | Locked | 50 | 100 | Enforced |
| Volatility Signal Summary | `volatility_signal_summary` | 10 | 25 | 50 | 100 | Enforced |
| Token Chart News Summary | `token_chart_news_summary` | 5 | 20 | 50 | 100 | Enforced |

## Ask Yoca AI Behavior

- `POST /api/token-ai-chat` requires authentication.
- A successful response includes `usage` with tier, limit, used, remaining, and reset time.
- Exhausted quota returns HTTP `429`, error code `AI_DAILY_LIMIT_EXCEEDED`, usage fields, and `upgradePath: "/pricing"`.
- The client disables further submissions at zero remaining and shows an upgrade link.

## Volatility Signal Summary Behavior

- Volatility signals without `includeSummary=true` remain public and do not use AI quota.
- Generating a summary requires authentication.
- Cache hits and deterministic fallback summaries do not consume quota.
- A cache miss reserves quota only when Gemini is configured.
- The reservation is kept only when Gemini returns a valid summary; provider or validation fallback releases it.
- A successful response includes `usage` and `counted`; exhausted quota returns `429 AI_DAILY_LIMIT_EXCEEDED`.

## Wallet AI Swap Summary Behavior

- Wallet-level swap summaries and token-level AI Analysis require authentication and share the `wallet_ai_swap_summary` quota.
- Cache hits do not consume quota.
- Invalid input, insufficient swap data, and a missing Gemini key do not consume quota.
- Quota is reserved immediately before Gemini and retained only after a valid response; provider or validation failures release it.
- Successful responses include `usage` and `counted`; exhausted quota returns `429 AI_DAILY_LIMIT_EXCEEDED`.

## Remaining AI Feature Behavior

- `POST /api/chat` requires authentication and consumes `general_ai_chat` quota for every successful response, including cache hits.
- `POST /api/wallets/ai-analysis` and `POST /api/wallets/analysis` require authentication and Plus or higher; cache hits require Plus but do not consume quota.
- `POST /api/v1/wash-trading/ai-analyze` and `GET /api/v1/wash-trading/:mint` require authentication and Plus or higher; legacy deterministic wash-trading endpoints stay public.
- Token chart news summaries only consume `token_chart_news_summary` when `includeSummary=true` produces a Gemini summary; regular chart news, cache hits, and deterministic fallbacks do not consume quota.

## Implementation Checklist

- [x] Add `ai_daily_usage` schema and Drizzle migration.
- [x] Add centralized feature keys and tier limits.
- [x] Resolve valid subscription tier with Free fallback.
- [x] Reserve usage atomically and release failed requests.
- [x] Protect Ask Yoca AI with authentication.
- [x] Return quota metadata on success and exhaustion.
- [x] Display remaining usage and upgrade CTA in the client.
- [x] Enforce Volatility Signal Summary limits only for successful Gemini generations.
- [x] Enforce one shared Wallet AI Swap Summary quota across wallet and token analysis.
- [x] Enforce General AI Chat, Token Chart News Summary, Wallet AI Analysis, and Wash Trading AI Analysis limits.
- [x] Publish all approved AI feature limits and Plus-required locks on the pricing page.
- [x] Add `AI_USAGE_LIMIT_ENABLED` env toggle for local/staging quota bypass.

## Verification

- Free/Lite/Plus/Pro stop at 5/20/50/100 successful requests per UTC day.
- Concurrent requests cannot reserve beyond the tier limit.
- Provider/server failures release their reservation.
- Successful cached responses consume one usage.
- Expired, canceled, and past-due subscriptions fall back to Free.
- Unauthenticated requests return `401`.
- Exhausted requests return `429` without invoking the AI provider.
- Volatility summary cache hits and deterministic fallbacks do not consume usage.
- Wallet swap summary and token analysis cache hits do not consume usage.
- Wallet swap summary and token analysis share the same 10/20/50/100 daily counter.
- General AI Chat stops at 5/20/50/100 successful responses per UTC day.
- Wallet AI Analysis and Wash Trading AI Analysis return `403 AI_FEATURE_LOCKED` for Free/Lite and stop Plus/Pro at 51/101.
- Token Chart News Summary remains public without summaries; summary cache hits and deterministic fallbacks do not consume usage.
- With `AI_USAGE_LIMIT_ENABLED=false`, no AI usage rows are written, no `429` quota exhaustion is returned, Plus-only AI locks are bypassed, and authenticated endpoints still require login.
