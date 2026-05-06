---
phase: 06-identification-flow-cost-controls
plan: "02"
subsystem: identification
tags: [test-scaffolding, playwright, vitest, fetch-mock, consent]
dependency_graph:
  requires:
    - "05-xx: authedUser fixture (tests/e2e/fixtures/authed-user.ts)"
    - "06-01: identification schema, provider_circuit_breakers, provider_budgets, provider_usage_counters tables"
  provides:
    - "consentedUser Playwright fixture (tests/e2e/fixtures/consented-user.ts)"
    - "fetch mock harness for Plant.id v3 + OpenAI-compat (tests/integration/setup-identification.ts)"
    - "IDENTIFICATION_PROVIDER_MODE=stub enforced in playwright.config.ts"
    - "per-context test directories: tests/integration/identification/, tests/unit/identification/"
  affects:
    - "06-05 through 06-16: all downstream test plans import from these scaffolding files"
tech_stack:
  added: []
  patterns:
    - "vi.spyOn(global, 'fetch') with URL-substring matching and fall-through to real fetch"
    - "Playwright base.extend for consentedUser fixture (same pattern as authedUser)"
key_files:
  created:
    - tests/e2e/fixtures/consented-user.ts
    - tests/integration/setup-identification.ts
    - tests/integration/identification/.gitkeep
    - tests/unit/identification/.gitkeep
  modified:
    - playwright.config.ts
decisions:
  - "Imported authedUser pattern verbatim (copy-body) rather than chaining test.extend on authedUser's exported test — simpler and avoids double fixture setup cost"
  - "Used Sql type from postgres package (not ReturnType<typeof postgres>) — matches what postgres@3.x exports"
  - "installProviderFetchMock() returns spy.mockRestore() as restore() — callers call in afterEach per T-06-02-02 mitigation"
  - "originalFetch captured at module load time so fall-through is safe even when global.fetch is replaced"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-06T06:02:16Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 6 Plan 02: Phase 6 Test Scaffolding (Wave 0) Summary

Wave 0 test scaffolding: consentedUser Playwright fixture with identification_third_party consent INSERT, vi.spyOn fetch-mock harness for Plant.id v3 and OpenAI-compat providers, reset helpers for circuit breakers and usage counters, and IDENTIFICATION_PROVIDER_MODE=stub enforced in playwright.config.ts.

## What Was Built

### Task 1: consentedUser Playwright fixture (commit 6704fa5)

Created `tests/e2e/fixtures/consented-user.ts` — a Playwright fixture following the same pattern as `authed-user.ts` but adding a third `INSERT INTO consent_logs` row for the `identification_third_party` purpose (`legal_basis: 'consent'`, `source: 'identify_screen'`). The fixture:

- Seeds a unique per-test user via `seedUser` + `seedCurrentPolicyVersions`
- Inserts the two standard `signup_acceptance` consent rows and the subscription row
- Inserts the Phase 6 `identification_third_party` consent row
- Signs in via Supabase SSR client, injects cookies into the Playwright context
- Exports `test`, `expect`, `ConsentedUser` type alias

Import path for downstream plans:

```typescript
import { test, expect } from "tests/e2e/fixtures/consented-user";
// consentedUser fixture is available as a test parameter
```

Also created stub directories:
- `tests/integration/identification/.gitkeep`
- `tests/unit/identification/.gitkeep`

### Task 2: Integration fetch-mock helpers + e2e stub-mode env (commit a001539)

Created `tests/integration/setup-identification.ts` with these named exports:

| Export | Purpose |
|--------|---------|
| `mockPlantIdSuccess(suggestions)` | vi.spyOn fetch mock returning Plant.id v3 shape |
| `mockPlantIdFailure(opts)` | vi.spyOn mock returning non-2xx for Plant.id URLs |
| `mockOpenAISuccess(results)` | vi.spyOn mock returning OpenAI chat completions shape |
| `mockOpenAIFailure(opts)` | vi.spyOn mock returning non-2xx for OpenAI URLs |
| `mockProviderTimeout(provider, delayMs)` | fetch mock that rejects with AbortError when signal fires |
| `resetCircuitBreakers(db)` | Resets provider_circuit_breakers to closed/zero state |
| `resetLastAlertedAt(db)` | Nulls provider_budgets.last_alerted_at |
| `resetProviderUsageCounters(db)` | Deletes all provider_usage_counters rows |
| `installProviderFetchMock()` | Convenience wrapper returning {restore, plantIdCalls, openaiCalls} |

Import path for downstream plans:

```typescript
import {
  installProviderFetchMock,
  mockPlantIdSuccess,
  mockOpenAISuccess,
  resetCircuitBreakers,
  resetLastAlertedAt,
  resetProviderUsageCounters,
} from "tests/integration/setup-identification";
```

URL matching discriminators:
- Plant.id: URL includes `/v3/identification`
- OpenAI-compat: URL includes `/chat/completions`
- All other URLs fall through to `originalFetch` — Supabase HTTP calls are not intercepted

Added Phase 6 comment block above the existing `IDENTIFICATION_PROVIDER_MODE: "stub"` line in `playwright.config.ts` (line 93). The env var itself was already present from prior work; the comment documents the rationale (RESEARCH §Risk 2 + Phase 1 D-05 SC-4).

**IDENTIFICATION_PROVIDER_MODE=stub is confirmed enforced in playwright.config.ts** — e2e identify specs cannot hit real Plant.id or OpenAI providers.

## Sentry Scrub Regression Note (for plan 06-11)

The Sentry scrub regex `/\/api\/v1\/identifications(\/|$)/` at `src/shared/telemetry/sentry-scrub.ts:15` already covers `/api/v1/identifications`, `/api/v1/identifications/{id}/confirm`, and `/api/v1/identifications/{id}/correct` because `(\/|$)` matches any slash boundary. No module change needed in Phase 6. Plan 06-11 MUST assert via Playwright that POST `/api/v1/identifications` request body is dropped from Sentry breadcrumbs (Phase 1 D-22 invariant — this is the regression guard, not adding new scrub coverage).

## Deviations from Plan

None — plan executed exactly as written. The `IDENTIFICATION_PROVIDER_MODE: "stub"` env var was already present in playwright.config.ts from prior work (not introduced in this plan); the comment block was the only addition needed for Task 2.

## Known Stubs

None — this plan ships test infrastructure only. No production code or data-wired UI components.

## Threat Flags

None — no new production network endpoints, auth paths, file access patterns, or schema changes introduced. Test fixtures only.

## Self-Check: PASSED

- `tests/e2e/fixtures/consented-user.ts` exists: FOUND
- `tests/integration/setup-identification.ts` exists: FOUND
- `tests/integration/identification/.gitkeep` exists: FOUND
- `tests/unit/identification/.gitkeep` exists: FOUND
- Commit 6704fa5 exists: FOUND
- Commit a001539 exists: FOUND
- `tsc --noEmit` clean: VERIFIED
