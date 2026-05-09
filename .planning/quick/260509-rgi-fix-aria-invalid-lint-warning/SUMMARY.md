---
status: complete
completed: 2026-05-09
quick_id: 260509-rgi
slug: fix-aria-invalid-lint-warning
---

# Summary

Removed unsupported `aria-invalid` from the custom photo picker button role.

## Changes

- Kept `aria-describedby` pointing at the photo error message.
- Left the visual invalid state on the photo picker border.

## Verification

- `pnpm lint` exits 0 with no ESLint warnings or errors.

## Notes

- `pnpm lint` still prints the existing Node engine warning because the current shell is Node 24.14.1 while `package.json` requires `>=22 <23`.
