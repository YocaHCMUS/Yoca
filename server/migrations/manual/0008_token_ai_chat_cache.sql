CREATE TABLE IF NOT EXISTS "token_ai_chat_cache" (
  "id" serial PRIMARY KEY NOT NULL,
  "token_address" varchar(44) NOT NULL,
  "normalized_question_hash" varchar(64) NOT NULL,
  "timeframe" varchar(16) NOT NULL,
  "language" varchar(8) NOT NULL,
  "prompt_version" varchar(32) NOT NULL,
  "model" varchar(128) NOT NULL,
  "response_json" jsonb NOT NULL,
  "evidence_hash" varchar(64) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "token_ai_chat_cache_key_uq"
ON "token_ai_chat_cache" (
  "token_address",
  "normalized_question_hash",
  "timeframe",
  "language",
  "prompt_version",
  "model",
  "evidence_hash"
);
