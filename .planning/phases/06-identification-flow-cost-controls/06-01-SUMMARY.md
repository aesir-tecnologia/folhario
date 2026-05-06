---
phase: 06-identification-flow-cost-controls
plan: "01"
subsystem: identification
tags: [schema, migration, storage, circuit-breaker, cost-controls]
dependency_graph:
  requires: []
  provides:
    - provider_circuit_breakers table (seeded, state=closed)
    - provider_budgets.cost_per_request_cents + last_alerted_at columns
    - identification-photos private Supabase Storage bucket
    - src/contexts/identification/infrastructure/photo-storage.ts helper
  affects:
    - drizzle schema registry (new table registered for drizzle-kit)
    - scripts/seed.ts (multi-phase seed runner)
tech_stack:
  added: []
  patterns:
    - Drizzle pgTable for provider_circuit_breakers (varchar PK, state enum)
    - Per-context photo-storage helper mirroring catalog D-25 pattern
    - Multi-phase seed runner (phase-02.sql + phase-06.sql in order)
key_files:
  created:
    - drizzle/migrations/0008_phase06_identification.sql
    - drizzle/migrations/meta/0008_snapshot.json
    - drizzle/seeds/phase-06.sql
    - src/contexts/identification/infrastructure/photo-storage.ts
    - supabase/seed.sql
  modified:
    - src/contexts/identification/infrastructure/db/schema.ts
    - src/shared/db/schema-registry.ts
    - drizzle/migrations/meta/_journal.json
    - scripts/seed.ts
    - supabase/config.toml
decisions:
  - Migration file contains DDL + idempotent seed INSERTs (ON CONFLICT DO NOTHING) for circuit breakers; cost override via UPDATE for openai_compat
  - scripts/seed.ts extended to multi-phase runner; phase-06.sql handles cost_per_request_cents UPDATEs and breaker INSERTs
  - supabase/seed.sql created to persist all storage bucket rows after db reset cycles (config.toml declarations apply on fresh start only)
  - signIdentificationPhotoUrl uses first-slash parse pattern matching catalog signCatalogPhotoUrl (no hardcoded regex)
  - provider_circuit_breakers has no RLS per D-07 / Phase 2 counter pattern (service-role only; no PII, no costable secrets)
metrics:
  duration: ~30 minutes
  completed: "2026-05-06"
  tasks_completed: 3
  files_changed: 9
---

# Phase 06 Plan 01: Foundation Schema, Migration, and Storage Summary

Phase 6 foundation: Drizzle migration 0008 adds `provider_circuit_breakers` table + extends `provider_budgets` with cost and alerting columns; seeds initial breaker rows and per-provider cost overrides; declares the `identification-photos` private storage bucket; ships the per-context `photo-storage.ts` helper ready for 06-11.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extend identification schema and registry | bb3a6e4 | schema.ts, schema-registry.ts |
| 2 | Generate migration 0008 and extend seeds | 91c4e74 | 0008_phase06_identification.sql, seed.ts, phase-06.sql |
| 3 | identification-photos bucket + photo-storage helper | 5227717 | config.toml, photo-storage.ts, supabase/seed.sql |

## Migration Details

- **Filename:** `drizzle/migrations/0008_phase06_identification.sql`
- **Journal idx:** 8, tag: `0008_phase06_identification`
- **DDL changes:**
  - `CREATE TABLE provider_circuit_breakers` (provider PK, state, consecutive_failures, opened_at, last_failure_at, in_flight_at, updated_at)
  - `ALTER TABLE provider_budgets ADD COLUMN cost_per_request_cents integer DEFAULT 2 NOT NULL`
  - `ALTER TABLE provider_budgets ADD COLUMN last_alerted_at date`
- **Seed data in migration:** 2 breaker INSERTs (`plant_id`, `openai_compat` both closed) + UPDATE `cost_per_request_cents = 3` for `openai_compat`

## Cost-Per-Request Seed Values

| Provider | Purpose | cost_per_request_cents |
|----------|---------|------------------------|
| plant_id | identification | 2 |
| openai_compat | identification | 3 |

(Operator-tunable via direct DB UPDATE; D-09 specification)

## Circuit Breaker Security Posture

`provider_circuit_breakers` has **no RLS** per D-07 and Phase 2 counter pattern:
- Table contains only provider state counters (no PII, no costable secrets)
- Access goes through service-role key only (via `withUnitOfWork` SET LOCAL ROLE)
- Matches `provider_usage_counters` no-RLS pattern established in Phase 2

## Storage Bucket

- **Name:** `identification-photos`
- **objects_path:** `./storage/identification-photos`
- **file_size_limit:** 5 MiB (matches `plant-photos`)
- **mime_types:** image/jpeg, image/png, image/webp
- **public:** false (signed URLs only, 24h TTL per D-21)
- **Object keyspace:** `{userId}/{identificationId}/{n}.jpg` (n = 0-indexed photo position)

## Photo-Storage Helper

`src/contexts/identification/infrastructure/photo-storage.ts` exports:
- `IDENTIFICATION_PHOTOS_BUCKET` — bucket name constant
- `uploadIdentificationPhoto({ userId, identificationId, index, buffer, contentType })` → `{ storedUrl }`
- `signIdentificationPhotoUrl({ storedUrl, ttlSeconds })` → `{ ok, signedUrl } | { ok, reason }`
- `deleteAllIdentificationPhotosForUser(userId)` — LGPD sweep helper
- `__setStorageAdapterForTests(adapter | null)` — test seam

**For plan 06-11:** The route handler MUST upload photos via `uploadIdentificationPhoto({ userId, identificationId, index, buffer, contentType })` AND pass the resulting `storedUrl[]` array to the identify use-case input. Route must call `rejectGpsMetadata` BEFORE `uploadIdentificationPhoto` (D-20, T-06-01-06).

## Prerequisites Reminder

**Vercel Pro tier required for `maxDuration = 60`** — verify before phase deploys to staging (RESEARCH Pitfall 1). This is a deployment-time gate, not a code task.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Migration already applied before explicit db:migrate call**

- **Found during:** Task 2
- **Issue:** `pnpm db:generate` triggered the migration to be applied against local DB automatically, or a prior partial run left the state applied. The `provider_circuit_breakers` table existed and the DB `drizzle.__drizzle_migrations` hash/timestamp didn't match the renamed file.
- **Fix:** Updated `drizzle.__drizzle_migrations` hash and `created_at` to match the final file content/journal timestamp; confirmed `pnpm db:migrate` idempotent.
- **Files modified:** DB-only (drizzle migrations tracking table)
- **Commit:** 91c4e74

**2. [Rule 2 - Missing functionality] scripts/seed.ts was SQL-passthrough, not Drizzle**

- **Found during:** Task 2
- **Issue:** `scripts/seed.ts` reads and executes `drizzle/seeds/phase-02.sql` via `sql.unsafe()`. Plan described adding Drizzle ORM inserts inside seed.ts; actual pattern is raw SQL files.
- **Fix:** Created `drizzle/seeds/phase-06.sql` with idempotent UPDATEs for `cost_per_request_cents` and INSERTs for `provider_circuit_breakers`. Extended `scripts/seed.ts` to iterate over an ordered list of seed files.
- **Files modified:** scripts/seed.ts, drizzle/seeds/phase-06.sql (new)
- **Commit:** 91c4e74

**3. [Rule 2 - Missing functionality] supabase/seed.sql absent; bucket not persisted after db reset**

- **Found during:** Task 3
- **Issue:** Supabase `stop && start` restores from docker volume backup; `config.toml` bucket declarations do not re-run on backup restore. The `identification-photos` bucket did not appear after restart.
- **Fix:** Created `supabase/seed.sql` declaring all four storage buckets with ON CONFLICT DO NOTHING. Inserted bucket directly via SQL for the current running instance.
- **Files modified:** supabase/seed.sql (new)
- **Commit:** 5227717

## Known Stubs

None — plan delivers schema/migration/bucket/helper foundation only. No UI rendering paths.

## Self-Check: PASSED

All files verified present on disk. All task commits verified in git log:
- bb3a6e4: Task 1 — schema.ts + schema-registry.ts
- 91c4e74: Task 2 — migration 0008 + seeds
- 5227717: Task 3 — config.toml + photo-storage.ts + supabase/seed.sql

DB verified: 2 circuit breaker rows, plant_id cost=2, openai_compat cost=3, identification-photos bucket present.
