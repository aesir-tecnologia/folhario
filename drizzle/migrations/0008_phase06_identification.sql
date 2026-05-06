CREATE TABLE "provider_circuit_breakers" (
	"provider" varchar(64) PRIMARY KEY NOT NULL,
	"state" varchar(16) DEFAULT 'closed' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"in_flight_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_budgets" ADD COLUMN "cost_per_request_cents" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_budgets" ADD COLUMN "last_alerted_at" date;--> statement-breakpoint
INSERT INTO "provider_circuit_breakers" ("provider", "state", "consecutive_failures") VALUES ('plant_id', 'closed', 0) ON CONFLICT ("provider") DO NOTHING;--> statement-breakpoint
INSERT INTO "provider_circuit_breakers" ("provider", "state", "consecutive_failures") VALUES ('openai_compat', 'closed', 0) ON CONFLICT ("provider") DO NOTHING;--> statement-breakpoint
UPDATE "provider_budgets" SET "cost_per_request_cents" = 3 WHERE "provider" = 'openai_compat';