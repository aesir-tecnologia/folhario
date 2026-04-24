# Phase 01 — Deferred Items

Out-of-scope findings discovered during plan execution but not fixed in-plan.

## From Plan 01-07 (2026-04-24)

### `public/sw.js.map` missing from `.gitignore`

- **Discovered during:** Plan 01-07 pre-flight (background untracked file)
- **Issue:** Plan 01-03 SUMMARY claimed `public/sw.js.map` was added to `.gitignore` but the actual `.gitignore` only lists `public/sw.js`, `public/swe-worker-*.js`, `public/workbox-*.js`. Every `pnpm build --webpack` regenerates `public/sw.js.map` as an untracked file.
- **Why deferred:** Plan 01-07 does not edit `.gitignore` (Plan 03 owns it per FILE-MATRIX); fixing it here would violate scope.
- **Suggested owner:** Plan 01-08 (CI) or a later housekeeping pass — add `public/sw.js.map` to `.gitignore`.
