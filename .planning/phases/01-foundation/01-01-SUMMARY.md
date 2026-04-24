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
    - typescript@6.0.3
    - eslint@10.2.1
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
  duration: TBD
  completed: TBD
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
| typescript | 6 (major) | **6.0.3** | PLAN.md pins major 6; resolved to latest 6.0.x at scaffold time. |
| @types/node | 22 (major) | **22.19.17** | Must match Node 22 runtime (NOT 25.x). |
| @types/react | 19 (major) | **19.2.14** | Major pin; latest 19.2.x. |
| @types/react-dom | 19 (major) | **19.2.3** | Major pin; latest 19.2.x. |
| eslint | 10 (major) | **10.2.1** | PLAN.md pin major 10; eslint-config-next@16 peer = `>=9.0.0`, so 10 is accepted. |
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

- None. Every PLAN.md-pinned exact version was found on npm (including `next@16.2.3`, `react@19.2.5`, `typescript@6.0.3`, `@sentry/nextjs@10.48.0`). No major-version downgrade required.
- CLAUDE.md stack-lock versions (`vitest@4.1.4`, `@sentry/nextjs@10.48.0`, `posthog-js@1.368.0`, `posthog-node@5.29.7`) are behind npm latest but intentionally kept for cross-phase parity. This is an established lock, not drift.

## eslint-config-next@16 flat-config API shape

**Verified source:** `pnpm create next-app@16 --ts --app --no-tailwind --use-pnpm --yes --skip-install` on 2026-04-23.
**Resolved create-next-app version:** 16.2.4.
**Eslint version it installed alongside:** `^9` (we install `eslint@10.2.1` — peer-compatible per `>=9.0.0`).

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

Tracked during execution; populated in final write at plan end.

## Self-Check

Populated at plan end.
