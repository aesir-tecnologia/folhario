---
status: testing
phase: 02-data-layer
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-05.5-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md, 02-08-SUMMARY.md, 02-09-SUMMARY.md, 02-10-SUMMARY.md
started: 2026-04-27T00:00:00Z
updated: 2026-04-27T00:01:00Z
---

## Current Test

number: 2
name: Database Setup Pipeline (`pnpm db:setup`)
expected: |
  From the worktree base with Supabase running and .env.local synced, `pnpm db:setup` completes end-to-end with output showing migrations applied, seeds applied (idempotent on re-run), 21 tables RLS-enabled, and seed assertions passing (`rows=N (expected N)` for legal_basis enum + 2 policy_versions + 2 identification_limits + 4 provider_budgets).
awaiting: user response

## Tests

### 1. Cold Start Smoke Test

expected: Kill any running Next/dev process and Supabase containers. From a clean state, run `pnpm db:start`, then `pnpm db:sync-env`, then `pnpm db:setup`. Server boots without errors, all migrations apply, seeds load idempotently, check-rls reports `OK — 21 app tables present with RLS enabled.`, and check-seeds reports `OK — all seed assertions passed.` Exit code 0 across all four stages.
result: pass

### 2. Database Setup Pipeline (`pnpm db:setup`)

expected: From the worktree base with Supabase running and .env.local synced, `pnpm db:setup` completes end-to-end with output showing migrations applied, seeds applied (idempotent on re-run), 21 tables RLS-enabled, and seed assertions passing (`rows=N (expected N)` for legal_basis enum + 2 policy_versions + 2 identification_limits + 4 provider_budgets).
result: [pending]

### 3. Unit Test Suite Green

expected: `pnpm exec vitest run --project=unit` exits 0 with all 198 unit tests passing across 14 test files (schema-registry guard, no-drizzle-in-routes guard, db-client contract, api-conventions, image-pipeline, auth-adapter, proxy-body-passthrough, etc.).
result: [pending]

### 4. Integration Test Suite Green

expected: With .env.local loaded (e.g., `node --env-file-if-exists=.env.local node_modules/vitest/vitest.mjs run --project=integration`), all 64 integration tests pass across 14 files — schema-rls, seed-data, storage-buckets, sharp-smoke, storage-adapter, photo-upload, idempotency, unit-of-work, auth-jwt, proxy-auth, rls-real-jwt, diagnostics-consent, etc. No skips.
result: [pending]

### 5. E2E Test Suite Green (Playwright)

expected: `pnpm exec playwright test` exits 0 with 12 tests passing across diagnostics-consent (4 cases including real-crypto JWT 201 path), diagnostics-posthog, diagnostics-sentry, pwa-smoke, security-headers, and sentry-local-mode. globalSetup publishes the test JWKS on 127.0.0.1:4567 before the Next webServer boots.
result: [pending]

### 6. Lint + Typecheck Clean

expected: `pnpm lint` exits 0 with zero warnings; `pnpm typecheck` exits 0. No ESLint errors, no TypeScript errors.
result: [pending]

### 7. Production Build (`pnpm build`)

expected: `pnpm build` compiles successfully and lists three dynamic API routes: `/api/v1/diagnostics/consent`, `/api/v1/diagnostics/ping`, `/api/v1/photos/upload`. No build errors.
result: [pending]

### 8. Diagnostic Consent Route — Auth Gate (401 without bearer)

expected: `curl -i -X POST http://localhost:3000/api/v1/diagnostics/consent` (no Authorization header) against a running dev server returns HTTP 401 with body `{"error":{"code":"unauthenticated", ...}}`. The proxy fast-rejects before any route code runs; request body never consumed.
result: [pending]

### 9. Diagnostic Consent Route — Happy Path

expected: With a valid Supabase-issued JWT (or test JWKS-signed JWT), POST `/api/v1/diagnostics/consent` with `Idempotency-Key` header and body `{"purpose":"...","legalBasis":"...","source":"..."}` returns HTTP 201 with the created ConsentLog row (snake_case payload). GET `/api/v1/diagnostics/consent` returns the user's history with cursor-paginated shape including `next_cursor` field.
result: [pending]

### 10. Idempotency Replay

expected: POSTing the same body to `/api/v1/diagnostics/consent` twice with the same Idempotency-Key returns identical body+status both times; database has exactly one ConsentLog row. POSTing with the same key but a different body returns 409 `conflict`.
result: [pending]

### 11. RLS Cross-User Denial

expected: Plan 02-05.5's test (`tests/integration/rls-real-jwt.integration.test.ts`) runs against the live local Supabase and proves: User A reads their own plant (1 row), User B cannot read User A's plant (0 rows), `auth.uid()` resolves to the JWT-bound sub. All 3 specs pass without skipping.
result: [pending]

### 12. Photo Upload Route — Validation Pipeline

expected: `POST /api/v1/photos/upload` with no bearer returns 401. With a valid JWT and a GPS-bearing image: returns `validation_failed` BEFORE any storage write. With a >1 MiB body (1_048_577 bytes): returns `validation_failed`. With wrong MIME or unowned plantId: returns the appropriate validation/forbidden error. Successful upload writes original + thumbnail to Supabase Storage and inserts a PhotoEntry row.
result: [pending]

### 13. Storage Buckets Configured

expected: Calling `supabase.storage.listBuckets()` against the local stack returns three buckets: `plant-photos` (public=false, 5MiB cap, image MIME allowlist), `plant-thumbnails` (public=false, 2MiB), `data-exports` (public=false, 100MiB, application/zip|json). All three exist with correct config; no public buckets.
result: [pending]

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0
blocked: 0

## Gaps

[none yet]
