---
phase: 04-iam-auth-verification-consent
reviewed: 2026-04-29T01:49:05Z
depth: standard
files_reviewed: 75
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
findings:
  critical: 2
  warning: 9
  info: 6
  total: 17
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-29T01:49:05Z
**Depth:** standard
**Files Reviewed:** 75 (source + integration tests; 50 SUMMARY/PLAN markdown files in scope were skipped per filter)
**Status:** issues_found

## Summary

Phase 4 ships the IAM core (signup → verify → login → logout, OAuth completion,
password reset, change-password, settings, unverified blocker, legal stubs)
plus the Inngest+Resend onboarding pipeline. Architecturally the AuthAdapter
boundary (Codex HIGH #3), `db.transaction` atomicity (Codex HIGH #2), and the
5-minute lockout via `locked_until` (Codex HIGH #5) are well-implemented and
covered by integration + Playwright E2E tests against the real running Next
server. RLS posture on the three new tables is correct (service-role-only),
and the migration vs. push concern (Codex HIGH #1) is verified by a smoking-
gun integration test.

That said, two BLOCKERs were surfaced that ship security/UX defects:

  1. `RESEND_API_KEY` is `optional()` in `serverEnv` and the resend adapter
     silently logs full email HTML — including verification links and reset
     URLs — to stdout when the key is empty. A production deploy missing the
     key (LGPD-significant secret) leaks reset tokens into Vercel logs.
  2. The change-password form maps two distinct client-side validation
     failures ("password too short", "passwords don't match") to the same
     "Senha atual incorreta" copy because the form's `i18n` keys do not
     exist in `messages/pt-BR.json`. Users see incorrect error guidance.

Beyond the two blockers, the timing-attack hardening on signup is missing
(only the password-reset route was made constant-time), the `current-user`
factory bypasses the AuthAdapter Proxy singleton, signup's `adminDeleteUser`
catch silently eats failures (no Sentry capture path) and several smaller
correctness/quality issues are noted below.

## Critical Issues

### CR-01: Production token leak via Resend dev fallback when `RESEND_API_KEY` empty

**File:** `src/shared/config/server-env.ts:21`, `src/contexts/notifications/infrastructure/resend-adapter.ts:16-41`
**Issue:** `RESEND_API_KEY` is declared as `optional(z.string().min(1))` in the
strict zod env schema, and `resend-adapter.ts` interprets an empty/undefined
key as "dev mode" — falling into the `console.log("[resend-dev] would send", ...)`
branch (line 34) where the **fully rendered email HTML** (including
`/auth/verify?token=...` raw verification tokens AND `/auth/reset?token=...`
raw password-reset tokens) is written to stdout and returns `{id: "dev-mode"}`.
A production deploy with a forgotten `RESEND_API_KEY` therefore (a) silently
fails to send any email, (b) does not surface that fact to the user (signup
returns 200 either way), and (c) prints the verification/reset tokens into
Vercel function logs where any operator with log access can take over the
account. This is the inverse of the D-11 anti-enumeration guarantee: the
operator log is now an enumerated leak vector.

The two-layer fix is to (1) make `RESEND_API_KEY` required in production
via the env schema, and (2) raise loudly inside the adapter when the
runtime is production but the key is missing rather than logging tokens.

**Fix:**
```typescript
// src/shared/config/server-env.ts
export const serverSchema = z.object({
  // ...
  RESEND_API_KEY: process.env.NODE_ENV === "production"
    ? z.string().min(1, "RESEND_API_KEY required in production")
    : optional(z.string().min(1)),
  // ...
});
```
And/or in `resend-adapter.ts`:
```typescript
if (!resend) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "resendAdapter.send: RESEND_API_KEY missing in production — refusing to log token URL to stdout"
    );
  }
  // existing dev fallback
}
```

### CR-02: Change-password client-side validation shows wrong error copy for two distinct failures

**File:** `src/contexts/iam/api/components/change-password-form.tsx:32-38`
**Issue:** Both client-side guards
```typescript
if (form.next.length < 8) {
  setClientError(t("errors.currentIncorrect"));   // ← wrong
  return;
}
if (form.next !== form.confirm) {
  setClientError(t("errors.currentIncorrect"));   // ← wrong
  return;
}
```
display "Senha atual incorreta" (the message reserved for `invalid_credentials`
on the *current* password) when the failure is actually (a) the *new* password
being too short or (b) the new + confirm fields not matching. Users typing a
6-character new password are told their already-correct current password is
wrong, which is misleading and blocks completion.

Cross-check against `messages/pt-BR.json`:
- `settings.account.changePassword.errors.currentIncorrect` exists (line 202)
- `settings.account.changePassword.errors.passwordTooShort` does NOT exist
- `settings.account.changePassword.errors.passwordsDontMatch` does NOT exist

The correct keys exist in `auth.reset.errors.passwordTooShort` and
`auth.reset.errors.passwordsDontMatch` (lines 147–148) but are not referenced
here, and adding a sibling-namespace lookup is not the right move because
the namespace is opened with `useTranslations("settings.account.changePassword")`.

**Fix:**
1. Add the two missing keys under `settings.account.changePassword.errors` in
   `messages/pt-BR.json` (mirror the `auth.reset` strings).
2. Reference them in `change-password-form.tsx`:
```typescript
if (form.next.length < 8) {
  setClientError(t("errors.passwordTooShort"));
  return;
}
if (form.next !== form.confirm) {
  setClientError(t("errors.passwordsDontMatch"));
  return;
}
```

## Warnings

### WR-01: `current-user.ts` factory bypasses the AuthAdapter Proxy singleton on every request

**File:** `src/contexts/iam/application/current-user.ts:30-32`
**Issue:**
```typescript
function adapter(): AuthAdapter {
  return testAdapter ?? createAuthAdapter();
}
```
Every call to `getCurrentUser`, `getCurrentUserFromSession`, and
`getCurrentUserFromSessionReadOnly` invokes `createAuthAdapter()` from scratch
when no test adapter is set. This (a) instantiates a fresh `createRemoteJWKSet`
wrapper on every request, defeating the whole purpose of the lazy Proxy
singleton at `auth-adapter.ts:312-317`, and (b) silently bypasses the singleton
boundary that the codebase uses everywhere else
(`signup.ts`, `consume-password-reset.ts`, `change-password.ts`,
`logout.ts` all import the `authAdapter` singleton).

The original AuthAdapter design promised one adapter per process; this seam
turns it into one-per-request. JWKS caching only works *inside* a single
`createRemoteJWKSet` instance, so the security guarantee
("verify against cached JWKS, fail closed if Supabase is unreachable") is
effectively reset on every call — though jose still serves a stale cache from
within its closures. Worse, when `__setCurrentUserAdapterForTests` is set in
test A and never reset before test B, this seam interacts with vitest module
caching in surprising ways (mitigated today by `__setCurrentUserAdapterForTests(null)`
in `beforeEach`, but fragile).

**Fix:**
```typescript
import { authAdapter, createAuthAdapter, type AuthAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";

let testAdapter: AuthAdapter | null = null;

function adapter(): AuthAdapter {
  return testAdapter ?? authAdapter;
}
```
This routes through the same Proxy singleton everyone else uses, while
preserving the test seam.

### WR-02: `adminDeleteUser` swallows compensating-delete failures with no Sentry path

**File:** `src/contexts/iam/infrastructure/auth/auth-adapter.ts:266-271`
**Issue:**
```typescript
async adminDeleteUser(userId) {
  await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {
    /* Sentry critical handled globally */
  });
},
```
The comment claims "Sentry critical handled globally," but `.catch(() => {})`
*handles* the rejection — no global unhandled-rejection handler will ever see
it. Per `signup.ts:128`, this runs as the compensating step when the
post-`createUser` transaction throws. If the compensating delete itself fails
(network blip, Supabase rate-limit, transient 5xx), an orphan `auth.users`
row remains. The next signup attempt with the same email will hit the unique
constraint inside `authAdapter.createUser` → throw → fall through to the route's
generic `internal_error` 500. The user is now permanently locked out of
self-service (their email is "in use" by an orphan row that the
already-registered branch in `signup.ts:47-51` doesn't see, because that
branch checks `getUserByEmail` which JOINs `auth.users` — so it WILL surface
as already_registered, but the user has no password set on the orphan row,
so the welcome-back flow is dead too).

**Fix:** Capture and report the failure explicitly:
```typescript
async adminDeleteUser(userId) {
  try {
    await supabaseAdmin.auth.admin.deleteUser(userId);
  } catch (err) {
    // Compensating delete failed — orphan auth.users row remains.
    // This is operator-action territory: capture so on-call sees it.
    if (typeof Sentry !== "undefined") {
      Sentry.captureException(err, {
        tags: { surface: "iam.adminDeleteUser.compensating" },
        extra: { userId },
      });
    } else {
      console.error("[iam] adminDeleteUser compensating failed", { userId, err });
    }
  }
},
```

### WR-03: `requestPasswordReset` wraps single-statement work in `db.transaction` (no atomicity gain)

**File:** `src/contexts/iam/application/request-password-reset.ts:39-44`
**Issue:**
```typescript
const { tokenId, rawToken } = await db.transaction(async (tx) => {
  return await mintResetToken({ userId: user.id, sentToEmail: args.email }, tx);
});
```
The plan comment claims "D-25 atomicity: revoke prior + mint fresh in one tx
so a partial failure can't leave orphaned revoked tokens with no replacement."
Inspecting `reset-tokens.ts:37-59`, `mintResetToken` is a single function that
*internally* calls `revokeUnusedResetTokens(opts.userId, dbOrTx)` and then
inserts. Whether you wrap that single function in a transaction or not, those
two statements run on the same connection in the same control flow — the only
case where a partial failure can interleave is a connection-loss between the
two statements, which `db.transaction` does NOT protect against (the entire
tx aborts in that case, but `mintResetToken` would equally throw, leaving
the same "revoked, not replaced" state).

The wrap is purely cosmetic. It costs an extra `BEGIN`/`COMMIT` round-trip on
every reset request and obscures the actual atomicity guarantee.

**Fix:** Either drop the wrapper:
```typescript
const { tokenId, rawToken } = await mintResetToken({
  userId: user.id,
  sentToEmail: args.email,
});
```
OR refactor `mintResetToken` to expose `revokeUnused` + `insert` separately and
inline both calls inside the tx (the wrap then has real meaning).

### WR-04: Signup timing leak undermines the already-registered anti-enumeration claim

**File:** `src/contexts/iam/application/signup.ts:47-51`, `src/app/api/v1/iam/signup/route.ts:53-64`
**Issue:** The Resolved Q1 contract is "already_registered → 200 + welcome-back so
the response is indistinguishable from a fresh signup (anti-enumeration)."
Trace the two code paths:

  - `getUserByEmail(input.email)` → existing → return ~30ms.
  - `getUserByEmail(input.email)` → null → partner_code lookup +
    `authAdapter.createUser` (HTTP round-trip to Supabase auth admin) + 5-write
    `db.transaction` + `mintVerificationToken` + Inngest send +
    `signInWithPassword` (a SECOND HTTP round-trip to Supabase) ≈ 500ms–2s.

The two responses are wildly time-separable. An attacker submitting one
candidate email per second can build a high-confidence enumeration oracle
purely from latency, even with the both-branches-emit-an-Inngest-event
indirection (welcome-back is dispatched on the existing-email path).

The password-reset route was made constant-time on purpose by going through
a thin Inngest wrapper (`reset-request/route.ts`) and the
`iam-password-reset-route-timing.integration.test.ts` enforces the invariant
to <50ms spread. Signup got no equivalent treatment.

**Fix (one of):**
  (a) Mirror the password-reset pattern: make `/api/v1/iam/signup` a thin
      `inngest.send` wrapper that returns 200 immediately, with all DB +
      auth + email work happening async inside an `iam/signup-requested`
      Inngest function. The UX cost is significant (you can't return the
      `verificationUrl` synchronously, the form has to poll or trust the
      Inngest pipeline). Document the trade-off in `04-DISCUSSION-LOG.md`.
  (b) Document the residual risk in a code comment AND add an integration
      test that asserts the gap is bounded (e.g., spread < 200ms when
      Supabase responds in <100ms) so a regression that adds a 5-second
      DNS lookup to the existing-email path doesn't slip through.

### WR-05: `oauth-complete` and `signup` run multi-write transactions outside `withUnitOfWork`

**File:** `src/contexts/iam/application/signup.ts:77`, `src/contexts/iam/application/oauth-complete.ts:65`
**Issue:** Both use-cases open `db.transaction(async (tx) => { ... })` for their
multi-table writes (users, consent_logs, subscriptions, tokens) but neither
calls `withUnitOfWork(userId, ...)` (Phase 2 D-20 helper) which sets the
`request.jwt.claim.sub` GUC so RLS policies can scope correctly. The defense-
in-depth claim ("RLS would still be correct even if a use-case forgot to
filter by `userId`") is therefore **partially false** for these two paths:
the writes run as the connection's owning role (likely service-role given
`@shared/db/client`), bypassing RLS entirely.

For signup this is arguably necessary (no JWT exists yet — there is no `sub`
to bind), but the comment in `record-consent.ts:62-71` explicitly notes
"RLS policies that read request.jwt.claim.sub see the right subject (D-20)"
which is precisely what these signup/oauth-complete paths skip.

**Fix:** Either (a) document this as intentional service-role privilege in
both files (the row writes use service-role connection; RLS would block the
unauthenticated subject anyway), and add an explicit test assertion that
service-role-write semantics are required, or (b) for `oauth-complete` (where
a JWT *does* exist), wrap the tx in `withUnitOfWork(input.userId, ...)` so
the GUC is set and RLS is exercised as defense in depth.

### WR-06: Already-registered signup path redirects to `/` with no session — UX dead-end

**File:** `src/contexts/iam/api/components/signup-form.tsx:62`
**Issue:**
```typescript
const result = await submit({
  endpoint: "/api/v1/iam/signup",
  body,
  onSuccess: () => router.push("/"),
});
```
The `onSuccess` fires for both `created` and `already_registered` 200 responses
(server returns `{ ok: true, message: "Conta criada — verifique seu email." }`
in both cases per `signup/route.ts:66-69`). For an already-registered email
the server emits a welcome-back email pointing at `/auth/forgot-password` but
the browser is not authenticated — `router.push("/")` lands the user at the
app root which the route group `(authed)` will bounce back to `/auth/login`,
showing no acknowledgement that a duplicate-signup welcome email was sent.

This is at best confusing UX; at worst, it makes the welcome-back path feel
broken to honest duplicate-signups.

**Fix:** Push to `/auth/forgot-password` (with a one-shot success banner via
search param) in both branches. The 200 generic response from the server is
fine for anti-enumeration; the client just needs a destination that matches
"check your email."
```typescript
onSuccess: () => router.push("/auth/forgot-password?from=signup"),
```

### WR-07: Logout route accepts no-body POST without verifying the auth gate

**File:** `src/app/api/v1/iam/logout/route.ts:20-22`
**Issue:** The route is fully unauthenticated (`_request: Request`), takes no
body, and immediately calls `logoutUser()`. The plan acknowledges this is
intentional ("Idempotent: even an unauthenticated request gets 200"). However
the route also does NOT validate Origin/Referer or run through `withThrottle`,
which means an attacker on `evil.com` can issue a CSRF POST to
`/api/v1/iam/logout` and clear the user's session for them with no signal
to the user beyond the next page load. Combined with no rate-limit, this is a
trivial annoy-vector (mass-logout users by embedding `<img src="https://app/api/v1/iam/logout">`).
While `<img>` GETs won't trigger the POST, a cross-site `<form>` with no
content-type will (Supabase SSR cookies are SameSite=Lax by default — verify).

**Fix:** Either (a) add a CSRF guard (require `Content-Type: application/json`,
which `<form>` posts cannot set; D-31 already enforces JSON-only on every
*other* IAM route), or (b) require the Supabase cookie's `SameSite=Strict`
and document the assumption.
```typescript
export async function POST(request: Request) {
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return errorResponse(ErrorCode.ValidationFailed, "Corpo inválido.");
  }
  await logoutUser();
  return NextResponse.json({ ok: true });
}
```

### WR-08: Diagnostics endpoints gate is `NEXT_PUBLIC_*` flag — public-by-design

**File:** `src/app/api/v1/diagnostics/iam-test-helpers/seed-verified-user/route.ts:32-33`,
`src/app/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user/route.ts:27-28`,
`src/app/api/v1/diagnostics/iam-test-helpers/latest-token/route.ts:28-29`,
`src/app/api/v1/diagnostics/iam-test-helpers/latest-reset-token/route.ts:28-29`
**Issue:** All four diagnostics endpoints gate by
```typescript
process.env.NEXT_PUBLIC_ENABLE_TEST_ROUTES === "1"
```
combined with `IDENTIFICATION_PROVIDER_MODE === "stub"`. `NEXT_PUBLIC_*`
variables in Next.js are **inlined into client bundles at build time**.
Setting this flag in a production environment makes its value visible to
every client that loads the app (it ends up in the JS bundle), which means
attackers can probe for it without needing access to operator config. The
endpoints themselves are server-only, but the gate flag is leaked.

Worse: the AND-of-two-flags guard `productionAllowed && stubMode` collapses
to ONE meaningful flag because anyone setting `NEXT_PUBLIC_ENABLE_TEST_ROUTES=1`
in production also has to set `IDENTIFICATION_PROVIDER_MODE=stub` — and the
latter is presumably the *real* prod-vs-test gate elsewhere. If a deploy ever
sets both (e.g., a misconfigured preview that gets promoted), unauthenticated
attackers can:
  - mint arbitrary verified users (`seed-verified-user`),
  - mint password-reset tokens for any registered email
    (`latest-reset-token` requires a known email but takes no auth — given
    enumeration via WR-04, this is straightforward),
  - mint verification tokens for any registered email (`latest-token`).

**Fix:**
  1. Rename the flag to a non-`NEXT_PUBLIC_` server-only variable (e.g.,
     `ENABLE_TEST_DIAGNOSTICS_ROUTES`) so its value never enters the client
     bundle.
  2. Require an additional shared-secret bearer header on every diagnostics
     POST/GET (e.g., `x-diagnostics-token: <serverEnv.DIAGNOSTICS_TOKEN>`)
     so even with the flag flipped accidentally, an unauthenticated attacker
     cannot exercise the endpoints.
  3. Add an integration test that asserts every diagnostics route returns
     404 when `NODE_ENV === "production"` regardless of flags (the current
     gate logic permits production exposure; that should require the
     diagnostics-token header on top).

### WR-09: `auth-throttle.ts` re-lock window check ignores expired-but-still-set lockouts

**File:** `src/contexts/iam/infrastructure/db/auth-throttle.ts:86-91`
**Issue:**
```typescript
const existingLockout = row.lockedUntil ? new Date(row.lockedUntil) : null;

if (isLocked(row.count) && !existingLockout) {
  // set new lockedUntil
}
```
The `!existingLockout` short-circuit treats *any* non-null `locked_until` as
"already locked" — but if a previous lockout has already expired
(`locked_until < now()`) and the same `(ip, endpoint, window_start)` row
gets bumped past 5 again (e.g., the row was never cleaned up and now it's
60–61 seconds later, same minute bucket), no fresh lockout is written. The
row reads back as count=12, `locked_until = T-50min` — `getCurrentLockoutEnd`
correctly excludes it (line 54: `gt(authThrottle.lockedUntil, sql\`now()\`)`),
so `withThrottle` doesn't reject — and bumpThrottle here ALSO doesn't re-arm
the lockout because `existingLockout` is truthy.

The integration test `iam-throttle.integration.test.ts:106-110` rewinds
`locked_until` into the past then asserts `isCurrentlyLocked` returns false,
which is correct — but does NOT cover the "tripped past 5 again, no new
lockout written" branch. Realistic exploit: an attacker who notices a hard
lockout backs off for 5+ minutes, returns at second 61 (next bucket), but
hits the same `(ip, endpoint, window_start)` row only if `window_start =
floor(now/60000)` matches the original — which only happens within the same
minute. So the exploit window is narrow but real.

**Fix:** Change the condition to "no FUTURE lockout":
```typescript
const existingLockout = row.lockedUntil ? new Date(row.lockedUntil) : null;
const lockoutInFuture = existingLockout && existingLockout.getTime() > Date.now();

if (isLocked(row.count) && !lockoutInFuture) {
  // set/refresh lockedUntil
  ...
}
```

## Info

### IN-01: `signup-form.tsx:64` `if (!result.ok) return` is dead code (no statement after)

**File:** `src/contexts/iam/api/components/signup-form.tsx:59-65`
**Issue:**
```typescript
const result = await submit({ ... });
if (!result.ok) return;
```
Nothing follows the `return`, so the guard does nothing — it just exits the
function the same way it would if the line weren't there. Likely a
copy-paste from `change-password-form.tsx:49` where the same idiom guards
the `setSuccess`/`setForm` cleanup.
**Fix:** Remove the dead guard, or replace it with the success-path side-
effect that was meant to happen after the submit. Same pattern at
`change-password-form.tsx:49`.

### IN-02: `mintToken` length encoded as `length(64)` but no migration check

**File:** `src/contexts/iam/infrastructure/db/schema.ts:261, 283`,
`src/shared/crypto/tokens.ts:13`
**Issue:** Tokens are minted as `randomBytes(32).toString("hex")` → exactly 64
hex chars. The DB columns are `varchar({ length: 64 })`. A future change to
a 48-byte or 64-byte token (96 / 128 hex chars) silently truncates because
varchar(64) drops the overflow without raising. There is no length-equality
constraint on the column. The Zod schema in `passwordResetConsumeSchema`
hardcodes `.length(64)` (`schemas.ts:118`) which mitigates client-side, but
the server-side generator and the column would silently disagree.
**Fix:** Either (a) widen the columns to `varchar(128)` and pin
`length === 64` in `mintToken` returns, or (b) add a DB CHECK constraint
`length(token_hash) = 64`.

### IN-03: `trustGuard` condition in `signupUser` swallows ALL errors from `signInWithPassword`

**File:** `src/contexts/iam/application/signup.ts:153-160`
**Issue:**
```typescript
try {
  await authAdapter.signInWithPassword({ ... });
} catch {
  /* swallow: best-effort session mint */
}
```
The bare `catch` swallows ALL errors, including ones that would be useful to
log (e.g., Supabase admin-auth misconfiguration, network-level failures). The
expected swallow is the `cookies()`-outside-request thrown by Next at
integration-test time. A targeted catch that narrows by `err.message` or
`err.name` would be safer.
**Fix:**
```typescript
try {
  await authAdapter.signInWithPassword({ ... });
} catch (err) {
  if (err instanceof Error && err.message.includes("cookies")) {
    // expected outside request scope (integration tests) — swallow
  } else {
    Sentry?.captureException(err, { tags: { surface: "signup.sessionMint" } });
  }
}
```

### IN-04: Inngest `step.run` JSON-serializes the React element across boundaries

**File:** `src/contexts/notifications/inngest/functions.ts:27-29`
**Issue:** The comment notes "step.run is JSON-serialized in Inngest's type
model. The React element survives in-process between steps within a single
execution tick, but we re-tag it as ReactElement after the boundary so the
resendAdapter signature is preserved." This relies on the in-process tick
optimization remaining stable across Inngest SDK versions. If a future
Inngest upgrade ever moves the boundary to durable serialization
(persisted to its journal), the React element will be lost and email
rendering will silently produce empty mail.
**Fix:** Render to HTML inside `step.run("render-email")` and pass the HTML
string + plain-text fallback to `resendAdapter.send`, which then takes
`html`/`text` instead of `react`. The boundary is then string-only and
durable-safe.

### IN-05: `auth-throttle.ts:31-36` `extractClientIp` falls back to `127.0.0.1`

**File:** `src/contexts/iam/infrastructure/db/auth-throttle.ts:31-36`
**Issue:** When the `x-forwarded-for` header is missing or empty, the helper
returns `"127.0.0.1"`. In a Vercel deploy, the `x-forwarded-for` header is
always set by the platform proxy. If the header is unexpectedly missing
(misconfigured proxy, direct connection in tests, raw HTTP request to a
self-hosted instance), all such requests collapse onto a single
`(127.0.0.1, endpoint, window_start)` bucket — a tripped lockout there
locks out every IP-less caller. This is an accepted CI/test fixture
pattern but a footgun in self-hosted deployments.
**Fix:** Add a clear comment that prod relies on Vercel always setting the
header, OR fail closed when the header is missing in production (return a
synthetic per-request token from `request.url` host or reject as 400).

### IN-06: `seed-oauth-incomplete-user` route directly imports `@supabase/supabase-js`, breaking AuthAdapter boundary

**File:** `src/app/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user/route.ts:17,55-59`
**Issue:** The Codex HIGH #3 boundary mandates that `supabase.auth.*` calls go
through `authAdapter`. This diagnostics route imports `createClient` directly
and instantiates an admin client for `admin.auth.admin.createUser`. The peer
diagnostics route `seed-verified-user` correctly uses `authAdapter.createUser`
(line 65). The deviation is unjustified — the same shape would work via the
adapter. As a side effect, this route also bypasses the env-driven JWKS
override hooks meant for tests.
**Fix:** Replace `createClient(...)` + `admin.auth.admin.createUser(...)` with
`authAdapter.createUser({ email, password })`. The `email_confirm: true` flag
inside the adapter already matches the diagnostics need.

---

_Reviewed: 2026-04-29T01:49:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
