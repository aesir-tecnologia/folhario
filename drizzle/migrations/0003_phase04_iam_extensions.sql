-- Conditional `service_role` role for plain-Postgres CI (mirrors the
-- `authenticated` guard in 0001). Production runs on Supabase, which ships
-- with `service_role` BYPASSRLS pre-created. Without this guard, vanilla
-- `postgres:17-alpine` (used by GitHub Actions) errors with
-- `role "service_role" does not exist` when the policies below execute.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOINHERIT BYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
-- Plain-Postgres CI lacks Supabase's pre-configured service_role GRANTs.
-- BYPASSRLS lets service_role skip RLS but it still needs table-level
-- privileges to issue the query. Idempotent on Supabase. Mirrors the
-- authenticated GRANT block in 0001.
GRANT USAGE ON SCHEMA public TO service_role;--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;--> statement-breakpoint
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;--> statement-breakpoint
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;--> statement-breakpoint
CREATE TABLE "auth_throttle" (
	"ip" varchar(45) NOT NULL,
	"endpoint" varchar(64) NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_throttle_ip_endpoint_window_start_pk" PRIMARY KEY("ip","endpoint","window_start")
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_to_email" varchar(320) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_to_email" varchar(320) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_idx" ON "email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint

-- Phase 4 RLS posture (CONTEXT D-12, RESEARCH.md "Group 13" RLS posture, Phase 2 D-20-D-22 inheritance)

-- Token tables: service-role-only (no user JWT can read or modify)
ALTER TABLE "email_verification_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "service_role_only" ON "email_verification_tokens"
  FOR ALL TO service_role USING (true) WITH CHECK (true);--> statement-breakpoint
-- No policy for authenticated/anon roles → default-deny.

ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "service_role_only" ON "password_reset_tokens"
  FOR ALL TO service_role USING (true) WITH CHECK (true);--> statement-breakpoint

-- Throttle table: service-role-only (Phase 4 throttle middleware uses service role)
ALTER TABLE "auth_throttle" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "service_role_only" ON "auth_throttle"
  FOR ALL TO service_role USING (true) WITH CHECK (true);--> statement-breakpoint

-- Index for cleanup sweeps (D-12 OR clause: cleanup via partial-index TTL or external sweep — NO Inngest cron)
CREATE INDEX IF NOT EXISTS "auth_throttle_window_start_idx"
  ON "auth_throttle" ("window_start");--> statement-breakpoint

-- Index for lockout lookups (Plan 03 throttle middleware reads locked_until on every request)
CREATE INDEX IF NOT EXISTS "auth_throttle_locked_until_idx"
  ON "auth_throttle" ("locked_until") WHERE "locked_until" IS NOT NULL;