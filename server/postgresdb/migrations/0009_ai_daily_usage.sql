CREATE TABLE "ai_daily_usage" (
	"user_id" uuid NOT NULL,
	"feature" varchar(64) NOT NULL,
	"usage_date" date NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_daily_usage_user_id_feature_usage_date_pk" PRIMARY KEY("user_id","feature","usage_date")
);
--> statement-breakpoint
ALTER TABLE "ai_daily_usage" ADD CONSTRAINT "ai_daily_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
