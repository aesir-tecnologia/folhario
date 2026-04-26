-- Custom SQL migration file, put your code below! -----
-- Phase 02 Plan 03 Task 2b: handwritten RLS / auth shim / ownership indexes /
-- auth.users -> public.users sync trigger. Lives in its OWN custom migration
-- (not appended to the schema migration) so future `drizzle-kit generate`
-- runs cannot wipe handwritten DDL. Idempotent: every block is guarded by
-- IF NOT EXISTS / DO $$ ... $$ so a double-apply is a no-op.

-- ============================================================
-- Section 1: Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Section 2: Conditional `authenticated` role
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END $$;

-- ============================================================
-- Section 3: Conditional minimal auth.uid() helper for plain-Postgres CI
-- ============================================================

-- This helper exists for plain-Postgres CI ONLY — production runs against
-- Supabase, which already provides the real `auth.uid()` rooted in PostgREST
-- JWT claims. The script `scripts/check-rls.ts` enforces a runtime guard
-- that throws when NODE_ENV=production AND the real Supabase `auth` schema
-- is absent, preventing this shim from silently standing in for production
-- auth (T-02-29 mitigation).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $fn$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $fn$;
  END IF;
END $$;

-- ============================================================
-- Section 4: Enable RLS on every app table
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_sync_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identification_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Section 5: Reference-table SELECT policies (authenticated read-only)
-- ============================================================

-- species
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'species_select_authenticated') THEN
    CREATE POLICY "species_select_authenticated" ON public.species
      FOR SELECT TO authenticated
      USING ((select auth.uid()) is not null);
  END IF;
END $$;

-- care_guides
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'care_guides_select_authenticated') THEN
    CREATE POLICY "care_guides_select_authenticated" ON public.care_guides
      FOR SELECT TO authenticated
      USING ((select auth.uid()) is not null);
  END IF;
END $$;

-- identification_limits
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'identification_limits_select_authenticated') THEN
    CREATE POLICY "identification_limits_select_authenticated" ON public.identification_limits
      FOR SELECT TO authenticated
      USING ((select auth.uid()) is not null);
  END IF;
END $$;

-- provider_budgets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'provider_budgets_select_authenticated') THEN
    CREATE POLICY "provider_budgets_select_authenticated" ON public.provider_budgets
      FOR SELECT TO authenticated
      USING ((select auth.uid()) is not null);
  END IF;
END $$;

-- policy_versions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'policy_versions_select_authenticated') THEN
    CREATE POLICY "policy_versions_select_authenticated" ON public.policy_versions
      FOR SELECT TO authenticated
      USING ((select auth.uid()) is not null);
  END IF;
END $$;

-- partner_stores
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'partner_stores_select_authenticated') THEN
    CREATE POLICY "partner_stores_select_authenticated" ON public.partner_stores
      FOR SELECT TO authenticated
      USING ((select auth.uid()) is not null);
  END IF;
END $$;

-- ============================================================
-- Section 6: Owner FOR ALL policies (user-owned tables, direct user_id)
-- ============================================================

-- users (id is the user id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_owner_all') THEN
    CREATE POLICY "users_owner_all" ON public.users
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = id);
  END IF;
END $$;

-- consent_logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'consent_logs_owner_all') THEN
    CREATE POLICY "consent_logs_owner_all" ON public.consent_logs
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;

-- data_export_requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'data_export_requests_owner_all') THEN
    CREATE POLICY "data_export_requests_owner_all" ON public.data_export_requests
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;

-- data_deletion_requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'data_deletion_requests_owner_all') THEN
    CREATE POLICY "data_deletion_requests_owner_all" ON public.data_deletion_requests
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;

-- offline_sync_failures
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'offline_sync_failures_owner_all') THEN
    CREATE POLICY "offline_sync_failures_owner_all" ON public.offline_sync_failures
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;

-- idempotency_keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'idempotency_keys_owner_all') THEN
    CREATE POLICY "idempotency_keys_owner_all" ON public.idempotency_keys
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;

-- plants
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'plants_owner_all') THEN
    CREATE POLICY "plants_owner_all" ON public.plants
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;

-- identifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'identifications_owner_all') THEN
    CREATE POLICY "identifications_owner_all" ON public.identifications
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;

-- subscriptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subscriptions_owner_all') THEN
    CREATE POLICY "subscriptions_owner_all" ON public.subscriptions
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;

-- push_subscriptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'push_subscriptions_owner_all') THEN
    CREATE POLICY "push_subscriptions_owner_all" ON public.push_subscriptions
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;

-- ============================================================
-- Section 7: Owner FOR ALL policies via parent (transitive ownership)
-- ============================================================

-- photo_entries owned via plants.user_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'photo_entries_owner_all') THEN
    CREATE POLICY "photo_entries_owner_all" ON public.photo_entries
      FOR ALL TO authenticated
      USING (
        (select auth.uid()) is not null
        and exists (
          select 1 from public.plants p
          where p.id = photo_entries.plant_id and p.user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        (select auth.uid()) is not null
        and exists (
          select 1 from public.plants p
          where p.id = photo_entries.plant_id and p.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- reminders owned via plants.user_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reminders_owner_all') THEN
    CREATE POLICY "reminders_owner_all" ON public.reminders
      FOR ALL TO authenticated
      USING (
        (select auth.uid()) is not null
        and exists (
          select 1 from public.plants p
          where p.id = reminders.plant_id and p.user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        (select auth.uid()) is not null
        and exists (
          select 1 from public.plants p
          where p.id = reminders.plant_id and p.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- reminder_logs owned via reminders -> plants.user_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reminder_logs_owner_all') THEN
    CREATE POLICY "reminder_logs_owner_all" ON public.reminder_logs
      FOR ALL TO authenticated
      USING (
        (select auth.uid()) is not null
        and exists (
          select 1 from public.reminders r
          join public.plants p on p.id = r.plant_id
          where r.id = reminder_logs.reminder_id and p.user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        (select auth.uid()) is not null
        and exists (
          select 1 from public.reminders r
          join public.plants p on p.id = r.plant_id
          where r.id = reminder_logs.reminder_id and p.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- billing_events owned via subscriptions.user_id (subscription_id is nullable;
-- unlinked events are visible to no authenticated user — system writes only).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'billing_events_owner_all') THEN
    CREATE POLICY "billing_events_owner_all" ON public.billing_events
      FOR ALL TO authenticated
      USING (
        (select auth.uid()) is not null
        and billing_events.subscription_id is not null
        and exists (
          select 1 from public.subscriptions s
          where s.id = billing_events.subscription_id and s.user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        (select auth.uid()) is not null
        and billing_events.subscription_id is not null
        and exists (
          select 1 from public.subscriptions s
          where s.id = billing_events.subscription_id and s.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- provider_usage_counters: internal/service-role only. RLS is enabled and no
-- authenticated policy exists, so authenticated callers see zero rows. This
-- is intentional — counters are written by the cap-check path (service role)
-- and not surfaced to end users in MVP.

-- ============================================================
-- Section 8: Ownership indexes (RLS performance + FK joins)
-- ============================================================

CREATE INDEX IF NOT EXISTS idempotency_keys_user_id_idx ON public.idempotency_keys(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS billing_events_subscription_id_idx ON public.billing_events(subscription_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS reminders_plant_id_idx ON public.reminders(plant_id);
CREATE INDEX IF NOT EXISTS reminder_logs_reminder_id_idx ON public.reminder_logs(reminder_id);
CREATE INDEX IF NOT EXISTS plants_user_id_idx ON public.plants(user_id);
CREATE INDEX IF NOT EXISTS plants_species_id_idx ON public.plants(species_id);
CREATE INDEX IF NOT EXISTS photo_entries_plant_id_idx ON public.photo_entries(plant_id);
CREATE INDEX IF NOT EXISTS care_guides_species_id_idx ON public.care_guides(species_id);
CREATE INDEX IF NOT EXISTS identifications_user_id_idx ON public.identifications(user_id);
CREATE INDEX IF NOT EXISTS identifications_plant_id_idx ON public.identifications(plant_id);
CREATE INDEX IF NOT EXISTS consent_logs_user_id_idx ON public.consent_logs(user_id);
CREATE INDEX IF NOT EXISTS data_export_requests_user_id_idx ON public.data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS data_deletion_requests_user_id_idx ON public.data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS offline_sync_failures_user_id_idx ON public.offline_sync_failures(user_id);

-- ============================================================
-- Section 9: Conditional auth.users -> public.users insert trigger
-- ============================================================

-- Defaults timezone='America/Sao_Paulo' and notification_time_local='09:00' are first-row trade-offs only;
-- Phase 4 signup will overwrite these from user input. Do NOT treat as policy.

-- Function is created unconditionally (PL/pgSQL DO blocks can't host CREATE
-- FUNCTION directly; DDL inside DO requires dynamic EXECUTE which would force
-- string-escaping the entire body). The function only runs when fired by the
-- trigger, which is itself created conditionally below — so on a plain-Postgres
-- CI without auth.users, the function exists but is dormant.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.users (id, email, name, locale, timezone, notification_time_local, trial_source, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'pt-BR',
    'America/Sao_Paulo',
    '09:00',
    'organic',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$fn$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user()';
  END IF;
END $$;
