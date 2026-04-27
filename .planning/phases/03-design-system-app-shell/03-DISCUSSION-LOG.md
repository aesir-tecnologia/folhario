# Phase 3: Design System & App Shell - Discussion Log (Power Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in `03-CONTEXT.md` — this log preserves the full Q&A surface.

**Date:** 2026-04-26
**Phase:** 03-design-system-app-shell
**Mode:** discuss (`--power`)
**Total questions:** 35
**Answered:** 35
**Chat-more notes:** 0
**Source:** `.planning/phases/03-design-system-app-shell/03-QUESTIONS.json`

## Canonical References Accumulated

- `docs/CAVE-PRD.md` — §16, §17, §18 — **Design System / Screens / Accessibility** — Locks visual tokens, motion params, banned patterns, a11y rules. Section 17 defines hex palette, typography, spring physics, skeleton timing, banned patterns. Section 18 defines redundant-cue rules.
- `.planning/PROJECT.md` — **Vision + Constraints** — Mobile-first PWA, tablet-width centered on desktop, pt-BR only, WCAG AA = ship blocker, adapter boundaries.
- `.planning/ROADMAP.md` — Phase 3 entry — **Phase 3 Goal + Success Criteria** — 5 success criteria define ship contract — installable PWA, theme switch, skeletons, placeholder primitives, app-update toast + design-system lint.
- `.planning/REQUIREMENTS.md` — **Phase 3 Requirements** — UI-01, UI-02, UI-03, UI-14, UI-17, UI-18, UI-19, UI-20, UI-21, UI-22, UI-23, UI-24, UI-25, OFF-09, OFF-10.
- `.planning/phases/01-foundation/01-CONTEXT.md` — **Foundation Decisions Carried Forward** — D-13 Serwist skeleton-only (Phase 3 must finish offline strategy); D-14 manifest placeholder (Phase 3 rewrites with brand assets); D-15 next-intl as-needed prefix; D-22 Sentry scrub posture.
- `.planning/phases/02-data-layer/02-CONTEXT.md` — **Data Layer Conventions** — Phase 3 placeholder pages do not yet exercise repositories or routes — but API conventions inform the diagnostics ping used by offline-banner heartbeat.
- `CLAUDE.md` — **Stack Lock-in** — next-intl 4.9.1, Next 16.2.3, React 19.2.5, Serwist 9.5.7. Bottom-nav only, max 5 tabs (MVP uses 4). pt-BR only at launch. <html lang='pt-BR'>. date-fns-tz for server-rendered user-local times.

## Claude's Discretion Items

- **ScientificName component shape** — PRD §17 locks the markup (<i lang='la'>) and styling (italic Plus Jakarta Sans 14 Calm/Lantern Slate). Component lives at src/shared/typography/scientific-name.tsx; first consumed by Phase 5/6.
- **Locale formatter module location + shape** — src/shared/i18n/format.ts exporting formatCurrencyBRL, formatDate, formatTime, formatDateTime via Intl.* with pt-BR locale + User.timezone injection point. date-fns-tz used per CLAUDE.md for server-rendered user-local times only.
- **Sage line-art SVG implementation approach** — Inline SVG components with currentColor + stroke-width: 1.5px. Theme-aware via CSS color variable. Only theme-aware route.
- **Desktop side-fill background** — Same Paper Cream / Night Cream as container — invisible boundary. Locked by 'Folhário is ONE shape across devices' from PRD §17.

## Questions Asked & Answered

### 1. Styling Architecture

#### Q-01: CSS framework choice

*Context:* Phase 1 didn't pick a CSS solution — src/app/globals.css is empty. Next 16 supports Tailwind v4 first-class via @tailwindcss/postcss. Choose once for the whole app — Phase 5+ feature phases all depend on this. PRD §17's token-heavy spec pairs naturally with Tailwind v4's @theme directive.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Tailwind CSS v4 | Recommended. Utility classes + @theme for tokens. Mature ecosystem; fastest route from PRD spec to working UI. PRD banned-patterns map to eslint-plugin-tailwindcss + stylelint rules. CSS-first config keeps tokens single-source. |
| `b` | CSS Modules + CSS variables | Vanilla. Tokens in globals.css :root + [data-theme=dark]. Per-component .module.css. More verbose but zero runtime, full control, no framework lock-in. |
| `c` | Panda CSS / Vanilla Extract | Type-safe build-time CSS-in-JS. Token-aware. More setup; smaller community than Tailwind; more rigorous type contracts. |
| `d` | Hybrid: Tailwind v4 utility + CSS Modules for complex pieces | Pragmatic middle ground. Tailwind for 90% utility, modules for skeleton shimmer / motion primitives that need named keyframes. |
| `e` | Custom (specify in chat-more) |  |

**Selected:** `a` — Tailwind CSS v4

#### Q-02: Token storage approach

*Context:* PRD §17 has 11 light + 11 dark color tokens, type scale, spring params, 8pt grid. Tokens must be readable from CSS (component styles) AND from JS (motion library reads spring config). Phase 1 set no token convention.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | CSS custom properties in globals.css + JS mirror in src/shared/theme/tokens.ts | Recommended. :root + [data-theme=dark] for runtime; tokens.ts re-exports the same values for motion lib + JS consumers. Single source of truth via shared constants. Works regardless of CSS framework choice. |
| `b` | Tailwind v4 @theme directive only (CSS-first config) + theme() in JS | Minimal duplication; depends on Tailwind v4. Loses dark mode dynamics if Tailwind needs static values for some utilities. |
| `c` | Style Dictionary multi-output build | Multi-output (CSS + JS + JSON). Useful if native app comes later. Adds a build step + extra dependency. |
| `d` | Hybrid: CSS vars for runtime + JS constants only for motion params | Pragmatic. Motion params don't change at runtime so they don't need CSS-var indirection. |

**Selected:** `a` — CSS custom properties in globals.css + JS mirror in src/shared/theme/tokens.ts

#### Q-03: Theme attribute placement on <html>

*Context:* Where the dark-mode switch lives in the DOM. Affects every CSS rule's variant syntax. Tailwind v4 supports both class and attribute via @variant dark { … }. data-attribute is CSS-native and framework-agnostic.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | <html data-theme='light\|dark\|auto'> | Recommended. Semantic, matches [data-theme=dark] selector pattern; works with any CSS framework; survives framework swaps. For auto, SSR must not guess prefers-color-scheme; CSS media queries resolve the effective light/dark tokens. |
| `b` | <html class='dark'> | Tailwind's classic convention. Couples to Tailwind syntax. |
| `c` | Browser-managed only via prefers-color-scheme | No manual override path. Conflicts with PRD §17 'Manual override in Settings'. |

**Selected:** `a` — <html data-theme='light|dark|auto'>

### 2. Typography & Iconography

#### Q-04: Font loading strategy

*Context:* Source Serif 4 + Plus Jakarta Sans both Google Fonts. PWA must work offline → fonts must self-host + cache. PRD demands variable fonts, +2% tracking on buttons, latin-ext subset for pt-BR diacritics (ã, ç, é).

| Option | Label | Description |
|--------|-------|-------------|
| `a` | next/font/google with subsetting (['latin', 'latin-ext']) | Recommended. Auto self-hosting, font-display swap baked in. Built into Next 16. Service worker caches statically. Variable axis exposed via weight ranges. |
| `b` | Self-host downloaded woff2 + next/font/local | Full control over file paths, version pinning, no Google CDN call. Requires manual variable-font subsetting (glyphhanger or similar). |
| `c` | Google Fonts CSS link tag | Simplest. External request — breaks offline-first. Not viable for a PWA. |

**Selected:** `a` — next/font/google with subsetting (['latin', 'latin-ext'])

#### Q-05: Lucide icon package

*Context:* PRD §17: 'Lucide ONLY'. Need stroke-width 1.5px, sizes 18/20/24/28px. Bundle size matters for PWA cold start.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | lucide-react | Recommended. Official React package; per-icon imports tree-shake; supports strokeWidth={1.5} per spec. Industry standard. |
| `b` | Inline SVG sprites generated from lucide-static | Zero JS for icons; one HTTP request. Build step needed to extract used icons. More setup. |
| `c` | @iconify/react with Lucide collection | Generic icon framework. Over-engineered for 'Lucide only'; larger runtime. |

**Selected:** `a` — lucide-react

### 3. Motion System

#### Q-06: Motion library

*Context:* PRD §17 motion: spring physics 120/18/1 (stiffness/damping/mass), capture-button 1.00→1.03→1.00 bounce, 3.2s breathing loop, 60ms cascade on lists, prefers-reduced-motion fallbacks. Animate via transform + opacity only.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | motion (Framer Motion v12+, rebranded 2025) | Recommended. First-class spring physics matching PRD params; useReducedMotion hook; LayoutGroup for shared layout transitions; ~60kB gzipped. Largest community + most examples. |
| `b` | motion/react (subpath import) | Recommended. Same package (`motion`), but React consumers import from `motion/react` (or `motion/react-client` where required by RSC boundaries), never an ambiguous root import. |
| `c` | @motionone/react | Smaller bundle (~3kB), simpler spring API. Less spring-config flexibility for complex orchestration like 60ms cascade with shared dampers. |
| `d` | CSS @keyframes + custom JS spring helper | Minimal deps. Spring math by hand (or copy from react-spring source). Most control, most code, fewest deps. |

**Selected:** `b` — motion/react (subpath import)

#### Q-07: Spring physics constants location

*Context:* PRD locks: stiffness 120, damping 18, mass 1 across button press, sheet reveal, tab switch. Capture-button bounce 1.00→1.03→1.00. Breathing loop 1.00→1.02 over 3.2s ease-in-out. All consumers must read the same values.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | src/shared/motion/springs.ts named exports | Recommended. Exports springs.primary, springs.captureBounce, springs.breathing consumed by transition={springs.primary}. Single source; covers extension for variants if added later. |
| `b` | Inline transition props in each consumer | Duplication; drift risk. Easy to read locally, hard to keep in sync. |
| `c` | Custom hook useSpringTransition(name) | Indirection without value. Same as (a) plus an unnecessary hook layer. |

**Selected:** `a` — src/shared/motion/springs.ts named exports

#### Q-08: Reduced-motion enforcement

*Context:* PRD §17: every animation has a reduced-motion fallback (shimmer → static, breathing → stop, cascade → 120ms fade, spring → 120ms linear, celebration → 200ms color tint). 'Motion is NEVER sole indicator of state change.' This must be enforceable so a future feature phase can't accidentally regress.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | useReducedMotion() hook + Tailwind motion-reduce: variant + Stylelint CSS rule + ESLint TSX rule | Recommended. Distributed enforcement; catches runtime motion usage in React and CSS keyframes in stylesheets. CSS @keyframes enforcement belongs in Stylelint; ESLint covers TSX motion usage, emoji, and banned imports. |
| `b` | useReducedMotion() hook only — no CSS-level enforcement | Simpler. Misses CSS @keyframes which framer-motion's hook can't see. |
| `c` | Manual review only (no automated rule) | Risks regression in feature phases. PRs forget. |

**Selected:** `a` — useReducedMotion() hook + Tailwind motion-reduce: variant + Stylelint CSS rule + ESLint TSX rule

#### Q-09: Route transition strategy

*Context:* PRD §17: 'After route change, focus moves programmatically to main content region.' Tab switches preserve scroll per tab (UI-14). Next 16 ships experimental View Transitions API (unstable_ViewTransition) — opt-in fade between routes. This is orthogonal to button-press / sheet-reveal motion (Q-06) but governs the chrome of bottom-nav tab switches.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Static — no route transition animation; instant content swap + focus move | Recommended for MVP. Predictable, accessible, no spec-creep risk. Bottom-nav active indicator slides via CSS only (transform + opacity); content area swaps instantly. |
| `b` | Next 16 View Transitions API (unstable_ViewTransition) | Opt-in fade between routes; experimental API; reduced-motion via media query. Risks API churn. Can be retrofitted later if MVP feels too jumpy. |
| `c` | framer-motion LayoutGroup + AnimatePresence | Fade/slide via motion library; consistent with rest of motion system; more code; risk of layout-shift regressions on mobile. |

**Selected:** `a` — Static — no route transition animation; instant content swap + focus move

### 4. Component Primitives Library

#### Q-10: Headless component primitives library

*Context:* Need: dialog/modal sheet (focus trap, scrim, drag handle), toast region, dropdown, tabs (bottom-nav semantics). Must be a11y compliant from day 1. Affects every modal/menu in MVP. Phase 4 needs Modal sheet for T&C; Phase 6 for LGPD consent; Phase 7 for toxicity disclaimer.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | @radix-ui/react-* primitives, excluding toast | Recommended. @radix-ui/react-dialog (modal sheet), @radix-ui/react-dropdown-menu, @radix-ui/react-tabs. Toast ownership stays with Q-11 Sonner to avoid duplicate toast systems. Headless, fully a11y. Industry standard. Tree-shakes per primitive. |
| `b` | shadcn/ui (Radix + Tailwind preset components) | Generates code into your repo; tweakable. Pairs naturally if Tailwind chosen. More opinionated styling defaults to override. |
| `c` | Headless UI (@headlessui/react) | Tailwind Labs alt; smaller surface. No drag-handle bottom-sheet primitive — would need to build that piece manually. |
| `d` | Build all primitives from scratch | Full control, full a11y burden. High risk for an MVP under WCAG-AA-ship-blocker constraint. |

**Selected:** `a` — @radix-ui/react-* primitives, excluding toast

#### Q-11: Toast / banner system

*Context:* Need: app-update toast (bottom, non-blocking, OFF-10), persistent offline banner (top, UI-24), discard summary toast (Phase 9), read-only banner (Phase 10), error toasts. Reduced-motion: instant fade. Per-message dismiss.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | sonner | Recommended. Modern toast library, motion-friendly, ~3kB. Supports persistent + dismissible, Promise toasts, headless customization. Matches design discipline. |
| `b` | Radix UI Toast primitive + bespoke styling | Pairs naturally if Radix chosen for Q-10. Build the styled wrapper yourself; full design control. |
| `c` | react-hot-toast | Simpler API; less flexible for persistent banners; default styling needs heavy override. |
| `d` | Build from scratch on Radix Toast Region | More code; full design control; covers app-update + offline banner + ad-hoc toasts under one mental model. |

**Selected:** `a` — sonner

### 5. Theme & Dark Mode

#### Q-12: Dark mode toggle + flash prevention

*Context:* PRD §17: 'color-scheme: light dark', follow system, manual override in Settings. SSR-rendered Next 16 → if theme stored in localStorage, page paints with system pref then swaps to user choice = visible flash. Cookie read server-side avoids flash.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Cookie 'theme=auto\|light\|dark' read in root layout, sets <html data-theme='...'> SSR-side; Settings writes cookie via Server Action | Recommended. Zero flash for explicit light/dark override; works with edge runtime. For auto, render data-theme='auto' and let CSS media queries resolve system preference instead of SSR-guessing. Settings page (Phase 4) writes cookie; Phase 3 just reads. Server Action keeps Settings declarative. |
| `b` | localStorage + inline <script> in <head> reading before paint | Blocking script; classic anti-FOUC pattern. Works but smell. CSP-unfriendly (inline script needs nonce when CSP lands). |
| `c` | System pref only in Phase 3; manual override deferred to Phase 4 | Simpler now. SC-1 implies dark mode is fully working in Phase 3 (cookie path proven end-to-end), so this risks back-pedaling. |

**Selected:** `a` — Cookie 'theme=auto|light|dark' read in root layout, sets <html data-theme='...'> SSR-side; Settings writes cookie via Server Action

#### Q-13: Settings → Theme override surface in Phase 3

*Context:* PRD §17 demands manual override 'in Settings'. Settings shell ships in Phase 4 (Account section). Phase 3 needs to prove the cookie+dark-mode contract works end-to-end. SC-1 implies the user-facing manual override exists.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Temporary toggle on Profile placeholder tab (Phase 3); Phase 4 moves into proper Settings → Account | Recommended. Proves the cookie+dark-mode contract; uses the design-system Toggle primitive. Phase 4 owns relocation. |
| `b` | Only system-pref dark mode in Phase 3; manual override deferred to Phase 4 | Simpler. SC-1 'manual override' is met by the contract being live; surface deferred. |
| `c` | ?theme=dark URL param toggle in Phase 3 for testing; UI ships Phase 4 | Debug-only path; ugly but unblocks Playwright snapshot tests of dark mode. |

**Selected:** `a` — Temporary toggle on Profile placeholder tab (Phase 3); Phase 4 moves into proper Settings → Account

### 6. PWA & Service Worker

#### Q-14: Service worker offline strategy

*Context:* Phase 1 SW (src/app/sw.ts) is precache-only skeleton: precacheEntries: self.__SW_MANIFEST. PRD §10: 'Previously loaded catalog browsable offline; new identifications blocked.' Phase 9 owns offline queue. Phase 3's job: app-shell offline + static caching + API passthrough.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | App-shell offline-first (HTML+JS+CSS precached) + StaleWhileRevalidate static + NetworkOnly /api/* | Recommended. Fast launch, predictable. Catalog data caching is Phase 5+ scope. Lets SW navigation handler serve the offline fallback when uncached. |
| `b` | Network-first navigation, fall back to /offline page on failure | Simpler but slower launch. Doesn't match PRD's 'previously loaded catalog browsable' promise. |
| `c` | Defer SW caching strategy entirely to Phase 9 (offline queue) | Phase 3 ships only manifest + register. OFF-09 / OFF-10 SC fail. |

**Selected:** `a` — App-shell offline-first (HTML+JS+CSS precached) + StaleWhileRevalidate static + NetworkOnly /api/*

#### Q-15: Offline fallback page

*Context:* When user offline AND requests an uncached route. SC-4 mentions 'persistent offline banner' but doesn't define the offline fallback URL. The fallback IS one of the placeholder demo pages — exercises the empty-state primitive.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | /offline static page composed of empty-state primitive (Sage line-art + Source Serif headline + Calm Slate hint + Canopy 'Tentar novamente' CTA) | Recommended. Proves empty-state primitive end-to-end, gives offline experience a brand-coherent surface. SW navigation handler serves it on uncached navigation when offline. |
| `b` | No dedicated offline page; rely only on persistent offline banner + browser default | Browser default 'You are offline' is ugly and English. Persistent banner appears on cached pages; uncached navigation still falls to browser. |
| `c` | Hard 'no offline mode in Phase 3' — disable SW navigation handler, defer to Phase 9 | OFF-09 SC fails. Phase 5+ depends on this. |

**Selected:** `a` — /offline static page composed of empty-state primitive (Sage line-art + Source Serif headline + Calm Slate hint + Canopy 'Tentar novamente' CTA)

#### Q-16: App-update toast trigger mechanism

*Context:* OFF-10: detect new SW version waiting → bottom toast 'Nova versão disponível' + 'Atualizar' → tap fires skipWaiting + reload. Reduced-motion: instant fade. Never auto-reload mid-session. The mechanism connects SW lifecycle to the React toast system (Q-11).

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Listen to Serwist registration events (onWaiting / onUpdated) → emit custom DOM event → toast component subscribes | Recommended. Serwist exposes hooks for this. Decoupled. Toast lives in app-group layout; SW lifecycle stays at registration site. Requires the service worker to stop using automatic skipWaiting/clientsClaim; the 'Atualizar' button sends the explicit skip-waiting message and then reloads. |
| `b` | Poll navigator.serviceWorker.controller + waiting registration manually | Verbose; no library hook needed. Robust against Serwist API changes. |
| `c` | @serwist/window register helper | Serwist's bundled client. Clean API; adds ~5kB. Worth it if it covers update-check + skipWaiting + claim cleanly. |

**Selected:** `a` — Listen to Serwist registration events (onWaiting / onUpdated) → emit custom DOM event → toast component subscribes

#### Q-17: PWA icon set generation

*Context:* Manifest currently has zero icons. Phase 3 needs full set: 192/512 (Android), 180 (Apple touch), maskable variants, monochrome (Android adaptive), favicon. PRD demands brand-aligned theme color. Source SVG must come from founder or be a clear placeholder.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | pwa-asset-generator from a single SVG source | Recommended. Automated, reproducible. Run as `pnpm icons:generate` script. CI never re-runs; outputs committed. Founder updates SVG → regenerate set. |
| `b` | Real Favicon Generator (online tool) | Manual one-time export. No CI reproducibility. OK if founder commits to one-and-done. |
| `c` | Hand-crafted in Figma / Sketch | Full control; founder-sourced. Time cost; no automation. Only works if founder owns design tooling. |

**Selected:** `a` — pwa-asset-generator from a single SVG source

#### Q-18: Manifest theme color value

*Context:* Current manifest sets theme_color: #FFFFFF — VIOLATES PRD §17 (no pure white). Theme color tints the browser chrome above the page (Android Chrome address bar, iOS PWA splash).

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Paper Cream #FBF7EF (light) + Night Cream #1A1613 (dark) via two <meta name='theme-color' media='(prefers-color-scheme: …)'> | Recommended. Matches brand. iOS supports the media-query split since iOS 15; Android Chrome since 2022. Manifest theme_color = light value as fallback, and manifest background_color must also use Paper Cream instead of pure white. |
| `b` | Canopy Green #1F4D35 (single value) | Bolder; tints chrome the brand color. Some apps prefer this for brand recall. |
| `c` | Paper Cream only (no dark variant) | Simpler; iOS doesn't respect dark variants reliably anyway. |

**Selected:** `a` — Paper Cream #FBF7EF (light) + Night Cream #1A1613 (dark) via two <meta name='theme-color' media='(prefers-color-scheme: …)'>

#### Q-19: PWA install prompt UX

*Context:* Phase 3 makes app installable. Choice: rely on browser default vs custom button. Custom prompts typically live in onboarding (Phase 4) or Settings. Phase 3's SC-1 is met by a visitor installing the PWA — doesn't require a custom button.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Browser default only — no custom prompt in Phase 3 | Recommended. Simplest; meets SC-1 'a visitor installs the PWA'. Custom prompt revisited in Phase 4 onboarding if conversion data warrants. |
| `b` | Custom 'Instalar' button on Home empty state for unauthenticated visitors | More engagement; Home empty state is owned by Phase 5 — risk of bleed. |
| `c` | Capture beforeinstallprompt and surface a banner after first interaction | Most aggressive; risk of nag and brand-tone violation. |

**Selected:** `a` — Browser default only — no custom prompt in Phase 3

### 7. Layout & Navigation

#### Q-20: Tablet-width centered container approach

*Context:* PROJECT.md: 'Mobile-first PWA, tablet-width centered on desktop (bg fills sides). No wide-screen design.' Need a max-width for the app shell. PRD §17 catalog grid breaks at 375 / 600 / 900 — implies tablet-class is in the design space.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Single root <div> with max-width: 480px centered, min-h-[100dvh] | Recommended. Phone-style centered; matches mobile-first ethos. Catalog 4-col layout still hits ≥900px viewports because grid is inside the container — but the container caps. Cleanest. |
| `b` | max-width: 600px container — gives tablet breathing room | More natural feel on iPad / desktop preview. Catalog 3-col fits cleanly (PRD breakpoint 600–899 = 3 cols). Slightly wider feel, still 'mobile shape'. |
| `c` | Per-route <Container> component with breakpoint-aware max-widths | Recommended. Keeps the default app shell phone-shaped while allowing routes with explicit PRD layout contracts, especially Catalog's 375/600/900 grid ladder, to opt into wider tablet-class content. Desktop side-fill remains Paper Cream / Night Cream. |

**Selected:** `c` — Per-route <Container> component with breakpoint-aware max-widths

#### Q-21: Bottom-nav routing structure

*Context:* UI-14: 4 tabs Home / Catálogo / Identificar / Perfil. PRD §17: 'Switching tabs preserves scroll + filter per tab. Never silently jumps to Home or resets.' Per-tab scroll preservation requires either parallel routes or manual save/restore.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Single layout + manual scrollY save/restore via sessionStorage in useLayoutEffect | Recommended for MVP. Simplest; works with App Router defaults; preserve via debounced scroll handler keyed by pathname. Low coupling. |
| `b` | Next 16 parallel routes (@home, @catalog, @identify, @profile) with persistent layout | Preserves DOM + scroll natively. Per Next 16 conventions; non-trivial setup; better UX for back/forward navigation. Refactor risk. |
| `c` | experimental.scrollRestoration + browser history API | Simplest; relies on browser history. Behavior less predictable for tab switches that aren't back/forward navigation. |

**Selected:** `a` — Single layout + manual scrollY save/restore via sessionStorage in useLayoutEffect

#### Q-22: App shell layout group structure

*Context:* Bottom-nav lives only on app routes. Auth screens (Phase 4) and unverified-email blocker shouldn't show bottom-nav. Decision sets the route-group convention for the whole app.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Root layout has <html> + providers; route group (app) has bottom-nav layout; (auth) group has bare shell | Recommended. Phase 4 owns (auth); Phase 3 sets up (app) with bottom-nav. Clean separation; each group has its own layout boundary. |
| `b` | Single root layout with conditional bottom-nav based on route | Simpler now; harder to maintain as auth + admin + onboarding routes accumulate. |
| `c` | Defer route-group decision to Phase 4 | Risks Phase 3 design contract breakage (unverified-email blocker test won't be possible). |

**Selected:** `a` — Root layout has <html> + providers; route group (app) has bottom-nav layout; (auth) group has bare shell

#### Q-23: Per-tab scroll preservation pattern

*Context:* PRD §17 bottom-nav: 'Switching tabs preserves scroll + filter per tab. Never silently jumps to Home or resets.' Q-21 chose the routing structure; this is the explicit scroll-position policy.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Save scrollY to sessionStorage keyed by pathname on every scroll (debounced); restore on tab change in useLayoutEffect | Recommended. Survives navigation; resets on session. Works with any routing; ~30 LOC. |
| `b` | In-memory Map keyed by pathname (lost on reload) | Cheapest. Lost on tab close. Adequate for MVP if reload-resume isn't a goal. |
| `c` | Next 16 experimental.scrollRestoration | Browser-native; behavior less predictable for tab switches that aren't back/forward navigation. Pairs poorly with parallel routes if Q-21 chose them. |

**Selected:** `a` — Save scrollY to sessionStorage keyed by pathname on every scroll (debounced); restore on tab change in useLayoutEffect

#### Q-24: Focus management on route change

*Context:* PRD §17: 'After route change, focus moves programmatically to main content region.' Tab order = visual reading order. SC-2 explicitly demands this for keyboard users.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | usePathname listener in app-group layout calls mainRef.current?.focus(); main wrapper has tabIndex={-1} + aria-label | Recommended. Standard a11y pattern. Negative tabIndex makes <main> focusable without entering tab order. ARIA label says 'Conteúdo principal'. |
| `b` | Custom React Router-style focus library | Overkill for App Router; (a) is ~10 LOC. |
| `c` | Manual focus() calls per page | Drift; pages forget; SC-2 regression risk. |

**Selected:** `a` — usePathname listener in app-group layout calls mainRef.current?.focus(); main wrapper has tabIndex={-1} + aria-label

### 8. Phase 3 Scope

#### Q-25: Phase 3 composed primitives — multiSelect

*Context:* SC-4: 'Placeholder screens demonstrate every composed primitive.' Some primitives are general (button, empty state, error) — Phase 3 owns them. Others are feature-specific (toxicity badge, confidence ladder) — owning phase will build them. Pick all that ship in Phase 3.

| Option | Label | Description |
|--------|-------|-------------|
| `buttons` | Buttons (Primary / Secondary / Tertiary / Destructive) | Recommended. PRD §17 specs all 4 variants; foundational; Phase 4+ all consume. |
| `inputs` | Inputs (TextInput / Select / Toggle) with §17 validate-on-blur + autocomplete contract | Recommended. Phase 4 signup is first consumer; Phase 3 ships pattern + behavior. |
| `modal-sheet` | Modal sheet primitive (focus trap, scrim, drag handle, return focus) | Recommended. Phase 4 T&C reading + Phase 6 LGPD consent + Phase 7 toxicity disclaimer all need it. |
| `toast-system` | Toast / banner system (app-update + persistent + inline error) | Recommended. OFF-10 + UI-19 + UI-24 all depend. |
| `skeleton` | Skeleton / shimmer with 300ms delay + 120ms fade-in + reduced-motion fallback | Recommended. UI-17 mandatory in Phase 3. |
| `empty-state` | Empty state composer (line-art + serif headline + slate hint + Canopy CTA) | Recommended. UI-18 mandatory in Phase 3. Used by /offline page + Phase 5 empty Catalog. |
| `inline-error` | Inline calm error (UI-19 — never red wall, cause + recovery, retry path) | Recommended. UI-19 mandatory in Phase 3. |
| `app-update-toast` | App-update toast (OFF-10) | Recommended. Specialization of toast-system. SC-5 mandatory. |
| `offline-banner` | Persistent offline banner | Recommended. UI-24 mandatory in Phase 3. |
| `capture-button` | Capture button + breathing loop (PRD §17 circular 72px primitive + 3.2s 1.00→1.02 loop) | Recommended. SC-3 explicitly demands the breathing loop in Phase 3 even though Phase 6 is first to wire camera capture. |
| `cards` | Generic card primitive (Warm Ivory base, 16px radius, L1 elevation) | Optional. Phase 5 plant card + Phase 7 care card extend; can ship the base now. |
| `confidence-ladder` | Confidence ladder (high/medium/low + redundant signals) | Skip. Phase 6 first uses; build then. |
| `toxicity-badge` | Toxicity badge (7-part composition) | Skip. Phase 7 first uses; build then. |
| `plant-card` | Plant card (catalog 4:5 photo) | Skip. Phase 5 first uses. |
| `care-card` | Care card section (full-width with Hairline dividers) | Skip. Phase 7 first uses. |
| `ai-chip` | 'Gerado por IA' chip (Trust Teal pill) | Skip. Phase 7 first uses. |
| `cap-chip` | 'Cap atingido' chip (Overdue Rust pill) | Skip. Phase 6 first uses. |

**Selected (multiSelect, 10 options):**
- `buttons` Buttons (Primary / Secondary / Tertiary / Destructive)
- `inputs` Inputs (TextInput / Select / Toggle) with §17 validate-on-blur + autocomplete contract
- `modal-sheet` Modal sheet primitive (focus trap, scrim, drag handle, return focus)
- `toast-system` Toast / banner system (app-update + persistent + inline error)
- `skeleton` Skeleton / shimmer with 300ms delay + 120ms fade-in + reduced-motion fallback
- `empty-state` Empty state composer (line-art + serif headline + slate hint + Canopy CTA)
- `inline-error` Inline calm error (UI-19 — never red wall, cause + recovery, retry path)
- `app-update-toast` App-update toast (OFF-10)
- `offline-banner` Persistent offline banner
- `capture-button` Capture button + breathing loop (PRD §17 circular 72px primitive + 3.2s 1.00→1.02 loop)

#### Q-26: Phase 3 placeholder pages

*Context:* SC-4: 'Placeholder screens demonstrate every composed primitive.' How much page structure ships in Phase 3?

| Option | Label | Description |
|--------|-------|-------------|
| `a` | 4 nav tabs as routes (/, /catalog, /identify, /profile) all showing thin placeholder empty states + bottom-nav routes between them + /offline page | Recommended. Exercises bottom-nav, empty state primitive, route-change focus, persistent offline banner. Each tab a thin placeholder. Phase 5+ replaces tab content. |
| `b` | Only Home (/) + a /playground route demoing every primitive | Less prod-shaped; primitives in one isolated place. Easier visual review. |
| `c` | Home + /offline only — bare minimum | Skips bottom-nav exercise. SC-2 hard to demonstrate. |
| `d` | Full Home empty state from §16 (capture button + 'Adicionar manualmente' link) + 3 stub tabs + /offline | Phase 3 ships UI-04 surface from §16, but UI-04 is mapped to Phase 5 in REQUIREMENTS. Bleeds into Phase 5 scope; risk. |

**Selected:** `a` — 4 nav tabs as routes (/, /catalog, /identify, /profile) all showing thin placeholder empty states + bottom-nav routes between them + /offline page

#### Q-27: Skeleton primitive — bespoke or library

*Context:* PRD §17 skeleton: matches final geometry, 1.4s shimmer left-to-right, 300ms threshold (faster ops skip shimmer + fade content 120ms), reduced-motion → static block + 80ms fade. Cached responses skip shimmer entirely.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Bespoke <Skeleton> + <SkeletonGroup delay={300}> with CSS keyframes + motion-reduce: variant | Recommended. Full design control; 300ms gating via JS; ~80 LOC. Matches PRD spec exactly. |
| `b` | react-loading-skeleton library | Mature; styling override needed for design tokens; default shimmer is pulse — needs custom CSS to match PRD's left-to-right shimmer. |
| `c` | Tailwind animate-pulse only | Wrong motion (pulse, not shimmer). Violates PRD spec. |

**Selected:** `a` — Bespoke <Skeleton> + <SkeletonGroup delay={300}> with CSS keyframes + motion-reduce: variant

### 9. i18n & Locale

#### Q-28: i18n message file structure

*Context:* src/messages/pt-BR.json is currently empty ({}). Message keys grow rapidly. Two main structures: flat vs nested objects. next-intl supports both.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Nested by screen + component (home.empty.title, nav.tabs.catalog) | Recommended. next-intl useTranslations('home.empty') namespacing works naturally. Easier mental model as keys multiply. |
| `b` | Flat with kebab-case keys (home-empty-title) | Simpler tooling; no namespacing. Better for translation tools that expect flat keys. |
| `c` | Per-screen JSON files split (messages/home.json, messages/nav.json) | Premature for MVP scale. next-intl supports it via custom loader; maintenance overhead. |

**Selected:** `a` — Nested by screen + component (home.empty.title, nav.tabs.catalog)

#### Q-29: Phase 3 translation depth

*Context:* Phase 3 only renders placeholder pages. How much pt-BR copy do we author? Established pattern carries forward. Translation tooling (e.g. machine pre-translation) is irrelevant — pt-BR-only at launch.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Full pt-BR strings for Phase 3 placeholders + design-system labels (~30-50 keys) | Recommended. Establishes the pattern; future phases extend. Includes nav labels, empty-state copy, app-update toast, offline banner, default error messages, focus-visible labels. |
| `b` | Minimal: just the strings rendered in Phase 3 placeholder screens (~10 keys) | Risks rework when Phase 4 lands more text. Pattern not fully exercised. |
| `c` | Stub keys with English fallback messages | Irrelevant — pt-BR-only at launch. Confuses the message contract. |

**Selected:** `a` — Full pt-BR strings for Phase 3 placeholders + design-system labels (~30-50 keys)

### 10. Banners & State

#### Q-30: Offline banner detection mechanism

*Context:* UI-24 persistent offline banner. navigator.onLine is unreliable for captive portals (says online but no internet). Phase 1 ships a diagnostics endpoint at /api/v1/diagnostics/ping that returns 200.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | useOnlineStatus hook combining navigator.onLine + window online/offline events + periodic /api/v1/diagnostics/ping heartbeat (e.g. 30s) | Recommended. Reliable across browsers and PWA edge cases (captive portal, intermittent). Heartbeat is cheap; backs off when offline. The GET ping endpoint must be production-safe and always return a cheap 200 response; it cannot remain gated to IDENTIFICATION_PROVIDER_MODE=stub. |
| `b` | navigator.onLine + window online/offline events only | Simpler; misses captive-portal case. Acceptable for MVP if heartbeat feels overengineered. |
| `c` | Service worker → page postMessage on fetch failures | Most accurate; complex coordination between SW and page. Reactive instead of proactive — banner appears only after a failed request. |

**Selected:** `a` — useOnlineStatus hook combining navigator.onLine + window online/offline events + periodic /api/v1/diagnostics/ping heartbeat (e.g. 30s)

#### Q-31: Read-only banner stub in Phase 3

*Context:* UI-24 mentions read-only banner. Subscription state machine ships Phase 10. Phase 3 just needs the banner component to RENDER when given a flag — Phase 10 wires the source.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Phase 3 builds banner component with prop-driven state; passes false everywhere; Phase 10 wires real subscription state | Recommended. Clean separation; primitive shipped; Phase 10 just provides the data. |
| `b` | Phase 3 renders the banner dev-only behind a query param for visual review | Useful for design QA; lives behind ?readonly=1. Easy to forget to remove. |
| `c` | Defer entirely to Phase 10 | Phase 10 owns both component + wiring. Simpler scope for Phase 3 but requires Phase 10 to also do design work. |

**Selected:** `a` — Phase 3 builds banner component with prop-driven state; passes false everywhere; Phase 10 wires real subscription state

### 11. Quality & Enforcement

#### Q-32: Banned-pattern lint enforcement

*Context:* PRD §17 has dozens of 'banned' rules: no emoji, no pure black/white, no Inter, no glassmorphism, no gradient text, no 'Saiba mais' secondary CTAs in heroes. Manual review forgets. Lint-staged runs on every commit. SC-5 explicitly demands a 'design-system lint'.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Stylelint with custom rules + ESLint custom rule for emoji + Vitest snapshot rule for fonts | Recommended. Distributed enforcement — Stylelint catches color/typography/animation patterns; ESLint catches emoji + banned import patterns; Vitest snapshot covers cross-cutting checks. |
| `b` | Single Vitest rule scanning files for banned patterns | Central; can fail loudly in CI. Less granular feedback. |
| `c` | Manual review only via PRs | Fastest now, costliest at scale. SC-5 fails. |

**Selected:** `a` — Stylelint with custom rules + ESLint custom rule for emoji + Vitest snapshot rule for fonts

#### Q-33: Color contrast verification

*Context:* WCAG AA = ship blocker. PRD §17 lists hex contrast ratios per token (Canopy 9.1:1, Forest Ink 12.9:1, etc.). Phase 3 ships tokens — this is when to wire the gate.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Playwright + @axe-core/playwright on placeholder pages, both themes, both motion preferences, gating CI on violations | Recommended. Catches actual rendered contrast in real browser. Phase 1 already runs Playwright in CI. Snapshot the axe report for review. |
| `b` | axe-core unit tests against rendered components in JSDOM | Fast feedback loop; misses real CSS (pseudo-elements, custom properties via getComputedStyle inconsistencies). |
| `c` | One-time manual contrast-ledger test in Vitest | Checks tokens against expected ratios; catches hex-typo only. Skips real-page rendering. |

**Selected:** `a` — Playwright + @axe-core/playwright on placeholder pages, both themes, both motion preferences, gating CI on violations

#### Q-34: Visual regression testing

*Context:* Composed primitives + design system are visual contracts. Changes need review. Phase 3 establishes the regression baseline that all future phases extend.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Playwright snapshot tests for placeholder pages, both themes, both motion preferences | Recommended. Local screenshots committed; CI compares. Free; integrates with existing Playwright setup. Mask the date/time portions of formatted strings. |
| `b` | Chromatic / Percy via Storybook | Best UX for design QA; paid SaaS; setup heavy; needs Storybook (not in MVP). |
| `c` | No visual regression in Phase 3; rely on lint + axe + manual review | Risks brand drift over time; SC-5 'design-system lint' partially covers but not visual. |

**Selected:** `a` — Playwright snapshot tests for placeholder pages, both themes, both motion preferences

### 12. Brand Assets

#### Q-35: Brand assets source

*Context:* Founder logo, Sage line-art illustrations for empty states, PWA icon source. PRD §17 demands custom illustrations 'NEVER stock photos, NEVER veranda scenes.' Source assets must exist before Phase 3 final review.

| Option | Label | Description |
|--------|-------|-------------|
| `a` | Founder provides SVG logo + 4–6 line-art illustrations before Phase 3 starts; placeholder SVGs ship if not | Recommended. Most realistic for greenfield. Phase 3 builds primitives; illustrations swap in trivially because Q-claude-discretion #3 (inline SVG with currentColor) keeps theme-aware. |
| `b` | Use Lucide outline icons only as illustration placeholders (no custom illustrations) until set is delivered | Empty-state primitive structure ships; illustration swap is trivial. Phase 3 success criteria don't gate on custom illustrations. |
| `c` | AI-generated line art (Midjourney / Recraft / etc.) — manual cleanup required | Risky brand voice; founder-sourced is principled. PRD bans AI clichés but illustrations themselves aren't banned per se. |
| `d` | Hand-coded SVG illustrations (founder or designer-authored) | Full control, full ownership; time cost. |

**Selected:** `a` — Founder provides SVG logo + 4–6 line-art illustrations before Phase 3 starts; placeholder SVGs ship if not

## Resolution

All 35 questions answered with the recommended (option-`a`) defaults except Q-25 (multiSelect of 10 primitives), per the `Select your recommended answers and update the document` directive on 2026-04-26.

Decisions D-01..D-35 captured in `03-CONTEXT.md`. Claude's discretion items recorded under `<decisions>` and `<deferred>`.
