---
created: 2026-04-27T16:37:10.843Z
title: Replace vite-tsconfig-paths plugin with native Vite resolve.tsconfigPaths
area: tooling
files:
  - vitest.config.ts
---

## Problem

Vitest unit run prints a deprecation hint:

> The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the `resolve.tsconfigPaths` option. You can remove the plugin and set `resolve.tsconfigPaths: true` in your Vite config instead.

Surfaced during Phase 2 UAT (test 3, unit suite — 15 files / 207 tests still green). Plugin still works today but adds a dependency that Vite's built-in path resolver now covers, so it's noise on every test run and a small future-maintenance cost.

## Solution

1. In `vitest.config.ts` (and any other Vite/Vitest config that imports `vite-tsconfig-paths`), remove the plugin import + `plugins: [tsconfigPaths()]` entry.
2. Add `resolve: { tsconfigPaths: true }` (or the project-equivalent option name as of the installed Vite version).
3. Run `pnpm exec vitest run --project=unit` and `--project=integration` to confirm aliases like `@shared/*`, `@contexts/*` still resolve.
4. Drop `vite-tsconfig-paths` from `package.json` devDependencies and re-pin lockfile via `pnpm install`.
5. Verify `pnpm typecheck`, `pnpm lint`, full unit + integration suites still green.

Low risk; pure tooling cleanup. No production code path touches this plugin.
