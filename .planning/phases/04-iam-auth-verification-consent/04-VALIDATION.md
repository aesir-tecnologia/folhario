---
phase: 4
slug: iam-auth-verification-consent
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-26
updated: 2026-04-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                           |
| ---------------------- | --------------------------------------------------------------- |
| **Framework**          | Vitest 4.1.4 (unit + integration projects) + Playwright 1.59.1  |
| **Config file**        | `vitest.config.ts` (root, with `projects` array)                |
| **Quick run command**  | `pnpm test:unit`                                                |
| **Full suite command** | `pnpm test:unit && pnpm test:integration && pnpm test:e2e`      |
| **Estimated runtime**  | unit ~5s, integration ~60-90s, e2e ~30s (Phase 4 portion)       |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit` (~5s; covers Zod schemas, token crypto, throttle math, email template renders).
- **After every plan wave:** Run `pnpm test:unit && pnpm test:integration` (~60-90s; requires `pnpm db:start`).
- **Before `/gsd:verify-work`:** Full suite (`unit + integration + e2e`) must be green.
- **Max feedback latency:** 90 seconds for integration; 5 seconds for unit.

---

## Per-Task Verification Map

| Task ID   | Plan | Wave | Requirement     | Threat Ref                     | Secure Behavior                                                                  | Test Type    | Automated Command                                                                                          | File Exists | Status     |
| --------- | ---- | ---- | --------------- | ------------------------------ | -------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 4-01-01   | 01   | 1    | (gate)          | T-04-01-01..03                 | Audit verdict computed from concrete checks; binary GO/BLOCKED                   | manual       | (audit document inspection by reviewer)                                                                    | ❌ W0       | ⬜ pending |
| 4-02-01   | 02   | 2    | INFRA-08 inherit | T-04-02-01..02                | New tables added to Drizzle schema with proper types + RLS comments              | tsc          | `pnpm typecheck`                                                                                           | ❌ W0       | ⬜ pending |
| 4-02-02   | 02   | 2    | (schema)        | T-04-02-03..04                 | Migration SQL generated with CREATE TABLE + RLS policies + indexes               | grep         | `grep -cE 'CREATE TABLE \"(email_verification_tokens\|password_reset_tokens\|auth_throttle)\"' drizzle/migrations/0001_phase04_iam_extensions.sql` returns 3 | ❌ W0       | ⬜ pending |
| 4-02-03   | 02   | 2    | (schema)        | T-04-02-05                     | drizzle-kit push applied schema; live DB matches                                 | psql         | `psql "$DATABASE_URL" -c "\\dt" \| grep -cE "(email_verification_tokens\|password_reset_tokens\|auth_throttle)"` returns 3 | ❌ W0       | ⬜ pending |
| 4-02-04   | 02   | 2    | (schema)        | T-04-02-01..06                 | Schema state asserted on live Postgres                                           | integration  | `pnpm test:integration tests/integration/iam-schema-phase4.integration.test.ts`                            | ❌ W0       | ⬜ pending |
| 4-03-01   | 03   | 3    | (foundation)    | —                              | npm packages installed; env vars validated                                       | tsc + grep   | `pnpm typecheck && grep -c "INNGEST_EVENT_KEY" src/shared/config/server-env.ts`                            | ❌ W0       | ⬜ pending |
| 4-03-02   | 03   | 3    | (foundation)    | T-04-03-01                     | Token crypto: SHA-256 + timing-safe equal                                        | unit         | `pnpm test:unit tests/unit/tokens.test.ts`                                                                 | ❌ W0       | ⬜ pending |
| 4-03-03   | 03   | 3    | AUTH-10         | T-04-03-02                     | Per-IP throttle UPSERT-RETURNING atomic                                          | unit + integ | `pnpm test:unit tests/unit/auth-throttle-math.test.ts && pnpm test:integration tests/integration/iam-throttle.integration.test.ts` | ❌ W0       | ⬜ pending |
| 4-03-04   | 03   | 3    | AUTH-06,08,09   | T-04-03-07                     | Zod schemas reject invalid inputs                                                | unit         | `pnpm test:unit tests/unit/iam-signup-schema.test.ts`                                                      | ❌ W0       | ⬜ pending |
| 4-03-05   | 03   | 3    | (foundation)    | T-04-03-05                     | @supabase/ssr clients (full + read-only) wired                                   | tsc          | `pnpm typecheck`                                                                                           | ❌ W0       | ⬜ pending |
| 4-03-06   | 03   | 3    | AUTH-02         | T-04-03-03                     | requireApiUser + requireVerifiedUser exist; UNVERIFIED_ALLOWED_PATHS exported    | tsc + grep   | `pnpm typecheck && grep -c UNVERIFIED_ALLOWED_PATHS src/shared/api/auth.ts`                                | ❌ W0       | ⬜ pending |
| 4-03-07   | 03   | 3    | (locale)        | —                              | pt-BR.json has 11 namespaces                                                     | jq           | `jq -e '.auth.signup, .auth.unverifiedBlocker, .settings.account, .email.welcomeBack' src/messages/pt-BR.json` | ❌ W0       | ⬜ pending |
| 4-03-08   | 03   | 3    | (test infra)    | T-04-03-08                     | Test fixtures wired; vitest.config.ts integration setupFile preserved            | tsc          | `pnpm typecheck && test -f tests/integration/setup-supabase-truncate.ts`                                   | ❌ W0       | ⬜ pending |
| 4-04-01   | 04   | 4    | INFRA-10        | T-04-04-01,02                  | Inngest client + registry + serve handler exposed                                | tsc + lint   | `pnpm typecheck && pnpm lint`                                                                              | ❌ W0       | ⬜ pending |
| 4-04-02   | 04   | 4    | INFRA-10        | T-04-04-03                     | All 7 per-context functions.ts files; auth-throttle-cleanup cron at 17 \* \* \* \*  | grep         | `grep -E "cron: \"17 \\* \\* \\* \\*\"" src/contexts/iam/inngest/functions.ts`                             | ❌ W0       | ⬜ pending |
| 4-04-03   | 04   | 4    | INFRA-10        | T-04-04-04                     | Serve handler exports GET/POST/PUT; registry has 9 functions; cleanup deletes >2h | integration  | `pnpm test:integration tests/integration/inngest-serve.integration.test.ts`                                | ❌ W0       | ⬜ pending |
| 4-05-01   | 05   | 5    | NOTIF-01,02     | —                              | Domain events + template registry + render orchestration                         | tsc          | `pnpm typecheck`                                                                                           | ❌ W0       | ⬜ pending |
| 4-05-02   | 05   | 5    | NOTIF-02        | T-04-05-01,02                  | 3 React Email templates render valid pt-BR HTML with brand tokens                | unit         | `pnpm test:unit tests/unit/email-templates.test.ts`                                                        | ❌ W0       | ⬜ pending |
| 4-05-03   | 05   | 5    | NOTIF-01        | T-04-05-03..06                 | Resend adapter dev fallback + send-email Inngest function dispatches             | integration  | `pnpm test:integration tests/integration/notifications-send-email.integration.test.ts`                     | ❌ W0       | ⬜ pending |
| 4-06-01   | 06   | 6    | (repos)         | T-04-06-02                     | 5 repositories ship with documented signatures                                   | tsc + lint   | `pnpm typecheck && pnpm lint`                                                                              | ❌ W0       | ⬜ pending |
| 4-06-02   | 06   | 6    | AUTH-01,06,07,08,09 | T-04-06-01,03..09             | Signup orchestration with D-25 atomicity + ConsentLog × 2                        | integration  | `pnpm test:integration tests/integration/iam-signup.integration.test.ts tests/integration/iam-consent-log.integration.test.ts tests/integration/iam-verify-token.integration.test.ts` | ❌ W0       | ⬜ pending |
| 4-06-03   | 06   | 6    | AUTH-02,04      | T-04-06-10                     | Verification gate + verify route + resend route                                  | integration  | `pnpm test:integration tests/integration/iam-verification-gate.integration.test.ts`                        | ❌ W0       | ⬜ pending |
| 4-07-01   | 07   | 6    | AUTH-05,14      | T-04-07-04                     | login + logout use-cases ship with resolved Q-AUTH-14 semantics                  | tsc          | `pnpm typecheck`                                                                                           | ❌ W0       | ⬜ pending |
| 4-07-02   | 07   | 6    | AUTH-05,14      | T-04-07-01,02,03               | Routes + integration tests assert cookie+refresh logout (not JWT rejection)      | integration  | `pnpm test:integration tests/integration/iam-login.integration.test.ts tests/integration/iam-logout.integration.test.ts` | ❌ W0       | ⬜ pending |
| 4-08-01   | 08   | 7    | AUTH-11,12      | T-04-08-01,02,03               | Reset token repo + always-200 + consume use-cases                                | tsc + lint   | `pnpm typecheck && pnpm lint`                                                                              | ❌ W0       | ⬜ pending |
| 4-08-02   | 08   | 7    | AUTH-11,12      | T-04-08-04,05,06               | Inngest function real impl; routes + integration test                            | integration  | `pnpm test:integration tests/integration/iam-password-reset.integration.test.ts`                           | ❌ W0       | ⬜ pending |
| 4-09-01   | 09   | 7    | AUTH-13         | T-04-09-01,02                  | Change-password use-case + OAuth-complete use-case                               | tsc          | `pnpm typecheck`                                                                                           | ❌ W0       | ⬜ pending |
| 4-09-02   | 09   | 7    | AUTH-03,13      | T-04-09-03..06                 | Routes + OAuth callback (resolved Q4 ordering)                                   | integration  | `pnpm test:integration tests/integration/iam-change-password.integration.test.ts tests/integration/iam-oauth.integration.test.ts` | ❌ W0       | ⬜ pending |
| 4-10-01   | 10   | 8    | AUTH-15,UI-13   | T-04-10-05,06                  | Hand-rolled UI primitives; UnverifiedBlocker + 8 form components                 | tsc + lint   | `pnpm typecheck && pnpm lint`                                                                              | ❌ W0       | ⬜ pending |
| 4-10-02   | 10   | 8    | AUTH-15,UI-13   | T-04-10-01,02,03,04            | 6 auth pages + Settings shell + modified root layout (resolved Q4)                | tsc + build  | `pnpm exec next build --webpack`                                                                           | ❌ W0       | ⬜ pending |
| 4-10-03   | 10   | 8    | AUTH-15,UI-13   | T-04-10-01..06                 | Visual + functional E2E verification of UI surfaces                              | e2e + manual | `pnpm test:e2e tests/e2e/iam-unverified-blocker.spec.ts tests/e2e/settings-account.spec.ts tests/e2e/iam-google-oauth.spec.ts` | ❌ W0       | ⬜ pending |
| 4-11-01   | 11   | 9    | (doc-fix)       | T-04-11-01                     | REQUIREMENTS.md + ROADMAP.md + PRD §4 amendments per resolved Q-AUTH-14 + Q3      | grep         | `grep -E "clears the device's cookie and revokes its refresh token" .planning/REQUIREMENTS.md && grep -E "email_verified_at TIMESTAMPTZ" docs/CAVE-PRD.md` returns matches in both | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Phase 4 introduces ~20 new test files. All are NEW (Phase 1's tests/ directory only contains diagnostics + errors fixtures).

- [ ] `tests/integration/iam-schema-phase4.integration.test.ts` — schema migration smoke (Plan 02)
- [ ] `tests/integration/setup-supabase-truncate.ts` — TRUNCATE helper (Plan 03)
- [ ] `tests/integration/global-setup.ts` — vitest integration global setup placeholder (Plan 03)
- [ ] `tests/integration/fixtures/seed-policy-version.ts` — Plan 03
- [ ] `tests/integration/fixtures/seed-user.ts` — Plan 03
- [ ] `tests/integration/fixtures/mock-resend.ts` — Plan 03
- [ ] `tests/integration/fixtures/mock-inngest.ts` — Plan 03
- [ ] `tests/unit/tokens.test.ts` — Plan 03
- [ ] `tests/unit/auth-throttle-math.test.ts` — Plan 03
- [ ] `tests/unit/iam-signup-schema.test.ts` — Plan 03
- [ ] `tests/unit/email-templates.test.ts` — Plan 05
- [ ] `tests/integration/iam-throttle.integration.test.ts` — Plan 03
- [ ] `tests/integration/inngest-serve.integration.test.ts` — Plan 04
- [ ] `tests/integration/notifications-send-email.integration.test.ts` — Plan 05
- [ ] `tests/integration/iam-signup.integration.test.ts` — Plan 06
- [ ] `tests/integration/iam-consent-log.integration.test.ts` — Plan 06
- [ ] `tests/integration/iam-verify-token.integration.test.ts` — Plan 06
- [ ] `tests/integration/iam-verification-gate.integration.test.ts` — Plan 06
- [ ] `tests/integration/iam-login.integration.test.ts` — Plan 07
- [ ] `tests/integration/iam-logout.integration.test.ts` — Plan 07
- [ ] `tests/integration/iam-password-reset.integration.test.ts` — Plan 08
- [ ] `tests/integration/iam-change-password.integration.test.ts` — Plan 09
- [ ] `tests/integration/iam-oauth.integration.test.ts` — Plan 09
- [ ] `tests/e2e/iam-unverified-blocker.spec.ts` — Plan 10
- [ ] `tests/e2e/settings-account.spec.ts` — Plan 10
- [ ] `tests/e2e/iam-google-oauth.spec.ts` — Plan 10
- [ ] `vitest.config.ts` extension: integration project gains `setupFiles: ["./tests/integration/global-setup.ts"]` — Plan 03

**Test infrastructure already in place** (no Wave 0 work needed):
- `vitest.config.ts` (Phase 1) — Vitest projects defined.
- `playwright.config.ts` (Phase 1 plan 01-08) — Playwright config + webServer settings.
- `tests/unit/setup-env.ts` — synthetic env for unit tests only (Phase 1 plan 01-04).
- `tests/integration/postgres-connection.integration.test.ts` — live-Postgres analog for cloud-DB safeguard.

---

## Manual-Only Verifications

| Behavior                                              | Requirement | Why Manual                                                                          | Test Instructions                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UnverifiedBlocker visual layout per UI-SPEC §5        | AUTH-15     | Visual review of decorative Sage illustration + brand color hierarchy + spacing.    | Sign up via /auth/signup → see blocker rendered; confirm Source Serif 4 headline + Calm Slate body + Canopy CTA + tertiary "Sair" link match UI-SPEC.                                                                                                                                                       |
| Email render in actual email client                   | NOTIF-02    | Render fidelity in Gmail / Apple Mail / Outlook can't be unit-tested fully.         | Trigger a signup → fetch the verification HTML from `[resend-dev]` stdout log → email it to founder's verified Resend recipient → open in Gmail web + Gmail mobile + Apple Mail + Outlook → confirm Paper Cream bg + Forest Ink headline + Canopy CTA render correctly in light + dark mode.                |
| Resend sandbox actually delivers (one-time)           | NOTIF-01    | Plan 05 mocks Resend in tests; verifying real Resend dispatch needs the sandbox.    | In CI (or manually with sandbox key), trigger a signup → assert Resend dashboard shows the email → assert recipient inbox receives it (per D-29: one E2E hits sandbox).                                                                                                                                       |
| Settings → Account UI in dark mode                    | UI-13       | Hand-rolled inline-style primitives don't currently honor dark mode.                | Switch system to dark mode → visit /settings/account → confirm UI renders cleanly (currently it will use light hex values; Phase 3's design system retrofit will add dark-mode handling). Document any visual issues for Phase 3 to address.                                                                |
| Plan 01 Phase 2/3 prerequisite audit verdict          | (gate)      | The audit IS the verification; reviewer reads the document directly.                | Open `.planning/phases/04-iam-auth-verification-consent/04-PREREQ-AUDIT.md` → confirm verdict is binary (GO or BLOCKED) → if BLOCKED, run `/gsd-execute-phase 2` first.                                                                                                                                  |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every task in 04-NN-PLAN.md has a `<verify><automated>...</automated></verify>` block. Plan 01 (audit) and Plan 11 (doc-fix) are manual-checkpoint plans whose verification is the document content itself, validated by grep.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every plan has at least 1 task with an automated verification command.
- [x] Wave 0 covers all MISSING references — see Wave 0 Requirements section above (~20 NEW test files; all tracked).
- [x] No watch-mode flags — all `pnpm test:unit` and `pnpm test:integration` commands use `--run` mode (project-wide config).
- [x] Feedback latency < 90s — unit tests ~5s, integration ~60-90s; full suite ~3 min.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-04-26 by gsd-planner during `/gsd-plan-phase 4`.
