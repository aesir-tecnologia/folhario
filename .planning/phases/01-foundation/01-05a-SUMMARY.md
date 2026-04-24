---
phase: 01
plan: 05a
subsystem: foundation-sentry-scrub-helpers
tags:
  - sentry
  - lgpd
  - scrubbing
  - tdd
  - pii
requires:
  - phase: 01-02
    provides: error-registry + env-zod-schemas (unit test harness + tsconfig aliases)
  - phase: 01-03
    provides: src/instrumentation.ts guarded dynamic import (consumer of Plan 05b which in turn consumes this module)
provides:
  - shared-telemetry-sentry-scrub-ts
  - lgpd-13-scrub-contract-unit-tests
  - 6-field-scrub-set-authorization-cookie-email-password-token-photo-url
  - identification-path-body-drop-regex
  - recursive-scrub-object-walker
  - case-insensitive-header-scrubber
  - user-identity-hardening-email-username-ip-address-deletion
affects:
  - 01-05b-sentry-init-configs (consumes all 5 exports verbatim; three init files will import makeBeforeSend + makeBeforeBreadcrumb)
  - 01-07-diagnostics-routes (synthetic /_diag-synth path triggers the identification body-drop rule)
  - all-future-sentry-events (every event in the app runs through makeBeforeSend before transport)
tech-stack:
  added: []
  patterns:
    - scrub-fields-as-const-readonly-tuple
    - case-insensitive-key-match-via-lowercase-set-lookup
    - path-boundary-regex-slash-or-end-anchor
    - recursive-object-walker-with-primitive-passthrough
    - factory-function-returning-closure-makeBefore-prefix
    - redaction-marker-literal-scrubbed-bracketed
key-files:
  created:
    - src/shared/telemetry/sentry-scrub.ts
    - tests/unit/sentry-scrub.test.ts
  modified: []
key-decisions:
  - "SCRUB_FIELDS exported as readonly tuple via `as const` — gives Plan 05b the narrowest possible type (`readonly [\"authorization\",\"cookie\",\"email\",\"password\",\"token\",\"photo_url\"]`) for exhaustiveness checks. Internal lookup uses a Set<string> constructed from the tuple once at module load."
  - "IDENTIFICATION_PATH = /\\/api\\/v1\\/identifications(\\/|$)/ — boundary is slash-or-end, NOT a greedy `.*`. Matches the three required shapes (exact, trailing slash, subpath). Does NOT match /api/v1/identifications_foo or /api/v1/identifications-anything-no-slash. Test 2 + 3 cover no-slash and with-suffix forms; T-05a-02 spec regression guard."
  - "Redaction marker is the literal string `[scrubbed]` everywhere (not `[redacted]`, not `undefined`, not deletion). Rationale: preserves the KEY in the structure so a Sentry operator can see that a sensitive field was PRESENT but scrubbed, enabling anomaly detection (e.g., why is `email` showing up in a request to /api/v1/health?). Exception: request.data on identification routes is set to `undefined` wholesale (LGPD-13 requires body drop, not per-field scrub)."
  - "makeBeforeSend / makeBeforeBreadcrumb are factory functions (not direct function exports). Future-proofs for per-runtime configuration injection (e.g., an opt-in flag for dev-time scrub tracing) without breaking the Plan 05b import shape. Current implementation uses no closure state."
  - "Local SentryEvent / SentryBreadcrumb types (structural, permissive) rather than importing from @sentry/nextjs. Keeps this module free of Sentry SDK coupling for testability. Plan 05b wraps these with Sentry.init's required callback types at the init-file boundary."
  - "Test file type-safety: restructured plan-supplied examples from `any` to typed `TestEvent` / `TestBreadcrumb` locals with narrow `as TestEvent` casts on outputs. Rule 3 fix — project's `@typescript-eslint/no-explicit-any` (from eslint-config-next/typescript) blocked the plan's `any`-laden sample code at lint-staged. Functionally identical; lint-clean."
  - "REFACTOR SKIPPED — GREEN implementation is 94 lines with zero duplication and single-responsibility helpers. Plan explicitly permits `no refactor needed — GREEN is minimal` in the summary."
  - "LGPD-13 NOT marked complete in REQUIREMENTS.md by this plan — the scrub MODULE is shipped but runtime enforcement requires Plan 05b's three Sentry.init files (server/edge/client). This plan's own threat model (T-05a-01) states `the scrub MODULE is verified here; the init-file WIRING that consumes it is verified in Plan 05b`. Plan 05b marks LGPD-13 complete. Frontmatter `requirements: [LGPD-13]` is a traceability pointer to the contributing plan, not a completion claim."
patterns-established:
  - "Factory-returning-closure pattern for Sentry callbacks: `makeBeforeSend()` returns the `(event) => event` function, callable at Sentry.init time."
  - "Redaction marker `[scrubbed]` as the consistent replacement value for per-field scrubs; `undefined` reserved for wholesale section drops (request.cookies, request.data on identification routes)."
  - "Scrub recursion walks arrays + nested records but short-circuits on primitives (null, number, string, boolean) — no wasted closures on leaf values."
  - "Path-boundary regex with `(\\/|$)` anchor keeps PRD-specified path match tight and prevents suffix-bypass (T-05a-02)."
requirements-completed: []
requirements-contributed:
  - LGPD-13
duration: ~4min
completed: 2026-04-24
---

# Phase 01 Plan 05a: Sentry LGPD-13 Scrub Helpers Summary

**Lands the single source of truth for Sentry PII scrubbing — `src/shared/telemetry/sentry-scrub.ts` with 5 named exports consumed by Plan 05b's three Sentry init files — via strict TDD (RED → GREEN, REFACTOR skipped because GREEN is minimal). 15 unit tests over 12 behaviors pin the LGPD-13 legal contract (PRD §13.7) as runnable assertions: 6 forbidden fields scrubbed case-insensitively from headers/data/extra/contexts, request.data dropped wholesale on `/api/v1/identifications/*`, user.email/username/ip_address deleted on every event (user.id preserved).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-24T02:48:48Z
- **Completed:** 2026-04-24T02:53:18Z
- **Tasks:** 1 TDD task (RED + GREEN atomic commits; REFACTOR skipped per plan's explicit allowance)
- **Commits:** 2 (test RED + feat GREEN)
- **Files created:** 2 (`src/shared/telemetry/sentry-scrub.ts` 94 lines, `tests/unit/sentry-scrub.test.ts` 185 lines)
- **Files modified:** 0

## Accomplishments

- `tests/unit/sentry-scrub.test.ts` — 15 tests, 1+ assertions each, covering 12 PRD §13.7 behaviors:
  1. SCRUB_FIELDS = exactly the 6 required fields (sorted equality)
  2. request.data dropped on `/api/v1/identifications/abc`
  3. request.data dropped on `/api/v1/identifications` (no-trailing-slash edge case, T-05a-02 guard)
  4. request.data PRESERVED but scrubbed on non-identification paths (`/api/v1/users`) — forbidden keys → `[scrubbed]`, safe keys intact
  5. Headers scrubbed case-insensitively (`Authorization`, `cookie`, `EMAIL` all → `[scrubbed]`; `X-Other` kept)
  6. request.cookies set to `undefined`
  7. user.email / user.username / user.ip_address deleted; user.id preserved (C-24 setUser({id}) compat)
  8. Nested extra objects scrubbed recursively (2 levels deep: `extra.level1.level2.token`)
  9. Arrays of objects within extra scrubbed per-element
  10. contexts scrubbed recursively (meta.password)
  11. makeBeforeBreadcrumb scrubs breadcrumb.data; passes through breadcrumbs without data unchanged
  12. Edge cases: `scrubHeaders(undefined)` returns `undefined`; `scrubObject` passes through `null`, numbers, strings, booleans, empty `{}`
- `src/shared/telemetry/sentry-scrub.ts` — 5 named exports:
  - `SCRUB_FIELDS: readonly ["authorization","cookie","email","password","token","photo_url"]`
  - `scrubHeaders(headers: Record<string,string> | undefined): Record<string,string> | undefined`
  - `scrubObject(obj: unknown): unknown` — recursive walker with primitive passthrough
  - `makeBeforeSend(): (event: SentryEvent) => SentryEvent` — factory-returning-closure pattern
  - `makeBeforeBreadcrumb(): (breadcrumb: SentryBreadcrumb) => SentryBreadcrumb`
- Full unit suite: 6 files / 116 tests passing (was 5/101 before this plan; delta = +1 file / +15 tests).
- `pnpm typecheck` exit 0 (no regressions to Plans 01-01..04 typed surface).
- Module public surface grep-anchored to all 5 plan-required exports (`export const SCRUB_FIELDS`, `export function makeBeforeSend`, `export function makeBeforeBreadcrumb`, `export function scrubHeaders`, `export function scrubObject`) plus `IDENTIFICATION_PATH` regex token.
- Line counts: implementation 94 lines (plan min 55), test 185 lines (plan min 80) — both comfortably over thresholds.

### Module public surface as shipped (Plan 05b contract)

```typescript
// src/shared/telemetry/sentry-scrub.ts — verbatim public surface

export const SCRUB_FIELDS = [
  "authorization",
  "cookie",
  "email",
  "password",
  "token",
  "photo_url",
] as const;

export function scrubHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined;

export function scrubObject(obj: unknown): unknown;

export function makeBeforeSend(): (event: SentryEvent) => SentryEvent;
export function makeBeforeBreadcrumb(): (breadcrumb: SentryBreadcrumb) => SentryBreadcrumb;
```

Plan 05b will import these by name from `@shared/telemetry/sentry-scrub` and pass the two factory-call results directly to `Sentry.init({ beforeSend: makeBeforeSend(), beforeBreadcrumb: makeBeforeBreadcrumb() })` in each of the three runtime configs (sentry.server.config, sentry.edge.config, sentry.client.config). Type compatibility with `@sentry/nextjs`'s `BeforeSendCallback` / `BeforeBreadcrumb` is Plan 05b's concern — current local types are structurally permissive enough that a direct assignment will not require casts.

## Task Commits

1. **RED — `tests/unit/sentry-scrub.test.ts` (failing, module does not exist)** — `635a8c5` (test). Verified failure mode: module-resolution error (`Cannot find package '@shared/telemetry/sentry-scrub'`), NOT assertion failure. This is the correct RED signal per tdd.md (test fails because the SUT is absent, not because an assertion disagrees).
2. **GREEN — `src/shared/telemetry/sentry-scrub.ts` (all 15 tests pass)** — `7e5bf12` (feat). Full unit suite (116/116) green; `pnpm typecheck` exit 0.

REFACTOR: not taken — no duplication or readability issues in the 94-line GREEN output. Plan explicitly allowed this skip.

Final `docs(01-05a)` commit (SUMMARY + STATE + ROADMAP + REQUIREMENTS) lands separately as the plan-completion metadata commit.

## Files Created/Modified

### Created

- `src/shared/telemetry/sentry-scrub.ts` — 94 lines. Five named exports + two internal helpers (`SCRUB_SET`, `IDENTIFICATION_PATH`, `isScrubKey`) + two local structural types (`SentryEvent`, `SentryBreadcrumb`). Zero external imports. Zero closure state. Zero side effects at module load.
- `tests/unit/sentry-scrub.test.ts` — 185 lines. 7 `describe` blocks, 15 `it` tests. Module-level `TestEvent` / `TestBreadcrumb` types mirror the implementation's local types to keep the test free of `any` (project's `@typescript-eslint/no-explicit-any` rule). Uses `as TestEvent` casts on `makeBeforeSend()(...)` outputs — function return type widens appropriately.

### Modified

None. Plan changed no existing files.

## Decisions Made

See `key-decisions` in frontmatter — 7 decisions, each grep-anchored to the shipped module or test content.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Plan's test-file sample used `any` type liberally; project's `@typescript-eslint/no-explicit-any` (from `eslint-config-next/typescript`) blocked the RED commit at lint-staged**

- **Found during:** Task 1 RED commit (first `git commit`).
- **Issue:** The plan's `<action>` block supplied the test file verbatim with 22 uses of `any` (e.g., `const event: any = {...}`, `const out: any = makeBeforeSend()(event)`). `husky` → `lint-staged` → `eslint --fix` cannot auto-fix `no-explicit-any`; the commit was rejected with 22 lint errors.
- **Fix:** Rewrote the test file to use typed synthetic events. Introduced file-local structural types `TestEvent` and `TestBreadcrumb` mirroring the module's internal `SentryEvent` / `SentryBreadcrumb`. Used explicit `as TestEvent` casts on `makeBeforeSend()(...)` outputs (function returns the permissive `SentryEvent` structural type). Added a tiny helper `asRec(v: unknown): Record<string, unknown>` for casting nested `.extra.level1` etc. Zero `any` in the final file. Every assertion from the plan's 12 behaviors is preserved 1:1.
- **Files modified:** `tests/unit/sentry-scrub.test.ts` (pre-commit working-tree edit; only the lint-clean version was staged and committed).
- **Verification:**
  - `git show 635a8c5:tests/unit/sentry-scrub.test.ts | grep -c ": any"` → 0 (RED commit is lint-clean).
  - `pnpm exec vitest run tests/unit/sentry-scrub.test.ts --project=unit` (after GREEN) → 15/15 passed.
  - `pnpm typecheck` → exit 0.
- **Impact on plan acceptance:** All 12 required behaviors and ≥15 assertions still exercised. Semantic equivalence verified by passing test count (15 it's, each with 1+ assertions). No plan contract compromised.
- **Committed in:** `635a8c5`.

**2. [Rule 3 - Blocker] Commitlint `subject-case` rejected the RED commit subject because it started with "LGPD-13" (all-caps)**

- **Found during:** Task 1 RED commit (second attempt after Deviation 1 fix).
- **Issue:** The plan's suggested commit subject was `test(01-05a): LGPD-13 load-bearing test for Sentry scrub helpers (RED)`. Project's `@commitlint/config-conventional` rejected it with `subject must not be sentence-case, start-case, pascal-case, upper-case [subject-case]` because "LGPD-13" registered as upper-case start.
- **Fix:** Rephrased to lowercase-start: `test(01-05a): add failing test for Sentry LGPD-13 scrub helpers (RED)`. "LGPD-13" now appears mid-subject (an accepted acronym in body content; commitlint flags only the first word). Zero semantic change.
- **Files modified:** None (commit metadata only).
- **Committed in:** `635a8c5`.

### Deviations without explicit rule

None.

### Authentication Gates

None — pure module + unit test, no network access, no credentials touched.

## Issues Encountered

- **Pre-commit hook behavior:** Discovered (again) that lint-staged runs `eslint --fix` against the STAGED blob, not the working-tree copy. When I wrote the fixed test file AFTER already `git add`-ing the original, the commit re-ran lint against the stale staged version and failed. Re-staging with `git add tests/unit/sentry-scrub.test.ts` between the fix and the retry resolved it. Not a plan-level issue; noted as a habit reminder for future GSD executors: **always re-add after editing, not before.**
- **Vitest watch-mode hook blocks `pnpm test:unit`:** `prevent-watch-mode-tests.sh` treats the wrapper script name "test:unit" as watch-mode even though `package.json`'s script is `vitest --run --project=unit`. Falls-back to the direct invocation form `pnpm exec vitest run tests/unit/sentry-scrub.test.ts --project=unit` (positional `run`, hook's allowlist match) per Plan 01-04 SUMMARY's pre-existing workaround. NOT a plan-level issue.
- **`vite-tsconfig-paths` deprecation warning:** Vitest 4 now prints a warning suggesting `resolve.tsconfigPaths: true` as a native replacement. Benign — plugin still works. Deferred (plan did not scope Vitest config changes; out-of-scope per executor-examples.md "SCOPE BOUNDARY").

## User Setup Required

None. Pure module + test; no Sentry DSN, no network, no env vars required to verify.

## Known Stubs

None. The module is a complete, production-ready LGPD-13 scrub contract. Plan 05b will consume it verbatim and wire the three `Sentry.init` calls. No placeholders, no `TODO` comments, no hardcoded empty objects.

## Threat Flags

All three threats from the plan's `<threat_model>` remain correctly mitigated:

- **T-05a-01 (Info Disclosure — LGPD-13):** 6 scrub fields enforced via `SCRUB_SET = new Set(SCRUB_FIELDS)` lookup; headers (Test 5), request.data on non-id paths (Test 4), extra (Tests 8, 9), contexts (Test 10) all exercise recursive scrubbing. request.data dropped wholesale on identification paths (Tests 2, 3). request.cookies force-undefined (Test 6). User identity scrubbed (Test 7).
- **T-05a-02 (Tampering — regex bypass):** `IDENTIFICATION_PATH = /\/api\/v1\/identifications(\/|$)/` — boundary anchor prevents suffix-smuggling. Test 3 (`/api/v1/identifications` no trailing slash) and Test 2 (`/api/v1/identifications/abc` with subpath) both pass. An adversarial URL like `/api/v1/identifications_foo` would NOT match — verified by manual regex trace (reader can verify: `/\/api\/v1\/identifications(\/|$)/.test("/api/v1/identifications_foo")` → false because `_` is neither `/` nor end-of-string). No test covers this explicitly because the plan's behavior list didn't mandate it; the regex structure itself is the mitigation.
- **T-05a-03 (Info Disclosure — case bypass):** `isScrubKey(k)` lowercases before `SCRUB_SET.has` lookup. Test 5 explicitly exercises `Authorization`, `cookie`, `EMAIL` — three different case variants — all three become `[scrubbed]`.

No new threat surface introduced. Deferred threats (D-19 empty-DSN posture, L-2 sendDefaultPii pinning, instrumentation try/catch removal) correctly remain Plan 05b's responsibility.

## Next Phase Readiness

**Ready for Plan 01-05b (Sentry init configs):**

- `@shared/telemetry/sentry-scrub` exports are pinned and tested. Plan 05b will:
  1. Create `sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry.client.config.ts` at repo root.
  2. Each file: `import { makeBeforeSend, makeBeforeBreadcrumb } from "@shared/telemetry/sentry-scrub";` then `Sentry.init({ ..., beforeSend: makeBeforeSend(), beforeBreadcrumb: makeBeforeBreadcrumb(), sendDefaultPii: false, ... })`.
  3. Remove the `try/catch` + `@ts-expect-error` guards from `src/instrumentation.ts` that Plan 01-03 added as pre-dependency scaffolding.
- Plan 05b does NOT need to re-read this SUMMARY — the module's public surface is self-documenting via the exports and 15 tests.

**Ready for Plan 01-07 (Diagnostics routes):**

- The synthetic `/api/v1/identifications/_diag-synth` route that Plan 07 adds will automatically trigger the body-drop rule here (because `_diag-synth` is a subpath of `identifications`). Any Sentry event captured during a 07-synthetic identification will arrive at Sentry with `request.data === undefined` — LGPD-13 compliant out of the box.

**Ready for every future Sentry event in the application:**

- Server-side route handlers (Phase 2+), client-side errors (Phase 3+), background Inngest work (Phase 6+) — all will funnel through `makeBeforeSend()` after Plan 05b wires the init files. This single module is the only place to edit if PRD §13.7 is ever amended (new forbidden field, new path pattern).

## TDD Gate Compliance

Required sequence verified:

- **RED gate:** `635a8c5 test(01-05a): add failing test for Sentry LGPD-13 scrub helpers (RED)` — first `01-05a` commit, test-only, with documented module-resolution failure mode.
- **GREEN gate:** `7e5bf12 feat(01-05a): implement Sentry LGPD-13 scrub helpers (GREEN)` — second `01-05a` commit, implementation-only, with documented 15/15 test pass + typecheck pass.
- **REFACTOR gate:** intentionally skipped per plan's explicit allowance ("no refactor needed — GREEN is minimal"). Documented here as the deliberate decision rather than an omission.

`git log --oneline | grep -E "01-05a" | wc -l` → 2 (acceptance criterion "≥2" met).

## Self-Check

Files created verified against disk:

- `src/shared/telemetry/sentry-scrub.ts` — FOUND (94 lines). `grep -q "export const SCRUB_FIELDS"` OK. `grep -q "IDENTIFICATION_PATH"` OK. `grep -q "export function makeBeforeSend"` OK. `grep -q "export function makeBeforeBreadcrumb"` OK. `grep -q "export function scrubHeaders"` OK. `grep -q "export function scrubObject"` OK. `grep -q "as const"` OK. `grep -c "^export"` → 5.
- `tests/unit/sentry-scrub.test.ts` — FOUND (185 lines). 7 `describe` blocks, 15 `it` tests. Imports from `@shared/telemetry/sentry-scrub` (all 5 exports). Zero `any` (project lint-clean).

Commits verified present in `git log`:

- `635a8c5` (test 01-05a RED)
- `7e5bf12` (feat 01-05a GREEN)

Runtime verification:

- `pnpm exec vitest run tests/unit/sentry-scrub.test.ts --project=unit` → 1 file / 15 tests passed (Duration ~106ms).
- `pnpm exec vitest run --project=unit` → 6 files / 116 tests passed (no regressions in scaffold/errors/env/env-example tests from Plans 01-01..02).
- `pnpm typecheck` → exit 0.
- `git log --oneline | grep -E "01-05a" | wc -l` → 2 (≥2, acceptance criterion met).

## Self-Check: PASSED

---
*Phase: 01-foundation*
*Completed: 2026-04-24*
