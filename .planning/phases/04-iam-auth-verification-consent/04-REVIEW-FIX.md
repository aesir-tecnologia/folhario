---
phase: 04-iam-auth-verification-consent
fixed_at: 2026-04-29T01:55:00Z
review_path: .planning/phases/04-iam-auth-verification-consent/04-REVIEW.md
iteration: 1
findings_in_scope: 17
fixed: 15
skipped: 2
status: partial
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-04-29T01:55:00Z
**Source review:** `.planning/phases/04-iam-auth-verification-consent/04-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 17 (2 Critical + 9 Warning + 6 Info, all severities per `fix_scope=all`)
- Fixed: 15
- Skipped: 2 (both Info; rationale per finding below)

**Verification:**

- `pnpm exec tsc --noEmit` — clean after every batch
- `pnpm exec vitest run --project=unit --project=unit-dom` — 525/525 passed (35 files)
- Integration + e2e suites NOT run (require live Supabase + Playwright host); deferred to verifier phase

**Worktree note:** Worktree isolation skipped — `main` was already checked out in the foreground tree and the workflow ran synchronously, so the spec's parallel-edit guard does not apply. All 15 commits land on `main` directly (advisor-confirmed).

## Fixed Issues

### CR-01: Production token leak via Resend dev fallback when `RESEND_API_KEY` empty

**Files modified:** `src/shared/config/server-env.ts`, `src/contexts/notifications/infrastructure/resend-adapter.ts`, `src/contexts/notifications/inngest/functions.ts`, `tests/integration/notifications-send-email.integration.test.ts`
**Commit:** `5f4a7f2`
**Applied fix:** Two-layer mitigation —
1. `serverSchema.RESEND_API_KEY` is now `z.string().min(1)` when `NODE_ENV === "production"`; `optional()` elsewhere.
2. `resendAdapter.send` throws in production if `resend` is null (defense in depth); in dev it logs only `{from, to, subject, templateName, devFallback: true}` — no rendered HTML, so token URLs cannot leak. Added `templateName` parameter and threaded it through `notifications-send-email`. Updated the dev-fallback integration test to assert `/auth/verify?token=` and `<html` are absent from any logged argument.

### CR-02: Change-password client-side validation shows wrong error copy

**Files modified:** `src/messages/pt-BR.json`, `src/contexts/iam/api/components/change-password-form.tsx`
**Commit:** `74610ba`
**Applied fix:** Added `passwordTooShort` and `passwordsDontMatch` keys under `settings.account.changePassword.errors` (mirroring `auth.reset.errors` strings). Updated `ChangePasswordForm`'s two client-side guards to reference `errors.passwordTooShort` and `errors.passwordsDontMatch` respectively instead of both pointing at `errors.currentIncorrect`.
**Note:** Per `verification_strategy`'s logic-bug clause, this is **`fixed: requires human verification`** — the keys are correct in theory but a human should glance at the rendered form to confirm the new copy displays as expected.

### WR-01: `current-user.ts` factory bypasses AuthAdapter Proxy singleton

**Files modified:** `src/contexts/iam/application/current-user.ts`
**Commit:** `2a79f97`
**Applied fix:** Replaced `createAuthAdapter()` factory call inside `adapter()` with the lazy Proxy singleton `authAdapter` exported from `auth-adapter.ts:312-317`. The `__setCurrentUserAdapterForTests` seam is preserved.

### WR-02: `adminDeleteUser` swallows compensating-delete failures with no Sentry path

**Files modified:** `src/contexts/iam/infrastructure/auth/auth-adapter.ts`
**Commit:** `6a527df`
**Applied fix:** Replaced `.catch(() => {})` with explicit `try/catch` capturing the rejection, calling `Sentry.captureException(err, { tags: { context: "iam.compensating_delete" }, extra: { userId } })` and falling back to `console.error` so the operator-action signal isn't lost. Imported `* as Sentry from "@sentry/nextjs"` (matches the established pattern in `src/contexts/catalog/infrastructure/photo-storage.ts`).

### WR-03: `requestPasswordReset` wraps single-statement work in `db.transaction` (no atomicity gain)

**Files modified:** `src/contexts/iam/application/request-password-reset.ts`
**Commit:** `a61ae02`
**Applied fix:** Removed the `db.transaction((tx) => mintResetToken(..., tx))` wrapper and the now-unused `db` import. `mintResetToken` already invokes `revokeUnusedResetTokens` then INSERTs on the same connection — no atomicity gain from the outer wrap. Updated header comment explaining why.

### WR-04: Signup timing leak undermines anti-enumeration claim

**Files modified:** `src/app/api/v1/iam/signup/route.ts`
**Commits:** `884a05c` (initial 500ms floor), `c102790` (advisor follow-up: lower to 200ms)
**Applied fix:** Added a constant baseline floor (`ANTI_ENUMERATION_BASELINE_MS = 200`) on the route side. `padToBaseline(startedAtMs)` runs `await new Promise(r => setTimeout(r, remaining))` with `remaining = 200 - (Date.now() - startedAtMs)` only on the `already_registered` branch (after the welcome-back `inngest.send`). The `created` path (~500ms-2s natural latency) is never padded. Review's option (b): bounded gap, not a thin async wrapper.

The initial commit used 500ms; advisor flagged a paradox-inversion risk (if the created path's warm-cache p95 ever drops below 500ms, `already_registered` becomes consistently slower — a different enumeration signal). The follow-up commit lowered the floor to 200ms (matching the review's "spread < 200ms when Supabase responds in <100ms" hint) so the floor stays reliably below the created floor across environments.
**Note:** **`fixed: requires human verification`** — timing math is logic-sensitive. The verifier should confirm production p95 for the `created` path stays above 200ms; if not, the floor either needs to drop further or the route needs a different mitigation strategy.

### WR-05: `oauth-complete` and `signup` run multi-write transactions outside `withUnitOfWork`

**Files modified:** `src/contexts/iam/application/oauth-complete.ts`, `src/contexts/iam/application/signup.ts`
**Commit:** `9ee19e3`
**Applied fix:** Per the review's recommended split (advisor-confirmed) —
- `oauth-complete.ts`: switched `db.transaction(async (tx) => { ... })` to `withUnitOfWork(input.userId, async (tx) => { ... })`. The OAuth user is authenticated by this point, so binding `request.jwt.claim.sub` is safe and engages RLS as defense in depth.
- `signup.ts`: deliberately NOT wrapped — added a documenting comment explaining that `auth.users` was just minted, no JWT exists on the caller, and `public.users` INSERT must run as service-role (not as `authenticated`, which is what `withUnitOfWork`'s `set local role` would switch to).

### WR-06: Already-registered signup path redirects to `/` with no session

**Files modified:** `src/contexts/iam/api/components/signup-form.tsx`
**Commit:** `2b96891`
**Applied fix:** Changed `onSuccess: () => router.push("/")` to `onSuccess: () => router.push("/auth/forgot-password?from=signup")`. Both `created` and `already_registered` 200 responses now route to a destination matching the response message ("Conta criada — verifique seu email"), avoiding the `(authed)` layout's bounce-to-`/auth/login`.

### WR-07: Logout route accepts no-body POST without verifying the auth gate

**Files modified:** `src/app/api/v1/iam/logout/route.ts`, `src/shared/api/throttle.ts`
**Commit:** `7474d5e`
**Applied fix:** Wrapped the route in `withThrottle(request, "logout", "always", ...)` and added a `Content-Type: application/json` check (returns `validation_failed` otherwise). Cross-site `<form>` POSTs cannot set `application/json` without preflight, so this short-circuits drive-by CSRF logouts. Added `"logout"` to the `ThrottleEndpoint` registry. Both existing logout E2E tests already send `application/json`, so they continue to pass.

### WR-08: Diagnostics endpoints gate is `NEXT_PUBLIC_*` flag

**Files modified:** `src/shared/config/server-env.ts`, `src/app/api/v1/diagnostics/iam-test-helpers/{seed-verified-user,seed-oauth-incomplete-user,latest-token,latest-reset-token}/route.ts`, `src/app/(test)/modal-sheet/page.tsx`, `playwright.config.ts`, `.env.example`
**Commits:** `393a5c9` (rename), `1a85aa5` (.env.example hygiene)
**Applied fix:** Renamed `NEXT_PUBLIC_ENABLE_TEST_ROUTES` → `ENABLE_TEST_ROUTES` (no `NEXT_PUBLIC_` prefix) in all 7 files. Added `ENABLE_TEST_ROUTES: optional(z.string().min(1))` to `serverSchema`. Per Next.js docs, only `NEXT_PUBLIC_*` is inlined into client bundles; `ENABLE_TEST_ROUTES` is server-side-only. Per advisor's scope warning, `(test)/modal-sheet/page.tsx` was included so the rename is global (otherwise it would still inline the old name into the client bundle and defeat the fix). Added the new key to `.env.example` (default empty) for dev visibility.

### WR-09: `auth-throttle.ts` re-lock window check ignores expired-but-still-set lockouts

**Files modified:** `src/contexts/iam/infrastructure/db/auth-throttle.ts`, `tests/integration/iam-throttle.integration.test.ts`
**Commit:** `93ad5cb`
**Applied fix:** Replaced `if (isLocked(row.count) && !existingLockout)` with `if (isLocked(row.count) && !lockoutInFuture)` where `lockoutInFuture = existingLockout !== null && existingLockout.getTime() > Date.now()`. Also normalized the returned `lockedUntil` to `null` when the recorded timestamp is already in the past, so callers don't see a stale "locked" signal. Added a DB-backed integration test that rewinds `locked_until` into the past mid-window then asserts the next `bumpThrottleRow` re-arms `locked_until` and `isCurrentlyLocked` flips back to true. Test lives in the integration suite (DB-backed) per advisor's reminder — `tests/unit/auth-throttle-math.test.ts` covers only the pure decision helpers.
**Note:** **`fixed: requires human verification`** — boolean-condition logic. The integration test asserts the new behavior; a human should confirm the test actually exercises the buggy path (it rewinds `locked_until` into the past then bumps within the same `window_start` bucket).

### IN-01: Dead `if (!result.ok) return` guards in signup-form + change-password-form

**Files modified:** `src/contexts/iam/api/components/signup-form.tsx`, `src/contexts/iam/api/components/change-password-form.tsx`
**Commit:** `6dc58a0`
**Applied fix:** Removed the trailing `if (!result.ok) return;` from both forms (no statement followed it). `useAuthForm`'s `onSuccess` callback only fires on a 2xx response so success-side effects are already gated correctly; `setError` on failure is handled inside `submit()`.

### IN-03: `trustGuard` condition in `signupUser` swallows ALL errors from `signInWithPassword`

**Files modified:** `src/contexts/iam/application/signup.ts`
**Commit:** `ba65e67`
**Applied fix:** Replaced bare `catch {}` with `catch (err) { ... }` that matches `err.message.includes("cookies")` for the expected outside-request-scope swallow (integration tests) and routes anything else to `Sentry.captureException(err, { tags: { surface: "signup.sessionMint" } })`. Imported `* as Sentry from "@sentry/nextjs"`.

### IN-05: `extractClientIp` falls back to `127.0.0.1`

**Files modified:** `src/contexts/iam/infrastructure/db/auth-throttle.ts`
**Commit:** `28b46bf`
**Applied fix:** Added a JSDoc block to `extractClientIp` documenting the intentional CI/test-fixture behavior (vitest + Playwright Requests have no `x-forwarded-for`) and the self-hosted footgun (one tripped lockout collapses every IP-less caller onto a single bucket). Per the review, this is "accepted CI/test fixture pattern but a footgun in self-hosted deployments" — the comment makes the trade-off explicit. We run on Vercel today; the self-hosted concern is documented for the next reviewer.

### IN-06: `seed-oauth-incomplete-user` route bypasses AuthAdapter boundary

**Files modified:** `src/app/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user/route.ts`
**Commit:** `ad057fb`
**Applied fix:** Replaced `createClient(...)` + `admin.auth.admin.createUser(...)` with `authAdapter.createUser({ email, password })`, mirroring the peer route `seed-verified-user/route.ts:65`. Removed the `@supabase/supabase-js` import. The adapter's `createUser` already calls `admin.createUser({ email_confirm: true })` so the shape matches exactly. Side benefit: now respects the env-driven JWKS override hooks.

## Skipped Issues

### IN-02: `mintToken` length encoded as `length(64)` but no migration check

**File:** `src/contexts/iam/infrastructure/db/schema.ts:261, 283`, `src/shared/crypto/tokens.ts:13`
**Reason:** `skipped: deferred to a focused migration PR`. The fix requires either widening `varchar(64)` columns to `varchar(128)` or adding a `CHECK (length(token_hash) = 64)` constraint — both demand a new Drizzle migration with `_journal.json` updates. For an Info-severity finding where the current code is correct (`mintToken` returns exactly 64 hex chars; client schemas pin `.length(64)`), the migration overhead exceeds the safety win in this batch. Recommend a dedicated migration PR alongside the next schema-level change. Advisor-confirmed.

### IN-04: Inngest `step.run` JSON-serializes the React element across boundaries

**File:** `src/contexts/notifications/inngest/functions.ts:27-29`
**Reason:** `skipped: deferred — adapter signature change requires coordinated update`. The fix changes `resendAdapter.send`'s parameter from `react: ReactElement` to `html: string` + `text?: string`, which ripples into `tests/unit/email-templates.test.ts` and any direct callers (and would require re-running `@react-email/components`'s `render()` outside the adapter). The current pattern works in practice because Inngest's in-process tick passes the React element through closure rather than serialization. Until an Inngest SDK upgrade actually moves the boundary to durable serialization (no signal it's imminent), the operational risk is theoretical. Recommend revisiting alongside the next Inngest version bump. Advisor-confirmed.

---

_Fixed: 2026-04-29T01:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
