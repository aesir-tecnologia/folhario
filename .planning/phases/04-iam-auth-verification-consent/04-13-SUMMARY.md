---
phase: 04-iam-auth-verification-consent
plan: 13
subsystem: iam
tags: [inngest, sentry, observability, gap-closure, uat]
dependency_graph:
  requires:
    - 04-06 (signup orchestration — signup.ts, route.ts)
    - 04-08 (resend-verification use-case)
    - 04-09 (oauth-complete route)
  provides:
    - Signup write-path decoupled from Inngest delivery fault
    - Bare catches in signup, resend-verification, oauth-complete routes replaced with Sentry capture
    - INNGEST_DEV=1 forced in pnpm dev script
  affects:
    - UAT Gap 2 (POST /api/v1/iam/signup 500 in 3.1s)
    - UAT Gap 3 (partner-code signup same root cause)
tech_stack:
  added: []
  patterns:
    - try/catch wrapping inngest.send with Sentry.captureException for operator visibility
    - INNGEST_DEV=1 npm script prefix (mirrors playwright.config.ts)
key_files:
  created: []
  modified:
    - package.json
    - .env.example
    - src/contexts/iam/application/signup.ts
    - src/contexts/iam/application/resend-verification.ts
    - src/app/api/v1/iam/signup/route.ts
    - src/app/api/v1/iam/resend-verification/route.ts
    - src/app/api/v1/iam/oauth/complete/route.ts
decisions:
  - INNGEST_DEV=1 added to `dev` npm script (not cross-env) — Unix-only acceptable for current dev stack
  - inngest.send wrapped in try/catch rather than fire-and-forget (void) to preserve error visibility via Sentry
  - password/reset-request/route.ts deliberately NOT touched — D-11 anti-enumeration bare catch is intentional
metrics:
  duration: ~7 minutes
  completed: 2026-04-29
---

# Phase 4 Plan 13: Inngest Dev-Mode Fix + Bare-Catch Observability Summary

**One-liner:** Two-layer UAT gap closure — INNGEST_DEV=1 forced in pnpm dev + inngest.send decoupled from signup/resend write-paths via try/catch with Sentry surface tags.

## Status

Tasks 1-3 complete (automated). Task 4 awaiting human verification (checkpoint:human-verify).

## What Was Built

**Objective:** Close UAT Gaps 2 and 3 — POST /api/v1/iam/signup returned 500 in ~3.1s for both organic and partner-code paths because `await inngest.send(...)` threw (Inngest SDK retrying cloud delivery 5× with exponential backoff against a placeholder event key), and the bare `catch {}` in the route handler swallowed the error.

### Layer 1: Operational Fix (Task 1)

`package.json` dev script changed from `"next dev"` to `"INNGEST_DEV=1 next dev"`. This forces the Inngest SDK into dev mode, where it routes events to a local `inngest-cli dev` server when one is running, or no-ops gracefully when none is running. This mirrors `playwright.config.ts:77` (which already set INNGEST_DEV=1 in the Playwright webServer env — the "Mirrors `pnpm dev` behavior" comment in that file was aspirational before this plan shipped; it is now accurate).

`.env.example` gains a documented `INNGEST_DEV=` entry with an operator guidance comment block explaining when to set it manually (for `next start` runs without a real `INNGEST_EVENT_KEY`), referencing `.planning/debug/signup-route-500.md` for the full diagnosis.

### Layer 2: Architectural Fix (Tasks 2 and 3)

All `inngest.send` calls in the signup and resend-verification write-paths are wrapped in try/catch with `Sentry.captureException`. The bare `catch {}` blocks in the signup, resend-verification, and oauth-complete route handlers are replaced with named-error catches that Sentry-capture the error before returning the same closed-registry 500 response (D-31).

**Key guarantee:** A successful DB transaction is never rolled back into a 500 by an email-dispatch fault. The user's `auth.users`, `public.users`, `consent_logs`, `subscriptions`, and `email_verification_tokens` rows are persisted regardless of Inngest delivery outcome. The user can use "Reenviar e-mail" (per-user 1/min throttle) to retry the email path independently.

## Sentry Surface Tags Introduced

For ops handoff — these tags identify the failure surface on every Sentry event:

| Tag | File | Trigger |
|-----|------|---------|
| `iam.signup.notify` | signup.ts | inngest.send for verification email fails |
| `iam.signup.welcomeBack` | signup/route.ts | inngest.send for welcome-back email fails |
| `iam.signup.route` | signup/route.ts | any uncaught error in the signup application call |
| `iam.resendVerification.notify` | resend-verification.ts | inngest.send for resend email fails |
| `iam.resendVerification.route` | resend-verification/route.ts | any uncaught error in the resend application call |
| `iam.oauthComplete.route` | oauth/complete/route.ts | any uncaught error in the oauth-complete application call |

## D-11 Anti-Enumeration Silence Preserved

`src/app/api/v1/iam/password/reset-request/route.ts` was deliberately NOT touched. Its bare catch around `inngest.send` (lines 61-65) is the D-11 anti-enumeration posture — the always-200 response must be identical regardless of dispatch outcome, and the "Swallow: anti-enumeration" comment documents this explicitly.

Static verification: `git diff --stat src/app/api/v1/iam/password/reset-request/route.ts` shows zero changes (byte-equivalent). Grep gate confirms the anti-enumeration comment is present.

Note for Phase 12: The D-11 timing + integration behavioral suites (`iam-password-reset-route-timing.integration.test.ts`, `iam-password-reset.integration.test.ts`) run in CI against a live DB where they will confirm the runtime behavior.

## Note for Phase 12 Deploy

Production env MUST set a real `INNGEST_EVENT_KEY` (obtained from the Inngest cloud dashboard). `INNGEST_DEV` MUST NOT be set in production — it would cause all Inngest events to no-op silently, breaking verification emails, password reset, and all future async flows. The `.env.example` comment block documents this constraint explicitly.

## playwright.config.ts Comment Correction (retroactive, no code change)

The comment at `playwright.config.ts:71-77` reads "Mirrors `pnpm dev` behavior." Before this plan shipped, that comment was incorrect — `pnpm dev` did NOT set INNGEST_DEV=1, which is exactly why this gap existed. After Task 1, the comment is now accurate. The comment text itself is NOT changed (out of scope for this plan), but this note provides the audit trail.

## UAT Tests 2+3 Reproduction Outcome

Status: **Awaiting human verification** (Task 4 checkpoint:human-verify).

Reproduction steps are documented in Task 4 of `04-13-PLAN.md`. Expected outcomes:
- Test 2 (organic signup): 200 in <1s, UnverifiedBlocker visible, DB rows persisted
- Test 3 (partner-code signup): 200 in <1s, trial_source='partner', trial_end_date ≈ now+30d

## Deviations from Plan

None — plan executed exactly as written. The welcome-back inngest.send wrap in signup/route.ts was in the plan action steps (step 2b) and executed as specified. Sentry was already imported in signup.ts (correct per plan's step 2 note). All four new files that needed Sentry added received it.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| Task 1 | Force INNGEST_DEV=1 in pnpm dev + document .env.example | 426653f |
| Task 2 | Decouple inngest.send from signup write-path + replace bare catch | 55fb177 |
| Task 3 | Wrap resend-verification inngest.send + replace bare catches in resend and oauth routes | a67c7b3 |

## Known Stubs

None introduced by this plan.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The Sentry surface tags carry only structural metadata (tokenId, surface name); the existing LGPD-13 scrub module at `src/shared/telemetry/sentry-scrub.ts` already drops `email` before Sentry egress (T-04-13-01 in the plan threat register).
