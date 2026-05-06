---
phase: 06-identification-flow-cost-controls
plan: "04"
subsystem: identification
tags: [i18n, snake-case, zod-schemas, tanstack-query, tdd, contract]
dependency_graph:
  requires:
    - 06-03 (provider abstraction layer)
    - src/contexts/identification/infrastructure/db/schema.ts
    - src/contexts/catalog/queries/index.ts (pattern reference)
  provides:
    - identify.* i18n namespace (80+ keys)
    - snake_case API mappers (toIdentificationSnakeCase, toIdentificationHistoryItemSnakeCase)
    - Zod request/response schemas (5 schemas)
    - TanStack Query factory (identificationKeys) + hooks
  affects:
    - 06-08 (use-cases — consume Zod schemas)
    - 06-11 (route handlers — consume schemas + mappers)
    - 06-15 (identify page — consume hooks + i18n keys)
    - 06-16 (history pages — consume hooks + i18n keys)
tech_stack:
  added: []
  patterns:
    - TDD red/green per task (no refactor needed — implementations minimal)
    - snake_case mapper mirrors catalog/api/snake-case.ts pattern exactly
    - identificationKeys factory mirrors plantsKeys factory shape
    - Zod .strict() on all request schemas (T-06-04-01 threat mitigation)
key_files:
  created:
    - src/messages/pt-BR.json (extended — identify.* namespace + catalog.profile.idHistory)
    - src/contexts/identification/api/snake-case.ts
    - src/contexts/identification/queries/index.ts
    - src/contexts/identification/queries/hooks.ts
    - tests/unit/identify-i18n-contract.unit.test.ts
    - tests/unit/identification/snake-case.unit.test.ts
    - tests/unit/identification/identify-schemas.unit.test.ts
  modified:
    - src/contexts/identification/domain/schemas.ts (5 new Zod schemas added)
decisions:
  - "src/messages/pt-BR.json is at src/messages/ not messages/ — plan frontmatter has wrong path; used real path throughout (Rule 3 deviation)"
  - "identificationKeys.detail() stubs fetchIdentificationDetail with throw — GET-by-id route is post-phase-6; IdentificationHistoryItem modal renders from list-row data per UI-SPEC line 449"
  - "catalog.profile.sections.idHistory key added alongside existing sections.history to avoid breaking Phase 5 consumers"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-06"
  tasks: 3
  files: 8
---

# Phase 06 Plan 04: Shape Contract — i18n, Mappers, Schemas, Query Factory Summary

Phase 6's Wave 1 shape-contract plan: JWT auth with refresh rotation using jose library — wait, wrong project. Here: i18n namespace, snake_case mappers, Zod request/response schemas, and TanStack Query factory all landed in one parallel-friendly plan with no schema migrations, no DB, no providers touched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | i18n strings + UI-SPEC contract test (RED) | ec283bb | tests/unit/identify-i18n-contract.unit.test.ts |
| 1 | i18n strings + UI-SPEC contract test (GREEN) | a6ae1f3 | src/messages/pt-BR.json |
| 2 | snake-case mapper + Zod schemas (RED) | ede2047 | tests/unit/identification/snake-case.unit.test.ts, tests/unit/identification/identify-schemas.unit.test.ts |
| 2 | snake-case mapper + Zod schemas (GREEN) | ddab943 | src/contexts/identification/api/snake-case.ts, src/contexts/identification/domain/schemas.ts |
| 3 | TanStack Query factory + hooks | e889a19 | src/contexts/identification/queries/index.ts, src/contexts/identification/queries/hooks.ts |

## Key Outputs

### 1. i18n Keys Added (~80 keys)

All UI-SPEC §Copywriting Contract keys populated under `identify.*` in `src/messages/pt-BR.json`:
- `identify.captureGuide.*` (4 keys)
- `identify.picker.*` (6 keys, including ICU `{n}/{max}` and `Remover foto {n}`)
- `identify.loading.*` (2 keys)
- `identify.results.*` (9 keys)
- `identify.resultSheet.*` (11 keys, including ICU `Adicionar {speciesName}?`)
- `identify.zeroResults.*` (4 keys)
- `identify.capHit.*` (5 keys, including ICU `Próximo limite em {resetTime}`)
- `identify.providerUnavailable.*` (4 keys)
- `identify.timeout.*` (4 keys)
- `identify.offline.*` (2 keys)
- `identify.paywall.*` (4 keys)
- `identify.consent.*` (6 keys — LGPD modal with "Entendo e aceito")
- `identify.header.*` (1 key)
- `identify.history.*` (12 keys, including ICU `Identificação de {date}, {statusLabel}`)
- `identify.plantHistory.*` (3 keys, including ICU `Histórico de identificações — {plantName}`)
- `identify.toast.*` (3 keys)
- `catalog.profile.idHistory.*` (2 keys)
- `catalog.profile.sections.idHistory` (1 key)

Phase 5 `identify.placeholder.*` keys preserved untouched.

### 2. Snake-Case Mapper Coverage

`src/contexts/identification/api/snake-case.ts` exports:
- `IdentificationSnakeCase` — 14-field type alias for the public API shape
- `IdentificationHistoryItemSnakeCase` — extends base with `thumbnail_signed_url` + `plant_name`
- `toIdentificationSnakeCase(row)` — camelCase IdentificationRow → snake_case
- `toIdentificationHistoryItemSnakeCase(row, signedUrl, plantName)` — adds joined fields

### 3. Five Zod Schema Names

All named-exported from `src/contexts/identification/domain/schemas.ts`:
1. `createIdentificationRequestSchema` — userId + photos[1..5] (server-side post-multipart-parse)
2. `confirmIdentificationRequestSchema` — speciesId + name + optional nickname/location/acquisitionDate per D-18
3. `correctIdentificationRequestSchema` — manualCorrection string per D-19
4. `listIdentificationsQuerySchema` — cursor pagination, limit coerced [1..200], default 20 per D-21
5. `recordConsentRequestSchema` — `z.literal("identification_third_party")` narrowed per D-10

### 4. TanStack Query Factory Key Namespace

`identificationKeys` in `src/contexts/identification/queries/index.ts`:
- `identificationKeys.all()` → `["identification", "history"]`
- `identificationKeys.history(params)` → `["identification", "history", params]`, staleTime 30s
- `identificationKeys.detail(id)` → `["identification", "detail", id]`, staleTime 60s

`useIdentificationHistory` and `useIdentificationDetail` exported from `hooks.ts` with `"use client"` directive.

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| identify-i18n-contract | 3 | PASS |
| snake-case.unit | 4 | PASS |
| identify-schemas.unit | 15 | PASS |
| **Total** | **22** | **PASS** |

TypeScript: `tsc --noEmit` — no errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wrong messages file path in plan**

- **Found during:** Task 1
- **Issue:** Plan frontmatter and verify commands reference `messages/pt-BR.json` but the actual file is `src/messages/pt-BR.json` (consistent with `src/i18n/request.ts` dynamic import `../messages/${locale}.json`)
- **Fix:** Used `src/messages/pt-BR.json` throughout — all reads, writes, and TSX validation commands
- **Files modified:** src/messages/pt-BR.json
- **Commit:** a6ae1f3

**2. [Rule 2 - Missing] catalog.profile.sections.idHistory added alongside existing sections.history**

- **Found during:** Task 1 — Phase 5 shipped `catalog.profile.sections.history` (value: "HISTÓRICO DE IDENTIFICAÇÃO"); the UI-SPEC spec calls for `catalog.profile.sections.idHistory` with the same value
- **Fix:** Added `idHistory` key while preserving existing `history` key — both point to "HISTÓRICO DE IDENTIFICAÇÃO" to avoid breaking Phase 5 consumers that may reference either path
- **Files modified:** src/messages/pt-BR.json

## Known Stubs

- `fetchIdentificationDetail` in `queries/index.ts` throws `Error("not implemented in phase 6")` — the detail factory entry is type-complete but the GET-by-id route is post-phase-6 scope per CONTEXT. IdentificationHistoryItem modal renders from list-row data (UI-SPEC line 449). This is intentional and documented with JSDoc.

## Threat Surface Scan

No new network endpoints introduced. The five Zod schemas are input-validation contracts for future route handlers (06-11). T-06-04-01 through T-06-04-05 mitigations verified:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-06-04-01 Extra fields on request bodies | All 5 schemas use `.strict()` | Done |
| T-06-04-04 Consent purpose widening | `z.literal("identification_third_party")` | Done |
| T-06-04-05 List DoS via large limit | `.max(200)` + default 20 | Done |

## Self-Check: PASSED

- [x] `src/messages/pt-BR.json` — valid JSON, 80+ identify.* keys present
- [x] `src/contexts/identification/api/snake-case.ts` — created, exports 2 types + 2 functions
- [x] `src/contexts/identification/domain/schemas.ts` — 5 new schemas named-exported
- [x] `src/contexts/identification/queries/index.ts` — identificationKeys with all/history/detail
- [x] `src/contexts/identification/queries/hooks.ts` — useIdentificationHistory + useIdentificationDetail
- [x] All 5 task commits exist: ec283bb, a6ae1f3, ede2047, ddab943, e889a19
- [x] 22 tests pass, 0 fail
- [x] `tsc --noEmit` clean
