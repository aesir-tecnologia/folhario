CREATE TABLE "location_suggestions" (
	"user_id" uuid NOT NULL,
	"label_normalized" varchar(200) NOT NULL,
	"label_display" varchar(200) NOT NULL,
	"usage_count" integer DEFAULT 1 NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_suggestions_user_id_label_normalized_pk" PRIMARY KEY("user_id","label_normalized")
);
--> statement-breakpoint
ALTER TABLE "location_suggestions" ADD CONSTRAINT "location_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loc_suggestions_user_rank_idx" ON "location_suggestions" USING btree ("user_id","usage_count","last_used_at");
--> statement-breakpoint
-- Phase 5 D-09 RLS posture: owner-only access on location_suggestions.

ALTER TABLE "location_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'location_suggestions_owner_all') THEN
    CREATE POLICY "location_suggestions_owner_all" ON public.location_suggestions
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;
--> statement-breakpoint