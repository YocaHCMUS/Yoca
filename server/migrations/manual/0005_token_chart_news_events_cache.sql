CREATE TABLE IF NOT EXISTS "token_chart_news_events_cache" (
  "id" serial PRIMARY KEY NOT NULL,
  "token_address" varchar(44) NOT NULL,
  "symbol" varchar(32) NOT NULL,
  "name" varchar(128) NOT NULL,
  "timeframe" varchar(16) NOT NULL,
  "include_summary" boolean DEFAULT false NOT NULL,
  "response_json" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);

ALTER TABLE "token_chart_news_events_cache"
  ADD COLUMN IF NOT EXISTS "include_summary" boolean DEFAULT false NOT NULL;

ALTER TABLE "token_chart_news_events_cache"
  ADD COLUMN IF NOT EXISTS "response_json" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "token_chart_news_events_cache"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "token_chart_news_events_cache"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "token_chart_news_events_cache"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp DEFAULT now() NOT NULL;

DROP INDEX IF EXISTS "token_chart_news_events_cache_key_uq";

CREATE UNIQUE INDEX IF NOT EXISTS "token_chart_news_events_cache_key_uq"
  ON "token_chart_news_events_cache" (
    "token_address",
    "symbol",
    "name",
    "timeframe",
    "include_summary"
  );
