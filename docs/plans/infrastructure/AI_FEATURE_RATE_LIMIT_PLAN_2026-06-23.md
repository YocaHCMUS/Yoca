# AI Feature Rate Limit Plan

Date: 2026-06-23  
Status: Current AI feature limits implemented; Wallet AI Swap Summary quota removed

## Architecture

- PostgreSQL table `ai_daily_usage` stores one counter per user, feature, and UTC date.
- Feature limits live in `server/src/services/ai-usage.service.ts`.
- `AI_USAGE_LIMIT_ENABLED=false` disables usage enforcement and premium AI locks without changing authentication requirements. Default is enabled; set `AI_USAGE_LIMIT_ENABLED=true` in normal environments.
- A conditional upsert reserves usage atomically before AI work starts.
- Failed AI requests release reserved usage.
- Cache charging is feature-specific: Ask Yoca AI counts successful cache hits; Volatility Signal Summary does not.
- Wallet AI Analysis and Wash Trading AI Analysis are locked until Plus; locked tiers receive `403 AI_FEATURE_LOCKED` and do not write usage.
- Wash Trading also has a client-side Plus/Pro modal gate to prevent direct page visits from auto-running unusable AI analysis; the backend lock remains authoritative.
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

## Remaining AI Feature Behavior

- `POST /api/chat` requires authentication and consumes `general_ai_chat` quota for every successful response, including cache hits.
- `POST /api/wallets/ai-analysis` and `POST /api/wallets/analysis` require authentication and Plus or higher; cache hits require Plus but do not consume quota.
- `POST /api/v1/wash-trading/ai-analyze` and `GET /api/v1/wash-trading/:mint` require authentication and Plus or higher; legacy deterministic wash-trading endpoints stay public.
- Token chart news summaries only consume `token_chart_news_summary` when `includeSummary=true` produces a Gemini summary; regular chart news, cache hits, and deterministic fallbacks do not consume quota.
- `POST /api/wallets/ai-swap-summary` and `POST /api/wallets/ai-swap-summary/token` still require authentication if used, but no longer reserve or report AI usage.

## Implementation Checklist

- [x] Add `ai_daily_usage` schema and Drizzle migration.
- [x] Add centralized feature keys and tier limits.
- [x] Resolve valid subscription tier with Free fallback.
- [x] Reserve usage atomically and release failed requests.
- [x] Protect Ask Yoca AI with authentication.
- [x] Return quota metadata on success and exhaustion.
- [x] Display remaining usage and upgrade CTA in the client.
- [x] Enforce Volatility Signal Summary limits only for successful Gemini generations.
- [x] Remove Wallet AI Swap Summary quota enforcement and pricing references.
- [x] Enforce General AI Chat, Token Chart News Summary, Wallet AI Analysis, and Wash Trading AI Analysis limits.
- [x] Add client-side Wash Trading Plus/Pro gate.
- [x] Publish current AI feature limits and Plus-required locks on the pricing page.
- [x] Add `AI_USAGE_LIMIT_ENABLED` env toggle for local/staging quota bypass.

## Verification

- Free/Lite/Plus/Pro stop at 5/20/50/100 successful requests per UTC day for Ask Yoca AI and General AI Chat.
- Concurrent requests cannot reserve beyond the tier limit.
- Provider/server failures release their reservation.
- Successful cached responses consume one usage only for features whose cache policy counts hits.
- Expired, canceled, and past-due subscriptions fall back to Free.
- Unauthenticated requests return `401`.
- Exhausted requests return `429` without invoking the AI provider.
- Volatility summary cache hits and deterministic fallbacks do not consume usage.
- General AI Chat stops at 5/20/50/100 successful responses per UTC day.
- Wallet AI Analysis and Wash Trading AI Analysis return `403 AI_FEATURE_LOCKED` for Free/Lite and stop Plus/Pro at 51/101.
- Free/Lite users who visit Wash Trading directly see the Plus/Pro modal and do not auto-run AI analysis.
- Token Chart News Summary remains public without summaries; summary cache hits and deterministic fallbacks do not consume usage.
- Wallet AI Swap Summary routes do not write usage rows and do not return quota metadata.
- With `AI_USAGE_LIMIT_ENABLED=false`, no AI usage rows are written, no `429` quota exhaustion is returned, Plus-only AI locks are bypassed, and authenticated endpoints still require login.
