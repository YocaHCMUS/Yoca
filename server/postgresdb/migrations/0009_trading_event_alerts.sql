DO $$ BEGIN
  CREATE TYPE "public"."trading_event_type" AS ENUM('any_trade', 'buy', 'sell', 'swap');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trading_event_alert_targets" (
  "alert_id" uuid PRIMARY KEY NOT NULL REFERENCES "public"."alerts"("id") ON DELETE cascade,
  "token_address" varchar(44) NOT NULL,
  "wallet_address" varchar(44)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trading_event_alert_conditions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alert_id" uuid NOT NULL REFERENCES "public"."alerts"("id") ON DELETE cascade,
  "event_type" "trading_event_type" NOT NULL,
  "min_sol_amount" numeric
);
--> statement-breakpoint
ALTER TABLE "alert_history" ADD COLUMN IF NOT EXISTS "event_key" varchar(128);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alert_history_alert_event_key_uidx"
  ON "alert_history" ("alert_id", "event_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trading_event_alert_targets_token_idx"
  ON "trading_event_alert_targets" ("token_address");
