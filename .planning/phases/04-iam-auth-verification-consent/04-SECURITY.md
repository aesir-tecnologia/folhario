---
phase: 04
slug: iam-auth-verification-consent
status: verified
threats_total: 78
threats_closed: 78
threats_open: 0
asvs_level: 1
audited_at: 2026-04-29
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Public Internet → /api/v1/iam/* | Anonymous JSON payloads validated by Zod `.strict()` at boundary; bodies never form-encoded (D-31) | email, password, partner_code, timezone |
| Browser ↔ Server (cookies) | Supabase session cookies are HttpOnly + Secure (production) via `@supabase/ssr` | sb-*-auth-token (refreshable JWT) |
| App use-cases ↔ Supabase Auth | `auth-adapter.ts` is the SOLE module touching `supabase.auth.*` for IAM context (Codex HIGH #3) — DEVIATED in `src/proxy.ts` (T-04-12-04 OPEN) | user id, email |
| Server ↔ Postgres | Service-role key server-only; per-request `withUnitOfWork(userId)` sets `request.jwt.claim.sub` GUC for RLS | user rows + token rows |
| Inngest cloud ↔ /api/inngest | INNGEST_SIGNING_KEY validated by `inngest/next` serve() in production | event payloads |
| Resend API ↔ recipient | TLS transport; from-address sandbox (`onboarding@resend.dev`) until Phase 12 | verification + reset URLs |
| Token tables ↔ user JWTs | `service_role_only` RLS on `email_verification_tokens`, `password_reset_tokens`, `auth_throttle` — default-deny for `authenticated`/`anon` roles | token hashes only (raw tokens never persisted) |

---

## Threat Register

### Plan 01 — PREREQ audit (4 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-01-01 | Tampering | PREREQ-AUDIT.md verdict line | mitigate | CLOSED | `04-PREREQ-AUDIT.md:37` `Status: BLOCKED — run /gsd-execute-phase 2 first`; per-check PASS/FAIL table at lines 9-33 |
| T-04-01-02 | Repudiation | Audit decision lacks evidence | mitigate | CLOSED | Every check in `04-PREREQ-AUDIT.md:11-33` cites file path + line, e.g. line 11 `src/contexts/iam/infrastructure/db/schema.ts:39` |
| T-04-01-03 | Information Disclosure | Audit script logs DB credentials | accept | CLOSED | See Accepted Risks Log (audit reads `DATABASE_POOL_URL` locally; nothing written to audit doc) |
| T-04-01-04 | Tampering | D-33 override misuse | mitigate | CLOSED | `04-PREREQ-AUDIT.md:1-7` shows override flag field; resolution path at line 40-43 documents debt entry pattern |

### Plan 02 — DB schema/RLS (8 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-02-01 | Information Disclosure | `email_verification_tokens` table | mitigate | CLOSED | `drizzle/migrations/0003_phase04_iam_extensions.sql:42-45` `ENABLE ROW LEVEL SECURITY` + `service_role_only` policy (no policy for authenticated/anon → default-deny) |
| T-04-02-02 | Information Disclosure | `password_reset_tokens` table | mitigate | CLOSED | `drizzle/migrations/0003_phase04_iam_extensions.sql:47-49` mirrors verification-tokens posture |
| T-04-02-03 | Denial of Service | `auth_throttle` UPSERT pressure | mitigate | CLOSED | `drizzle/migrations/0003_phase04_iam_extensions.sql:1-9` composite PK `(ip, endpoint, window_start)`; partial index at lines 56-58 |
| T-04-02-04 | Tampering | Token hash collision | accept | CLOSED | See Accepted Risks Log (SHA-256 collision space 2^128); `0003_phase04_iam_extensions.sql:34,36` UNIQUE constraints on `token_hash` enforce duplicate-rejection |
| T-04-02-05 | Repudiation | Migration applied without migrate | mitigate | CLOSED | `drizzle/migrations/0003_phase04_iam_extensions.sql` exists with full SQL; pipeline uses `drizzle-kit migrate` per Codex HIGH #1 (verified across files; not `push`) |
| T-04-02-06 | Spoofing | Forged X-Forwarded-For | mitigate | CLOSED | `src/contexts/iam/infrastructure/db/auth-throttle.ts:42-47` `extractClientIp` reads first hop `xff.split(",")[0]?.trim()` |
| T-04-02-07 | Spoofing | Lockout bypass via stale window_start | mitigate | CLOSED | `0003_phase04_iam_extensions.sql:6` `locked_until TIMESTAMPTZ` column + `auth-throttle.ts:54-69` `getCurrentLockoutEnd` scans across all window_start buckets |
| T-04-02-08 | Tampering | Hand-appended RLS skipped by `push` | mitigate | CLOSED | RLS statements at `0003_phase04_iam_extensions.sql:39-58` are committed in the migration SQL file (not in schema.ts), executed verbatim by `drizzle-kit migrate` |

### Plan 03 — deps + env (10 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-03-01 | Information Disclosure | Token verification timing leak | mitigate | CLOSED | `src/shared/crypto/tokens.ts:18-24` `verifyToken` uses `timingSafeEqual` on equal-length hex buffers |
| T-04-03-02 | Tampering | Forged X-Forwarded-For | mitigate | CLOSED | `src/contexts/iam/infrastructure/db/auth-throttle.ts:42-47` reads first hop only |
| T-04-03-03 | Spoofing | requireApiUser bypass via missing JWT | mitigate | CLOSED | `src/shared/api/auth.ts:38-66` requireApiUser returns `unauthenticated`; requireVerifiedUser checks `emailVerifiedAt` |
| T-04-03-04 | Denial of Service | Token entropy exhaustion | accept | CLOSED | See Accepted Risks Log (256-bit entropy via `randomBytes(32)` at `tokens.ts:13`) |
| T-04-03-05 | Information Disclosure | Server Component cookie write throws (Pitfall 6) | mitigate | CLOSED | `src/contexts/iam/infrastructure/supabase-server.ts:42-55` `getReadOnlySupabaseServerClient` no-op `setAll`; `current-user.ts:97-117` exposes `getCurrentUserFromSessionReadOnly` |
| T-04-03-06 | Information Disclosure | Email leaked in Sentry user context | mitigate | CLOSED | `src/shared/telemetry/sentry-scrub.ts:65-69` deletes `event.user.email`/`username`/`ip_address`; grep shows zero `Sentry.setUser({ email })` calls in src/ |
| T-04-03-07 | Tampering | Zod schema bypass via prototype pollution | mitigate | CLOSED | `src/contexts/iam/domain/schemas.ts:90,99,113,120,128,138` all `.strict()` — every IAM request schema rejects unknown keys |
| T-04-03-08 | Information Disclosure | Resend test fixture leaks real emails | mitigate | CLOSED | `src/contexts/notifications/infrastructure/resend-adapter.ts:21,31-52` dev fallback omits body; integration tests mock `@shared/inngest/client` (e.g., `tests/integration/iam-password-reset-route-timing.integration.test.ts:18-22`) |
| T-04-03-09 | Spoofing | Lockout bypass via stale window_start | mitigate | CLOSED | `src/shared/api/throttle.ts:78-83` `isCurrentlyLocked` runs BEFORE per-minute counter |
| T-04-03-10 | Elevation of Privilege | App code calls supabase.auth.* directly | mitigate | CLOSED | grep `supabase\.auth\.` over `src/contexts/iam/application/` + `src/contexts/iam/api/` + `src/app/api/v1/iam/` returns 0 non-comment matches |

### Plan 04 — Inngest serve (5 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-04-01 | Spoofing | Forged Inngest webhook | mitigate | CLOSED | `src/shared/inngest/client.ts:8` `signingKey: serverEnv.INNGEST_SIGNING_KEY` passed to `inngest/next.serve()` at `src/app/api/inngest/route.ts:6-9`. Note: env enforcement is delegated to the SDK at serve()-time rather than Zod-asserted at boot (`server-env.ts:19` is `optional`); production mitigation depends on the env var being set in the Vercel project |
| T-04-04-02 | Information Disclosure | Stub returns leak schema | accept | CLOSED | See Accepted Risks Log (stubs return `{status: "not_implemented"}`) |
| T-04-04-03 | Repudiation | Function failure leaves no trace | mitigate | CLOSED | Inngest dashboard logs every invocation by default; `src/contexts/notifications/inngest/functions.ts:18` `retries: 3` |
| T-04-04-04 | Denial of Service | auth_throttle cleanup deferred | accept | CLOSED | See Accepted Risks Log (D-12 OR clause, partial-index TTL at `0003_phase04_iam_extensions.sql:56-58`) |
| T-04-04-05 | Information Disclosure | Email enumeration via response-latency timing on password-reset-request | mitigate | CLOSED | `src/app/api/v1/iam/password/reset-request/route.ts:20-69` thin `inngest.send` wrapper, no DB lookup; `src/contexts/iam/inngest/functions.ts:41-56` `iamPasswordResetRequested` hosts the conditional logic; route-handler timing test at `tests/integration/iam-password-reset-route-timing.integration.test.ts` |

### Plan 05 — auth-adapter, throttle, jwt (7 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-05-01 | Information Disclosure | Email body contains user PII | mitigate | CLOSED | `src/contexts/notifications/application/send-email.ts:18-34` only forwards `userEmail` and URL props |
| T-04-05-02 | Tampering | Email link open redirect | mitigate | CLOSED | `src/contexts/iam/application/signup.ts:138`, `request-password-reset.ts:50` build URLs from trusted `requestUrl` base + token |
| T-04-05-03 | Information Disclosure | Resend API key leak | mitigate | CLOSED | `src/shared/config/server-env.ts:24-28` server-only schema; `clientEnv` does not include it |
| T-04-05-04 | Repudiation | Email sent but no audit trail | accept | CLOSED | See Accepted Risks Log (Resend + Inngest dashboards both log dispatch) |
| T-04-05-05 | Spoofing | Email from-address `onboarding@resend.dev` | mitigate | CLOSED | `src/shared/config/server-env.ts:28` default sandbox sender (Phase-12 swap to verified domain documented) |
| T-04-05-06 | Information Disclosure | Email enumeration via welcome-back | mitigate | CLOSED | `src/app/api/v1/iam/signup/route.ts:80-106` welcome-back routed to same generic 200 + `padToBaseline(200ms)` (Phase 04 review WR-04 anti-enumeration) |
| T-04-05-07 | Denial of Service | Inngest retry storm if template throws | mitigate | CLOSED | `src/contexts/notifications/inngest/functions.ts:18` `retries: 3` |

### Plan 06 — signup/verify/resend (12 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-06-01 | Information Disclosure | Email enumeration via signup error | mitigate | CLOSED | `src/contexts/iam/application/signup.ts:46-50` returns `already_registered` with same shape; `route.ts:80-106` emits welcome-back + same 200 message; `padToBaseline` floor at `route.ts:43` |
| T-04-06-02 | Tampering | Token replay (verification or resend) | mitigate | CLOSED | `src/contexts/iam/infrastructure/db/verification-tokens.ts:60-77` UPDATE WHERE `consumed_at IS NULL` + `FOR UPDATE` row lock; UNIQUE index in `0003_phase04_iam_extensions.sql:34`; prior unused tokens revoked at `verification-tokens.ts:36` |
| T-04-06-03 | Spoofing | Forged verification URL | mitigate | CLOSED | `src/shared/crypto/tokens.ts:13-15` SHA-256 hash; `consumeVerificationToken` matches by indexed `token_hash` at `verification-tokens.ts:65` (constant-time DB lookup; the timing-safe `verifyToken` helper exists at `tokens.ts:18-24` for non-DB paths) |
| T-04-06-04 | Denial of Service | Per-IP signup spam | mitigate | CLOSED | `src/app/api/v1/iam/signup/route.ts:54` `withThrottle("signup", "always", ...)` increments BEFORE auth call; `src/shared/api/throttle.ts:85-90` |
| T-04-06-05 | Elevation of Privilege | Compensating delete fails → orphan auth.users | mitigate | CLOSED | `src/contexts/iam/application/signup.ts:131-135` catch + `authAdapter.adminDeleteUser`; `auth-adapter.ts:286-305` Sentry capture on failure |
| T-04-06-06 | Repudiation | LGPD Art. 7 consent without audit | mitigate | CLOSED | `src/contexts/iam/application/signup.ts:85-128` 2 ConsentLog rows in same `db.transaction`; `consent-logs.ts:92-117` `insertSignupConsents` writes both with `purpose='signup_acceptance'` + distinct `policy_version_id` |
| T-04-06-07 | Information Disclosure | LGPD Art. 14 child <13 signup | mitigate | CLOSED | `src/contexts/iam/domain/schemas.ts:84` `age_confirmed: z.literal(true)` rejects `false` at boundary |
| T-04-06-08 | Information Disclosure | PostHog signup_completed leaks email | mitigate | CLOSED | `src/contexts/iam/infrastructure/posthog-bridge.ts:17,22-24` `distinctId: userId` + empty/whitelist properties only |
| T-04-06-09 | Tampering | Pitfall 8 — signup_completed fires too early | mitigate | CLOSED | `src/contexts/iam/application/verify-email.ts:39-42` capture happens AFTER tx commit at /auth/verify, not at form submit |
| T-04-06-10 | Information Disclosure | Verification gate bypass via missing call | mitigate | CLOSED | `src/shared/api/auth.ts:55-66` `requireVerifiedUser`; `src/app/(app)/layout.tsx:31-53` route-group server-component gate; allowlist at `auth.ts:80-115` |
| T-04-06-11 | Tampering | Adapter boundary violation | mitigate | CLOSED | grep `supabase\.auth\.` over `src/contexts/iam/application/signup.ts` + `src/app/api/v1/iam/signup/route.ts` returns 0 non-comment matches |
| T-04-06-12 | Tampering | Partner code abuse | mitigate | CLOSED | `src/contexts/iam/application/signup.ts:53-61` calls `isPartnerCodeActive`; `src/contexts/iam/infrastructure/db/partner-store.ts:11-19` queries `is_active = true` |

### Plan 07 — login/logout/forgot/reset (7 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-07-01 | Spoofing | Credential stuffing | mitigate | CLOSED | `src/app/api/v1/iam/login/route.ts:23` `withThrottle("login", "on-failure", ...)`; `src/shared/api/throttle.ts:65-68,94-99` increments only on 401/403; `auth-throttle.ts:20-21` 5-min lockout |
| T-04-07-02 | Information Disclosure | Login error reveals which is wrong | mitigate | CLOSED | `src/contexts/iam/infrastructure/auth/auth-adapter.ts:261-267` always returns `invalid_credentials` regardless of error; `src/app/api/v1/iam/login/route.ts:37-39` maps to single 401 + same pt-BR copy |
| T-04-07-03 | Repudiation | Logout-all-devices not in scope | accept | CLOSED | See Accepted Risks Log (AUTH-v2-02 post-MVP per Resolved Q-AUTH-14) |
| T-04-07-04 | Tampering | Forged signOut scope | mitigate | CLOSED | `src/contexts/iam/infrastructure/auth/auth-adapter.ts:269-275` hard-codes `signOut({scope: 'local'})`; `src/app/api/v1/iam/logout/route.ts:28-37` ignores body |
| T-04-07-05 | Session Fixation | Stale cookie from prior session | mitigate | CLOSED | `@supabase/ssr` cookie-rotation on `signInWithPassword` (delegated to library); adapter at `auth-adapter.ts:261-267` is the sole entry point |
| T-04-07-06 | Information Disclosure | JWT in error logs | mitigate | CLOSED | `src/shared/telemetry/sentry-scrub.ts:5-13` SCRUB_FIELDS includes `authorization`, `cookie`, `token`, `password`, `email` |
| T-04-07-07 | Tampering | Adapter boundary violation | mitigate | CLOSED | grep `supabase\.auth\.` over `src/contexts/iam/application/login.ts` + `logout.ts` + their route files returns 0 non-comment matches |

### Plan 08 — password reset (7 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-08-01 | Information Disclosure | Email enumeration via reset | mitigate | CLOSED | `src/app/api/v1/iam/password/reset-request/route.ts:20-69` thin wrapper; `src/contexts/iam/inngest/functions.ts:41-56` async lookup; route-timing regression test at `tests/integration/iam-password-reset-route-timing.integration.test.ts` |
| T-04-08-02 | Tampering | Reset-token replay | mitigate | CLOSED | `src/contexts/iam/infrastructure/db/reset-tokens.ts:63-85` `FOR UPDATE` + `WHERE consumed_at IS NULL`; `consume-password-reset.ts:33-51` wraps in `db.transaction` for rollback |
| T-04-08-03 | Spoofing | Forged reset URL | mitigate | CLOSED | `src/shared/crypto/tokens.ts:13-15` SHA-256; `reset-tokens.ts:67-72` indexed `token_hash` lookup; UNIQUE index at `0003_phase04_iam_extensions.sql:36` |
| T-04-08-04 | Information Disclosure | OAuth-only users get reset email | mitigate | CLOSED | `src/contexts/iam/application/request-password-reset.ts:38-39` exits silently when `!user.hasPassword` (inside async Inngest function so route timing unaffected) |
| T-04-08-05 | Denial of Service | Reset-request spam | mitigate | CLOSED | `src/app/api/v1/iam/password/reset-request/route.ts:32` `withThrottle("password-reset-request", "always", ...)`; outer event id at `route.ts:57` minute-bucketed; inner event id at `request-password-reset.ts:52-56` token-unique |
| T-04-08-06 | Tampering | AUTH-12 — existing JWTs invalidated by reset | mitigate | CLOSED | `src/contexts/iam/application/consume-password-reset.ts:33-55` does NOT call signOut; `auth-adapter.ts:277-284` `adminUpdatePassword` does not call signOut |
| T-04-08-07 | Tampering | Adapter boundary violation | mitigate | CLOSED | grep `supabase\.auth\.` over `consume-password-reset.ts` + `request-password-reset.ts` + `inngest/functions.ts` returns 0 non-comment matches |

### Plan 09 — change-password + me/timezone + OAuth complete (8 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-09-01 | Spoofing | Change-password without current verify | mitigate | CLOSED | `src/contexts/iam/application/change-password.ts:35-43` reverifies via `authAdapter.signInWithPassword` BEFORE `adminUpdatePassword` |
| T-04-09-02 | Elevation of Privilege | OAuth-only PATCH /me/password | mitigate | CLOSED | `change-password.ts:31-33` returns `oauth_only` early; `src/app/api/v1/iam/me/password/route.ts:54-55` maps to forbidden 403 |
| T-04-09-03 | Spoofing | OAuth state CSRF | mitigate | CLOSED | `src/contexts/iam/infrastructure/auth/auth-adapter.ts:319-330` delegates to `supabase.auth.exchangeCodeForSession` (PKCE handled internally) |
| T-04-09-04 | Tampering | OAuth-complete bypass via direct route hit | mitigate | CLOSED | `src/shared/api/auth.ts:86` `/api/v1/iam/oauth/complete` allowlisted; `src/app/(app)/layout.tsx:42-44` redirects unfinished OAuth to `/auth/oauth-complete` |
| T-04-09-05 | Information Disclosure | LGPD Art. 7 consent without audit (OAuth) | mitigate | CLOSED | `src/contexts/iam/application/oauth-complete.ts:67-97` `withUnitOfWork` + `insertSignupConsents` (2 rows) + `setOauthCompletionFields` in same tx |
| T-04-09-06 | Repudiation | OAuth-complete double-submit | mitigate | CLOSED | `oauth-complete.ts:43-45` returns `already_completed` when `existing.ageConfirmedAt` set |
| T-04-09-07 | Tampering | Adapter boundary violation | mitigate | CLOSED | grep `(supabase\.auth\.|drizzle-orm|from "@.*db/client")` over `src/app/api/v1/iam/` returns 0 non-comment matches (route handlers consume only repo helpers, not raw Drizzle) |
| T-04-09-08 | Tampering | Partner code abuse via OAuth complete | mitigate | CLOSED | `oauth-complete.ts:48-56` calls `isPartnerCodeActive`; same path as signup |

### Plan 10 — UnverifiedBlocker + verification gate (9 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-10-01 | Spoofing | Verification gate UI bypass | mitigate | CLOSED | `src/app/(app)/layout.tsx:32-49` server-component route-group gate via `getCurrentUserFromSessionReadOnly` + `UnverifiedBlocker` render; route-group is folder-based (App Router enforced) |
| T-04-10-02 | Information Disclosure | Pitfall 6 — Server Component sets cookies | mitigate | CLOSED | `src/app/(app)/layout.tsx:32` uses `getCurrentUserFromSessionReadOnly`; `current-user.ts:97-117` calls `getUserBySession({readOnly: true})` |
| T-04-10-03 | Tampering | Form CSRF | mitigate | CLOSED | `src/contexts/iam/api/components/use-auth-form.ts:52-55` uses `Content-Type: application/json` (preflight forces same-origin); Supabase cookie SameSite=Lax (library default) |
| T-04-10-04 | Information Disclosure | Auth pages visible to authed user | mitigate | CLOSED | `src/app/(public)/layout.tsx:12-19` redirects authenticated+verified+ageConfirmed users to `/` |
| T-04-10-05 | Information Disclosure | Email visible in URL or DOM | mitigate | CLOSED | `unverified-blocker.tsx` renders `email` in `<strong>` only (no URL); Sentry scrub at `sentry-scrub.ts:65-69` deletes user.email |
| T-04-10-06 | Spoofing | OAuth-complete bypass via direct route | mitigate | CLOSED | `src/app/(app)/layout.tsx:42-44` redirects when `!user.ageConfirmedAt` |
| T-04-10-07 | Information Disclosure | T&C/Privacy consent without informed agreement | mitigate | CLOSED | `signup-form.tsx:142-168` and `oauth-complete-form.tsx:113-139` render policy as `<a href="/legal/terms"|"/legal/privacy">` with version label; HTML required + Zod `z.literal(true)` enforce checkbox |
| T-04-10-08 | Tampering | x-pathname spoofing | mitigate | CLOSED | grep `x-pathname` returns 0 hits in src/ implementation; gate uses route-group folder structure (`(app)`, `(public)`) |
| T-04-10-09 | Tampering | Form-submission protocol mismatch | mitigate | CLOSED | grep `<form action=` and `formData()` over `src/app/(public)/`, `src/app/(app)/`, `src/contexts/iam/api/components/` returns 0 hits |

### Plan 11 — settings + legal + diagnostics (1 threat)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-11-01 | Repudiation | Doc-drift creates ambiguous semantics | mitigate | CLOSED | Plan-11 SUMMARY confirms 11/11 acceptance grep checks pass; `04-11-SUMMARY.md` Self-Check section |

### Plan 12 — middleware cookie-refresh (6 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-12-01 | Tampering | Forged sb-* cookie sent to middleware | mitigate | CLOSED | `src/proxy.ts:156-198` `createServerClient` + `getUser()`; `proxy.ts:187-196` clears `sb-*-auth-token` cookies on non-AuthSessionMissing error |
| T-04-12-02 | Information Disclosure | Sentry capture leaks PII in getUserBySession | mitigate | CLOSED | `src/contexts/iam/infrastructure/auth/auth-adapter.ts:237-240` Sentry tags only `surface: "iam.getUserBySession"`; `sentry-scrub.ts:65-69` strips email/cookie/token |
| T-04-12-03 | Denial of Service | Sentry flood from cold-start clean-cookie signal | mitigate | CLOSED | `auth-adapter.ts:236` filters `isAuthSessionMissingError` before capture; `proxy.ts:187` same predicate |
| T-04-12-04 | Elevation of Privilege | Middleware escalates Codex HIGH #3 boundary | accept | CLOSED | See Accepted Risks Log (AR-04-13). Inline `@supabase/ssr` integration in `src/proxy.ts` (commits 4081c7e + fc820f7) ratified as a Phase 04 deviation; Codex HIGH #3 adapter-boundary set extended to include `src/proxy.ts`. |
| T-04-12-05 | Repudiation | Cookie-write race in concurrent requests | accept | CLOSED | See Accepted Risks Log (per-request NextResponse, no shared mutable state) |
| T-04-12-06 | Spoofing | Authorization header on page route | accept | CLOSED | See Accepted Risks Log (page routes are cookie-only; bearer ignored on Server Components) |

### Plan 13 — UAT gap closure (Sentry capture + INNGEST_DEV) (6 threats)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-04-13-01 | Information Disclosure | Sentry leaks email/token in extra | mitigate | CLOSED | `src/shared/telemetry/sentry-scrub.ts:5-13` SCRUB_FIELDS includes `email`; route Sentry calls (e.g., `signup/route.ts:118` tags only `surface: "iam.signup.route"`); welcome-back capture at `signup/route.ts:98-101` includes email but scrub strips it before egress |
| T-04-13-02 | Denial of Service | Sentry quota burn from inngest.com outage | accept | CLOSED | See Accepted Risks Log |
| T-04-13-03 | Repudiation | Decoupled inngest.send → 200 may mean no email delivered | accept | CLOSED | See Accepted Risks Log (resend flow at `resend-verification/route.ts` provides retry) |
| T-04-13-04 | Spoofing | Attacker sets INNGEST_DEV=1 in production | mitigate | CLOSED | `package.json` scripts: only `"dev": "INNGEST_DEV=1 next dev"`; production deploys inherit Vercel env vars (no INNGEST_DEV set) |
| T-04-13-05 | Tampering | Bare catch forwards user-controlled fields to Sentry | mitigate | CLOSED | `src/contexts/iam/application/oauth-complete.ts:48-56` returns `invalid_partner_code` BEFORE catch path; route catch at `oauth/complete/route.ts:54-67` runs only on internal exceptions |
| T-04-13-06 | Elevation of Privilege | Sentry stack traces leak via dashboard | accept | CLOSED | See Accepted Risks Log (Phase 1 INFRA-26 — operator-only dashboards, `sendDefaultPii: false`) |

---

## Open Threats

None — T-04-12-04 resolved via Accepted Risks Log entry AR-04-13 (see below).

---

## Unregistered Flags

These attack surfaces appeared in implementation but were NOT in any `<threat_model>` block. From SUMMARY `## Threat Flags` sections (informational, not blockers per `<config> block_on: high`):

| Flag | Files | Description | First Reported | Mitigation In Place |
|------|-------|-------------|----------------|---------------------|
| unregistered_flag: information_disclosure | `src/app/api/v1/diagnostics/iam-test-helpers/latest-token/route.ts` | Test-only endpoint mints/returns raw verification token for an email | 04-06-SUMMARY | Two-layer gate (`NODE_ENV !== "production"` AND `IDENTIFICATION_PROVIDER_MODE === "stub"`); production opt-in via `ENABLE_TEST_ROUTES=1` server-only flag |
| unregistered_flag: information_disclosure | `src/app/api/v1/diagnostics/iam-test-helpers/latest-reset-token/route.ts` | Test-only — returns latest reset token | 04-08 (implicit) | Same two-layer gate |
| unregistered_flag: information_disclosure | `src/app/api/v1/diagnostics/iam-test-helpers/seed-verified-user/route.ts` | Creates verified Supabase user via service role | 04-09-SUMMARY | Same two-layer gate |
| unregistered_flag: information_disclosure | `src/app/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user/route.ts` | Creates OAuth-incomplete user; returns temp password | 04-09-SUMMARY | Same two-layer gate; password is single-use test fixture |
| unregistered_flag: information_disclosure | `src/app/api/v1/diagnostics/iam-test-helpers/nullify-password/route.ts` | Nullifies a user's `encrypted_password` (simulates OAuth-only) | 04-11 (implicit) | Same two-layer gate |
| unregistered_flag: configuration | `ENABLE_TEST_ROUTES` env var (server-only — no `NEXT_PUBLIC_` prefix) | Production opt-in flag for diagnostics endpoints | 04-10-SUMMARY | `src/shared/config/server-env.ts:39` server-only schema; Phase 12 deploy contract requires it MUST NOT be set in prod |

**Disposition:** All 5 diagnostics endpoints are test-fixtures only. The two-layer gate (`NODE_ENV !== "production"` AND `IDENTIFICATION_PROVIDER_MODE === "stub"`) means a misconfigured production deploy needs BOTH gates broken to expose them. The server-only `ENABLE_TEST_ROUTES` flag (per Phase 04 review WR-08) replaced the prior `NEXT_PUBLIC_ENABLE_TEST_ROUTES` to prevent client-bundle leakage.

**Recommendation:** When Phase 11 plans land, if these endpoints persist (PRD §3 MVP delete/export flows reuse them), promote each to a registered threat with explicit `mitigate` disposition. For Phase 04 these are warnings, not blockers.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-01-03 | Audit script reads `DATABASE_POOL_URL` from `.env.local` for local PSQL probes only; no credentials are written to the audit document. Phase 1 D-22 / LGPD-13 Sentry scrub already protects logs. | Phase 04 PREREQ audit (signed verdict line) | 2026-04-28 |
| AR-04-02 | T-04-02-04 | SHA-256 collision space is 2^128. Computationally infeasible. UNIQUE constraint on `token_hash` (`drizzle/migrations/0003_phase04_iam_extensions.sql:34,36`) ensures duplicate inserts fail. | PLAN 04-02 `<threat_model>` | 2026-04-28 |
| AR-04-03 | T-04-03-04 | `randomBytes(32)` provides 256 bits of entropy. Cryptographic exhaustion infeasible. | PLAN 04-03 `<threat_model>` | 2026-04-28 |
| AR-04-04 | T-04-04-02 | Inngest stub functions return `{status: "not_implemented"}` only — no PII, no system info. Dashboard visibility is intentional. | PLAN 04-04 `<threat_model>` | 2026-04-28 |
| AR-04-05 | T-04-04-04 | `auth_throttle` cleanup deferred via D-12 OR clause. Partial-index TTL (`auth_throttle_window_start_idx`) supports manual `DELETE WHERE window_start < cutoff`. Phase 11+ may add an Inngest cron if storage growth requires it. | PLAN 04-04 `<threat_model>` | 2026-04-28 |
| AR-04-06 | T-04-05-04 | Resend dashboard logs every send; Inngest dashboard logs every function invocation. Two independent logs satisfy audit. | PLAN 04-05 `<threat_model>` | 2026-04-28 |
| AR-04-07 | T-04-07-03 | Logout-all-devices deferred to AUTH-v2-02 (post-MVP). MVP ships single-device logout per Resolved Q-AUTH-14. Plan 11 doc-fix amends AUTH-14 wording. | Resolved Q-AUTH-14 | 2026-04-28 |
| AR-04-08 | T-04-12-05 | Each Next 16 middleware invocation processes ONE request — the response is built per-request and cookies are written into that response only. Concurrent requests have independent NextResponse instances; no shared mutable state. | PLAN 04-12 `<threat_model>` | 2026-04-29 |
| AR-04-09 | T-04-12-06 | Branch A (`/api/v1/*`) has authoritative bearer logic. Page routes (Branch B) are exclusively cookie-session — the bearer header is ignored on page routes (Server Components read only cookies via `getReadOnlySupabaseServerClient`). | PLAN 04-12 `<threat_model>` | 2026-04-29 |
| AR-04-10 | T-04-13-02 | Sentry's standard rate-limiting + sampling at the project level handles a flooded inngest.com outage. Trade-off documented: prefer ops-visible Sentry signal over user-trapping a 500. | PLAN 04-13 `<threat_model>` | 2026-04-29 |
| AR-04-11 | T-04-13-03 | Decoupled `inngest.send` means a successful 200 may correspond to no email delivered. Architectural intent: user can use "Reenviar e-mail" (per-user 1/min throttle) to retry. The `email_verification_tokens` row is persisted regardless of dispatch outcome. | PLAN 04-13 `<threat_model>` | 2026-04-29 |
| AR-04-12 | T-04-13-06 | Removing the bare catch reveals stack traces only via Sentry-leaked dashboards. Sentry dashboards are operator-only (Phase 1 INFRA-26 / D-21 — `sendDefaultPii: false`, scrub module active). No new EoP surface introduced. | PLAN 04-13 `<threat_model>` | 2026-04-29 |
| AR-04-13 | T-04-12-04 | Plan 04-12's declared mitigation called for `src/proxy.ts` to import only a named `updateSessionInMiddleware` helper from `src/contexts/iam/infrastructure/supabase-server.ts`. During cold-start UAT-gap-1 resolution (commits 4081c7e + fc820f7) the canonical `@supabase/ssr` middleware step was inlined into `src/proxy.ts` directly to clear stale `sb-*-auth-token` cookies after observation that the library's `setAll` callback was never invoked on `_recoverAndRefresh` failure (auth-js@2.104.1 + ssr@0.10.2). The functional invariant the threat defends (clean cold-start render, stale cookie cleared) is preserved and regression-locked by `tests/e2e/auth-cold-start-stale-cookie.spec.ts`. Codex HIGH #3 adapter-boundary set is extended to include `src/proxy.ts` as a SECOND ratified `supabase.auth.*` caller alongside `src/contexts/iam/infrastructure/auth/auth-adapter.ts`. Future audits must include `src/proxy.ts` in adapter-boundary greps for plans 03/06/07/08/09. Refactor to a named helper deferred — track as a Phase 11+ tech-debt item if the boundary widens further. | Owner ratification (verify-work T-04-12-04 resolution path #2) | 2026-04-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Cross-Cutting Verifications

### Closed Error-Code Registry (CLAUDE.md constraint)

- `cost_ceiling_reached` and `breaker_open` are INTERNAL-only and surface to clients as `provider_unavailable`.
- grep confirms these codes appear ONLY in identification context schema/events and `src/shared/config/errors.ts` registry; NEVER referenced in IAM phase code (`src/contexts/iam/**`, `src/app/api/v1/iam/**`).
- The only `rate_limited` 429 emit in MVP is `src/shared/api/throttle.ts:82,88,97` — confined to auth endpoints per CLAUDE.md.

### LGPD Sentry Constraint (id-only, never email)

- grep `Sentry\.setUser` over `src/` returns ZERO calls — even stronger than id-only (no setUser anywhere).
- Defense-in-depth: `src/shared/telemetry/sentry-scrub.ts:65-69` makeBeforeSend deletes `event.user.email` / `username` / `ip_address` if Sentry's auto-instrumentation populates them.
- All Sentry capture calls in IAM use `tags: { surface: "..." }` for structural context only.

### pt-BR Locale Constraint

- All user-facing error messages in route handlers are pt-BR (e.g., `signup/route.ts:60` "Corpo inválido.", `route.ts:76` "Código de parceiro inválido.", `me/password/route.ts:55` "Conta sem senha local.").
- `src/messages/pt-BR.json` is the only locale shipped per CLAUDE.md.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By | Notes |
|------------|---------------|--------|------|--------|-------|
| 2026-04-29 | 78 | 77 | 1 | gsd-security-auditor (audit-only) | Phase 04 declared 13 plans with `<threat_model>` blocks. T-04-12-04 OPEN: declared mitigation `src/proxy.ts` imports only named `updateSessionInMiddleware` helper is empirically absent — `proxy.ts:4,176` directly imports `@supabase/ssr.createServerClient` and calls `supabase.auth.getUser()` per UAT-gap-1 inline fix (commits 4081c7e + fc820f7). All other 77 threats verified via file:line evidence. 6 unregistered diagnostics endpoints + ENABLE_TEST_ROUTES env var logged as warnings; all carry two-layer gates. |
| 2026-04-29 | 78 | 78 | 0 | Owner ratification | T-04-12-04 disposition flipped from `mitigate` to `accept`; ratified via AR-04-13. Codex HIGH #3 adapter-boundary set extended to include `src/proxy.ts`. Status → verified. |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (13 entries)
- [x] `threats_open: 0`
- [x] `status: verified`

**Approval:** Phase 04 cleared. T-04-12-04 ratified via AR-04-13 (resolution path #2). Adapter-boundary documentation note in plans 03/06/07/08/09 to include `src/proxy.ts` is tracked as a Phase 11+ doc-update task; functional posture is recorded here in this SECURITY.md as the source of truth.
