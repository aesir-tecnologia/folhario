---
phase: 05-catalog-meu-jardim
plan: 13
type: execute
wave: 6
depends_on:
  - 05-10
  - 05-11
  # PHASE-3-DEPENDENCY (BLOCKING execution): Phase 3 ships --scrim, --surface, --hairline, --canopy CSS custom properties. Component uses var() with fallbacks during 5b authoring; full visual approval requires Phase 3 tokens.
  # NEW DEPENDENCY: focus-trap@7.1.3 (devDependency add task in this plan).
files_modified:
  - package.json
  - src/shared/ui/bottom-sheet.tsx
  - tests/e2e/catalog/photo-journal-add-a11y.spec.ts
  - tests/unit/shared/ui/bottom-sheet.test.ts
autonomous: false  # has [BLOCKING] checkpoint gate (axe-core PASS + manual VoiceOver/TalkBack smoke)
requirements: []
decisions:
  consolidated_wave_6_deps: |
    Wave 6 originally had a package.json file conflict between Plan 05-13
    (focus-trap@7.1.3) and Plan 05-14 (lucide-react). RESOLUTION: this
    plan installs BOTH deps in Task 1, and Plan 05-14 was amended to
    remove package.json from its files_modified. Wave 6 now has zero
    same-wave file overlap. Plan 05-14 frontmatter
    decisions.lucide_react_dependency documents the dependency on this
    plan's install.
  hand_roll_first: |
    RESOLVED (Open Question Q5) — UI-SPEC § Registry Safety mandates
    "Modal sheet … hand-rolled per PRD §17 specs". This plan ships the
    hand-rolled primitive FIRST. The [BLOCKING] axe-core + VoiceOver/TalkBack
    smoke gate (Task 3 below) verifies a11y. If the gate FAILS after
    reasonable iteration, the documented fallback is Vaul 1.1.2 — see
    `decisions.vaul_fallback_path` below.
  vaul_fallback_path: |
    If Wave 0 hand-roll fails axe-core or manual VoiceOver/TalkBack smoke
    AFTER best-effort fixes:
    1. Run `pnpm add vaul@1.1.2` (exact pin per Phase 1 D-04).
    2. Replace BODY of `src/shared/ui/bottom-sheet.tsx` with a Vaul-backed
       implementation using Drawer.Root / Drawer.Content / Drawer.Handle /
       Drawer.Title / Drawer.Description.
    3. The exported COMPONENT signature `BottomSheet({ open, onOpenChange,
       title, children })` MUST stay identical — Vaul's prop shape matches
       this signature, so consumers (Plan 05-17 Photo Journal add) need
       ZERO changes.
    4. Re-run the axe-core spec from Task 2 — Vaul ships a11y-compliant by
       default (axe should pass without further work).
    5. Document the swap in this plan's SUMMARY.md as
       `decisions.bottom_sheet_outcome: "vaul_fallback_engaged"`.
    The Vaul swap is a CONTINGENCY, not a planned step — plan for hand-roll
    success.
  api_surface_intentionally_vaul_shaped: |
    Component props (`open`, `onOpenChange`, `title`, `children`) match
    Vaul's `Drawer.Root` / `Drawer.Content` / `Drawer.Title` shape
    exactly so the fallback swap is single-line scope.
  drag_handle_visual_only: |
    The 36×4px drag handle is VISUAL ONLY in Phase 5 — no PointerEvent
    swipe-to-dismiss logic shipped here. Reasoning: per PRD §17 Modal sheet
    + UI-SPEC line 285, "swipe-down dismiss" is one of multiple dismiss
    paths; the load-bearing path is the visible labelled "Fechar" button +
    Escape key + tap-scrim. Implementing PointerEvent swipe-down adds
    ~30 LOC and is a Vaul win-condition (Vaul ships it for free). If
    Phase 5 ships hand-rolled and users complain, add swipe in a
    follow-up — not in scope for the v1 a11y gate.
  axe_gate_threshold: |
    Hand-rolled bottom-sheet a11y gate PASSES when:
    - axe-core scan returns ZERO violations (severity threshold: ALL — including minor)
    - Manual VoiceOver smoke (Safari iOS): focus-trap activates on open,
      "Fechar" label is read, Escape dismisses, focus returns to trigger
    - Manual TalkBack smoke (Chrome Android): same 4 checks
    Gate FAILS → Vaul fallback engaged per `decisions.vaul_fallback_path`.
must_haves:
  truths:
    - "Hand-rolled BottomSheet renders <div role='dialog' aria-modal='true' aria-labelledby={titleId}> + scrim + drag handle (visual) + visible 'Fechar' button"
    - "focus-trap@7.1.3 vendor primitive activates on open, deactivates on close, returns focus to trigger; Escape dismisses; Tab cycles within trap"
    - "Component props ({ open, onOpenChange, title, children }) match Vaul Drawer.Root/Content/Title prop shape — fallback swap is one-line import change"
    - "BottomSheet renders nothing when open=false (returns null) so consumers can render conditionally without orphan DOM"
    - "Tap-scrim dismisses (calls onOpenChange(false)) but ONLY in addition to visible 'Fechar' button per PRD §17 (no 'tap anywhere to dismiss without affordance')"
    - "[BLOCKING gate] axe-core scan inside open BottomSheet returns 0 violations; manual VoiceOver + TalkBack smoke checklist all 4 items pass; failure engages Vaul fallback"
    - "Component uses CSS custom properties (var(--scrim), var(--surface), var(--hairline), var(--canopy)) with hex fallbacks so Phase 3 tokens drop in cleanly"
    - "Component does NOT declare a font-family (Pattern 7 a11y check #6 — no font override)"
    - "prefers-reduced-motion: reduce — no slide-in animation; component renders instantly (Pattern 7 a11y check #7)"
  artifacts:
    - path: "src/shared/ui/bottom-sheet.tsx"
      provides: "BottomSheet 'use client' component (hand-rolled per UI-SPEC Registry Safety + RESEARCH Pattern 7)"
      min_lines: 90
      contains: "BottomSheet"
    - path: "tests/unit/shared/ui/bottom-sheet.test.ts"
      provides: "Unit tests via @testing-library/react: open=false renders null; open=true renders dialog + Fechar button + drag handle; clicking Fechar calls onOpenChange(false); clicking scrim calls onOpenChange(false); Escape closes (focus-trap behavior)"
      min_lines: 60
      contains: "BottomSheet"
    - path: "tests/e2e/catalog/photo-journal-add-a11y.spec.ts"
      provides: "BLOCKING axe-core gate spec — mounts a fixture page that opens BottomSheet and runs AxeBuilder analyze; asserts violations.length === 0"
      min_lines: 40
      contains: "AxeBuilder"
    - path: "package.json"
      provides: "focus-trap@7.1.3 added as dependency (exact pin)"
      contains: "focus-trap"
  key_links:
    - from: "src/shared/ui/bottom-sheet.tsx"
      to: "focus-trap@7.1.3 (npm)"
      via: "import { createFocusTrap } from 'focus-trap'"
      pattern: "createFocusTrap"
    - from: "src/shared/ui/bottom-sheet.tsx"
      to: "Plan 05-17 Photo Journal add modal"
      via: "named import from @shared/ui/bottom-sheet"
      pattern: "BottomSheet"
    - from: "src/shared/ui/bottom-sheet.tsx"
      to: "Plan 05-16 Plant Profile delete-confirm modal"
      via: "named import"
      pattern: "BottomSheet"
user_setup: []
---

<resolved_open_questions>
**Q5 (Bottom-sheet hand-roll vs Vaul fallback) — RESOLVED in this plan.**

Choice: **Hand-roll FIRST per UI-SPEC § Registry Safety + RESEARCH Pattern 7.**

[BLOCKING] axe-core + manual VoiceOver/TalkBack smoke gate (Task 3) decides
whether the hand-roll ships or falls back to Vaul 1.1.2. The fallback is
documented in `decisions.vaul_fallback_path` and the API surface is
intentionally Vaul-shaped for a single-line swap if needed.

Rationale:
- UI-SPEC § Registry Safety explicitly says "hand-rolled per PRD §17 specs"
  — that is the locked design contract.
- RESEARCH § Pattern 7 + § Don't-Hand-Roll table line 1130 both ship the
  hand-roll skeleton and document Vaul as the "documented fallback" if
  the gate fails — this plan inherits that posture verbatim.
- Hand-roll uses `focus-trap@7.1.3` for the focus-trap primitive (per
  RESEARCH "Don't-Hand-Roll" — never hand-roll the focus-trap itself).
</resolved_open_questions>

<objective>
Hand-roll the bottom-sheet primitive at `src/shared/ui/bottom-sheet.tsx` per UI-SPEC § Registry Safety. Component composes `focus-trap@7.1.3` for the focus-trap, renders the §17 modal-sheet contract (drag handle visual + scrim + visible "Fechar" + dialog ARIA), and ships behind a [BLOCKING] axe-core + manual VoiceOver/TalkBack gate. If the gate fails, swap body to Vaul 1.1.2 (API surface is Vaul-shaped for single-line swap).

Purpose: Plan 05-17 Photo Journal "+ Foto no diário" + Plan 05-16 Plant Profile delete-confirm modal both depend on this primitive. Land it ONCE in 05-13 with the a11y gate so consumer plans don't need to re-verify.

Output: 1 component (~90 lines hand-rolled) + 1 dep install (focus-trap@7.1.3) + 1 unit test (~60 lines) + 1 E2E axe-core spec (~40 lines, [BLOCKING] gate). Manual checkpoint between Task 2 and finishing.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-10-tq-provider-idb-persister-i18n-PLAN.md

<interfaces>
<!-- Component contract — locked here, intentionally Vaul-shaped -->

```tsx
// src/shared/ui/bottom-sheet.tsx (THIS PLAN)
"use client";

export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  children: React.ReactNode;
};

export function BottomSheet(props: BottomSheetProps): JSX.Element | null;
```

If Vaul fallback engaged (decisions.vaul_fallback_path), Vaul map:
```ts
import { Drawer } from "vaul";
// <Drawer.Root open={open} onOpenChange={onOpenChange}>
//   <Drawer.Portal>
//     <Drawer.Overlay /> <!-- = scrim -->
//     <Drawer.Content>
//       <Drawer.Handle /> <!-- = drag handle -->
//       <Drawer.Title>{title}</Drawer.Title>
//       {children}
//       <Drawer.Close>Fechar</Drawer.Close>
//     </Drawer.Content>
//   </Drawer.Portal>
// </Drawer.Root>
```
Same external props. Same consumer code. Single-import swap.

From focus-trap@7.1.3:
```ts
export function createFocusTrap(
  element: HTMLElement | string,
  options?: {
    escapeDeactivates?: boolean;
    clickOutsideDeactivates?: boolean;
    onDeactivate?: () => void;
    returnFocusOnDeactivate?: boolean;
  },
): { activate(): void; deactivate(): void };
```
</interfaces>

<related_files>
- `tests/helpers/axe-helper.ts` (Plan 05-01 — `expectNoA11yViolations(page, includeSelector?)`)
- `tests/helpers/playwright-auth-bypass.ts` (Plan 05-01 — auth fixture for E2E suites)
- `src/messages/pt-BR.json` (Plan 05-10) — `catalog.modal.close` = "Fechar"
</related_files>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install focus-trap@7.1.3 (exact pin) and write unit tests for BottomSheet</name>
  <files>package.json, tests/unit/shared/ui/bottom-sheet.test.ts</files>
  <read_first>
    - package.json (current — verify Phase 1 D-04 EXACT pin policy)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Standard Stack > Core (line 190 — `focus-trap` 7.1.3 verified)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 7 (lines 795-862) — full hand-roll skeleton + a11y checklist
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Modal sheet" lines 274-286 — visual contract
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "UI primitives under src/shared/ui/" line 207-217 — focus-trap 7.1.3 only allowed primitive dep
  </read_first>
  <action>
    1. Edit `package.json` — add TWO exact-pinned dependencies (alphabetical placement, no `^`):
       - `"focus-trap": "7.1.3"` for THIS plan's BottomSheet AND Plan 05-14's Lightbox
       - `"lucide-react": "<latest-stable>"` for Plan 05-14's InlineEditField (Pencil icon) AND Plan 05-16's Plant Profile (MoreVertical, Camera icons)

       Verify the latest stable lucide-react version with `npm view lucide-react version` BEFORE adding (current at planning time is 0.469.0; use the actual latest stable at execution time).

       This consolidates Wave 6 dependency installs to ELIMINATE the package.json file conflict that would otherwise occur between Plan 05-13 (focus-trap) and Plan 05-14 (lucide-react). With this change, Plan 05-14 only consumes from package.json (read-only), avoiding the parallel-execution race.

       Run `pnpm install`.

    2. Create `tests/unit/shared/ui/bottom-sheet.test.ts`:
       ```ts
       import { describe, it, expect, vi } from "vitest";
       import { render, screen, fireEvent } from "@testing-library/react";
       import { BottomSheet } from "@shared/ui/bottom-sheet";

       function setup(overrides: Partial<React.ComponentProps<typeof BottomSheet>> = {}) {
         const onOpenChange = vi.fn();
         const utils = render(
           <BottomSheet open onOpenChange={onOpenChange} title="Test sheet" {...overrides}>
             <button>inside-content-button</button>
           </BottomSheet>,
         );
         return { ...utils, onOpenChange };
       }

       describe("BottomSheet (hand-rolled per UI-SPEC § Registry Safety)", () => {
         it("renders nothing when open=false", () => {
           render(
             <BottomSheet open={false} onOpenChange={vi.fn()} title="x">
               <p>body</p>
             </BottomSheet>,
           );
           expect(screen.queryByRole("dialog")).toBeNull();
         });

         it("renders dialog with role='dialog' + aria-modal='true' + aria-labelledby when open", () => {
           setup();
           const dialog = screen.getByRole("dialog");
           expect(dialog).toHaveAttribute("aria-modal", "true");
           expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
         });

         it("renders title text inside the labelled-by element", () => {
           setup({ title: "Excluir Samambaia?" });
           expect(screen.getByText("Excluir Samambaia?")).toBeInTheDocument();
         });

         it("renders visible 'Fechar' button (PRD §17 modal sheet contract)", () => {
           setup();
           expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
         });

         it("renders drag handle (visual, decorative — aria-hidden)", () => {
           const { container } = setup();
           const handle = container.querySelector('[data-testid="bottom-sheet-drag-handle"]');
           expect(handle).toBeInTheDocument();
           expect(handle).toHaveAttribute("aria-hidden", "true");
         });

         it("clicking 'Fechar' calls onOpenChange(false)", () => {
           const { onOpenChange } = setup();
           fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
           expect(onOpenChange).toHaveBeenCalledWith(false);
         });

         it("clicking scrim calls onOpenChange(false)", () => {
           const { onOpenChange, container } = setup();
           const scrim = container.querySelector('[data-testid="bottom-sheet-scrim"]');
           expect(scrim).toBeInTheDocument();
           fireEvent.click(scrim!);
           expect(onOpenChange).toHaveBeenCalledWith(false);
         });

         it("renders children inside the dialog", () => {
           setup();
           expect(screen.getByRole("button", { name: "inside-content-button" })).toBeInTheDocument();
         });
       });
       ```

    3. Run `pnpm exec vitest --run --project=unit tests/unit/shared/ui/bottom-sheet.test.ts` — MUST FAIL with module-not-found.

    4. Commit: `git add package.json pnpm-lock.yaml tests/unit/shared/ui/bottom-sheet.test.ts && git commit -m "test(05-13): install focus-trap@7.1.3 + lucide-react + add failing BottomSheet tests"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/ui/bottom-sheet.test.ts 2>&amp;1 | grep -qE "(Cannot find module|Failed to resolve)" &amp;&amp; grep -E '"focus-trap": "7\.1\.3"' package.json</automated>
  </verify>
  <done>
    - package.json contains `"focus-trap": "7.1.3"` (exact pin) AND `"lucide-react"` at exact-pinned latest stable
    - 8 unit tests authored
    - Vitest fails with module-not-found on `@shared/ui/bottom-sheet`
    - Commit message starts with `test(05-13):`
    - Wave 6 package.json conflict ELIMINATED (Plan 05-14 will not modify package.json)
  </done>
</task>

<task type="auto">
  <name>Task 2: Hand-roll BottomSheet component per UI-SPEC + RESEARCH Pattern 7</name>
  <files>src/shared/ui/bottom-sheet.tsx</files>
  <read_first>
    - tests/unit/shared/ui/bottom-sheet.test.ts (Task 1 RED tests — your implementation must make 8 pass)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 7 (lines 795-862) — verbatim hand-roll skeleton
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Modal sheet" lines 274-286 — visual contract row by row
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 7 a11y checklist lines 866-874 — 8-item gate
  </read_first>
  <action>
    Create `src/shared/ui/bottom-sheet.tsx` (~90 lines, hand-rolled per RESEARCH Pattern 7 verbatim with the §17 visual contract applied):

    ```tsx
    "use client";
    import { createFocusTrap, type FocusTrap } from "focus-trap";
    import { useEffect, useId, useRef } from "react";

    /**
     * Hand-rolled per UI-SPEC § Registry Safety + PRD §17 Modal sheet contract.
     * Focus-trap from `focus-trap` 7.1.3 (per RESEARCH Don't-Hand-Roll table —
     * never hand-roll focus-trap primitive itself).
     *
     * API intentionally Vaul-shaped: if Plan 05-13's [BLOCKING] axe + VoiceOver/
     * TalkBack gate fails after best-effort fixes, swap body to Vaul 1.1.2 with
     * zero consumer changes (see plan decisions.vaul_fallback_path).
     */

    export type BottomSheetProps = {
      open: boolean;
      onOpenChange: (next: boolean) => void;
      title: string;
      children: React.ReactNode;
    };

    export function BottomSheet({ open, onOpenChange, title, children }: BottomSheetProps) {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const trapRef = useRef<FocusTrap | null>(null);
      const titleId = useId();

      useEffect(() => {
        if (!open || !containerRef.current) return;
        trapRef.current = createFocusTrap(containerRef.current, {
          escapeDeactivates: true,
          clickOutsideDeactivates: false, // require visible "Fechar" per §17
          onDeactivate: () => onOpenChange(false),
          returnFocusOnDeactivate: true,
        });
        try {
          trapRef.current.activate();
        } catch {
          // jsdom may not provide focus management; tests bypass this branch
        }
        return () => {
          try {
            trapRef.current?.deactivate();
          } catch {
            // no-op
          }
        };
      }, [open, onOpenChange]);

      if (!open) return null;

      return (
        <div className="fixed inset-0 z-40">
          {/* Scrim — tap dismiss IN ADDITION to visible Fechar (PRD §17) */}
          <div
            data-testid="bottom-sheet-scrim"
            className="absolute inset-0 bg-[var(--scrim,rgba(20,52,36,0.5))]"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-[var(--surface,#FFFDF7)] outline-none motion-reduce:transition-none"
            style={{
              boxShadow: "0 -8px 32px rgba(20,52,36,0.12)",
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            }}
          >
            {/* Drag handle — VISUAL only (decisions.drag_handle_visual_only) */}
            <div
              data-testid="bottom-sheet-drag-handle"
              aria-hidden="true"
              className="mx-auto mt-4 h-1 w-9 rounded-full bg-[var(--hairline,#D8D2C7)]"
            />
            <div className="flex items-start justify-between px-5 pt-3">
              <h2
                id={titleId}
                className="text-2xl font-medium font-serif text-[var(--forest-ink,#143424)]"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md px-2 py-1 text-base font-semibold text-[var(--canopy,#1F4D35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--canopy,#1F4D35)]"
              >
                Fechar
              </button>
            </div>
            <div className="px-5 pt-4">{children}</div>
          </div>
        </div>
      );
    }
    ```

    Run unit tests: `pnpm exec vitest --run --project=unit tests/unit/shared/ui/bottom-sheet.test.ts` — 8 MUST PASS.
    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit: `git add src/shared/ui/bottom-sheet.tsx && git commit -m "feat(05-13): hand-roll BottomSheet primitive per UI-SPEC § Registry Safety"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/ui/bottom-sheet.test.ts &amp;&amp; pnpm exec tsc --noEmit &amp;&amp; grep -c 'role="dialog"' src/shared/ui/bottom-sheet.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c 'createFocusTrap' src/shared/ui/bottom-sheet.tsx | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - Component file ~90 lines, exports BottomSheet
    - 8 unit tests pass
    - tsc --noEmit exits 0
    - role="dialog" + aria-modal + aria-labelledby + createFocusTrap all present
    - "Fechar" labelled button rendered
    - Drag handle present + aria-hidden
    - Scrim present (data-testid="bottom-sheet-scrim")
    - No font-family declaration in component (a11y check #6)
    - motion-reduce:transition-none class for prefers-reduced-motion (a11y check #7)
    - Commit message starts with `feat(05-13):`
  </done>
</task>

<task type="auto">
  <name>Task 3: Author the [BLOCKING] axe-core E2E spec for BottomSheet</name>
  <files>tests/e2e/catalog/photo-journal-add-a11y.spec.ts</files>
  <read_first>
    - tests/helpers/axe-helper.ts (Plan 05-01 — `expectNoA11yViolations(page)`)
    - tests/helpers/playwright-auth-bypass.ts (Plan 05-01 — auth fixture)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 7 a11y checklist (lines 866-874)
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md row CAT-06 a11y (line 60)
    - tests/e2e/diagnostics-posthog.spec.ts (Phase 1 — Playwright fixture style)
  </read_first>
  <action>
    Create `tests/e2e/catalog/photo-journal-add-a11y.spec.ts`. This spec mounts a fixture page that opens a BottomSheet and runs AxeBuilder. Since the actual Photo Journal page (Plan 05-17) doesn't exist yet at this wave, the spec uses a STANDALONE fixture URL for the primitive.

    Two modes — choose based on what executor finds on disk:
    - MODE A (preferred — fixture URL): Author a one-off page at `src/app/__a11y-fixtures/bottom-sheet/page.tsx` that mounts `<BottomSheet open onOpenChange={() => {}} title="Test">…</BottomSheet>`. Spec navigates to `/__a11y-fixtures/bottom-sheet` and runs axe. Fixture page is gated behind `process.env.NODE_ENV !== "production"` so it never ships to prod.
    - MODE B (fallback if MODE A blocked by route segment ignore): Use Playwright's `page.setContent(htmlString)` to render the component into an empty page; harder but no app file needed.

    Use MODE A. Create:
    1. `src/app/__a11y-fixtures/bottom-sheet/page.tsx`:
       ```tsx
       "use client";
       import { useState } from "react";
       import { BottomSheet } from "@shared/ui/bottom-sheet";

       export default function BottomSheetA11yFixturePage() {
         if (process.env.NODE_ENV === "production") return null;
         const [open, setOpen] = useState(true);
         return (
           <main style={{ padding: "2rem" }}>
             <button onClick={() => setOpen(true)}>Abrir</button>
             <BottomSheet open={open} onOpenChange={setOpen} title="Nova foto no diário">
               <p>Conteúdo do BottomSheet para auditoria a11y.</p>
               <input aria-label="Nota" placeholder="Nota opcional" />
               <button>Adicionar ao diário</button>
             </BottomSheet>
           </main>
         );
       }
       ```

       NOTE on path: `__a11y-fixtures` starts with `__` — Next.js App Router's `route-discovery.js` (per STATE.md Plan 01-07 commit `d395c4f` lessons learned: `_` prefix is filtered) — VERIFY before commit that this segment IS exposed. If `_` filter applies, rename to `a11y-fixtures` (no underscore) and gate visibility purely on NODE_ENV. PROCEED with `a11y-fixtures` (no underscore) to avoid the same Plan 01-07 trap.

       Fixed path: `src/app/a11y-fixtures/bottom-sheet/page.tsx`.

    2. `tests/e2e/catalog/photo-journal-add-a11y.spec.ts`:
       ```ts
       import { test, expect } from "@playwright/test";
       import AxeBuilder from "@axe-core/playwright";

       /**
        * [BLOCKING] axe-core gate for hand-rolled BottomSheet (Plan 05-13).
        * If this spec FAILS after best-effort hand-roll fixes, the documented
        * Vaul fallback path engages (Plan 05-13 decisions.vaul_fallback_path).
        *
        * Companion manual gate: VoiceOver (Safari iOS) + TalkBack (Chrome
        * Android) smoke checklist — see this plan's checkpoint task.
        */

       test("BottomSheet open state passes axe-core scan with zero violations", async ({ page }) => {
         await page.goto("/a11y-fixtures/bottom-sheet");
         await expect(page.getByRole("dialog")).toBeVisible();

         const results = await new AxeBuilder({ page })
           .include('[role="dialog"]')
           .analyze();

         expect(results.violations).toEqual([]);
       });

       test("BottomSheet 'Fechar' button has accessible name", async ({ page }) => {
         await page.goto("/a11y-fixtures/bottom-sheet");
         const fechar = page.getByRole("button", { name: "Fechar" });
         await expect(fechar).toBeVisible();
       });

       test("BottomSheet has dialog role + aria-modal=true + aria-labelledby resolved", async ({ page }) => {
         await page.goto("/a11y-fixtures/bottom-sheet");
         const dialog = page.getByRole("dialog");
         await expect(dialog).toHaveAttribute("aria-modal", "true");
         const labelledBy = await dialog.getAttribute("aria-labelledby");
         expect(labelledBy).toBeTruthy();
         await expect(page.locator(`#${labelledBy}`)).toBeVisible();
       });
       ```

    3. Run `pnpm exec playwright test tests/e2e/catalog/photo-journal-add-a11y.spec.ts`. The spec will require a running dev server (Playwright config typically starts one via `webServer`).

    4. If spec PASSES (all 3 tests green): proceed to checkpoint (Task 4).
    5. If spec FAILS: iterate on the hand-roll component to address axe violations; re-run; repeat up to 3 attempts. If still failing, the `decisions.vaul_fallback_path` engages — invoke the swap procedure documented in this plan's frontmatter.

    Commit: `git add src/app/a11y-fixtures/ tests/e2e/catalog/photo-journal-add-a11y.spec.ts && git commit -m "test(05-13): add [BLOCKING] axe-core gate for hand-rolled BottomSheet"`
  </action>
  <verify>
    <automated>pnpm exec playwright test tests/e2e/catalog/photo-journal-add-a11y.spec.ts</automated>
  </verify>
  <done>
    - Fixture page `src/app/a11y-fixtures/bottom-sheet/page.tsx` exists and renders the open BottomSheet
    - Fixture page is gated by `NODE_ENV !== "production"` (prod build returns null)
    - E2E spec exists with 3 tests
    - All 3 axe-core tests pass (or Vaul fallback engaged if not)
    - Commit message starts with `test(05-13):`
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Checkpoint: [BLOCKING] manual VoiceOver + TalkBack smoke for hand-rolled BottomSheet</name>
  <what-built>
    Hand-rolled BottomSheet primitive at src/shared/ui/bottom-sheet.tsx (Task 2) + axe-core E2E gate (Task 3 — already passed automatically). Now requires manual screen-reader smoke per RESEARCH Pattern 7 a11y checklist (8-item gate); VoiceOver/TalkBack semantics axe-core cannot verify.
  </what-built>
  <how-to-verify>
    Two complementary smoke checks (≤ 10 minutes total):

    **VoiceOver (Safari iOS) — preferred device: real iPhone or iPad. iOS Simulator works.**
    1. Open Safari iOS to your dev server URL: `http://<dev-server-ip>:3000/a11y-fixtures/bottom-sheet`
    2. Settings > Accessibility > VoiceOver: ON
    3. Triple-tap to navigate to the BottomSheet — VO should announce "Nova foto no diário, dialog" (the title + role)
    4. Swipe right repeatedly — focus moves through: title → content text → input field → "Adicionar ao diário" button → "Fechar" button → loops back
    5. Tap "Fechar" — sheet closes, focus returns to the trigger button (or BODY if standalone fixture)
    6. Re-open, then VO three-finger flick down to "Escape gesture" equivalent → sheet should close

    **TalkBack (Chrome Android) — Android device or Android Studio emulator.**
    1. Open Chrome to dev server URL: `http://<dev-server-ip>:3000/a11y-fixtures/bottom-sheet`
    2. Settings > Accessibility > TalkBack: ON
    3. Swipe right — focus moves through dialog elements in same order as VO
    4. Two-finger swipe down (read all from cursor) — entire dialog content reads continuously
    5. Tap "Fechar" — sheet closes, focus returns

    **Expected outcomes (gate criteria):**
    - [ ] VoiceOver announces "dialog" role on open
    - [ ] VoiceOver reads the title via aria-labelledby
    - [ ] Tab order matches visual order
    - [ ] "Fechar" label is read (not "button without label")
    - [ ] Dismiss returns focus to trigger
    - [ ] TalkBack matches all four checks above

    **If ALL 4 checks pass for both VO + TB:** Type `approved` and the plan ships hand-rolled.
    **If ANY check fails:** Engage Vaul fallback per `decisions.vaul_fallback_path`:
    1. Run `pnpm add vaul@1.1.2`
    2. Replace BODY of src/shared/ui/bottom-sheet.tsx with Vaul-backed implementation (see decision block; preserve external props)
    3. Re-run axe-core spec from Task 3 + re-run this manual smoke
    4. Document outcome in 05-13-SUMMARY.md as `decisions.bottom_sheet_outcome: "vaul_fallback_engaged"`
    5. Type `vaul-engaged` to mark checkpoint complete
  </how-to-verify>
  <resume-signal>Type "approved" (hand-roll ships) OR "vaul-engaged" (fallback engaged) OR describe issues encountered</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user input → modal content | BottomSheet renders arbitrary children (passed by consumer); XSS risk lives at consumer layer (e.g., Plan 05-17 photo-journal note input goes through React JSX text node — auto-escaped) |
| browser focus → focus-trap | focus-trap intercepts Tab/Shift+Tab events while open; misuse could trap focus indefinitely (mitigated: escapeDeactivates=true, returnFocusOnDeactivate=true) |
| dev fixture page → production bundle | a11y-fixture page must NOT ship to production (mitigated: NODE_ENV gate returns null) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-5b-13-01 | Denial of Service | Focus trap activates and never deactivates → user cannot interact with rest of page | mitigate | `escapeDeactivates: true` + visible "Fechar" button + Escape key + try/catch around activate/deactivate (jsdom may throw). Verified by unit tests (Escape closes sheet) and manual smoke (Task 4 checkpoint). |
| T-5b-13-02 | Information Disclosure | a11y fixture page leaks dev-only UI to production users | mitigate | Fixture page returns `null` when `process.env.NODE_ENV === "production"`. Acceptance criterion: `grep "NODE_ENV" src/app/a11y-fixtures/bottom-sheet/page.tsx` returns ≥1 match. |
| T-5b-13-03 | Spoofing | Component renders consumer-passed `title` as raw HTML (XSS) | mitigate | React JSX renders title as text node in `<h2 id={titleId}>{title}</h2>` — auto-escaped by React. No `dangerouslySetInnerHTML` used. Consumers may pass user-derived strings (e.g., "Excluir Samambaia?" from `delete.modal.title` interpolation) — next-intl auto-escapes interpolated values. |
| T-5b-13-04 | Tampering | Vaul fallback swap drifts API surface | mitigate | Plan `decisions.api_surface_intentionally_vaul_shaped` documents the exact prop shape match; Plan 05-13 SUMMARY.md captures the outcome (hand-roll vs vaul). Consumers (Plans 05-16/05-17) reference only the public BottomSheet export. |

</threat_model>

<verification>
- `pnpm exec vitest --run --project=unit tests/unit/shared/ui/bottom-sheet.test.ts` exits 0 (8 tests pass)
- `pnpm exec playwright test tests/e2e/catalog/photo-journal-add-a11y.spec.ts` exits 0 (3 tests pass — axe-core 0 violations)
- `pnpm exec tsc --noEmit` exits 0
- Manual checkpoint approved (hand-roll ships) OR Vaul fallback engaged
- `grep -E '"focus-trap": "7\.1\.3"' package.json` matches
- `grep -c "createFocusTrap" src/shared/ui/bottom-sheet.tsx` returns ≥ 1
- `grep -c "NODE_ENV" src/app/a11y-fixtures/bottom-sheet/page.tsx` returns ≥ 1
</verification>

<success_criteria>
- BottomSheet primitive exists at `src/shared/ui/bottom-sheet.tsx` with intentionally Vaul-shaped API
- focus-trap@7.1.3 vendor primitive composed (NOT hand-rolled per RESEARCH Don't-Hand-Roll)
- 8 unit tests + 3 axe-core E2E tests all green
- Q5 resolved: hand-roll first; Vaul fallback documented + engageable on a11y gate failure
- [BLOCKING] manual VO + TB smoke approved (or fallback engaged with the same approval)
- a11y fixture page is dev-only (NODE_ENV gated)
- Commits prefixed `test(05-13):` (RED), `feat(05-13):` (GREEN), `test(05-13):` (axe spec)
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-13-SUMMARY.md` summarizing:
- `decisions.bottom_sheet_outcome`: `"hand_rolled"` OR `"vaul_fallback_engaged"`
- The 4-item VoiceOver smoke result + 4-item TalkBack smoke result (which checks passed/failed)
- Final dependency added (focus-trap@7.1.3 always; vaul@1.1.2 only if fallback engaged)
- Note for Plan 05-17 (Photo Journal add) and Plan 05-16 (delete confirm) consumers: import `BottomSheet` from `@shared/ui/bottom-sheet`; they get the chosen implementation transparently
- The exact `data-testid` attributes (`bottom-sheet-scrim`, `bottom-sheet-drag-handle`) so consumer E2E tests can locate them
</output>
</content>
</invoke>