# Phase 4: IAM — Auth, Verification, Consent - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `04-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 04-iam-auth-verification-consent
**Mode:** power (file-based bulk question UI)
**Source files:** `04-QUESTIONS.json` (state), `04-QUESTIONS.html` (UI)
**Total questions:** 30 across 10 sections
**Answered:** 27/30 (90%)
**Open (set to "Other" without text):** 3 — Q-02, Q-06, Q-25

---

## Supabase Auth Integration Boundary

### Q-01 — Auth backend

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Auth (full) | Use supabase.auth.* end-to-end; accept Supabase JWT (Phase 2 JWKS); Google OAuth via Supabase; email dispatch via Auth Hooks. | ✓ |
| Hybrid | Custom email/password (bcrypt/argon2id, JWT minting); Supabase only for OAuth. | |
| Custom-rolled all | Bypass Supabase Auth entirely. | |

**User's choice:** Supabase Auth (full) — recommended

### Q-02 — Email dispatch path  ⚠ OPEN

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Auth Hooks → Inngest → Resend | Hook receives auth-email triggers; emits Inngest event; `notifications/send-email` renders pt-BR React Email + sends Resend. | |
| Custom SMTP pointing at Resend | Loses React Email templates, loses pt-BR override, loses Inngest integration point. | |
| Disable Supabase emails; mint own tokens | Full control, abandons Supabase's confirmation_token machinery. | |
| Other (no text) | | ✓ |

**User's choice:** Other (no text typed) — left open for follow-up discussion before plan-phase
**Notes:** Entangled with Q-06 (token mechanism). Recommendation in CONTEXT.md is option (a).

### Q-03 — Signup orchestration vs Phase 2 trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Application-level signup endpoint | POST /api/v1/iam/signup orchestrates Supabase admin createUser + DB tx (User + ConsentLog × 2 + Subscription); Phase 2 D-35 trigger as safety net. | ✓ |
| Trigger authoritative; app updates after | Trigger creates minimal users row; app UPDATEs + INSERTs ConsentLog + Subscription. | |
| Drop the trigger; app code only | Removes Phase 2 D-35 commitment; OAuth signups would lack public.users row. | |

**User's choice:** Application-level signup endpoint — recommended

### Q-04 — OAuth post-callback flow

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory post-callback completion screen | /auth/oauth-complete collects age/T&C/privacy/timezone before app shell. | ✓ |
| Inline modal on first app shell visit | Higher friction at the worst moment. | |
| Defer to first action | Legally weak — T&C not accepted before catalog actions. | |

**User's choice:** Mandatory post-callback completion screen — recommended

### Q-05 — Per-device JWT semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase session = device | Logout calls signOut({scope: 'local'}); Phase 8 ties PushSubscription.device_id to session_id. | ✓ |
| Custom device_id claim + sessions registry | Issue UUID device_id, custom JWT template, device_sessions table. | |
| Mint own JWT alongside Supabase | Redundant verification path. | |

**User's choice:** Supabase session = device — recommended

---

## Email Verification Flow

### Q-06 — Verification token mechanism  ⚠ OPEN

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase confirmation_token via verifyOtp | Supabase issues+stores+expires; we render email body. Default 24h expiry. | |
| Custom verification_tokens table | Own opaque token, sha256-hashed, full expiry control. | |
| Magic-link OTP (6-digit code) | Different UX. | |
| Other (no text) | | ✓ |

**User's choice:** Other (no text typed) — left open
**Notes:** Entangled with Q-02 (email dispatch). Recommendation in CONTEXT.md is option (a).

### Q-07 — Verification link landing route

| Option | Description | Selected |
|--------|-------------|----------|
| Server route /auth/verify?token=... | Validates via verifyOtp, sets email_verified_at, redirects /; PostHog server event. | ✓ |
| Client-side /auth/verify route | Browser-side flow. | |
| Supabase hosted page | No brand, no pt-BR. | |

**User's choice:** Server route — recommended

### Q-08 — Resend-verification UX behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Invalidate prior token, mint new | supabase.auth.resend({type: 'signup'}); single-token-active rule. | ✓ |
| Mint additional, both valid until expiry | Safer if mail lands late; ambiguous state. | |
| Per-user rate-limited resend (1/min) | Combine with (a)/(b); defends against email-flood. | |

**User's choice:** Invalidate prior, mint new — recommended (combine with per-user rate limit per chat-more guidance in CONTEXT.md D-08)

---

## Password Reset Flow

### Q-09 — Reset token mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase resetPasswordForEmail (built-in) | Token issuance/expiry shared with verification; configurable 1h. | ✓ |
| Custom password_reset_tokens table | Full custom control. | |
| OTP-style 6-digit code | Different UX. | |

**User's choice:** Supabase built-in — recommended

### Q-10 — Reset link landing route

| Option | Description | Selected |
|--------|-------------|----------|
| Server route /auth/reset?token=... | Renders new-password form; submits to POST /api/v1/iam/password/reset. | ✓ |
| Client-side /auth/reset route | Browser-side updateUser. | |
| Supabase hosted page | No brand. | |

**User's choice:** Server route — recommended

### Q-11 — "Always 200" implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Endpoint enqueues Inngest event + returns 200 | Inngest function looks up user; if exists+has-password → trigger Supabase resetPasswordForEmail. | ✓ |
| Synchronous lookup, conditional enqueue, 200 | Risk: response time leaks existence. | |
| Always send; email body says "if you have an account..." | Wastes quota; phantom emails. | |

**User's choice:** Enqueue first — recommended

---

## Per-IP Auth Throttle

### Q-12 — Throttle storage backend

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres atomic counter table | UPSERT pattern; no new dependency. | ✓ |
| Vercel KV (Redis) | New service, vendor-locked. | |
| Upstash Redis (REST) | New external dep. | |

**User's choice:** Postgres atomic counter — recommended

### Q-13 — Throttle window strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed bucket per minute | Simple INSERT/UPDATE; small boundary-burst risk. | ✓ |
| Sliding window (last 60s) | Tighter accuracy; per-attempt rows + cleanup pressure. | |
| Token bucket (refill rate) | Overkill for narrow throttle. | |

**User's choice:** Fixed bucket — recommended

### Q-14 — Throttle thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| 5/minute, 5min lockout | Strict but tolerant; CGNAT-friendly. | ✓ |
| 10/minute, 5min lockout | Looser; lower false-positive on shared IPs. | |
| 3/minute, 30/15min | Very strict. | |

**User's choice:** 5/minute, 5min lockout — recommended

### Q-15 — Failed-only counting

| Option | Description | Selected |
|--------|-------------|----------|
| Increment only on failed attempts | Simplest, no race. | ✓ |
| Increment all; decrement on success | Race risk. | |
| Two counters (total + failed) | Over-engineered. | |

**User's choice:** Failed-only — recommended

---

## Inngest Onboarding

### Q-16 — Phase 4 Inngest function scope

| Option | Description | Selected |
|--------|-------------|----------|
| Implement notifications/send-email; stub the other 7 | Full INFRA-10 registration; later phases replace stubs. | ✓ |
| Register only notifications/send-email | Other registrations land in their phase. | |
| Implement send-email + iam/process-deletion + iam/generate-export | IAM-context completeness; risks scope creep into Phase 11. | |

**User's choice:** Implement send-email; stub the rest — recommended

### Q-17 — Function registration shape

| Option | Description | Selected |
|--------|-------------|----------|
| Per-context exports + central registry | src/contexts/{ctx}/inngest/functions.ts → src/shared/inngest/registry.ts → serve(). | ✓ |
| Flat src/shared/inngest/functions/* | Easier to grep; breaks bounded-context ownership. | |
| Inline definitions in route.ts | Coupling-heavy. | |

**User's choice:** Per-context + central registry — recommended

---

## Resend & React Email Onboarding

### Q-18 — React Email setup depth

| Option | Description | Selected |
|--------|-------------|----------|
| @react-email/components only (no preview server) | Minimal Phase 4 surface. | ✓ |
| Full react-email package + preview server | Best DX for copy iteration; new dev port. | |
| Raw HTML strings or MJML | Slower iteration. | |

**User's choice:** components-only — recommended

### Q-19 — From address in Phase 4

| Option | Description | Selected |
|--------|-------------|----------|
| onboarding@resend.dev (sandbox) | Works out-of-box; production swap in Phase 12. | ✓ |
| Founder verifies folhario.com.br on Resend now | Production-realistic; founder-side blocker. | |
| Sandbox dev/CI; verified preview/prod (Phase 12 onboards) | Same as (a). | |

**User's choice:** Sandbox — recommended

### Q-20 — Local dev / CI test send behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Dev console-logs payload; CI uses sandbox | Minimizes Resend quota burn from local iteration. | ✓ |
| Always hit Resend sandbox | Faster fidelity; quota concerns. | |
| Local Mailpit + Resend everywhere else | Best dev fidelity; new container. | |

**User's choice:** Dev console-log; CI sandbox — recommended

---

## Verification Gate Enforcement

### Q-21 — Where the gate lives

| Option | Description | Selected |
|--------|-------------|----------|
| API: shared route guard helper. UI: server-component check at root layout | Explicit per-route + per-page; src/proxy.ts unchanged. | ✓ |
| Next middleware (src/proxy.ts) blocks both | Edge runtime DB lookups limited; mixes locale + auth. | |
| API: middleware. UI: client-side check | Worse UX; less consistent. | |

**User's choice:** Helper + server-component check — recommended

### Q-22 — How verified is detected per request

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror to public.users.email_verified_at; read per request | Always fresh; ~5-10ms; cache 60s if hot. | ✓ |
| JWT custom claim email_verified | Fast; stale claim until token refresh. | |
| Both — JWT with DB fallback | Robust; complex. | |

**User's choice:** public.users source of truth — recommended

### Q-23 — Allowed-endpoints policy

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist (default deny) | New endpoints must opt-in; safest. | ✓ |
| Denylist (default allow) | Easier to break. | |
| Per-handler metadata flag | Inversion of control; relies on every handler remembering. | |

**User's choice:** Allowlist — recommended

---

## ConsentLog & Signup Atomicity

### Q-24 — Initial ConsentLog rows at signup

| Option | Description | Selected |
|--------|-------------|----------|
| Two rows: terms_of_service + privacy_policy | Granular, auditable, future-proof for material-change re-consent. | ✓ |
| One combined row signup_terms_and_privacy | Simpler; less granular. | |
| No rows at signup | Under-records LGPD Art. 8 §1 demonstration burden. | |

**User's choice:** Two rows — recommended

### Q-25 — Signup transaction atomicity  ⚠ OPEN

| Option | Description | Selected |
|--------|-------------|----------|
| Two-phase: Supabase Auth → DB tx → Inngest event | Compensating delete on auth.users if DB tx fails; D-35 trigger as backstop. | |
| One DB transaction including auth.users via SQL | Bypasses Supabase password hashing; brittle. | |
| Sequential with saga compensation | Complex; overkill. | |
| Other (no text) | | ✓ |

**User's choice:** Other (no text typed) — left open
**Notes:** Entangled partly with Q-03 (signup orchestration). Recommendation in CONTEXT.md is option (a).

---

## Settings Shell

### Q-26 — Settings routing pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-routes /settings/[section] | Deep-linkable; cleaner code split. | ✓ |
| Single /settings page with anchors | Long mobile scroll; can't deep-link. | |
| Tabs on /settings | A11y-fragile; crowded mobile. | |

**User's choice:** Sub-routes — recommended

### Q-27 — Placeholder content for not-yet-built sections

| Option | Description | Selected |
|--------|-------------|----------|
| Brand-consistent "Em breve" card per section | Visible scaffolding, no fake controls. | ✓ |
| Section omitted (404) | Confusing; feels broken. | |
| Disabled placeholder controls | Looks broken/buggy. | |

**User's choice:** "Em breve" cards — recommended

---

## Testing & Copy Ownership

### Q-28 — Auth integration testing

| Option | Description | Selected |
|--------|-------------|----------|
| Real local Supabase Auth in integration tests | Truncate auth.users + public.users between tests. | ✓ |
| Mock Supabase Auth at AuthAdapter boundary | Faster; less coverage. | |
| Hybrid (Phase 2 D-44 posture) | Brittle hybrid splitting. | |

**User's choice:** Real local Supabase Auth — recommended

### Q-29 — Resend testing

| Option | Description | Selected |
|--------|-------------|----------|
| Mock Resend SDK; one E2E hits sandbox | Fast, deterministic, low quota burn. | ✓ |
| Always hit Resend sandbox | Slower; quota concerns. | |
| Mailpit + always real send | Highest fidelity; new container. | |

**User's choice:** Mock + one E2E sandbox — recommended

### Q-30 — pt-BR copy ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Claude proposes drafts; founder reviews + edits | Speed + founder control. | ✓ |
| Founder authors all upfront | High quality; slower; founder bandwidth concern. | |
| English placeholders + later i18n pass | Violates "next-intl mandatory day one". | |

**User's choice:** Claude drafts; founder reviews — recommended

---

## Claude's Discretion

(Captured in `04-CONTEXT.md` `<decisions>` "Claude's Discretion" subsection — exact field names/Zod schemas, exact pt-BR copy strings, React Email component hierarchy details, throttle cleanup cadence, Settings → Account timezone-edit UI shape, allowlist additions, file splits inside the IAM context.)

## Deferred Ideas

(Captured in `04-CONTEXT.md` `<deferred>` section — Open Questions Q-02/Q-06/Q-25 + future-phase deferrals.)

---

*Phase: 04-iam-auth-verification-consent*
*Mode: power (bulk question generation; user mass-selected recommended; 3 questions left as "Other" for follow-up)*
*Discussion log written: 2026-04-26*
