---
phase: 03-design-system-app-shell
plan: 01
subsystem: design-system-tooling
tags: [tailwind-v4, design-tokens, lint-tooling, paper-cream, stylelint, eslint, vitest]
dependency_graph:
  requires: []
  provides:
    - Tailwind v4 CSS utilities derived from @theme tokens (bg-paper, text-canopy, etc.)
    - Paper Cream / Night Cream color token system in globals.css + JS mirror in tokens.ts
    - Stylelint banned-pattern enforcement (pure black/white, gradient text, backdrop-filter, banned fonts)
    - ESLint better-tailwindcss plugin + emoji ban + Inter-import ban
    - Vitest jsdom project for React component tests + matchMedia mock
    - Cross-cutting banned-patterns-snapshot.test.ts (gates Plans 03+)
    - @axe-core/playwright installed (ready for Plan 05 axe specs)
  affects:
    - All future plans: Tailwind v4 utilities now available
    - Plan 03-02+: component primitives auto-gated by snapshot test
    - Plan 05: @axe-core/playwright ready to use
tech_stack:
  added:
    - tailwindcss@4.2.4
    - "@tailwindcss/postcss@4.2.4"
    - postcss@8.5.12
    - stylelint@17.9.0
    - stylelint-config-standard@40.0.0
    - eslint-plugin-better-tailwindcss@4.4.1
    - jsdom@29.1.0
    - "@testing-library/react@16.3.2"
    - "@testing-library/jest-dom@6.9.1"
    - "@testing-library/user-event@14.6.1"
    - "@axe-core/playwright@4.11.2"
  patterns:
    - Tailwind v4 CSS-first config via @theme directive (no tailwind.config.js)
    - Hybrid dark mode: @custom-variant dark (manual attribute + auto media query)
    - Token duplication between @media dark block and [data-theme="dark"] block is intentional
    - JS token mirror (tokens.ts) cross-checked by snapshot test against globals.css
    - Stylelint custom plugin (CJS) for D-08 layer 3 reduced-motion enforcement
key_files:
  created:
    - postcss.config.mjs
    - src/app/globals.css
    - stylelint.config.mjs
    - tools/stylelint-plugins/keyframes-requires-reduced-motion.cjs
    - src/shared/theme/tokens.ts
    - tests/unit/banned-patterns-snapshot.test.ts
  modified:
    - package.json (7 new devDeps, lint:styles script, lint-staged CSS entry, test:unit updated)
    - eslint.config.mjs (better-tailwindcss + custom rules + tools/stylelint-plugins ignore)
    - vitest.config.ts (added unit-dom jsdom project)
    - tests/unit/setup-env.ts (matchMedia mock appended)
    - .planning/phases/03-design-system-app-shell/03-CONTEXT.md (D-32 substitution note)
decisions:
  - "D-32 substitution: eslint-plugin-better-tailwindcss@4.4.1 replaces eslint-plugin-tailwindcss (Open Risk #1 — original plugin has no stable v4 release). CONTEXT.md D-32 updated retroactively."
  - "Stylelint config disables rule-empty-line-before, comment-empty-line-before, at-rule-empty-line-before to accommodate Tailwind v4 at-rule syntax (@theme, @utility, @custom-variant)"
  - "gradient TEXT banned via background-clip:text + -webkit-text-fill-color:transparent instead of blanket linear-gradient ban — allows skeleton shimmer (MEDIUM 8 codex review)"
  - "tools/stylelint-plugins/** added to ESLint globalIgnores — CJS plugin uses require() by design"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 7
  tasks_total: 7
  files_created: 6
  files_modified: 5
---

# Phase 3 Plan 1: Design System Tooling Foundation Summary

Tailwind v4 CSS-first token system + Stylelint/ESLint banned-pattern enforcement + Vitest jsdom project for React component tests, enabling all Wave 2+ plans to paint with PRD §17 Paper Cream / Night Cream utilities and have lint violations caught at commit time.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install Tailwind v4 + globals.css skeleton + postcss.config.mjs | 1eab5cb | postcss.config.mjs, src/app/globals.css |
| 2 | Stylelint config + D-08 layer 3 custom plugin + lint:styles | 6156951 | stylelint.config.mjs, tools/stylelint-plugins/keyframes-requires-reduced-motion.cjs |
| 3 | ESLint extension: better-tailwindcss + emoji/Inter bans | d223252 | eslint.config.mjs |
| 4 | Vitest jsdom project + matchMedia mock + @testing-library | b450f1d | vitest.config.ts, tests/unit/setup-env.ts |
| 5 | globals.css full @theme + Paper Cream / Night Cream tokens | c6df722 | src/app/globals.css |
| 6 | JS token mirror src/shared/theme/tokens.ts | 5b7a854 | src/shared/theme/tokens.ts |
| 7 | banned-patterns-snapshot.test.ts + @axe-core/playwright | 6ee00a0 | tests/unit/banned-patterns-snapshot.test.ts |

## Versions Actually Installed

| Package | Pinned | Installed | Drift |
|---------|--------|-----------|-------|
| tailwindcss | 4.2.4 | 4.2.4 | none |
| @tailwindcss/postcss | 4.2.4 | 4.2.4 | none |
| postcss | 8.5.12 | 8.5.12 | none |
| stylelint | 17.9.0 | 17.9.0 | none |
| stylelint-config-standard | 40.0.0 | 40.0.0 | none |
| eslint-plugin-better-tailwindcss | 4.4.1 | 4.4.1 | none |
| jsdom | latest | 29.1.0 | resolved to 29.1.0 |
| @testing-library/react | latest | 16.3.2 | resolved to 16.3.2 |
| @testing-library/jest-dom | latest | 6.9.1 | resolved to 6.9.1 |
| @testing-library/user-event | latest | 14.6.1 | resolved to 14.6.1 |
| @axe-core/playwright | 4.11.2 | 4.11.2 | none |

## D-32 Substitution (Open Risk #1)

The plan identified that `eslint-plugin-tailwindcss` (named in CONTEXT.md D-32) has no stable Tailwind v4-ready release. This plan ships `eslint-plugin-better-tailwindcss@4.4.1` instead.

**CONTEXT.md D-32 updated retroactively** to document the substitution. The substituted plugin provides the same Tailwind utility class validation (class-order + valid utility names) and recognizes Tailwind v4 arbitrary values out of the box. The `entryPoint: "src/app/globals.css"` setting allows the plugin to derive utility names from the `@theme` block at lint time.

## Open Risk #7 Ordering Verified

Task execution order was strictly maintained:
1. Task 1 created `src/app/globals.css` with `@import "tailwindcss"` first
2. Task 3 wired `eslint-plugin-better-tailwindcss` after Task 1 completed

This prevents the plugin throwing on load when the entrypoint CSS file is missing. The plan's ordering constraint was satisfied.

## Stylelint @theme Font-Family Carve-out

No inline `/* stylelint-disable */` was needed. The `@theme` block in `globals.css` uses `--font-serif: var(--font-source-serif), serif` and `--font-sans: var(--font-plus-jakarta), system-ui, sans-serif`. The `font-family` ban list only covers Inter/Times/Georgia/Garamond/Palatino — not `serif`, `system-ui`, or `sans-serif`. No carve-out required.

The Stylelint config required these additional rule overrides to accommodate Tailwind v4 syntax:
- `import-notation: "string"` — Tailwind v4 uses bare string imports, not `url()`
- `at-rule-no-unknown` with `ignoreAtRules: [theme, utility, custom-variant, slot, ...]`
- `nesting-selector-no-missing-scoping-root: null` — Tailwind v4 nesting pattern
- `comment-empty-line-before: null`, `at-rule-empty-line-before: null`, `rule-empty-line-before: null` — keyframe percentage selectors

## Vitest unit-dom jsdom Config

No additional jsdom config was needed beyond setting `environment: "jsdom"`. The `matchMedia` shim in `setup-env.ts` covers the only gap identified (Motion v12 SSR hydration risk). The `@testing-library/react` and `@testing-library/jest-dom` packages install cleanly alongside Vitest 4.1.4.

## Snapshot Test Current State

UI directory (`src/shared/ui/`) does not exist yet — Plan 02 ships first primitives. The snapshot test reports:

- "finds 0 or more UI primitive files (currently 0)" — passes (0 files, no assertions run for file-level checks)
- Token-mirror cross-check: 7 hex pairs verified in both `globals.css` and `tokens.ts` — all pass
- Total: 8 new assertions, all green

The test will gate Plan 03-02+ primitives automatically as they are created.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stylelint config required Tailwind v4 at-rule overrides**

- **Found during:** Task 2 verification (pnpm lint:styles)
- **Issue:** `stylelint-config-standard` flagged `@import "tailwindcss"`, `@custom-variant dark`, and nesting patterns as unknown/invalid CSS
- **Fix:** Added `import-notation: "string"`, `at-rule-no-unknown` with ignored at-rules, `nesting-selector-no-missing-scoping-root: null`, `comment-empty-line-before: null`, `at-rule-empty-line-before: null`
- **Files modified:** stylelint.config.mjs
- **Commit:** 6156951

**2. [Rule 3 - Blocking] Stylelint rule-empty-line-before fired on @keyframes percentage selectors**

- **Found during:** Task 5 verification (pnpm lint:styles)
- **Issue:** `stylelint-config-standard` requires empty line before CSS rules; `@keyframes shimmer { 0% {...} 100% {...} }` pattern fails this rule
- **Fix:** Added `rule-empty-line-before: null` to stylelint config
- **Files modified:** stylelint.config.mjs
- **Commit:** c6df722

**3. [Rule 2 - Missing Critical] ESLint require() error for CJS Stylelint plugin**

- **Found during:** Task 3 verification (pnpm lint)
- **Issue:** `tools/stylelint-plugins/keyframes-requires-reduced-motion.cjs` uses `require()` (correct for CJS), but `@typescript-eslint/no-require-imports` rule flagged it as an error
- **Fix:** Added `tools/stylelint-plugins/**` to ESLint `globalIgnores`
- **Files modified:** eslint.config.mjs
- **Commit:** d223252

**4. [Rule 1 - Bug] Unused globSync import removed from banned-patterns-snapshot.test.ts**

- **Found during:** Task 7 implementation review
- **Issue:** Plan code sample had redundant `import { globSync } from "node:fs"` that was never used (walker uses readdirSync/statSync)
- **Fix:** Omitted the unused import entirely
- **Files modified:** tests/unit/banned-patterns-snapshot.test.ts
- **Commit:** 6ee00a0

## Known Stubs

None — this plan ships tooling foundation only (no UI, no data flows, no stubs).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan is tooling-only (ESLint, Stylelint, Vitest config, CSS tokens, JS constants). No threat flags.

## Self-Check: PASSED

Files created/exist:
- postcss.config.mjs: FOUND
- src/app/globals.css: FOUND (164 lines)
- stylelint.config.mjs: FOUND
- tools/stylelint-plugins/keyframes-requires-reduced-motion.cjs: FOUND
- src/shared/theme/tokens.ts: FOUND
- tests/unit/banned-patterns-snapshot.test.ts: FOUND

Commits verified in git log:
- 1eab5cb: chore(03-01): install Tailwind v4 + PostCSS + globals.css skeleton
- 6156951: chore(03-01): add Stylelint config + D-08 layer 3 custom plugin
- d223252: feat(03-01): extend ESLint with better-tailwindcss + custom banned-pattern rules
- b450f1d: chore(03-01): configure jsdom environment + matchMedia mock + install testing-library
- c6df722: feat(03-01): populate globals.css with Paper Cream / Night Cream token system
- 5b7a854: feat(03-01): create JS token mirror src/shared/theme/tokens.ts
- 6ee00a0: test(03-01): add banned-patterns-snapshot gate + install axe-core/playwright

End-to-end gates:
- pnpm lint: EXIT 0 (0 errors, 2 warnings on anonymous default exports in config files)
- pnpm lint:styles: EXIT 0
- vitest run --project=unit: 215 tests pass
- pnpm typecheck: EXIT 0
- globals.css: 164 lines (>= 80 required)
