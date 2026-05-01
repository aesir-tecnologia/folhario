CREATE TYPE "public"."pending_deletion_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "pending_storage_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"prefix" text NOT NULL,
	"status" "pending_deletion_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"started_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pending_storage_deletions" ADD CONSTRAINT "pending_storage_deletions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "psd_status_scheduled_at_idx" ON "pending_storage_deletions" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "psd_user_id_idx" ON "pending_storage_deletions" USING btree ("user_id");
--> statement-breakpoint
-- Phase 5 D-23 RLS posture: owner-only access on pending_storage_deletions.
-- Reconciler cron uses service_role (BYPASSRLS) per Plan 05-06 / RESEARCH Pitfall 4.

ALTER TABLE "pending_storage_deletions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pending_storage_deletions_owner_all') THEN
    CREATE POLICY "pending_storage_deletions_owner_all" ON public.pending_storage_deletions
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;
--> statement-breakpoint