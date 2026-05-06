---
phase: 06-identification-flow-cost-controls
plan: "03"
subsystem: api
tags: [plant-id, openai, vitest, zod, provider-pattern, tdd]

# Dependency graph
requires:
  - phase: 06-identification-flow-cost-controls
    provides: test scaffolding, base schema, server-env foundation (06-01, 06-02)
provides:
  - IdentificationProvider TypeScript interface (D-01 contract)
  - PlantIdProvider — stateless HTTP client for Plant.id v3 API
  - OpenAICompatProvider — stateless vision LLM client with strict JSON Schema response_format
  - StubProvider — deterministic 3-result fixture for CI/preview (0.85/0.62/0.35)
  - getIdentificationProviders() factory with IDENTIFICATION_PROVIDER_MODE env-gate and singleton cache
  - IDENT_LOCK_NAMESPACE constant (6_000_000_06) for Phase 6 advisory locks
  - Extended server-env schema with PLANT_ID_API_KEY, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, OPERATOR_ALERT_EMAIL
affects:
  - 06-06 (router dispatches into this factory)
  - 06-08 (use-case calls getIdentificationProviders())
  - 06-09 (fallover logic iterates providers in priority order)
  - 06-07 (breaker tracks InvalidProviderResponseError thrown here)
  - 06-12 (OPERATOR_ALERT_EMAIL added to server-env here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stateless provider pattern: providers hold no state; DB owns budgets, breakers, caps"
    - "Env-gated singleton factory with __resetProviderCacheForTests() escape hatch for unit tests"
    - "TDD RED/GREEN per task: test commit (failing) then feat commit (passing)"
    - "vi.spyOn(global, 'fetch') for HTTP mocking — no MSW (per RESEARCH line 1057)"
    - "Inline JSON Schema for OpenAI response_format to avoid adding zod-to-json-schema dep"
    - "Zod parse as trust boundary for all external provider responses (IDENT-15)"

key-files:
  created:
    - src/contexts/identification/domain/provider.ts
    - src/contexts/identification/domain/locks.ts
    - src/contexts/identification/domain/errors.ts
    - src/contexts/identification/infrastructure/providers/plant-id-provider.ts
    - src/contexts/identification/infrastructure/providers/openai-compat-provider.ts
    - src/contexts/identification/infrastructure/providers/stub-provider.ts
    - src/contexts/identification/infrastructure/providers/index.ts
    - tests/unit/identification/provider-domain.unit.test.ts
    - tests/unit/identification/plant-id-provider.unit.test.ts
    - tests/unit/identification/openai-compat-provider.unit.test.ts
    - tests/unit/identification/stub-provider.unit.test.ts
    - tests/unit/identification/provider-factory.unit.test.ts
  modified:
    - src/shared/config/server-env.ts

key-decisions:
  - "No new dependencies: zod-to-json-schema replaced with inline JSON Schema object in openai-compat-provider.ts (RESEARCH §Standard Stack constraint)"
  - "Provider cache is a module-level variable reset via __resetProviderCacheForTests() — mirrors resend-adapter.ts singleton pattern"
  - "errors.ts re-exports InvalidProviderResponseError from provider.ts to give downstream imports a canonical error location without duplicating the class"
  - "Stub hardcodes pt-BR common names (Costela-de-adão, Jiboia, Espada-de-são-jorge) matching locale constraint"
  - "Factory throws at first call (not module load) when real-mode keys are missing, so unit tests can import the module without setting env"

patterns-established:
  - "Provider pattern: IdentificationProvider interface is source of truth; all implementations are stateless factory functions returning the interface"
  - "Schema-mismatch errors: Zod parse failure always throws InvalidProviderResponseError (not generic Error) so router can distinguish provider failures from system errors"
  - "AbortSignal propagation: all providers forward signal to fetch (real) or use it to clear setTimeout (stub) — no provider swallows abort"

requirements-completed:
  - IDENT-15
  - IDENT-19

# Metrics
duration: estimated
completed: "2026-05-06"
---

# Phase 06 Plan 03: Provider Abstraction Summary

**Typed IdentificationProvider interface + Plant.id v3, OpenAI-compat vision, and stub provider implementations with env-gated factory and full TDD unit coverage**

## Performance

- **Duration:** estimated (plan pre-executed before SUMMARY creation)
- **Started:** unknown (pre-execution)
- **Completed:** 2026-05-06
- **Tasks:** 3
- **Files modified:** 13 (12 created, 1 modified)

## Accomplishments

- Established `IdentificationProvider` interface as the D-01 locked contract that Wave 2 router and use-cases depend on
- Implemented three concrete providers — PlantIdProvider (Plant.id v3 API), OpenAICompatProvider (vision LLM with strict JSON Schema), StubProvider (deterministic fixture for CI) — all stateless and unit-tested
- Wired env-gated `getIdentificationProviders()` factory with singleton cache matching resend-adapter.ts pattern; IDENT-19 covered with key-presence checks at first call
- Extended server-env Zod schema with all Phase 6 provider keys and OPERATOR_ALERT_EMAIL (needed by 06-12)
- Added IDENT_LOCK_NAMESPACE = 6_000_000_06 for Phase 6 advisory locks
- Zero new npm dependencies (inline JSON Schema instead of zod-to-json-schema)

## Task Commits

Each task was committed atomically with TDD RED then GREEN commits:

1. **Task 1: Domain interface + locks constant + extended server-env**
   - `e655585` test(06-03): add failing tests for domain types and server-env keys
   - `18285b7` feat(06-03): domain interface, lock constant, and extended server-env

2. **Task 2: Plant.id + OpenAI-compat + Stub provider implementations**
   - `6bdafb0` test(06-03): add failing tests for Plant.id, OpenAI-compat, stub providers
   - `edd89e4` feat(06-03): implement PlantId, OpenAI-compat, and stub providers

3. **Task 3: Provider factory + IDENT-19 env-gate test**
   - `9bc668c` test(06-03): add failing tests for provider factory (IDENT-19)
   - `9f426c7` feat(06-03): provider factory with env-gate and singleton cache (IDENT-19)

_Note: TDD tasks have two commits each (test RED then feat GREEN)_

## Files Created/Modified

- `src/contexts/identification/domain/provider.ts` - IdentificationProvider interface, IdentificationProviderResult type, InvalidProviderResponseError class (D-01 contract)
- `src/contexts/identification/domain/locks.ts` - IDENT_LOCK_NAMESPACE = 6_000_000_06 advisory lock constant
- `src/contexts/identification/domain/errors.ts` - Re-export of InvalidProviderResponseError for canonical import location
- `src/contexts/identification/infrastructure/providers/plant-id-provider.ts` - Stateless Plant.id v3 HTTP client with Zod response validation
- `src/contexts/identification/infrastructure/providers/openai-compat-provider.ts` - Stateless vision LLM client with strict JSON Schema response_format and Zod validation
- `src/contexts/identification/infrastructure/providers/stub-provider.ts` - Deterministic 3-result fixture (Monstera 0.85, Epipremnum 0.62, Sansevieria 0.35) with 800ms simulated delay
- `src/contexts/identification/infrastructure/providers/index.ts` - getIdentificationProviders() factory with IDENTIFICATION_PROVIDER_MODE env-gate, singleton cache, and __resetProviderCacheForTests()
- `src/shared/config/server-env.ts` - Extended with PLANT_ID_API_KEY, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, OPERATOR_ALERT_EMAIL
- `tests/unit/identification/provider-domain.unit.test.ts` - Tests for InvalidProviderResponseError, IDENT_LOCK_NAMESPACE, server-env schema
- `tests/unit/identification/plant-id-provider.unit.test.ts` - 6 tests: happy path, schema mismatch, HTTP failure, abort, latency
- `tests/unit/identification/openai-compat-provider.unit.test.ts` - 4 tests: happy path, non-string content, schema mismatch, strict mode
- `tests/unit/identification/stub-provider.unit.test.ts` - 4 tests: hardcoded results, name/model, latency, abort honor
- `tests/unit/identification/provider-factory.unit.test.ts` - 5 tests: stub mode, real mode with keys, missing PLANT_ID_API_KEY, missing OPENAI_API_KEY, singleton cache

## Decisions Made

- **No zod-to-json-schema dependency:** Inline JSON Schema object used in openai-compat-provider.ts instead of adding zod-to-json-schema package — RESEARCH §Standard Stack mandated zero new deps for Phase 6.
- **errors.ts as re-export only:** InvalidProviderResponseError lives in provider.ts; errors.ts is a thin re-export to give downstream modules a stable import path without duplicating the class definition.
- **Factory throws at first call, not module load:** Allows unit tests to import the factory module without setting real-mode env keys; key-presence check runs at runtime when getIdentificationProviders() is first called.
- **Stub uses pt-BR common names:** speciesName field uses Portuguese common names (Costela-de-adão, Jiboia, Espada-de-são-jorge) to match the locale constraint, while scientificName carries the Latin name.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require configuration before real-mode identification works:**

- `PLANT_ID_API_KEY` — obtain from https://plant.id (required when `IDENTIFICATION_PROVIDER_MODE=real`)
- `OPENAI_API_KEY` — OpenAI API key (required when `IDENTIFICATION_PROVIDER_MODE=real`)
- `OPENAI_BASE_URL` — defaults to `https://api.openai.com` (override for Azure OpenAI or compatible endpoints)
- `OPENAI_MODEL` — defaults to `gpt-4o-2024-08-06`
- `OPERATOR_ALERT_EMAIL` — used by 06-12 budget alert emails via Resend

For CI/preview environments, `IDENTIFICATION_PROVIDER_MODE=stub` (the default) requires none of the above.

## TDD Gate Compliance

All three tasks followed RED/GREEN cycle. Gate sequence verified in git log:

- Task 1: `e655585` (test RED) → `18285b7` (feat GREEN)
- Task 2: `6bdafb0` (test RED) → `edd89e4` (feat GREEN)
- Task 3: `9bc668c` (test RED) → `9f426c7` (feat GREEN)

## Known Stubs

The StubProvider is an intentional stub returning hardcoded data. It is NOT a data gap — it is the designed CI/preview fixture controlled by `IDENTIFICATION_PROVIDER_MODE=stub`. The three results (Monstera deliciosa @ 0.85, Epipremnum aureum @ 0.62, Sansevieria trifasciata @ 0.35) are the canonical fixture for all e2e specs through Phase 6.

## Next Phase Readiness

- `IdentificationProvider` interface is locked — Wave 2 router (06-06) and use-cases (06-08, 06-09) can depend on it
- Factory singleton is importable; Wave 2 plans call `getIdentificationProviders()` and iterate in priority order (Plant.id first, OpenAI fallover)
- `InvalidProviderResponseError` is the breaker signal — 06-07 circuit breaker increments on catches of this type
- All unit tests pass and are tracked in the `tests/unit/identification/` directory established by 06-02

## Self-Check: PASSED

All 6 task commits verified in git log. All 13 files confirmed present on disk.

---
*Phase: 06-identification-flow-cost-controls*
*Completed: 2026-05-06*
