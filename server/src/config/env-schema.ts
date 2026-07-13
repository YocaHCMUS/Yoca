import z from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  POSTGRES_DB_URL: z.url("Invalid database URL"),
  JWT_SECRET: z.string().min(1, "Jwt is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "Google client id is required"),
  SERVER_PORT: z.coerce.number().default(4000),

  // API Keys and URLs
  COINGECKO_API_BASE_URL: z.url().default("https://api.coingecko.com/api/v3"),
  COINGECKO_API_KEY: z.string(),

  BIRDEYE_API_BASE_URL: z.url().default("https://public-api.birdeye.so"),
  BIRDEYE_API_KEY: z.string(),

  ZERION_API_BASE_URL: z.url().default("https://api.zerion.io/v1"),
  ZERION_API_KEY: z.string(),

  COINMARKETCAP_API_BASE_URL: z.url().default("https://pro-api.coinmarketcap.com"),
  COINMARKETCAP_API_KEY: z.string().optional(),

  HELIUS_API_KEY: z.string(),
  HELIUS_API_BASE_URL: z.url().optional().default("https://api.helius.xyz"),
  HELIUS_AUTH_HEADER: z.string().optional().default(""),
  HELIUS_WEBHOOK_AUTH_KEY: z.string(),
  HELIUS_WEBHOOK_ID: z.string().optional().default(""),
  PUBLIC_WEBHOOK_URL: z.string().optional().default(""),
  WEBHOOK_PUBLIC_URL: z.string().optional().default(""),
  WEBHOOK_SOL_PRICE_USD: z.coerce.number().positive().optional().default(150),
  MORALIS_API_BASE_URL: z.url().default("https://solana-gateway.moralis.io"),
  MORALIS_API_KEY: z.string(),
  MOBULA_API_BASE_URL: z.url().default("https://api.mobula.io/api"),
  MOBULA_API_KEY: z.string().trim().min(1),
  WALLET_AI_ANALYSIS_WEBHOOK_URL: z
    .url()
    .default("http://localhost:5678/webhook/analyse-wallet"),

  N8N_ANALYSE_WALLET_URL: z
    .url()
    .default("http://localhost:5678/webhook/analyse-wallet"),
  N8N_ANALYSIS_TIMEOUT_MS: z.coerce.number().int().positive().default(200000),
  BRAVE_SEARCH_API_KEY: z.string().optional().default(""),
  BRAVE_SEARCH_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  BRAVE_MONTHLY_SOFT_LIMIT: z.coerce.number().int().positive().optional(),
  BRAVE_MONTHLY_USED_OFFSET: z.coerce.number().int().min(0).default(0),
  GOOGLE_AI_KEY: z.string().optional().default(""),

  // Stripe
  STRIPE_SECRET_KEY: z.string().default(""),

  // SMTP password reset email
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(465),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  APP_NAME: z.string().optional().default("Yoca"),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_FROM: z.string().optional().default(""),
  FROM_EMAIL: z.string().optional().default(""),

  // Client domains
  CLIENT_LOCAL_DOMAIN: z.url().default("http://localhost:3000"),
  CLIENT_DEV_DOMAIN: z.url().default("http://localhost:3000"),
  CLIENT_DEV_PREVIEW_DOMAIN: z.url().default("http://localhost:4173"),
  CLIENT_PROD_DOMAIN: z.url(),

  // AI
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODAL: z.string().optional().default("gemini-3.1-flash-lite"),
  GEMINI_SWAP_SUMMARY_MODEL: z
    .string()
    .optional()
    .default("gemini-3.1-flash-lite"),
  CHAT_MODEL: z.string().optional().default("gemini-3.1-flash-lite"),
  AI_USAGE_LIMIT_ENABLED: z.enum(["true", "false"]),
});

export type Env = z.infer<typeof envSchema>;
