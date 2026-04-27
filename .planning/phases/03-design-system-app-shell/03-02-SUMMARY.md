---
phase: 03-design-system-app-shell
plan: 02
subsystem: theme-system-i18n-fonts-heartbeat
tags: [theme-cookie, i18n, fonts, heartbeat, formatters, tdd, server-action, pwa]
dependency_graph:
  requires:
    - Plan 03-01 (Tailwind v4 @theme tokens, globals.css, vitest unit project)
  provides:
    - Theme Server Action setTheme/getTheme with allowlist guard (T-03-02-01 mitigated)
    - /api/v1/health/connectivity public heartbeat (T-03-02-02 mitigated)
    - pt-BR Intl formatters: formatCurrencyBRL, formatDate, formatTime, formatDateTime
    - ScientificName <i lang="la"> typography wrapper
    - src/messages/pt-BR.json with 34 Phase 3 leaf keys
    - Root layout: cookie-driven data-theme, next/font/google fonts, dual theme-color meta
  affects:
    - Plan 03-03/04/05: font variables, theme tokens, translations now available
    - Plan 04: useOnlineStatus polls /api/v1/health/connectivity (URL contract locked by test)
    - Plan 05: ScientificName ready for plant cards
tech_stack:
  added:
    - next/font/google (Source_Serif_4, Plus_Jakarta_Sans — already in next package, no new dep)
  patterns:
    - Server Action "use server" with allowlist-guarded cookie write (no revalidatePath)
    - Intl.* pt-BR formatters with UTC timeZone pin in formatDate to prevent TZ drift in tests
    - TDD RED/GREEN commit discipline for Tasks 1-3
    - Theme cookie folhario_theme validated at both write (setTheme) and read (getTheme)
key_files:
  created:
    - src/shared/theme/use-theme.ts
    - src/shared/i18n/format.ts
    - src/shared/typography/scientific-name.tsx
    - src/app/api/v1/health/connectivity/route.ts
    - tests/unit/use-theme.test.ts
    - tests/unit/format.test.ts
    - tests/unit/heartbeat-route-contract.test.ts
    - tests/unit/messages-coverage.test.ts
  modified:
    - src/app/layout.tsx (fonts, getTheme, dual theme-color meta, globals.css import, viewport)
    - src/messages/pt-BR.json (populated from {} to 34 keys)
decisions:
  - "formatDate uses explicit day/month/year + timeZone:UTC instead of dateStyle:short to prevent TZ-drift off-by-one when input is ISO date-only string (e.g. '2026-04-26')"
  - "formatTime uses explicit hour/minute/hour12:false instead of timeStyle:short — ICU timeStyle:short can inject comma in pt-BR depending on version"
  - "Intl.NumberFormat pt-BR uses NBSP (U+00A0) between R$ and digits; test normalizes with / /g replace so assertion is ICU-version-agnostic"
  - "Open Risk #4 honored: getTheme() called only in src/app/layout.tsx (root); plan documents that Plan 04 must not add a competing read in (app)/layout.tsx"
  - "Tailwind class line-wrapping on <html className> fixed to multi-line per better-tailwindcss/enforce-consistent-line-wrapping (0 errors, 0 warnings after fix)"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 6
  tasks_total: 6
  files_created: 8
  files_modified: 2
---

# Phase 3 Plan 2: Theme System + i18n + Fonts + Connectivity Heartbeat Summary

Theme cookie Server Action with allowlist guard (T-03-02-01), public /api/v1/health/connectivity heartbeat (T-03-02-02), pt-BR Intl formatters, ScientificName wrapper, root layout extended with next/font/google fonts + dual PWA theme-color meta, and 34-key pt-BR.json translation catalog gated by coverage test.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Failing tests for use-theme.ts | f6dff0e | tests/unit/use-theme.test.ts |
| 1 (GREEN) | Theme cookie Server Action with allowlist guard | 4070cc5 | src/shared/theme/use-theme.ts |
| 2 (RED) | Failing tests for pt-BR Intl formatters | 881f5cb | tests/unit/format.test.ts |
| 2 (GREEN) | pt-BR Intl formatters | 01c190e | src/shared/i18n/format.ts |
| 3 (RED) | Failing heartbeat contract test | 79bd4a3 | tests/unit/heartbeat-route-contract.test.ts |
| 3 (GREEN) | /api/v1/health/connectivity heartbeat | 65e88e3 | src/app/api/v1/health/connectivity/route.ts |
| 4 | Root layout extended | ce040a7 | src/app/layout.tsx |
| 5 | ScientificName typography wrapper | c5603cd | src/shared/typography/scientific-name.tsx |
| 6 | pt-BR.json + messages-coverage.test.ts | 983a2b5 | src/messages/pt-BR.json, tests/unit/messages-coverage.test.ts |
| lint fix | layout.tsx class line-wrapping | 28180cf | src/app/layout.tsx |

## D-30 Heartbeat URL Reaffirmation

The heartbeat URL is `/api/v1/health/connectivity` (Cross-Cutting Truth #12). The route lives at `src/app/api/v1/health/connectivity/route.ts`. The test in `tests/unit/heartbeat-route-contract.test.ts` imports from `../../src/app/api/v1/health/connectivity/route` — any rename of this path will immediately break the import and fail CI. Plan 04's `use-online-status.ts` must assert this literal string.

## Threat Mitigations Verified

### T-03-02-01: Cookie Injection (Tampering)

**Mitigation:** Allowlist `["auto", "light", "dark"]` enforced at both write and read:
- `setTheme(value)` throws `Error("Invalid theme value: ...")` for any non-allowlist input
- `getTheme()` returns `"auto"` fallback when cookie value is not in allowlist

**Tests:** `tests/unit/use-theme.test.ts` — 8 test cases:
- `setTheme("malicious'; DROP TABLE--")` rejects
- `setTheme(undefined as never)` rejects
- `getTheme()` with `{ value: "<script>alert(1)</script>" }` returns `"auto"`
- `setTheme` does NOT call `revalidatePath` (Open Risk #4)

### T-03-02-02: Info Disclosure (heartbeat)

**Mitigation:** Body shape is exactly `{ ok: true, timestamp: <ISO> }` — no `env` field, no per-user data, no Sentry/PostHog.

**Tests:** `tests/unit/heartbeat-route-contract.test.ts` — 5 test cases including:
- `Object.keys(body).sort()` equals `["ok", "timestamp"]` exactly
- No `POST`/`PUT`/`DELETE`/`PATCH` exports

## Open Risk #4 Verification

`getTheme()` is called in `src/app/layout.tsx` (root layout, line ~37). It is NOT called in any child layout. Confirmed by:
```bash
grep -r "getTheme" src/  # Only src/app/layout.tsx and src/shared/theme/use-theme.ts
```

Plan 04 must not add a competing `getTheme()` call in `src/app/(app)/layout.tsx` — only the root re-renders on cookie write.

## next/font/google Source_Serif_4 Config

`Source_Serif_4` and `Plus_Jakarta_Sans` accepted `subsets: ["latin", "latin-ext"]` cleanly with no additional axes config needed. Both fonts configured with `display: "swap"` and `variable` CSS custom property names that wire into `globals.css` `@theme` block (`--font-source-serif`, `--font-plus-jakarta`).

## pt-BR.json Final State

- **34 leaf string values** (all required keys + all populated)
- **0 placeholder/TODO values** — all strings are production-ready pt-BR copy
- Coverage test gates all 34 keys in `tests/unit/messages-coverage.test.ts`

## Stylelint globals.css @theme Font-Family Carve-out

Stylelint did NOT flag `serif`, `system-ui`, or `sans-serif` fallbacks in `globals.css` `@theme` block. The font-family ban list covers Inter/Times/Georgia/Garamond/Palatino only — not generic family keywords. No carve-out or inline disable comment was needed. (Confirmed in Plan 03-01 SUMMARY.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] formatDate UTC timezone fix for ISO date-only strings**

- **Found during:** Task 2 GREEN (test failure: "2026-04-26" → "25/04/2026" in UTC-offset timezone)
- **Issue:** `new Date("2026-04-26")` parses as UTC midnight; `dateStyle: "short"` renders in local TZ, shifting the date back 1 day in negative-UTC offset environments
- **Fix:** Changed `formatDate` from `{ dateStyle: "short" }` to explicit `{ day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }` — forces date components in UTC, eliminating TZ drift for date-only inputs
- **Files modified:** src/shared/i18n/format.ts
- **Commit:** 01c190e

**2. [Rule 1 - Bug] Intl.NumberFormat NBSP normalization in formatCurrencyBRL test**

- **Found during:** Task 2 GREEN (test failure: "R$ 0,00" expected but received with U+00A0)
- **Issue:** The plan's test used `.replace(/ /g, " ")` with a regular space in the regex, but Node.js ICU formats `pt-BR` currency with NBSP (U+00A0) between "R$" and digits. The regex didn't match NBSP.
- **Fix:** Updated the test's regex to embed the actual U+00A0 character (written directly as the NBSP character in the source file)
- **Files modified:** tests/unit/format.test.ts
- **Commit:** 01c190e

**3. [Rule 1 - Bug] Tailwind class line-wrapping warning in layout.tsx**

- **Found during:** Post-task lint verification
- **Issue:** `better-tailwindcss/enforce-consistent-line-wrapping` warned on the single-line font variable template literal in `<html className={...}>`
- **Fix:** Split template literal to multi-line format per plugin expectation
- **Files modified:** src/app/layout.tsx
- **Commit:** 28180cf

## Known Stubs

None — all strings in pt-BR.json are real pt-BR copy, not placeholders. All components are functional. No data flows are stubbed.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-public-endpoint | src/app/api/v1/health/connectivity/route.ts | New unauthenticated GET endpoint. Mitigated: side-effect-free, no DB, no telemetry, DoS accepted per T-03-02-03 (Vercel edge rate-limits; plan 12 hardening). |

## TDD Gate Compliance

| Task | RED Commit | GREEN Commit | Status |
|------|-----------|-------------|--------|
| 1 (use-theme) | f6dff0e `test(03-02): add failing tests for theme cookie...` | 4070cc5 `feat(03-02): implement theme cookie...` | PASS |
| 2 (format.ts) | 881f5cb `test(03-02): add failing tests for pt-BR Intl...` | 01c190e `feat(03-02): implement pt-BR Intl...` | PASS |
| 3 (heartbeat) | 79bd4a3 `test(03-02): add failing contract test for...` | 65e88e3 `feat(03-02): implement /api/v1/health/connectivity...` | PASS |

## Self-Check: PASSED

Files created/exist:
- src/shared/theme/use-theme.ts: FOUND
- src/shared/i18n/format.ts: FOUND
- src/shared/typography/scientific-name.tsx: FOUND
- src/app/api/v1/health/connectivity/route.ts: FOUND
- tests/unit/use-theme.test.ts: FOUND
- tests/unit/format.test.ts: FOUND
- tests/unit/heartbeat-route-contract.test.ts: FOUND
- tests/unit/messages-coverage.test.ts: FOUND
- src/messages/pt-BR.json: FOUND
- src/app/layout.tsx: FOUND (modified)

Commits verified in git log:
- f6dff0e: test(03-02): add failing tests for theme cookie Server Action with allowlist guard
- 4070cc5: feat(03-02): implement theme cookie Server Action with allowlist guard (T-03-02-01 mitigation)
- 881f5cb: test(03-02): add failing tests for pt-BR Intl formatters (UI-23)
- 01c190e: feat(03-02): implement pt-BR Intl formatters (UI-23)
- 79bd4a3: test(03-02): add failing contract test for /api/v1/health/connectivity heartbeat
- 65e88e3: feat(03-02): implement /api/v1/health/connectivity heartbeat (T-03-02-02 guard)
- ce040a7: feat(03-02): extend root layout with theme cookie, fonts, dual theme-color meta, globals.css
- c5603cd: feat(03-02): create ScientificName typography wrapper
- 983a2b5: feat(03-02): populate pt-BR.json with 34 Phase 3 keys + messages-coverage gate
- 28180cf: style(03-02): fix Tailwind class line-wrapping in layout.tsx

End-to-end gates:
- pnpm exec vitest run --project=unit --project=unit-dom: 271 tests PASS (20 test files)
- tsc --noEmit: EXIT 0 (typecheck PASS)
- eslint on all new/modified src files: 0 errors, 0 warnings
- pt-BR.json: 34 leaf keys (>= 30 required)
- TDD gates: RED commits precede GREEN commits for Tasks 1, 2, 3
