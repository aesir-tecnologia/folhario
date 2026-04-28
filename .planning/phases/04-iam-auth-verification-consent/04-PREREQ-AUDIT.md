# Phase 4 — Prerequisite Audit

**Audited:** 2026-04-28T01:40:34Z
**Auditor:** Claude (plan 04-01 task 1)
**Override flag:** (none)

## Phase 2 Deliverables (HARD blockers — no override available)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | `iam/infrastructure/db/schema.ts` exports `users` (Drizzle pgTable) | PASS | `src/contexts/iam/infrastructure/db/schema.ts:39` `export const users = pgTable("users", { ... })` — columns: id, email, name, locale, timezone, notification_time_local, trial_source, partner_code, age_confirmed_at, toxicity_disclaimer_acknowledged_at, deletion_requested_at, created_at, updated_at. `email_verified_at` absent (Phase 4 plan 02 ALTER will add — expected). |
| 2 | `consentLogs` (or equivalent) exported in iam schema | PASS | `src/contexts/iam/infrastructure/db/schema.ts:92-123` `export const consentLogs = pgTable("consent_logs", { ... })`. |
| 3 | `consent_logs.purpose` literal union includes BOTH `"terms_of_service"` AND `"privacy_policy"` | FAIL | `src/contexts/iam/infrastructure/db/schema.ts:99-107` — `purpose` enum is `["identification_third_party","push_notifications","marketing","analytics"]`. Neither `"terms_of_service"` nor `"privacy_policy"` is a `purpose` literal. Phase 2 separates "what was consented to" (`purpose`) from "which policy was active at consent time" (`policyVersionId` → `policy_versions.documentType`, where `documentType` enum IS `["privacy_policy","terms_of_service"]`, line 79-82). Phase 4 plan 02+ assumed the literals would be on `purpose` itself; that assumption does not match what shipped. |
| 4 | `consent_logs.source` literal union includes BOTH `"signup"` AND `"settings"` | PASS | `src/contexts/iam/infrastructure/db/schema.ts:114-117` — `source` enum is `["signup","settings","first_use_prompt"]`. Both required literals present. |
| 5 | `policy_versions` table exists with `is_current` boolean | PASS | `src/contexts/iam/infrastructure/db/schema.ts:74-90` — `export const policyVersions = pgTable("policy_versions", { ..., isCurrent: boolean("is_current").notNull().default(false), ... })`. |
| 6 | `subscriptions` table exists with status enum including `"trialing"` | PASS | `src/contexts/billing/infrastructure/db/schema.ts:31` `export const subscriptions = pgTable(...)`; line 43 status enum is `["trialing","active","past_due","canceled","expired"]`. |
| 7 | `idempotency_keys` table exists | PASS | `src/contexts/iam/infrastructure/db/schema.ts:222-245` — `export const idempotencyKeys = pgTable("idempotency_keys", { ... })`. |
| 8 | `partner_store(s)` table exists (D-32 signup partner_code lookup target) | PASS | `src/contexts/iam/infrastructure/db/schema.ts:125-141` — `export const partnerStores = pgTable("partner_stores", { ..., code, trialDays, isActive, ... })`. Note: shipped name is plural (`partner_stores`); plan check spec uses singular (`partner_store`). Treating as PASS — the table is the D-32 lookup target. |
| 9 | Runtime DB client exists with `postgres-js` + `{ prepare: false }` | PASS | `src/shared/db/client.ts:39` `prepare: false,` — module-level guard documented at lines 12-17. (No `src/contexts/iam/infrastructure/db/client.ts`; project uses shared client per Phase 2 D-01.) |
| 10 | AuthAdapter exists exporting `verifyJWT`/`getUserById` | PASS | `src/contexts/iam/infrastructure/auth/auth-adapter.ts` exports `AuthAdapter` interface (line 36) with `verifyJWT` + `getUserById` members. Factory `createAuthAdapter` at line 132. Application-layer wrapper `getCurrentUser` at `src/contexts/iam/application/current-user.ts:43`. |
| 11 | `src/proxy.ts` is API-aware (does NOT skip `/api/*`) | PASS | `src/proxy.ts:108` `matcher: ["/((?!api|_next|_vercel|.*\\..*).*)", "/api/v1/:path*"]` — the second matcher entry explicitly fires the proxy on every `/api/v1/*` request. Phase 2 D-34 shipped. |
| 12 | RLS enabled on `users`, `consent_logs`, `subscriptions`, `idempotency_keys` (live psql probe) | NOT-VERIFIED (treated as FAIL per plan rule) | Live psql probe cannot run from this worktree — `DATABASE_POOL_URL` is unset and no `supabase` CLI is available in this checkout. **Documentary evidence (static, not live):** `drizzle/migrations/0001_phase_02_rls_policies.sql:48-67` runs `ALTER TABLE public.{users,policy_versions,consent_logs,partner_stores,data_export_requests,data_deletion_requests,offline_sync_failures,idempotency_keys,plants,photo_entries,species,care_guides,identifications,identification_limits,provider_budgets,provider_usage_counters,reminders,reminder_logs,subscriptions,billing_events,push_subscriptions} ENABLE ROW LEVEL SECURITY;` covering all 4 named tables (lines 48, 50, 66, 55). Re-run audit with `pnpm db:start` running locally to convert NOT-VERIFIED → PASS. |
| 13 | Phase 2 D-35 `auth.users → public.users` insert trigger | PASS | `drizzle/migrations/0001_phase_02_rls_policies.sql:405-406` — `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user()`. Static migration evidence (live `pg_trigger` lookup blocked by check-12 environment limitation). |

## Phase 3 Deliverables (HARD blockers per D-33 unless override)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 14 | Paper Cream token defined in `src/shared/ui/tokens/*` (D-33-mandated path) | FAIL | `src/shared/ui/tokens/` directory does not exist (`ls src/shared/ui/tokens` errors). **Tokens ARE shipped, but at a different path:** `src/app/globals.css:13-49` defines `@theme { --color-paper: #FBF7EF; ... }` (Tailwind v4 native `@theme` pattern, header literal `Paper Cream / Night Cream`). Strict interpretation of the D-33 path requirement → FAIL; intent (Paper Cream tokens defined) IS shipped at `src/app/globals.css`. |
| 15 | Source Serif 4 + Plus Jakarta Sans fonts loaded | PASS | `src/app/layout.tsx:3` `import { Source_Serif_4, Plus_Jakarta_Sans } from "next/font/google";` lines 11-21 instantiate both with `--font-source-serif` and `--font-plus-jakarta` CSS variables. |
| 16 | Button + Input + Card primitives exist (D-33) | FAIL | `src/shared/ui/button.tsx` exists (case-insensitive APFS makes the plan's `test -f Button.tsx` pass; canonical filename is lowercase). `Input.tsx` does NOT exist — closest match is `src/shared/ui/text-input.tsx` (an input primitive, just renamed). `Card.tsx` does NOT exist anywhere under `src/` (no card primitive at all — Phase 4 plans that need card-style chrome will need to either build it or reuse `modal-sheet.tsx` / `empty-state.tsx`). Combined AND check = FAIL. |
| 17 | Global focus ring (3px Canopy @ 40% opacity, 2px offset, 8px radius) | PASS | `src/app/globals.css:97-98` — `:where(:focus-visible) { outline: 3px solid color-mix(in srgb, var(--color-canopy) 40%, transparent); ... }`. Globally applied via `:where(:focus-visible)` selector, not hand-rolled per component. |
| 18 | Bottom-nav primitive wired in a layout | PASS (with caveat) | The plan's exact grep `find src/app -name 'layout.tsx' -exec grep -l 'BottomNav\|bottom-nav' {} \;` returns no matches — but the wiring exists indirectly: `src/app/(app)/layout.tsx:2` imports `AppShell` from `./app-shell`, and `src/app/(app)/app-shell.tsx:9-13` imports `BottomNav` from `@shared/ui/bottom-nav` and renders it at line 158. Bottom-nav IS wired; the plan's grep was too narrow. PASS on intent. |

## Verdict

Status: BLOCKED — run /gsd-execute-phase 2 first
Missing: 3, 12

## Resolution path (when BLOCKED)

- **Phase 2 missing:** Stop Phase 4 execution → run /gsd-execute-phase 2 → re-run audit → resume Phase 4.
- **Phase 3 missing AND no override:** Stop Phase 4 execution → either (a) run /gsd-execute-phase 3 first, OR (b) re-run with `GSD_ALLOW_MISSING_PHASE_3=true` (or `--allow-missing-phase-3`) to acknowledge hand-rolled Plan 10 primitives.

## Notes for the orchestrator (substantive findings beyond the binary verdict)

The Phase 2 verdict is `BLOCKED`, but the gap is **not** "Phase 2 didn't ship" — Phase 2 shows 11/11 plans complete on disk and Phase 3 shows 5/5 plans complete. The real findings are:

1. **Check 3 (Phase 2) — schema design mismatch, not absence.** `consent_logs.purpose` carries domain-specific consent purposes (`identification_third_party`, `push_notifications`, `marketing`, `analytics`), and the policy that was active at consent time is referenced via `policy_versions.documentType` (which DOES carry `privacy_policy` + `terms_of_service`). Phase 4 plan 02+ assumed `"terms_of_service"` and `"privacy_policy"` would be `purpose` literals; that assumption is wrong. **Re-running `/gsd-execute-phase 2` will not fix this** — it would re-execute already-complete plans. The right fix is for Phase 4 plans 02+ to be updated to either (a) use the existing two-table pattern (`consent_logs.purpose` for what + `consent_logs.policyVersionId` → `policy_versions.documentType` for which policy), or (b) extend the `purpose` enum in plan 02's ALTER. This is a planning-phase reconciliation, not a Phase 2 re-run.

2. **Check 12 (Phase 2) — environmental, not absence.** RLS migration evidence is in `drizzle/migrations/0001_phase_02_rls_policies.sql:48-67` (`ENABLE ROW LEVEL SECURITY` on all 4 named tables). The NOT-VERIFIED state is solely because no live Postgres instance is reachable from this worktree. Re-running with `pnpm db:start` running on the host will flip this to PASS without any code changes.

3. **Check 14 (Phase 3) — path drift, not absence.** Tokens ARE shipped via the canonical Tailwind v4 `@theme` block in `src/app/globals.css` (the modern Tailwind v4 pattern). The plan's path requirement (`src/shared/ui/tokens/*`) was written before Phase 3 settled on `@theme`. The intent (Paper Cream tokens defined and consumable by Tailwind utilities) IS shipped. Phase 4 plans 02+ that consume tokens will work fine; the audit fails on path literalism only.

4. **Check 16 (Phase 3) — real gap.** No `Card` primitive exists anywhere under `src/`. `Input` is renamed to `text-input.tsx`. Phase 4 plans 02+ that the planner assumed could `import { Card } from "@shared/ui/card"` will need either a Plan 10 hand-roll or a Phase 3 follow-up plan.

5. **Check 18 (Phase 3) — false negative on grep.** Bottom-nav IS wired via `src/app/(app)/layout.tsx` → `AppShell` → `BottomNav`. The plan's literal grep on `layout.tsx` files for "BottomNav" doesn't catch the indirection through AppShell.

**Recommended next step (the orchestrator should decide):** Do NOT re-run `/gsd-execute-phase 2` or `/gsd-execute-phase 3` blindly — both phases are complete. Instead, treat this BLOCKED verdict as a **planning-doc reconciliation gate**: the Phase 4 PLAN files (02-11) need to be reviewed against what Phase 2/3 actually shipped before execution proceeds. The audit makes those gaps falsifiable; user decides whether to (a) update Phase 4 plans, (b) run a small Phase 3 follow-up plan to add `Card` + token re-export shim, or (c) re-run audit with `GSD_ALLOW_MISSING_PHASE_3=true` AND a manual planning-doc reconciliation pass for check 3.

---

## Wave-1 Reconciliation Amendment (2026-04-28)

**User decision:** path (a) — reconcile Phase 4 plans against what Phase 2/3 actually shipped.
**Sub-decision for check 3:** option (i) — extend `consent_logs.purpose` TS enum with `signup_acceptance`; signup writes 2 rows differentiated via `policy_version_id` → `policy_versions.documentType`.

### Edits committed (`8790b4e`)

| Plan | Change |
|------|--------|
| 04-02 | Task 1 sub-step (6) extends `consent_logs.purpose` TS enum array to add `signup_acceptance`. New `truths` bullet + acceptance criterion. |
| 04-06 | `consent-logs.ts` writes 2 rows with `purpose='signup_acceptance'`, accepts `tosPolicyVersionId` + `privacyPolicyVersionId` separately. `policy-versions.ts` `getCurrentPolicyVersion` (singular) replaced by `getCurrentPolicyVersions` (plural) returning `{tos, privacy}`. `signup.ts` tx flow updated. PostHog `captureConsentGranted` param renamed `purpose` → `documentType`. AUTH-09 test description rewritten to assert via JOIN on `policy_version_id`. Threat model T-04-06-06 documents the new pattern. |

### Updated check status

| # | Original verdict | Reconciled status | Resolution |
|---|---|---|---|
| 3 | FAIL (literal `terms_of_service`/`privacy_policy` not in `purpose` enum) | **OBSOLETE** | Plan-level assumption was wrong, not a Phase 2 gap. Plans 02+06 now reflect the shipped two-table design. |
| 12 | NOT-VERIFIED→FAIL (live psql probe blocked by env) | **DEFERRED to plan 04-02 execution** | Static migration evidence at `drizzle/migrations/0001_phase_02_rls_policies.sql:48-67` confirms RLS enabled on all 4 named tables. Plan 04-02 Task 3 runs `drizzle-kit migrate` against live local Postgres and Task 4 has a live `relrowsecurity = true` integration test (the Codex HIGH #1 smoking-gun assertion) — the live RLS verification is the natural next opportunity, no pre-Wave-2 probe needed. |
| 14 | FAIL (tokens at `src/app/globals.css` not `src/shared/ui/tokens/*`) | **NON-ISSUE** | Zero plan-level references to `src/shared/ui/tokens/`. Tokens shipped at the canonical Tailwind v4 `@theme` location (`src/app/globals.css:13-49`); plans consume them implicitly via Tailwind utilities. Audit check 14 is path-literalism only. |
| 16 | FAIL (no `Card` primitive under `src/`) | **HANDLED by plan 04-10 fallback** | Plan 04-10 line 45 documents the `--allow-missing-phase-3` path: "If Phase 3 is missing AND --allow-missing-phase-3 was passed in Plan 01, this plan reads the debt entry from PREREQ-AUDIT.md and hand-rolls minimal stubs within UI-SPEC §17 brand tokens." Plan 04-10 builds its own feature-specific cards (`em-breve-card.tsx`, `account-section.tsx`); no shared `Card` primitive is imported. The `Input` rename to `text-input.tsx` likewise has zero plan-level references to the old name. |
| 18 | PASS-with-caveat (grep false-negative) | **NON-ISSUE** | Bottom-nav wired via `AppShell`. |

### Updated Verdict

`Status: GO-after-reconciliation — Wave 2+ may execute`

The original BLOCKED verdict was correct under the literal rules of plan 04-01, but the underlying gaps were a mix of (a) plan-level assumption errors that have now been fixed via plan edits, (b) one environment-blocked live probe deferred to where it has to run anyway (plan 04-02 Task 3), (c) path-literalism with no real impact, and (d) one real Phase 3 gap (`Card`) already handled by plan 04-10's documented fallback.

### Open follow-ups

- None blocking. The `--allow-missing-phase-3` flag will be passed implicitly when plan 04-10 dispatches; plan 04-10 reads this amendment via `04-PREREQ-AUDIT.md` as its source of truth for the missing primitives list.
- Live RLS probe runs as part of plan 04-02 Task 3+4. If `pnpm db:start` is not running when Wave 2 dispatches, plan 04-02 will surface the failure cleanly (it cannot apply the migration without it).
