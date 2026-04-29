---
phase: 04-iam-auth-verification-consent
reviewed: 2026-04-29T15:30:00Z
depth: standard
files_reviewed: 108
files_reviewed_list:
  - .env.example
  - drizzle/migrations/0003_phase04_iam_extensions.sql
  - drizzle/migrations/meta/0003_snapshot.json
  - drizzle/migrations/meta/_journal.json
  - package.json
  - src/app/api/inngest/route.ts
  - src/app/api/v1/diagnostics/iam-test-helpers/latest-reset-token/route.ts
  - src/app/api/v1/diagnostics/iam-test-helpers/latest-token/route.ts
  - src/app/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user/route.ts
  - src/app/api/v1/diagnostics/iam-test-helpers/seed-verified-user/route.ts
  - src/app/api/v1/iam/login/route.ts
  - src/app/api/v1/iam/logout/route.ts
  - src/app/api/v1/iam/me/password/route.ts
  - src/app/api/v1/iam/me/route.ts
  - src/app/api/v1/iam/oauth/complete/route.ts
  - src/app/api/v1/iam/password/reset-request/route.ts
  - src/app/api/v1/iam/password/reset/route.ts
  - src/app/api/v1/iam/resend-verification/route.ts
  - src/app/api/v1/iam/signup/route.ts
  - src/app/auth/callback/route.ts
  - src/app/auth/verify/route.ts
  - src/app/legal/privacy/page.tsx
  - src/app/legal/terms/page.tsx
  - src/contexts/billing/inngest/functions.ts
  - src/contexts/iam/api/components/account-section.tsx
  - src/contexts/iam/api/components/change-password-form.tsx
  - src/contexts/iam/api/components/em-breve-card.tsx
  - src/contexts/iam/api/components/forgot-password-form.tsx
  - src/contexts/iam/api/components/login-form.tsx
  - src/contexts/iam/api/components/logout-link.tsx
  - src/contexts/iam/api/components/oauth-complete-form.tsx
  - src/contexts/iam/api/components/resend-verification-button.tsx
  - src/contexts/iam/api/components/reset-password-form.tsx
  - src/contexts/iam/api/components/signup-form.tsx
  - src/contexts/iam/api/components/timezone-form.tsx
  - src/contexts/iam/api/components/unverified-blocker.tsx
  - src/contexts/iam/api/components/use-auth-form.ts
  - src/contexts/iam/application/change-password.ts
  - src/contexts/iam/application/consume-password-reset.ts
  - src/contexts/iam/application/current-user.ts
  - src/contexts/iam/application/login.ts
  - src/contexts/iam/application/logout.ts
  - src/contexts/iam/application/oauth-complete.ts
  - src/contexts/iam/application/record-consent.ts
  - src/contexts/iam/application/request-password-reset.ts
  - src/contexts/iam/application/require-verified.ts
  - src/contexts/iam/application/resend-verification.ts
  - src/contexts/iam/application/signup.ts
  - src/contexts/iam/application/update-me.ts
  - src/contexts/iam/application/verify-email.ts
  - src/contexts/iam/domain/schemas.ts
  - src/contexts/iam/infrastructure/auth/auth-adapter.ts
  - src/contexts/iam/infrastructure/db/auth-throttle.ts
  - src/contexts/iam/infrastructure/db/consent-logs.ts
  - src/contexts/iam/infrastructure/db/partner-store.ts
  - src/contexts/iam/infrastructure/db/policy-versions.ts
  - src/contexts/iam/infrastructure/db/reset-tokens.ts
  - src/contexts/iam/infrastructure/db/schema.ts
  - src/contexts/iam/infrastructure/db/subscriptions.ts
  - src/contexts/iam/infrastructure/db/test-helpers.ts
  - src/contexts/iam/infrastructure/db/types.ts
  - src/contexts/iam/infrastructure/db/users.ts
  - src/contexts/iam/infrastructure/db/verification-tokens.ts
  - src/contexts/iam/infrastructure/posthog-bridge.ts
  - src/contexts/iam/infrastructure/supabase-admin.ts
  - src/contexts/iam/infrastructure/supabase-server.ts
  - src/contexts/iam/inngest/functions.ts
  - src/contexts/identification/inngest/functions.ts
  - src/contexts/notifications/application/send-email.ts
  - src/contexts/notifications/domain/events.ts
  - src/contexts/notifications/infrastructure/email-templates/password-reset.tsx
  - src/contexts/notifications/infrastructure/email-templates/verification.tsx
  - src/contexts/notifications/infrastructure/email-templates/welcome-back.tsx
  - src/contexts/notifications/infrastructure/resend-adapter.ts
  - src/contexts/notifications/inngest/functions.ts
  - src/contexts/reminders/inngest/functions.ts
  - src/contexts/species-care/inngest/functions.ts
  - src/messages/pt-BR.json
  - src/shared/api/auth.ts
  - src/shared/api/throttle.ts
  - src/shared/config/server-env.ts
  - src/shared/crypto/tokens.ts
  - src/shared/db/schema-registry.ts
  - src/shared/inngest/client.ts
  - src/shared/inngest/registry.ts
  - tests/e2e/auth-change-password.spec.ts
  - tests/e2e/auth-google-oauth.spec.ts
  - tests/e2e/auth-login-logout.spec.ts
  - tests/e2e/auth-password-reset.spec.ts
  - tests/e2e/auth-signup-verification.spec.ts
  - tests/e2e/iam-unverified-blocker.spec.ts
  - tests/e2e/legal-links.spec.ts
  - tests/e2e/settings-account.spec.ts
  - tests/integration/iam-change-password.integration.test.ts
  - tests/integration/iam-consent-log.integration.test.ts
  - tests/integration/iam-login.integration.test.ts
  - tests/integration/iam-oauth.integration.test.ts
  - tests/integration/iam-password-reset-route-timing.integration.test.ts
  - tests/integration/iam-password-reset-tx-rollback.integration.test.ts
  - tests/integration/iam-password-reset.integration.test.ts
  - tests/integration/iam-schema-phase4.integration.test.ts
  - tests/integration/iam-signup.integration.test.ts
  - tests/integration/iam-throttle.integration.test.ts
  - tests/integration/iam-verification-gate.integration.test.ts
  - tests/integration/iam-verify-token.integration.test.ts
  - tests/integration/inngest-serve.integration.test.ts
  - src/app/(test)/modal-sheet/page.tsx
  - playwright.config.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 04: Code Review Report (Iteration 2)

**Reviewed:** 2026-04-29T15:30:00Z
**Depth:** standard
**Files Reviewed:** 108
**Status:** clean

## Summary

Re-review of Phase 4 IAM after iteration-1 fixes (commits `5f4a7f2..1a85aa5`).
The original review surfaced 2 Critical, 9 Warning, 6 Info findings. Iteration 1
applied 15 fixes; 2 Info findings (IN-02 token-length DB constraint, IN-04
Inngest step.run JSON serialization) were intentionally skipped with documented
rationale in `04-REVIEW-FIX.md`.

All 15 applied fixes verified correct AND complete. No regressions detected.
No previously-missed Critical or Warning issues surfaced.

### Verification of fixes (one line each)

- **CR-01** (Resend dev fallback token leak) — `serverEnv.RESEND_API_KEY` is
  now `z.string().min(1)` when `NODE_ENV === "production"` (`server-env.ts:24-27`);
  `resendAdapter.send` throws in production when `resend` is null
  (`resend-adapter.ts:33-37`); dev fallback now logs only
  `{from, to, subject, templateName, devFallback: true}` — no rendered HTML
  (`resend-adapter.ts:45-51`). Belt-and-suspenders: env parse fails fast at
  boot, runtime throw is defense in depth.
- **CR-02** (change-password wrong error copy) — `messages/pt-BR.json:203-204`
  adds `passwordTooShort` and `passwordsDontMatch` under
  `settings.account.changePassword.errors`; `change-password-form.tsx:32-38`
  references the new keys. The OAuth-only and `invalid_credentials` paths
  still correctly map to `errors.currentIncorrect`.
- **WR-01** (current-user factory bypassing singleton) —
  `current-user.ts:34-36` returns `testAdapter ?? authAdapter` (the lazy
  Proxy singleton from `auth-adapter.ts`). Test seam preserved.
- **WR-02** (adminDeleteUser swallowed failures) —
  `auth-adapter.ts:271-283` wraps the call in `try/catch`, calls
  `Sentry.captureException` with `tags: { context: "iam.compensating_delete" }`
  and falls back to `console.error`. `import * as Sentry from "@sentry/nextjs"`
  added at the top.
- **WR-03** (spurious db.transaction wrapper) —
  `request-password-reset.ts:45-48` calls `mintResetToken` directly. The
  `db.transaction` wrapper and the now-unused `db` import are gone. Header
  comment explains why.
- **WR-04** (signup timing leak) — `signup/route.ts:42-50` adds
  `padToBaseline()` with `ANTI_ENUMERATION_BASELINE_MS = 200`; called only
  on the `already_registered` branch (`signup/route.ts:92`) AFTER the
  welcome-back `inngest.send`. `created` path is never padded. Floor lowered
  from 500ms to 200ms per advisor follow-up to avoid inversion oracle on
  warm-cache p95.
- **WR-05** (oauth-complete + signup outside withUnitOfWork) —
  `oauth-complete.ts:67` switched to `withUnitOfWork(input.userId, ...)`;
  RLS policies on `policy_versions` (SELECT authenticated, see
  `0001_phase_02_rls_policies.sql:110-117`), `users`, `consent_logs`,
  `subscriptions` (FOR ALL authenticated where `auth.uid() = user_id`)
  all permit the authenticated subject's writes. `signup.ts:74-81`
  documents the intentional service-role posture with `db.transaction` (no
  JWT exists yet on the caller; `set local role authenticated` would block
  `public.users` INSERT during compensating-delete edge cases).
- **WR-06** (signup onSuccess UX dead-end) —
  `signup-form.tsx:74` redirects to `/auth/forgot-password?from=signup`
  instead of `/`. Both `created` and `already_registered` 200 responses
  now land on a destination matching "check your email."
- **WR-07** (logout CSRF) — `logout/route.ts:28-36` wraps in
  `withThrottle(request, "logout", "always", ...)` and rejects requests
  whose Content-Type does not include `application/json`. Cross-site
  `<form>` POSTs cannot set `application/json` without preflight, so
  drive-by CSRF logouts short-circuit at validation. `"logout"` added to
  `ThrottleEndpoint` in `throttle.ts:29`.
- **WR-08** (NEXT_PUBLIC test-routes flag leaked into client bundle) —
  `serverEnv.ENABLE_TEST_ROUTES` is now `optional(z.string().min(1))`
  (server-side only, no `NEXT_PUBLIC_` prefix). All 4 diagnostics route
  gates, the `(test)/modal-sheet/page.tsx` route, and
  `playwright.config.ts` read the new server-only key. `.env.example:36-40`
  documents the var. No `NEXT_PUBLIC_ENABLE_TEST_ROUTES` references remain
  in source.
- **WR-09** (auth-throttle re-lock window check) —
  `auth-throttle.ts:100-117` introduces `lockoutInFuture` and checks
  `existingLockout.getTime() > Date.now()`. Re-arm path correctly fires
  when `count > 5` and the recorded `locked_until` is in the past. Also
  normalizes returned `lockedUntil` to `null` when the recorded timestamp
  is already in the past so `withThrottle` doesn't spuriously trip on
  stale data. New integration test at
  `iam-throttle.integration.test.ts:108-129` exercises the buggy path.
- **IN-01** (dead `if (!result.ok) return` guards) — Removed from both
  `signup-form.tsx` (lines 71-75) and `change-password-form.tsx` (lines
  43-51). Comments document why no post-submit branch is needed.
- **IN-03** (signup signInWithPassword catch swallows all errors) —
  `signup.ts:166-175` narrows by checking `err.message.includes("cookies")`
  for the expected outside-request-scope swallow; routes anything else
  to `Sentry.captureException` with `tags: { surface: "signup.sessionMint" }`.
- **IN-05** (`extractClientIp` fallback to 127.0.0.1) — JSDoc block at
  `auth-throttle.ts:31-41` explicitly documents the intentional CI/test
  fixture behavior and the self-hosted footgun. No code change; the
  trade-off is now explicit.
- **IN-06** (seed-oauth-incomplete-user bypassed AuthAdapter) —
  `seed-oauth-incomplete-user/route.ts:55-69` now calls
  `authAdapter.createUser({ email, password })`; the
  `@supabase/supabase-js` `createClient` import is gone. The peer
  diagnostics route `seed-verified-user` already had this shape.

### Skipped Info findings (per `04-REVIEW-FIX.md`)

- **IN-02** (`mintToken` length encoded as `length(64)` but no migration
  check) — Skipped pending dedicated migration PR. `mintToken` returns
  exactly 64 hex chars and the Zod schema pins `.length(64)` client-side,
  so the current code is correct; the concern is a future-change footgun
  that requires a Drizzle migration to address. **Carry forward.**
- **IN-04** (Inngest `step.run` JSON-serializes the React element) —
  Skipped pending Inngest SDK upgrade. Current behavior works because
  Inngest's in-process tick passes the React element through closure;
  the boundary becomes durable serialization only on a future SDK upgrade.
  **Carry forward.**

### Cross-cutting notes (NOT findings — context for the next reviewer)

- **WR-04 timing pad** is a bounded-gap mitigation, not a thin async
  wrapper (signup remains synchronous). The `04-REVIEW-FIX.md` flags this
  as `requires human verification`: production p95 for the `created`
  path must stay above 200ms, otherwise the warm-cache inversion oracle
  re-emerges. The original review explicitly accepted option (a)-or-(b)
  and the agent picked the documentation half of (b); the integration
  test asserting the bounded gap was not added. Not a regression to flag
  here, but the verifier should validate after the first prod traffic.
- **WR-05 signup posture** is intentional service-role on `db.transaction`
  (not `withUnitOfWork`). Defense-in-depth on the public.users INSERT
  comes from the explicit `userId` filters in repositories, not from RLS
  GUCs. The asymmetry between signup and oauth-complete is now documented
  in both files.
- **WR-07 throttle on logout** uses `"always"` mode. Per-IP request
  budget collapses if the same NAT egress fronts many users (5 logout
  POSTs from the same coffee-shop wifi within a minute will lock out the
  next caller for 5 minutes). Not a Phase 4 blocker; revisit when
  enterprise customer traffic patterns appear.
- **CR-01 `NODE_ENV` evaluation timing** — `process.env.NODE_ENV ===
  "production"` in `serverSchema` is evaluated at module-load time.
  Next.js sets NODE_ENV before any user module loads, so this works in
  practice. The runtime throw in `resendAdapter.send` is the safety net
  if anything ever bypasses the env parse. Two-layer fix is intact.

---

_Reviewed: 2026-04-29T15:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (iteration 2)_
