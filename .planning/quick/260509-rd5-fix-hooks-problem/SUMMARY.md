---
status: complete
completed: 2026-05-09
quick_id: 260509-rd5
slug: fix-hooks-problem
---

# Summary

Fixed the hook/lint failure caused by ESLint scanning generated Vercel build output.

## Changes

- Added `.vercel/**` to `eslint.config.mjs` global ignores.

## Verification

- `pnpm lint` exits 0.
- `pnpm exec lint-staged --allow-empty` exits 0 with no staged files.

## Notes

- `pnpm lint` still reports one existing warning in `src/app/(app)/catalog/add/add-plant-form.tsx` for `aria-invalid` on a button, but it is not blocking.
- Node warning remains because the current shell is Node 24.14.1 while `package.json` requires `>=22 <23`.
