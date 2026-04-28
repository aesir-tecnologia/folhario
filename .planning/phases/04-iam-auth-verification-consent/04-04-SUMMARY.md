---
phase: 04-iam-auth-verification-consent
plan: 04
subsystem: shared
tags:
  [
    inngest,
    serve-handler,
    topology,
    d-02,
    d-11,
    d-16,
    d-17,
    infra-10,
    anti-enumeration,
  ]
dependency-graph:
  requires:
    - 04-03 (Inngest dep installed; INNGEST_EVENT_KEY/SIGNING_KEY env vars added to serverEnv)
  provides:
    - "src/shared/inngest/client.ts: Inngest SDK singleton (id 'folhario')"
    - "src/shared/inngest/registry.ts: D-17 per-context concatenation (8 functions at Plan 04)"
    - "src/app/api/inngest/route.ts: serve() handler exporting GET/POST/PUT"
    - "src/contexts/iam/inngest/functions.ts: iamFunctions (3 stubs incl. iam-password-reset-requested for D-11)"
    - "src/contexts/billing/inngest/functions.ts: billingFunctions (2 stubs)"
    - "src/contexts/reminders/inngest/functions.ts: remindersFunctions (1 stub, STUB-only event trigger)"
    - "src/contexts/notifications/inngest/functions.ts: notificationsFunctions (1 stub — Codex MEDIUM topology fix)"
    - "src/contexts/species-care/inngest/functions.ts: speciesCareFunctions (1 stub: care-guide-augment — care-guide is owned by species-care, not a separate context)"
    - "src/contexts/identification/inngest/functions.ts: identificationFunctions = [] (Phase 6 placeholder)"
  affects:
    - "Plan 05 will extend src/contexts/notifications/inngest/functions.ts with the real notifications-send-email function (registry → 9)"
    - "Plan 08 will replace iam-password-reset-requested stub with real impl per D-11; registry stays at 9"
    - "Phases 6-11 emit `inngest.send({...})` to enqueue events; serve handler routes to the right function"
tech-stack:
  added:
    - "inngest@4.2.5 first runtime consumer (already installed in Plan 03)"
  patterns:
    - "D-17 per-context export + central concatenation for the registry (each context owns its array; registry just spreads)"
    - "STUB-only event triggers for stubs that would otherwise fire on a tight cron — keeps Inngest dashboard topology visible without burning free-tier quota or spamming local dev"
    - "Inngest 4.x signature: `createFunction(opts, handler)` with `triggers: [{event}]` or `triggers: [{cron}]` inside opts (NOT the older 3-arg form)"
key-files:
  created:
    - "src/shared/inngest/client.ts (10 lines)"
    - "src/shared/inngest/registry.ts (29 lines)"
    - "src/app/api/inngest/route.ts (8 lines)"
    - "src/contexts/iam/inngest/functions.ts (38 lines, 3 stubs)"
    - "src/contexts/billing/inngest/functions.ts (17 lines, 2 stubs)"
    - "src/contexts/reminders/inngest/functions.ts (18 lines, 1 stub)"
    - "src/contexts/notifications/inngest/functions.ts (14 lines, 1 stub)"
    - "src/contexts/species-care/inngest/functions.ts (19 lines, 1 stub)"
    - "src/contexts/identification/inngest/functions.ts (3 lines, empty placeholder)"
    - "tests/integration/inngest-serve.integration.test.ts (78 lines, 6 tests)"
  modified: []
decisions:
  - "care-guide-augment lives in src/contexts/species-care/inngest/functions.ts (NOT a separate src/contexts/care-guide/ directory). The plan's path was a planner artifact — care-guide is not a bounded context in this codebase; careGuides table and schemas all live under species-care, and species-care/domain/events.ts already comments care-guide/augment is Phase 4 work. Registry imports 6 contexts instead of 7 — a documented deviation from the plan's grep acceptance criterion."
  - "Stubs use `triggers: [{event}]` inside the options object (Inngest 4.x signature), not the deprecated 3-arg `createFunction(opts, trigger, handler)` form shown in the plan code samples."
  - "reminders-dispatch stub uses STUB-only event trigger `reminders/dispatch.requested.STUB` (not a cron) so the function appears in the Inngest dashboard for topology visibility WITHOUT firing on every minute. Phase 8 replaces both trigger and handler."
  - "iam-password-reset-requested ships as a stub here in Plan 04 per D-11 (anti-enumeration timing-attack defense); Plan 08 replaces with the real impl. This is the +1 Phase-4 anti-enumeration add to PRD §3 MVP's 8 functions per D-11/D-16 reframing."
  - "notifications-send-push lives under the notifications context per Codex MEDIUM topology fix — was previously planned under reminders. Reminders only owns reminders-dispatch; notifications owns push (and Plan 05 will add email)."
  - "INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY are optional in serverEnv. The Inngest constructor accepts undefined for both in dev; in production these are required environment configuration to make webhook signature validation meaningful."
metrics:
  duration_minutes: 12
  completed: 2026-04-28T04:29:00Z
  tasks_completed: 3
  files_changed: 10
  commits: 3
---

# Phase 4 Plan 04: Inngest Onboarding (D-02) Summary

**One-liner:** Wired Inngest as Phase 4's first async runtime per D-02 (Folhário-owned auth email events flow Inngest → Resend; Supabase Auth email hooks NOT used). Created the SDK singleton, the central registry concatenating per-context arrays (D-17), and the serve() handler at /api/inngest. Registered 8 functions at Plan 04 baseline = 7 PRD §3 MVP stubs + the iam/password-reset-requested stub for D-11 anti-enumeration; Plan 05 grows the registry to exactly 9 by adding the real notifications/send-email; Plan 08 replaces the password-reset-requested stub with real impl, keeping the count at 9. notifications/send-push lives under the notifications context per Codex MEDIUM topology fix. care-guide-augment lives under species-care (the actual owning context) instead of inside a separate orphan care-guide directory.

## What landed

### Task 1: Shared Inngest infrastructure

| File                                | Purpose                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `src/shared/inngest/client.ts`      | SDK singleton with `id: "folhario"`, `eventKey`/`signingKey` from `serverEnv`.    |
| `src/shared/inngest/registry.ts`    | D-17 concatenation of per-context arrays. Imports 6 contexts (deviation: care-guide is in species-care, not a separate context). |
| `src/app/api/inngest/route.ts`      | `serve({ client: inngest, functions: registry })` — exports GET/POST/PUT.         |

### Task 2: Per-context Inngest functions (8 stubs at Plan 04)

| Context           | Functions                                                                            | Notes                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| iam               | iam-process-deletion, iam-generate-export, **iam-password-reset-requested**          | Three stubs. Password-reset is the +1 Phase-4 anti-enumeration add per D-11; Plan 08 replaces with real impl. |
| billing           | billing-process-webhook, billing-trial-ending-notifier                               | Webhook event-triggered; notifier daily cron `0 9 * * *` (Phase 10 may adjust schedule).    |
| reminders         | reminders-dispatch                                                                   | STUB-only event trigger `reminders/dispatch.requested.STUB` — NOT cron — so the dashboard shows the function without firing. Phase 8 replaces with real cron + handler. |
| notifications     | notifications-send-push                                                              | Codex MEDIUM topology fix — moved here from reminders. Plan 05 adds the real notifications-send-email alongside this stub. |
| species-care      | care-guide-augment                                                                   | Planner deviation — see Deviations §1. care-guide is not a separate context; species-care owns it. |
| identification    | (empty array)                                                                        | Phase 6 placeholder.                                                                        |

**Plan 04 commit-time count: 8 functions.** Plan 05 grows the registry to exactly 9 by adding `notifications-send-email`.

### Task 3: Integration test

`tests/integration/inngest-serve.integration.test.ts` — 6 tests asserting:

1. `/api/inngest` exports GET/POST/PUT as functions.
2. registry has exactly 8 functions.
3. every function id is unique.
4. the 8 expected ids are present (alphabetical):
   - billing-process-webhook
   - billing-trial-ending-notifier
   - care-guide-augment
   - iam-generate-export
   - iam-password-reset-requested
   - iam-process-deletion
   - notifications-send-push
   - reminders-dispatch
5. notifications-send-push lives under notifications context (NOT reminders); reminders only owns reminders-dispatch.
6. iam-password-reset-requested lives under iam context per D-11.

## Tests

| Suite           | Tests       | Status |
| --------------- | ----------- | ------ |
| unit + unit-dom | 498         | PASS   |
| integration     | 91 (was 85) | PASS   |
| **total**       | **589**     | **PASS** |

New integration test file: `tests/integration/inngest-serve.integration.test.ts` (6 tests).

`pnpm typecheck` exits 0. `pnpm lint` exits 0 (warnings only, all pre-existing — none introduced by this plan).

## Deviations from plan

### Rule 1 — care-guide context conflict

**Found:** During load, the plan's `files_modified` listed `src/contexts/care-guide/inngest/functions.ts` and the registry import block listed `import { careGuideFunctions } from "@contexts/care-guide/inngest/functions"`. There is no `src/contexts/care-guide/` directory in this codebase — care-guide is owned by `src/contexts/species-care/` (the `careGuides` table, all care-guide schemas, and `species-care/domain/events.ts`'s comment "worker (`care-guide/augment` per PRD §3) is Phase 4 work" all sit there). The plan also listed `species-care/inngest/functions.ts` as `never[]` — empty for no reason.

**Fix:** Put `careGuideAugment` inside `src/contexts/species-care/inngest/functions.ts` (export name `speciesCareFunctions = [careGuideAugment]`); did NOT create the orphan `src/contexts/care-guide/` directory. Registry imports 6 contexts instead of 7.

**Impact on plan acceptance criteria:** the criterion `grep -cE "import \\{.*Functions.*from \"@contexts/" returns 7` documents 6 instead. The integration test's topology check (8 ids exact match) is unchanged and passes.

**Files affected:** `src/shared/inngest/registry.ts`, `src/contexts/species-care/inngest/functions.ts`. Commit `dcea350`.

### Rule 1 — Inngest 4.x createFunction signature

**Found:** Plan code samples used the deprecated 3-arg form `createFunction(opts, trigger, handler)`. Inngest 4.x (installed by Plan 03) uses the 2-arg form `createFunction(opts, handler)` with triggers inside opts:

```ts
inngest.createFunction(
  { id: "...", triggers: [{ event: "..." }] },
  async () => ({ status: "not_implemented" }),
);
```

Confirmed via Context7 docs (`/inngest/inngest-js`) and the installed package's own type definitions.

**Fix:** All 8 stubs use `triggers: [{event}]` or `triggers: [{cron}]` inside the options object.

**Files affected:** all 6 per-context functions.ts files with createFunction calls.

### No Rule 4 (architectural) decisions raised

care-guide vs species-care could be argued architectural, but it's structural cleanup (avoid orphan directory) consistent with the existing codebase layout. Documented inline in `species-care/inngest/functions.ts` and here.

## Codex MEDIUM coverage

| Codex finding                                          | Status | Evidence                                                                                                       |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------- |
| MEDIUM (Inngest topology drift — push under notif)      | FIXED  | `grep "notifications-send-push" src/contexts/reminders/inngest/functions.ts` returns 0; integration test asserts |
| MEDIUM (registry must reach 9 = 8 PRD §3 MVP + D-11 add) | PARTIAL | Plan 04 ships 8; Plan 05 adds the 9th (real notifications-send-email). At end of phase = 9.                     |

## Plan acceptance criteria — diff

| Criterion                                                                | Outcome                                                                                  |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/shared/inngest/client.ts` exports `inngest` (1 match)               | PASS                                                                                     |
| client uses both INNGEST env vars (2 matches)                            | PASS                                                                                     |
| `src/shared/inngest/registry.ts` exports `registry` (1 match)            | PASS                                                                                     |
| Registry imports from 7 contexts                                         | DEVIATED — 6 imports. care-guide-augment lives in species-care.                          |
| `src/app/api/inngest/route.ts` exports `{ GET, POST, PUT }`              | PASS                                                                                     |
| route imports both client + registry (2 matches)                         | PASS                                                                                     |
| iam: 3 createFunction calls                                              | PASS                                                                                     |
| iam: 0 auth-throttle-cleanup                                             | PASS                                                                                     |
| iam: contains iam-password-reset-requested                               | PASS                                                                                     |
| species-care file contains a stub returning `not_implemented`            | PASS (bonus — plan said empty array)                                                     |
| billing: 2 stubs                                                         | PASS                                                                                     |
| reminders: 1 stub                                                        | PASS                                                                                     |
| reminders: STUB-only event trigger, no cron                              | PASS                                                                                     |
| reminders: 0 notifications-send-push                                     | PASS                                                                                     |
| notifications: contains notifications-send-push                          | PASS                                                                                     |
| Integration test: 6+ test cases                                          | PASS (6 tests)                                                                           |
| Integration test: notifications-send-push under notifications            | PASS                                                                                     |
| Integration test: iam-password-reset-requested under iam                 | PASS                                                                                     |
| Integration test: 0 placeholder asserts                                  | PASS                                                                                     |
| `pnpm typecheck && pnpm lint` exit 0                                     | PASS                                                                                     |
| `pnpm test:integration tests/integration/inngest-serve.integration.test.ts` | PASS — 6/6                                                                            |

## Notes for downstream Phase 4 plans

1. **Plan 05 (Resend onboarding)** extends `src/contexts/notifications/inngest/functions.ts` with the real `notifications-send-email` function. Plan 05's integration test should assert registry length 9 and the additional id `notifications-send-email`.
2. **Plan 08 (password-reset)** replaces the `iam-password-reset-requested` stub with the real impl that performs constant-time response → async user lookup → optional token mint + email dispatch. Registry length stays at 9; only the function's body changes.
3. **`pnpm inngest:dev -u http://localhost:3000/api/inngest`** discovers all registered functions when the Next.js dev server is running. (Not exercised in this plan — PWA dev server start is out-of-scope per host instruction "never start local dev server".)
4. **`auth-throttle-cleanup`** Inngest cron is intentionally NOT shipped per D-12 OR clause (partial-index TTL via Plan 02's `auth_throttle_window_start_idx`). Phase 11+ may add a cron when storage growth requires it.
5. **`reminders-dispatch`** stub uses STUB-only event trigger `reminders/dispatch.requested.STUB`; Phase 8 replaces both the trigger (real cron schedule per PRD §20) and the handler (real dispatch logic).
6. **D-11 vs D-16 conflict** resolved by user on 2026-04-26 — INFRA-10 reframed as "8 PRD §3 MVP + 1 Phase-4 anti-enumeration add". The 8 PRD §3 MVP function names from INFRA-10 remain unchanged; iam/password-reset-requested is the +1 Phase-4-specific add mandated by D-11.

## Self-Check

Verified file existence:
- src/shared/inngest/client.ts — FOUND
- src/shared/inngest/registry.ts — FOUND
- src/app/api/inngest/route.ts — FOUND
- src/contexts/iam/inngest/functions.ts — FOUND
- src/contexts/billing/inngest/functions.ts — FOUND
- src/contexts/reminders/inngest/functions.ts — FOUND
- src/contexts/notifications/inngest/functions.ts — FOUND
- src/contexts/species-care/inngest/functions.ts — FOUND
- src/contexts/identification/inngest/functions.ts — FOUND
- tests/integration/inngest-serve.integration.test.ts — FOUND
- src/contexts/care-guide/ — NOT CREATED (intentional deviation)

Verified commits exist (git log):
- 102c90b Task 1
- dcea350 Task 2
- 618db16 Task 3

Verified test counts:
- unit + unit-dom: 498/498 passing
- integration: 91/91 passing (was 85; +6 new from this plan)
- typecheck: clean
- lint: 0 errors (warnings only — all pre-existing)

Verified topology assertions:
- `grep -rn "@contexts/care-guide" src/ tests/` returns 0 — no orphan path references.
- `test -d src/contexts/care-guide` returns NO — directory was never created.
- registry has exactly 8 ids in Plan 04 (verified by integration test 4).

## Self-Check: PASSED
