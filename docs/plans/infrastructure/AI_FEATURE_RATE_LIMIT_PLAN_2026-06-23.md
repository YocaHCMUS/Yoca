# AI Feature Rate Limit Plan

Date: 2026-06-23  
Status: Ask Yoca AI, Volatility Signal Summary, and Wallet AI Swap Summary implemented

## Architecture

- PostgreSQL table `ai_daily_usage` stores one counter per user, feature, and UTC date.
- Feature limits live in `server/src/services/ai-usage.service.ts`.
- A conditional upsert reserves usage atomically before AI work starts.
- Failed AI requests release reserved usage.
- Cache charging is feature-specific: Ask Yoca AI counts successful cache hits; Volatility Signal Summary does not.
- Wallet AI Swap Summary and its token-level AI Analysis share one daily counter; cache hits do not count.
- Daily counters reset at `00:00 UTC`.
- Existing short-window IP throttles remain separate abuse protection.
- Users without a valid paid subscription use the Free tier.
- Paid tiers require status `active` or `trialing` and an unexpired subscription period.

## Feature Registry

| Feature | Key | Free | Lite | Plus | Pro | Status |
|---|---|---:|---:|---:|---:|---|
| Ask Yoca AI | `ask_yoca_ai` | 5 | 20 | 50 | 100 | Enforced |
| General AI Chat | Pending | Pending product limits | Pending product limits | Pending product limits | Pending product limits | Not enforced |
| Wallet AI Analysis | Pending | Pending product limits | Pending product limits | Pending product limits | Pending product limits | Not enforced |
| Wallet AI Swap Summary | `wallet_ai_swap_summary` | 10 | 20 | 50 | 100 | Enforced |
| Wash Trading AI Analysis | Pending | Pending product limits | Pending product limits | Pending product limits | Pending product limits | Not enforced |
| Volatility Signal Summary | `volatility_signal_summary` | 10 | 25 | 50 | 100 | Enforced |
| Other token news AI summaries | Pending | Pending product limits | Pending product limits | Pending product limits | Pending product limits | Not enforced |

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
- [x] Publish approved Ask Yoca AI, Volatility Summary, and Wallet AI Swap Summary limits on the pricing page.
- [x] Keep other AI features unenforced until product limits are supplied.
- [ ] Apply limits to each pending AI feature after its tier values are approved.

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
