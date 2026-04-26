---
phase: 4
reviewers: [codex]
reviewed_at: 2026-04-26T22:23:54Z
plans_reviewed: [04-01-PLAN.md, 04-02-PLAN.md, 04-03-PLAN.md, 04-04-PLAN.md, 04-05-PLAN.md, 04-06-PLAN.md, 04-07-PLAN.md, 04-08-PLAN.md, 04-09-PLAN.md, 04-10-PLAN.md, 04-11-PLAN.md]
---

# Cross-AI Plan Review — Phase 4: IAM — Auth, Verification, Consent

## Codex Review

## Summary

The plan set is thorough and covers the right product surface, but I would not execute it as-is. The decomposition is strong, yet several plans claim guarantees that the implementation sketches do not actually provide, especially around database transactions, RLS migration application, throttle semantics, cookie/session testing, and UI form submission. The biggest issue is that the plans can produce false confidence: tests are often placeholders or directly invoke Next route handlers that depend on `next/headers`, while critical auth behavior needs real request/cookie execution.

## Strengths

- Clear phase coverage: signup, verification, resend, login/logout, password reset, OAuth completion, Inngest, Resend, Settings, and blocker UI are all represented.
- Good product decisions: `public.users.email_verified_at` as the verification source of truth, custom hashed tokens, anti-enumeration reset flow, and clarified AUTH-14 Supabase logout semantics.
- Strong intent around LGPD: age confirmation, two ConsentLog rows, policy version binding, and no fake use of Supabase email confirmation.
- Inngest/Resend topology is conceptually sound and keeps transactional email on one pipeline.
- The prerequisite audit is a useful guard before Phase 4 work starts.

## Concerns

- **HIGH: RLS migration path is wrong.** Plan 04-02 appends custom RLS SQL to a generated migration, then runs `drizzle-kit push`. `push` diffs schema and will not reliably apply hand-appended migration SQL. Token tables may ship without RLS/indexes despite tests expecting them.

- **HIGH: Claimed DB transactions are not implemented.** Signup, OAuth completion, and verification are sequential repository calls, not one DB transaction. Failures can leave partial `public.users`, ConsentLog, Subscription, token, or consumed-token states. Verification also consumes the token before setting `email_verified_at`.

- **HIGH: Adapter boundary is violated.** Application use-cases directly call Supabase SDK, and `/api/v1/iam/me` uses Drizzle directly in a route handler. This conflicts with the project’s adapter/repository boundary.

- **HIGH: UI forms will not work with the API routes.** Plan 04-10 uses plain HTML forms posting `application/x-www-form-urlencoded`, while route handlers expect `request.json()`. Signup/login/reset/change-password/OAuth-complete will fail unless routes accept `FormData` or forms use client-side JSON fetch.

- **HIGH: Throttle does not implement the specified 5-minute lockout.** The implementation is only a fixed one-minute counter. It also fails OAuth callback throttling because failure redirects are `302`, while `withThrottle(..., "on-failure")` increments only on `401/403`.

- **HIGH: Auth/cookie integration tests are likely false positives.** Many tests directly invoke route functions that depend on `next/headers` cookies. The logout test contains an always-true assertion, and the verification-gate test is explicitly a placeholder rather than exercising a real gated endpoint.

- **HIGH: Root layout gate is unreliable.** It depends on an `x-pathname` header that no plan sets. Falling back to `/` weakens the unauthenticated redirect and makes gate behavior path-dependent in a way tests may not catch.

- **HIGH: Password reset event id dedup is too broad.** `password-reset-request/${email}` dedups for 24h, which can block legitimate reset requests after the 1h token expiry.

- **MEDIUM: Phase 3 prerequisite is contradictory.** Plan 04-01 calls Phase 3 a hard prerequisite in some places, then soft-warns and hand-rolls UI in others. Decide one policy.

- **MEDIUM: Migration numbering is brittle.** Hardcoding `0001_phase04_iam_extensions.sql` assumes Phase 2 only created `0000`, which may not hold.

- **MEDIUM: `src/messages/pt-BR.json` may not match the existing next-intl path.** Earlier context references `messages/pt-BR.json`. If the wrong path is edited, UI copy will not load.

- **MEDIUM: Partner code behavior is risky.** Treating any non-empty partner code as a 30-day trial invites abuse and conflicts with the presence of `invalid_partner_code`.

- **MEDIUM: Consent UX is under-specified.** The signup form has checkboxes but no actual Terms/Privacy links, which weakens “informed” consent.

- **MEDIUM: Inngest topology drifts from INFRA-10.** The requirement says 8 MVP functions; the plans register 9 then 10, and place `notifications-send-push` under reminders. That should be made intentional or corrected.

## Suggestions

- Fix Plan 04-02 before execution: use `drizzle-kit migrate` or an explicit `psql` migration application for custom RLS SQL. Do not rely on `push` for appended policies.
- Introduce transaction-aware repositories, e.g. every repo accepts `dbOrTx`, then wrap signup, OAuth completion, and verify-token consumption in one `db.transaction`.
- Move all Supabase SDK calls behind an IAM auth adapter. Application code should call `authAdapter.createUser`, `signIn`, `signOutLocal`, `updatePassword`, etc.
- Move `/api/v1/iam/me` timezone update into a repository/use-case; keep Drizzle out of route handlers.
- Decide either JSON APIs with client components/fetch, or server/form endpoints that parse `FormData` and redirect. Do not mix plain forms with JSON-only handlers.
- Implement real lockout semantics with `locked_until` or a separate lockout table. Count OAuth callback failures before returning the redirect.
- Replace direct route-function tests for auth flows with tests against a running Next server or Playwright/APIRequestContext so cookies, redirects, and `next/headers` are real.
- Remove placeholder/permissive tests. Every auth requirement should have at least one assertion that would fail if the feature were broken.
- Change password-reset event id to include a short time bucket or token/request id, not only email, so users can request a new link after expiry.
- Validate partner codes against PartnerStore now, or store the code but keep trial source organic until Phase 10 validates it.
- Add real Terms/Privacy links to signup and OAuth-complete forms, tied to the active policy version.
- If Phase 3 is missing, Plan 10 must also implement the global focus ring and other WCAG baseline items it depends on.

## Risk Assessment

**Overall risk: HIGH.** The plans aim at the right phase goal, but as written they can ship broken or partially insecure auth behavior while tests still pass. The most important blockers are transactionality, migration/RLS application, route/form mismatch, throttle semantics, and real cookie-based test coverage. Once those are corrected, the architecture should be viable.

---

## Consensus Summary

Only one reviewer (Codex) was invoked for this phase. The "consensus" below is Codex's prioritized findings; running additional reviewers (Gemini, Claude, OpenCode) would surface divergent or confirming views.

### Agreed Strengths

*(single reviewer — strengths reflect Codex's view only)*

- Clear phase decomposition across signup, verification, resend, login/logout, password reset, OAuth completion, Inngest, Resend, Settings, and the unverified blocker.
- Sound product decisions: `public.users.email_verified_at` as the verification source of truth, custom hashed app tokens, anti-enumeration reset flow, AUTH-14 single-device logout semantics.
- Strong LGPD intent: age confirmation, two ConsentLog rows at signup, policy-version binding, no fake reuse of Supabase email confirmation.
- Inngest/Resend topology keeps transactional email on a single pipeline.
- Plan 04-01 prerequisite audit guards against starting on an unsound base.

### Agreed Concerns

Highest-priority HIGH-severity items from Codex (must address before execution):

1. **RLS migration application is unsound** — Plan 04-02 hand-appends RLS SQL to a generated migration and runs `drizzle-kit push`. `push` diffs schema and will not reliably apply the appended policy SQL; token tables may ship without RLS or required indexes.
2. **Claimed DB transactions are not actually implemented** — Signup, OAuth completion, and verification are sequential repository calls rather than a single `db.transaction(...)`. Verification consumes the token before setting `email_verified_at`, leaving the door open to partial-state failures.
3. **Adapter boundary violations** — Application use-cases call the Supabase SDK directly, and `/api/v1/iam/me` uses Drizzle inside a route handler. Both contradict the project's Drizzle-in-repos-only and adapter-only-for-vendors rules.
4. **UI forms vs JSON API mismatch** — Plan 04-10 uses plain HTML form posts (`application/x-www-form-urlencoded`) while route handlers call `request.json()`. Signup/login/reset/change-password/OAuth-complete will fail in the browser as written.
5. **Throttle does not implement the 5-minute lockout** — Implementation is only a fixed one-minute counter; OAuth callback failures (302 redirects) are never counted because `withThrottle(..., "on-failure")` only increments on 401/403.
6. **Auth/cookie integration tests are likely false positives** — Tests directly invoke route functions that depend on `next/headers`. Logout test has an always-true assertion; verification-gate test is an explicit placeholder.
7. **Root layout gate depends on `x-pathname` header that no plan sets** — Fall-through to `/` weakens the unauthenticated redirect and makes gate behavior path-dependent.
8. **Password reset Inngest event id (`password-reset-request/${email}`) dedups for 24h** — Blocks legitimate reset requests after the 1h token expiry.

MEDIUM-severity items:

- Plan 04-01 is contradictory on whether Phase 3 is a hard prerequisite or soft-warned dependency.
- Migration filename `0001_phase04_iam_extensions.sql` hardcodes assumption that Phase 2 only created `0000`.
- `src/messages/pt-BR.json` path may not match the existing next-intl wiring (`messages/pt-BR.json`).
- Partner-code behavior treats any non-empty code as a 30-day trial, conflicting with `invalid_partner_code` and inviting abuse.
- Signup consent checkboxes lack actual Terms/Privacy links → weakens "informed" consent.
- Inngest topology drifts from INFRA-10's "8 MVP functions" — plans register 9 then 10, and `notifications-send-push` is placed under reminders. Make intentional or correct.

### Divergent Views

*(only one reviewer — no divergence to report)*

To get a multi-reviewer consensus, re-run with additional CLIs:

```
/gsd:review --phase 4 --gemini --codex
/gsd:review --phase 4 --opencode --codex
```

