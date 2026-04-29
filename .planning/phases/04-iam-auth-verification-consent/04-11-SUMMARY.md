---
phase: 04-iam-auth-verification-consent
plan: 11
subsystem: docs
tags: [requirements, roadmap, prd, auth, traceability, lgpd]

# Dependency graph
requires:
  - phase: 04-iam-auth-verification-consent
    provides: "Plans 04-01..10 — implementation that defined the resolved AUTH-14 semantics, the email_verified_at column, and the Codex-review fix annotations the plan list now records."
provides:
  - "REQUIREMENTS.md AUTH-14 reworded to match resolved Q-AUTH-14 (cookie + refresh-token revoke; NOT JWT denylist) and AUTH-v2-02 cross-referenced"
  - "REQUIREMENTS.md traceability table — all 19 Phase 4 requirement IDs marked Complete with their plan numbers"
  - "ROADMAP.md Phase 4 SC-3 reworded to match AUTH-14 (no enforcement drift between docs)"
  - "ROADMAP.md Phase 4 plan list annotated with route-group + Codex-review fix notes; 04-10 flipped to [x]"
  - "docs/CAVE-PRD.md §4 User schema includes email_verified_at TIMESTAMPTZ NULL (matches the live database after Plan 02's drizzle-kit migrate)"
affects: [phase-12, phase-13, phase-5, phase-6, phase-7, phase-8, phase-9, phase-10, phase-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Doc reconciliation pass at end of phase to keep REQUIREMENTS.md, ROADMAP.md, and PRD aligned with resolved Open Questions and decisions logged in CONTEXT.md / RESEARCH.md"
    - "Cross-referencing v1 requirements ↔ v2 requirements in both directions when post-MVP work is the proper home for an unresolved gap (AUTH-14 ↔ AUTH-v2-02)"

key-files:
  created:
    - ".planning/phases/04-iam-auth-verification-consent/04-11-SUMMARY.md"
  modified:
    - ".planning/REQUIREMENTS.md (AUTH-14 wording, AUTH-v2-02 cross-reference, 19 traceability rows flipped to Complete)"
    - ".planning/ROADMAP.md (Phase 4 SC-3 wording, plan list annotations, 04-10 flipped to [x])"
    - "docs/CAVE-PRD.md (§4 User schema — email_verified_at column added)"

key-decisions:
  - "AUTH-14 official wording: 'clears the device's cookie and revokes its refresh token; the existing JWT continues to be valid until its exp (≤1h on Supabase default)'. Per Pitfall 12 in 04-RESEARCH.md, Supabase signOut({ scope: 'local' }) revokes the refresh token but the access JWT remains valid until its exp — the original AUTH-14 wording 'revokes that JWT' was not what Supabase's API actually does."
  - "AUTH-v2-02 (logout-all-devices) is the post-MVP follow-up to AUTH-14; cross-referenced from AUTH-14 with the implementation note that v2 requires either a JWT denylist table or Supabase Auth Hooks integration."
  - "PRD §4 User schema convention is bare-name parenthetical (e.g., 'age_confirmed_at (proof ≥13)'), but per the plan's verbatim spec the email_verified_at line uses SQL-typed style ('TIMESTAMPTZ NULL  -- comment') to satisfy the acceptance grep `email_verified_at TIMESTAMPTZ`. Convention divergence acknowledged; preserved per plan instruction."
  - "ROADMAP.md Phase 4 progress denominator was already 0/11 (set in an earlier wave). Plan acceptance only requires `0/11`; this plan does NOT advance the numerator. The orchestrator owns the phase-level progress numerator update."
  - "REQUIREMENTS.md AUTH-14 checkbox flipped to [x] inline with the wording change. Other 18 Phase 4 requirements remain [ ] in the inline list and are marked Complete only in the traceability table — keeping the inline list as the user-facing gate (which the orchestrator advances when it owns plan numbering) and traceability as the per-plan completion ledger."

patterns-established:
  - "Doc-fix plan as final wave of a multi-wave phase — reconciles REQUIREMENTS.md + ROADMAP.md + PRD with the implementation truth captured in CONTEXT.md, RESEARCH.md, and per-plan SUMMARY.md files. No code shipped."
  - "Traceability column annotations include not just `Complete (Plan XX)` but also Codex-review fix references where the plan number alone undersells the implementation (e.g., AUTH-02 spans Plan 06 + Plan 10 due to Codex HIGH #7 route-group restructure)."

requirements-completed: []  # No requirements field on this plan; deliverable is the doc-reconciliation itself.

# Metrics
duration: ~12 min
completed: 2026-04-29
---

# Phase 4 Plan 11: Doc Reconciliation Summary

**REQUIREMENTS.md AUTH-14 reworded for resolved Q-AUTH-14 (cookie + refresh-token revoke, not JWT denylist), AUTH-v2-02 cross-referenced, all 19 Phase 4 requirement IDs marked Complete in the traceability table, ROADMAP.md SC-3 mirrored, plan list annotated with Codex-review fixes, PRD §4 User schema gains email_verified_at TIMESTAMPTZ NULL.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1 (single checkpoint:human-verify task with 3 sub-edits)
- **Files modified:** 3 (REQUIREMENTS.md, ROADMAP.md, CAVE-PRD.md)

## Accomplishments

- AUTH-14 wording in REQUIREMENTS.md and ROADMAP.md SC-3 now match the implementation that Plan 04-07 actually shipped (`authAdapter.signOutLocal()` → cookie + refresh-token revoke). The original wording "revokes that JWT" was technically wrong per Supabase's signOut semantics (Pitfall 12 in 04-RESEARCH.md).
- AUTH-v2-02 (logout-all-devices) explicitly cross-referenced from AUTH-14 as the post-MVP home for global JWT revocation, with a note about the implementation prerequisites (denylist table or Supabase Auth Hooks integration).
- All 19 Phase 4 requirement IDs flipped from `Pending` to `Complete (Plan XX)` in the traceability table:
  - AUTH-01..15 (15 IDs)
  - INFRA-10 (annotated with the registry total: 9 = 8 PRD §3 MVP per D-16 + 1 Phase-4 anti-enumeration add per D-11)
  - NOTIF-01, NOTIF-02
  - UI-13
- ROADMAP.md Phase 4 plan list updated with route-group + Codex review fix annotations on every plan (04-01 D-33 gate, 04-02 drizzle-kit migrate per HIGH #1, 04-03 AuthAdapter per HIGH #3, 04-04 9-function registry, 04-06 db.transaction per HIGH #2, 04-07 Playwright E2E per HIGH #6, 04-10 (public)/(authed) route groups per HIGH #7, etc.). Plan 04-10 also flipped from `[ ]` to `[x]` since its SUMMARY exists on disk.
- PRD §4 User schema gains `email_verified_at TIMESTAMPTZ NULL` documented as the product source of truth (per Phase 4 D-22 — `auth.users.email_confirmed_at` is set true at credential creation per D-03 and must NEVER be used for product gating).

## Task Commits

Each sub-edit was committed atomically:

1. **Task 1a: REQUIREMENTS.md** — `d968373` (docs)
   - AUTH-14 wording + checkbox flipped to [x]
   - AUTH-v2-02 cross-reference
   - 19 traceability rows: AUTH-01..15 + INFRA-10 + NOTIF-01,02 + UI-13 → Complete (Plan XX)

2. **Task 1b: ROADMAP.md** — `8d99f2a` (docs)
   - Phase 4 SC-3 wording (mirrors REQUIREMENTS.md AUTH-14)
   - Phase 4 plan list annotations (Codex review fix references on each entry)
   - Plan 04-10 flipped to [x]

3. **Task 1c: docs/CAVE-PRD.md** — `bc09d58` (docs)
   - §4 User schema: email_verified_at TIMESTAMPTZ NULL inserted after age_confirmed_at, before toxicity_disclaimer_acknowledged_at

**Plan metadata commit:** Will be made after this SUMMARY.md is written (final-commit step).

## Acceptance Grep Verification

All 11 plan acceptance grep checks pass on the post-prettier file states:

| # | Check | File | Expected | Actual |
|---|-------|------|----------|--------|
| 1 | AUTH-14 new wording | REQUIREMENTS.md | 1 | 1 |
| 2 | AUTH-14 NO 'revokes that JWT' | REQUIREMENTS.md | 0 | 0 |
| 3 | AUTH-v2-02 ↔ AUTH-14 cross-reference | REQUIREMENTS.md | ≥1 | 2 |
| 4 | AUTH-01..15 Complete count | REQUIREMENTS.md | ≥15 | 15 |
| 5 | INFRA-10/NOTIF-01,02/UI-13 Complete count | REQUIREMENTS.md | ≥4 | 4 |
| 6 | INFRA-10 mentions 9 + D-11 | REQUIREMENTS.md | ≥1 | 1 |
| 7 | SC-3 new wording | ROADMAP.md | 1 | 1 |
| 8 | 11 plan filenames listed | ROADMAP.md | ≥11 | 11 |
| 9 | 04-04 mentions 9 + D-11 | ROADMAP.md | ≥1 | 1 |
| 10 | Phase 4 progress 0/11 | ROADMAP.md | 1 | 1 |
| 11 | email_verified_at TIMESTAMPTZ | docs/CAVE-PRD.md | ≥1 | 1 |

## Files Created/Modified

- `.planning/phases/04-iam-auth-verification-consent/04-11-SUMMARY.md` — this file
- `.planning/REQUIREMENTS.md` — AUTH-14 wording + AUTH-v2-02 cross-reference + 19 traceability rows
- `.planning/ROADMAP.md` — Phase 4 SC-3 wording + plan list annotations + 04-10 flipped to [x]
- `docs/CAVE-PRD.md` — §4 User schema gains email_verified_at column

## Decisions Made

- **INFRA-10 traceability wording reorder.** Initial draft wrote "8 PRD §3 MVP per D-16 + 1 Phase-4 anti-enumeration add per D-11; total 9 at end of phase". The plan's acceptance grep `INFRA-10.*9.*D-11` requires the literal "9" to appear before "D-11" on the same line. Reworded to "total 9 at end of phase = 8 PRD §3 MVP per D-16 + 1 Phase-4 anti-enumeration add per D-11" so the 9 leads. Same content, regex-friendly ordering.
- **ROADMAP.md plan-list edit was a UPDATE-IN-PLACE, not a TBD-replace.** Plan `<action>` text said "currently `**Plans**: TBD` at line 122". Empirical state: lines 152-165 already had a populated 11-plan list from an earlier wave. Per advisor guidance, preserved every existing `[x]` checkmark and updated only the descriptions to add Codex-review fix annotations. Plan 04-10 was incorrectly `[ ]` (its SUMMARY exists on disk); flipped to `[x]` while in the area.
- **Apostrophe wording difference between REQUIREMENTS.md and ROADMAP.md SC-3 is intentional.** Plan acceptance criterion 1 reads `device's cookie` (with apostrophe) for REQUIREMENTS.md. Plan acceptance criterion 7 reads `device cookie` (no apostrophe) for ROADMAP.md. Preserved both verbatim to satisfy both grep regexes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] INFRA-10 traceability text reorder for grep compatibility**
- **Found during:** Task 1a (REQUIREMENTS.md edit)
- **Issue:** Initial wording placed "D-11" before "total 9", but acceptance grep `INFRA-10.*9.*D-11` requires "9" to lead.
- **Fix:** Reordered to "total 9 at end of phase = 8 PRD §3 MVP per D-16 + 1 Phase-4 anti-enumeration add per D-11".
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** `grep -E "INFRA-10.*9.*D-11" .planning/REQUIREMENTS.md` returns 1 match.
- **Committed in:** d968373

**2. [Rule 2 - Missing Critical] Plan 04-10 ROADMAP checkbox flipped to [x]**
- **Found during:** Task 1b (ROADMAP.md edit)
- **Issue:** Plan 04-10's SUMMARY exists at `.planning/phases/04-iam-auth-verification-consent/04-10-SUMMARY.md`, so the ROADMAP entry should be `[x]`. Was `[ ]`.
- **Fix:** Flipped 04-10 to `[x]` while in the plan list editing area.
- **Files modified:** `.planning/ROADMAP.md`
- **Verification:** `grep -E "^- \[x\] 04-10-PLAN" .planning/ROADMAP.md` returns 1 match.
- **Committed in:** 8d99f2a

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 doc consistency)
**Impact on plan:** Both fixes preserve plan-acceptance compliance and ROADMAP/SUMMARY-on-disk consistency. No scope creep.

## Issues Encountered

- **Husky/lint-staged + Prettier reformatted committed files.** Three commits each ran prettier-write on the staged file. After each commit I re-ran the relevant grep acceptance checks and confirmed the wording was preserved. Prettier wrapped the PRD heavily (302 insertions / 175 deletions on CAVE-PRD.md, mostly long-line reflows in unrelated sections), but the email_verified_at line landed at line 113 verbatim and the regex `email_verified_at TIMESTAMPTZ` still matches.
- **Commitlint emitted a `footer-leading-blank` warning** on the ROADMAP commit message. The body text inside a bullet got hard-wrapped by commitlint into a separate "footer" paragraph; warning only, commit was accepted.

## Resolved Q-AUTH-14 acknowledgement

Per Pitfall 12 in `04-RESEARCH.md` and the resolution captured in `04-07-SUMMARY.md`:

- **Effective AUTH-14 behavior:** `supabase.auth.signOut({ scope: 'local' })` clears the cookie and revokes the device's refresh token. The access JWT remains valid until its `exp` (Supabase default ≤1h).
- **What this plan changed:** Documentation (REQUIREMENTS.md AUTH-14 wording + ROADMAP.md Phase 4 SC-3) now matches that behavior, plus an explicit AUTH-v2-02 cross-reference for the post-MVP global revocation work.
- **What this plan did NOT change:** No code; the implementation in Plan 04-07 already shipped this behavior. The Playwright E2E for AUTH-14 (per Codex HIGH #6) asserts cookie cleared + refresh-token rejected, NOT "JWT rejected" — verified by `grep -E "JWT rejected" tests/e2e/auth-login-logout.spec.ts` returning 0 matches in the 04-07 SUMMARY.

## User Setup Required

None — doc-only changes. No external service configuration required.

## Next Phase Readiness

Phase 4 is officially complete. The orchestrator's `state advance-plan` + `roadmap update-plan-progress` calls (run from the orchestrator, not this executor) will flip Phase 4 from `Ready to execute 0/11` to `Complete 11/11`.

Phase 5 (Catalog — Meu Jardim) is the next ready-to-execute phase per the linear execution order in ROADMAP.md.

## Threat Flags

None — doc-reconciliation plan introduced no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

All planned files exist + all acceptance grep checks return expected counts. Verification commands run after the prettier post-commit reformat:

- `.planning/REQUIREMENTS.md` — found
- `.planning/ROADMAP.md` — found
- `docs/CAVE-PRD.md` — found
- `.planning/phases/04-iam-auth-verification-consent/04-11-SUMMARY.md` — found
- Commits `d968373`, `8d99f2a`, `bc09d58` all present in `git log`

11/11 acceptance grep checks pass.

---

*Phase: 04-iam-auth-verification-consent*
*Plan: 11*
*Completed: 2026-04-29*
