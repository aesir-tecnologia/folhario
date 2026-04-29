---
status: resolved
trigger: "POST /api/v1/iam/signup returns 500 after ~3s of application code execution"
created: 2026-04-28T00:00:00Z
updated: 2026-04-29T00:00:00Z
resolved: 2026-04-29T00:00:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Local `pnpm dev` does not set `INNGEST_DEV=1`, and the user's `.env` contains the placeholder `INNGEST_EVENT_KEY=\"your-event-key\"` from `.env` template. The Inngest SDK therefore evaluates `mode === 'cloud'` AND `eventKeySet() === true` (because the placeholder string is truthy) — so it bypasses the fast-fail at Inngest.js:505 and instead executes a real outbound HTTP POST to the Inngest cloud (`/e/your-event-key`). That request fails with 401 'Event key not found', is retried 5 times with exponential backoff (100→200→400→800ms = ~1.5s of waiting + 4 network round trips ≈ 3.1s total), then throws. The thrown error propagates from `await inngest.send` in signup.ts:139 to the bare `catch {}` in route.ts:99-101, which emits the pt-BR generic 500 message 'Não foi possível concluir agora.'"
  confirming_evidence:
    - "src/contexts/iam/application/signup.ts:139 — `await inngest.send(...)` is awaited inline AFTER tx commit, so a thrown error propagates synchronously up to the route handler."
    - "src/app/api/v1/iam/signup/route.ts:99-101 — bare `catch {}` swallows the original error and emits exactly `errorResponse(ErrorCode.InternalError, \"Não foi possível concluir agora.\")` matching the user's verbatim message."
    - "src/shared/inngest/client.ts:5-9 — Inngest client is created with no `isDev` option; mode evaluates from env vars only."
    - "src/shared/config/server-env.ts has NO `INNGEST_DEV` field — the var is not even validated/declared at the app level."
    - "node_modules/inngest/components/Inngest.js:222-228 — `mode` returns `'cloud'` when neither `options.isDev` nor `INNGEST_DEV` env nor `explicitDevUrl` is set."
    - "node_modules/inngest/components/Inngest.js:505-509 — fast-fail throw ONLY fires when `eventKeySet() === false`; `eventKeySet()` (line 270-272) is `eventKey !== undefined`, so any non-empty value (including the literal placeholder `\"your-event-key\"`) bypasses fast-fail and triggers the cloud HTTP path."
    - "node_modules/inngest/components/Inngest.js:511-535 — cloud path uses `retryWithBackoff` with maxAttempts=5, baseDelay=100ms; backoff math: 100+200+400+800 = ~1.5s of sleep + 4-5 network attempts ≈ user-reported 3.1s."
    - "/Users/machado/Projects/folhario/.env:22 contains the literal placeholder `INNGEST_EVENT_KEY=\"your-event-key\"`."
    - "/Users/machado/Projects/folhario/.env.local does NOT define `INNGEST_EVENT_KEY` (no key present), so Next.js dev falls through to `.env`'s placeholder."
    - "package.json `dev` script is bare `next dev` — no `INNGEST_DEV=1` prefix; no shell wrapper sets it either."
    - "playwright.config.ts:71-77 explicitly documents this exact failure mode: 'with no INNGEST_EVENT_KEY set, the Inngest SDK under NODE_ENV=production tries to deliver to the Inngest cloud and any route that calls `inngest.send` (signup, forgot-password, oauth-complete, etc.) 500s when delivery fails. Forcing INNGEST_DEV=1 routes events to the local dev server.' The fix was applied to Playwright's runtime env but NOT to the developer's `pnpm dev` runtime."
  falsification_test: "Set `INNGEST_DEV=1` in `.env.local` (or run `INNGEST_DEV=1 pnpm dev`) and re-submit the signup form. If hypothesis is correct: 200 response, no 3s delay. If hypothesis is wrong: still 500 after some delay → another root cause exists."
  fix_rationale: "The fix is the Playwright fix applied to the developer/Vercel runtime: set `INNGEST_DEV=1` whenever `INNGEST_EVENT_KEY` is missing or unverified, OR equivalently make signup tolerate inngest.send failures (don't await, or wrap in try/catch with Sentry capture so signup itself remains atomic). The latter is preferred because it isolates email-delivery faults from account creation correctness — a transient Inngest outage in production should NOT 500 a successful signup. The route handler also needs to log/Sentry-capture the swallowed error rather than emitting a bare generic 500 (the bare catch-and-rethrow-as-500 in route.ts:99-101 hid this for hours and will hide future failures too)."
  blind_spots: "Did not actually run `pnpm dev` and submit a signup myself to confirm the timing. Did not verify the user's exact `.env.local` does not have a sneaky override I missed. Did not verify the order of .env loading in Next 16 specifically (assumed standard precedence: .env.local > .env). Did not check whether `getProcessEnv()` in Inngest reads from `process.env` at construction time vs lazily — but client.ts:5-9 constructs eagerly at module import, so process.env at server boot is what counts."

## Symptoms

expected: 200 with {kind:"created", userId, verificationUrl}, user lands on UnverifiedBlocker
actual: 500 "Não foi possível concluir agora.", ~3.1s of application-code time
errors: No specific stack trace surfaced (route handler's bare catch swallows it). 3.1s timing strongly indicates outbound HTTP retry loop (Inngest cloud delivery).
reproduction: POST /api/v1/iam/signup with valid body (organic OR partner_code), with `pnpm dev` and no INNGEST_DEV=1 in env
started: First exercise of endpoint by a human after Plans 04-06 (signup) and 04-10 (UI) shipped

## Eliminated

(none — first hypothesis confirmed)

## Evidence

- timestamp: 2026-04-28
  checked: src/app/api/v1/iam/signup/route.ts
  found: Bare `try/catch` at line 70-101; the catch (line 99) is bare `catch {}` — it does NOT inspect, log, or Sentry-capture the error. It unconditionally returns `errorResponse(ErrorCode.InternalError, "Não foi possível concluir agora.")`.
  implication: This is the source of the user's verbatim error message. Any thrown error inside `signupUser` produces this exact output. The bare catch is also a debugging anti-pattern — it will hide every future failure here too.

- timestamp: 2026-04-28
  checked: src/contexts/iam/application/signup.ts
  found: Line 139 `await inngest.send({ id: 'email-verification/...', name: 'notifications/email.requested', data: {...} })` runs AFTER the DB transaction commits. The result is awaited inline; any thrown error propagates up.
  implication: An Inngest delivery failure produces a 500 but the user record + consents + token + subscription are already committed in the DB. Worse than just being a UX bug — the auth.users row is also persisted (line 64-68), so a retry by the user gets `already_registered` (welcome-back path), but the user account never gets a verification email and is stuck.

- timestamp: 2026-04-28
  checked: src/shared/inngest/client.ts
  found: `new Inngest({ id: 'folhario', eventKey: serverEnv.INNGEST_EVENT_KEY, signingKey: serverEnv.INNGEST_SIGNING_KEY })` — no `isDev` flag, no `baseUrl` override.
  implication: Mode is determined by env vars only. With no `INNGEST_DEV` and a non-empty `INNGEST_EVENT_KEY`, mode is "cloud" (Inngest.js:222-228) and the SDK will try to deliver events to inngest.com.

- timestamp: 2026-04-28
  checked: src/shared/config/server-env.ts
  found: Schema defines INNGEST_EVENT_KEY (optional) and INNGEST_SIGNING_KEY (optional) but does NOT define INNGEST_DEV. There is no validation, no documentation, and no enforcement that dev environments set this.
  implication: Developers running `pnpm dev` have no env-validation cue that they need INNGEST_DEV=1. The variable is invisible in the codebase except for the Playwright config.

- timestamp: 2026-04-28
  checked: /Users/machado/Projects/folhario/.env (project root)
  found: Line 22: `INNGEST_EVENT_KEY="your-event-key"` — this is the literal placeholder template value, not a real key.
  implication: This makes `eventKeySet()` return true (Inngest.js:270-272 — only checks for `undefined`, not for placeholder values). The SDK proceeds with the cloud HTTP path against the real Inngest API and fails with 401 (Event key not found).

- timestamp: 2026-04-28
  checked: /Users/machado/Projects/folhario/.env.local (user's actual local config)
  found: No INNGEST_EVENT_KEY entry, no INNGEST_DEV entry. Only Supabase and DATABASE_URL bindings (auto-generated by `pnpm db:sync-env`).
  implication: Next.js dev loads .env.local first then .env. Without an override in .env.local, the placeholder from .env wins. INNGEST_EVENT_KEY at runtime is the truthy placeholder string.

- timestamp: 2026-04-28
  checked: package.json
  found: `"dev": "next dev"` — no env prefix. No shell wrapper script that injects INNGEST_DEV.
  implication: Running `pnpm dev` does not set INNGEST_DEV=1. There is no automation forcing dev-mode delivery.

- timestamp: 2026-04-28
  checked: playwright.config.ts:71-77
  found: Comment explicitly diagnoses this exact failure mode: "with no INNGEST_EVENT_KEY set, the Inngest SDK under NODE_ENV=production tries to deliver to the Inngest cloud and any route that calls `inngest.send` (signup, forgot-password, oauth-complete, etc.) 500s when delivery fails. Forcing INNGEST_DEV=1 routes events to the local dev server (npx inngest-cli dev) when one is running and no-ops otherwise. Mirrors `pnpm dev` behavior." Sets `INNGEST_DEV: "1"` in the Playwright webServer env.
  implication: The Plan 04-10 author was aware of this exact failure but only patched the Playwright runtime. The comment incorrectly claims this "Mirrors `pnpm dev` behavior" — `pnpm dev` does NOT set INNGEST_DEV either, so the bug exists in dev too. The Playwright fix masked the bug in CI but left it live for any developer/UAT user running `pnpm dev`.

- timestamp: 2026-04-28
  checked: node_modules/inngest/components/Inngest.js
  found:
    - Line 222-228: `mode` getter — returns "cloud" when no `options.isDev`, no `INNGEST_DEV` env, no `explicitDevUrl`.
    - Line 270-272: `eventKeySet()` — `return this.eventKey !== void 0` (treats placeholder strings as "set").
    - Line 505-509: fast-fail throw fires only when `mode === 'cloud' && !eventKeySet()`. With placeholder, this branch is skipped.
    - Line 511-535: cloud delivery path uses `retryWithBackoff` (helpers/promises.js:157-165) with maxAttempts=5, baseDelay=100ms; total ~1.5s of sleep + 4-5 attempts ≈ 3 seconds.
  implication: The user's reported 3.1s wait time matches the retry-loop math. After all retries fail, the underlying error (most likely 401 Event key not found from inngest.com) is thrown out of `_send`, propagates up to signup.ts:139, then to the route handler's bare catch.

- timestamp: 2026-04-29
  checked: git log + working tree (resume reconciliation)
  found: Plan 04-13 shipped the full fix in three commits before this resume executed — 426653f (operational: `INNGEST_DEV=1 next dev` + `.env.example` doc), 55fb177 (architectural: signup.ts wraps inngest.send for verification email with `iam.signup.notify` Sentry surface; signup/route.ts wraps welcome-back inngest.send with `iam.signup.welcomeBack` and replaces bare `catch {}` with named catch + `iam.signup.route` Sentry capture), a67c7b3 (mirror: same shape applied to resend-verification application + route, plus oauth/complete/route.ts bare-catch replacement). `password/reset-request/route.ts` deliberately untouched (D-11 anti-enumeration silence).
  implication: The session was created in diagnose-only mode; the user then ran the regular phase plan workflow (04-13) which executed all three branches of the fix_rationale (operational + architectural + bare-catch observability + mirror). This resume's job collapses to reconciling the stale debug file with the shipped state.

- timestamp: 2026-04-29
  checked: pnpm exec vitest run --project=unit tests/unit/iam-signup-schema.test.ts
  found: 21/21 pass. Integration suite (`tests/integration/iam-signup.integration.test.ts`) skipped in this shell because DATABASE_POOL_URL was not exported; plan 04-13 acceptance recorded these passing under the integration env.
  implication: Schema and request-shape contracts are intact post-fix. The architectural assertion ("inngest.send rejection does not propagate out of signupUser") is currently exercised only via plan 04-13 Task 4 manual UAT — see follow-up note in Resolution.

## Resolution

root_cause: |
  POST /api/v1/iam/signup throws because `await inngest.send(...)` in signup.ts:139 fails. The Inngest SDK's `mode` resolves to `"cloud"` (no `INNGEST_DEV=1` set in `pnpm dev` env), and `INNGEST_EVENT_KEY` is the placeholder `"your-event-key"` from the project root `.env` file. The placeholder is truthy so Inngest skips its missing-key fast-fail and instead retries cloud delivery 5× with exponential backoff (~3s total) before throwing. The thrown error is swallowed by a bare `catch {}` in route.ts:99-101 which emits a generic pt-BR 500 — masking the actual cause from logs and from the user.

  Two compounding bugs:
  1. **Operational**: `pnpm dev` does not force `INNGEST_DEV=1`, and the placeholder `INNGEST_EVENT_KEY` in `.env` defeats the SDK's "missing key" fast-fail. The Playwright config has the fix; `next dev` does not.
  2. **Architectural**: Email dispatch is awaited inline as part of the signup write path. A transient Inngest outage (or a misconfigured event key) 500s the entire signup even though the user, consents, and verification token are already committed in the DB. The user's account exists but they get an error and no verification email — irrecoverable without manual intervention.

  Additionally, the route handler's bare `catch {}` (route.ts:99-101) silently masks all errors with a generic 500 — making this issue invisible to logs/Sentry and prolonging diagnosis.

fix: |
  Shipped via plan 04-13 (`.planning/phases/04-iam-auth-verification-consent/04-13-PLAN.md`) in three commits on 2026-04-29:

  - **426653f** `fix(04-13): force INNGEST_DEV=1 in pnpm dev script + document env-example (UAT gap 2 quickwin)` — operational. `package.json:11` `"dev"` script changed from `next dev` to `INNGEST_DEV=1 next dev`; `.env.example` documents the variable with operator guidance pointing back at this debug file.
  - **55fb177** `fix(04-13): decouple inngest.send from signup write-path + replace bare catch with Sentry.captureException (UAT gap 2)` — architectural. `src/contexts/iam/application/signup.ts:149-165` wraps the verification email `inngest.send` in try/catch with `Sentry.captureException` (surface tag `iam.signup.notify`). `src/app/api/v1/iam/signup/route.ts:81-102` wraps the welcome-back `inngest.send` (surface tag `iam.signup.welcomeBack`); the bare `catch {}` at route.ts:99-101 is replaced with a named catch + `Sentry.captureException` (surface tag `iam.signup.route`). The malformed-JSON `} catch {` at route.ts:58 stays bare on purpose — it is a `validation_failed` 400 gate, not an operator signal.
  - **a67c7b3** `fix(04-13): wrap resend-verification inngest.send + replace bare catches in resend-verification and oauth-complete routes (UAT gap 2 mirror)` — same architectural pattern applied to `resend-verification` (application + route, surface tags `iam.resendVerification.notify` / `iam.resendVerification.route`) and to `oauth/complete/route.ts` (surface tag `iam.oauthComplete.route`). `password/reset-request/route.ts` deliberately untouched: its bare catch is intentional D-11 anti-enumeration silence and remains documented in place.

  Net effect: a successful DB transaction is never rolled back into a 500 by an email-dispatch fault; future Inngest faults surface to on-call via the named Sentry surface tags instead of being swallowed.

verification: |
  - `pnpm typecheck` clean (plan 04-13 acceptance, 2026-04-29).
  - `pnpm exec vitest run --project=unit tests/unit/iam-signup-schema.test.ts` — 21/21 pass (re-run during this resume on 2026-04-29).
  - `pnpm exec vitest run --project=unit tests/unit/env-example.test.ts` — pass (plan 04-13 Task 1 acceptance).
  - `pnpm exec vitest run --project=integration tests/integration/iam-signup.integration.test.ts` — pass under DATABASE_POOL_URL (plan 04-13 Task 2 acceptance; skipped in this resume's shell because the env var was not exported).
  - `pnpm exec vitest run --project=integration tests/integration/iam-password-reset-route-timing.integration.test.ts tests/integration/iam-password-reset.integration.test.ts` — pass; D-11 anti-enumeration timing + routing contract preserved (plan 04-13 Task 3 acceptance).
  - Manual UAT (plan 04-13 Task 4): organic and partner-code signups both return 200 in <1s with the UnverifiedBlocker visible and DB rows persisted (recorded in `04-13-PLAN.md` task summary).

  **Follow-up gap (closed 2026-04-29 by commit aeacc46):** Originally there was no automated regression for the architectural assertion "inngest.send rejection does NOT propagate out of signupUser / does NOT cause the route to 500" — the property was only exercised via manual UAT. Closed by `test(04-13): add inngest.send rejection regression for signup + resend-verification` (commit aeacc46), which added `inngestSendMock.mockRejectedValueOnce(...)` coverage in both `tests/integration/iam-signup.integration.test.ts` and a new `tests/integration/iam-resend-verification.integration.test.ts`. Each test asserts (1) the use-case returns its success shape (does NOT throw), (2) the email_verification_tokens row was persisted, (3) `Sentry.captureException` was invoked with the documented surface tag (`iam.signup.notify` / `iam.resendVerification.notify`) and `extra.tokenId` matching the persisted row. Falsified during authoring by removing the try/catch in `signup.ts` around `inngest.send` — the new test failed exactly as intended. 10/10 pass on the integration project at HEAD.

files_changed:
  - package.json
  - .env.example
  - src/contexts/iam/application/signup.ts
  - src/contexts/iam/application/resend-verification.ts
  - src/app/api/v1/iam/signup/route.ts
  - src/app/api/v1/iam/resend-verification/route.ts
  - src/app/api/v1/iam/oauth/complete/route.ts
