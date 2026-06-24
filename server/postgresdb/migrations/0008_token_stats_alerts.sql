DO $$ BEGIN
  CREATE TYPE "public"."alert_type" AS ENUM('token', 'trading');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."condition_op" AS ENUM('gt', 'gte', 'eq', 'lt', 'lte');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."token_metric" AS ENUM('price_percentage', 'price_usd');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."alert_status" AS ENUM('running', 'stopped');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."alert_period" AS ENUM('30m', '1h', '6h', '24h');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."alert_trigger_mode" AS ENUM('once', 'always');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."trade_direction" AS ENUM('buy', 'sell', 'both');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."trading_aggregation" AS ENUM('volume_usd', 'trade_count');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "alert_type" "alert_type" NOT NULL,
  "trigger_mode" "alert_trigger_mode" DEFAULT 'once' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "name" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_delivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alert_id" uuid NOT NULL REFERENCES "public"."alerts"("id") ON DELETE cascade,
  "email" varchar(255),
  "discord_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_delivery" ALTER COLUMN "email" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "alert_delivery" ADD COLUMN IF NOT EXISTS "discord_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_state" (
  "alert_id" uuid PRIMARY KEY REFERENCES "public"."alerts"("id") ON DELETE cascade,
  "status" "alert_status" DEFAULT 'running' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_alert_targets" (
  "alert_id" uuid NOT NULL REFERENCES "public"."alerts"("id") ON DELETE cascade,
  "token_address" varchar(44) NOT NULL,
  CONSTRAINT "token_alert_targets_alert_id_token_address_pk" PRIMARY KEY("alert_id", "token_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_alert_conditions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alert_id" uuid NOT NULL REFERENCES "public"."alerts"("id") ON DELETE cascade,
  "period" "alert_period" DEFAULT '1h' NOT NULL,
  "metric" "token_metric" NOT NULL,
  "condition_op" "condition_op" NOT NULL,
  "value" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trading_alert_scopes" (
  "alert_id" uuid NOT NULL REFERENCES "public"."alerts"("id") ON DELETE cascade,
  "wallet_address" varchar(44) NOT NULL,
  "token_address" varchar(44),
  "pool_address" varchar(44),
  "counterparty_address" varchar(44),
  "direction" "trade_direction" DEFAULT 'both' NOT NULL,
  CONSTRAINT "trading_alert_scopes_alert_id_wallet_address_pk" PRIMARY KEY("alert_id", "wallet_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trading_alert_webhooks" (
  "alert_id" uuid NOT NULL REFERENCES "public"."alerts"("id") ON DELETE cascade,
  "webhook_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trading_alert_conditions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alert_id" uuid NOT NULL REFERENCES "public"."alerts"("id") ON DELETE cascade,
  "aggregation" "trading_aggregation" NOT NULL,
  "period" "alert_period" DEFAULT '1h' NOT NULL,
  "condition_op" "condition_op" NOT NULL,
  "value" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_metrics_1m" (
  "wallet" varchar(44) NOT NULL,
  "bucket_ts" timestamp NOT NULL,
  "volume_usd" numeric DEFAULT 0 NOT NULL,
  "trade_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "wallet_metrics_1m_wallet_bucket_ts_pk" PRIMARY KEY("wallet", "bucket_ts")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alert_id" uuid REFERENCES "public"."alerts"("id") ON DELETE set null,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "alert_name" varchar(255) NOT NULL,
  "message" varchar(1000) NOT NULL,
  "metadata" jsonb,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "alert_history" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_history_alert_sent_at_idx" ON "alert_history" ("alert_id", "sent_at" DESC);
CREATE INDEX IF NOT EXISTS "alerts_token_expiry_idx" ON "alerts" ("alert_type", "expires_at");
