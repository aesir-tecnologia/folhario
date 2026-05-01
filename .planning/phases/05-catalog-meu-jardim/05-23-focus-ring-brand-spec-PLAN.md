---
phase: 05-catalog-meu-jardim
plan: 23
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/ui/inline-edit-field.tsx
  - src/shared/ui/modal-sheet.tsx
  - src/shared/ui/toggle.tsx
autonomous: true
gap_closure: true
requirements:
  - UI-08
tags:
  - focus-ring
  - brand-spec
  - accessibility
  - a11y
  - gap-closure
must_haves:
  truths:
    - "Every interactive primitive in `src/shared/ui/` that uses a `:focus`/`:focus-visible` ring renders a 3px Canopy/40 outline (CLAUDE.md focus-ring brand spec). The previous 2px (Tailwind `ring-2`/`outline-2`) is replaced with `[3px]` arbitrary values."
    - "`src/shared/ui/inline-edit-field.tsx` lines 242, 263, 282 — focus-ring on the three editor inputs (textarea, date, text) renders 3px (`focus:ring-[3px]`)."
    - "`src/shared/ui/modal-sheet.tsx` line 92 — focus-ring on the interactive drag handle renders 3px (`focus-visible:outline-[3px]`)."
    - "`src/shared/ui/toggle.tsx` line 35 — focus-ring on the toggle peer renders 3px (`peer-focus-visible:ring-[3px]`)."
    - "Hover outline on `inline-edit-field.tsx` lines 175 + 198 (the read-mode hover affordance — `hover:outline hover:outline-2 ...`) is OUT OF SCOPE: it's a hover hint at 2px Hairline, not a focus indicator. Brand spec only mandates focus-ring width."
    - "axe-core scans (existing tests/e2e/axe-*.spec.ts) continue to pass with 0 serious+critical violations — the change is width-only, not color-or-contrast."
  artifacts:
    - path: "src/shared/ui/inline-edit-field.tsx"
      provides: "Focus ring on textarea (line 242), date input (line 263), text input (line 282) updated from `focus:ring-2` to `focus:ring-[3px]`. Color (`canopy/40`) unchanged."
      contains: "ring-[3px]"
    - path: "src/shared/ui/modal-sheet.tsx"
      provides: "Focus ring on the interactive drag handle (line 92) updated from `focus-visible:outline-2` to `focus-visible:outline-[3px]`. Offset + color unchanged."
      contains: "outline-[3px]"
    - path: "src/shared/ui/toggle.tsx"
      provides: "Focus ring on the peer (line 35) updated from `peer-focus-visible:ring-2` to `peer-focus-visible:ring-[3px]`. Color (`canopy/40`) unchanged."
      contains: "ring-[3px]"
  key_links:
    - from: "src/shared/ui/inline-edit-field.tsx"
      to: "CLAUDE.md focus-ring brand spec"
      via: "focus:ring-[3px] focus:ring-canopy/40 (3px Canopy @ 40% opacity)"
      pattern: "ring-\\[3px\\]"
    - from: "src/shared/ui/modal-sheet.tsx"
      to: "CLAUDE.md focus-ring brand spec"
      via: "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-canopy/40"
      pattern: "outline-\\[3px\\]"
    - from: "src/shared/ui/toggle.tsx"
      to: "CLAUDE.md focus-ring brand spec"
      via: "peer-focus-visible:ring-[3px] peer-focus-visible:ring-canopy/40"
      pattern: "ring-\\[3px\\]"
---

<objective>
Close gap **WR-04** — CLAUDE.md mandates "focus ring global 3px Canopy @ 40% opacity offset 2px" but multiple shared/ui primitives use `outline-2` / `ring-2` (Tailwind 2px). WCAG 2.1 SC 2.4.7 (focus visible) is met today, but the project's stricter brand spec is not. This is a low-risk CSS-only change that aligns with the project standard.

**Audit scope (verified by `grep -rn "ring-2\|outline-2" src/shared/ui/`):**
- `inline-edit-field.tsx` lines 242, 263, 282 (3 focus rings, one per editor variant: textarea/date/text)
- `modal-sheet.tsx` line 92 (drag-handle focus-visible outline)
- `toggle.tsx` line 35 (peer-focus-visible ring on the toggle track)

The orchestrator's brief listed only the first two files. The advisor surfaced `toggle.tsx` from a project-wide grep — adding it here closes the audit honestly. Hover outlines on `inline-edit-field.tsx` lines 175 + 198 (`hover:outline hover:outline-2`) are NOT focus rings — they're hover affordances on the read-mode field. Out of scope.

**No TDD:** this is a CSS class swap with no behavior change. Existing axe-core E2E specs already cover the affected primitives' focus visibility (focus is preserved; only width changes). Type: `execute` per CLAUDE.md TDD heuristic ("UI layout, styling" — not TDD candidates).

**Purpose:** restore brand-spec compliance for focus indicators across all Phase-5 primitives; close UI-08 brand-spec gap.

**Output:** 3 file edits (CSS class swaps), all green under `pnpm test:e2e -- axe-modal-focus-trap.spec.ts axe-placeholder-pages.spec.ts` (or whichever axe specs the project ships).
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-VERIFICATION.md
@.planning/phases/05-catalog-meu-jardim/05-REVIEW.md

# Bug surfaces (3 files, ~5 lines total)
@src/shared/ui/inline-edit-field.tsx
@src/shared/ui/modal-sheet.tsx
@src/shared/ui/toggle.tsx

<interfaces>
### Tailwind arbitrary value syntax

`ring-2` → `ring-[3px]`. `outline-2` → `outline-[3px]`. Tailwind 4.x supports arbitrary value brackets natively; no config change needed. Color and offset utilities (`canopy/40`, `outline-offset-2`) stay as-is.

### CLAUDE.md brand spec (canonical wording)

> Accessibility: WCAG 2.1 AA = ship blocker — every state combines redundant cues, color never sole signal, **focus ring global 3px Canopy @ 40% opacity offset 2px**, prefers-reduced-motion honored, reading order matches visual order.

Three required attributes per focus ring:
1. **Width:** 3px (today is 2px — fix here).
2. **Color:** Canopy at 40% opacity → `canopy/40` Tailwind utility (already correct).
3. **Offset:** 2px → `outline-offset-2` (only relevant for outline-based rings; box-shadow rings via `ring-*` don't take offset). Already correct on `modal-sheet.tsx`. The `inline-edit-field.tsx` editors use `focus:ring-2 focus:ring-canopy/40` without offset — the `ring` utility renders a glow around the input border, no offset needed.

### Out-of-scope hover affordances (do NOT modify)

`inline-edit-field.tsx` line 175:
```
hover:outline hover:outline-2 hover:outline-offset-4 hover:outline-hairline
```
This is a hover-only affordance on the read-mode value display (gives users a "this is editable" hint when cursor approaches). It's `outline-hairline` color (not Canopy), purpose is non-focus, and brand spec scopes only focus indicators. Same logic for line 198. Leave both as-is.
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                       | Description                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| visual focus indicator → user  | The focus ring is the user's signal that an element is keyboard-focused. Insufficient width = a11y barrier. |

## STRIDE Threat Register

| Threat ID    | Category               | Component                              | Disposition | Mitigation Plan                                                                                                                                                       |
| ------------ | ---------------------- | -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-05-23-01   | Information disclosure | weak focus indicator                   | mitigate    | The 3px width matches CLAUDE.md brand spec, exceeds WCAG 2.1 minimum (2px / 3:1 contrast). The fix only widens — never narrows or removes any indicator.            |
| T-05-23-02   | DoS                    | E2E axe scan regression                | accept      | The change is width-only; axe-core asserts focus visibility at the role-attribute level, not pixel width. No expected regression. If the scan flags, investigate. |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Update focus-ring widths to 3px across 3 primitives (WR-04)</name>
  <files>
    - src/shared/ui/inline-edit-field.tsx
    - src/shared/ui/modal-sheet.tsx
    - src/shared/ui/toggle.tsx
  </files>
  <read_first>
    - src/shared/ui/inline-edit-field.tsx (lines 240-285 — three focus-ring sites; confirm none of them is the hover affordance)
    - src/shared/ui/modal-sheet.tsx (lines 76-100 — drag handle focus-visible outline)
    - src/shared/ui/toggle.tsx (full file — only ~50 lines; line 35 is the peer-focus-visible ring)
    - CLAUDE.md (Constraints section — confirm the brand-spec wording matches the audit scope)
  </read_first>
  <action>
    1. **inline-edit-field.tsx** — three focus rings on the editor variants. Apply the same edit at each site:

    Line 242 (textarea):
    ```
    focus:outline-none focus:ring-2 focus:ring-canopy/40
    ```
    →
    ```
    focus:outline-none focus:ring-[3px] focus:ring-canopy/40
    ```

    Line 263 (date input): same swap.

    Line 282 (text input): same swap.

    2. **modal-sheet.tsx** — the interactive drag-handle button.

    Lines 92-93:
    ```
    focus-visible:outline-2 focus-visible:outline-offset-2
    focus-visible:outline-canopy/40
    ```
    →
    ```
    focus-visible:outline-[3px] focus-visible:outline-offset-2
    focus-visible:outline-canopy/40
    ```

    3. **toggle.tsx** — the peer-focus ring on the toggle track.

    Line 35:
    ```
    peer-focus-visible:ring-2 peer-focus-visible:ring-canopy/40
    ```
    →
    ```
    peer-focus-visible:ring-[3px] peer-focus-visible:ring-canopy/40
    ```

    4. Run a project-wide audit grep to confirm no other 2px focus rings remain in `src/shared/ui/`:
    ```
    grep -n "focus:ring-2\|focus-visible:outline-2\|focus-visible:ring-2\|peer-focus-visible:ring-2\|focus:outline-2" src/shared/ui/*.tsx
    ```
    Expected output: empty (no matches). If a match appears, audit it: if it's a focus indicator on an interactive element → also fix it; if it's a hover affordance → leave it.

    5. Run `pnpm typecheck` (no type changes expected, but cheap to confirm).

    6. Run any existing axe-core E2E specs to confirm no a11y regression:
    ```
    pnpm exec playwright test tests/e2e/axe-modal-focus-trap.spec.ts tests/e2e/axe-placeholder-pages.spec.ts
    ```
    These specs cover the modal-sheet focus surface and other primitives. They MUST still pass with 0 serious+critical violations.

    7. Commit: `style(05-23): focus-ring 3px Canopy/40 across InlineEditField + ModalSheet + Toggle (WR-04)`.
  </action>
  <acceptance_criteria>
    - `grep -c "ring-\[3px\]" src/shared/ui/inline-edit-field.tsx` returns `>=3` (one per editor variant: textarea + date + text).
    - `grep -c "outline-\[3px\]" src/shared/ui/modal-sheet.tsx` returns `>=1`.
    - `grep -c "ring-\[3px\]" src/shared/ui/toggle.tsx` returns `>=1`.
    - `grep "focus:ring-2\|focus-visible:outline-2\|focus-visible:ring-2\|peer-focus-visible:ring-2" src/shared/ui/*.tsx` returns no matches (empty grep).
    - `pnpm typecheck` exits 0.
    - `pnpm exec playwright test tests/e2e/axe-modal-focus-trap.spec.ts tests/e2e/axe-placeholder-pages.spec.ts` exits 0 (a11y scans still green).
    - Git log shows `style(05-23): ...` commit.
  </acceptance_criteria>
  <verify>
    <automated>pnpm typecheck</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/shared/ui/inline-edit-field.tsx | grep -c "ring-\[3px\]" | grep -E "^[3-9]|^[1-9][0-9]+$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/shared/ui/modal-sheet.tsx | grep -c "outline-\[3px\]" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/shared/ui/toggle.tsx | grep -c "ring-\[3px\]" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -E "focus:ring-2[^0-9]|focus-visible:outline-2[^0-9]|focus-visible:ring-2[^0-9]|peer-focus-visible:ring-2[^0-9]" src/shared/ui/inline-edit-field.tsx src/shared/ui/modal-sheet.tsx src/shared/ui/toggle.tsx | wc -l | grep -E "^[[:space:]]*0[[:space:]]*$"</gate>
  </verify>
  <done>
    - All 5 focus-ring sites updated (3 in inline-edit-field, 1 in modal-sheet, 1 in toggle).
    - No 2px focus rings remain in shared/ui (audit grep returns empty).
    - axe-core E2E scans pass.
    - Typecheck clean.
    - Single commit landed.
  </done>
</task>

</tasks>

<verification>
  <automated>
    pnpm typecheck && \
    test -z "$(grep -E 'focus:ring-2[^0-9]|focus-visible:outline-2[^0-9]|focus-visible:ring-2[^0-9]|peer-focus-visible:ring-2[^0-9]' src/shared/ui/inline-edit-field.tsx src/shared/ui/modal-sheet.tsx src/shared/ui/toggle.tsx)"
  </automated>
</verification>

<success_criteria>
- Three primitives (`inline-edit-field`, `modal-sheet`, `toggle`) carry 3px focus rings (`ring-[3px]` / `outline-[3px]`).
- Project-wide audit grep across `src/shared/ui/` finds zero remaining `ring-2` / `outline-2` matches in focus contexts.
- axe-core E2E scans (focus-trap + placeholder-pages) still pass.
- Single commit: `style(05-23): focus-ring 3px Canopy/40 across InlineEditField + ModalSheet + Toggle (WR-04)`.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-23-focus-ring-brand-spec-SUMMARY.md` covering audit scope, files modified, axe-scan outcome, and WR-04 closure status.
</output>
