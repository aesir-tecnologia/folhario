CREATE TYPE "public"."legal_basis" AS ENUM('consent', 'contract', 'legitimate_interest');--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"provider" varchar(32) NOT NULL,
	"event_id" varchar(128) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"payload" json NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"species_id" uuid NOT NULL,
	"locale" varchar(10) DEFAULT 'pt-BR' NOT NULL,
	"version" varchar(32) NOT NULL,
	"source" varchar(16) NOT NULL,
	"watering" text NOT NULL,
	"light" text NOT NULL,
	"soil" text NOT NULL,
	"temperature_min" integer NOT NULL,
	"temperature_max" integer NOT NULL,
	"humidity" text NOT NULL,
	"toxicity" varchar(24) NOT NULL,
	"toxicity_source_url" varchar(2048),
	"difficulty" varchar(8) NOT NULL,
	"seasonal_tips" text NOT NULL,
	"compatibility_notes" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" varchar(64) NOT NULL,
	"legal_basis" "legal_basis" NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"source" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"grace_period_ends_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "data_export_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"download_url" varchar(2048)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" varchar(200) NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identification_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" varchar(16) NOT NULL,
	"daily_cap" integer NOT NULL,
	"period_cap" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(128),
	CONSTRAINT "identification_limits_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE "identifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plant_id" uuid,
	"photo_urls" text[] NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(128) NOT NULL,
	"results" jsonb NOT NULL,
	"selected_result" jsonb,
	"manual_correction" text,
	"latency_ms" integer NOT NULL,
	"consent_version" varchar(32) NOT NULL,
	"status" varchar(16) NOT NULL,
	"failure_reason" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offline_sync_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" varchar(32) NOT NULL,
	"payload" json NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(64) NOT NULL,
	"trial_days" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"photo_url" varchar(2048) NOT NULL,
	"thumbnail_url" varchar(2048) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"species_id" uuid,
	"name" varchar(200) NOT NULL,
	"nickname" varchar(200),
	"location" varchar(200),
	"acquisition_date" date,
	"notes" text,
	"cover_photo_url" varchar(2048),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(32) NOT NULL,
	"document_type" varchar(32) NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(64) NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"daily_cost_cap_cents" integer NOT NULL,
	"alert_threshold_pct" integer DEFAULT 80 NOT NULL,
	"min_confidence" numeric(3, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "provider_usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(64) NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"utc_date" date NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"endpoint" varchar(2048) NOT NULL,
	"keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_id" uuid NOT NULL,
	"action" varchar(16) NOT NULL,
	"scheduled_date" date NOT NULL,
	"acted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snooze_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"frequency_days" integer NOT NULL,
	"advance_rule" varchar(16) DEFAULT 'from_scheduled' NOT NULL,
	"next_due_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "species" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"common_name" varchar(200) NOT NULL,
	"scientific_name" varchar(200) NOT NULL,
	"reference_image_url" varchar(2048),
	"flag_reason" varchar(32),
	"flag_status" varchar(16),
	"identification_count" integer DEFAULT 0 NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_customer_id" varchar(128),
	"provider_subscription_id" varchar(128),
	"status" varchar(16) NOT NULL,
	"trial_start_date" timestamp with time zone NOT NULL,
	"trial_end_date" timestamp with time zone NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(200) NOT NULL,
	"locale" varchar(10) DEFAULT 'pt-BR' NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"notification_time_local" varchar(5) DEFAULT '09:00' NOT NULL,
	"trial_source" varchar(16) NOT NULL,
	"partner_code" varchar(64),
	"age_confirmed_at" timestamp with time zone,
	"toxicity_disclaimer_acknowledged_at" timestamp with time zone,
	"deletion_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_guides" ADD CONSTRAINT "care_guides_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_policy_version_id_policy_versions_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identifications" ADD CONSTRAINT "identifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identifications" ADD CONSTRAINT "identifications_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_sync_failures" ADD CONSTRAINT "offline_sync_failures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_entries" ADD CONSTRAINT "photo_entries_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_provider_event_id_idx" ON "billing_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "billing_events_subscription_id_idx" ON "billing_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "care_guides_species_id_idx" ON "care_guides" USING btree ("species_id");--> statement-breakpoint
CREATE UNIQUE INDEX "care_guides_species_locale_version_idx" ON "care_guides" USING btree ("species_id","locale","version");--> statement-breakpoint
CREATE INDEX "consent_logs_user_id_idx" ON "consent_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_deletion_requests_user_id_idx" ON "data_deletion_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_export_requests_user_id_idx" ON "data_export_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_user_key_idx" ON "idempotency_keys" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "identifications_user_id_idx" ON "identifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "identifications_plant_id_idx" ON "identifications" USING btree ("plant_id");--> statement-breakpoint
CREATE INDEX "offline_sync_failures_user_id_idx" ON "offline_sync_failures" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_stores_code_idx" ON "partner_stores" USING btree ("code");--> statement-breakpoint
CREATE INDEX "photo_entries_plant_id_idx" ON "photo_entries" USING btree ("plant_id");--> statement-breakpoint
CREATE INDEX "plants_user_id_idx" ON "plants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plants_species_id_idx" ON "plants" USING btree ("species_id");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_versions_doc_version_idx" ON "policy_versions" USING btree ("document_type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_budgets_provider_purpose_idx" ON "provider_budgets" USING btree ("provider","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_usage_counters_provider_purpose_date_idx" ON "provider_usage_counters" USING btree ("provider","purpose","utc_date");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_user_device_idx" ON "push_subscriptions" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminder_logs_reminder_id_idx" ON "reminder_logs" USING btree ("reminder_id");--> statement-breakpoint
CREATE INDEX "reminders_plant_id_idx" ON "reminders" USING btree ("plant_id");--> statement-breakpoint
CREATE INDEX "reminders_next_due_at_idx" ON "reminders" USING btree ("next_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "species_scientific_name_idx" ON "species" USING btree ("scientific_name");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");