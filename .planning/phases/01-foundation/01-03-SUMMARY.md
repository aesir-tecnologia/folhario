---
phase: 01
plan: 03
subsystem: foundation-next-app-skeleton
tags:
  - next-app
  - pwa
  - i18n
  - proxy
  - security-headers
  - serwist
  - sentry
requires:
  - phase: 01-01
    provides: tsconfig-aliases + playwright-webserver-probing-root
  - phase: 01-02
    provides: server-env-schema + client-env-schema
provides:
  - next-app-router-skeleton
  - pt-br-locale-root-layout
  - every-response-security-headers
  - serwist-pwa-skeleton
  - diagnostics-robots-disallow
  - sentry-instrumentation-guarded
  - next-intl-without-i18n-routing
affects:
  - 01-04-supabase-integration
  - 01-05a-sentry-scrub-helpers
  - 01-05b-sentry-init-configs
  - 01-06-posthog
  - 01-07-diagnostics-routes
  - all-future-phase-3-ui-work
tech-stack:
  added: []
  patterns:
    - sentry-outer-serwist-outer-nextintl-inner-next-config-wrapper
    - headers-on-every-response-via-nextconfig-headers
    - proxy-ts-locale-only-matcher
    - guarded-sentry-config-dynamic-import-with-ts-expect-error
    - next-intl-without-i18n-routing-mode-single-locale
    - webpack-build-override-for-serwist-turbopack-gap
key-files:
  created:
    - next.config.ts
    - public/manifest.webmanifest
    - public/robots.txt
    - src/app/sw.ts
    - src/i18n/routing.ts
    - src/i18n/request.ts
    - src/messages/pt-BR.json
    - src/proxy.ts
    - src/instrumentation.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/not-found.tsx
  modified:
    - package.json
    - tsconfig.json
    - .gitignore
key-decisions:
  - "next.config.ts wrapper order: withSentryConfig(withSerwist(withNextIntl(nextConfig))) — Sentry OUTER, Serwist MIDDLE, NextIntl INNER. Plan said Serwist OUTER / Sentry INNER (which is satisfied — Serwist wraps NextIntl-enriched config; Sentry still wraps everything last)."
  - "Security headers live ONLY in next.config.ts headers() with source '/(.*)'; src/proxy.ts is grep-verified to contain zero security-header strings (user decision 3)."
  - "src/proxy.ts became a pass-through NextResponse.next() because createMiddleware(routing) with localePrefix 'as-needed' and no src/app/[locale]/ segment rewrote / to /pt-BR → 404. Switched to next-intl 'without i18n routing' mode (amannn/next-intl examples/example-app-router-without-i18n-routing). routing.ts config remains committed for future multi-locale plan."
  - "src/instrumentation.ts uses try/catch + @ts-expect-error on await imports of ./sentry.server.config / ./sentry.edge.config — Plan 05b removes both guards and @ts-expect-error comments."
  - "Build script set to 'next build --webpack' because @serwist/next@9.5.7 does not support Next 16 Turbopack (warning confirmed at build time); Turbopack silently skipped the plugin and never emitted public/sw.js. pnpm dev remains on default Turbopack; Serwist is disabled in dev anyway (D-13)."
  - "public/sw.js + public/sw.js.map + public/workbox-*.js added to .gitignore — generated build artifacts."
  - "next-env.d.ts is NOT tracked AND NOT gitignored per CONTEXT.md Action 6 — Next regenerates it on every build; appears as untracked after build."
  - "tsconfig.json jsx flag changed from 'preserve' to 'react-jsx' (mandatory change applied by Next 16 build); include extended with .next/dev/types/**/*.ts (suggested by Next build)."
patterns-established:
  - "Security headers in next.config.ts headers() with source '/(.*)' — applies to every response (pages, API routes, static assets, /manifest.webmanifest, /sw.js, /robots.txt)"
  - "Single-locale app bypasses next-intl middleware entirely — proxy.ts is a no-op, request.ts hardcodes defaultLocale"
  - "Guarded dynamic imports with try/catch + @ts-expect-error for pre-dependent-plan build safety"
requirements-completed:
  - INFRA-01
  - INFRA-18
duration: ~25min
completed: 2026-04-23
---

# Phase 01 Plan 03: Next 16 App Router Skeleton Summary

**Next 16 App Router skeleton with `<html lang="pt-BR">` root layout via next-intl, proxy.ts locale-only (security headers moved to next.config.ts `headers()` with source '/(.*)'), Serwist PWA skeleton, composed `withSentryConfig(withSerwist(withNextIntl(nextConfig)))` build config, guarded Sentry instrumentation hook, 404 page, PWA manifest, robots disallow for diagnostics routes.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-23T23:04:00Z
- **Completed:** 2026-04-23T23:30:00Z
- **Tasks:** 3 executed (4 commits — includes one fix commit for the next-intl routing mode)
- **Files created:** 12
- **Files modified:** 3 (package.json, tsconfig.json, .gitignore)

## Accomplishments

- `pnpm build` succeeds with env stubs. Emits `public/sw.js` (32,499 bytes) via Serwist.
- `GET /` returns 200 with `<html lang="pt-BR">` on response body.
- `GET /nonexistent-page` returns 404 rendered by `src/app/not-found.tsx` with "Página não encontrada".
- `GET /manifest.webmanifest` returns 200 with `display: standalone` + `theme_color: #FFFFFF`.
- `GET /sw.js` returns 200 (Serwist-compiled service worker).
- `GET /robots.txt` returns 200 with `Disallow: /__diag` + `Disallow: /api/v1/_diagnostics/`.
- All 5 security headers (HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy) present on EVERY response — verified on `/`, `/manifest.webmanifest`, `/sw.js`, `/robots.txt` (user decision 3 every-response posture confirmed end-to-end).
- `pnpm typecheck` exits 0.
- 101 unit-test assertions from Plan 01-02 still pass.
- Next 16 proxy convention honored: file is `src/proxy.ts`, default export named `proxy` (grep count = 1); zero `middleware`-named exports.
- `src/proxy.ts` grep-verified to contain NEITHER `Strict-Transport-Security` NOR `Content-Security-Policy` NOR `X-Frame-Options` NOR `Referrer-Policy` NOR `Permissions-Policy` (user decision 3).
- `next.config.ts` composes `withSentryConfig(withSerwist(withNextIntl(nextConfig)))` with `headers()` returning all 5 security headers on `source: "/(.*)"`.

## Task Commits

1. **Task 1: next.config.ts + manifest + robots + sw.ts** — `06054a6` (chore)
2. **Task 2: i18n routing + proxy + instrumentation** — `349eb03` (feat)
3. **Task 3: layout + page + not-found + webpack build flag** — `6341550` (feat)
4. **Fix: next-intl without-i18n-routing mode** — `f3b4a2f` (fix)

**Plan metadata:** pending — this SUMMARY + STATE.md + ROADMAP.md updates land in the final `docs(01-03)` commit.

## Files Created/Modified

### Created

- `next.config.ts` — composed `withSentryConfig(withSerwist(withNextIntl(nextConfig)))` + `headers()` with source `'/(.*)'` declaring HSTS (2y preload), XFO DENY, XCTO nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy minimal.
- `public/manifest.webmanifest` — minimal W3C manifest (D-14): `name`, `short_name`, `display: standalone`, `start_url`, `theme_color`, `background_color`, `lang: pt-BR`. No icons (Phase 3 adds Paper Cream set).
- `public/robots.txt` — `Disallow: /__diag` + `Disallow: /api/v1/_diagnostics/` for defense in depth against crawler discovery of Plan 07 diagnostics routes.
- `src/app/sw.ts` — Serwist 9.5 skeleton. `precacheEntries: self.__SW_MANIFEST ?? []`, `skipWaiting: true`, `clientsClaim: true`, `navigationPreload: false`. No runtime caching, no offline fallback (D-13 — Phase 3 extends).
- `src/i18n/routing.ts` — `defineRouting({ locales: ["pt-BR"], defaultLocale: "pt-BR", localePrefix: "as-needed" })` (D-15).
- `src/i18n/request.ts` — `getRequestConfig(async () => ({ locale: routing.defaultLocale, messages: ... }))`. Hardcoded default locale; no `requestLocale` dereference (see Deviation 4).
- `src/messages/pt-BR.json` — empty skeleton `{}` (Phase 3 fills with design-system copy).
- `src/proxy.ts` — pass-through `NextResponse.next()` with matcher `"/((?!api|_next|_vercel|.*\\..*).*)"`. LOCALE ONLY scope (plan intent), but the next-intl middleware is intentionally NOT invoked (see Deviation 4). Zero security-header strings (user decision 3).
- `src/instrumentation.ts` — Next 16 register hook. Dynamically imports `./sentry.server.config` (nodejs runtime) / `./sentry.edge.config` (edge runtime), each wrapped in `try/catch` + `@ts-expect-error` because both files ship in Plan 05b. Exports `onRequestError = Sentry.captureRequestError`.
- `src/app/layout.tsx` — async server component, fetches `locale` + `messages` via next-intl server helpers, renders `<html lang={locale}>` with `<link rel="manifest" href="/manifest.webmanifest">`, wraps children in `NextIntlClientProvider`. `metadata.title = "Folhário"`, `metadata.description = "Identifique, catalogue e cuide das suas plantas."`
- `src/app/page.tsx` — minimal `<main><h1>Folhário</h1></main>`. Returns 200 unconditionally. Plan 01-01's `playwright.config.ts` probes `/` via webServer startup check.
- `src/app/not-found.tsx` — `<main><h1>404</h1><p>Página não encontrada</p></main>`. Phase 3 replaces with design-system 404.

### Modified

- `package.json` — `"build": "next build"` → `"build": "next build --webpack"`. Dev script unchanged (`next dev` stays on Turbopack).
- `tsconfig.json` — `jsx: "preserve"` → `jsx: "react-jsx"` (mandatory change applied by Next 16 build for App Router automatic runtime); `include` extended with `.next/dev/types/**/*.ts` (suggested by build). Formatting widened by Prettier via lint-staged (no semantic change).
- `.gitignore` — added `public/sw.js`, `public/sw.js.map`, `public/swe-worker-*.js`, `public/workbox-*.js` (Serwist build outputs). `next-env.d.ts` intentionally NOT added per CONTEXT.md Action 6.

## Decisions Made

See `key-decisions` in frontmatter. Each decision is grep-anchored to either the acceptance criteria in the plan or the verify-time smoke test output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] `@ts-expect-error` added to `src/instrumentation.ts` guarded imports**
- **Found during:** Task 2 (instrumentation.ts creation — `pnpm typecheck` ran as part of task verification)
- **Issue:** `try/catch` alone does not satisfy TypeScript's static module resolution; `await import("./sentry.server.config")` fails TS2307 ("Cannot find module") because Plan 05b creates those files in a later wave.
- **Fix:** Added `// @ts-expect-error Plan 05b creates ./sentry.<runtime>.config; guard removed then.` on each dynamic import line. This both silences the static error today and flips into an "unused expect-error" diagnostic once Plan 05b lands — that diagnostic cues Plan 05b to remove both the comment AND the surrounding try/catch.
- **Files modified:** `src/instrumentation.ts`
- **Verification:** `pnpm typecheck` exits 0 (verified)
- **Committed in:** `349eb03` (Task 2 commit)

**2. [Rule 3 - Blocker] Added `createNextIntlPlugin` to `next.config.ts`**
- **Found during:** Task 3 (`pnpm build` in verify step)
- **Issue:** Plan's next.config.ts did not wrap with `createNextIntlPlugin`. Without it, next-intl server helpers (`getLocale()`, `getMessages()`) cannot discover `src/i18n/request.ts` at render time. Build errored with: `Error: Couldn't find next-intl config file. Please follow the instructions at https://next-intl.dev/docs/getting-started/app-router`.
- **Fix:** Added `import createNextIntlPlugin from "next-intl/plugin"` and `const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")`. Composed as innermost wrapper: `withSentryConfig(withSerwist(withNextIntl(nextConfig)))`. This still satisfies the plan's "Serwist OUTER / Sentry INNER" intent (Serwist still wraps NextIntl-enriched config; Sentry still wraps the whole thing).
- **Files modified:** `next.config.ts`
- **Verification:** `pnpm build` completes; `/` renders with `<html lang="pt-BR">`.
- **Committed in:** `6341550` (Task 3 commit)

**3. [Rule 3 - Blocker] Switched build script to `next build --webpack`**
- **Found during:** Task 3 (`pnpm build` in verify step — after fixing deviation 2)
- **Issue:** Next 16 defaults to Turbopack. `@serwist/next@9.5.7` does not support Turbopack (upstream confirmed: https://github.com/serwist/serwist/issues/54). Build printed the upstream warning and silently skipped the Serwist plugin; `public/sw.js` was NEVER emitted. Plan acceptance criterion `test -f public/sw.js` failed post-build.
- **Fix:** Changed `"build": "next build"` to `"build": "next build --webpack"` in `package.json`. Kept `"dev": "next dev"` (default Turbopack) — Serwist is intentionally disabled in dev per D-13, so the dev-mode Turbopack gap has no functional impact. Added `public/sw.js` + `public/sw.js.map` + `public/workbox-*.js` to `.gitignore` (generated artifacts).
- **Files modified:** `package.json`, `.gitignore`
- **Verification:** `pnpm build` emits `public/sw.js` (32,499 bytes); `GET /sw.js` returns 200 with Serwist-generated service worker source.
- **Committed in:** `6341550` (Task 3 commit)

**4. [Rule 3 - Blocker] Switched to next-intl "without i18n routing" mode**
- **Found during:** Task 3 smoke test (after deviations 2 + 3 applied) — `GET /` returned 404.
- **Issue:** `createMiddleware(routing)` with `localePrefix: "as-needed"` expects an `src/app/[locale]/` dynamic segment to receive the rewritten request. With Phase 1's root-level `src/app/page.tsx` (no `[locale]` segment — plan explicitly placed pages at root so Playwright's `webServer.url: "http://localhost:3000/"` probe works and root-level `not-found.tsx` catches global 404s), the middleware rewrote `/` → `/pt-BR`, which had no matching route handler, returning 404.
- **Fix options considered:**
  - (A) Move pages under `src/app/[locale]/` — breaks Playwright probe (would now 307 at `/`) AND breaks root-level `not-found.tsx` (App Router global 404 would need to move too, with side effects for non-locale routes).
  - (B) Drop `createMiddleware` invocation, hardcode the locale in `getRequestConfig`. This is next-intl's documented "without i18n routing" mode (example: `amannn/next-intl examples/example-app-router-without-i18n-routing`).
  - Chose **B**. Phase 1 ships pt-BR only (D-15); the `[locale]` segment structure matters only when a second locale lands.
- **Fix:** `src/proxy.ts` dropped `createMiddleware` / `routing` import and became `export default function proxy(_request: NextRequest) { return NextResponse.next(); }`. `src/i18n/request.ts` stopped dereferencing `requestLocale` and hardcoded `locale = routing.defaultLocale`.
- **Plan intent miss:** Plan's `key_link` `src/proxy.ts → @i18n/routing via import { routing } from "@i18n/routing"` is NO LONGER SATISFIED. `src/i18n/routing.ts` remains committed for the future multi-locale plan that will add `src/app/[locale]/` and reinstate the middleware invocation.
- **Files modified:** `src/proxy.ts`, `src/i18n/request.ts`
- **Verification:** Full smoke-test post-fix: `GET /` → 200, `GET /nonexistent-page` → 404 via `not-found.tsx`, `<html lang="pt-BR">` rendered, all 5 security headers present on `/`, `/manifest.webmanifest`, `/sw.js`, `/robots.txt`.
- **Committed in:** `f3b4a2f` (dedicated fix commit — separate from Task 3 because the failure was observed AFTER Task 3's build-gate commit landed)

**5. [Rule 2 - Missing Critical] `tsconfig.json` `jsx` flag changed to `react-jsx`**
- **Found during:** Task 3 (`pnpm build`)
- **Issue:** Next 16 App Router requires `jsx: "react-jsx"` (automatic runtime). The seed value was `jsx: "preserve"` (from Plan 01-01). Next build output explicitly labeled this as "mandatory changes were made to your tsconfig.json" and wrote them in-place.
- **Fix:** Accepted the build-applied change. Also kept the suggested `include` addition `.next/dev/types/**/*.ts`.
- **Files modified:** `tsconfig.json`
- **Verification:** `pnpm typecheck` exits 0 before and after the change.
- **Committed in:** `6341550` (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (4 Rule 3 blockers, 1 Rule 2 missing critical)
**Impact on plan:** All five fixes are correctness-required for the plan's stated acceptance criteria to pass. Deviation 4 is the most consequential — it intentionally violates one of the plan's `key_links` (`src/proxy.ts → @i18n/routing`) in favor of a `pnpm start` smoke test that passes. The routing config remains on disk for the future multi-locale plan to consume without rework. No scope creep; all fixes were reactive to failures surfaced by plan-prescribed verify commands.

### Authentication Gates

None.

## Issues Encountered

- Sentry Next.js plugin printed a non-blocking warning at build time: "It seems like you don't have a global error handler set up. It is recommended that you add a 'global-error.js' file with Sentry instrumentation". Phase 3 (Design System) owns `global-error.tsx`; Phase 1 intentionally skips it (no user-facing surface yet). Suppress via `SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING=1` in CI if desired, but leaving the warning visible for now as a reminder.
- Serwist Turbopack-gap warning prints on every `pnpm build`: "You are using '@serwist/next' with `next dev --turbopack`...". Benign (we switched to `next build --webpack`); upstream issue tracked at https://github.com/serwist/serwist/issues/54.

## User Setup Required

None — no external service configuration required by Plan 01-03.

## Known Stubs

**Intentional Phase 1 placeholders (not bugs):**

- `src/messages/pt-BR.json` is `{}` — empty. Phase 3 (Design System) fills with real copy tied to the design-system component library. Empty is the correct state at Phase 1 because no UI strings exist to translate yet.
- `src/app/page.tsx` is a trivial `<h1>Folhário</h1>` placeholder. Phase 3 rewrites with the Paper Cream landing. The minimum surface needed to satisfy the Playwright `webServer` probe (URL `/` returns 200).
- `src/app/not-found.tsx` is a trivial `<h1>404</h1><p>Página não encontrada</p>`. Phase 3 replaces with design-system 404.
- `public/manifest.webmanifest` has no icons (D-14 explicit). Lighthouse will warn; Phase 3's Paper Cream icon set fixes it.

## Threat Flags

All five threats from the plan's `<threat_model>` remain correctly mitigated:

- **T-03-01 (T-5):** Security headers on every response — verified via smoke test on `/`, `/manifest.webmanifest`, `/sw.js`, `/robots.txt`.
- **T-03-02 (T-4):** SW scoped to `/` (same-origin), disabled in dev, no precache entries. Verified in `src/app/sw.ts` skeleton.
- **T-03-03:** Proxy matcher `"/((?!api|_next|_vercel|.*\\..*).*)"` excludes `/api/*` — verified. (Post-fix the matcher is now decorative since proxy is a no-op, but the exclusion pattern is preserved for the future multi-locale re-enable.)
- **T-03-04:** `public/robots.txt` disallows `/__diag` + `/api/v1/_diagnostics/`.
- **T-03-05:** `grep -c "Strict-Transport-Security" src/proxy.ts` returns 0; symmetric grep against `next.config.ts` returns 1. Acceptance criteria enforced at CI.

No new threat surface introduced beyond the plan's threat model.

## Next Phase Readiness

**Ready for Wave 3 (Plans 01-05a + 01-06):**
- `src/instrumentation.ts` exists with guarded Sentry config imports — Plan 05b removes the guards AND the `@ts-expect-error` comments when it creates `src/sentry.server.config.ts` / `src/sentry.edge.config.ts`.
- `src/app/layout.tsx` server layout is ready for Plan 06 to wrap children with `<PostHogProvider>` (client component).
- `src/shared/config/client-env.ts` (from Plan 01-02) is untouched and ready for Plan 06's `posthog-client.ts` imports.

**Ready for Wave 2 sibling (Plan 01-04):** This plan has no file overlap with Plan 01-04 (Supabase integration). The `tsconfig.json` change is isolated to the compiler options; it will not conflict with Plan 01-04's additions.

**Ready for Wave 5 (Plan 01-07):**
- `src/app/__diag/*` will be added by Plan 07; `public/robots.txt` already disallows it.
- `src/app/api/v1/_diagnostics/ping/route.ts` will be added by Plan 07; `public/robots.txt` already disallows `/api/v1/_diagnostics/`.

**Ready for Phase 3 (Design System):**
- Rewrites `src/app/page.tsx`, `src/app/not-found.tsx`, fills `src/messages/pt-BR.json`, adds Paper Cream icons to `public/manifest.webmanifest`, ships `global-error.tsx`.

**Ready for future multi-locale plan (post-MVP):**
- `src/i18n/routing.ts` config is preserved.
- Migration path: (1) move pages under `src/app/[locale]/`, (2) restore `createMiddleware(routing)` call in `src/proxy.ts`, (3) update `src/i18n/request.ts` to dereference `requestLocale` again, (4) update `playwright.config.ts` probe URL if needed.

## Self-Check

Files created verified against disk:

- `next.config.ts` — FOUND, contains `withSentryConfig`, `withSerwist`, `withNextIntl`, `async headers`, `source: "/(.*)"`, all 5 security headers
- `public/manifest.webmanifest` — FOUND, contains `"display": "standalone"`
- `public/robots.txt` — FOUND, contains `Disallow: /__diag`
- `src/app/sw.ts` — FOUND, contains `new Serwist(`
- `src/i18n/routing.ts` — FOUND
- `src/i18n/request.ts` — FOUND, contains `getRequestConfig`
- `src/messages/pt-BR.json` — FOUND
- `src/proxy.ts` — FOUND, default export `proxy` (grep count 1), NO security-header strings, NO `middleware` export
- `src/instrumentation.ts` — FOUND, contains `onRequestError`
- `src/app/layout.tsx` — FOUND, contains `lang={locale}`, `NextIntlClientProvider`, `/manifest.webmanifest`
- `src/app/page.tsx` — FOUND
- `src/app/not-found.tsx` — FOUND

Build-generated files (gitignored):
- `public/sw.js` — FOUND (32,499 bytes)
- `public/sw.js.map` — FOUND
- `next-env.d.ts` — FOUND (auto-generated; NOT tracked, NOT gitignored per CONTEXT.md Action 6)

Commits verified present in `git log`:
- `06054a6` (Task 1)
- `349eb03` (Task 2)
- `6341550` (Task 3)
- `f3b4a2f` (fix: without-i18n-routing mode)

Smoke test:
- `GET /` → HTTP 200 with `<html lang="pt-BR">`
- `GET /nonexistent-page` → HTTP 404 with "Página não encontrada"
- `GET /manifest.webmanifest` → HTTP 200
- `GET /sw.js` → HTTP 200
- `GET /robots.txt` → HTTP 200
- All 5 security headers present on every checked path

Type + unit tests:
- `pnpm typecheck` exits 0
- `pnpm exec vitest run --project=unit` — 5 files / 101 assertions pass

## Self-Check: PASSED

---
*Phase: 01-foundation*
*Completed: 2026-04-23*
