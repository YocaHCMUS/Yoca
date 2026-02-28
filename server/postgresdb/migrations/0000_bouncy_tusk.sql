-- Only the new wallet cache tables (existing tables already in DB)
CREATE TABLE IF NOT EXISTS "wallet_overview_cache" (
	"address" varchar(66) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"total_asset_value_usd" numeric NOT NULL,
	"trading_volume_usd_24h" numeric,
	"pnl_usd_total" numeric,
	"transaction_count_24h" integer,
	"tokens_traded_count" integer,
	"tokens_holding_count" integer NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_overview_cache_address_chain_pk" PRIMARY KEY("address","chain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_portfolio_cache" (
	"address" varchar(66) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_portfolio_cache_address_chain_pk" PRIMARY KEY("address","chain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_transactions_meta" (
	"address" varchar(66) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_transactions_meta_address_chain_pk" PRIMARY KEY("address","chain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
	"address" varchar(66) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"hash" text NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"from_address" varchar(66) NOT NULL,
	"to_address" varchar(66) NOT NULL,
	"receipt_status" smallint,
	"fee" numeric,
	"main_action" text,
	"direction" text,
	"primary_token_symbol" text,
	"primary_token_amount" numeric,
	"primary_token_address" varchar(66),
	"price_usd" numeric,
	"total_usd" numeric,
	"tokens" jsonb,
	CONSTRAINT "wallet_transactions_address_chain_hash_pk" PRIMARY KEY("address","chain","hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_exchange_counts_cache" (
	"address" varchar(66) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_exchange_counts_cache_address_chain_pk" PRIMARY KEY("address","chain")
);
