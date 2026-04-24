---
phase: 01
plan: 01
subsystem: foundation-tooling
tags:
  - scaffold
  - tooling
  - test-infrastructure
requires: []
provides:
  - repo-tooling
  - package-manager-pinned
  - typescript-config
  - linting
  - test-runners
  - git-hooks
affects:
  - all-subsequent-phase-1-plans
tech-stack:
  added:
    - next@16.2.3
    - react@19.2.5
    - react-dom@19.2.5
    - typescript@5.9.3
    - eslint@9.39.4
    - eslint-config-next@16.2.3
    - prettier@3.8.3
    - vitest@4.1.4
    - "@playwright/test@1.59.1"
    - husky@9.1.7
    - lint-staged@16.4.0
    - "@commitlint/cli@20.5.0"
    - "@commitlint/config-conventional@20.5.0"
    - supabase@2.95.0
  patterns:
    - corepack-activated-pnpm
    - flat-eslint-config-with-subpath-imports
    - husky-9-plain-script-idiom
    - vitest-4-test-projects
key-files:
  created:
    - .nvmrc
    - package.json
    - pnpm-lock.yaml
    - tsconfig.json
    - eslint.config.mjs
    - .prettierrc
    - .prettierignore
    - .commitlintrc.json
    - vitest.config.ts
    - playwright.config.ts
    - .env.example
    - .husky/pre-commit
    - .husky/commit-msg
  modified:
    - .gitignore
decisions:
  - "Use exact PLAN.md pins where published (next@16.2.3, react@19.2.5); use resolved latest patch where pin lagged (typescript@6.0.3, eslint@10.2.1, etc.) per Action 12"
  - "Use `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` subpath imports as discovered from create-next-app@16.2.4 output"
  - "Pin pnpm@9.15.5 via Corepack (packageManager field) even though system had 9.15.9"
metrics:
  duration: "~11 minutes"
  completed: 2026-04-23
---

# Phase 01 Plan 01: Repository Tooling Scaffold Summary

One-liner: Bootstrapped Node 22 + Corepack pnpm + TypeScript strict + ESLint/Prettier/commitlint + Vitest 4 projects + Playwright 1.59 + `.env.example` (19 PRD §20 vars) + Husky 9 hooks, with a pre-flight spike that verified the real `eslint-config-next@16` flat-config shape against `create-next-app@16.2.4` output.

## Resolved patch versions (2026-04-23)

Resolved via `pnpm view <pkg>@<major> version` on 2026-04-23. Where an exact PLAN.md pin was published, that pin was kept (per CLAUDE.md locks). Where the PLAN.md pin was only a major-range guess, the latest published patch was chosen (per Action 12).

| Package | Requested (PLAN.md) | Resolved (installed) | Notes |
|---------|---------------------|---------------------|-------|
| next | 16.2.3 | **16.2.3** | Exact PLAN pin exists on npm. |
| react | 19.2.5 | **19.2.5** | Exact PLAN pin exists on npm (pnpm view@19 reported 19.0.5 because of dist-tag semantics; 19.2.5 is published and installable). |
| react-dom | 19.2.5 | **19.2.5** | Matches react. |
| typescript | 6 (major) | **5.9.3** | Downgraded from plan pin `typescript@6` — `vite-tsconfig-paths@5.1.4` transitive dep `tsconfck@3.1.6` peer-caps at `typescript@^5`. Rule 1 bug fix. Matches `create-next-app@16.2.4` which ships `typescript@^5`. |
| @types/node | 22 (major) | **22.19.17** | Must match Node 22 runtime (NOT 25.x). |
| @types/react | 19 (major) | **19.2.14** | Major pin; latest 19.2.x. |
| @types/react-dom | 19 (major) | **19.2.3** | Major pin; latest 19.2.x. |
| eslint | 10 (major) | **9.39.4** | Downgraded from plan pin `eslint@10` — transitive deps of `eslint-config-next@16.2.3` (`eslint-plugin-jsx-a11y@6.10.2`, `eslint-plugin-import@2.32.0`, `eslint-plugin-react@7.37.5`) all peer-cap at `eslint@^9`. Rule 1 bug fix. Matches `create-next-app@16.2.4` which ships `eslint@^9`. |
| eslint-config-next | 16.2.3 | **16.2.3** | Exact PLAN pin. create-next-app@16.2.4 shipped 16.2.4, but plan locks 16.2.3 — kept for CLAUDE.md stack-lock parity. |
| eslint-config-prettier | 10 (major) | **10.1.8** | Major pin. |
| prettier | 3 (major) | **3.8.3** | Major pin. |
| vitest | 4.1.4 | **4.1.4** | CLAUDE.md locks 4.1.4 even though 4.1.5 is latest — drift accepted per PLAN.md. |
| @vitest/ui | 4 (major) | **4.1.4** | Matches vitest pin. |
| vite-tsconfig-paths | 5 (major) | **5.1.4** | Major pin. |
| @playwright/test | 1.59.1 | **1.59.1** | CLAUDE.md lock. |
| husky | 9 (major) | **9.1.7** | Major pin. |
| lint-staged | 16 (major) | **16.4.0** | Major pin. |
| @commitlint/cli | 20 (major) | **20.5.0** | Major pin. |
| @commitlint/config-conventional | 20 (major) | **20.5.0** | Major pin. |
| supabase | 2.95.0 | **2.95.0** | CLAUDE.md / D-16 lock. |
| @serwist/next | 9.5.7 | **9.5.7** | Runtime dep; exact pin exists. |
| serwist | 9.5.7 | **9.5.7** | Runtime dep; exact pin exists. |
| @sentry/nextjs | 10.48.0 | **10.48.0** | Runtime dep; CLAUDE.md lock (10.50.0 latest but 10.48.0 kept per stack-lock parity). |
| posthog-js | 1.368.0 | **1.368.0** | Runtime dep; CLAUDE.md lock (1.371.2 latest but 1.368.0 kept per stack-lock parity). |
| posthog-node | 5.29.7 | **5.29.7** | Runtime dep; CLAUDE.md lock (5.30.0 latest but 5.29.7 kept per stack-lock parity). |
| next-intl | 4.9.1 | **4.9.1** | Runtime dep; exact pin exists. |
| zod | 4 (major) | **4.3.6** | Major pin. |

### Fallbacks and drift

- **Two Rule 1 bug-fix downgrades** during Task 1 install:
  - `typescript@6.0.3 → 5.9.3` (vite-tsconfig-paths transitive peer constraint).
  - `eslint@10.2.1 → 9.39.4` (eslint-config-next transitive plugin peer constraints).
  Both align with `create-next-app@16.2.4`'s upstream-tested stack and resolve unmet-peer-dep warnings that would otherwise produce `pnpm lint` / `pnpm typecheck` failures downstream.
- CLAUDE.md stack-lock versions (`vitest@4.1.4`, `@sentry/nextjs@10.48.0`, `posthog-js@1.368.0`, `posthog-node@5.29.7`) are behind npm latest but intentionally kept for cross-phase parity. This is an established lock, not drift.

## eslint-config-next@16 flat-config API shape

**Verified source:** `pnpm create next-app@16 --ts --app --no-tailwind --use-pnpm --yes --skip-install` on 2026-04-23.
**Resolved create-next-app version:** 16.2.4.
**Eslint version it installed alongside:** `^9` (we also install `eslint@9.39.4` to satisfy transitive plugin peer-dep constraints — see "Fallbacks and drift" above).

### Verified import pattern

The generated `eslint.config.mjs` does **not** match either of PLAN.md Task 2 Step 2's offered shapes (`[...next(), prettier]` callable or `[...next, prettier]` array-directly on the default export). Instead it imports **two subpath entry points** and uses `defineConfig` + `globalIgnores` from `eslint/config`:

```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

Both `nextVitals` and `nextTs` are **config arrays directly** — spread with `...`. Not callable. No default combined export.

### Adjustment applied to project `eslint.config.mjs`

Project `eslint.config.mjs` mirrors the upstream shape with:

1. LINE 1 comment EXACTLY: `// verified from create-next-app@16.2.4 output` (explicit exception to CLAUDE.md no-comments rule per user decision + Action 5).
2. Same two subpath imports (`core-web-vitals` + `typescript`).
3. `defineConfig` + `globalIgnores` from `eslint/config`.
4. Append `eslint-config-prettier` after the Next configs (disables conflicting stylistic rules).
5. Extend the ignore list beyond upstream defaults with: `node_modules`, `coverage`, `playwright-report`, `test-results`, `public/sw.js` (Serwist writes compiled SW there).

This is a divergence from PLAN.md Task 2 Step 2 — both offered shapes there were incorrect for eslint-config-next@16.2.x. The divergence is authorised by Action 5 ("Validate `eslint-config-next@16.2.x` flat-config shape via `pnpm create next-app@16` output; fix Task 2 Step 2 import pattern if needed"). Recorded in Deviations section at plan end.

## Exact versions chosen for scaffold

- **Node:** `22.22.2` (local dev); `.nvmrc` pins major `22` (Node 22 LTS).
- **pnpm:** `9.15.5` via Corepack (system had 9.15.9 but PLAN.md specifies `pnpm@9.15.5` in `packageManager`; Corepack swapped automatically).
- **Supabase CLI:** `2.95.0` (devDependency per D-16).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] typescript@6.0.3 → typescript@5.9.3 downgrade**
- **Found during:** Task 1 install
- **Issue:** `vite-tsconfig-paths@5.1.4` transitive dep `tsconfck@3.1.6` peer-caps at `typescript@^5`; installing TS 6 produces unmet peer-dep warnings.
- **Fix:** `pnpm add -D typescript@5.9.3` (latest 5.x).
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Commit:** Task 1 (see `a678522`)

**2. [Rule 1 - Bug] eslint@10.2.1 → eslint@9.39.4 downgrade**
- **Found during:** Task 1 install
- **Issue:** `eslint-config-next@16.2.3` transitive deps (`eslint-plugin-jsx-a11y@6.10.2`, `eslint-plugin-import@2.32.0`, `eslint-plugin-react@7.37.5`) all peer-cap at `eslint@^9`; installing ESLint 10 produces unmet peer-dep warnings that would likely cause plugin resolution failures during `pnpm lint`.
- **Fix:** `pnpm add -D eslint@9.39.4` (latest 9.x).
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Commit:** Task 1 (see `a678522`)

**3. [Rule 1 - Bug] `"lint": "next lint"` → `"lint": "eslint"`**
- **Found during:** Task 2 verify
- **Issue:** Next.js 16 removed the `next lint` subcommand; PLAN.md Task 1 Step 3 carried the outdated Next 15 script form. Running `pnpm lint` errored with `Invalid project directory provided, no such directory: /Users/machado/Projects/folhario/lint` (it tried to interpret `lint` as a positional path argument). Matches `create-next-app@16.2.4` which generates `"lint": "eslint"`.
- **Fix:** Edited `package.json` `scripts.lint` to `"eslint"`.
- **Files modified:** `package.json`
- **Commit:** Task 2

**4. [Rule 3 - Blocker] TS18003 "No inputs were found" on empty src/**
- **Found during:** Task 2 verify (`pnpm typecheck`)
- **Issue:** Plan 01-01 defines `tsconfig.json` but does not create any `.ts` files; `tsc` errors with TS18003 before Plan 01-02 lands its first files. PLAN.md acceptance criterion "`pnpm typecheck` exits 0 against an empty `src/`" is unsatisfiable as written with Next 16's tsconfig + empty workspace.
- **Fix:** Created `src/placeholder.ts` containing `export {};` with a comment indicating it can be deleted by Plan 01-02/01-03 when the first real modules land. FILE-MATRIX-safe (no collision with any later plan's files).
- **Files modified:** `src/placeholder.ts` (created)
- **Commit:** Task 2

**5. [Rule 3 - Blocker] ESLint picking up `.claude/` orchestrator scripts**
- **Found during:** Task 2 verify (`pnpm lint`)
- **Issue:** ESLint flat config, by default, scans the entire repo. `.claude/hooks/*.js` and `.claude/get-shit-done/bin/*.cjs` are CommonJS orchestration scripts using `require()`; they violate `@typescript-eslint/no-require-imports` rule bundled with `eslint-config-next/typescript`. These files are pre-existing GSD orchestrator infrastructure, not project code (Scope Boundary rule applies).
- **Fix:** Extended `globalIgnores([...])` in `eslint.config.mjs` to exclude `.claude/**`, `.planning/**`, `.planning.bak-*/**`, `docs/**`, `supabase/**`, `gsd-review-*.md`.
- **Files modified:** `eslint.config.mjs`
- **Commit:** Task 2

**6. [Rule 3 - Blocker] `tsconfig.tsbuildinfo` untracked artifact**
- **Found during:** Task 2 verify (post-typecheck)
- **Issue:** `tsc --noEmit` with `incremental: true` writes a `.tsbuildinfo` cache file to the repo root. It's a build artifact, not source.
- **Fix:** Added `tsconfig.tsbuildinfo` to `.gitignore`.
- **Files modified:** `.gitignore`
- **Commit:** Task 2

**7. [Rule 1 - Bug] `commitlint --stdin --strict` → `commitlint --strict`**
- **Found during:** Task 4 Step 5 (stateless verification)
- **Issue:** PLAN.md Task 4 Step 5 + Action 10 prescribe `pnpm exec commitlint --stdin --strict`, but `@commitlint/cli@20.5.0` has **no `--stdin` flag**. Its help text explicitly says "[input] reads from stdin if --edit, --env, --from and --to are omitted". Running the plan-prescribed command errors with `Unknown argument: stdin`.
- **Fix:** Use `echo "<msg>" | pnpm exec commitlint --strict` (no `--stdin` flag); commitlint reads stdin implicitly when `--edit`/`--env`/`--from`/`--to` are all omitted. Verified: bad message exits 3 (strict-mode error), `feat: valid` exits 0.
- **Files modified:** None (verification-time command correction only; the hook body `pnpm exec commitlint --edit "$1"` remains correct).
- **Commit:** Task 4

## Commits

| Task | Name | Commit |
|------|------|--------|
| 0 | Pre-flight version resolution + eslint-config-next spike | `0692871` |
| 1 | `.nvmrc`, `.gitignore`, `package.json`, dependencies install | `a678522` |
| 2 | `tsconfig.json`, `eslint.config.mjs`, prettier configs, commitlint config | `8f37b1c` |
| 3 | `vitest.config.ts`, `playwright.config.ts`, `.env.example` | `33281e3` |
| 4 | `.husky/pre-commit`, `.husky/commit-msg` | `244055d` |

## Known Stubs

- `src/placeholder.ts` — contains `export {};` only. Purpose: satisfy `tsc --noEmit` glob before Plan 01-02 lands its first real module at `src/shared/config/errors.ts`. Plan 01-02 or 01-03 should delete this file the moment a real source file exists under `src/`. This is documented in a top-of-file comment.

## Threat Flags

None — Plan 01-01 introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The `.env` / `.env.example` T-01-01 mitigation is already covered in the plan's threat register and remains in effect (dummy values in `.env.example`; real `.env` stays ignored via `.gitignore`).

## Reference to Next Plan

Next plan: **01-02** — Error registry + env validation (split `server-env.ts` / `client-env.ts` per D-29 revised). Plan 01-02 will:
- Drop `src/placeholder.ts` once it lands real modules under `src/shared/config/`.
- Add `setupFiles: ["tests/unit/setup-env.ts"]` to both Vitest projects (per FILE-MATRIX).
- Ship the first unit tests, satisfying the `pnpm test:unit` project with ≥1 file.

## Self-Check

Files created/modified by this plan verified against disk:

- `.nvmrc` — EXISTS (contains `22`).
- `.gitignore` — EXISTS (extended; `.DS_Store` preserved; `next-env.d.ts` NOT present; `tsconfig.tsbuildinfo` added).
- `package.json` — EXISTS (scripts, engines, packageManager, lint-staged config present; `lint` script = `"eslint"`).
- `pnpm-lock.yaml` — EXISTS (10 runtime + 16 dev deps at pinned versions).
- `tsconfig.json` — EXISTS (strict + noUncheckedIndexedAccess + 3 path aliases).
- `eslint.config.mjs` — EXISTS (line 1 = `// verified from create-next-app@16.2.4 output`).
- `.prettierrc`, `.prettierignore`, `.commitlintrc.json` — EXIST.
- `vitest.config.ts` — EXISTS (`test.projects` v4 API with `unit` + `integration` projects).
- `playwright.config.ts` — EXISTS (chromium-only, webServer `pnpm start`, probe URL `/`).
- `.env.example` — EXISTS (exactly 19 PRD §20 variables; `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`).
- `.husky/pre-commit`, `.husky/commit-msg` — EXIST (both executable; no `husky install`).
- `src/placeholder.ts` — EXISTS (Rule 3 fix; documented for deletion by 01-02).

Commits verified present in `git log`:
- `0692871` (Task 0)
- `a678522` (Task 1)
- `8f37b1c` (Task 2)
- `33281e3` (Task 3)
- `244055d` (Task 4)

Full-plan verification:
- `pnpm install --frozen-lockfile` — exits 0.
- `pnpm typecheck` — exits 0.
- `pnpm lint` — exits 0.
- `playwright --version` — prints `Version 1.59.1`.
- `vitest run` — discovers `unit` + `integration` projects, reports 0 test files, exits 1 (expected; no tests yet).
- Stateless commitlint: bad → exit 3, `feat: valid` → exit 0.

## Self-Check: PASSED
