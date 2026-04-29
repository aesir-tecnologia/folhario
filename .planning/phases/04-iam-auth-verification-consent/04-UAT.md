---
status: diagnosed
phase: 04-iam-auth-verification-consent
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md, 04-08-SUMMARY.md, 04-09-SUMMARY.md, 04-10-SUMMARY.md, 04-11-SUMMARY.md
started: 2026-04-29T02:56:32Z
updated: 2026-04-29T03:14:00Z
---

## Current Test

number: 4
name: Sign Up — Invalid Partner Code (rejected)
expected: |
  Sign up with a partner_code that doesn't exist OR exists but is_active=false. Response 400 invalid_partner_code. Form shows pt-BR error message; no user row created in auth.users or public.users.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test

expected: Kill any running Next dev/start server. Stop Supabase (`pnpm db:stop`), Inngest dev, and any background workers. Clear ephemeral state (.next/, any temp DBs/caches). Start fresh: `pnpm db:start`, `npx inngest-cli dev`, `pnpm dev`. Server boots without errors. Visiting http://localhost:3000/ either renders the home shell (if verified session) or redirects to /auth/login. No 500s, no missing-env crashes, no DB connection refused.
result: issue
reported: "login page is rendered but there's a nextjs issue: Console AuthApiError — Invalid Refresh Token: Refresh Token Not Found. Stack traces through @supabase/auth-js GoTrueClient and PublicLayout. Next.js 16.2.3 (Turbopack)."
severity: major

### 2. Sign Up — Organic (no partner code)

expected: From /auth/signup, fill email + password + check age + check T&C + check Privacy + (timezone auto-detected as America/Sao_Paulo or similar), leave partner_code empty, submit. Form posts JSON to /api/v1/iam/signup. Response 200. User redirected into the app and the UnverifiedBlocker renders (full-viewport "Verifique seu e-mail para começar." headline + your email in bold + "Reenviar e-mail" CTA + "Sair" link). DB shows the user row with trial_source='organic', a 14-day trialing subscription, 2 consent_logs rows (terms_of_service + privacy_policy), and an email_verification_tokens row. With RESEND_API_KEY empty, the verification email content is logged to stdout (`[resend-dev] would send`).
result: issue
reported: "Error: Não foi possível concluir agora. POST /api/v1/iam/signup 500 in 3.3s (next.js: 229ms, proxy.ts: 11ms, application-code: 3.1s)"
severity: blocker

### 3. Sign Up — Active Partner Code (30-day trial)

expected: Seed an active partner_stores row first (e.g., code='LOJAVERDE', is_active=true, trial_days=30). Sign up with that code in partner_code field. Response 200, user lands on UnverifiedBlocker. DB shows users.trial_source='partner', users.partner_code='LOJAVERDE', subscription trial_end_date ~30 days from now (not 14).
result: issue
reported: "same issue as before — POST /api/v1/iam/signup returns 500 with pt-BR fallback 'Não foi possível concluir agora'"
severity: blocker
related_to: 2

### 4. Sign Up — Invalid Partner Code (rejected)

expected: Sign up with a partner_code that doesn't exist OR exists but is_active=false. Response 400 invalid_partner_code. Form shows pt-BR error message; no user row created in auth.users or public.users.
result: [pending]

### 5. Sign Up — Already-Registered Email (anti-enumeration)

expected: Sign up using an email that already has an account. Response is 200 (NOT 409 / "already exists" — anti-enumeration). UI behavior is indistinguishable from a fresh signup. Behind the scenes, a "welcome-back" email is dispatched (visible in the [resend-dev] stdout log if RESEND_API_KEY empty) instead of a verification email; the existing account is untouched.
result: [pending]

### 6. Verification Email Content

expected: After Test 2, inspect the dev console output. The logged verification email payload includes: pt-BR subject "Confirme seu e-mail para começar — Folhário", headline "Confirme seu e-mail para começar", the user's email in the body, a "Confirmar e-mail" CTA button, a plain-text URL fallback, and the Paper Cream brand colors (#FBF7EF background, #1F4D35 CTA). HTML preview is rendered (D-20 dev fallback).
result: [pending]

### 7. UnverifiedBlocker Gate on Authed Routes

expected: While unverified, visit /, /catalog, /identify, /profile, /settings — all render the UnverifiedBlocker (NOT the underlying page). The blocker shows the user email in `<strong>` and offers "Reenviar e-mail" and "Sair". /legal/terms and /legal/privacy ARE accessible (allowlisted). /auth/login renders the login page (the (public) group redirects you to / only if verified).
result: [pending]

### 8. Resend Verification (60s cooldown)

expected: Click "Reenviar e-mail" on the blocker. Button shows a 60-second cooldown. A new verification email is sent (new token; visible in [resend-dev] stdout). Clicking again before 60s passes is blocked client-side. After 60s, the button is enabled again.
result: [pending]

### 9. Email Verification Link

expected: Copy the verification URL from the latest [resend-dev] log (or use /api/v1/diagnostics/iam-test-helpers/latest-token with NEXT_PUBLIC_ENABLE_TEST_ROUTES=1). Open it. Browser navigates to /auth/verify?token=…, server consumes the token, sets users.email_verified_at, redirects to / (or wherever the next step is). Reloading / now shows the actual app shell (bottom nav + home) — UnverifiedBlocker is gone. PostHog signup_completed event fires server-side.
result: [pending]

### 10. Login — Email/Password

expected: From /auth/login, enter the verified user's credentials. Submit. JSON POST to /api/v1/iam/login returns 200. SSR cookie set. Redirected into the app shell. Successful login does NOT increment auth_throttle (verifiable via DB query — no row inserted for that IP/login on success per D-15).
result: [pending]

### 11. Login — Invalid Credentials

expected: From /auth/login, enter a real email but wrong password (or completely unknown email). Response 401 invalid_credentials. Same generic pt-BR error rendered ("E-mail ou senha incorretos.") regardless of whether the email exists. No session cookie set.
result: [pending]

### 12. Login — Rate Limited After 6 Failures

expected: Submit 6 wrong-password attempts in quick succession from the same IP. The 6th response is 429 rate_limited. The 7th attempt — even with the CORRECT password — is also rejected with 429 for ~5 minutes (locked_until window). After 5 minutes pass, login with the correct password succeeds.
result: [pending]

### 13. Logout

expected: While logged in, click "Sair" (in UnverifiedBlocker, in Settings, or wherever it appears). Browser POSTs to /api/v1/iam/logout. Response 200. Cookie cleared. Redirected to /auth/login (or /auth/login becomes accessible again). Subsequent calls to /api/v1/iam/me return 401 unauthenticated.
result: [pending]

### 14. Forgot Password — Request

expected: From /auth/login, click "Esqueci a senha". Land on /auth/forgot-password. Enter your email, submit. JSON POST to /api/v1/iam/password/reset-request returns 200 immediately (sub-millisecond — anti-enumeration). UI shows pt-BR confirmation ("Se houver uma conta para esse e-mail, enviaremos um link…"). For an existing account, [resend-dev] log shows the password-reset email; for a non-existent email, NO email is sent but UI response is identical.
result: [pending]

### 15. Reset Password — Consume + Login With New

expected: Copy the reset URL from [resend-dev] log (or use /api/v1/diagnostics/iam-test-helpers/latest-reset-token). Open /auth/reset?token=…. Enter a new password, submit. Response 200. Redirect to /auth/login. Log in with the NEW password — succeeds. Log in with the OLD password — fails with invalid_credentials. Token cannot be reused (replay returns invalid_or_expired).
result: [pending]

### 16. Change Password (in Settings)

expected: While logged in with email/password, navigate to /settings/account. The "Alterar senha" form is visible. Enter current password + new password, submit. Response 200. Existing session stays valid (no forced re-login). Log out, log in with the NEW password — succeeds.
result: [pending]

### 17. Change Password — Wrong Current Password

expected: In /settings/account change-password form, enter a wrong current password + a new password. Response 401 invalid_credentials. Form shows pt-BR error. Password not changed.
result: [pending]

### 18. Change Password — OAuth-Only User Forbidden

expected: Sign in via Google OAuth (new user, no email/password). In /settings/account, the change-password form is HIDDEN (UI-SPEC §4: only show if hasPassword). If you still POST to /api/v1/iam/me/password directly, response is 403 forbidden.
result: [pending]

### 19. Google OAuth Sign In (new user)

expected: From /auth/login, click "Continuar com Google". Browser redirects to Supabase Auth → Google consent screen → /auth/callback?code=… on return. Callback exchanges code for session. Because age_confirmed_at IS NULL for the new OAuth user, you're redirected to /auth/oauth-complete. Cookie session is established.
result: [pending]

### 20. OAuth Complete — Consents + Timezone

expected: On /auth/oauth-complete, the form asks for age confirmation, T&C accept, Privacy accept, timezone, and optional partner_code. Submit. JSON POST to /api/v1/iam/oauth/complete returns 200. DB updated atomically (one db.transaction): users.age_confirmed_at + users.email_verified_at + users.timezone + users.partner_code set; 2 consent_logs rows; trialing subscription row. Redirected to /. App shell visible (no UnverifiedBlocker — OAuth users are pre-verified).
result: [pending]

### 21. View Profile (GET /me)

expected: Logged in, GET /api/v1/iam/me (or rely on whatever UI surfaces it). Response 200 returns user row with email, name, timezone, hasPassword (true for email/password users, false for Google-only), age_confirmed_at, email_verified_at. NO password hash, NO sensitive internal fields.
result: [pending]

### 22. Update Timezone (in Settings)

expected: In /settings/account, change timezone dropdown to a different valid IANA zone (e.g., Europe/Lisbon). Submit. PATCH /api/v1/iam/me returns 200. Reload — new timezone persisted. Invalid timezone strings rejected with validation_failed 400.
result: [pending]

### 23. Settings — /settings Redirect

expected: Visit /settings directly. Browser is redirected (server-side) to /settings/account. Status 307/308.
result: [pending]

### 24. Settings — Em Breve Placeholders

expected: Visit /settings/notifications, /settings/billing, /settings/privacy, /settings/data (any non-account section). Each renders the EmBreveCard placeholder ("Em breve" + body + back link to /settings/account). Visiting /settings/nonexistent returns 404.
result: [pending]

### 25. Legal Terms Stub

expected: Visit /legal/terms (works while logged out, while logged in unverified, AND while logged in verified — unrestricted). Page renders "Em construção. Versão atual: v{policy_version}" with the active policy version label. Reachable from signup form's "Termos de uso" link.
result: [pending]

### 26. Legal Privacy Stub

expected: Same as Test 25 but at /legal/privacy. Active policy version label rendered. Reachable from signup form's "Política de Privacidade" link.
result: [pending]

### 27. Signup Form — T&C + Privacy Hyperlinks With Version

expected: On /auth/signup, the consent checkboxes have hyperlinks: "Termos de uso (v2026-04-25.1)" → /legal/terms and "Política de Privacidade (v2026-04-25.1)" → /legal/privacy. Version label format `(v...)` matches the active policy_versions row. Clicking opens the legal pages without losing form state (or in a new tab — either is fine).
result: [pending]

### 28. Signup Form — Blocks Without Consent

expected: On /auth/signup, fill everything EXCEPT one of: age checkbox, T&C checkbox, Privacy checkbox. Try to submit. Form does not submit (HTML5 required). If you bypass client-side and POST to /api/v1/iam/signup with any of those fields false/missing, server returns 400 validation_failed.
result: [pending]

### 29. Authed-and-Verified User Redirected From /auth/login

expected: While logged in AND verified, visit /auth/login (or /auth/signup). The (public) layout detects the verified session and redirects to /. You should not be able to see the login form while already authenticated.
result: [pending]

## Summary

total: 29
passed: 0
issues: 3
pending: 26
skipped: 0
blocked: 0

## Gaps

- truth: "Cold start renders /auth/login cleanly; PublicLayout's session probe handles the no-session / stale-cookie case without throwing"
  status: failed
  reason: "User reported: login page is rendered but there's a nextjs issue: Console AuthApiError — Invalid Refresh Token: Refresh Token Not Found. Stack traces through @supabase/auth-js GoTrueClient and PublicLayout. Next.js 16.2.3 (Turbopack)."
  severity: major
  test: 1
  root_cause: "Two-layer cause. PRIMARY: @supabase/auth-js 2.104.1 calls console.error inside _recoverAndRefresh() when getCurrentUserFromSessionReadOnly() probes a stale cookie; the error is logged (not thrown) and Next.js 16's dev overlay attributes the SSR console output to the React owner stack (PublicLayout). COMPOUNDING: src/proxy.ts has no @supabase/ssr middleware-level cookie-refresh step — Server Components only see the read-only client whose no-op setAll blocks _removeSession() from clearing the bad cookie, so the failed refresh + console.error recur on every render."
  artifacts:
    - path: "src/proxy.ts:96-119"
      issue: "Missing the standard @supabase/ssr middleware-level cookie-refresh step (createServerClient + getUser + setAll cookies merged into NextResponse). Structural gap that lets stale cookies reach Server Components."
    - path: "src/contexts/iam/infrastructure/supabase-server.ts:39-53"
      issue: "Read-only client's no-op setAll is correct for Pitfall 6, but combined with the missing middleware step prevents auth-js's _removeSession() from clearing bad cookies"
    - path: "src/contexts/iam/infrastructure/auth/auth-adapter.ts:216-225"
      issue: "getUserBySession destructures only data.user and ignores error — no observability into auth-js errors that surface as console.error"
  missing:
    - "Add @supabase/ssr cookie-refreshing middleware step in src/proxy.ts for non-API page routes — request-scoped read-write createServerClient, single supabase.auth.getUser() call, merge cookies into NextResponse via setAll"
    - "Have auth-adapter.getUserBySession read the error field from auth.getUser() and tag any AuthApiError on Sentry as belt-and-braces observability"
  debug_session: ".planning/debug/publiclayout-auth-refresh-token-throw.md"

- truth: "POST /api/v1/iam/signup with valid organic-signup body returns 200 and lands the user on UnverifiedBlocker"
  status: failed
  reason: "User reported: Error: Não foi possível concluir agora. POST /api/v1/iam/signup 500 in 3.3s (next.js: 229ms, proxy.ts: 11ms, application-code: 3.1s)"
  severity: blocker
  test: 2
  root_cause: "await inngest.send(...) at signup.ts:139 throws because the Inngest SDK runs in 'cloud' mode and tries to deliver to inngest.com with the placeholder key 'your-event-key' from .env:22. The thrown error is then swallowed by a bare catch {} at signup/route.ts:99-101 which emits the generic pt-BR 500 the user sees. The 3.1s of application-code time matches the SDK's retryWithBackoff (100+200+400+800ms ≈ 1.5s + 4–5 network attempts to inngest.com)."
  artifacts:
    - path: "src/app/api/v1/iam/signup/route.ts:99-101"
      issue: "Bare catch {} swallows the original error and emits a generic 500 with 'Não foi possível concluir agora.' — hides the failure from logs and Sentry"
    - path: "src/contexts/iam/application/signup.ts:139"
      issue: "await inngest.send(...) is awaited inline AFTER DB tx commits — a transient Inngest fault 500s a signup whose DB writes are already irrecoverable"
    - path: "src/shared/inngest/client.ts:5-9"
      issue: "Inngest client has no isDev flag and no baseUrl; mode is determined entirely by env vars (without INNGEST_DEV=1, mode = 'cloud')"
    - path: "/Users/machado/Projects/folhario/.env:22"
      issue: "INNGEST_EVENT_KEY='your-event-key' is a literal template placeholder — truthy and non-undefined, so it defeats the SDK's missing-key fast-fail"
    - path: "package.json (dev script) and .env.local"
      issue: "Neither sets INNGEST_DEV=1 for local dev. playwright.config.ts:77 sets it for the Playwright webServer — that's why integration/E2E pass but human UAT fails"
    - path: "src/shared/config/server-env.ts"
      issue: "Does not declare or document INNGEST_DEV, so developers have no env-validation cue that local dev needs it"
  missing:
    - "Quickwin: set INNGEST_DEV=1 in .env (or in the dev script) to mirror playwright.config.ts:77 so local dev inngest.send is no-op'd against the dev server"
    - "Decouple email dispatch from the signup write-path — wrap the inngest.send call in try/catch with Sentry.captureException (or fire-and-forget) so a transient delivery fault never 500s a signup whose DB writes already committed"
    - "Replace the bare catch {} at signup/route.ts:99-101 with Sentry.captureException(err) before returning the generic 500 so future failures are not silently swallowed"
    - "Apply the same pattern to forgot-password and oauth-complete route handlers if they share the same shape"
  debug_session: ".planning/debug/signup-route-500.md"

- truth: "POST /api/v1/iam/signup with valid active partner_code body returns 200 and applies 30-day trial"
  status: failed
  reason: "User reported: same issue as before — signup endpoint returns 500"
  severity: blocker
  test: 3
  related_to: 2
  root_cause: "Same as gap test 2 — Inngest cloud-mode delivery failure swallowed by bare catch {} in signup route. Partner_code branch is reached but never matters because inngest.send fails after the DB tx commits regardless of whether trial_source was 'organic' or 'partner'."
  artifacts: []
  missing:
    - "Fix for test 2 resolves this gap by symmetry — no additional work"
  debug_session: ".planning/debug/signup-route-500.md"
