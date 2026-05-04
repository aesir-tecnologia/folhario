---
phase: 6
slug: identification-flow-cost-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source-of-truth Test Map lives in `06-RESEARCH.md` § Validation Architecture (35 requirements covered). This file declares sampling cadence, Wave 0 deps, and sign-off — execution agents read both.

---

## Test Infrastructure

| Property               | Value                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.x (unit + unit-dom + integration projects), Playwright (e2e)            |
| **Config file**        | `vitest.config.ts` (existing, projects already configured)                       |
| **Quick run command**  | `pnpm test:unit`                                                                 |
| **Full suite command** | `pnpm test:run` (unit + integration) + `pnpm test:e2e`                           |
| **Estimated runtime**  | ~45s unit + ~120s integration + ~90s e2e (smoke subset for per-wave gate: ~30s)  |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit` (Vitest unit + unit-dom; ~45s)
- **After every plan wave:** Run `pnpm test:run` (unit + integration; ~165s) + `pnpm test:e2e:smoke` for waves touching UI
- **Before `/gsd-verify-work`:** Full suite must be green — `pnpm test:run` + `pnpm test:e2e` (no skipped specs, no `.only`, no flake)
- **Max feedback latency:** 60s for unit-only loop; 180s for unit+integration loop

---

## Per-Task Verification Map

> The full 35-row Test → Command → File map lives in `06-RESEARCH.md` § Validation Architecture (lines mapping each REQ-ID to test type, command, and Wave 0 status). Planner copies relevant rows into each plan's `<task>` blocks under `<automated>`. This file does not duplicate that table — single source of truth principle.

**Coverage summary:**

| Requirement family | Count | Test types                          |
| ------------------ | ----- | ----------------------------------- |
| IDENT-01..21       | 21    | unit (10), integration (8), e2e (3) |
| COST-01..10        | 10    | unit (5), integration (5)           |
| LGPD-09            | 1     | integration                         |
| UI-06, UI-12, UI-15 | 3    | e2e (UI-06, UI-12), unit-dom (UI-15) |

35 requirements / 35 mapped automated commands. Two requirements (IDENT-16, IDENT-20) reuse existing test infrastructure; 33 require Wave 0 setup.

---

## Wave 0 Requirements

Wave 0 establishes test scaffolding before feature waves begin. Planner assigns these to Wave 1 (or Wave 0 if pattern-mapper-detected).

- [ ] `tests/integration/setup-identification.ts` — extends `tests/integration/setup.ts` with: stub Plant.id HTTP server (msw), stub OpenAI-compat HTTP server, advisory-lock test helper, `last_alerted_at` reset helper
- [ ] `tests/e2e/fixtures/consented-user.ts` — extends `authedUser` fixture from Phase 5 with ConsentLog row insert for `identification_third_party` (per CONTEXT.md `<specifics>`)
- [ ] `tests/integration/identification/` directory — one file per use-case (identify, confirm, correct, list, notify-ceiling)
- [ ] `tests/unit/identification/` directory — one file per pure-fn unit (router, providers, cap-check, breaker)
- [ ] `tests/e2e/identify-*.spec.ts` — 4 specs: identify-consent, identify-multi-photo, identify-paywall, identify-history (existing offline spec extended)
- [ ] `tests/integration/inngest/notify-ceiling.spec.ts` — Inngest function harness for Resend email
- [ ] Stub mode wiring — `IDENTIFICATION_PROVIDER_MODE=stub` env in `playwright.config.ts` and CI env

_Existing infrastructure covering (no Wave 0 needed):_

- `pnpm test:unit -t "rejectGpsMetadata"` (Phase 5) — IDENT-16 server GPS defense in depth
- `tests/e2e/identify-offline.spec.ts` (Phase 5 placeholder offline spec) — IDENT-20 (extend, don't recreate)
- `withUnitOfWork` integration helpers (Phase 2) — advisory lock contention testable via the same harness
- `inngestStepHarness` (Phase 4) — `notifyCeiling` Inngest function harness inherited

---

## Manual-Only Verifications

| Behavior                                         | Requirement | Why Manual                                          | Test Instructions                                                                                              |
| ------------------------------------------------ | ----------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Resend operator alert email actually delivers    | COST-04     | External email side effect; CI runs against stub    | After E2E hits 80% ceiling threshold, check operator inbox in staging once per release.                        |
| Plant.id v3 confidence calibration in production | IDENT-04    | Real plant photos required; calibration drift over time | Quarterly: spot-check 20 production identifications across taxa, compare displayed confidence to user-confirmed correctness. |
| Vision LLM JSON-schema strictness in production  | IDENT-15    | Real upstream model behavior; vendors update silently | Monitor `failure_reason=invalid_response` rate via PostHog dashboard; alert on >2% over 24h.                   |
| LGPD consent modal first-impression UX           | LGPD-09     | Reading-comprehension assessment requires real users | Soft-launch with 5 beta users; record consent-grant rate + read-time on policy link.                           |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (per planner contract)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces)
- [ ] Wave 0 covers all MISSING references (33 missing test files staged in Wave 0)
- [ ] No watch-mode flags (`pnpm test:unit` is one-shot via `--run`; never `pnpm vitest`)
- [ ] Feedback latency < 60s for per-task loop, < 180s for per-wave loop
- [ ] `nyquist_compliant: true` set in frontmatter once planner confirms 100% requirement → automated test mapping
- [ ] Manual-only behaviors (4) explicitly excluded from automated gate; tracked in execution UAT

**Approval:** pending — planner finalizes after PLAN.md generation; checker validates coverage; verify-phase confirms green run.
