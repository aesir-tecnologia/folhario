---
phase: 02-data-layer
plan: "02"
subsystem: database
tags: [drizzle, drizzle-zod, schema, postgres, pg-enum, rls-prep, bounded-contexts]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: drizzle-orm@0.45.2 + drizzle-zod@0.8.3 installed (plan 02-01), drizzle.config.ts pointing schema at src/shared/db/schema-registry.ts, migration-client wired against DATABASE_URL
provides:
  - "IAM tables: users (full PRD §4 schema, D-46), policy_versions, consent_logs, partner_stores, data_export_requests, data_deletion_requests"
  - "Catalog tables: plants, photo_entries"
  - "Species & Care tables: species, care_guides"
  - "pgEnum legal_basis (D-48) + literal-typed varchar enums for purpose, source, status, source/toxicity/difficulty/flag fields"
  - "Per-context domain Zod schemas via drizzle-zod (createSelectSchema/createInsertSchema) for every Phase-2 table — D-19, D-40"
  - "src/shared/db/schema-registry.ts — drizzle-kit-only re-export of every Phase-2 table; carries 'Migration registry only' marker (T-02-02 mitigation surface)"
  - "tests/unit/schema-registry.test.ts — recursive scan of src/app + src/contexts/*/{api,application} that fails if any file imports schema-registry (T-02-02 enforcement)"
affects: [02-03, 02-04, 02-05, 02-05.5, 02-06, 02-07, 02-08, 02-09, 02-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-context schema ownership: src/contexts/{ctx}/infrastructure/db/schema.ts owns its tables; cross-context FK imports (catalog → iam.users, catalog → species-care.species, care_guides → species-care.species) are conventional Drizzle and not a D-01 violation"
    - "Migration-only schema registry: src/shared/db/schema-registry.ts re-exports for drizzle-kit only; an import-guard test enforces that src/app and src/contexts/*/{api,application} never depend on it"
    - "Domain Zod schemas derived from drizzle-zod: createSelectSchema + createInsertSchema per table, refined later in plans where business rules need it (kept lean here per D-19/D-40)"
    - "varchar({ length, enum: [...] as const }) for typed PRD enums; CHECK SQL constraints land in plan 02-03's migration generation"
    - "timestamptz columns use mode: 'string' so reads round-trip as ISO-8601 UTC (project API rule §5)"
    - "UUID v4 primary keys via uuid().primaryKey().defaultRandom() — emits gen_random_uuid() at SQL time; pgcrypto extension is plan 02-03's responsibility"

key-files:
  created:
    - src/contexts/iam/infrastructure/db/schema.ts
    - src/contexts/iam/domain/schemas.ts
    - src/contexts/catalog/infrastructure/db/schema.ts
    - src/contexts/catalog/domain/schemas.ts
    - src/contexts/species-care/infrastructure/db/schema.ts
    - src/contexts/species-care/domain/schemas.ts
    - src/shared/db/schema-registry.ts
    - tests/unit/schema-registry.test.ts
  modified: []

key-decisions:
  - "varchar({ enum: [...] as const }) used for every operational enum except legal_basis (PG enum per D-48). Drizzle's typed-enum modifier gives compile-time safety; SQL CHECK constraints get appended in plan 02-03's migration phase (acceptance criteria do not require them at this layer)"
  - "Cross-context FK imports use the alias path (e.g. @contexts/iam/infrastructure/db/schema). D-01's prohibition is registry-as-application-barrel only; module-to-module imports for FK targets are required for real referential integrity and are the supported Drizzle pattern"
  - "Schema-registry guard scope is intentionally narrow: src/app + src/contexts/*/{api,application}. Infrastructure is excluded so future repositories that wrap drizzle helpers (or share migration-adjacent utilities) are not blocked. The route-handler-level no-drizzle guard is plan 02-05's responsibility"
  - "timestamp({ withTimezone: true, mode: 'string' }) used uniformly across all timestamptz columns. Locks in ISO-8601 UTC string round-trip and removes a .toISOString() step from later repositories. Establishes precedent for plans 03..10"
  - "users.email is a unique-indexed varchar(320) (RFC 5321 max). users gets created_at + updated_at (D-03 baseline + the plan's explicit ask for updated_at on every aggregate root)"
  - "consent_logs.policy_version_id uses on delete restrict (vs cascade). Audit/legal log rows must survive a policy-version cleanup; cascade would silently drop legally relevant evidence"
  - "Composite unique index care_guides_species_locale_version_idx (species_id, locale, version) prevents duplicate care guides per (species, locale, version) tuple (PRD §8 versioned care guides)"
  - "policy_versions has a composite unique index on (document_type, version) — privacy_policy v1.0 and terms_of_service v1.0 are independently keyed"
  - "Schema-registry test imports nothing from drizzle/postgres — it is a pure fs+regex scanner. Three regex self-tests guard the detector itself from silent breakage (alias / relative / dynamic-import)"

patterns-established:
  - "Phase-2 schema convention: each table is exported as a const named after the camelCase Drizzle name (users, consentLogs, plants, photoEntries, ...) and is re-exported by the registry. Test fixtures that need a table import the per-context module directly (e.g. import { users } from '@contexts/iam/infrastructure/db/schema'); not the registry"
  - "Domain-schema convention: `{table}SelectSchema` + `{table}InsertSchema` paired with `{Table}` + `{Table}Insert` types via `ReturnType<typeof schema.parse>`. Enables route-handler validation today and refinement later without API churn"
  - "varchar enum pattern: `varchar('col', { length: N, enum: [a, b, c] as const })` — the `as const` is load-bearing for TS narrowing; without it Drizzle widens to plain string"

requirements-completed: [INFRA-05, INFRA-08, INFRA-09]

# Metrics
duration: 5min
completed: 2026-04-26
---

# Phase 02 Plan 02: Core Schema + Schema Registry Summary

**IAM, Catalog, and Species & Care Drizzle tables (10 tables, one PG enum, derived drizzle-zod domain schemas) wired through a migration-only `src/shared/db/schema-registry.ts`, plus a recursive import-guard test (5 cases) that fails the build if any application-layer file pulls from the registry.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-26T15:58:43Z
- **Completed:** 2026-04-26T16:03:01Z
- **Tasks:** 3
- **Files modified:** 8 (8 created, 0 modified)

## Accomplishments

- Created the full Phase-2 schema surface: 10 tables across 3 contexts, plus the `legal_basis` PG enum (D-48). Every FK declares its `onDelete` rule (D-07). User table is the full PRD §4 shape (D-46) — no stubs.
- Derived every table to a Zod select+insert schema via drizzle-zod (D-19/D-40), giving plan 02-05 onward a stable validation surface that will not drift from the column layout.
- Built the migration-only registry that drizzle-kit will read in plan 02-03's `db:generate` run; the registry has the literal "Migration registry only" marker so static greps catch it.
- Added the recursive import-guard test (T-02-02 mitigation) that walks `src/app` and `src/contexts/*/{api,application}` and fails if anyone imports schema-registry — the single scenario the registry must never appear in.

## Task Commits

1. **Task 1: Create IAM schema and derived domain schemas** — `58fdc46` (feat)
2. **Task 2: Create Catalog and Species & Care schemas** — `3767ab6` (feat)
3. **Task 3: Create migration-only schema registry and guard test** — `fb2518e` (feat)

**Plan metadata:** orchestrator owns the metadata commit (parallel-executor mode).

## Files Created/Modified

- `src/contexts/iam/infrastructure/db/schema.ts` — 6 tables (users, policy_versions, consent_logs, partner_stores, data_export_requests, data_deletion_requests) + `legalBasisEnum` pgEnum.
- `src/contexts/iam/domain/schemas.ts` — drizzle-zod select+insert schemas + matching TS types for all 6 IAM tables.
- `src/contexts/catalog/infrastructure/db/schema.ts` — `plants` (FK → users cascade, FK → species set null) + `photo_entries` (FK → plants cascade).
- `src/contexts/catalog/domain/schemas.ts` — drizzle-zod surfaces for plants + photo_entries.
- `src/contexts/species-care/infrastructure/db/schema.ts` — `species` (unique scientific_name) + `care_guides` (FK → species cascade, unique on (species_id, locale, version)).
- `src/contexts/species-care/domain/schemas.ts` — drizzle-zod surfaces for species + care_guides.
- `src/shared/db/schema-registry.ts` — re-exports every table for drizzle-kit; carries the migration-only marker.
- `tests/unit/schema-registry.test.ts` — recursive guard with 3 regex self-tests + 1 marker-presence check + 1 application-layer import scan (5 cases total, all green).

## Decisions Made

See `key-decisions` in frontmatter for the full list. Highlights:

- **`varchar({ enum: [...] as const })` everywhere except `legal_basis`** — D-04/D-48 explicitly call out this split. CHECK constraint SQL gets generated in plan 02-03; here we ship type-level safety only.
- **Cross-context FK alias imports are fine** — D-01 only forbids the registry as an application barrel; per-context module-to-module imports for FK targets (catalog ↔ iam, catalog ↔ species-care, care_guides ↔ species-care) are conventional and required for real referential integrity.
- **Guard test scope = `src/app` + `src/contexts/*/{api,application}` only** — infrastructure is excluded so plan 02-05's repositories are not blocked. Route-handler-level no-drizzle enforcement is plan 02-05's job per the Pattern Map.
- **`mode: 'string'` for every timestamptz** — project API rule mandates ISO-8601 UTC strings on the wire; this removes a `.toISOString()` step from every repository touch.
- **`consent_logs.policy_version_id` is `onDelete: restrict`** (not cascade). Audit/legal evidence must survive policy-version maintenance.

## Deviations from Plan

None — plan executed exactly as written.

The acceptance criteria each grep for one literal substring; all five literals are present:

- `src/contexts/iam/infrastructure/db/schema.ts` exports `users`, `consentLogs`, `policyVersions`, `partnerStores`, `dataExportRequests`, `dataDeletionRequests`.
- `src/contexts/iam/infrastructure/db/schema.ts` contains `pgEnum("legal_basis"`.
- Every IAM table with `userId` contains `onDelete: "cascade"`.
- `src/contexts/iam/domain/schemas.ts` imports `createSelectSchema` from `drizzle-zod`.
- `src/contexts/catalog/infrastructure/db/schema.ts` exports `plants` and `photoEntries`; `plants.speciesId` has `onDelete: "set null"`; `photoEntries.plantId` has `onDelete: "cascade"`.
- `src/contexts/species-care/infrastructure/db/schema.ts` exports `species` and `careGuides`.
- Both Catalog and Species-Care domain schema files import from `drizzle-zod`.
- `src/shared/db/schema-registry.ts` contains `Migration registry only`.
- `tests/unit/schema-registry.test.ts` contains `schema-registry`.
- `pnpm exec vitest run --project=unit tests/unit/schema-registry.test.ts` exits 0 (5/5 tests pass).

## Issues Encountered

- **Vitest hook caught `pnpm test:unit -- ...` form** — the project's test:unit script already includes `--run`, but the user-side `prevent-watch-mode-tests.sh` hook flagged the `pnpm test:unit` invocation. Worked around by running `pnpm exec vitest run --project=unit tests/unit/schema-registry.test.ts` directly. No code change; behavior identical. Logged here so plans 02-05/05.5/06 use the direct form too.
- **Engine warning `Unsupported engine: wanted: {"node":">=22 <23"} (current: v24.13.0)`** — pre-existing; CI uses Node 22 per `.github/workflows/ci.yml`. No action needed in this plan.

## User Setup Required

None — no external service configuration required. Plan 02-03 generates the actual migration SQL from these table definitions and applies it; this plan only delivers TS-level schema sources.

## Next Phase Readiness

- **02-03 (operational schema + RLS + first migration):** ready. drizzle-kit can now resolve `src/shared/db/schema-registry.ts` to 10 real tables and emit DDL. The `pgcrypto` extension that backs `gen_random_uuid()` defaults is plan 02-03's setup. RLS policy templates from `02-RESEARCH.md` § "RLS Pattern" can be appended to the same migration file.
- **02-04 (seeds + buckets):** ready. Domain Zod schemas (`policyVersionInsertSchema`, `partnerStoreInsertSchema`, etc.) provide the validation surface that the seed scripts can use to refuse malformed seed rows at write time.
- **02-05 (runtime DB client + repositories):** ready. The per-context `infrastructure/db/schema.ts` modules are the import target for plan 05's functional repositories. The schema-registry guard already in place will flag any accidental registry imports the moment they appear.
- **02-06 onward:** every later plan that needs a Zod schema for a Phase-2 entity imports it from `@contexts/{ctx}/domain/schemas`, never from drizzle-zod directly.

## Self-Check: PASSED

- [x] `src/contexts/iam/infrastructure/db/schema.ts` exists; contains `pgEnum("legal_basis"`; exports all 6 IAM tables.
- [x] `src/contexts/iam/domain/schemas.ts` exists; imports `createSelectSchema` from `drizzle-zod`.
- [x] `src/contexts/catalog/infrastructure/db/schema.ts` exists; `plants.speciesId` declares `onDelete: "set null"`; `photoEntries.plantId` declares `onDelete: "cascade"`.
- [x] `src/contexts/catalog/domain/schemas.ts` exists; imports from `drizzle-zod`.
- [x] `src/contexts/species-care/infrastructure/db/schema.ts` exists; exports `species` and `careGuides`; `careGuides.speciesId` declares `onDelete: "cascade"`.
- [x] `src/contexts/species-care/domain/schemas.ts` exists; imports from `drizzle-zod`.
- [x] `src/shared/db/schema-registry.ts` exists; contains the literal `Migration registry only`.
- [x] `tests/unit/schema-registry.test.ts` exists; contains `schema-registry`; passes 5/5 cases.
- [x] Commits `58fdc46`, `3767ab6`, `fb2518e` all present in `git log` of the worktree branch.
- [x] `pnpm exec vitest run --project=unit` passes 125/125 across all 8 unit test files (no regression of pre-existing tests).
- [x] `pnpm typecheck` exits 0.
- [x] `pnpm lint` exits 0.
- [x] No accidental file deletions across the three commits.
- [x] No pre-existing test fixtures touch the new schema modules — the 02-01 fixture-miss class of bug is avoided.

---

*Phase: 02-data-layer*
*Plan: 02*
*Completed: 2026-04-26*
