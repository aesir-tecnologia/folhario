---
created: 2026-04-24T21:01:41.085Z
title: Bump GitHub Actions to v5/v7 to escape Node 20 deprecation
area: tooling
files:
  - .github/workflows/ci.yml:284-290
  - .github/workflows/ci.yml:332-337
  - .github/workflows/ci.yml:357-362
---

## Problem

CI run https://github.com/aesir-tecnologia/folhario/actions/runs/24911496475 emits the GitHub Actions deprecation warning:

> Node.js 20 actions are deprecated. The following actions are running on Node.js 20 and may not work as expected: `actions/cache@v4`, `actions/upload-artifact@v4`. Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026. Node.js 20 will be removed from the runner on September 16th, 2026.

Phase 1 Plan 01-08 explicitly pinned `actions/cache@v4` and `actions/upload-artifact@v4` because the plan text requested those versions and v4 was GA at the time. v5 (`cache`) and v7 (`upload-artifact`) ship on Node 24 and are now GA.

Hard deadlines:
- 2026-06-02 — GitHub forces Node 20 actions onto Node 24 runtime by default (compat risk for any v4 action that breaks under Node 24)
- 2026-09-16 — Node 20 removed from runners entirely (every v4 action will fail)

Both deadlines fall before the likely Phase 12 deploy-pipeline work that touches `ci.yml` next, so this needs its own bump rather than waiting.

## Solution

Single PR that updates `.github/workflows/ci.yml`:

1. `actions/cache@v4` → `@v5` (two usages: pnpm store cache + Playwright browsers cache)
2. `actions/upload-artifact@v4` → `@v7` (one usage: Playwright report artifact)

Verify each version is GA via `gh api repos/actions/{cache,upload-artifact}/tags` before pinning. If breaking-change notes for v5/v7 exist (cache key format changes, artifact retention semantics, etc.), document them in the commit message and validate with one CI run on a throwaway PR before merging.

Atomic commit: bump both actions in the same commit so the deprecation warning disappears in one go and the upgrade is reversible as a single revert.
