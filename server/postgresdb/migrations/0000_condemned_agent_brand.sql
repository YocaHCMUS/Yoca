CREATE TABLE "coin_gecko_token_list" (
	"token_address" varchar(44) PRIMARY KEY NOT NULL,
	"coin_gecko_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_gecko_token_list_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"last_refresh" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_market_chart_24h" (
	"address" varchar(44),
	"unix_timestamp_ms" bigint NOT NULL,
	"price" numeric NOT NULL,
	"market_cap" numeric NOT NULL,
	"total_volume" numeric NOT NULL,
	CONSTRAINT "token_market_chart_24h_address_unix_timestamp_ms_pk" PRIMARY KEY("address","unix_timestamp_ms")
);
--> statement-breakpoint
CREATE TABLE "token_market_chart_daily" (
	"address" varchar(44),
	"unix_timestamp_ms" bigint NOT NULL,
	"price" numeric NOT NULL,
	"market_cap" numeric NOT NULL,
	"total_volume" numeric NOT NULL,
	"unix_updated_at" integer NOT NULL,
	CONSTRAINT "token_market_chart_daily_address_unix_timestamp_ms_pk" PRIMARY KEY("address","unix_timestamp_ms")
);
--> statement-breakpoint
CREATE TABLE "token_market_chart_hourly" (
	"address" varchar(44),
	"unix_timestamp_ms" bigint NOT NULL,
	"price" numeric NOT NULL,
	"market_cap" numeric NOT NULL,
	"total_volume" numeric NOT NULL,
	"unix_updated_at" integer NOT NULL,
	CONSTRAINT "token_market_chart_hourly_address_unix_timestamp_ms_pk" PRIMARY KEY("address","unix_timestamp_ms")
);
--> statement-breakpoint
CREATE TABLE "token_market_data" (
	"address" varchar(44) PRIMARY KEY NOT NULL,
	"price_usd" numeric NOT NULL,
	"price_change_24h" numeric NOT NULL,
	"price_change_percentage_1h" numeric NOT NULL,
	"price_change_percentage_24h" numeric NOT NULL,
	"price_change_percentage_14d" numeric NOT NULL,
	"price_change_percentage_30d" numeric NOT NULL,
	"price_change_percentage_200d" numeric NOT NULL,
	"price_change_percentage_1y" numeric NOT NULL,
	"market_cap" numeric NOT NULL,
	"market_cap_change_24h" numeric NOT NULL,
	"market_cap_change_percentage_24h" numeric NOT NULL,
	"market_cap_rank" numeric NOT NULL,
	"high_24h" numeric NOT NULL,
	"low_24h" numeric NOT NULL,
	"fully_diluted_valuation" numeric NOT NULL,
	"24h_volume" numeric NOT NULL,
	"circulating_supply" numeric NOT NULL,
	"total_supply" numeric NOT NULL,
	"max_supply" numeric NOT NULL,
	"ath" numeric NOT NULL,
	"ath_date" timestamp NOT NULL,
	"ath_change_percentage" numeric NOT NULL,
	"atl" numeric NOT NULL,
	"atl_date" timestamp NOT NULL,
	"atl_change_percentage" numeric NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_meta" (
	"address" varchar(44) PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"symbol" varchar NOT NULL,
	"image_url" varchar,
	"description" varchar,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_transfers" (
	"from_address" varchar(44) NOT NULL,
	"to_address" varchar(44) NOT NULL,
	"amount" numeric NOT NULL,
	"amount_usd" numeric NOT NULL,
	"block_time" timestamp NOT NULL,
	"token_address" varchar(44) NOT NULL,
	"transaction_signature" char(64) NOT NULL,
	"instruction_index" integer NOT NULL,
	CONSTRAINT "token_transfers_transaction_signature_instruction_index_pk" PRIMARY KEY("transaction_signature","instruction_index")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallet_balances" (
	"address" varchar(44) NOT NULL,
	"token_address" varchar(44) NOT NULL,
	"total_value_usd" numeric NOT NULL,
	"amount" numeric NOT NULL,
	"value_usd" numeric NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "wallet_balances_address_token_address_pk" PRIMARY KEY("address","token_address")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"address" varchar(44) PRIMARY KEY NOT NULL,
	"balance_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp NOT NULL
);
