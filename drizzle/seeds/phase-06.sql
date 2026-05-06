-- Phase-6 Plan 01: idempotent seed data for provider cost overrides and circuit breakers.
--
-- D-09: cost_per_request_cents per provider. plant_id=2 cents (table default),
--       openai_compat=3 cents (more expensive model).
-- D-11: provider_circuit_breakers starts closed with zero consecutive failures.
--
-- All inserts/updates are idempotent so `pnpm db:seed` can be re-applied safely.

-- -----------------------------------------------------------------------------
-- provider_budgets: update cost_per_request_cents per provider.
-- openai_compat costs more per request (3 cents vs. plant_id default of 2).
-- Uses UPDATE ... WHERE to avoid touching other columns; safe to re-run.
-- -----------------------------------------------------------------------------

UPDATE public.provider_budgets SET "cost_per_request_cents" = 2 WHERE provider = 'plant_id';
UPDATE public.provider_budgets SET "cost_per_request_cents" = 3 WHERE provider = 'openai_compat';

-- -----------------------------------------------------------------------------
-- provider_circuit_breakers: initial closed state for both providers.
-- Conflict target: provider PRIMARY KEY.
-- -----------------------------------------------------------------------------

INSERT INTO public.provider_circuit_breakers (provider, state, consecutive_failures) VALUES
  ('plant_id',      'closed', 0),
  ('openai_compat', 'closed', 0)
ON CONFLICT (provider) DO NOTHING;
