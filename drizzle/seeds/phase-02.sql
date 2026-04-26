-- Phase-2 Plan 04: idempotent seed data for legal/policy and provider configuration.
--
-- D-12 / D-13 / D-49: static reference rows live in SQL (TS only for dev/test fixtures).
-- D-48: legal_basis is the PG enum (consent | contract | legitimate_interest); the
--       enum itself is NOT seeded as table rows — it is created by migration 0000.
-- INFRA-24: every fresh DB carries policy versions + legal-basis registry references.
--
-- All inserts are idempotent (`ON CONFLICT ... DO NOTHING`) so `pnpm db:seed`
-- can be re-applied safely. Conflict targets match the unique indexes /
-- unique constraints created in `0000_phase_02_initial_schema.sql`.

-- -----------------------------------------------------------------------------
-- policy_versions: privacy_policy + terms_of_service, both `is_current=true`
-- with the locked launch version `2026-04-25.1`.
-- Conflict target: `(document_type, version)` unique index
-- (`policy_versions_doc_version_idx`).
-- -----------------------------------------------------------------------------

INSERT INTO public.policy_versions (
  document_type, version, is_current, effective_at
) VALUES
  ('privacy_policy',  '2026-04-25.1', true, '2026-04-25T00:00:00.000Z'),
  ('terms_of_service','2026-04-25.1', true, '2026-04-25T00:00:00.000Z')
ON CONFLICT (document_type, version) DO NOTHING;

-- -----------------------------------------------------------------------------
-- identification_limits: trial 5/day, 75/period; paid 15/day, 200/period.
-- Conflict target: `tier` UNIQUE constraint (single-column unique on `tier`).
-- -----------------------------------------------------------------------------

INSERT INTO public.identification_limits (
  tier, daily_cap, period_cap
) VALUES
  ('trial', 5,  75),
  ('paid',  15, 200)
ON CONFLICT (tier) DO NOTHING;

-- -----------------------------------------------------------------------------
-- provider_budgets: 4 rows. (plant_id | openai_compat) × (identification | care_guide).
-- daily_cost_cap_cents=500 (USD 5/day) per provider+purpose; alert_threshold_pct=80;
-- min_confidence=0.30 ONLY on identification rows (NULL on care_guide rows);
-- is_active=true.
-- Conflict target: `(provider, purpose)` unique index
-- (`provider_budgets_provider_purpose_idx`).
-- -----------------------------------------------------------------------------

INSERT INTO public.provider_budgets (
  provider, purpose, daily_cost_cap_cents, alert_threshold_pct, min_confidence, is_active
) VALUES
  ('plant_id',      'identification', 500, 80, 0.30, true),
  ('plant_id',      'care_guide',     500, 80, NULL, true),
  ('openai_compat', 'identification', 500, 80, 0.30, true),
  ('openai_compat', 'care_guide',     500, 80, NULL, true)
ON CONFLICT (provider, purpose) DO NOTHING;
