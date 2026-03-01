CREATE TYPE "public"."trade_type" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE "pool_trades_24h" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"pool_address" varchar(44) NOT NULL,
	"transaction_hash" varchar(88) NOT NULL,
	"signer_address" varchar(44) NOT NULL,
	"sell_token_amount" numeric NOT NULL,
	"buy_token_amount" numeric NOT NULL,
	"sell_token_address" varchar(44) NOT NULL,
	"buy_token_address" varchar(44) NOT NULL,
	"sell_token_price_usd" numeric NOT NULL,
	"buy_token_price_usd" numeric NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"volume_in_usd" numeric NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_holder_stats" (
	"address" varchar(44) PRIMARY KEY NOT NULL,
	"holders_count" integer NOT NULL,
	"top_10_percent" numeric NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_pool_data" (
	"address" varchar(44) PRIMARY KEY NOT NULL,
	"name" varchar,
	"base_address" varchar(44) NOT NULL,
	"quote_address" varchar(44) NOT NULL,
	"dex_id" varchar,
	"pool_created_at" timestamp,
	"liquidity_usd" numeric,
	"base_token_price_usd" numeric,
	"quote_token_price_usd" numeric,
	"base_token_price_sol" numeric,
	"quote_token_price_sol" numeric,
	"market_cap_usd" numeric,
	"fdv_usd" numeric,
	"price_change_percentage_1h" numeric,
	"price_change_percentage_6h" numeric,
	"price_change_percentage_24h" numeric,
	"buys_1h" numeric,
	"buys_6h" numeric,
	"buys_24h" numeric,
	"sells_1h" numeric,
	"sells_6h" numeric,
	"sells_24h" numeric,
	"buyers_1h" numeric,
	"buyers_6h" numeric,
	"buyers_24h" numeric,
	"sellers_1h" numeric,
	"sellers_6h" numeric,
	"sellers_24h" numeric,
	"volume_usd_1h" numeric,
	"volume_usd_6h" numeric,
	"volume_usd_24h" numeric,
	"buy_volume_usd_1h" numeric,
	"buy_volume_usd_6h" numeric,
	"buy_volume_usd_24h" numeric,
	"sell_volume_usd_1h" numeric,
	"sell_volume_usd_6h" numeric,
	"sell_volume_usd_24h" numeric,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_tops_pool" (
	"token_address" varchar(44) NOT NULL,
	"pool_address" varchar(44) NOT NULL,
	"rank" integer NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "token_tops_pool_token_address_rank_pk" PRIMARY KEY("token_address","rank")
);
--> statement-breakpoint
CREATE TABLE "top_token_holders" (
	"token_address" varchar(44) NOT NULL,
	"holder_address" varchar(44) NOT NULL,
	"rank" integer NOT NULL,
	"percentage" numeric NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "top_token_holders_token_address_rank_pk" PRIMARY KEY("token_address","rank")
);
--> statement-breakpoint
CREATE TABLE "trending_tokens" (
	"address" varchar(44) PRIMARY KEY NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "token_market_chart_24h" ALTER COLUMN "address" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_chart_daily" ALTER COLUMN "address" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_chart_hourly" ALTER COLUMN "address" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "price_change_24h" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "price_change_percentage_1h" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "price_change_percentage_24h" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "market_cap_change_24h" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "market_cap_change_percentage_24h" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "market_cap_rank" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "market_cap_rank" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "high_24h" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "low_24h" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "circulating_supply" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "total_supply" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "max_supply" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "ath" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "ath_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "ath_change_percentage" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "atl" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "atl_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "atl_change_percentage" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "token_meta" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "token_market_data" ADD COLUMN "decimals" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "token_market_data" ADD COLUMN "price_btc" numeric;--> statement-breakpoint
ALTER TABLE "token_market_data" ADD COLUMN "price_change_btc_24h" numeric;--> statement-breakpoint
ALTER TABLE "token_market_data" ADD COLUMN "price_change_percentage_7d" numeric;--> statement-breakpoint
ALTER TABLE "token_market_data" ADD COLUMN "total_liquidity" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "token_meta" ADD COLUMN "coingecko_id" varchar;--> statement-breakpoint
ALTER TABLE "token_meta" ADD COLUMN "homepage" varchar;--> statement-breakpoint
ALTER TABLE "token_meta" ADD COLUMN "link_discord" varchar;--> statement-breakpoint
ALTER TABLE "token_meta" ADD COLUMN "twitter_screen_name" varchar;