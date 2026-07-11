const TEST_ENV_DEFAULTS: Record<string, string> = {
  POSTGRES_DB_URL: "postgres://localhost:5432/yoca_test",
  JWT_SECRET: "test-jwt-secret",
  GOOGLE_CLIENT_ID: "test-client-id",
  COINGECKO_API_KEY: "test-coingecko",
  BIRDEYE_API_KEY: "test-birdeye",
  ZERION_API_KEY: "test-zerion",
  HELIUS_API_KEY: "test-helius",
  HELIUS_WEBHOOK_AUTH_KEY: "test-helius-webhook",
  MORALIS_API_KEY: "test-moralis",
  MOBULA_API_KEY: "test-mobula",
  CLIENT_PROD_DOMAIN: "http://localhost:3000",
  AI_USAGE_LIMIT_ENABLED: "true",
};

for (const [key, value] of Object.entries(TEST_ENV_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}
