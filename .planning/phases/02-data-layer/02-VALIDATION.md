---
phase: 02
slug: data-layer
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-25
validated: 2026-04-27
---

# Phase 02 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 + Playwright 1.59.1 |
| **Config file** | `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` |
| **Quick run command** | `pnpm test:unit` |
| **Full suite command** | `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm db:setup && pnpm test:integration && pnpm build` |
| **Estimated runtime** | ~180 seconds local with DB already running; CI may be longer |

## Sampling Rate

- **After every task commit:** Run the task-specific `<automated>` command from its PLAN.
- **After every plan wave:** Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm db:setup && pnpm test:integration`.
- **Before `$gsd-verify-work`:** Full suite plus `pnpm test:e2e -- tests/e2e/diagnostics-consent.spec.ts`.
- **Max feedback latency:** 60 seconds for unit/static checks; 180 seconds for DB/build checks.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | INFRA-04, INFRA-05 | T-02-01 | Dependencies/config cannot omit Supavisor-safe `prepare:false` path | static/unit | `pnpm lint && pnpm typecheck` | yes | covered |
| 02-02-01 | 02 | 2 | INFRA-05, INFRA-08, INFRA-09 | T-02-02 | Core schema tables exist with FK ownership and registry guard coverage | unit/static | `pnpm test:unit -- tests/unit/schema-registry.test.ts && pnpm typecheck` | yes | covered |
| 02-03-01 | 03 | 3 | INFRA-05, INFRA-08 | T-02-03 | Operational schema tables exist and generated migration enables RLS/policies | integration | `pnpm db:migrate && pnpm test:integration -- tests/integration/schema-rls.integration.test.ts` | yes | covered |
| 02-04-01 | 04 | 4 | INFRA-05, INFRA-06, INFRA-24 | T-02-04 | Seed data and private buckets are idempotent and fresh-DB setup works | integration | `pnpm db:setup && pnpm test:integration -- tests/integration/seed-data.integration.test.ts tests/integration/storage-buckets.integration.test.ts` | yes | covered |
| 02-05-01 | 05 | 4 | INFRA-03, INFRA-04 | T-02-05 | Runtime DB path hides Drizzle from handlers and uses explicit user scoping | unit/integration | `pnpm test:unit -- tests/unit/db-client.test.ts tests/unit/no-drizzle-in-routes.test.ts && pnpm test:integration -- tests/integration/unit-of-work.integration.test.ts` | yes | covered |
| 02-05.5-01 | 05.5 | 5 | INFRA-08 | T-02-34 | RLS denies cross-user reads under real Supabase Auth | integration | `pnpm db:setup && pnpm test:integration -- tests/integration/rls-real-jwt.integration.test.ts` | yes | covered |
| 02-06-01 | 06 | 5 | INFRA-03, INFRA-09, INFRA-21, INFRA-22 | T-02-06 | Cursor/idempotency validation rejects malformed or duplicate input safely | unit/integration | `pnpm test:unit -- tests/unit/api-conventions.test.ts && pnpm test:integration -- tests/integration/idempotency.integration.test.ts` | yes | covered |
| 02-07-01 | 07 | 5 | INFRA-03, INFRA-07 | T-02-07 | Missing/invalid JWT returns `unauthenticated`; valid JWT resolves user id | unit/integration | `pnpm test:unit -- tests/unit/auth-adapter.test.ts && pnpm test:integration -- tests/integration/auth-jwt.integration.test.ts` | yes | covered |
| 02-08-01 | 08 | 6 | INFRA-03, INFRA-06, INFRA-19 | T-02-08 | GPS-bearing upload rejected before storage write; signed URLs are server generated | unit/integration | `pnpm test:unit -- tests/unit/image-pipeline.test.ts && pnpm test:integration -- tests/integration/storage-adapter.integration.test.ts tests/integration/photo-upload.integration.test.ts` | yes | covered |
| 02-09-01 | 09 | 6 | INFRA-03, INFRA-07, INFRA-09, INFRA-21, INFRA-22, INFRA-24 | T-02-09 | ConsentLog smoke route proves JWT + Zod + idempotency + cursor behavior | integration/e2e | `pnpm test:integration -- tests/integration/diagnostics-consent.integration.test.ts && pnpm test:e2e -- tests/e2e/diagnostics-consent.spec.ts` | yes | covered |
| 02-10-01 | 10 | 7 | all | T-02-10 | CI runs migrations before integration and no watch-mode commands ship | static/full | `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm db:setup && pnpm test:integration && pnpm build` | yes | covered |

## Wave 0 Requirements

- Existing infrastructure covers Vitest unit/integration projects, Playwright, lint, typecheck, build, and Postgres service-container CI.
- Phase 2 Plan 01 must add missing package scripts (`db:generate`, `db:migrate`, `db:setup`, `db:seed`, `db:check-rls`, `db:check-seeds`) before later plans depend on them.
- Phase 2 Plan 03 must create the initial generated migration before any integration test expects tables.
- If a test requires committed data across transactions, document the D-43 exit ramp in that test and use TRUNCATE cleanup for that file only.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase local config bucket creation after `supabase stop && supabase start` | INFRA-06 | Local Docker daemon and Supabase services may be unavailable in the agent sandbox | Run `pnpm db:start`, then inspect Studio Storage buckets or query storage metadata; confirm `plant-photos`, `plant-thumbnails`, `data-exports` are private |

## Validation Sign-Off

- [x] All planned implementation tasks have `<automated>` verify commands.
- [x] Sampling continuity: no 3 consecutive implementation tasks without automated verification.
- [x] Wave 0 covers missing scripts/dependencies before dependent checks.
- [x] No watch-mode flags in validation commands.
- [x] Feedback latency targets defined.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved — 2026-04-27

## Validation Audit 2026-04-27

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

Audit performed against `02-VERIFICATION.md` (status: passed, 5/5 must-haves) and `02-10-SUMMARY.md` (full suite green: 198 unit + 64 integration + 12 Playwright E2E + lint + typecheck + build). All 17 referenced test files exist on disk; unit suite re-run during audit (207 passing — superset includes Phase 1 + Phase 2 unit tests). Per-task map flipped from `pending → covered` and `wave_0_complete: false → true`.
