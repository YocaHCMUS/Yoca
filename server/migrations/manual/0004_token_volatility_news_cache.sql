CREATE TABLE IF NOT EXISTS "token_volatility_news_cache" (
  "id" serial PRIMARY KEY NOT NULL,
  "token_address" varchar(44) NOT NULL,
  "symbol" varchar(32) NOT NULL,
  "name" varchar(128) NOT NULL,
  "threshold_percent" numeric NOT NULL,
  "timeframe" varchar(16) NOT NULL,
  "detection_window" varchar(16) NOT NULL,
  "max_events_with_news" integer NOT NULL,
  "include_summary" boolean DEFAULT false NOT NULL,
  "response_json" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);

ALTER TABLE "token_volatility_news_cache"
  ADD COLUMN IF NOT EXISTS "include_summary" boolean DEFAULT false NOT NULL;

ALTER TABLE "token_volatility_news_cache"
  ADD COLUMN IF NOT EXISTS "response_json" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "token_volatility_news_cache"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "token_volatility_news_cache"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "token_volatility_news_cache"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "token_volatility_news_cache"
  ALTER COLUMN "response_json" DROP DEFAULT;

ALTER TABLE "token_volatility_news_cache"
  ALTER COLUMN "expires_at" DROP DEFAULT;

DROP INDEX IF EXISTS "token_volatility_news_cache_key_uq";

CREATE UNIQUE INDEX IF NOT EXISTS "token_volatility_news_cache_key_uq"
ON "token_volatility_news_cache" USING btree (
  "token_address",
  "threshold_percent",
  "timeframe",
  "detection_window",
  "max_events_with_news",
  "include_summary"
);
