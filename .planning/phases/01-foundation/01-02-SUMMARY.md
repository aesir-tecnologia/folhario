---
phase: 01
plan: 02
subsystem: foundation-scaffold-errors-env
tags:
  - scaffold
  - errors
  - env-validation
  - tdd
requires:
  - 01-01
provides:
  - bounded-context-scaffold
  - error-registry
  - server-env-schema
  - client-env-schema
  - vitest-setup-env
affects:
  - all-phase-1-plans-wave-2-and-later
  - all-route-handlers-phase-2-plus
tech-stack:
  added: []
  patterns:
    - as-const-error-registry
    - split-env-module-boundary
    - vitest-projects-root-setupfiles
    - zod-preprocess-empty-to-undefined
key-files:
  created:
    - src/contexts/iam/{domain,application,infrastructure,api,inngest}/.gitkeep (5)
    - src/contexts/catalog/{domain,application,infrastructure,api,inngest}/.gitkeep (5)
    - src/contexts/species-care/{domain,application,infrastructure,api,inngest}/.gitkeep (5)
    - src/contexts/identification/{domain,application,infrastructure,api,inngest}/.gitkeep (5)
    - src/contexts/reminders/{domain,application,infrastructure,api,inngest}/.gitkeep (5)
    - src/contexts/billing/{domain,application,infrastructure,api,inngest}/.gitkeep (5)
    - src/contexts/notifications/{domain,application,infrastructure,api,inngest}/.gitkeep (5)
    - src/shared/{db,events,adapters}/.gitkeep (3)
    - src/shared/config/errors.ts
    - src/shared/config/server-env.ts
    - src/shared/config/client-env.ts
    - tests/unit/scaffold.test.ts
    - tests/unit/errors.test.ts
    - tests/unit/server-env.test.ts
    - tests/unit/client-env.test.ts
    - tests/unit/env-example.test.ts
    - tests/unit/setup-env.ts
  modified:
    - vitest.config.ts
  deleted:
    - src/placeholder.ts
decisions:
  - "Split env modules per D-29 revised (Action 4); no combined env.ts exists"
  - "setupFiles registered at root vitest.config.ts; extends: true propagates into both projects"
  - "Kept v3-style z.string().url() in Zod 4.3.6 (deprecated but functional; migration to z.url() deferred — zero functional delta)"
  - "src/placeholder.ts deleted inside Task 2 GREEN (not Task 1) — tsc include matches .ts/.tsx only; .gitkeep files do not satisfy the glob, so deletion must wait until the first real .ts lands in src/"
metrics:
  duration: "~12 minutes"
  tasks: 3
  files_created_or_modified: 50
  completed: 2026-04-23
---

# Phase 01 Plan 02: Scaffold + Error Registry + Split Env Validation Summary

One-liner: Landed the PRD §2 bounded-context tree (38 `.gitkeep`s), shipped the closed 21-code error registry with INTERNAL-ONLY redaction, and split the Zod env schema into `server-env.ts` + `client-env.ts` with a module-boundary guard — all driven by 101 unit-test assertions across 5 files via a RED → GREEN TDD cadence.

## What Shipped

### Scaffold (38 .gitkeep)

35 files under `src/contexts/<7 contexts>/<5 layers>/` + 3 files under `src/shared/{db,events,adapters}/`. No `.gitkeep` in `src/shared/config/` or `src/shared/telemetry/` — those directories now hold real files (this plan's `errors.ts`, `server-env.ts`, `client-env.ts`; Plans 05a/06 will populate telemetry).

### Error registry — `src/shared/config/errors.ts`

All 21 PRD §5 codes + their HTTP statuses:

| ErrorCode | Literal | HTTP |
|-----------|---------|------|
| Unauthenticated | `unauthenticated` | 401 |
| TokenExpired | `token_expired` | 401 |
| InvalidCredentials | `invalid_credentials` | 401 |
| WebhookSignatureInvalid | `webhook_signature_invalid` | 401 |
| Forbidden | `forbidden` | 403 |
| EmailUnverified | `email_unverified` | 403 |
| ConsentRequired | `consent_required` | 403 |
| DeletionInProgress | `deletion_in_progress` | 403 |
| ValidationFailed | `validation_failed` | 400 |
| InvalidPartnerCode | `invalid_partner_code` | 400 |
| NotFound | `not_found` | 404 |
| Conflict | `conflict` | 409 |
| SubscriptionRequired | `subscription_required` | 402 |
| ReadOnlyMode | `read_only_mode` | 402 |
| CapHit | `cap_hit` | 429 |
| RateLimited | `rate_limited` | 429 |
| ProviderUnavailable | `provider_unavailable` | 503 |
| CostCeilingReached *(INTERNAL)* | `cost_ceiling_reached` → `provider_unavailable` in body | 503 |
| BreakerOpen *(INTERNAL)* | `breaker_open` → `provider_unavailable` in body | 503 |
| Timeout | `timeout` | 504 |
| InternalError | `internal_error` | 500 |

INTERNAL redaction (AC-COST-007) is enforced by a `ReadonlySet<ErrorCode>` guard inside `errorResponse`; callers never see `cost_ceiling_reached` or `breaker_open` in the public body. Type-level exhaustiveness is enforced by `Record<ErrorCode, number>` — missing or extra entries fail `pnpm typecheck`.

### Env validation — SPLIT into two modules (D-29 revised / Action 4)

`src/shared/config/server-env.ts` — **9 keys**, server-only. Fails fast at module load by calling `serverSchema.parse(process.env)`.

| Key | Schema | Optional? |
|-----|--------|-----------|
| DATABASE_URL | `z.string().url()` | required |
| DATABASE_POOL_URL | `z.string().url()` | required |
| SUPABASE_SERVICE_ROLE_KEY | `z.string().min(1)` | required |
| SUPABASE_PROJECT_REF | `z.string().min(1)` | optional (empty → undefined) |
| SUPABASE_ACCESS_TOKEN | `z.string().min(1)` | optional |
| SENTRY_AUTH_TOKEN | `z.string().min(1)` | optional |
| SENTRY_ORG | `z.string().min(1)` | optional |
| SENTRY_PROJECT | `z.string().min(1)` | optional |
| IDENTIFICATION_PROVIDER_MODE | `z.enum(["stub","real"]).default("stub")` | defaults to `stub` |

`src/shared/config/client-env.ts` — **5 keys**, client-safe. Parses only the explicit `NEXT_PUBLIC_*` subset via a literal key object (never `process.env` wholesale) so the browser bundle cannot sniff server-only names.

| Key | Schema | Optional? |
|-----|--------|-----------|
| NEXT_PUBLIC_SUPABASE_URL | `z.string().url()` | required |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | `z.string().min(1)` | required |
| NEXT_PUBLIC_SENTRY_DSN | `z.string().url()` | optional (empty → undefined per D-19) |
| NEXT_PUBLIC_POSTHOG_KEY | `z.string().min(1)` | optional (empty → undefined per D-20) |
| NEXT_PUBLIC_POSTHOG_HOST | `z.string().url()` | optional (defaults hardcoded in `.env.example`) |

**Combined `src/shared/config/env.ts` was NOT created** (Action 4 single-module-per-domain posture). `! test -f src/shared/config/env.ts` is green. Module-boundary grep guard: `! grep -q "server-env" src/shared/config/client-env.ts` is green; symmetric guard `! grep -q "client-env" src/shared/config/server-env.ts` is also green.

### Vitest configuration — `setupFiles` at root

`vitest.config.ts` gained one line: `setupFiles: ["tests/unit/setup-env.ts"]` inside the root `test` block. `extends: true` on both the `unit` and `integration` projects propagates the setup into each project (verified against the Vitest 4 `projects` guide via context7). `tests/unit/setup-env.ts` primes `process.env` **before** any env module parses at import time, so `serverSchema.parse(process.env)` does not throw during test collection.

### Tests (5 files, 101 assertions)

| File | Assertions | What it guards |
|------|-----------:|----------------|
| `tests/unit/scaffold.test.ts` | 39 | All 38 `.gitkeep` paths exist; count invariant |
| `tests/unit/errors.test.ts` | 28 | 21 HTTP mappings + 7 behavior checks (redaction, shape, content-type) |
| `tests/unit/server-env.test.ts` | 5 | Valid parse, bad `IDENTIFICATION_PROVIDER_MODE`, default fill, missing `DATABASE_URL`, empty-string optional coercion |
| `tests/unit/client-env.test.ts` | 4 | Valid parse, empty-DSN coercion, empty-POSTHOG_KEY coercion, invalid URL rejection |
| `tests/unit/env-example.test.ts` | 25 | File exists, 19-key PRD §20 count, each key present, POSTHOG_HOST US-cloud value, no secret-shaped values |
| **Total** | **101** | |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] `src/placeholder.ts` deletion timed to Task 2 GREEN, not Task 1**
- **Found during:** Task 1 planning review
- **Issue:** The execution prompt's success criteria called for deleting `src/placeholder.ts` with the implicit claim that the Task 1 `.gitkeep` scaffold would satisfy `tsc`. That is incorrect: `tsconfig.json` `include` only matches `.ts` / `.tsx`; `.gitkeep` files are invisible to the TypeScript compiler and cannot prevent a regression of TS18003 "No inputs were found".
- **Fix:** Deferred deletion until Task 2 GREEN, bundled with the creation of `src/shared/config/errors.ts` (the first real `.ts` file under `src/`). `pnpm typecheck` went from passing (placeholder present) → would have failed (placeholder deleted, no real `.ts`) → passing (errors.ts landed in the same commit). No intermediate broken state.
- **Files modified:** `src/placeholder.ts` (deleted via `trash` per CLAUDE.md "never use `rm`"), `src/shared/config/errors.ts` (created)
- **Commit:** `1b2028b` (Task 2 GREEN)

**2. [Rule 1 - Bug] Commit-body line length exceeded commitlint `body-max-line-length: 100`**
- **Found during:** Task 1 commit
- **Issue:** First `git commit` attempt for the scaffold included a body line >100 chars (the `- 35 .gitkeep under ...` bullet with full path spelled out). `@commitlint/config-conventional` 20.x enforces `body-max-line-length: 100` by default.
- **Fix:** Rewrote the commit body with shorter wrapped lines before the second attempt.
- **Files modified:** none (commit message only)
- **Commit:** `b3ac0ae`

### Intentional deviations from plan text

- **Prettier reflow of test files via lint-staged.** During Task 3 RED commit, `lint-staged` ran `prettier --write` on the newly staged test files, which re-wrapped some of the longer single-line `expect(() => ...).toThrow()` assertions to match the project's `printWidth: 100`. Content and behavior are identical; only formatting changed. This is expected behavior of the pre-commit hook.
- **Zod `.string().url()` kept as-is.** Zod 4 has moved to top-level `z.url()` and `z.string().url()` is deprecated but still functional. Kept the plan's v3-style syntax because it compiles, tests pass, and there is zero functional difference in 4.3.6. Migration logged for a later housekeeping pass; not a deviation that affects this plan's deliverables.

### Authentication Gates

None.

## Commits

| # | Type | Commit | Scope |
|---|------|--------|-------|
| 1 | Task 1 scaffold | `b3ac0ae` | 38 `.gitkeep` + `scaffold.test.ts` |
| 2 | Task 2 RED | `2f61152` | `errors.test.ts` (fails: module missing) |
| 3 | Task 2 GREEN | `1b2028b` | `errors.ts` + delete `placeholder.ts` |
| 4 | Task 3 RED | `71b023b` | `{server,client}-env.test.ts` + `env-example.test.ts` + `setup-env.ts` + `vitest.config.ts` edit |
| 5 | Task 3 GREEN | `8a15b56` | `server-env.ts` + `client-env.ts` |

Gate sequence for TDD compliance: `test(01-02) RED` → `feat(01-02) GREEN` → `test(01-02) RED` → `feat(01-02) GREEN` — two full cycles, both ordered correctly.

## Known Stubs

**Intentional scaffold placeholders (per D-09 — not bugs):**

- 38 `.gitkeep` files under `src/contexts/**` + `src/shared/{db,events,adapters}/`. Empty-directory markers that preserve the PRD §2 bounded-context tree in git. Files flow in during Phase 2 (Drizzle schema + adapters), Phase 4 (IAM), and later feature phases. The `scaffold.test.ts` invariant (38-count) guards against accidental deletion.

**Non-intentional stubs:** none.

## Threat Flags

No new trust-boundary surface introduced that wasn't already in the plan's `<threat_model>`. T-02-01 (error-code leak) → mitigated by `INTERNAL_ONLY` redaction in `errorResponse`. T-02-02 (env-var injection) → mitigated by `serverSchema.parse(process.env)` at module load and the `IDENTIFICATION_PROVIDER_MODE` enum. T-02-03 (`.env.example` secret leak) → mitigated by `env-example.test.ts` regex-scanning for `sk_live_`, JWT shape, and long base64. T-02-04 (client bundle picking up server parsing) → mitigated by the split module boundary + grep guard. T-02-05 (`error.details` PII leak) → `accept-delegated` per plan; route handlers (Phase 2+) take responsibility.

## Reference to Next Plans

Wave 2 siblings (parallel with this plan in the DAG):
- **01-03** — Next 16 App Router skeleton + i18n + `src/proxy.ts` + Serwist + `next.config.ts`
- **01-04** — Local Supabase Docker stack + `scripts/sync-supabase-env.sh`

Downstream consumers of this plan's outputs:
- **All future route handlers** import `ErrorCode` + `errorResponse` from `@shared/config/errors`
- **All server modules** import from `@shared/config/server-env`
- **Plan 01-06** `posthog-client.ts` imports from `@shared/config/client-env` (never server-env)
- **Plan 01-05a** `sentry-scrub.ts` — mutually-parallel; consumers come in 01-05b

## Self-Check

Files created verified against disk:

- `src/shared/config/errors.ts` — FOUND
- `src/shared/config/server-env.ts` — FOUND
- `src/shared/config/client-env.ts` — FOUND
- `src/shared/config/env.ts` — correctly ABSENT (Action 4 single-module-per-domain)
- `src/placeholder.ts` — correctly ABSENT (deleted in Task 2 GREEN)
- `tests/unit/scaffold.test.ts` — FOUND
- `tests/unit/errors.test.ts` — FOUND
- `tests/unit/server-env.test.ts` — FOUND
- `tests/unit/client-env.test.ts` — FOUND
- `tests/unit/env-example.test.ts` — FOUND
- `tests/unit/setup-env.ts` — FOUND
- `vitest.config.ts` — contains `setupFiles: ["tests/unit/setup-env.ts"]`
- `find src/contexts -name .gitkeep | wc -l` → 35
- `find src/shared -maxdepth 2 -name .gitkeep | wc -l` → 3

Module-boundary invariants:
- `! grep -q "server-env" src/shared/config/client-env.ts` — green
- `! grep -q "client-env" src/shared/config/server-env.ts` — green

Commits verified present in `git log`:
- `b3ac0ae` (Task 1 scaffold)
- `2f61152` (Task 2 RED)
- `1b2028b` (Task 2 GREEN)
- `71b023b` (Task 3 RED)
- `8a15b56` (Task 3 GREEN)

Full-plan verification:
- `pnpm exec vitest run --project=unit` — 5 files / 101 assertions passed
- `pnpm typecheck` — exits 0

## Self-Check: PASSED
