---
created: 2026-04-29T17:00:35.205Z
title: Generate visual-snapshot baselines for chromium-darwin (28 missing)
area: testing
files:
  - tests/e2e/visual-snapshots.spec.ts:14-25
  - tests/e2e/visual-snapshots.spec.ts-snapshots/
  - playwright.config.ts:41-50
  - package.json (visual:baseline:docker script)
---

## Problem

Running `pnpm exec playwright test tests/e2e/visual-snapshots.spec.ts` on this Mac on 2026-04-29 produced 28 failures, all of the form:

> Error: A snapshot doesn't exist at /Users/machado/Projects/folhario/tests/e2e/visual-snapshots.spec.ts-snapshots/visual-snapshot-{route}-{theme}-{motion}-1-chromium-darwin.png, writing actual.

Routes covered: `/`, `/catalog`, `/identify`, `/profile`, `/offline` — each rendered at four `prefers-color-scheme` × `prefers-reduced-motion` combinations (`light/no-preference`, `light/reduce`, `dark/no-preference`, `dark/reduce`), plus a couple of state-variant takes for the offline page. 5 routes × ~5.6 cases ≈ 28 missing baselines.

Per `playwright.config.ts:41-50` the design intent is:

> Local macOS Apple-system fonts render differently from CI Ubuntu DejaVu; baselines are generated via Docker (`pnpm visual:baseline:docker`) and committed once. `maxDiffPixels: 100` absorbs sub-pixel anti-aliasing drift.

So this is NOT a bug — the baselines were never generated for this checkout / this machine, and the Docker recipe is the documented authoritative path. The reason it surfaced today is the full Playwright suite was run end-to-end for the first time post-Phase-4 work (see commit `42e0d8f` lineage). The earlier Plan 01-08 CI run (`24911496475`) predates the Phase 4 routes.

This is a **procedural task that gates Phase 4 merge**:

- The Phase 4 visuals (`/auth/check-email`, the unverified blocker, the new public auth flows landed during plan 04-13) are not represented in the existing baseline set, so even after running the Docker recipe the new pages need their own snapshot lines added.
- Without the baselines, CI cannot regression-check visual drift — every Phase 4 PR will silently pass visual-snapshots.spec.ts (since the test writes "actual" then succeeds on the next run if the actual happens to match), or fail noisily if an `--update-snapshots` step lands inadvertently.

## Solution

Two-phase plan, do them together so the diff is reviewable in one PR:

1. **Wait for Phase 4 visuals to stabilize.** Don't bake baselines off mid-flight UI work. Anchor this todo against either the end of Plan 04-13 acceptance OR the start of Phase 5 — whichever lands first.

2. **Run the documented Docker recipe end-to-end:**
   ```bash
   pnpm visual:baseline:docker
   ```
   This script (defined in `package.json`) builds an Ubuntu Docker image with the project's pinned Playwright browsers + DejaVu fonts, mounts the repo, and runs `playwright test --update-snapshots tests/e2e/visual-snapshots.spec.ts`. The output PNGs land in `tests/e2e/visual-snapshots.spec.ts-snapshots/` with the `chromium-darwin` suffix replaced by `chromium-linux` (the actual CI runner platform).

3. **Add new spec entries for Phase 4 routes if missing:** specifically `/auth/login`, `/auth/signup`, `/auth/check-email`, and any unverified-blocker-shown variant. The current spec covers the 5 app shell routes — auth flows aren't there yet. Confirm by reading `tests/e2e/visual-snapshots.spec.ts:1-30` against PRD §17 inventory; add missing routes before running the Docker recipe so they're baked in the same pass.

4. **Commit the baselines** under a single docs/test commit: `test(e2e): add chromium visual baselines for Phase 4 routes`. Each baseline PNG is git-tracked (snapshot dir already in the repo).

5. **Verify locally** by running `pnpm exec playwright test tests/e2e/visual-snapshots.spec.ts` AGAIN on this Mac — the Apple-font-rendered local PNGs will differ pixel-perfectly from the Linux baselines, but `maxDiffPixels: 100` (set in playwright.config.ts:48) absorbs that drift. If the test fails locally with >100 diff pixels on a Phase 4 route, the route has cross-platform font drift larger than the budget — flag for revisit.

## Why this is a todo, not a debug session

The 28 failures match the documented baseline-generation procedure exactly — there's no investigation gap. The owner just needs to run the Docker recipe at the right phase boundary, confirm the spec covers Phase 4 routes, and commit the PNGs.
