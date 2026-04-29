export const CG_TOKEN_LIST_TTL_MS = 30 * 24 * 60 * 1000; // 1 month
export const TOKEN_DETAILS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
export const TOKEN_MARKET_DATA_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const WALLET_BALANCES_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const TOKEN_CHART_24H_UPDATE_THRESHOLD = 7 * 60 * 1000; // 7 minutes
export const TOKEN_CHART_HOURLY_UPDATE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
export const TOKEN_CHART_DAILY_UPDATE_THRESHOLD = 6 * 60 * 60 * 1000; // 6 hours
export const TOKEN_CHART_HOURLY_FETCH_RANGE_MS =
  90 * 24 * 60 * 60 * 1000 - 2 * 60 * 1000;
export const TOKEN_CHART_DAILY_FETCH_RANGE_MS =
  365 * 24 * 60 * 60 * 1000 - 2 * 60 * 1000;
export const TOKEN_POOLS_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour
export const ONCHAIN_TOKEN_DATA_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const TRENDING_TOKENS_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const TOP_TOKEN_HOLDER_STATS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const TOP_TOKEN_HOLDERS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const POOL_TRADES_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const RECENT_TRADES_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const TOKEN_POOL_DATA_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour
export const TOKEN_DEX_LOGOS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const AUTHEN_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SOLANA_LOGIN_NOUNCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const UPDATE_TRENDING_TOKENS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const TOP_TOKENS_BY_MARKET_CAP_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
export const TRADER_GAINEERS_LOSERS_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

// Trending tokens fetching
export const TRENDING_TOKENS_RESULT_LIMIT = 10;
export const TRENDING_TOKENS_BIRDEYE_FETCH_LIMIT = 20;
export const TRENDING_TOKENS_MAX_FETCH_ROUNDS = 10;

export const AUTH_COOKIE_NAME = "auth_token";

// Wallets

export const WALLET_OVERVIEW_TTL_MS = 60 * 60 * 1000; // 1 hour
export const WALLET_PORTFOLIO_TTL_MS = 60 * 60 * 1000; // 1 hour
export const WALLET_TRANSACTIONS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const WALLET_TRANSFERS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const WALLET_SWAPS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const WALLET_EXCHANGE_COUNTS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const WALLET_IDENTITY_KNOWN_TTL_MS = 6 * 60 * 60 * 1000; // 72 hours
export const WALLET_IDENTITY_UNKNOWN_TTL_MS = 2 * 60 * 60 * 1000; // 24 hours

export const WALLET_TOKEN_DETAILS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const WALLET_BALANCE_HISTORY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// AI Wallet Forensic Audit
export const WALLET_AUDIT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/** How many recent transactions to send into Gemini for behavioural audit. */
export const WALLET_AUDIT_TX_SAMPLE_SIZE = 30;
/** Gemini model id used by the AI Wallet Forensic Auditor. Override with GEMINI_AUDIT_MODEL. */
export const WALLET_AUDIT_MODEL =
  process.env.GEMINI_AUDIT_MODEL?.trim() || "gemini-3-flash";
export const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY?.trim() || "";

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value == null || value.length === 0) {
    return fallback;
  }

  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

/** Upper bound for outbound provider HTTP requests (Helius, Moralis, Birdeye, CoinGecko, etc.). */
export const OUTBOUND_FETCH_TIMEOUT_MS = readNumberEnv(
  "OUTBOUND_FETCH_TIMEOUT_MS",
  90_000,
);

function readListEnv(name: string): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0);
}

export const API_CALL_TRACKER_ENABLED = readBooleanEnv(
  "API_CALL_TRACKER_ENABLED",
  false,
);
export const API_CALL_TRACKER_EXPORT_DIR =
  process.env.API_CALL_TRACKER_EXPORT_DIR?.trim() ||
  "server/src/logs/api-tracker";
export const API_CALL_TRACKER_MAX_RESPONSE_BYTES = readNumberEnv(
  "API_CALL_TRACKER_MAX_RESPONSE_BYTES",
  2_000_000,
);
const apiCallTrackerRedactFields = readListEnv(
  "API_CALL_TRACKER_REDACT_FIELDS",
);
export const API_CALL_TRACKER_REDACT_FIELDS = apiCallTrackerRedactFields.length
  ? apiCallTrackerRedactFields
  : [
      "apikey",
      "api_key",
      "authorization",
      "token",
      "password",
      "secret",
      "signature",
    ];
export const API_CALL_TRACKER_PROVIDER_ALLOWLIST = readListEnv(
  "API_CALL_TRACKER_PROVIDER_ALLOWLIST",
);

// ACMS / Wallet feature flags
export const WALLET_USE_ACMS = readBooleanEnv("WALLET_USE_ACMS", false);
