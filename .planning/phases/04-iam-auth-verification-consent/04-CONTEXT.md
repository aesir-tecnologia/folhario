# Phase 4: IAM — Auth, Verification, Consent - Context

**Gathered:** 2026-04-26 (power mode)
**Status:** 27/30 answered — 3 open questions to resolve before plan-phase
**Source:** Synthesized from `.planning/phases/04-iam-auth-verification-consent/04-QUESTIONS.json` (90% answered, all unanswered set to "Other" without text)

<domain>
## Phase Boundary

A Brazilian beginner can sign up with email+password or Google OAuth, confirm age ≥13, accept T&C + privacy policy, receive + click a pt-BR verification email from Resend, and land in the app shell with the verification gate lifted. The Settings shell exists with an "Account" section so profile basics, password change, timezone editing, and per-device logout work end-to-end.

This phase ALSO onboards two infrastructure services because Phase 4 is their first consumer:

- **Inngest** — `serve()` handler at `/api/inngest/route.ts` plus all 8 MVP function registrations (only `notifications/send-email` is fully implemented in Phase 4; the other 7 are stub-registered).
- **Resend + React Email** — pt-BR transactional email backbone with verification + password-reset templates as the launch templates; later phases add more.

**Explicitly NOT in scope for Phase 4:**

- Subscription state-machine logic beyond initial `trialing` row + `trial_end_date` derivation (Phase 10 owns transitions, webhooks, dunning, read-only mode)
- Push notifications and `PushSubscription` provisioning (Phase 8)
- LGPD data export + 7-day deletion grace orchestration (Phase 11)
- Identification third-party consent modal (Phase 6)
- Settings sections beyond Account: Notifications (Phase 8), Subscription & billing (Phase 10), Privacy & LGPD (Phase 11), Needs attention (Phase 9)
- Change-email / logout-all-devices (post-MVP, captured in REQUIREMENTS.md "v2" backlog)
- Verified production email-sending domain on Resend (Phase 12 alongside Vercel project setup)

</domain>

<decisions>
## Implementation Decisions

### Supabase Auth Integration Boundary

- **D-01 (Q-01):** Auth backend = **Supabase Auth (full)**. Use `supabase.auth.signUp` / `signInWithPassword` / `signInWithOAuth` / `updateUser` / `admin.*` end-to-end. Accept Supabase-issued JWT verified via Phase 2 D-33 JWKS. Lean on Supabase OAuth for Google. Phase 4 wires custom email dispatch via Auth Hooks (D-02 below). Minimal divergence from Phase 2 commitments.
- **D-02 (Q-02): ⚠ OPEN — see Open Questions below.** Email dispatch path (Supabase Auth Hook → Inngest → Resend, custom SMTP, or fully custom tokens) — load-bearing decision; entangled with D-06.
- **D-03 (Q-03):** **Application-level signup endpoint orchestrates everything.** `POST /api/v1/iam/signup` calls `supabase.auth.admin.createUser`, then in the same DB transaction writes `public.users` (full row with age_confirmed_at, timezone, partner_code, trial_source) + ConsentLog × 2 (D-24) + Subscription (status=trialing). Phase 2 D-35 trigger remains as **safety net only** (fires only if no `public.users` row exists for the auth.users id). Explicit, transactional, debug-friendly. Keeps repository ownership clean.
- **D-04 (Q-04):** **Mandatory post-callback completion screen for Google OAuth.** After Google OAuth callback, route to `/auth/oauth-complete`. Page collects age confirmation ≥13, T&C acceptance, privacy-policy acceptance, timezone (auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`, editable), and optional partner code. Submitting writes the missing `public.users` fields + ConsentLog × 2 + Subscription. Until submitted, every other route redirects back to `/auth/oauth-complete`. Tracked via `User.age_confirmed_at IS NULL` ⇒ incomplete; gate page checks this column.
- **D-05 (Q-05):** **Per-device JWT semantics: Supabase session = device.** Each Supabase auth session represents one device. Logout calls `supabase.auth.signOut({scope: 'local'})` killing only this session's refresh token. Phase 8 will tie `PushSubscription.device_id` to session_id. JWT shape unchanged from Phase 2 (Supabase JWT only, no custom claims for device_id).

### Email Verification Flow

- **D-06 (Q-06): ⚠ OPEN — see Open Questions below.** Verification token mechanism (Supabase confirmation_token via verifyOtp, custom verification_tokens table, or magic-link OTP) — entangled with D-02.
- **D-07 (Q-07):** **Server route `/auth/verify?token=...` validates and redirects.** Server-side handler validates token via `supabase.auth.verifyOtp`, sets `public.users.email_verified_at`, redirects to `/`. Server-side handler keeps the verification check off the client and gives us a clean place to fire PostHog `signup_completed` server-side via `posthog-node`.
- **D-08 (Q-08):** **Resend-verification invalidates prior token, mints new.** Calls `supabase.auth.resend({type: 'signup'})` which invalidates the prior token and emits a new one (single-token-active rule). Combine with per-user rate-limit (1 resend per minute) using the same throttle backend as D-12 to defend against email-flood + Resend cost spike.

### Password Reset Flow

- **D-09 (Q-09):** **Supabase `resetPasswordForEmail` (built-in) for token mechanism.** Supabase issues + hashes + expires the reset token. Configure Supabase token expiry to 1h (per AUTH-11). Auth Hook from D-02 renders the email body with our pt-BR React Email template + sends via Resend. Single token mechanism shared with verification.
- **D-10 (Q-10):** **Server route `/auth/reset?token=...` renders new-password form.** Server-side route renders the new-password form (current-password NOT required for reset flow), submitting to `POST /api/v1/iam/password/reset` which validates the token + updates the password via `supabase.auth.updateUser`. Brand UX, full pt-BR. Existing JWTs remain valid (no global revocation per AUTH-11/AUTH-12).
- **D-11 (Q-11):** **"Always 200" implementation: enqueue first, look up later.** `POST /api/v1/iam/password/reset-request` immediately responds 200 + emits `iam/password-reset-requested` Inngest event with the email. Inngest function looks up user → if exists AND has password (not OAuth-only) → trigger Supabase `resetPasswordForEmail` (Auth Hook → Resend). Async, no timing-attack signal, no enumeration leak.

### Per-IP Auth Throttle

- **D-12 (Q-12):** **Postgres atomic counter table for throttle storage.** Table `auth_throttle (ip TEXT, endpoint TEXT, window_start INT8, count INT, PRIMARY KEY (ip, endpoint, window_start))`. UPSERT pattern: `INSERT ... ON CONFLICT (ip, endpoint, window_start) DO UPDATE SET count = auth_throttle.count + 1 RETURNING count`. No new dependency. Cleanup via Inngest cron (or partial index TTL). IP source: `x-forwarded-for` first hop (Vercel sets this).
- **D-13 (Q-13):** **Fixed bucket per minute** for throttle window. `window_start = floor(now / 60s)`. Primary key `(ip, endpoint, window_start)` makes the UPSERT trivial. Boundary-burst risk accepted as practical-impact-low.
- **D-14 (Q-14):** **Thresholds: 5 attempts/minute per (ip, endpoint), lockout for 5 minutes after.** Strict but tolerant. CGNAT shared IPs (common in Brazil) may occasionally trip — mitigated by 5-minute lockout (not hours).
- **D-15 (Q-15):** **Failed-only counting.** Increment counter only on failed signup (validation/dup-email/Supabase reject), failed login (`invalid_credentials` 401), or failed OAuth callback (Supabase OAuth error). Successful logins do not consume the failure budget (per AUTH-10).

### Inngest Onboarding (first async consumer)

- **D-16 (Q-16):** **Phase 4 implements only `notifications/send-email`; stubs the other 7 MVP functions.** Phase 4 fully implements `notifications/send-email` (consumes Auth Hook event → Resend). The other 7 functions (`care-guide/augment`, `iam/process-deletion`, `iam/generate-export`, `billing/process-webhook`, `billing/trial-ending-notifier`, `reminders/dispatch`, `notifications/send-push`) are stub-registered with handlers that return `{status: 'not_implemented'}`. Inngest dashboard shows the full topology immediately. Each later phase replaces its stub with a real handler.
- **D-17 (Q-17):** **Per-context exports + central registry pattern.** Each context exports `src/contexts/{ctx}/inngest/functions.ts` returning an array of Inngest functions. `src/shared/inngest/registry.ts` imports each context's array and concatenates. `src/app/api/inngest/route.ts` calls `serve({ functions: registry })`. Clean ownership per Phase 2 D-01 / PRD §3, single serve().

### Resend & React Email Onboarding

- **D-18 (Q-18):** **`@react-email/components` only (no preview server).** Install `@react-email/components`. Templates live as `.tsx` and render via `render(<Template />)`. No local preview server in Phase 4 — iterate via render-to-stdout in dev or hit the actual Resend sandbox. Minimal Phase 4 surface; preview server (`react-email dev`) can be added later if copy iteration friction is high.
- **D-19 (Q-19):** **From address = `onboarding@resend.dev` (Resend sandbox).** Works out-of-the-box for Phase 4 dev/CI/preview. Resend sandbox restricts recipient domain to the account owner's verified email. Production swap to a verified domain (e.g. `noreply@folhario.com.br`) lands in Phase 12 alongside the Vercel project + production env vars.
- **D-20 (Q-20):** **Local dev console-logs payload; CI uses sandbox key.** Local dev with `RESEND_API_KEY` empty → adapter logs full payload (template name, props, to/from/subject, rendered HTML preview) to stdout. Devs verify content visually. CI sets `RESEND_API_KEY` to the Resend sandbox key, sends to a fixed test recipient (founder's email or a Resend webhook capture). Minimizes Resend quota burn from local iteration.

### Verification Gate Enforcement

- **D-21 (Q-21):** **API: shared `requireVerifiedUser()` helper. UI: server-component check at root layout.** API layer: `requireVerifiedUser(req)` helper called explicitly by every gated handler (returns `email_unverified` 403 if not verified). UI layer: a server component at the App Router root layout reads the user state and renders either children or `<UnverifiedBlocker />` (full-screen blocker per AUTH-15: "Verifique seu e-mail para começar." + resend-verification button + logout link). `src/proxy.ts` stays focused on locale routing only (per Phase 1 D-24).
- **D-22 (Q-22):** **`public.users.email_verified_at` is the source of truth; read on every gated request.** On verification (D-07 server route), set `public.users.email_verified_at` (and confirm `auth.users.email_confirmed_at` is set by Supabase). Every gated request reads from `public.users` via the IAM repository — always fresh. ~5-10ms DB roundtrip per request is acceptable for an auth check; if hot-path latency needs reduction, add a 60s in-memory cache keyed by JWT id.
- **D-23 (Q-23):** **Allowlist (default deny).** Single config: `UNVERIFIED_ALLOWED_PATHS = ['/api/v1/iam/resend-verification', '/api/v1/iam/me', '/api/v1/iam/me/password', '/api/v1/iam/logout', '/auth/verify', '/auth/oauth-complete', ...]`. Every new endpoint must opt-in by being added to the allowlist; default behavior is to require verification. Safest by default.

### ConsentLog & Signup Atomicity

- **D-24 (Q-24):** **Two ConsentLog rows recorded at signup.** INSERT (purpose=`terms_of_service`, legal_basis=`contract`, source=`signup`, policy_version=current) and (purpose=`privacy_policy`, legal_basis=`contract`, source=`signup`, policy_version=current). Granular, auditable, future-proof for material-change re-consent (PRD §13 Governance). `policy_version` resolved at signup time via `SELECT id FROM policy_versions WHERE is_current = true` (Phase 2 D-13 already supports `is_current`). Same two rows captured for OAuth users in D-04's completion screen.
- **D-25 (Q-25): ⚠ OPEN — see Open Questions below.** Signup transaction atomicity (two-phase Supabase-then-DB-tx, single tx including auth.users via SQL, or saga compensation) — load-bearing for failure-mode behavior; partly entangled with D-03.

### Settings Shell

- **D-26 (Q-26):** **Sub-routes `/settings/[section]`.** Routes: `/settings/account`, `/settings/notifications`, `/settings/subscription`, `/settings/privacy-lgpd`, `/settings/needs-attention`, `/settings/app-info`. `/settings` root redirects to `/settings/account`. Deep-linkable. Cleaner code split. Phase 4 implements `account` fully (change password, timezone, logout) and renders the others as placeholders per D-27.
- **D-27 (Q-27):** **Brand-consistent "Em breve" card per not-yet-built section.** Each placeholder route renders a Warm Ivory Surface card with the section title in Source Serif 4 + a Calm Slate body line ("Em breve" or section-specific stub message) + back-to-Settings link. Visible scaffolding, no fake controls. Matches design-system primitives from Phase 3.

### Testing & Copy Ownership

- **D-28 (Q-28):** **Real local Supabase Auth in integration tests.** Each integration test seeds users via `supabase.auth.admin.createUser` against the local Docker Supabase stack. Test helper truncates `auth.users` + `public.users` between tests (transaction rollback per Phase 2 D-43 doesn't cover auth.users since it's a separate Postgres logical schema; use TRUNCATE for auth-bearing tests). Highest fidelity; matches no-DB-mocking rule from Phase 1 D-25 + Phase 2.
- **D-29 (Q-29):** **Mock Resend SDK in unit/integration; one E2E hits sandbox.** Unit + integration tests use `vi.mock('resend')` and assert call args (template id/component, props, to/from/subject). One Playwright E2E spec optionally hits Resend sandbox + verifies a delivery webhook. Fast, deterministic, low quota burn.
- **D-30 (Q-30):** **Claude proposes initial pt-BR drafts; founder reviews + edits during plan execution.** Claude writes initial drafts in `messages/pt-BR.json` (next-intl) + email template `.tsx` files based on PRD §17 tone (warm, humanist, Brazilian, anti-textbook — "sunlit morning on a Brazilian veranda"). Founder reviews during Phase 4 execution and refines specific phrases. Speed + founder control.

### Claude's Discretion

The agent has discretion on (within the locks above):

- Exact field names + Zod schemas for request bodies on signup/login/reset/change-password endpoints (within the closed error-code registry per Phase 1 D-10/D-12)
- Exact pt-BR copy strings (initial drafts; founder reviews per D-30)
- Exact React Email component hierarchy + email layout (within Paper Cream brand tokens from PRD §17)
- Exact `auth_throttle` cleanup cadence (Inngest cron schedule frequency)
- Whether the "User.timezone editable" UI in Settings → Account uses an IANA picker dropdown or a simple text field with validation (Phase 8 reminders depend on this being correct)
- The exact list of additional paths beyond AUTH-02's three categories that should be in `UNVERIFIED_ALLOWED_PATHS` (e.g. /auth/* sub-routes, static asset routes)
- File splits inside `src/contexts/iam/{domain,application,infrastructure,api,inngest}/` provided D-01 ownership and D-17 inngest-functions pattern are preserved

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product + scope
- `.planning/PROJECT.md` — Core value (<2 min from email verification), constraints, key decisions, launch blockers (DPO + privacy policy gate Phase 4 going live)
- `.planning/REQUIREMENTS.md` — AUTH-01..15 + INFRA-10 + NOTIF-01,02 + UI-13 (19 requirements total for Phase 4)
- `.planning/ROADMAP.md` §Phase 4 — Goal + 5 success criteria

### Auth, verification, consent (PRD)
- `docs/CAVE-PRD.md` §1 — "Value <2 min from email verification" non-negotiable; clock starts at verification, not signup
- `docs/CAVE-PRD.md` §3 — Bounded contexts table; IAM aggregates (User, ConsentLog, PartnerStore, DataExportRequest, DataDeletionRequest); Inngest functions list (8 MVP)
- `docs/CAVE-PRD.md` §4 — Data model: User (with timezone, notification_time_local, age_confirmed_at, deletion_requested_at), ConsentLog (purpose, legal_basis, policy_version, source), Subscription (status enum, trial_source, trial_end_date)
- `docs/CAVE-PRD.md` §5 — CLOSED error-code registry; relevant codes: `unauthenticated`, `token_expired`, `invalid_credentials`, `forbidden`, `email_unverified`, `validation_failed`, `invalid_partner_code`, `consent_required`, `rate_limited`
- `docs/CAVE-PRD.md` §12 Auth — Email+password OR Google OAuth; verification gate; per-device JWT; signup form fields; partner codes; subscription state machine (trial → active/expired); credential management (password reset 1h hashed token, change password current+new, OAuth-only hides controls)
- `docs/CAVE-PRD.md` §13 LGPD — Legal basis table (Account/auth = contract; identification 3rd-party = consent; push = consent); Art. 14 children (≥13 mandatory); Art. 7 consent demonstration; ConsentLog purpose + policy_version + source semantics
- `docs/CAVE-PRD.md` §14 Multi-Device — Per-device JWT independently revocable; per-device PushSubscription (Phase 8 dependency); logout this device only
- `docs/CAVE-PRD.md` §16 Screens — Settings sections (Account, Notifications, Subscription & billing, Privacy & LGPD, Needs attention, App info); unverified-email blocker copy
- `docs/CAVE-PRD.md` §20 — Resend triggers table (verification + password reset land in Phase 4); env vars (`INNGEST_*`, `RESEND_*`); local dev commands (`npx inngest-cli dev`); PostHog event taxonomy (`signup_completed`, `consent_granted`)
- `docs/CAVE-PRD.md` §21 Security — JWT verified in middleware on `/api/v1/*`; per-IP throttle on signup/login/OAuth; Sentry PII scrubbing (Phase 1 D-22 already wired)
- `docs/CAVE-PRD.md` §23 Acceptance criteria — AC-AUTH-001..007 (testable assertions for Phase 4 verification)

### Prior phase patterns (locked decisions to honor)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-07 path aliases, D-08 no barrels, D-10/D-11/D-12 error registry, D-22 Sentry scrubbing (no email in breadcrumbs), D-24 src/proxy.ts is locale-only (security headers in next.config), D-25 Postgres 17, D-29 server-env vs client-env split
- `.planning/phases/02-data-layer/02-CONTEXT.md` — D-01 per-context schema ownership, D-13 IdentificationLimit + ProviderBudget seeded (Phase 6 dependency, not Phase 4 work), D-14 runtime DB client `{ prepare: false }`, D-16 functional repositories, D-19 drizzle-zod refined schemas, D-20/D-21/D-22 RLS strategy (`auth.uid()` ownership), D-32 AuthAdapter scope (JWT verify + getUserById in Phase 2; Phase 4 expands), D-33 JWKS verification with `jose` against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, D-35 auth.users → public.users insert trigger (Phase 4 makes it a safety net per D-03), D-36 cursor pagination, D-37 idempotency_keys table, D-43 transaction-rollback test pattern, D-44 hybrid auth-test posture, D-45 Playwright + smoke-route JWT validation
- `.planning/phases/02-data-layer/02-04-PLAN.md` (when written) — Seed data including `policy_versions.is_current` (D-24 reads from this)
- `.planning/phases/02-data-layer/02-07-PLAN.md` (when written) — AuthAdapter Phase 2 scope; Phase 4 extends

### Code anchors (existing artifacts)
- `package.json` — Stack pins (next 16.2.3, react 19.2.5, supabase 2.95.0, postgres 3.4.9, zod 4.3.6); add: `inngest`, `@react-email/components`, `resend`
- `src/shared/config/server-env.ts` — Add `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` per PRD §20
- `src/shared/config/errors.ts` — Closed registry; Phase 4 emits `email_unverified`, `invalid_credentials`, `validation_failed`, `invalid_partner_code`, `forbidden`, `consent_required`, `rate_limited`
- `src/contexts/iam/{domain,application,infrastructure,api,inngest}/` — Currently empty (.gitkeep only); Phase 4 fills
- `src/app/api/inngest/route.ts` — Does NOT yet exist; Phase 4 creates per INFRA-10
- `src/proxy.ts` — Locale routing only (Phase 1 D-24 + Phase 2 D-34 may compose auth via runtime helper); D-21 of this phase keeps it locale-only and puts gate in handlers/server-component

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Closed error-code registry** at `src/shared/config/errors.ts` (Phase 1 D-10/D-12) — Phase 4 imports the codes it emits; no new ad-hoc codes
- **Sentry PII scrub module** at `src/shared/telemetry/sentry-scrub.ts` (Phase 1 D-22 / Plan 01-05a) — `email`, `password`, `token`, `Authorization`, `Cookie` already scrubbed; Phase 4's auth flows are protected by default
- **PostHog server provider** at `src/shared/telemetry/posthog-server.ts` (Plan 01-06) — Phase 4 uses for `signup_completed` (server-fired post-verification), `consent_granted` (per ConsentLog row); `Sentry.setUser({ id })` only — never email
- **next-intl** wired with `as-needed` locale prefix (Phase 1 D-15) — Phase 4 adds pt-BR strings to `messages/pt-BR.json` for Settings → Account, signup form, unverified blocker, change-password form, OAuth completion screen
- **Phase 2 AuthAdapter** (D-32) — `verifyJWT` + `getUserById` already work; Phase 4 extends to add: signup orchestration helper, password-reset orchestration helper, change-password helper, logout helper, OAuth completion helper
- **Phase 2 idempotency_keys table** (D-37/D-38) — POST /api/v1/iam/* mutating endpoints (signup, password-reset-request, change-password) wear `Idempotency-Key` headers per Phase 2 conventions
- **Phase 2 RLS posture** (D-20/D-21/D-22) — `users` table has owner-only RLS; Phase 4 reads/writes go through service role for admin operations and through user JWT for self-service operations

### Established Patterns
- **No Drizzle in route handlers** (Phase 2 D-17) — Phase 4 IAM api/ files are thin: validate (Zod) → call use-case → map HTTP. Use-cases live in `src/contexts/iam/application/`. Repositories in `src/contexts/iam/infrastructure/db/`
- **Single shared error-response shape** `{error: {code, message, details?}}` (Phase 1 D-11) — every Phase 4 handler returns this on failure
- **Per-context schema ownership** (Phase 2 D-01) — Phase 4 owns `src/contexts/iam/infrastructure/db/schema.ts` for User + ConsentLog (PartnerStore + DataExportRequest + DataDeletionRequest are IAM aggregates per PRD §3 — but only User + ConsentLog are written-to in Phase 4; PartnerStore is read-only seed data; DataExport/Deletion land Phase 11)
- **Inngest event flow (NEW in Phase 4)** — Cross-context events flow through Inngest. Phase 4 emits `user.signed_up`, `user.consent_granted`, `user.consent_revoked` (consent revoke flows partly here; full panel is Phase 11). Phase 4 consumes `subscription.status_changed` (later phases emit; Phase 4 just registers the listener as stub)

### Integration Points
- `src/app/api/v1/iam/signup/route.ts` — POST signup (per D-03) — orchestrates Supabase admin createUser + DB tx + Inngest event emission
- `src/app/api/v1/iam/login/route.ts` — POST login — Supabase signInWithPassword + per-IP throttle (D-12..D-15)
- `src/app/api/v1/iam/logout/route.ts` — POST logout — Supabase signOut local-scope (D-05)
- `src/app/api/v1/iam/resend-verification/route.ts` — POST — Supabase auth.resend signup (D-08)
- `src/app/api/v1/iam/password/reset-request/route.ts` — POST — always-200 enqueue (D-11)
- `src/app/api/v1/iam/password/reset/route.ts` — POST — token-bearing new password (D-09/D-10)
- `src/app/api/v1/iam/me/password/route.ts` — PATCH — change-password (current + new), OAuth-only → 403 forbidden
- `src/app/api/v1/iam/me/route.ts` — GET/PATCH — Settings → Account self-service (timezone edit, name)
- `src/app/auth/verify/route.ts` — GET (server route per D-07) — verify token, set email_verified_at, redirect /
- `src/app/auth/reset/page.tsx` — server-rendered new-password form (D-10)
- `src/app/auth/oauth-complete/page.tsx` — server-rendered OAuth-completion form (D-04)
- `src/app/auth/callback/route.ts` — Supabase OAuth callback handler — per-IP throttle, redirect to oauth-complete or `/`
- `src/app/(unverified)/page.tsx` (or root layout conditional) — full-screen unverified blocker per AUTH-15 (D-21 server-component check)
- `src/app/settings/[section]/page.tsx` — Settings shell + Account section (D-26/D-27)
- `src/app/api/inngest/route.ts` — `serve({functions: registry})` (D-17, INFRA-10)
- `src/app/api/v1/iam/auth-hooks/email/route.ts` (or similar — exact path depends on D-02 outcome) — Supabase Auth Hook receiver that emits Inngest events
- `src/contexts/iam/inngest/functions.ts` — exports `[notificationsSendEmail, ...stubs]`
- `src/contexts/notifications/inngest/functions.ts` — exports `notificationsSendEmail` (full impl in Phase 4)
- `src/contexts/notifications/infrastructure/email-templates/{verification,password-reset}.tsx` — pt-BR React Email templates (D-18)
- `src/contexts/notifications/infrastructure/resend-adapter.ts` — Resend SDK wrapper with dev-mode console-log (D-20)
- `src/shared/inngest/registry.ts` — concatenates per-context arrays (D-17)
- `src/shared/inngest/client.ts` — `new Inngest({id: 'folhario'})`
- `src/contexts/iam/infrastructure/throttle.ts` — `auth_throttle` table accessor (D-12); Drizzle inside repository per Phase 2 D-17

</code_context>

<specifics>
## Specific Ideas

- **OAuth completion is gated by `User.age_confirmed_at IS NULL`** — this same column already exists in PRD §4 data model and Phase 2 schema. No new column needed. Gate page reads from `public.users`; redirect logic in middleware or root layout (server component).
- **Verification email subject (initial draft):** "Confirme seu e-mail para começar — Folhário"
- **Password reset email subject (initial draft):** "Redefinir sua senha — Folhário"
- **Unverified blocker copy** (per AUTH-15 + PRD §16): "Verifique seu e-mail para começar." + "Reenviar e-mail" button + "Sair" link
- **OAuth completion screen copy:** opens with brand greeting acknowledging the user just signed in with Google, then collects the missing fields with the same field labels/copy as the email+password signup form (T&C link, privacy policy link, age checkbox, timezone display+edit, partner code expandable)
- **Brand tone** for emails: warm, humanist, Brazilian, anti-textbook ("sunlit morning on a Brazilian veranda" per PRD §17). Source Serif 4 for headings where email clients support it (system serif fallback); Plus Jakarta Sans body (system sans fallback). Paper Cream background, Canopy Green primary CTA.
- **PostHog `signup_completed` fires server-side** in `/auth/verify` route handler (post-verification), not at signup form submit — clock matches the §1 "<2 min" non-negotiable
- **PostHog `consent_granted` fires** for each ConsentLog row inserted at signup (T&C and privacy_policy purposes) — server-side via posthog-node
- **Throttle cleanup**: Inngest cron `auth-throttle/cleanup` runs hourly, deletes rows older than 1 hour (or older than longest backoff window). Stub-registered alongside other Inngest functions per D-16.

</specifics>

<deferred>
## Deferred Ideas

### Open Questions (load-bearing — must resolve before plan-phase)

These three questions were left as "Other" with no text in the power-mode session. They are entangled and load-bearing for Phase 4 implementation. They should be resolved in a short follow-up discussion (or `/gsd:discuss-phase 4 --update` targeting these IDs) before plan-phase runs:

- **Q-02 (D-02): Email dispatch path.** Three viable options:
  - (a) **Supabase Auth Hooks → Inngest event → Resend** (recommended): cleanest separation; we own rendering + delivery, Supabase owns tokens. Requires configuring Supabase `send_email_hook` to point at our Auth Hook receiver endpoint.
  - (b) **Custom SMTP pointing at Resend**: simplest wiring, but Supabase renders its own HTML — loses pt-BR React Email templates and the single `notifications/send-email` integration point that NOTIF-01 requires.
  - (c) **Disable Supabase emails entirely; mint our own tokens**: full control, abandons Supabase's confirmation_token machinery; entangled with Q-06 below — if (c) here then Q-06 must be (b).
  - **Recommendation:** (a) — preserves NOTIF-01's single integration point, keeps tokens in Supabase, lets us own templates.

- **Q-06 (D-06): Verification token mechanism.** Three viable options:
  - (a) **Supabase confirmation_token via verifyOtp** (recommended): Supabase issues + stores + expires the token; we render the email body. Inherits Supabase default expiry (configurable, default 24h).
  - (b) **Custom verification_tokens table**: own opaque token, sha256-hashed, full expiry control; required only if Q-02 is (c).
  - (c) **Magic-link OTP (6-digit code typed in)**: different UX; not implied by AUTH-01.
  - **Recommendation:** (a) — coupled with Q-02 (a). If Q-02 ends as (c), this must become (b).

- **Q-25 (D-25): Signup transaction atomicity.** Three viable options:
  - (a) **Two-phase: Supabase Auth → DB tx (User + ConsentLog × 2 + Subscription) → Inngest event** (recommended): clean ordering, partial-state risk addressed by compensating delete on auth.users (or by relying on Phase 2 D-35 trigger as backstop).
  - (b) **One DB transaction including auth.users via SQL**: bypasses Supabase's password hashing pipeline; brittle.
  - (c) **Sequential inserts with saga compensation**: complex; only worth it if cross-DB. Overkill here.
  - **Recommendation:** (a) — mirrors D-03's application-level orchestration with explicit compensating-delete on the unlikely path where the DB tx fails after auth.users insert.

### Future-phase deferrals (out of scope for Phase 4)

- **Logout-all-devices (global JWT revocation)** — REQUIREMENTS.md AUTH-v2-02; deferred post-MVP. Phase 4's logout is single-device only.
- **Change-email flow** — REQUIREMENTS.md AUTH-v2-01; deferred post-MVP.
- **Identification third-party consent modal** — Phase 6 first-identification flow.
- **Push permission prompt** — Phase 8 first-reminder-creation flow (per PRD §15 non-negotiable: NEVER at signup, first visit, or first identify).
- **Toxicity disclaimer modal** — Phase 7 first care-guide view.
- **Settings → Notifications section** (global mute, per-plant mute, push permission status) — Phase 8.
- **Settings → Subscription & billing section** (plan, PM, billing history, cancel, reactivate, partner code late entry) — Phase 10.
- **Settings → Privacy & LGPD section** (export, delete, manage consents, DPO contact) — Phase 11.
- **Settings → Needs attention section** (OfflineSyncFailure list with retry/discard) — Phase 9.
- **Verified production email-sending domain on Resend** — Phase 12 alongside Vercel project setup. Phase 4 uses Resend sandbox.
- **Subscription state machine transitions** (trialing → active → past_due → canceled / expired) — Phase 10. Phase 4 only creates the initial `trialing` row.
- **Partner code late entry in Settings** (extend trial from 14d to 30d) — Phase 10. Phase 4 only handles partner code at signup time.
- **Stripe webhook + dunning email** — Phase 10.

### Reviewed but not folded
- *None — no todos cross-referenced for Phase 4*

</deferred>

---

*Phase: 04-iam-auth-verification-consent*
*Context gathered: 2026-04-26 (power mode, 27/30 answered + 3 open questions)*
*Note: Three open questions (Q-02, Q-06, Q-25) are entangled and should be resolved before plan-phase. Recommendations included above.*
