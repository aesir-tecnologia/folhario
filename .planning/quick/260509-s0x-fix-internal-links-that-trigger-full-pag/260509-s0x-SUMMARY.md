---
quick_id: 260509-s0x
status: complete
completed: 2026-05-09
---

# Summary

Replaced confirmed same-app plain-anchor navigation with Next.js `Link`.

## Changes

- `EmptyState` now uses `Link` for internal `ctaHref` values and keeps `<a>` for external URLs.
- Login form forgot-password/signup links now use `Link`.

## Remaining Anchors

- Email templates: external email HTML links.
- Legal consent links: `target="_blank"` links.
- Root skip link and form validation hash links: same-page anchors.
- Logout link: intentionally clears caches and redirects with `window.location.href`.

## Verification

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- Local warning: current Node is `v24.14.1`; repo expects `>=22 <23`.
