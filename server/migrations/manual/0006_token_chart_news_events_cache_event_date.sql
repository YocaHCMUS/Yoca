ALTER TABLE "token_chart_news_events_cache"
  ADD COLUMN IF NOT EXISTS "event_date" varchar(10) DEFAULT '' NOT NULL;

DROP INDEX IF EXISTS "token_chart_news_events_cache_key_uq";

CREATE UNIQUE INDEX IF NOT EXISTS "token_chart_news_events_cache_key_uq"
  ON "token_chart_news_events_cache" (
    "token_address",
    "symbol",
    "name",
    "timeframe",
    "event_date",
    "include_summary"
  );
