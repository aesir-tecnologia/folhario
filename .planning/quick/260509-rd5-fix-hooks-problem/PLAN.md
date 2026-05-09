---
status: in-progress
created: 2026-05-09
quick_id: 260509-rd5
slug: fix-hooks-problem
---

# Fix Hooks Problem

## Goal

Fix the local hook/lint failure without touching unrelated in-progress GSD or hook sync changes.

## Plan

1. Reproduce the failure with the existing project checks.
2. Identify the minimal source/config change needed.
3. Run the relevant check again.
4. Summarize changed files and residual risks.
