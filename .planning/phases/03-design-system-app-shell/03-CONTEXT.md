# Phase 3: Design System & App Shell - Context

**Gathered:** 2026-04-26 (power mode)
**Status:** Ready for planning
**Source:** Synthesized from answered `.planning/phases/03-design-system-app-shell/03-QUESTIONS.json` (35/35 answered)

<domain>
## Phase Boundary

Phase 3 ships the design-system foundation and app shell so every later feature phase composes screens into already-finished chrome:

- Tailwind v4 + token system (CSS custom properties + JS mirror) implementing PRD §17 Paper Cream / Night Cream palettes, Source Serif 4 + Plus Jakarta Sans typography via `next/font`, and Lucide icons.
- Dark mode wired end-to-end with flash-free system preference by CSS media query plus cookie-based manual override; manual override surfaced on the Phase 3 Profile placeholder tab (Phase 4 relocates into Settings → Account).
- Bottom-nav (4 items: Home / Catálogo / Identificar / Perfil) on a `(app)` layout group with per-tab scroll preservation and route-change focus management in a client app-shell component.
- Composed primitives consumable by every later phase: buttons (4 variants), inputs (TextInput / Select / Toggle), modal sheet (Radix Dialog), toast system (sonner), skeleton + shimmer with 300ms gate, empty state composer, inline calm error, app-update toast, persistent offline banner, read-only banner, discard-summary toast surface, capture button + breathing loop.
- Motion system using `motion` (Framer Motion v12+) reading shared spring constants; reduced-motion enforced via hook + Tailwind variant + custom ESLint rule.
- PWA contract: full icon set generated from a single SVG via `pwa-asset-generator`, dual `theme-color` meta per scheme, app-shell offline-first service worker (StaleWhileRevalidate static + NetworkOnly `/api/*`), `/offline` page composed of empty-state primitive, app-update toast wired to Serwist `onWaiting`/`onUpdated` events.
- Placeholder pages: 4 nav-tab routes (`/`, `/catalog`, `/identify`, `/profile`) + `/offline`, each demonstrating composed primitives.
- next-intl message file populated with ~30–50 pt-BR keys covering Phase 3 placeholders + design-system labels under nested `screen.component.key` namespacing.
- Quality gates: Stylelint + ESLint + Vitest enforcement of PRD §17 banned patterns; `@axe-core/playwright` contrast gate; Playwright snapshot tests for visual regression across both themes and both motion preferences.

**Explicitly not in scope:**

- Real auth screens, signup form composition, Settings shell — Phase 4.
- Manual theme override final surface (lives temporarily on the Profile placeholder in Phase 3; Phase 4 moves it into Settings → Account).
- Feature-specific composed primitives: confidence ladder (Phase 6), toxicity badge (Phase 7), plant card (Phase 5), care card section (Phase 7), "Gerado por IA" + "Cap atingido" chips (Phase 7 / 6).
- Subscription state machine and read-only mode wiring — Phase 10 (banner ships in Phase 3 as a prop-driven component, defaults to false everywhere).
- Offline action queue — Phase 9. Phase 3 ships the toast primitive plus a prop/function-driven discard-summary toast surface to satisfy UI-24; Phase 9 wires it to the real queue outcome.
- CSP — explicitly deferred (D-23 Phase 1).
- Storybook / external visual-QA SaaS (Chromatic / Percy) — kept out of MVP.
- Custom PWA install prompt — browser default only.

</domain>

<decisions>
## Implementation Decisions

### Styling Architecture

- **D-01:** CSS framework is **Tailwind CSS v4** with `@tailwindcss/postcss`. Token-heavy PRD §17 spec maps to `@theme` directive; banned-patterns map to `eslint-plugin-tailwindcss` + `stylelint` rules.
- **D-02:** Token storage is **CSS custom properties in `globals.css`** (`:root` for light default, `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ... } }` for auto dark, `[data-theme=light|dark]` for manual overrides) **plus a JS mirror at `src/shared/theme/tokens.ts`** re-exporting the same values for motion library + JS consumers. Single source of truth via shared constants.
- **D-03:** Theme resolution is **CSS-first for `auto`, attribute-based for manual overrides**. When no manual override is stored, `<html>` omits `data-theme` and CSS token blocks use `@media (prefers-color-scheme: dark)` for a flash-free system-preference first paint. Manual overrides set `<html data-theme="light|dark">`; Tailwind v4 dark utilities must target both `[data-theme=dark]` and the media-query auto path where needed. Framework-agnostic and avoids an inline bootstrap script.

### Typography & Iconography

- **D-04:** Fonts loaded via **`next/font/google` with subsetting `['latin', 'latin-ext']`** for Source Serif 4 + Plus Jakarta Sans. Auto self-hosting; `font-display: swap`; variable axes exposed via weight ranges. Service worker caches statically.
- **D-05:** Lucide icons via **`lucide-react`** package. Per-icon imports tree-shake; `strokeWidth={1.5}` per spec; sizes 18/20/24/28px.

### Motion System

- **D-06:** Motion library is **`motion` (Framer Motion v12+, rebranded 2025)**. First-class spring physics matching PRD params (stiffness 120 / damping 18 / mass 1), `useReducedMotion` hook, `LayoutGroup` for shared layouts.
- **D-07:** Spring constants live in **`src/shared/motion/springs.ts`** as named exports: `springs.primary` (button press / sheet reveal / tab switch), `springs.captureBounce` (1.00→1.03→1.00), `springs.breathing` (1.00→1.02 over 3.2s ease-in-out, infinite). Consumed via `transition={springs.primary}`.
- **D-08:** Reduced-motion enforcement is distributed across three layers: **`useReducedMotion()` hook** for `motion` runtime + **Tailwind `motion-reduce:` variant** for CSS-only animations + **custom ESLint rule** warning on `@keyframes` declarations without paired `motion-reduce` fallback. Catches both runtime and CSS regressions.
- **D-09:** Route transitions are **static — no animation between routes; instant content swap + programmatic focus move**. Bottom-nav active indicator slides via CSS `transform`/`opacity` only. Predictable, accessible, no spec-creep risk; can be retrofitted with View Transitions API later if MVP feels jumpy.

### Component Primitives Library

- **D-10:** Headless component primitives library is **Radix UI** (`@radix-ui/react-dialog` for modal sheet, `@radix-ui/react-toast`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`). Headless, fully a11y; tree-shakes per primitive.
- **D-11:** Toast / banner system is **`sonner`** (~3kB). Supports persistent + dismissible toasts, motion-friendly, headless customization. Used by app-update toast (OFF-10), error toasts, and the Phase 3 discard-summary toast surface that Phase 9 wires to real queue outcomes.

### Theme & Dark Mode

- **D-12:** Dark mode toggle uses **cookie `folhario_theme=auto|light|dark`** read in root layout. `light`/`dark` set `<html data-theme="light|dark">` SSR-side; `auto` (and no cookie) omits `data-theme` so CSS `prefers-color-scheme` token blocks resolve the first paint. Phase 3 writes the cookie via a Server Action invoked from the Profile placeholder; Phase 4 moves the control to Settings → Account. Zero flash, edge-runtime compatible, CSP-friendly (no inline script).
- **D-13:** Phase 3 surfaces the manual theme toggle on the **Profile placeholder tab** using the design-system `Toggle` primitive. Phase 4 relocates it into Settings → Account.

### PWA & Service Worker

- **D-14:** Service worker offline strategy is **app-shell offline-first**: HTML + JS + CSS precached, **StaleWhileRevalidate** for static assets, **NetworkOnly** for `/api/*`. Catalog data caching is Phase 5+ scope; Phase 3's SW stops at the app-shell boundary.
- **D-15:** Offline fallback page is **`/offline`** — a static page composed of the empty-state primitive (Sage line-art illustration + Source Serif headline + Calm Slate hint + Canopy "Tentar novamente" CTA). Served by the SW navigation handler when offline and target route is uncached. Doubles as design-system showcase.
- **D-16:** App-update toast trigger uses **Serwist registration events (`onWaiting` / `onUpdated`) → emit custom DOM event → toast component subscribes**. Decoupled SW lifecycle from React UI. Phase 3 must change the current SW posture from `skipWaiting: true` / `clientsClaim: true` to a user-controlled waiting flow: a waiting worker stays pending, the toast lives in `(app)` layout group, `skipWaiting` is messaged only on tap, and the page reloads after the updated worker controls the client. Never auto-reload mid-session; reduced-motion fallback (instant fade).
- **D-17:** PWA icon set generated by **`pwa-asset-generator`** from a single SVG source. Reproducible via `pnpm icons:generate` script; outputs committed; CI never re-runs. Founder updates SVG → regenerate set.
- **D-18:** Manifest theme color uses **two `<meta name="theme-color" media="(prefers-color-scheme: …)">` tags**: Paper Cream `#FBF7EF` (light), Night Cream `#1A1613` (dark). Manifest `theme_color` = light value as fallback. Supersedes Phase 1's `#FFFFFF` placeholder (which violated PRD §17).
- **D-19:** PWA install prompt uses **browser default only — no custom prompt in Phase 3**. Custom button revisited in Phase 4 onboarding if conversion data warrants.

### Layout & Navigation

- **D-20:** App-shell container is **a single root `<div>` with `max-width: 480px`, centered, `min-h-[100dvh]`**. Phone-style centered; matches mobile-first ethos. Side fill = same Paper Cream / Night Cream surface (Claude's discretion — locked by "Folhário is ONE shape across devices").
- **D-21:** Bottom-nav routing is **single `(app)` layout + manual `scrollY` save/restore via `sessionStorage` in `useLayoutEffect`**. The existing `src/app/page.tsx` root route must be moved into `src/app/(app)/page.tsx` (or deleted after replacement) so `/` is owned by the `(app)` route group and does not conflict with a parallel root page. Simplest; works with App Router defaults; debounced scroll handler keyed by pathname.
- **D-22:** App shell layout group structure: **root layout has `<html>` + providers + SSR theme attribute/media-compatible classes only**; **route group `(app)` has the client app-shell component with bottom nav, banners, toasts, scroll restoration, and focus management**; **route group `(auth)` has bare shell** (Phase 4 owns; bottom-nav hidden for unverified-email blocker + signup/login).
- **D-23:** Per-tab scroll preservation: **save `scrollY` to `sessionStorage` keyed by pathname** on every scroll (debounced ~150ms); **restore on tab change in `useLayoutEffect`**. Survives navigation; resets on session.
- **D-24:** Focus management on route change: **`usePathname` listener in `(app)` layout calls `mainRef.current?.focus()`** on every change; **`<main tabIndex={-1} aria-label="Conteúdo principal">`** wrapper makes `<main>` programmatically focusable without entering tab order.

### Phase 3 Composed Primitives

- **D-25:** Phase 3 ships these composed primitives (12): **Buttons** (Primary / Secondary / Tertiary / Destructive), **Inputs** (TextInput / Select / Toggle with §17 validate-on-blur + autocomplete contract), **Modal sheet** (Radix Dialog wrapper with focus trap + scrim + drag handle + return-focus), **Toast / banner system** (sonner), **Skeleton / shimmer** (300ms gate + 120ms fade + reduced-motion fallback), **Empty state composer** (line-art + serif headline + slate hint + Canopy CTA), **Inline calm error** (cause + recovery + retry path), **App-update toast** (OFF-10), **Persistent offline banner** (UI-24), **Read-only banner** (UI-24, prop-driven, inactive by default), **Discard-summary toast surface** (UI-24, helper only; queue wiring Phase 9), **Capture button + breathing loop** (PRD §17 circular 72px primitive + 3.2s 1.00→1.02 loop — SC-3 explicitly demands the breathing loop in Phase 3 even though Phase 6 wires camera capture). Cards (generic Warm Ivory base) and confidence ladder / toxicity badge / plant card / care card / chips defer to their owning feature phases.
- **D-26:** Placeholder pages: **4 nav-tab routes (`/`, `/catalog`, `/identify`, `/profile`) showing thin placeholder empty states + bottom-nav routing between them + `/offline` page**. Exercises bottom-nav, empty-state primitive, route-change focus, persistent offline banner. Phase 5+ replaces individual tab content; Phase 3's placeholders demonstrate the design contract end-to-end.
- **D-27:** Skeleton primitive is **bespoke `<Skeleton>` + `<SkeletonGroup delay={300}>` with CSS keyframes + Tailwind `motion-reduce:` variant** (~80 LOC). Full design control; matches PRD §17 spec exactly (1.4s left-to-right shimmer; static block + 80ms fade under reduced motion; 300ms gate via JS).

### i18n & Locale

- **D-28:** i18n message file structure is **nested by screen + component** (`home.empty.title`, `nav.tabs.catalog`, `app.update.toast.label`). `next-intl` `useTranslations('home.empty')` namespacing works naturally.
- **D-29:** Phase 3 translation depth is **full pt-BR strings for placeholders + design-system labels (~30–50 keys)**: nav labels, empty-state copy per tab, app-update toast, offline banner, default error messages, focus-visible labels, theme toggle copy. Establishes the pattern; future phases extend.

### Banners & State

- **D-30:** Offline banner detection uses **`useOnlineStatus` hook combining `navigator.onLine` + window `online`/`offline` events + periodic `/api/v1/health/connectivity` heartbeat (~30s, backs off when offline)**. Phase 3 adds this public, side-effect-free `GET` route returning `{ ok: true, timestamp }` with `Cache-Control: no-store`; do not use `/api/v1/diagnostics/ping`, because that endpoint is CI/stub-mode gated and can return 404 in production. Reliable across browsers and PWA edge cases including captive portals.
- **D-31:** Read-only banner ships in Phase 3 as a **prop-driven component** (`<ReadOnlyBanner active={false} />`) with the `false` flag wired everywhere. Phase 10 wires real subscription state into the prop.
- **D-31a:** Discard-summary toast ships in Phase 3 as a **prop/function-driven toast helper** with pt-BR copy and design-system styling, but no queue integration. Phase 9 invokes it after offline queue sync/discard outcomes. This keeps UI-24 covered without pulling the offline queue into Phase 3.

### Quality & Enforcement

- **D-32:** Banned-pattern enforcement is distributed and wired into commands: **Stylelint with custom rules** (color/typography/animation patterns) **+ ESLint custom rule** (emoji + banned imports like Inter / Times / Georgia / generic serifs) **+ Vitest snapshot rule** (cross-cutting font + token presence checks). Phase 3 adds `pnpm lint:styles`, includes it in the CI verification path, and extends `lint-staged` so CSS files run Stylelint while TS/TSX files run ESLint. CI runs the full suite.
- **D-33:** Color contrast verification uses **`@axe-core/playwright`** running against placeholder pages **in both themes and both motion preferences**, gating CI on violations. Catches actual rendered contrast in real browser; Phase 1 already runs Playwright in CI.
- **D-34:** Visual regression testing uses **Playwright snapshot tests** for placeholder pages, **both themes, both motion preferences**. Local screenshots committed; CI compares. Date/time portions of formatted strings masked.

### Brand Assets

- **D-35:** Brand assets sourcing: **founder provides SVG logo + 4–6 line-art illustrations before Phase 3 final review**; placeholder SVGs ship if not delivered (empty-state primitive structure ships either way; illustration swap is trivial because illustrations are inline SVG with `currentColor`).

### Claude's Discretion

- **ScientificName component shape** — PRD §17 locks the markup (`<i lang="la">`) and styling (italic Plus Jakarta Sans 14 Calm/Lantern Slate). Component lives at `src/shared/typography/scientific-name.tsx`; first consumed by Phase 5/6.
- **Locale formatter module** — `src/shared/i18n/format.ts` exporting `formatCurrencyBRL`, `formatDate`, `formatTime`, `formatDateTime` via `Intl.*` with pt-BR locale + `User.timezone` injection point. `date-fns-tz` used per CLAUDE.md for server-rendered user-local times only.
- **Sage line-art SVG implementation** — inline SVG components with `currentColor` + `stroke-width: 1.5px`. Theme-aware via CSS color variable (only theme-aware route).
- **Desktop side-fill background** — same Paper Cream / Night Cream as the container. Invisible boundary; locked by "Folhário is ONE shape across devices" from PRD §17.
- Exact CSS class naming inside Tailwind utilities, exact debounce timing on scroll save/restore (50–250ms range), exact heartbeat interval (15–60s range).
- Exact PWA icon sizes generated beyond the required 192/512/180/maskable/monochrome/favicon set.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and scope

- `docs/CAVE-PRD.md` §16 — Screens (Home, Identify, Catalog, Plant Profile, Care Guide, Reminders, Photo Journal, ID History, Settings, cross-cutting states, app-update toast).
- `docs/CAVE-PRD.md` §17 — Design System (atmosphere, color tokens light + dark, confidence ladder, accent discipline, typography, iconography, buttons, cards & containers, modal sheet, inputs/forms, toxicity badge composition, confidence result card, notification chips, bottom navigation, loading states, empty states, error states, layout, motion, safe areas + responsive, banned patterns).
- `docs/CAVE-PRD.md` §18 — Accessibility (color-never-sole-signal rules, image alt text, screen reader announcements, modals, native a11y, haptics).
- `.planning/PROJECT.md` — Vision, constraints, key decisions, launch blockers.
- `.planning/ROADMAP.md` §Phase 3 — Phase 3 goal + 5 success criteria.
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, UI-03, UI-14, UI-17, UI-18, UI-19, UI-20, UI-21, UI-22, UI-23, UI-24, UI-25, OFF-09, OFF-10.

### Prior phase patterns

- `.planning/phases/01-foundation/01-CONTEXT.md` — D-13 Serwist skeleton-only (Phase 3 must finish offline strategy); D-14 manifest placeholder (Phase 3 rewrites with brand assets); D-15 next-intl as-needed prefix; D-22 Sentry scrub posture; D-29 env split.
- `.planning/phases/01-foundation/01-03-PLAN.md` + `01-03-SUMMARY.md` — Next config wrapper composition (`withSentryConfig(withSerwist(withNextIntl(nextConfig)))`); Webpack build mandate (Serwist 9.5.7 doesn't support Turbopack); next-intl "without i18n routing" mode (`src/proxy.ts` is no-op pass-through).
- `.planning/phases/01-foundation/01-07-SUMMARY.md` — Next App Router silently excludes route segments starting with `_` (informs `/diag` + `/api/v1/diagnostics/*` naming; Phase 3's `/offline` route is plain).
- `.planning/phases/02-data-layer/02-CONTEXT.md` — API conventions inform the public connectivity heartbeat route used by `useOnlineStatus`.

### Stack lock-in

- `CLAUDE.md` — Next 16.2.3, React 19.2.5, next-intl 4.9.1, Serwist 9.5.7. Bottom-nav only (max 5 tabs, MVP uses 4). pt-BR only at launch. `<html lang="pt-BR">`. `date-fns-tz` for server-rendered user-local times. Banned: Inter, generic serifs, gradient text, glassmorphism, neumorphism, pure black/white.

### Current code anchors

- `src/app/layout.tsx` — Root layout (next-intl provider + PostHog provider + manifest link); Phase 3 must add `folhario_theme` cookie reader, manual-override `data-theme` handling, font loader, locale-aware `<html lang>`.
- `src/app/page.tsx` — Placeholder Home; Phase 3 moves/replaces it as `src/app/(app)/page.tsx` so `/` is owned by the app-shell route group.
- `src/app/globals.css` — Empty; Phase 3 populates with light `:root`, auto dark `@media (prefers-color-scheme: dark)` token blocks, manual `[data-theme=light|dark]` override blocks, and Tailwind v4 `@theme` declaration.
- `src/app/sw.ts` — Skeleton precache-only Serwist currently auto-activates with `skipWaiting: true`; Phase 3 must switch to user-controlled update activation, then add StaleWhileRevalidate + NetworkOnly + offline navigation handler serving `/offline`.
- `src/app/posthog-provider.tsx` — Client component; Phase 3 leaves as-is.
- `src/proxy.ts` — Locale routing only (no security headers); Phase 3 may extend with theme cookie passthrough if Server Action approach requires it.
- `src/i18n/routing.ts` + `src/i18n/request.ts` — next-intl routing config (`as-needed` prefix, pt-BR default); Phase 3 leaves topology as-is, only loads real `pt-BR.json` content.
- `src/messages/pt-BR.json` — Currently `{}`; Phase 3 populates with ~30–50 nested keys.
- `public/manifest.webmanifest` — Phase 3 rewrites with full icon set + correct theme color (currently `#FFFFFF`, violates PRD §17).
- `next.config.ts` — Already wired for Serwist + Sentry + next-intl; Phase 3 may extend `headers()` for additional cache-control rules but must NOT add CSP (deferred per Phase 1 D-23).
- `package.json` — Phase 3 adds: `tailwindcss@4`, `@tailwindcss/postcss`, `postcss`, `autoprefixer`, `lucide-react`, `motion`, `@radix-ui/react-dialog`, `@radix-ui/react-toast` (or rely on sonner), `@radix-ui/react-tabs`, `@radix-ui/react-dropdown-menu`, `sonner`, `@axe-core/playwright`, `stylelint` + plugins, `pwa-asset-generator` (devDep). Also adds `lint:styles`, `icons:generate`, and lint-staged entries for CSS. Pin live versions at planning time.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/app/layout.tsx`** — Already wires `NextIntlClientProvider` + `PostHogProvider` + manifest link. Phase 3 extends without rewriting: read `folhario_theme` cookie server-side, set `<html data-theme>` only for manual `light`/`dark`, leave it unset for `auto`, set `<html lang={locale}>`, mount font loader from `next/font`, and leave app chrome to the `(app)` group.
- **`src/app/sw.ts`** — Serwist skeleton with `precacheEntries: self.__SW_MANIFEST` and current auto-activation. Phase 3 first removes auto-activation semantics for update-to-toast correctness, then layers runtime routes on top via `serwist.registerRoute(...)`: StaleWhileRevalidate for `/_next/static/*` + image assets; NetworkOnly for `/api/*`; navigation handler serving `/offline` on uncached navigation when offline.
- **`src/i18n/request.ts`** + **`src/i18n/routing.ts`** — next-intl wired in "without i18n routing" mode. Phase 3 reuses verbatim; only the `pt-BR.json` file changes from `{}` to populated.
- **`/api/v1/diagnostics/ping`** route (Phase 1) — CI/stub diagnostics only; do not use for production online detection because it can intentionally return 404. Phase 3 adds `/api/v1/health/connectivity` for the `useOnlineStatus` heartbeat.
- **`src/shared/config/errors.ts`** — closed error registry; Phase 3 inline-error component reads error codes from here when surfacing API failures.
- **`next.config.ts`** — Security headers `source: "/(.*)"` already covers Phase 3's new routes; no header changes needed.

### Established Patterns

- **No `@/*` alias** — only `@contexts/*` and `@shared/*` (D-07 Phase 1). Phase 3 places primitives under `src/shared/ui/` (not `src/components/`); typography helpers under `src/shared/typography/`; motion under `src/shared/motion/`; theme tokens under `src/shared/theme/`; i18n utilities under `src/shared/i18n/`.
- **No barrel files** — direct imports only (D-08 Phase 1). Phase 3 must not introduce `src/shared/ui/index.ts` re-exports.
- **TypeScript strict + `noUncheckedIndexedAccess`** — Phase 3 components must satisfy both.
- **Webpack build, not Turbopack** — Phase 1 D-13 reasoning still applies (Serwist incompatibility). Phase 3 must not flip the script.
- **Diagnostics routes use plain segments (`/diag`, `/api/v1/diagnostics/*`)** — Phase 1 learned that Next App Router silently excludes underscore-prefixed segments. `/offline` is plain; safe.
- **CI-only Sentry + PostHog**, **disabled locally** (D-19/D-20 Phase 1) — Phase 3 doesn't change this; new error toasts must not call `Sentry.captureException` outside this gate.
- **Conventional Commits + Husky + lint-staged** — every commit must pass; Phase 3's new lint rules slot into the existing chain.

### Integration Points

- `src/app/(app)/layout.tsx` (NEW) — app-route layout that mounts a client app-shell component for bottom nav, persistent offline banner, app-update toast, scroll restoration, and focus management on route change.
- `src/app/(app)/app-shell.tsx` (NEW) — client component owning `usePathname`, `useLayoutEffect`, `mainRef.focus()`, online status, toasts, and bottom-nav active state.
- `src/app/(app)/page.tsx` (MOVE/REPLACE) — Home tab placeholder; remove the existing root `src/app/page.tsx` after moving/replacing it to avoid duplicate `/` ownership.
- `src/app/(app)/catalog/page.tsx`, `/identify/page.tsx`, `/profile/page.tsx` (NEW) — placeholder tabs.
- `src/app/offline/page.tsx` (NEW) — composed empty-state offline fallback (served by SW navigation handler when offline).
- `src/app/layout.tsx` (EXTEND) — add cookie-based manual theme attribute, system-preference auto support through CSS, and font loader. Do not add route-change focus logic here; root layout stays a server component.
- `src/app/api/v1/health/connectivity/route.ts` (NEW) — public `GET` heartbeat for online detection, side-effect-free, `Cache-Control: no-store`, returns `{ ok: true, timestamp }`.
- `src/shared/ui/*` (NEW) — primitives: `button.tsx`, `text-input.tsx`, `select.tsx`, `toggle.tsx`, `modal-sheet.tsx`, `skeleton.tsx`, `empty-state.tsx`, `inline-error.tsx`, `offline-banner.tsx`, `app-update-toast.tsx`, `discard-summary-toast.tsx`, `bottom-nav.tsx`, `capture-button.tsx`, `read-only-banner.tsx`.
- `src/shared/theme/tokens.ts` (NEW) — JS mirror of CSS custom properties for motion/JS consumers.
- `src/shared/motion/springs.ts` (NEW) — spring presets.
- `src/shared/motion/use-reduced-motion.ts` (NEW) — convenience re-export of `motion`'s hook.
- `src/shared/online/use-online-status.ts` (NEW) — heartbeat + listener composition using `/api/v1/health/connectivity`, never the diagnostics route.
- `src/shared/theme/use-theme.ts` (NEW) — read/write theme cookie via Server Action.
- `src/shared/typography/scientific-name.tsx` (NEW per Claude's discretion) — `<i lang="la">` wrapper.
- `src/shared/i18n/format.ts` (NEW per Claude's discretion) — Intl.* helpers.
- `src/messages/pt-BR.json` (POPULATE) — ~30–50 nested keys.
- `public/manifest.webmanifest` (REWRITE) — full icon paths, correct `theme_color`.
- `public/icons/*` (NEW) — generated PWA icon set.
- `public/illustrations/*` (NEW) — Sage line-art SVG illustrations (founder-sourced or placeholder).
- `eslint.config.mjs` (EXTEND) — add custom rule for emoji ban + reduced-motion `@keyframes` warning + Tailwind plugin.
- `stylelint.config.mjs` (NEW) — banned patterns (pure black/white hex, gradient text, glassmorphism filters, generic serif fallbacks), wired through `pnpm lint:styles`, CI, and lint-staged CSS entries.
- `playwright.config.ts` (EXTEND) — add `@axe-core/playwright` integration; snapshot test config for both themes + motion preferences.

</code_context>

<specifics>
## Specific Ideas

- Tailwind v4 CSS-first config: `@import "tailwindcss"; @theme { --color-canopy: var(--canopy-green); ... }` so Tailwind utilities (`bg-canopy`, `text-forest`, etc.) read from the same CSS custom properties as raw CSS. Token blocks must include light `:root`, auto dark `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ... } }`, and manual `[data-theme=light|dark]` overrides.
- Theme cookie name: `folhario_theme` (project-prefixed to avoid collision with iframe contexts). Values: `auto` | `light` | `dark`. Default: `auto` (no cookie set).
- `useOnlineStatus` heartbeat: `GET /api/v1/health/connectivity` every 30s when online; backs off to 60s after a successful ping returns; resets to 5s when window-`online` event fires after offline period (catches reconnection quickly). Treat non-2xx, timeout, or network error as offline; the endpoint is public and side-effect-free.
- Skeleton 300ms gate implementation: `<SkeletonGroup>` returns `null` until `setTimeout(300)` resolves, then renders children. Faster operations that resolve before the timer skip the shimmer entirely and fade content in over 120ms via `<FadeIn duration={120}>`.
- Capture button breathing loop: `<motion.button animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>`; `useReducedMotion()` returns `true` → drop the animation prop entirely (button stays at scale 1).
- App-update toast copy: `"Nova versão disponível"` + button `"Atualizar"`. Reduced-motion: instant `opacity` fade. Toast is non-blocking (sonner default position `bottom-center`); persists until tapped or dismissed; reappears on next route change if still pending.
- `/offline` page copy: headline `"Você está offline."`; hint `"Verifique sua conexão e tente novamente. Suas plantas salvas continuam disponíveis em Catálogo."`; CTA `"Tentar novamente"` reloads the current path.
- Bottom-nav active-indicator slide: 3px Canopy bar at top edge of bar, animated via `transform: translateX()` keyed off active tab index; `transition: transform 240ms cubic-bezier(.2,.8,.2,1)`; reduced-motion → instant.
- Per-tab scroll restoration debounce: 150ms (typical mobile-scroll comfort).
- pt-BR message key examples: `home.empty.title`, `home.empty.cta`, `nav.tabs.home`, `nav.tabs.catalog`, `nav.tabs.identify`, `nav.tabs.profile`, `app.update.label`, `app.update.cta`, `offline.banner.label`, `offline.page.title`, `offline.page.hint`, `offline.page.cta`, `readonly.banner.label`, `sync.discardSummary.label`, `theme.toggle.label`, `theme.toggle.options.auto`, `theme.toggle.options.light`, `theme.toggle.options.dark`, `error.generic.title`, `error.generic.cta`, `focus.skip-to-main`.
- Stylelint custom rules to add: `declaration-property-value-disallowed-list` for `color: #000000` / `#FFFFFF` / `#fff` / `#000`; `function-disallowed-list` for `linear-gradient` on text fills; ban `backdrop-filter` (glassmorphism); ban `@font-face { font-family: Inter | "Times New Roman" | Georgia | Garamond | Palatino }`.
- Playwright axe gate: fail on `serious` + `critical` violations; warn on `moderate`; ignore `minor`.
- Visual snapshot mask zones: any element with `data-snapshot-mask="true"` (used for elements containing date/time/random IDs).
- Founder asset checklist (move to launch-blocker tracker if not delivered before Phase 3 final review): `logo.svg`, `empty-home.svg`, `empty-catalog.svg`, `empty-identify.svg`, `empty-profile.svg`, `offline.svg`, optional `404.svg`, `error.svg`. All single-color, currentColor stroke, 1.5px stroke width, no fills.

</specifics>

<deferred>
## Deferred Ideas

- **Cards (generic Warm Ivory base primitive)** — defer to Phase 5 with plant card; Phase 3 ships only the bare CSS class for L1 elevation.
- **Confidence ladder primitive** — Phase 6 (first uses identification results).
- **Toxicity badge primitive** — Phase 7 (first uses care guide).
- **Plant card** — Phase 5.
- **Care card section** — Phase 7.
- **"Gerado por IA" chip** — Phase 7.
- **"Cap atingido" chip** — Phase 6.
- **Custom PWA install prompt** — Phase 4 onboarding (or post-launch if conversion data warrants).
- **View Transitions API for route transitions** — post-MVP polish; revisit if static transitions feel jumpy.
- **Storybook / Chromatic / Percy** — out of MVP scope; `/playground` route can be added as a post-MVP design lab if needed.
- **Server-rendered user-local datetime helpers using `date-fns-tz`** — Phase 4+ when User.timezone exists.
- **Settings → Account location of theme override** — Phase 4 moves the toggle from Profile placeholder.
- **Subscription read-only banner wiring** — Phase 10 (component ships in Phase 3, prop wired then).
- **Offline action queue wiring** — Phase 9. The discard-summary toast surface ships in Phase 3 as an unwired design-system helper; Phase 9 connects it to queue outcomes.
- **CSP header** — explicitly deferred (Phase 1 D-23, user directive).
- **Expanded security headers** beyond Phase 1's D-24 set — late-phase hardening pass before Phase 12.
- **Playwright WebKit + Firefox** — Chromium-only retained; add WebKit when iOS PWA install issues surface.

</deferred>

---

_Phase: 03-design-system-app-shell_
_Context gathered: 2026-04-26 (power mode, 35/35 answered + 4 Claude's-discretion items)_
