# Phase 4: IAM — Auth, Verification, Consent - Research

**Researched:** 2026-04-26
**Domain:** Authentication, email verification, LGPD consent, transactional email, durable async jobs
**Confidence:** HIGH (all locked decisions verified against current docs; no architectural gaps)

## Summary

Phase 4 is execution-mode research, not architecture exploration. CONTEXT.md locks 30/30 implementation decisions; this document verifies the **current API shapes** of every locked library against Context7 and npm registries, enumerates the **Phase 2 deliverables Phase 4 inherits**, surfaces the one unanswered mechanism question (how Supabase's built-in confirmation email is suppressed), and lays out the validation architecture for the Nyquist gate.

Key verified facts:

1. **`@supabase/auth-helpers-nextjs` is deprecated** [VERIFIED: npm registry — "Package no longer supported"]. The current Next.js App Router path is `@supabase/ssr` 0.10.2 [VERIFIED: npm registry, published 2026-04-09].
2. **Supabase `enable_confirmations = false`** is already set in `supabase/config.toml:219` [VERIFIED: file read]. Combined with `admin.createUser({ email_confirm: true })` from D-03, this guarantees Supabase sends zero auth emails — the application owns 100% of the email surface via Resend [CITED: github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/general-configuration.mdx].
3. **Inngest `serve()` for App Router** ships from `inngest/next` and exports `{ GET, POST, PUT }` from `app/api/inngest/route.ts` [CITED: context7.com/inngest/inngest-js]. Idempotency at the producer is via the `id` field on `inngest.send({ id, name, data })` — duplicate IDs are dropped for 24h [CITED: inngest.com/docs/events].
4. **Resend `react:` send** accepts a React component via function call (not JSX) [CITED: resend.com/docs/send-with-nodejs]. `onboarding@resend.dev` works in sandbox **only** with the account owner's verified email as recipient [CITED: resend.com/docs/dashboard/emails/send-test-emails].
5. **`@supabase/ssr` cookie pattern** is `getAll()` / `setAll()` (NOT the deprecated `get/set/remove` triplet) [CITED: context7.com/supabase/ssr]. Server Components cannot set cookies; only Route Handlers and middleware can.
6. **`auth.signOut({ scope: 'local' })`** terminates only the current device's session [CITED: github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/signout.mdx] — the exact mechanism D-05 requires for AUTH-14 single-device logout.

**Primary recommendation:** Plan 04-01 must be a Phase-2 prerequisite gate task that verifies the AuthAdapter, `users` table (extended for `email_verified_at`), `idempotency_keys`, `policy_versions` with `is_current`, RLS posture, and API-aware proxy are present before any Phase 4 handler work begins. Phase 2 is currently `0/10` complete (per STATE.md), so Phase 4 cannot start until Phase 2 ships.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Supabase Auth Integration Boundary**

- **D-01 (Q-01):** Auth backend = **Supabase Auth (full)**. Use Supabase Auth for credential storage, password hashing, OAuth, JWT issuance, refresh-token sessions, and admin password updates. Phase 4 uses `admin.createUser`, `signInWithPassword`, `signInWithOAuth`, `updateUser`, and `admin.*`; it does **not** use Supabase-hosted auth emails. Accept Supabase-issued JWT verified via Phase 2 D-33 JWKS. Lean on Supabase OAuth for Google. Minimal divergence from Phase 2 commitments.
- **D-02 (Q-02):** **App-owned auth email events → Inngest → Resend.** Do NOT use Supabase Auth email hooks, Supabase SMTP templates, or Supabase-hosted verification/reset emails in Phase 4. Supabase Auth remains the credential/JWT provider; Folhário owns the product email-token layer. Supabase email confirmations stay disabled for the product flow; `public.users.email_verified_at` enforces Folhário verification.
- **D-03 (Q-03):** **Application-level signup endpoint orchestrates everything.** `POST /api/v1/iam/signup` calls `supabase.auth.admin.createUser({ email, password, email_confirm: true })` to create a credential record without Supabase sending email, then in the same application DB transaction writes `public.users` (full row with `email_verified_at = NULL`, age_confirmed_at, timezone, partner_code, trial_source) + ConsentLog × 2 + Subscription (status=trialing) + an `email_verification_tokens` row. After the DB transaction commits, it emits the verification email event and mints/sets the Supabase session for the current device. Phase 2 D-35 trigger remains as **safety net only**. If the DB transaction fails after `auth.users` creation, the endpoint compensates with `supabase.auth.admin.deleteUser(user.id)`.
- **D-04 (Q-04):** **Mandatory post-callback completion screen for Google OAuth.** After Google OAuth callback, route to `/auth/oauth-complete`. Page collects age confirmation ≥13, T&C acceptance, privacy-policy acceptance, timezone, and optional partner code. Submitting writes the missing `public.users` fields + ConsentLog × 2 + Subscription and sets `public.users.email_verified_at` immediately because Google OAuth accounts are treated as pre-verified. Tracked via `User.age_confirmed_at IS NULL` ⇒ incomplete; gate page checks this column.
- **D-05 (Q-05):** **Per-device JWT semantics: Supabase session = device.** Each Supabase auth session represents one device. Web transport may use Supabase SSR cookies or an Authorization bearer depending on the adapter, but Folhário never creates an app-owned server session table. Logout calls `supabase.auth.signOut({scope: 'local'})`. JWT shape unchanged from Phase 2 (Supabase JWT only, no custom claims for device_id).

**Email Verification Flow**

- **D-06 (Q-06):** **Custom `email_verification_tokens` table.** Store only `sha256(token)` plus `user_id`, `expires_at`, `consumed_at`, `created_at`, and `sent_to_email`. Raw tokens exist only in the email URL. Token expiry: 24h. Single active token per user.
- **D-07 (Q-07):** **Server route `/auth/verify?token=...` validates and redirects.** Server-side handler validates the app token hash in a DB transaction, marks the token consumed, sets `public.users.email_verified_at`, redirects to `/`, and fires PostHog `signup_completed` server-side via `posthog-node`.
- **D-08 (Q-08):** **Resend-verification invalidates prior app token, mints new, emits email event.** `POST /api/v1/iam/resend-verification` requires the current authenticated unverified user, revokes prior unused verification tokens, inserts a fresh token, and emits `notifications/email.requested`. Combined with per-user rate-limit (1 resend per minute).

**Password Reset Flow**

- **D-09 (Q-09):** **Custom `password_reset_tokens` table.** Store only `sha256(token)` plus `user_id`, `expires_at`, `consumed_at`, `created_at`, and `sent_to_email`. Token expiry: 1h per AUTH-11. Single active token per user.
- **D-10 (Q-10):** **Server route `/auth/reset?token=...` renders new-password form.** Submitting to `POST /api/v1/iam/password/reset` validates and consumes the app token in a DB transaction, then updates the password via `supabase.auth.admin.updateUserById(user_id, { password })`. Do not call global sign-out/revoke; existing access JWTs remain valid until normal expiry per AUTH-12.
- **D-11 (Q-11):** **"Always 200" implementation: enqueue first, look up later.** `POST /api/v1/iam/password/reset-request` immediately responds 200 + emits `iam/password-reset-requested` Inngest event with the email. Inngest function looks up user → if exists AND has password (not OAuth-only) → revokes prior unused reset tokens, inserts a fresh hashed token, and emits `notifications/email.requested`.

**Per-IP Auth Throttle**

- **D-12 (Q-12):** **Postgres atomic counter table for throttle storage.** Table `auth_throttle (ip TEXT, endpoint TEXT, window_start INT8, count INT, PRIMARY KEY (ip, endpoint, window_start))`. UPSERT pattern: `INSERT ... ON CONFLICT (ip, endpoint, window_start) DO UPDATE SET count = auth_throttle.count + 1 RETURNING count`. IP source: `x-forwarded-for` first hop.
- **D-13 (Q-13):** **Fixed bucket per minute.** `window_start = floor(now / 60s)`. Boundary-burst risk accepted as practical-impact-low.
- **D-14 (Q-14):** **5 attempts/minute per (ip, endpoint), lockout for 5 minutes after.**
- **D-15 (Q-15):** **Signup counts submitted attempts; login/OAuth count failures.** Login increments only on `invalid_credentials`/Supabase reject; successful logins do not consume the failure budget. OAuth callback increments only on Supabase OAuth error.

**Inngest Onboarding (first async consumer)**

- **D-16 (Q-16):** **Phase 4 implements only `notifications/send-email`; stubs the other 7 MVP functions.** The other 7 (`care-guide/augment`, `iam/process-deletion`, `iam/generate-export`, `billing/process-webhook`, `billing/trial-ending-notifier`, `reminders/dispatch`, `notifications/send-push`) are stub-registered with handlers that return `{status: 'not_implemented'}`.
- **D-17 (Q-17):** **Per-context exports + central registry pattern.** Each context exports `src/contexts/{ctx}/inngest/functions.ts` returning an array of Inngest functions. `src/shared/inngest/registry.ts` imports each context's array and concatenates. `src/app/api/inngest/route.ts` calls `serve({ functions: registry })`.

**Resend & React Email Onboarding**

- **D-18 (Q-18):** **`@react-email/components` only (no preview server).** No local preview server in Phase 4.
- **D-19 (Q-19):** **From address = `onboarding@resend.dev` (Resend sandbox).** Production swap to verified domain in Phase 12.
- **D-20 (Q-20):** **Local dev console-logs payload; CI uses sandbox key.** Local dev with `RESEND_API_KEY` empty → adapter logs full payload to stdout. CI sets `RESEND_API_KEY` to the Resend sandbox key, sends to a fixed test recipient.

**Verification Gate Enforcement**

- **D-21 (Q-21):** **API: shared `requireVerifiedUser()` helper. UI: server-component check at root layout.** API helper returns `unauthenticated` 401 when no Supabase JWT/session exists, `email_unverified` 403 when authenticated but `public.users.email_verified_at IS NULL`. UI layer: server component at App Router root layout reads user state and renders either children or `<UnverifiedBlocker />`.
- **D-22 (Q-22):** **`public.users.email_verified_at` is the product source of truth; read on every gated request.** Do not use `auth.users.email_confirmed_at` for product gating because Phase 4 deliberately sets Supabase email confirmation true at credential creation.
- **D-23 (Q-23):** **Allowlist (default deny).** `UNVERIFIED_ALLOWED_PATHS = ['/api/v1/iam/resend-verification', '/api/v1/iam/me', '/api/v1/iam/me/password', '/api/v1/iam/logout', '/auth/verify', '/auth/oauth-complete', ...]` plus public auth paths.

**ConsentLog & Signup Atomicity**

- **D-24 (Q-24):** **Two ConsentLog rows recorded at signup.** INSERT (purpose=`terms_of_service`, legal_basis=`contract`, source=`signup`, policy_version=current) and (purpose=`privacy_policy`, legal_basis=`contract`, source=`signup`, policy_version=current). `policy_version` resolved at signup time via `SELECT id FROM policy_versions WHERE is_current = true`.
- **D-25 (Q-25):** **Two-phase Supabase Auth → DB transaction with compensating delete.**

**Settings Shell**

- **D-26 (Q-26):** **Sub-routes `/settings/[section]`.** Routes: `/settings/account`, `/settings/notifications`, `/settings/subscription`, `/settings/privacy-lgpd`, `/settings/needs-attention`, `/settings/app-info`. `/settings` root redirects to `/settings/account`.
- **D-27 (Q-27):** **Brand-consistent "Em breve" card per not-yet-built section.** Each placeholder route renders a Warm Ivory Surface card.

**Testing & Copy Ownership**

- **D-28 (Q-28):** **Real local Supabase Auth in integration tests.** Use TRUNCATE for auth-bearing tests since Phase 2 D-43 transaction rollback doesn't cover `auth.users`.
- **D-29 (Q-29):** **Mock Resend SDK in unit/integration; one E2E hits sandbox.**
- **D-30 (Q-30):** **Claude proposes initial pt-BR drafts; founder reviews + edits during plan execution.**

### Claude's Discretion

- Exact field names + Zod schemas for request bodies on signup/login/reset/change-password endpoints (within the closed error-code registry per Phase 1 D-10/D-12)
- Exact pt-BR copy strings (initial drafts; founder reviews per D-30)
- Exact React Email component hierarchy + email layout (within Paper Cream brand tokens from PRD §17)
- Exact `auth_throttle` cleanup cadence (Inngest cron schedule frequency) — UI-SPEC sets `cron: '17 * * * *'`
- Whether the "User.timezone editable" UI in Settings → Account uses an IANA picker dropdown or a simple text field with validation — UI-SPEC sets text-input-with-autocomplete
- The exact list of additional paths beyond AUTH-02's three categories that should be in `UNVERIFIED_ALLOWED_PATHS` — UI-SPEC fixes the list
- File splits inside `src/contexts/iam/{domain,application,infrastructure,api,inngest}/` provided D-01 ownership and D-17 inngest-functions pattern are preserved

### Deferred Ideas (OUT OF SCOPE)

- Subscription state-machine logic beyond initial `trialing` row + `trial_end_date` derivation (Phase 10)
- Push notifications and `PushSubscription` provisioning (Phase 8)
- LGPD data export + 7-day deletion grace orchestration (Phase 11)
- Identification third-party consent modal (Phase 6)
- Settings sections beyond Account: Notifications (Phase 8), Subscription & billing (Phase 10), Privacy & LGPD (Phase 11), Needs attention (Phase 9)
- Change-email / logout-all-devices (post-MVP, captured in REQUIREMENTS.md "v2" backlog)
- Verified production email-sending domain on Resend (Phase 12)
- Logout-all-devices (global JWT revocation) — REQUIREMENTS.md AUTH-v2-02
- Change-email flow — REQUIREMENTS.md AUTH-v2-01
- Push permission prompt — Phase 8 first-reminder-creation flow
- Toxicity disclaimer modal — Phase 7 first care-guide view
- Subscription state machine transitions (trialing → active → past_due → canceled / expired) — Phase 10
- Partner code late entry in Settings — Phase 10
- Stripe webhook + dunning email — Phase 10

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
| --- | --- | --- |
| AUTH-01 | Email+password signup creates User row, Subscription `trialing`, dispatches verification email | §Architecture > Signup flow; §Standard Stack (Supabase Auth admin, Inngest event, Resend); §Data Model `email_verification_tokens` |
| AUTH-02 | Unverified user blocked on gated endpoints with `email_unverified` 403; only resend-verification, Settings/account, logout reachable | §Architecture > Verification Gate; D-21/D-23 allowlist; `requireVerifiedUser()` helper; root layout server component |
| AUTH-03 | Google OAuth signup pre-verified; gated endpoints reachable; no verification email sent | §Architecture > OAuth flow; D-04 oauth-complete screen sets `email_verified_at` |
| AUTH-04 | Verification link click sets `email_verified_at`, "value <2 min" clock starts | §Architecture > Verification flow; `/auth/verify?token=...` server route; PostHog `signup_completed` |
| AUTH-05 | Login with email+password using per-device JWT (no server sessions) | §Architecture > Login flow; `signInWithPassword`; D-05 Supabase session = device |
| AUTH-06 | Age confirmation ≥13 mandatory at signup; `User.age_confirmed_at` set only on confirm | §API Contract > POST /api/v1/iam/signup `age_confirmed: true`; OAuth-complete same gate |
| AUTH-07 | Optional partner code captured in `User.partner_code`, surfaced to billing | §API Contract > signup body; Subscription row reads `User.partner_code`; Phase 10 owns trial-extension logic |
| AUTH-08 | Signup captures `Intl.DateTimeFormat().resolvedOptions().timeZone` into `User.timezone` | §Architecture > Signup; client-side detection + server-side validation against IANA list |
| AUTH-09 | Signup records T&C + privacy policy acceptance linked to active `policy_version` in ConsentLog | §Architecture > Signup; D-24 two ConsentLog rows; `policy_versions.is_current` lookup |
| AUTH-10 | Per-IP throttle on signup/login/OAuth callbacks emits `rate_limited` 429; succ logins don't consume failure budget | §Architecture > Rate Limiting; D-12-D-15 Postgres `auth_throttle` table; D-15 attempt-vs-failure semantics |
| AUTH-11 | Password reset request always returns 200 (no enumeration); valid email gets Resend email with 1h hashed token | §Architecture > Password Reset; D-11 enqueue-first; D-09 token storage; Inngest async lookup |
| AUTH-12 | Valid reset token within window → set new password; reused token → `validation_failed`; existing JWTs remain valid | §Architecture > Password Reset; `admin.updateUserById`; no global signOut |
| AUTH-13 | Authed user changes password from Settings (current + new); wrong current → `invalid_credentials` 401; OAuth-only → forbidden | §API Contract > PATCH /api/v1/iam/me/password; `signInWithPassword` reverify pattern; `has_password` derived from `auth.users.encrypted_password` |
| AUTH-14 | User logs out of current device only (revokes that JWT + push sub) | §Architecture > Logout; `signOut({scope: 'local'})` |
| AUTH-15 | Unverified-email full-screen blocker shown in place of app shell | §Architecture > Verification Gate; root layout server component renders `<UnverifiedBlocker />`; UI-SPEC §5 layout |
| INFRA-10 | Inngest `serve()` handler at `/api/inngest/route.ts`; all 8 MVP functions registered | §Architecture > Inngest Onboarding; D-16 1 real + 7 stubs; D-17 per-context exports + registry |
| NOTIF-01 | `notifications/send-email` Inngest function handles all transactional email via Resend | §Architecture > Email Pipeline; D-18-D-20 Resend adapter; React Email render → Resend send |
| NOTIF-02 | React Email templates pt-BR, brand-aligned | §Standard Stack `@react-email/components`; UI-SPEC §7 email visual contract |
| UI-13 | Settings screen — Account section + 5 placeholders | §Architecture > Settings Shell; D-26 sub-routes; D-27 "Em breve" cards; UI-SPEC §6, §8 |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
| --- | --- | --- | --- |
| Signup form rendering | Frontend (Server Component) | Browser (form interactivity) | App Router page; Zod validation client + server; CONTEXT D-01 |
| Signup orchestration (createUser + DB tx + email event) | API / Backend (Route Handler) | DB (Postgres) | D-03 application-level orchestration; transaction boundary on server |
| Email+password login | API / Backend | Browser (cookies) | `signInWithPassword` cookie-driven SSR session; @supabase/ssr |
| Google OAuth callback | API / Backend (Route Handler) | Browser (redirect dance) | Supabase OAuth flow returns to `/auth/callback`; server reads code |
| OAuth completion screen | Frontend (Server Component) + API | Browser | Server-rendered form + API submission; D-04 mandatory before app access |
| Verification gate (API) | API / Backend | DB (read `email_verified_at`) | `requireVerifiedUser()` helper; D-21 |
| Verification gate (UI) | Frontend Server (Server Component) | DB | Root layout server component; D-21 |
| Verification token mint + verify | API / Backend | DB | `email_verification_tokens` table; SHA-256 hash compare |
| Password reset request (always 200) | API / Backend | Inngest (async lookup) | D-11 enqueue-first; user lookup happens inside Inngest function |
| Password reset consume | API / Backend | Supabase Auth (admin) | `admin.updateUserById`; no JWT revocation |
| Change password | API / Backend | Supabase Auth | Reverify current via `signInWithPassword`, then `admin.updateUserById`; D-26 OAuth-only blocked |
| Per-IP rate-limit counter | DB (Postgres) | API | UPSERT-RETURNING in `auth_throttle`; D-12 |
| Inngest function dispatch | Inngest (server async) | API (event emission) | `inngest.send()` from API handlers; `serve()` handler receives webhooks |
| Email rendering | Inngest function (Node) | Resend (SaaS) | React Email `render()` inside `notifications/send-email`; Resend SDK ships |
| Email sending | Resend (SaaS) | Inngest function | `resend.emails.send({ react })` |
| Settings shell | Frontend (Server Component) | API | App Router `/settings/[section]` sub-routes |
| ConsentLog write | API / Backend | DB | Inside signup transaction + OAuth-complete transaction |

**Why this matters:** Every IAM capability lands at the API tier first (route handler), with the database providing concurrency-safe state and Inngest providing durable async dispatch. The Frontend Server tier is constrained to UI rendering + the verification gate (root layout); no business logic lives there. The Browser tier owns only form interactivity and `Intl.DateTimeFormat()` timezone detection — no auth logic, no token handling.

## Standard Stack

### Core (already pinned in `package.json`)

| Library | Version | Purpose | Why Standard |
| --- | --- | --- | --- |
| `next` | 16.2.3 [VERIFIED: package.json] | App Router, Route Handlers, server components | Project lock; phase inherits |
| `react` | 19.2.5 [VERIFIED: package.json] | UI runtime | Project lock |
| `zod` | 4.3.6 [VERIFIED: package.json] | Request body validation | Phase 1 D-10 lock |
| `next-intl` | 4.9.1 [VERIFIED: package.json] | pt-BR strings | Phase 1 D-15 lock |
| `postgres` | 3.4.9 [VERIFIED: package.json] | Postgres driver with `{ prepare: false }` | Project lock for Supavisor txn pooler |
| `posthog-node` | 5.29.7 [VERIFIED: package.json] | Server-side `signup_completed` + `consent_granted` events | Phase 1 lock |

### Core (NEW Phase 4 additions)

| Library | Version | Purpose | Why Standard |
| --- | --- | --- | --- |
| `inngest` | 4.2.4 [VERIFIED: npm registry, published 2026-04-15] | Durable async functions + cron + step.sleepUntil | Project lock from CLAUDE.md; first consumer is verification email |
| `resend` | 6.12.2 [VERIFIED: npm registry, latest] | Transactional email send via API | Project lock from CLAUDE.md; Phase 4 first consumer |
| `@react-email/components` | 1.0.12 [VERIFIED: npm registry, latest stable] | React-based email template primitives (Html, Body, Container, Button, etc.) | Phase 4 D-18; renders to email-client-safe HTML |
| `@supabase/ssr` | 0.10.2 [VERIFIED: npm registry, published 2026-04-09] | Cookie-based Supabase Auth client for App Router | **`@supabase/auth-helpers-nextjs` is deprecated** [VERIFIED: npm registry "Package no longer supported"]; `@supabase/ssr` is the supported replacement |
| `@supabase/supabase-js` | 2.104.1 [VERIFIED: npm registry] | Underlying SDK; required by `@supabase/ssr`; admin operations (`admin.createUser`, etc.) use this directly | Inherited from Phase 2 D-32; Phase 4 extends |

### Supporting (already in stack from Phase 2)

| Library | Version | Purpose | When to Use |
| --- | --- | --- | --- |
| `drizzle-orm` | 0.45.2 [VERIFIED: npm registry] | Schema + repository queries | Adding `email_verification_tokens`, `password_reset_tokens`, `auth_throttle` tables; extending `users` with `email_verified_at` |
| `drizzle-kit` | 0.31.10 [VERIFIED: npm registry] | Migration generation + apply | New phase 4 migration extending Phase 2's initial migration |
| `drizzle-zod` | 0.8.3 [VERIFIED: npm registry] | Derive Zod schemas from Drizzle tables | Domain-layer schemas in `src/contexts/iam/domain/schemas.ts` |
| `jose` | 6.2.2 [VERIFIED: npm registry] | JWT verification via Supabase JWKS | Already in use by Phase 2 D-33 AuthAdapter; Phase 4 inherits |
| `@supabase/supabase-js` | 2.104.1 | Admin client for service-role operations | `admin.createUser`, `admin.deleteUser`, `admin.updateUserById` |

### Crypto utilities (Node built-in — no install needed)

| Module | Purpose | Pattern |
| --- | --- | --- |
| `node:crypto` | Token generation + hashing | `randomBytes(32).toString('hex')` for raw token; `createHash('sha256').update(token).digest('hex')` for storage hash; `timingSafeEqual()` for comparison |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
| --- | --- | --- |
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | **Deprecated; do not use** [VERIFIED: npm registry] |
| Custom JWT (`jsonwebtoken`) | jose | jose is already adopted by Phase 2 D-33; edge-runtime compatible; jsonwebtoken is not |
| `bcrypt` for tokens | Node `crypto` SHA-256 | Tokens are 32-byte secrets, not user passwords. SHA-256 is the standard for one-shot URL token storage; bcrypt is overkill (slower, designed for password hashing where attackers have the hash). [Industry pattern: GitHub, Stripe, Auth0 all use SHA-256 for one-shot tokens.] |
| Redis for rate-limiting | Postgres `auth_throttle` table | D-12 locks Postgres. Redis adds infra Phase 4 doesn't have; Postgres is sufficient at MVP scale. |
| `react-email/components` (no scope) | `@react-email/components` | The scoped package is the official one [VERIFIED: github.com/resend/react-email] |
| Sending via SMTP | Resend API | Resend is locked; SMTP requires verified domain config in Phase 4 (deferred to Phase 12) |

**Installation (Phase 4 task 1 typical):**

```bash
pnpm add inngest@^4.2.4 resend@^6.12.2 @react-email/components@^1.0.12 @supabase/ssr@^0.10.2 @supabase/supabase-js@^2.104.1
pnpm add drizzle-orm@^0.45.2 drizzle-zod@^0.8.3
pnpm add -D drizzle-kit@^0.31.10
```

(Note: drizzle-orm/drizzle-kit/drizzle-zod are likely already installed in Phase 2; verify before re-installing.)

**Version verification:** All versions above were checked against `npm view <pkg> version` on 2026-04-26. The ecosystem is stable; no breaking-change releases pending.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                            Browser (PWA)                             │
│                                                                      │
│  ┌────────────┐    ┌────────────┐    ┌─────────────────────────┐     │
│  │ Signup     │    │ Login      │    │ Settings → Account      │     │
│  │ Form       │    │ Form       │    │ (change pwd, tz, logout)│     │
│  └─────┬──────┘    └─────┬──────┘    └──────────┬──────────────┘     │
│        │                  │                      │                    │
│        ▼                  ▼                      ▼                    │
│  Intl.DateTimeFormat().resolvedOptions().timeZone (AUTH-08)          │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTPS
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Frontend Server (Next.js App Router)                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Root Layout (server component)                                │    │
│  │  └─ if email_verified_at IS NULL → <UnverifiedBlocker />     │    │
│  │     else → children (D-21)                                    │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ /auth/verify?token=... (Route Handler)                        │    │
│  │  └─ validates token hash → sets email_verified_at → redir /  │    │
│  │  └─ fires PostHog signup_completed                            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ /auth/oauth-complete (Server Component + Form)                │    │
│  │  └─ if age_confirmed_at IS NULL → render form (D-04)          │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ /settings/[section] (Server Components)                       │    │
│  │  └─ /account = real form, others = "Em breve" cards (D-27)    │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     API Tier (Route Handlers)                        │
│                                                                      │
│  POST /api/v1/iam/signup ──┐                                         │
│  POST /api/v1/iam/login    ├─→ requireApiUser? requireVerifiedUser?  │
│  POST /api/v1/iam/logout   │   (D-21 helpers)                        │
│  POST /api/v1/iam/resend-verification                                │
│  POST /api/v1/iam/password/reset-request  (D-11 always 200)          │
│  POST /api/v1/iam/password/reset                                     │
│  PATCH /api/v1/iam/me/password                                       │
│  GET/PATCH /api/v1/iam/me                                            │
│  GET /auth/callback (Supabase OAuth callback)                        │
│  POST /api/inngest (Inngest serve handler — INFRA-10)                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Pre-handler middleware (per-IP throttle on signup/login/OAuth)│    │
│  │  └─ UPSERT auth_throttle ON CONFLICT bump count               │    │
│  │  └─ if count > 5 → 429 rate_limited (AUTH-10)                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                  │                              │
                  ▼                              ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│       Supabase Auth              │  │       Postgres (Supabase)        │
│  (credentials, JWT, OAuth, sess) │  │                                  │
│                                  │  │  - auth.users (Supabase-owned)   │
│  - admin.createUser              │  │  - public.users (+ extension     │
│    ({email_confirm: true})       │  │    for email_verified_at)        │
│  - signInWithPassword            │  │  - email_verification_tokens (NEW)│
│  - signInWithOAuth (Google)      │  │  - password_reset_tokens (NEW)   │
│  - admin.updateUserById          │  │  - auth_throttle (NEW)           │
│  - signOut({scope:'local'})      │  │  - consent_logs (Phase 2)        │
│  - admin.deleteUser (compensate) │  │  - subscriptions (Phase 2)       │
└──────────────────────────────────┘  │  - policy_versions (Phase 2)     │
                                       │  - idempotency_keys (Phase 2)    │
                                       └──────────────────────────────────┘
                  │
                  │ (API emits events via inngest.send())
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Inngest (durable async)                            │
│                                                                      │
│  Events emitted by Phase 4:                                          │
│   - notifications/email.requested (verification + reset)             │
│   - iam/password-reset-requested                                     │
│   - user.signed_up                                                   │
│   - user.consent_granted                                             │
│                                                                      │
│  Functions registered (D-16/D-17):                                   │
│   ┌──────────────────────────────────────────┐                       │
│   │ notifications/send-email (REAL impl)     │                       │
│   │  └─ render React Email → resend.send()   │                       │
│   └──────────────────────────────────────────┘                       │
│   ┌──────────────────────────────────────────┐                       │
│   │ iam/password-reset-requested (REAL impl) │                       │
│   │  └─ lookup user → mint token → emit email│                       │
│   └──────────────────────────────────────────┘                       │
│   ┌──────────────────────────────────────────┐                       │
│   │ auth-throttle/cleanup (REAL impl, cron)  │                       │
│   │  cron: '17 * * * *' — delete >2h rows    │                       │
│   └──────────────────────────────────────────┘                       │
│   ┌──────────────────────────────────────────┐                       │
│   │ care-guide/augment (STUB)                │                       │
│   │ iam/process-deletion (STUB)              │                       │
│   │ iam/generate-export (STUB)               │                       │
│   │ billing/process-webhook (STUB)           │                       │
│   │ billing/trial-ending-notifier (STUB)     │                       │
│   │ reminders/dispatch (STUB)                │                       │
│   │ notifications/send-push (STUB)           │                       │
│   └──────────────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          Resend (SaaS)                               │
│   from: onboarding@resend.dev (sandbox in Phase 4)                   │
│   react: <VerificationEmail />, <PasswordResetEmail />               │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

Inherits Phase 2 D-01 per-context schema ownership; Phase 4 fills the empty IAM context and adds `notifications` infrastructure.

```
src/
├── app/
│   ├── api/
│   │   ├── inngest/
│   │   │   └── route.ts                      # serve({client, functions: registry}) — INFRA-10
│   │   └── v1/
│   │       └── iam/
│   │           ├── signup/route.ts           # POST signup orchestration
│   │           ├── login/route.ts            # POST signInWithPassword
│   │           ├── logout/route.ts           # POST signOut({scope:'local'})
│   │           ├── resend-verification/route.ts
│   │           ├── password/
│   │           │   ├── reset-request/route.ts # always 200 + emit Inngest
│   │           │   └── reset/route.ts        # validate token + admin.updateUserById
│   │           └── me/
│   │               ├── route.ts              # GET/PATCH self profile
│   │               └── password/route.ts     # PATCH change password
│   ├── auth/
│   │   ├── callback/route.ts                 # Supabase OAuth callback
│   │   ├── verify/route.ts                   # GET ?token= → set email_verified_at
│   │   ├── reset/page.tsx                    # GET ?token= → render form
│   │   ├── forgot-password/page.tsx          # forgot-password form
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── oauth-complete/page.tsx           # D-04 Google completion screen
│   ├── settings/
│   │   ├── page.tsx                          # redirects to /settings/account
│   │   ├── layout.tsx                        # shared chrome + nav
│   │   └── [section]/
│   │       └── page.tsx                      # account = real, others = "Em breve"
│   └── layout.tsx                            # ROOT — server component checks user/email_verified_at
│
├── contexts/
│   ├── iam/
│   │   ├── domain/
│   │   │   ├── schemas.ts                    # drizzle-zod-derived Zod schemas (Phase 2 starts)
│   │   │   └── events.ts                     # user.signed_up, user.consent_granted (Phase 2 D-42 starts)
│   │   ├── application/
│   │   │   ├── signup.ts                     # orchestration use-case (D-03/D-25)
│   │   │   ├── login.ts                      # signInWithPassword wrapper
│   │   │   ├── logout.ts                     # signOut({scope:'local'})
│   │   │   ├── verify-email.ts               # consume token + set email_verified_at
│   │   │   ├── resend-verification.ts        # rotate token + emit Inngest
│   │   │   ├── request-password-reset.ts     # emit Inngest only
│   │   │   ├── consume-password-reset.ts     # validate + admin.updateUserById
│   │   │   ├── change-password.ts            # reverify + admin.updateUserById (D-13)
│   │   │   ├── oauth-complete.ts             # finalize Google signup
│   │   │   ├── current-user.ts               # Phase 2-provided (D-32 expanded)
│   │   │   └── require-verified.ts           # NEW gate helper (D-21)
│   │   ├── infrastructure/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts                 # adds email_verified_at + new tables
│   │   │   │   ├── users.ts                  # repository (extends Phase 2)
│   │   │   │   ├── consent-logs.ts           # repository (extends Phase 2)
│   │   │   │   ├── policy-versions.ts        # repository (lookup is_current)
│   │   │   │   ├── verification-tokens.ts    # NEW repository
│   │   │   │   ├── reset-tokens.ts           # NEW repository
│   │   │   │   ├── auth-throttle.ts          # NEW repository (UPSERT-RETURNING)
│   │   │   │   └── subscriptions.ts          # repository (initial trialing row)
│   │   │   ├── supabase-auth-adapter.ts      # extends Phase 2 AuthAdapter
│   │   │   └── posthog-bridge.ts             # captures signup_completed/consent_granted
│   │   ├── api/
│   │   │   └── helpers/                      # Zod schemas, error mappers per route
│   │   └── inngest/
│   │       └── functions.ts                  # exports [iamPasswordResetRequested, authThrottleCleanup]
│   │
│   └── notifications/
│       ├── domain/
│       │   └── events.ts                     # notifications/email.requested
│       ├── application/
│       │   └── send-email.ts                 # template registry → render → resend.send
│       ├── infrastructure/
│       │   ├── resend-adapter.ts             # SDK wrapper + dev console-log fallback (D-20)
│       │   └── email-templates/
│       │       ├── verification.tsx          # React Email pt-BR
│       │       └── password-reset.tsx        # React Email pt-BR
│       └── inngest/
│           └── functions.ts                  # exports [notificationsSendEmail]
│
├── shared/
│   ├── inngest/
│   │   ├── client.ts                         # new Inngest({id:'folhario'})
│   │   └── registry.ts                       # concatenates per-context arrays (D-17)
│   ├── api/
│   │   ├── auth.ts                           # Phase 2 requireApiUser; extended to requireVerifiedUser
│   │   └── throttle.ts                       # NEW per-IP throttle middleware
│   └── crypto/
│       └── tokens.ts                         # randomBytes + sha256 + timingSafeEqual helpers
│
└── messages/
    └── pt-BR.json                            # extends with auth.*, settings.*, email.* namespaces (UI-SPEC)
```

### Pattern 1: Inngest serve() registration (INFRA-10)

**What:** Single HTTP endpoint that exposes all 8 MVP Inngest functions.
**When to use:** App Router project with Inngest as the async runtime.

```typescript
// Source: context7.com/inngest/inngest-js — Next.js App Router
// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/shared/inngest/client";
import { registry } from "@/shared/inngest/registry";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: registry,
});
```

```typescript
// src/shared/inngest/client.ts
import { Inngest } from "inngest";
import { serverEnv } from "@/shared/config/server-env";

export const inngest = new Inngest({
  id: "folhario",
  eventKey: serverEnv.INNGEST_EVENT_KEY,
  signingKey: serverEnv.INNGEST_SIGNING_KEY,
});
```

```typescript
// src/shared/inngest/registry.ts
import { iamFunctions } from "@/contexts/iam/inngest/functions";
import { notificationsFunctions } from "@/contexts/notifications/inngest/functions";
import { catalogFunctions } from "@/contexts/catalog/inngest/functions";       // stub
import { speciesCareFunctions } from "@/contexts/species-care/inngest/functions"; // stub
import { identificationFunctions } from "@/contexts/identification/inngest/functions"; // stub (none in P4)
import { remindersFunctions } from "@/contexts/reminders/inngest/functions";   // stub
import { billingFunctions } from "@/contexts/billing/inngest/functions";       // stubs

export const registry = [
  ...iamFunctions,
  ...notificationsFunctions,
  ...remindersFunctions,
  ...billingFunctions,
  ...speciesCareFunctions,
];
```

### Pattern 2: Stub Inngest function (D-16)

**What:** Returns `{status: 'not_implemented'}` so dashboard shows full topology immediately.

```typescript
// Source: derived from D-16 — verified API pattern from context7.com/inngest/inngest-js
import { inngest } from "@/shared/inngest/client";

export const careGuideAugment = inngest.createFunction(
  { id: "care-guide-augment" },
  { event: "identification.succeeded" },
  async () => ({ status: "not_implemented" }),
);
```

### Pattern 3: Send email Inngest function (NOTIF-01)

```typescript
// Source: context7.com/inngest/inngest-js + context7.com/websites/resend
import { inngest } from "@/shared/inngest/client";
import { renderEmail } from "@/contexts/notifications/application/send-email";
import { resendAdapter } from "@/contexts/notifications/infrastructure/resend-adapter";

export const notificationsSendEmail = inngest.createFunction(
  { id: "notifications-send-email", retries: 3 },
  { event: "notifications/email.requested" },
  async ({ event, step }) => {
    const { template, props, to, subject } = event.data;
    const rendered = await step.run("render-email", async () =>
      renderEmail(template, props),
    );
    const result = await step.run("send-resend", async () =>
      resendAdapter.send({ from: serverEnv.RESEND_FROM_ADDRESS, to, subject, react: rendered.react }),
    );
    return { messageId: result.id };
  },
);
```

### Pattern 4: Idempotent event emission (Inngest)

**What:** Producer-side idempotency via the `id` field — Inngest drops duplicates within 24h.

```typescript
// Source: context7.com/inngest/inngest-js — events.id deduplication
await inngest.send({
  id: `email-verification/${verificationTokenId}`,  // 24h idempotency window
  name: "notifications/email.requested",
  data: { template: "verification", to: user.email, props: { url, expiresAt } },
});
```

### Pattern 5: @supabase/ssr server client in Route Handlers

**What:** Cookie-aware Supabase client for App Router; replaces deprecated `@supabase/auth-helpers-nextjs`.

```typescript
// Source: context7.com/supabase/ssr — Next.js Route Handler pattern
// src/contexts/iam/infrastructure/supabase-server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/shared/config/client-env";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}
```

### Pattern 6: Supabase admin client (service role)

**What:** Server-only; bypasses RLS for `admin.createUser`, `admin.deleteUser`, `admin.updateUserById`.

```typescript
// Source: context7.com/supabase/supabase — admin namespace requires SERVICE_ROLE
// src/contexts/iam/infrastructure/supabase-admin.ts
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/shared/config/server-env";
import { clientEnv } from "@/shared/config/client-env";

export const supabaseAdmin = createClient(
  clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
```

### Pattern 7: Token mint + verify (cryptographically safe)

**What:** Industry-standard one-shot token storage — raw token in URL, SHA-256 hash in DB, timing-safe compare.

```typescript
// Source: derived from D-06/D-09 + Node crypto stdlib
// src/shared/crypto/tokens.ts
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/** Returns { raw, hash } — store hash, send raw in URL. */
export function mintToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");           // 64-char hex = 256 bits entropy
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/** Constant-time comparison — prevents timing attacks. */
export function verifyToken(raw: string, hash: string): boolean {
  const candidateHash = createHash("sha256").update(raw).digest("hex");
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

### Pattern 8: Per-IP throttle UPSERT-RETURNING (Postgres atomic)

**What:** Single SQL statement; atomic increment; race-condition-free.

```typescript
// Source: derived from D-12/D-13/D-14 + Drizzle docs (context7.com/drizzle-team/drizzle-orm-docs)
// src/contexts/iam/infrastructure/db/auth-throttle.ts
import { sql } from "drizzle-orm";
import { authThrottle } from "./schema";

export async function bumpThrottle(
  db: DrizzleClient,
  ip: string,
  endpoint: string,
): Promise<{ count: number; locked: boolean }> {
  const windowStart = Math.floor(Date.now() / 1000 / 60); // minute bucket
  const [row] = await db
    .insert(authThrottle)
    .values({ ip, endpoint, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [authThrottle.ip, authThrottle.endpoint, authThrottle.windowStart],
      set: { count: sql`${authThrottle.count} + 1` },
    })
    .returning({ count: authThrottle.count });

  return { count: row.count, locked: row.count > 5 };
}
```

### Pattern 9: React Email pt-BR template

```typescript
// Source: context7.com/resend/react-email
// src/contexts/notifications/infrastructure/email-templates/verification.tsx
import { Html, Head, Body, Container, Heading, Text, Button, Hr } from "@react-email/components";

export function VerificationEmail({ url, userEmail }: { url: string; userEmail: string }) {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </Head>
      <Body style={{ backgroundColor: "#FBF7EF", fontFamily: "'Plus Jakarta Sans', Helvetica, Arial, sans-serif" }}>
        <Container style={{ backgroundColor: "#FFFDF7", maxWidth: 600, margin: "32px auto", padding: 32, borderRadius: 12 }}>
          <Heading style={{ color: "#143424", fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 24, fontWeight: 500 }}>
            Confirme seu e-mail para começar
          </Heading>
          <Text style={{ color: "#5A6358", fontSize: 16, lineHeight: "24px" }}>
            Olá! Você está a um clique de identificar e cuidar das suas plantas no Folhário. Confirme seu e-mail para liberar o app.
          </Text>
          <Button href={url} style={{ backgroundColor: "#1F4D35", color: "#FFFDF7", padding: "12px 24px", borderRadius: 8, fontSize: 16, fontWeight: 600 }}>
            Confirmar e-mail
          </Button>
          <Text style={{ color: "#5A6358", fontSize: 14, marginTop: 32 }}>
            O link expira em 24 horas. Se não foi você, ignore este e-mail.
          </Text>
          <Hr style={{ borderColor: "#E8E1D0", margin: "24px 0" }} />
          <Text style={{ color: "#2B6F7A", fontSize: 12 }}>
            Você está recebendo este e-mail porque criou uma conta no Folhário.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### Pattern 10: Resend SDK send + dev fallback (D-20)

```typescript
// Source: context7.com/websites/resend — react: prop, error handling pattern
// src/contexts/notifications/infrastructure/resend-adapter.ts
import { Resend } from "resend";
import { serverEnv } from "@/shared/config/server-env";

const resend = serverEnv.RESEND_API_KEY ? new Resend(serverEnv.RESEND_API_KEY) : null;

export const resendAdapter = {
  async send(params: { from: string; to: string; subject: string; react: React.ReactElement }) {
    if (!resend) {
      // D-20: dev fallback — log payload, never network
      console.log("[resend-dev] would send", { ...params, html: "<rendered>" });
      return { id: "dev-mode" };
    }
    const { data, error } = await resend.emails.send(params);
    if (error) throw new Error(`resend.send failed: ${error.message}`);
    return data!;
  },
};
```

### Pattern 11: Verification gate (D-21)

```typescript
// src/contexts/iam/application/require-verified.ts
import { errorResponse, ErrorCode } from "@/shared/config/errors";
import { getCurrentUser } from "@/contexts/iam/application/current-user";

export async function requireVerifiedUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return { error: errorResponse(ErrorCode.Unauthenticated, "Not authenticated") };
  if (!user.emailVerifiedAt) return { error: errorResponse(ErrorCode.EmailUnverified, "Verifique seu e-mail.") };
  return { user };
}
```

```typescript
// src/app/layout.tsx (root layout — Server Component)
import { getCurrentUserOrNull } from "@/contexts/iam/application/current-user";
import { UnverifiedBlocker } from "@/contexts/iam/api/components/unverified-blocker";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserOrNull();
  // unauthenticated paths handled by routing; for authenticated users:
  if (user && !user.emailVerifiedAt) {
    return (
      <html lang="pt-BR">
        <body><UnverifiedBlocker email={user.email} /></body>
      </html>
    );
  }
  return <html lang="pt-BR"><body>{children}</body></html>;
}
```

### Pattern 12: OAuth callback - code-for-session exchange

**What:** Convert the `?code=...` query parameter from the Google OAuth redirect into a Supabase session (cookie-based via `@supabase/ssr`).
**When to use:** Mandatory in `/auth/callback` route handler - without this call, OAuth completes at Google's end but never produces a Folhario session.

```typescript
// Source: context7.com/supabase/ssr - Server Client + exchangeCodeForSession
// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/contexts/iam/infrastructure/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    // OAuth provider rejected - increment per-IP throttle (D-15) and redirect with error
    return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", url));
  }

  const supabase = await getSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", url));
  }

  // Cookie now set; check if OAuth completion is still pending (age_confirmed_at IS NULL)
  // If pending -> redirect to /auth/oauth-complete; else -> /
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", url));

  // Read public.users to determine completion state
  // ...repository call...

  return NextResponse.redirect(new URL("/auth/oauth-complete", url));
}
```

### Anti-Patterns to Avoid

- **Using Supabase's built-in `signUp()` for email+password.** D-03 mandates `admin.createUser({ email_confirm: true })` so Supabase never sends a confirmation email. The non-admin `signUp()` would trigger Supabase SMTP (or no-op if SMTP not configured) AND wouldn't pre-confirm the email — breaking the authenticated-unverified blocker per AUTH-15.
- **Using `auth.users.email_confirmed_at` to gate the app.** D-22 forbids this; only `public.users.email_verified_at` is the product source of truth.
- **Calling `signOut()` (default global) for logout.** D-05 mandates `signOut({ scope: 'local' })` — `global` would sign out all the user's devices.
- **Storing raw tokens in DB.** D-06/D-09 mandate SHA-256 hash storage; raw exists only in URL.
- **Using `bcrypt`/`argon2` for verification/reset tokens.** Those are designed for password hashing where attackers obtain the hash; for one-shot URL tokens with high entropy, SHA-256 is the industry standard (GitHub, Stripe, Auth0).
- **Adding `Authorization`, `Cookie`, `email`, `password`, `token` to log lines.** Phase 1 D-22 ships a Sentry scrub for these but additional log statements must avoid introducing them.
- **Calling `inngest.send()` from inside an Inngest function.** Use `step.sendEvent()` instead — it's memoized and won't duplicate on retry [CITED: context7.com/inngest/inngest-js].
- **Try/catching `resend.emails.send()`.** The SDK returns `{ data, error }`; `try/catch` is for network-level failures only [CITED: resend.com/docs/send-with-nextjs].
- **Putting Drizzle queries in route handlers.** Phase 2 D-17 enforces no-Drizzle-in-handlers via ESLint + Vitest grep guard. All DB access lives in `src/contexts/iam/infrastructure/db/*.ts`.
- **Adding new error codes.** Phase 1 D-10/D-12 closed registry — Phase 4 emits only codes already in `src/shared/config/errors.ts:1`. The registry covers every Phase 4 case (`unauthenticated`, `email_unverified`, `invalid_credentials`, `validation_failed`, `invalid_partner_code`, `forbidden`, `rate_limited`, `token_expired`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| --- | --- | --- | --- |
| JWT signing/verification | Custom HMAC/RSA | `jose` (already locked) + Supabase JWKS | Spec compliance + JWKS rotation handled |
| Password hashing | Custom bcrypt invocation | Supabase Auth `admin.createUser({ password })` | Supabase manages bcrypt + work factor + migration |
| OAuth state + PKCE | Custom redirect flow | `signInWithOAuth({ provider: 'google' })` | Handles state, PKCE, callback verification |
| Cookie-based session | Custom cookie shape | `@supabase/ssr` `getAll/setAll` pattern | Cross-runtime (server, edge, browser) consistency |
| Token entropy | Custom UUID/Math.random | `crypto.randomBytes(32)` | Cryptographic randomness; 256-bit entropy |
| Constant-time compare | `===` on hex strings | `crypto.timingSafeEqual()` | Prevents timing attacks on token verification |
| Email rendering | String concatenation + inline CSS | `@react-email/components` | Cross-client tested (Gmail, Outlook, Apple Mail, etc.) |
| Email retry/backoff | `setTimeout` retry loops | Inngest `retries: N` + `RetryAfterError` / `NonRetriableError` | Durable through serverless cold starts; observability built-in |
| Cron scheduling | `node-cron` / `setInterval` | Inngest cron triggers (`cron: '17 * * * *'`) | CLAUDE.md mandates Inngest for all async; cron uses Inngest infra |
| In-memory rate limit | `Map<ip, count>` | Postgres `auth_throttle` UPSERT-RETURNING | Survives serverless invocation boundaries |
| IP extraction | Custom `req.headers.get('forwarded')` parsing | `request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()` | Vercel sets `x-forwarded-for`; first-hop is the public client |

**Key insight:** Auth + email + async are domains where hand-rolled solutions accumulate edge cases (timing attacks, retry storms, email-client rendering, OAuth CSRF). The locked stack closes every category. The phase's architectural value is in **assembly + orchestration**, not in component implementation.

## Common Pitfalls

### Pitfall 1: Supabase silently sending its own confirmation email despite `enable_confirmations = false`

**What goes wrong:** `auth.email.enable_confirmations = false` works for the local Docker stack [VERIFIED: supabase/config.toml:219], but a hosted Supabase project may have it enabled in dashboard config that ships separately from `config.toml`.
**Why it happens:** Hosted Supabase project settings live in the dashboard, not in git; preview/prod environments default to `enable_confirmations = true` unless explicitly overridden.
**How to avoid:** Phase 4 must (a) confirm `enable_confirmations = false` in every Supabase project (local, preview, production); (b) ALWAYS pass `email_confirm: true` to `admin.createUser` so the credential is created already confirmed (this also bypasses Supabase's default email send); (c) include a Phase 4 test that asserts only one email is sent on signup (the Resend one) by mocking Resend and grepping logs for any Supabase Auth email dispatch.
**Warning signs:** User receives two emails on signup; user verifies via Supabase's link but `public.users.email_verified_at` stays NULL; verification link appears in Inbucket (local mailpit) when running tests.

### Pitfall 2: `@supabase/auth-helpers-nextjs` mistakenly installed

**What goes wrong:** The deprecated package may be auto-suggested by IDEs or copy-pasted from old tutorials.
**Why it happens:** Training data and many tutorials still reference it; it works at first then breaks when project upgrades.
**How to avoid:** Add a Phase 4 lint or grep test that blocks `@supabase/auth-helpers-*` imports; use only `@supabase/ssr`.
**Warning signs:** TypeScript errors on cookie API mismatch; Supabase warnings about deprecated APIs.

### Pitfall 3: Race condition between Supabase admin createUser and DB transaction

**What goes wrong:** D-25 ordering: (1) admin.createUser, (2) DB transaction. If step (2) fails AND the compensating `admin.deleteUser` also fails, an orphan `auth.users` row exists with no `public.users` row.
**Why it happens:** Network blips, Postgres connection drop, transient errors during compensation.
**How to avoid:** (a) Phase 2 D-35 trigger acts as safety net — if `public.users` row is missing on next login, the trigger creates a minimal row; (b) Phase 4 logs compensation failures to Sentry critical for manual cleanup; (c) integration test for compensation path.
**Warning signs:** User reports "I created an account but can't log in"; orphan `auth.users` rows in monitoring.

### Pitfall 4: Resend sandbox restriction silently blocking dev/preview emails

**What goes wrong:** `onboarding@resend.dev` only sends to the verified email of the Resend account owner; sending to any other recipient silently 403s [CITED: resend.com/docs/dashboard/emails/send-test-emails]. Dev sees the email; preview testers don't.
**Why it happens:** Sandbox mode protects new accounts from being abused for spam. Preview environments hit the sandbox for the same reason.
**How to avoid:** (a) For local dev, D-20 logs payloads to stdout — no real send happens unless `RESEND_API_KEY` is set; (b) for preview/CI, send to the founder's verified email or to `delivered@resend.dev` (resend's sandbox-friendly test address); (c) document the restriction in Phase 4 SUMMARY so QA testers don't waste time wondering why their test recipient never gets the email.
**Warning signs:** Resend dashboard shows "delivered" but recipient inbox is empty; `error.message` includes "validation_error" + "domain not verified".

### Pitfall 5: Inngest dev server not running locally → events never processed

**What goes wrong:** `inngest.send()` succeeds (it just queues), but no function ever runs because the dev server isn't connected to the local serve handler.
**Why it happens:** Inngest's dev server discovers functions via `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` [CITED: context7.com/inngest/inngest-js]; without it, events sit in a queue with no consumer.
**How to avoid:** Add `pnpm inngest:dev` script to package.json; document in README + Phase 4 SUMMARY.
**Warning signs:** "Email never arrived" in dev; no logs in `notifications/send-email`; Inngest dev dashboard at `http://localhost:8288` shows no functions registered.

### Pitfall 6: Cookie operations from Server Components throwing

**What goes wrong:** Calling `cookieStore.set()` from a Server Component (not Server Action / Route Handler) throws "Cookies can only be modified in a Server Action or Route Handler."
**Why it happens:** Next 16 enforces this; @supabase/ssr's `setAll` callback is invoked when the auth client refreshes a session — if invoked from a Server Component, it throws.
**How to avoid:** Pattern from context7.com/supabase/ssr: in Server Components, omit `setAll` callback (read-only client). Use full client only in Route Handlers and middleware. The `getCurrentUserOrNull()` helper used by root layout must be the read-only variant.
**Warning signs:** "Cookies can only be modified..." error; auth state inconsistencies between root layout and route handlers.

### Pitfall 7: Throttle counter ON CONFLICT updating but not returning latest count

**What goes wrong:** Without `RETURNING`, a separate SELECT after UPSERT introduces a race window where another request increments between the two statements.
**Why it happens:** Naive implementations split into `INSERT` + `SELECT` instead of using the atomic `RETURNING`.
**How to avoid:** Use Drizzle's `.returning()` chained on `.onConflictDoUpdate()` — pattern 8 above. The single statement is atomic.
**Warning signs:** Throttle test fails intermittently with N+1 attempts allowed; `count` returned doesn't match expected.

### Pitfall 8: PostHog `signup_completed` fired at wrong moment

**What goes wrong:** Firing at signup form submit (instead of verification click) makes the §1 "value <2 min" clock start before the user can actually do anything.
**Why it happens:** Easy to add the capture in the wrong handler.
**How to avoid:** D-07 specifies the verification route `/auth/verify` is the firing site; same goes for OAuth-complete (which sets verified-at immediately). Add an explicit comment to the signup handler stating "do NOT fire signup_completed here."
**Warning signs:** Funnel "signup → first identification" shows >2min for >50% of users — likely the clock started too early.

### Pitfall 9: `requireVerifiedUser` unused in route handlers (default-deny violated)

**What goes wrong:** D-23 specifies allowlist (default-deny). If a new route is added without calling `requireVerifiedUser()`, an unverified user can hit it.
**Why it happens:** Easy to forget; no language-level enforcement.
**How to avoid:** (a) Phase 4 ESLint rule or Vitest grep test that fails CI when a route handler under `/api/v1/` (except allowlisted paths) doesn't call `requireApiUser` or `requireVerifiedUser`; (b) helper exports a `defineHandler` factory that requires the gate spec at registration time.
**Warning signs:** Future phase reports test failure where unverified user reaches a feature endpoint; security review flag.

### Pitfall 10: Sandbox key swapping between dev and CI without isolation

**What goes wrong:** D-20 says local dev empty `RESEND_API_KEY`; CI sets sandbox key. If a developer accidentally sets `RESEND_API_KEY` in local `.env.local`, every iteration burns Resend quota.
**Why it happens:** `.env.local` is git-ignored; easy to leave settings stale across worktrees.
**How to avoid:** Document the dev posture in Phase 4 SUMMARY; the resend-adapter (Pattern 10) checks the env var presence and falls back to console-log when empty.
**Warning signs:** Resend dashboard shows traffic from unexpected hosts; quota burns down quickly during local testing.

### Pitfall 11: OAuth-complete gate skipped via direct route hit

**What goes wrong:** User signs up via Google, the callback redirects to `/auth/oauth-complete`, but the user manually navigates to `/` first — gate not enforced, user skips age confirmation + consent.
**Why it happens:** D-04 says "every other route redirects back to /auth/oauth-complete" but the implementation must enforce it server-side.
**How to avoid:** Root layout server component (D-21) extends its check: if `user.age_confirmed_at IS NULL`, redirect to `/auth/oauth-complete` BEFORE the verification check (so OAuth users land there even though they're "verified"). UNVERIFIED_ALLOWED_PATHS extension covers /auth/oauth-complete; INCOMPLETE_ALLOWED_PATHS = same allowlist.
**Warning signs:** OAuth user has `email_verified_at` set but no ConsentLog rows; LGPD audit fails.

### Pitfall 12: AUTH-14 wording vs Supabase signOut semantics

**What goes wrong:** `signOut({ scope: 'local' })` revokes the **refresh token** for the current device, but the **access token (JWT) remains valid until its `exp`** [CITED: github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/signout.mdx - "access tokens remain valid until their expiry time even after revocation"]. AUTH-14's wording "revokes that JWT" is **not** what Supabase's API actually does. Subsequent requests with the still-valid access token will succeed until the JWT expires (Supabase default: 1h).
**Why it happens:** Supabase's session model is "access token + refresh token"; `signOut` deletes the refresh token (so no new access tokens can be minted from it) and clears the cookie, but the JWT itself is stateless and cannot be invalidated without an app-owned denylist (which D-05 forbids).
**How to avoid:** (a) Phase 4 plan documents this in 04-SUMMARY: AUTH-14's effective behavior is "the cookie is cleared and the refresh token is revoked; the existing JWT will expire at its `exp` (<=1h)"; (b) integration test for AUTH-14 asserts the cookie was cleared and that any subsequent refresh attempt fails - NOT that requests with the existing JWT are rejected; (c) AUTH-12 (password reset doesn't invalidate JWTs) and AUTH-14 (logout this device) actually share the same JWT-layer behavior; the distinction is at the cookie/refresh-token layer.
**Warning signs:** Plan-phase or test-phase asserts "subsequent request with JWT after logout returns 401"; this assertion will fail until the JWT naturally expires. Surface this to the user during plan-phase via Open Question 6 - they may want to amend AUTH-14's wording or accept the JWT-exp window as the effective logout latency.

## Validation Architecture

> Required by Nyquist gate per `.planning/config.json` (workflow.nyquist_validation = true).

### Test Framework

| Property | Value |
| --- | --- |
| Framework | Vitest 4.1.4 (unit + integration projects) [VERIFIED: package.json] + Playwright 1.59.1 (E2E) |
| Config file | `vitest.config.ts` (root, with `projects` array splitting unit and integration) |
| Quick run command | `pnpm test:unit` (unit-only, ~2-5s feedback for pure helpers) |
| Full suite command | `pnpm test:unit && pnpm test:integration && pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
| --- | --- | --- | --- | --- |
| AUTH-01 | Signup creates user + Subscription + sends email | integration | `pnpm test:integration tests/integration/iam-signup.integration.test.ts` | Wave 0 (NEW) |
| AUTH-02 | Unverified user blocked on gated endpoints | integration | `pnpm test:integration tests/integration/iam-verification-gate.integration.test.ts` | Wave 0 |
| AUTH-03 | Google OAuth pre-verified path | integration + e2e | `pnpm test:integration ...iam-oauth.integration.test.ts` + Playwright | Wave 0 |
| AUTH-04 | Verify link sets email_verified_at | integration | `pnpm test:integration tests/integration/iam-verify-token.integration.test.ts` | Wave 0 |
| AUTH-05 | Login per-device JWT | integration + e2e | `pnpm test:integration tests/integration/iam-login.integration.test.ts` | Wave 0 |
| AUTH-06 | Age <13 blocked | unit (Zod schema) + integration | `pnpm test:unit tests/unit/iam-signup-schema.test.ts` | Wave 0 |
| AUTH-07 | Partner code captured | integration | (covered by AUTH-01 test) | Wave 0 |
| AUTH-08 | Timezone captured | integration | (covered by AUTH-01) | Wave 0 |
| AUTH-09 | ConsentLog × 2 at signup | integration | `pnpm test:integration tests/integration/iam-consent-log.integration.test.ts` | Wave 0 |
| AUTH-10 | Per-IP throttle 429 | integration | `pnpm test:integration tests/integration/iam-throttle.integration.test.ts` | Wave 0 |
| AUTH-11 | Password reset always 200 | integration | `pnpm test:integration tests/integration/iam-password-reset.integration.test.ts` | Wave 0 |
| AUTH-12 | Reset token consume | integration | (same file) | Wave 0 |
| AUTH-13 | Change password (current+new) | integration | `pnpm test:integration tests/integration/iam-change-password.integration.test.ts` | Wave 0 |
| AUTH-14 | Logout this device | integration | `pnpm test:integration tests/integration/iam-logout.integration.test.ts` | Wave 0 |
| AUTH-15 | Unverified blocker shown | e2e | `playwright test tests/e2e/iam-unverified-blocker.spec.ts` | Wave 0 |
| INFRA-10 | Inngest serve handler at /api/inngest | unit + integration | `pnpm test:integration tests/integration/inngest-serve.integration.test.ts` | Wave 0 |
| NOTIF-01 | notifications/send-email function ships | unit (template render) + integration (function invocation) | `pnpm test:unit tests/unit/email-templates.test.ts` + integration test mocking Resend | Wave 0 |
| NOTIF-02 | React Email pt-BR templates | unit (snapshot of rendered HTML) | `pnpm test:unit tests/unit/email-templates.test.ts` | Wave 0 |
| UI-13 | Settings → Account works | e2e | `playwright test tests/e2e/settings-account.spec.ts` | Wave 0 |

**Schema/migration test:** Phase 4 introduces 3 new tables and 1 column. Plan adds a `tests/integration/iam-schema-phase4.integration.test.ts` that asserts each table exists with the expected columns + RLS enabled. (Mirrors Phase 2's `schema-rls.integration.test.ts` pattern.)

**Crypto helper tests (pure):** `tests/unit/tokens.test.ts` covers `mintToken`, `verifyToken`, `timingSafeEqual` correctness — no external deps.

### Sampling Rate

- **Per task commit:** `pnpm test:unit` (Zod schemas, token crypto, error mappers, throttle math, email templates) — runs in 2-5s
- **Per wave merge:** `pnpm test:unit && pnpm test:integration` — runs in 30-90s; requires local Supabase Docker stack
- **Phase gate:** Full suite green before `/gsd-verify-work`: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm test:e2e`

### Wave 0 Gaps

All Phase 4 tests are NEW. The current `tests/` directory holds only Phase 1 fixtures.

- [ ] `tests/integration/iam-signup.integration.test.ts` — AUTH-01, 06, 07, 08
- [ ] `tests/integration/iam-verification-gate.integration.test.ts` — AUTH-02
- [ ] `tests/integration/iam-oauth.integration.test.ts` — AUTH-03
- [ ] `tests/integration/iam-verify-token.integration.test.ts` — AUTH-04
- [ ] `tests/integration/iam-login.integration.test.ts` — AUTH-05
- [ ] `tests/integration/iam-consent-log.integration.test.ts` — AUTH-09
- [ ] `tests/integration/iam-throttle.integration.test.ts` — AUTH-10
- [ ] `tests/integration/iam-password-reset.integration.test.ts` — AUTH-11, 12
- [ ] `tests/integration/iam-change-password.integration.test.ts` — AUTH-13
- [ ] `tests/integration/iam-logout.integration.test.ts` — AUTH-14
- [ ] `tests/integration/inngest-serve.integration.test.ts` — INFRA-10
- [ ] `tests/integration/iam-schema-phase4.integration.test.ts` — schema migration smoke
- [ ] `tests/unit/iam-signup-schema.test.ts` — Zod schemas
- [ ] `tests/unit/tokens.test.ts` — crypto helpers
- [ ] `tests/unit/auth-throttle-math.test.ts` — pure throttle decision functions
- [ ] `tests/unit/email-templates.test.ts` — React Email render snapshots
- [ ] `tests/e2e/iam-unverified-blocker.spec.ts` — AUTH-15 + AUTH-04 happy path (signup → verify → app)
- [ ] `tests/e2e/iam-google-oauth.spec.ts` — AUTH-03 (Playwright with stubbed OAuth)
- [ ] `tests/e2e/settings-account.spec.ts` — UI-13
- [ ] `tests/integration/setup-supabase-truncate.ts` — D-28 helper that TRUNCATEs auth.users between tests
- [ ] `vitest.config.ts` extended: integration project gains `setupFiles: ["tests/integration/setup-supabase-truncate.ts"]`. Phase 1 plan 01-04 deliberately moved `setupFiles` off the integration project to keep synthetic env out (Rule 3 fix in 01-04 SUMMARY); Phase 4 re-adds it for the truncate helper but must NOT re-introduce `tests/unit/setup-env.ts` to integration. Read 01-04 SUMMARY before editing.

**Test fixture helpers (shared infrastructure):**

- [ ] `tests/integration/fixtures/seed-policy-version.ts` — inserts `policy_versions.is_current = true` row
- [ ] `tests/integration/fixtures/seed-user.ts` — admin.createUser + public.users insert
- [ ] `tests/integration/fixtures/mock-resend.ts` — `vi.mock('resend')` factory + assertion helpers
- [ ] `tests/integration/fixtures/mock-inngest.ts` — captures `inngest.send()` calls

## Security Domain

> Required by Phase 4: this is the IAM phase. Multiple OWASP ASVS categories apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
| --- | --- | --- |
| V2 Authentication | yes | Supabase Auth (bcrypt password hashing, JWT) + per-device session via `signOut({scope:'local'})` |
| V3 Session Management | yes | Supabase SSR cookies (HttpOnly, Secure, SameSite=Lax in production); JWT exp from Supabase config; no app-owned session table |
| V4 Access Control | yes | RLS on every user-owned table (Phase 2 D-21/D-22); service-role key server-only; `requireVerifiedUser()` gate at API and root layout |
| V5 Input Validation | yes | Zod schemas at every route handler boundary (Phase 1 D-10); `drizzle-zod`-derived domain schemas (Phase 2 D-19) |
| V6 Cryptography | yes | `node:crypto` for tokens (randomBytes 256-bit + SHA-256 hash + timingSafeEqual); `jose` for JWT verification; never roll our own |
| V7 Error Handling & Logging | yes | Closed error registry (Phase 1 D-10); Sentry scrub for `Authorization`, `Cookie`, `email`, `password`, `token` (Phase 1 D-22 / LGPD-13); `Sentry.setUser({ id })` only |
| V8 Data Protection | yes | LGPD §13 PII handling; ConsentLog audit; `User.deletion_requested_at` 7-day grace via Inngest (Phase 11) |

### Known Threat Patterns for Phase 4 stack

| Pattern | STRIDE | Standard Mitigation |
| --- | --- | --- |
| Credential stuffing / password spray | Spoofing | Per-IP throttle on signup/login/OAuth callback (D-12-D-15); 5 attempts/minute, 5-min lockout |
| Email enumeration via password reset | Information Disclosure | "Always 200" response (D-11); user lookup happens async inside Inngest |
| Email enumeration via signup | Information Disclosure | Signup error responses don't reveal "email already in use"; instead return generic `validation_failed` (or proceed silently if email exists). **Note:** D-03 doesn't explicitly address this; recommend signup also returns 200 + sends a "welcome back" email if email already exists, OR return `validation_failed` with non-specific copy. **Phase 4 plan should explicitly decide.** [ASSUMED — A1] |
| Token reuse (verification or reset) | Tampering | `consumed_at` timestamp marked in same transaction; DB constraint `consumed_at IS NULL` checked before consume |
| Timing attack on token verification | Information Disclosure | `crypto.timingSafeEqual()` comparison (Pattern 7) |
| OAuth state CSRF | Spoofing | Handled by Supabase OAuth flow (state + PKCE); `signInWithOAuth` returns redirect URL with state |
| Session fixation | Spoofing | New JWT issued by Supabase on every signInWithPassword; cookie auto-rotated by `@supabase/ssr` |
| OAuth code interception | Tampering | PKCE handled by Supabase; HTTPS enforced |
| Cross-site cookie leak | Information Disclosure | SameSite=Lax cookies (Supabase default); Secure cookies in production |
| LGPD Art. 7 consent without audit | Repudiation | ConsentLog row with policy_version, source, granted_at — recorded in same DB transaction as signup |
| LGPD Art. 14 child <13 signup | Compliance | Age confirmation required; `age_confirmed_at` set only on confirm; <13 → `validation_failed` |
| Email harvest from Resend reply-to / bounce headers | Information Disclosure | Resend handles bounce processing; `from` is `onboarding@resend.dev` (no PII in domain) |
| Privilege escalation via JWT manipulation | Tampering | jose `jwtVerify` against Supabase JWKS; HS256 / ES256 verification |
| OWASP A07: Identification and Authentication Failures | — | Mitigated end-to-end: rate-limit + token expiry + hash storage + RLS |
| Forced verification bypass via API enumeration | Spoofing | D-23 default-deny allowlist; `requireVerifiedUser()` enforcement; ESLint guard for new routes |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
| --- | --- | --- | --- | --- |
| Local Supabase Docker stack (Postgres 17 + Auth + Inbucket) | Integration tests, dev | ✓ (Phase 1 plan 01-04) | 17.6 / Auth 2.179 | None — must be running |
| Inngest dev CLI | Local dev (function discovery) | ✓ (`npx inngest-cli@latest dev`) | 1.x latest | Functions don't run locally — must install |
| Resend account (sandbox key) | CI E2E (one path) | Founder must provide RESEND_API_KEY in CI secrets | — | D-20: dev console-log fallback when key absent |
| Google OAuth client (test credentials) | E2E for AUTH-03 | Founder must register `localhost:3000/auth/callback` in Google Cloud Console | — | E2E for OAuth can be stubbed via `vi.mock('@supabase/supabase-js')` if not feasible |
| pnpm / Node 22 | All | ✓ (Phase 1) | 22.x / pnpm 9.15.5 | None |
| Inbucket (local mail catcher) | Local dev to inspect verification email rendering | ✓ (Supabase Docker bundle, port 54324) | — | None |

**Missing dependencies with no fallback:**

- **DPO + privacy policy + Terms of Service text** — these are **launch blockers** documented in STATE.md (lines 130-132). Phase 4 plan ships the LGPD-compliant signup form rendering and ConsentLog wiring, but Phase 4 cannot ship to production until founder publishes the actual policy texts and registers a DPO. The Phase 4 plan should call this out explicitly: signup will reference `/legal/terms` and `/legal/privacy` URLs; those pages can render placeholder lorem ipsum during development with a Phase 4 SUMMARY note that founder must replace before production deploy.

**Missing dependencies with fallback:**

- **Verified Resend domain** — Phase 12 lands. Phase 4 uses `onboarding@resend.dev` sandbox per D-19.
- **Production Inngest project** — Phase 12. Phase 4 uses dev server locally.

## Runtime State Inventory

> Phase 4 is greenfield (new feature, not refactor). No existing runtime state to migrate.

| Category | Items Found | Action Required |
| --- | --- | --- |
| Stored data | None — Phase 2 hasn't shipped yet; no existing user records to migrate | None |
| Live service config | Supabase project (local stack only — preview/prod don't exist yet, lands Phase 12) | Phase 12 will configure preview/prod |
| OS-registered state | None | None |
| Secrets/env vars | NEW: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` | Plan 04-01 adds these to `src/shared/config/server-env.ts` Zod schema |
| Build artifacts | None — all changes via Drizzle migration | New migration file under `drizzle/migrations/` |

**Nothing found in any category that requires data migration** — verified by checking STATE.md (1 phase complete, no user data exists yet).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
| --- | --- | --- | --- |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024-04 (deprecation announced); package marked deprecated 2025-11-27 | Phase 4 must use `@supabase/ssr` exclusively |
| Supabase email templates (server-controlled) | Application-owned email events → Resend | This project's D-02 (LGPD + verification gate requirements) | Verification flow uses custom tokens, not Supabase OTP/PKCE recovery |
| `bcrypt` for verification tokens | SHA-256 + timingSafeEqual | Industry standard since ~2010 (GitHub, Stripe pattern) | One-shot URL tokens use SHA-256; password hashing stays bcrypt-via-Supabase |
| `jsonwebtoken` library | `jose` | jose offers edge-runtime support; Phase 2 already chose it (D-33) | Phase 4 inherits |
| Custom rate-limit with Redis | Postgres `auth_throttle` UPSERT-RETURNING | Project chose Postgres-only stack for MVP scale | D-12 lock |
| `next-auth` / `auth.js` | Supabase Auth + `@supabase/ssr` | Project lock (Supabase-first) | Phase 4 uses Supabase |
| `nodemailer` SMTP | Resend SDK + React Email | Resend offers better deliverability + native React templates | D-19 lock |
| In-app crons via `node-cron` | Inngest cron triggers | CLAUDE.md mandates Inngest for all async | INFRA-10 |

**Deprecated/outdated:**

- `@supabase/auth-helpers-nextjs` — DO NOT USE; replaced by `@supabase/ssr`
- Supabase Auth email templates for product-controlled email — DO NOT USE; replaced by Inngest + Resend pipeline
- Naive `Map<string, number>` rate limit — DO NOT USE for serverless (lost across cold starts); replaced by `auth_throttle` table

## Phase 2 Inheritance Audit

**CRITICAL:** Phase 2 has not yet executed (STATE.md: `0/10 plans complete`). Phase 4 cannot start until Phase 2 ships. Plan-phase MUST verify each of these is present before any Phase 4 implementation task runs.

| Phase 2 Deliverable | Source | Phase 4 Use |
| --- | --- | --- |
| AuthAdapter (verifyJWT, getUserById) | D-32 / Plan 02-07 | Phase 4 extends with `getCurrentUser`, `requireVerifiedUser` |
| `users` table (full PRD §4 schema) | D-46 / Plan 02-02 | Phase 4 ALTER TABLE adds `email_verified_at TIMESTAMPTZ NULL` |
| `consent_logs` table | Plan 02-02 | Phase 4 inserts × 2 at signup (D-24) |
| `consent_logs.purpose` literal union includes `terms_of_service` AND `privacy_policy` | Plan 02-02 (varchar with CHECK-friendly literal union) | D-24 inserts these two values; if Phase 2's enumeration omits them, Phase 4 plan must extend the literal union AND any CHECK constraint. **Verify before drafting Phase 4 schema migration.** |
| `consent_logs.source` literal union includes `signup` AND `settings` | Plan 02-02 | D-24 uses `signup`; Phase 11 will use `settings`. Same verification step. |
| `policy_versions` table with `is_current` | D-13 / D-48 / Plan 02-02 | Phase 4 reads at signup time to bind ConsentLog rows |
| `subscriptions` table | Plan 02-03 | Phase 4 inserts initial `status=trialing` row |
| `idempotency_keys` table | D-37 / D-38 / Plan 02-06 | Phase 4 mutating routes accept `Idempotency-Key` header |
| RLS posture (D-20-D-22) | Plan 02-03 | Phase 4 NEW tables (`email_verification_tokens`, `password_reset_tokens`, `auth_throttle`) follow same posture: enabled, owner-only or service-role-only |
| `db/client.ts` runtime client with `{ prepare: false }` | D-14 / Plan 02-05 | Phase 4 imports for all repo queries |
| `auth.users → public.users` insert trigger (safety net) | D-35 / Plan 02-03 | Phase 4 D-03 explicitly relies on this as the "safety net" |
| `src/proxy.ts` API-aware (fast missing-bearer rejection) | D-34 / Plan 02-07 | Phase 4 D-21 preserves this; product verification lives in helpers/server components |
| Closed error registry (`unauthenticated`, `email_unverified`, etc.) | Phase 1 D-10 | Phase 4 imports — no ad-hoc codes added |
| Sentry scrub of `email`/`password`/`token`/`Authorization`/`Cookie` | Phase 1 D-22 / LGPD-13 | Phase 4 auth flows protected by default |
| PostHog server provider (posthog-node) | Plan 01-06 | Phase 4 fires `signup_completed` from `/auth/verify` route |
| next-intl `pt-BR.json` | Phase 1 D-15 | Phase 4 adds `auth.*`, `settings.*`, `email.*` namespaces (currently `{}`) |

**If any of the above is missing when Phase 4 starts:** plan-phase must add a Phase 2 dependency-resolution task as plan 04-00 / 04-01 BEFORE any Phase 4-specific work.

## Project Constraints (from CLAUDE.md)

The following directives from `./CLAUDE.md` are non-negotiable for Phase 4. The planner verifies compliance.

- **Tech stack: Next.js 16 App Router + React 19 + TS, PWA via `@serwist/next`** — Phase 4 must not introduce new framework primitives outside Next 16's surface area.
- **Tech stack: Supabase Postgres via Supavisor transaction-mode pooler, Drizzle ORM inside repositories only, `postgres-js` driver with `{ prepare: false }` mandatory** — Phase 4 NEW tables go through Drizzle; no raw `postgres` calls outside `src/contexts/iam/infrastructure/db/*.ts`.
- **Tech stack: Inngest for all async work — events, cron, durable `step.sleepUntil` — no raw cron, no BullMQ. Free-tier `sleepUntil` cap is 7 days** — Phase 4 onboards Inngest; no setInterval, no node-cron, no Redis queues. (Phase 4 does not use sleepUntil; that's Phase 11.)
- **Tech stack: Vercel hosting, deploys from GitHub Actions ONLY. Vercel git integration DISABLED so tests, migrations, and deploys share one pipeline** — Phase 4 doesn't deploy; Phase 12 does.
- **Locale: pt-BR only at launch — `next-intl` mandatory day one, `<html lang="pt-BR">`, `date-fns-tz` for server-rendered user-local times, numbers/currency via `Intl.*` with `pt-BR`** — Every form label, error string, and email body in Phase 4 must come from `messages/pt-BR.json`. Email templates use `<Html lang="pt-BR">`.
- **Platform: Mobile-first PWA, tablet-width centered on desktop. No wide-screen design. Bottom-nav only, max 5 tabs (MVP uses 4).** — Settings shell follows tablet-width centered; Phase 4's UI doesn't add bottom-nav tabs (inherits Phase 3's 4 tabs).
- **Accessibility: WCAG 2.1 AA = ship blocker** — Forms include `role="alert"` for errors, `aria-live="polite"` for cooldown, focus-trap, semantic types + autocomplete tokens (UI-SPEC §1).
- **Compliance (LGPD): DPO appointed + privacy policy published before first identification — Art. 33 consent before first upload, Art. 18 data rights** — Phase 4 captures consent (Art. 7 §1: free, informed, unambiguous, specific) at signup AND OAuth-complete; LGPD §13 deletion grace lands Phase 11.
- **Performance: Vercel function budgets for identification — total wall-clock 50s, per-call cap 30s** — Phase 4 endpoints don't hit these (auth flows are <500ms typical); but signup orchestration must complete under 5s including Inngest event emission.
- **Budget: Per-provider daily cost ceilings enforced in DB + atomic counters** — Not in scope for Phase 4 (Phase 6 owns).
- **Content: ≥200 curated care guides shipped before MVP launch** — Not in scope.
- **Payments: Single monthly tier, Stripe (card + Pix), 14-day organic / 30-day partner trial** — Phase 4 only creates initial trialing Subscription row; transitions live in Phase 10.
- **Security: Per-device JWT, no server sessions, narrow per-IP throttle on public auth endpoints — only place `rate_limited` 429 is emitted in MVP. Standard security headers via Next.js middleware. RLS on all user-owned tables, service-role key server-side only.** — Phase 4 enforces all of these.
- **Data: Timestamps ISO-8601 UTC with `Z`; exception: `User.notification_time_local` as `HH:MM` in `User.timezone`.** — Phase 4 token expiry, granted_at, etc., all timestamptz.
- **Error codes: Closed registry in PRD §5 — no ad-hoc error codes.** — Phase 4 emits only existing codes.
- **Observability: Sentry (release = git SHA, source maps uploaded post-build from CI), PostHog US cloud (LGPD Art. 33 transfer basis documented in privacy policy + DPA via PostHog SCCs per LGPD Art. 33), SQL rollups via Inngest cron for identification quality metrics. `Sentry.setUser({ id })` only — never email.** — Phase 4 PostHog server events + Sentry capture follow the locked posture.

## Sources

### Primary (HIGH confidence)

- **Context7 /inngest/inngest-js** — Inngest serve handler, createFunction signatures, send/idempotency pattern, step.run / step.sendEvent, NonRetriableError / RetryAfterError, dev server invocation
- **Context7 /websites/inngest** — events.id deduplication semantics, durable function concepts
- **Context7 /websites/resend** — Send email with React Email components, idempotency keys, error response shape, 4xx/5xx retry strategy, sandbox / `delivered@resend.dev` test addresses, AI critical instructions
- **Context7 /resend/react-email** — Component primitives, render function, dark-mode meta tags, Tailwind CSS limitations in email
- **Context7 /supabase/ssr** — createServerClient cookie pattern (getAll/setAll), createBrowserClient, OAuth flow signature, getUser vs getSession
- **Context7 /supabase/supabase** — auth.signOut scopes, admin.createUser email_confirm semantics, admin namespace requires service_role, auth.email config.toml fields
- **Context7 /panva/jose** — createRemoteJWKSet + jwtVerify (Supabase JWKS pattern; Phase 2 already adopted)
- **Context7 /drizzle-team/drizzle-orm-docs** — onConflictDoUpdate + RETURNING patterns
- **npm registry direct query** — Verified package versions (inngest 4.2.4, resend 6.12.2, @react-email/components 1.0.12, @supabase/ssr 0.10.2, @supabase/supabase-js 2.104.1, drizzle-orm 0.45.2)
- **npm view '@supabase/auth-helpers-nextjs' deprecated** — Verified deprecation: "Package no longer supported"
- **`supabase/config.toml:212-227`** — Verified `enable_confirmations = false`, `enable_signup = true`, `max_frequency = "1s"`, OTP length 6 / expiry 3600s
- **`./CLAUDE.md`** — Project tech stack lock-ins
- **`docs/CAVE-PRD.md` §3, §4, §5, §12, §13, §14, §16, §20, §21, §23** — Bounded contexts, data model, error registry, auth specifics, LGPD, multi-device, screens, env vars, security checklist, acceptance criteria
- **`.planning/phases/02-data-layer/02-CONTEXT.md`** — D-32, D-33, D-37, D-46 (User table full schema), D-48 (policy_versions is_current), D-35 (auth.users → public.users trigger)
- **`.planning/phases/04-iam-auth-verification-consent/04-CONTEXT.md`** — All 30 D-* decisions, the source of truth for Phase 4
- **`.planning/phases/04-iam-auth-verification-consent/04-UI-SPEC.md`** — Locked copy + visual contract

### Secondary (MEDIUM confidence)

- **github.com/supabase/supabase docs (referenced via Context7)** — Email confirmation enable/disable behavior across local + hosted environments
- **inngest.com docs (referenced via Context7)** — Per-event 24h idempotency window, dev server discovery URL convention

### Tertiary (LOW confidence)

- None — all Phase 4 stack decisions are verifiable against official sources.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
| --- | --- | --- | --- |
| A1 | Signup with already-existing email returns `validation_failed` (CONTEXT D-03 doesn't explicitly say) | Security Domain (Email enumeration via signup) | If we surface "email already in use", attackers enumerate accounts — recommend planner asks user during plan-phase to lock the policy. May fold into D-03 by simply returning a generic `validation_failed` without disclosing whether the email is taken; verification flow (which stays unique) prevents creating duplicates. |
| A2 | Resend free-tier sandbox restriction matches docs (sender-only-to-verified-recipient) — assuming founder's Resend account is in sandbox during Phase 4 | Pitfall 4 / Environment Availability | If founder has already verified a domain, behavior differs. Plan 04 task should verify founder's Resend project state. |
| A3 | Supabase preview/prod environments will mirror local config.toml `enable_confirmations = false` | Pitfall 1 | If preview/prod inherit default `true`, Phase 4 ships double-emails. Phase 12 should add an explicit settings sync as a deploy-pipeline task; for now, document the requirement. |
| A4 | Phase 4 plan can use `@supabase/ssr`'s `getAll/setAll` cookie API directly without porting; Next 16 doesn't break this surface | Pattern 5 | If Next 16's cookies() API has a deprecated method we hit, we must adapt at plan time. Ctx7 docs (verified above) show current `await cookies()` and `cookieStore.getAll() / cookieStore.set()` — should be fine. |
| A5 | The Phase 4 plan can rely on Phase 2's `users` table being IDENTICAL to PRD §4 (so we only ALTER for `email_verified_at`) | Phase 2 Inheritance Audit | If Phase 2 adds `email_verified_at` itself, Phase 4 doesn't need the migration. Plan-phase verifies Phase 2's actual `users` schema before drafting migration tasks. |

## Open Questions

1. **Signup with already-registered email — what response code?**
   - What we know: D-03 doesn't specify; PRD §5 closed registry has `validation_failed` (400) and `conflict` (409).
   - What's unclear: Returning 409 leaks "this email is registered" — defeats enumeration mitigation. Returning 400 + generic "could not create account" is safer but loses signal for legitimate users.
   - Recommendation: Plan-phase should ask user. Default proposal: return `validation_failed` 400 with non-specific copy "Não foi possível criar a conta com esses dados. Verifique e tente novamente."; if email truly is taken, dispatch a `notifications/email.requested` event for a "welcome back / reset your password" email so legitimate users still recover. **Document as Phase 4 plan-phase decision.** (Linked to A1.)

2. **Inbucket as test email viewer in dev?**
   - What we know: Local Supabase Docker stack ships Inbucket (port 54324). Phase 4 D-20 says local dev console-logs payload — no actual SMTP send.
   - What's unclear: Should Phase 4's local resend-adapter optionally ALSO post to Inbucket so developers see the rendered HTML? Or stick with stdout JSON?
   - Recommendation: Stick with stdout JSON per D-20 lock; document Inbucket as "currently unused — Supabase email is disabled for product flow" in Phase 4 SUMMARY.

3. **Where exactly does the Phase 4 plan add `email_verified_at` to the `users` table?**
   - What we know: Phase 2 plan-02-02 schema task (line 65) does NOT include `email_verified_at`. PRD §4 also doesn't mention it (the User schema in §4 omits it — see Read of CAVE-PRD.md:99-216).
   - What's unclear: Is this an oversight in the PRD, or is `auth.users.email_confirmed_at` intended as the source of truth (which D-22 forbids)?
   - Recommendation: Phase 4 plan adds the column via new migration (`drizzle/migrations/XXXX_phase04_add_email_verified.sql`) AND updates the Drizzle schema in `src/contexts/iam/infrastructure/db/schema.ts`. The plan should note this as an intentional Phase 4 addition. **PRD §4 should be amended in a Phase 4 doc-fix task.**

4. **OAuth `age_confirmed_at IS NULL` gate enforcement order — does it run before or after the verification gate?**
   - What we know: D-21 says verification gate runs at root layout. D-04 says OAuth-complete is the only reachable route until age_confirmed_at is set.
   - What's unclear: For an OAuth user with `age_confirmed_at = NULL` AND `email_verified_at = NULL` (impossible if D-04 is implemented correctly, but defense-in-depth), which redirect happens?
   - Recommendation: Plan codifies the order: (a) authenticated check (no JWT → /auth/login); (b) `age_confirmed_at IS NULL` → /auth/oauth-complete; (c) `email_verified_at IS NULL` → render UnverifiedBlocker; (d) authorized children. OAuth-complete writes both fields atomically, so a normally-flowing OAuth user never lands in (c).

5. **Inngest signing-key dev mode — how does the dev server bypass it?**
   - What we know: Production requires `INNGEST_SIGNING_KEY`; dev server doesn't.
   - What's unclear: Does the `serve()` handler need different behavior, or does the SDK auto-detect?
   - Recommendation: SDK auto-detects via the absence of `INNGEST_SIGNING_KEY`. Plan documents in env vars section: `INNGEST_SIGNING_KEY` is REQUIRED in production; OPTIONAL locally (dev server signs with its own key).

6. **AUTH-14 wording - does "revokes that JWT" mean the JWT is invalidated, or just the cookie/refresh-token cleared?**
   - What we know: Supabase docs explicitly state access tokens remain valid until `exp` even after `signOut` [CITED: github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/signout.mdx]. D-05 forbids app-owned JWT denylist. JWT default exp is 1h on Supabase.
   - What's unclear: Does the user (Marco) want the integration test to assert "JWT rejected immediately after logout" (impossible without denylist) or "cookie cleared + refresh fails" (what Supabase actually delivers)?
   - Recommendation: Plan-phase explicitly asks. Default proposal: amend AUTH-14 SUMMARY to read "logout clears the device's cookie and revokes its refresh token; the existing JWT continues to be valid until its `exp` (<=1h)"; integration test asserts cookie cleared + refresh fails. If user requires immediate JWT invalidation, that's out-of-scope for MVP and rolls into AUTH-v2-02 (logout-all-devices) which would require a JWT-denylist table or Supabase-Auth-Hooks integration. (Linked to Pitfall 12.)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every package version verified against npm registry on 2026-04-26; current API shapes verified against Context7
- Architecture: HIGH — every architectural decision is locked in CONTEXT.md; this research verifies execution feasibility, not exploration
- Pitfalls: HIGH — derived from official docs + locked decisions; no speculative pitfalls
- Test architecture: HIGH — uses already-shipped Vitest projects (unit + integration) + Playwright; pattern proven in Phase 1
- Phase 2 inheritance: HIGH for the items themselves (PRD + CONTEXT both cite them), MEDIUM for Phase 2's actual completion state (depends on Phase 2 actually shipping)
- Security domain: HIGH — STRIDE/ASVS mappings derived from authoritative sources

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 — stack is stable; refresh if Inngest, Resend, or @supabase/ssr ship breaking-change majors before Phase 4 begins.

---

*Phase: 04-iam-auth-verification-consent*
*Researched 2026-04-26 by gsd-researcher*
*Locks honored: 04-CONTEXT.md (D-01..D-30) + 04-UI-SPEC.md (locked copy + interaction contracts)*
