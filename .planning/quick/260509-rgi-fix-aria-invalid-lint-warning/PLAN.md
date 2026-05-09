---
status: in-progress
created: 2026-05-09
quick_id: 260509-rgi
slug: fix-aria-invalid-lint-warning
---

# Fix Aria Invalid Lint Warning

## Goal

Remove the unsupported `aria-invalid` usage from the photo picker while preserving accessible error feedback.

## Plan

1. Inspect the lint warning location.
2. Keep the error text association through `aria-describedby`.
3. Rerun lint to confirm the warning is gone.
