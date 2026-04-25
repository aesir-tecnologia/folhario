---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 (unit + integration) + @playwright/test 1.59.1 (E2E smoke) |
| **Config file** | `vitest.config.ts` (unit) + `vitest.integration.config.ts` (integration with pg service) + `playwright.config.ts` |
| **Quick run command** | `pnpm test` (vitest unit run) |
| **Full suite command** | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build && pnpm test:e2e` |
| **Estimated runtime** | ~180 seconds locally (unit ~10s, integration ~30s, build ~60s, e2e smoke ~80s) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm typecheck && pnpm test` (unit only — fast feedback)
- **After every plan wave:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration` (skip e2e between waves)
- **Before `/gsd-verify-work`:** Full suite (including `pnpm build && pnpm test:e2e`) must be green
- **Max feedback latency:** 10 seconds (unit run) — 180 seconds (full suite)

---

## Per-Task Verification Map

*Filled in by planner in step 8 — plans reference this matrix via each task's `<automated>` block.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-00-00 | — | 0 | (Wave 0 — test infra stubs) | — | N/A | setup | `pnpm i && pnpm exec playwright install chromium` | ❌ W0 | ⬜ pending |
| 1-08-01 | 01-08 | 0 | INFRA-12: `ci.yml` exists and validates pipeline | — | N/A | unit | `pnpm exec vitest run tests/unit/ci.test.ts` | ✅ | 🟩 green |

---

## Wave 0 Requirements

Wave 0 installs test infrastructure and stub test files **before** any implementation tasks land. The planner must emit these as Wave 0 tasks (per `references/tdd.md` heuristics). Research (`01-RESEARCH.md`) identifies 11 Wave 0 files — canonical list:

- [ ] `package.json` with pinned deps (vitest 4.1.4, @playwright/test 1.59.1, postgres-js, zod, sentry, posthog-js, posthog-node, next-intl, @serwist/next, supabase)
- [ ] `.nvmrc` (Node 22 LTS)
- [ ] `vitest.config.ts` — unit run config
- [ ] `vitest.integration.config.ts` — integration run config with `postgres:17-alpine` service wiring
- [ ] `playwright.config.ts` — Chromium only, `webServer` against `next start` on CI
- [ ] `tests/unit/errors.test.ts` — stub asserting ErrorCode union + HTTP mapper (INFRA-23)
- [ ] `tests/unit/env.test.ts` — stub asserting Zod env validation fails fast on missing vars (INFRA-20)
- [ ] `tests/unit/sentry-scrub.test.ts` — **load-bearing LGPD-13 test.** Hand-calls `beforeSend` with a synthetic Sentry event containing `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`, plus an identification-route request body; asserts all are scrubbed and body is dropped on `/api/v1/identifications/*`.
- [ ] `tests/integration/supabase-stack.test.ts` — integration stub asserting `supabase status` parses and local Postgres 17 accepts connections via `DATABASE_URL`
- [ ] `tests/e2e/diagnostics-sentry.spec.ts` — Playwright smoke that triggers `/__diag` + `/api/v1/_diagnostics/ping`, intercepts outbound Sentry transport requests, asserts event arrives AND forbidden fields absent from serialized payload
- [ ] `tests/e2e/diagnostics-posthog.spec.ts` — Playwright smoke asserting `posthog.capture` fires from both client + `posthog-node` server, event arrives in the dedicated CI PostHog project
- [ ] `tests/e2e/pwa-smoke.spec.ts` — asserts `/sw.js` registers and manifest `/manifest.webmanifest` returns 200 with `theme_color` + `display: standalone` (Serwist skeleton — D-13, D-14)
- [ ] `tests/unit/ci.test.ts` — asserts `.github/workflows/ci.yml` exists, uses `postgres:17-alpine`, has all required steps (lint, typecheck, unit, integration, build, e2e) and does not deploy (INFRA-12)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `pnpm dev` binds to local Supabase stack end-to-end | INFRA-02 | Requires host Docker daemon + interactive stack-up; CI can't exercise the "developer runs locally" loop | 1. `pnpm supabase start` 2. `pnpm db:sync-env` 3. `pnpm dev` 4. Hit `http://localhost:3000/api/v1/_diagnostics/ping` 5. Observe 200 + verify `DATABASE_URL` reaches Postgres |
| PWA installs to home screen on mobile Chrome | INFRA-01 (PWA wiring) | Install prompt requires real user gesture on device | Open `pnpm dev` on `localhost:3000` via mobile Chrome → install via menu → confirm `display: standalone` launch |
| `.env.example` copy-paste into fresh `.env` boots the app | INFRA-20 (env var table) | Tests deliberately use mocked/fixture env; founder onboarding flow is human | New developer clones repo → `cp .env.example .env` → fill in real values → `pnpm dev` succeeds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (11 files above)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Validation Audit 2026-04-24
| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |
