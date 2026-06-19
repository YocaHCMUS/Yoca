CREATE TABLE "helius_webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"helius_webhook_id" text NOT NULL,
	"webhook_url" text NOT NULL,
	"webhook_type" text DEFAULT 'enhanced' NOT NULL,
	"transaction_types" text[] DEFAULT ARRAY['ANY']::text[] NOT NULL,
	"account_addresses" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "helius_webhooks_helius_webhook_id_unique" UNIQUE("helius_webhook_id")
);
--> statement-breakpoint
CREATE TABLE "helius_webhook_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"helius_webhook_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "helius_webhook_addresses_helius_webhook_id_wallet_address_unique" UNIQUE("helius_webhook_id","wallet_address")
);
--> statement-breakpoint
ALTER TABLE "helius_webhook_addresses" ADD CONSTRAINT "helius_webhook_addresses_helius_webhook_id_helius_webhooks_helius_webhook_id_fk" FOREIGN KEY ("helius_webhook_id") REFERENCES "public"."helius_webhooks"("helius_webhook_id") ON DELETE cascade ON UPDATE no action;
