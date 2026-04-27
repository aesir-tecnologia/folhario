# Phase 3: Design System & App Shell — Research

**Researched:** 2026-04-26
**Domain:** Design system foundation, PWA app shell, dark mode, motion, a11y, pt-BR i18n
**Confidence:** HIGH (every locked package version verified against npm registry today; load-bearing API patterns verified via Context7 against official docs)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

D-01..D-35 from `03-CONTEXT.md` are LOCKED. Plans must NOT propose alternatives. Highlights with implementation impact:

- **D-01** Tailwind v4 + `@tailwindcss/postcss` (no JS config; CSS-first `@theme` directive).
- **D-02** Tokens live in `globals.css` CSS custom properties + JS mirror at `src/shared/theme/tokens.ts`.
- **D-03** Theme = CSS-first for `auto`, attribute-based (`[data-theme=light|dark]`) for manual overrides; flash-free first paint via `:root:not([data-theme]) @media (prefers-color-scheme: dark)`.
- **D-04** `next/font/google` with subsets `['latin', 'latin-ext']` for Source Serif 4 + Plus Jakarta Sans, variable axes, `display: 'swap'`.
- **D-05** `lucide-react`, `strokeWidth={1.5}`, sizes 18/20/24/28 px.
- **D-06** `motion` (Framer Motion v12+ rebrand).
- **D-07** Spring presets at `src/shared/motion/springs.ts` (named exports `springs.primary`, `springs.captureBounce`, `springs.breathing`).
- **D-08** Reduced-motion enforcement is three-layer: `useReducedMotion()` runtime + Tailwind `motion-reduce:` variant + custom ESLint rule on `@keyframes` without paired `motion-reduce` fallback.
- **D-09** Static route transitions (no animation; instant content swap + programmatic focus move).
- **D-10** Radix UI primitives: `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-dropdown-menu`.
- **D-11** `sonner` for toasts.
- **D-12** Cookie `folhario_theme=auto|light|dark` read in root layout; written via Server Action invoked from Profile placeholder.
- **D-14..D-16** App-shell offline-first SW (StaleWhileRevalidate static + NetworkOnly `/api/*`); `/offline` page composed of empty-state primitive; SW posture changes from `skipWaiting:true`/`clientsClaim:true` to user-controlled update activation via `waiting` event + `messageSkipWaiting()` + `controlling` reload.
- **D-17** PWA icons generated via `pwa-asset-generator` from a single SVG.
- **D-18** Dual `<meta name="theme-color">` (light `#FBF7EF`, dark `#1A1613`); supersedes Phase 1's `#FFFFFF`.
- **D-20** App-shell container = single `<div>` `max-width: 480px` centered `min-h-[100dvh]`.
- **D-21** Bottom-nav routing = single `(app)` layout group + per-tab `scrollY` save/restore; existing `src/app/page.tsx` MUST be moved into `src/app/(app)/page.tsx`.
- **D-23** Per-tab scroll save = `sessionStorage` keyed by pathname, debounced ~150 ms.
- **D-24** Focus management = `<main tabIndex={-1} aria-label="Conteúdo principal">` + `usePathname` listener calling `mainRef.current?.focus()`.
- **D-25** 12 composed primitives (Buttons, Inputs, Modal sheet, Toast, Skeleton, Empty state, Inline error, App-update toast, Offline banner, Read-only banner, Discard-summary toast surface, Capture button + breathing loop).
- **D-26** Placeholder pages: `/`, `/catalog`, `/identify`, `/profile`, `/offline`.
- **D-27** Skeleton primitive is bespoke (~80 LOC) — `<Skeleton>` + `<SkeletonGroup delay={300}>`.
- **D-28..D-29** i18n message keys nested by `screen.component.key`, ~30–50 keys.
- **D-30** `useOnlineStatus` hook composes `navigator.onLine` + window events + 30 s heartbeat to **`/api/v1/health/connectivity`** (NOT `/api/v1/diagnostics/ping` — that one is CI/stub-mode gated).
- **D-31** Read-only banner ships prop-driven (`active={false}`).
- **D-31a** Discard-summary toast ships as prop/function-driven helper; queue wiring is Phase 9.
- **D-32** Banned-pattern enforcement = Stylelint custom rules + ESLint custom rules + Vitest snapshot rule. **WARNING:** D-32 names `eslint-plugin-tailwindcss` which has only beta/alpha v4 support — see Open Risks #1.
- **D-33** Color contrast verified by `@axe-core/playwright` running placeholder pages × 2 themes × 2 motion preferences; gates CI on serious + critical.
- **D-34** Visual regression via Playwright snapshot tests, both themes × both motion preferences.
- **D-35** Founder provides SVG logo + 4–6 line-art illustrations; placeholder SVGs ship if not delivered.

### Claude's Discretion

- **ScientificName component shape** — `<i lang="la">`; lives at `src/shared/typography/scientific-name.tsx`. First consumed Phase 5/6.
- **Locale formatter module** — `src/shared/i18n/format.ts` exporting `formatCurrencyBRL`, `formatDate`, `formatTime`, `formatDateTime` via `Intl.*` with pt-BR + `User.timezone` injection point.
- **Sage line-art SVG implementation** — inline SVG components with `currentColor` + 1.5 px stroke.
- **Desktop side-fill background** — same Paper Cream / Night Cream as the container.
- Exact CSS class naming inside Tailwind utilities, exact debounce timing on scroll save/restore (50–250 ms range), exact heartbeat interval (15–60 s range).
- Exact PWA icon sizes generated beyond the required 192 / 512 / 180 / maskable / monochrome / favicon set.

### Deferred Ideas (OUT OF SCOPE)

- Cards (generic Warm Ivory base primitive) → Phase 5
- Confidence ladder, plant card, care card section, "Cap atingido" / "Gerado por IA" chips → Phases 5/6/7
- Custom PWA install prompt → Phase 4 onboarding (or post-launch)
- View Transitions API → post-MVP
- Storybook / Chromatic / Percy → out of MVP
- Server-rendered user-local datetime helpers using `date-fns-tz` → Phase 4+
- Subscription read-only banner wiring → Phase 10
- Offline action queue wiring → Phase 9
- CSP header → explicitly deferred (Phase 1 D-23)
- Playwright WebKit + Firefox → add when iOS PWA install issues surface

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                       | Research Support                                                                                |
| ------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| UI-01  | Global design tokens — Paper Cream / Night Cream palettes + Source Serif 4 + Plus Jakarta Sans + Lucide | Standard Stack §Tailwind v4 + next/font/google + lucide-react; Validation §Snapshot rule        |
| UI-02  | Dark mode via `color-scheme: light dark` + manual override; every screen designed in both         | Compatibility Landmines §Tailwind v4 hybrid `@custom-variant`; Per-Requirement Pitfalls §UI-02  |
| UI-03  | Global focus ring 3 px Canopy @ 40 % + tab order matches visual + focus moves to main on route    | Per-Requirement Pitfalls §UI-03; Validation §axe smoke + per-route focus test                   |
| UI-14  | Bottom-nav 4 items (Home/Catálogo/Identificar/Perfil) + 28 px Lucide + 56 px + safe-area + scroll | Per-Requirement Pitfalls §UI-14; Validation §scroll-restore unit test                           |
| UI-17  | Skeletal shimmer loading (never spinners) + 300 ms threshold + 120 ms fade + reduced-motion       | Per-Requirement Pitfalls §UI-17; Validation §SkeletonGroup unit test                            |
| UI-18  | Empty states = Sage line-art + Source Serif headline + Calm Slate hint + ONE Canopy CTA           | Per-Requirement Pitfalls §UI-18; Validation §empty-state structural snapshot                    |
| UI-19  | Error states inline + calm + cause + recovery + retry path                                        | Per-Requirement Pitfalls §UI-19                                                                 |
| UI-20  | Spring physics motion + capture bounce + 3.2 s breathing + 60 ms cascade + reduced-motion         | Compatibility Landmines §motion v12; Per-Requirement Pitfalls §UI-20                            |
| UI-21  | Safe areas: `min-h-[100dvh]`, `env(safe-area-inset-*)`, no `h-screen`, no horizontal scroll       | Per-Requirement Pitfalls §UI-21                                                                 |
| UI-22  | Color never sole signal + alt text + live regions + modal focus trap + decorative SVG aria-hidden | Per-Requirement Pitfalls §UI-22; Validation §axe smoke + Radix focus-trap default               |
| UI-23  | next-intl day-one + `<html lang="pt-BR">` + `Intl.*` formatters + no hardcoded strings            | Per-Requirement Pitfalls §UI-23; Validation §formatter unit tests + ESLint no-hardcoded rule    |
| UI-24  | Persistent banners (offline + read-only + discard-summary toast)                                  | Per-Requirement Pitfalls §UI-24; Validation §useOnlineStatus heartbeat unit + visual            |
| UI-25  | Design-system guardrails enforced (no emoji / pure black-white / gradient / glass / Inter / etc.) | Open Risks §1 (eslint plugin); Validation §Stylelint + ESLint smoke                             |
| OFF-09 | Service worker + PWA manifest installable + standalone + theme color matches brand + viewport     | Compatibility Landmines §pwa-asset-generator; Per-Requirement Pitfalls §OFF-09                  |
| OFF-10 | App-update toast: SW waiting → "Nova versão disponível" + "Atualizar" → `skipWaiting` + reload    | Compatibility Landmines §Serwist user-controlled update; Per-Requirement Pitfalls §OFF-10       |

</phase_requirements>

## Live Version Matrix

All versions verified via `npm view <pkg> version` on **2026-04-26**. Tailwind v4.2.0 published 2026-02-18 and v4.2.4 on 2026-04-21 (current/recent). Motion v12.38.0 (Sep 2025+ semver line; 13.0.0-alpha.0 exists but not stable). All Radix primitives are on stable v1.x/v2.x with React 19 declared in peer ranges.

| Package                            | Latest Version | Tailwind v4 / Next 16 / React 19 / Serwist 9.5.7 OK?                                                               | Source                              |
| ---------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `tailwindcss`                      | **4.2.4**      | OK. v4 has no JS config — CSS-first. Stack-mate.                                                                   | `npm view tailwindcss version`      |
| `@tailwindcss/postcss`             | **4.2.4**      | OK. Pulls `@tailwindcss/node@4.2.4`, `@tailwindcss/oxide@4.2.4`, peer `postcss ^8.5.6`.                             | `npm view @tailwindcss/postcss`     |
| `postcss`                          | **8.5.12**     | OK. Higher than Next 16's bundled `postcss@8.4.31` dep — coexists fine.                                            | `npm view postcss version`          |
| `autoprefixer`                     | **10.5.0**     | Optional with Tailwind v4 (Tailwind v4 already bundles browserlist-aware vendor-prefix handling). See Landmines.   | `npm view autoprefixer version`     |
| `lucide-react`                     | **1.11.0**     | OK. Peer `react ^19.0.0`. Note: lucide-react went v1.0.0 GA in 2026 (versions before were `0.x`).                  | `npm view lucide-react version`     |
| `motion`                           | **12.38.0**    | OK. Peer `react ^18.0.0 \|\| ^19.0.0`. Wraps `framer-motion@^12.38.0`. v13.0.0-alpha.0 exists — stable on 12.x.    | `npm view motion version`           |
| `@radix-ui/react-dialog`           | **1.1.15**     | OK. Peer `react ^19.0.0` declared.                                                                                 | `npm view @radix-ui/react-dialog`   |
| `@radix-ui/react-tabs`             | **1.1.13**     | OK. Peer `react ^19.0.0` declared.                                                                                 | `npm view @radix-ui/react-tabs`     |
| `@radix-ui/react-dropdown-menu`    | **2.1.16**     | OK. Peer `react ^19.0.0` declared.                                                                                 | `npm view @radix-ui/react-dropdown-menu` |
| `@radix-ui/react-toast`            | **1.2.15**     | Available BUT D-11 picks `sonner`. Do NOT install Radix toast unless plan explicitly needs it.                     | `npm view @radix-ui/react-toast`    |
| `sonner`                           | **2.0.7**      | OK. Peer `react ^19.0.0`. v2.0.0 released 2025-02-18 (breaking changes from v1; see Landmines).                    | `npm view sonner version`           |
| `@axe-core/playwright`             | **4.11.2**     | OK. Peer `playwright-core >= 1.0.0`. Bundles `axe-core ~4.11.3`. Project pin: `@playwright/test 1.59.1` ✓.         | `npm view @axe-core/playwright`     |
| `stylelint`                        | **17.9.0**     | OK. v17 line; standard config v40 declares peer `stylelint ^17.0.0`.                                               | `npm view stylelint version`        |
| `stylelint-config-standard`        | **40.0.0**     | Peer `stylelint ^17.0.0`. Pair-pinned.                                                                             | `npm view stylelint-config-standard`|
| `pwa-asset-generator`              | **8.1.4**      | OK. Last published 2026-03-14. **DOES NOT generate monochrome icons** — see Open Risks #2.                         | `npm view pwa-asset-generator`      |
| `eslint-plugin-better-tailwindcss` | **4.4.1**      | OK. Peers `eslint ^9 \|\| ^10`, `tailwindcss ^3.3.0 \|\| ^4.1.17`. **Replacement for D-32's named plugin.** See OR#1. | `npm view eslint-plugin-better-tailwindcss` |
| `eslint-plugin-tailwindcss`        | 3.18.3 stable  | **PROBLEM — D-32 names this. Stable line is v3 (Tailwind v3 only). v4 is alpha/beta only.** See Open Risks #1.    | `npm view eslint-plugin-tailwindcss versions` |

**Confirmed already installed (do not re-add):** `next 16.2.3`, `react 19.2.5`, `react-dom 19.2.5`, `next-intl 4.9.1`, `@serwist/next 9.5.7`, `serwist 9.5.7`, `@sentry/nextjs 10.48.0`, `posthog-js 1.368.0`, `posthog-node 5.29.7`, `@playwright/test 1.59.1`, `vitest 4.1.4`, `eslint 9.39.4`, `typescript 5.9.3`.

**Verification commands the planner can paste into a verification block:**

```bash
npm view tailwindcss version
npm view @tailwindcss/postcss version
npm view motion version
npm view @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-dropdown-menu version
npm view sonner version
npm view lucide-react version
npm view @axe-core/playwright version
npm view stylelint stylelint-config-standard version
npm view eslint-plugin-better-tailwindcss version
npm view pwa-asset-generator version
```

## Compatibility Landmines

### Tailwind v4 + Next 16 + React 19

**`@theme` directive ≠ dark variants automatically.** Tailwind v4's `@theme` block declares design tokens; it does NOT automatically generate dark counterparts. The CONTEXT.md D-02/D-03 hybrid (light `:root` + auto dark via media query + manual `[data-theme=…]`) requires THREE token blocks in `globals.css` PLUS a `@custom-variant dark` declaration that targets BOTH the manual attribute AND the media query.

**Hybrid `@custom-variant` (paste verbatim into `globals.css`):**

```css
@import "tailwindcss";

@custom-variant dark {
  &:where([data-theme='dark'], [data-theme='dark'] *) { @slot; }
  @media (prefers-color-scheme: dark) {
    &:where(:not([data-theme] *)) { @slot; }
  }
}
```

The `:where(:not([data-theme] *))` guard means the media-query branch fires ONLY when no ancestor has `data-theme` — so an explicit `data-theme="light"` on `<html>` always wins over OS preference. This is the canonical pattern from the Tailwind v4 community discussions ([source — schoen.world](https://schoen.world/n/tailwind-dark-mode-custom-variant); [source — Tailwind discussion #15083](https://github.com/tailwindlabs/tailwindcss/discussions/15083)).

**`autoprefixer` is no longer required with Tailwind v4 + `@tailwindcss/postcss`.** Tailwind v4 handles vendor prefixing through its Lightning CSS pipeline. Including `autoprefixer` is a no-op at best; CONTEXT.md mentions it but the planner can skip the install ([source — Tailwind v4 docs](https://tailwindcss.com/docs/installation/using-postcss)).

**Existing `next.config.ts` does NOT have an explicit PostCSS config.** Next 16 auto-discovers `postcss.config.mjs` at repo root. Phase 3 must add it:

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

Without this, the `@import "tailwindcss"` in `globals.css` is treated as plain CSS and tokens never compile.

### Motion v12 + React 19 + Next 16 App Router

**`motion` (Framer Motion v12+ rebrand) requires `'use client'`.** Confirmed via [motion.dev/docs/react-installation](https://motion.dev/docs/react-installation): "Use Motion in Next.js App Router by marking the component file as a client component with the 'use client' directive." Every primitive that imports from `motion/react` must start with `"use client"`.

**Import path is `motion/react`, not `motion`.** Plans must use `import { motion, useReducedMotion, useAnimate } from "motion/react"` ([source — motion docs](https://motion.dev/docs/react-installation)).

**`useReducedMotion()` returns `null` on first server render → hydration mismatch risk.** Motion's hook reads `window.matchMedia("(prefers-reduced-motion)")` which is undefined during SSR. Inside Motion's own `<motion.div animate={…}>` consumers this is safe (Motion handles initial paint). For consumers outside `<motion.*>` (e.g., a plain `<div>` whose className depends on `useReducedMotion()`), the hook returns `null`/`false` first then `true` on hydration → potential flash. **Mitigation pattern:** keep reduced-motion-conditional logic inside the `animate` prop or `transition` prop where Motion suspends initial paint, NOT in `className` / inline style on the first render. For non-Motion CSS, prefer the `motion-reduce:` Tailwind variant over JS conditional rendering.

### Serwist 9.5.7 user-controlled update activation

The current `src/app/sw.ts` ships `skipWaiting: true, clientsClaim: true` (auto-activate on install). Phase 3 MUST invert this to user-controlled flow. **The change is THREE files at once — none alone is sufficient:**

**1. `next.config.ts` — disable auto-registration:**

```ts
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false,           // CHANGED from true
  scope: "/",
  swUrl: "/sw.js",
  disable: process.env.NODE_ENV === "development",
});
```

Setting `register: false` makes `@serwist/next` inject `window.serwist = new Serwist(…)` (the shared instance) but skip auto-`register()` so a React component can subscribe to events first ([source — Serwist `register` config](https://serwist.pages.dev/docs/next/configuring/register)).

**2. `src/app/sw.ts` — turn off `skipWaiting`/`clientsClaim`, add SKIP_WAITING listener:**

```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, StaleWhileRevalidate, NetworkOnly } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,        // CHANGED
  clientsClaim: false,       // CHANGED
  navigationPreload: false,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.registerCapture(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());
// StaleWhileRevalidate for /_next/static/* and image assets handled by defaultCache or explicit registerCapture

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();
```

**3. Client component (`src/app/(app)/sw-update-toast.tsx` or similar) — subscribe to `waiting` + send SKIP_WAITING + reload on `controlling`:**

```tsx
"use client";
import { useEffect } from "react";
import { Serwist } from "@serwist/window";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function SwUpdateToast() {
  const t = useTranslations("app.update");
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const serwist = new Serwist("/sw.js", { scope: "/", type: "classic" });
    serwist.addEventListener("waiting", () => {
      serwist.addEventListener("controlling", () => location.reload());
      toast(t("label"), {
        action: { label: t("cta"), onClick: () => serwist.messageSkipWaiting() },
        duration: Infinity,
      });
    });
    void serwist.register();
  }, [t]);
  return null;
}
```

The `waiting` event is the canonical Serwist 9 callback (NOT `onWaiting` / `onUpdated` — those are `next-pwa`/Workbox names). Confirmed via [Serwist docs](https://serwist.pages.dev/docs/window). The SKIP_WAITING message handler in the SW is REQUIRED — without it, `messageSkipWaiting()` is a no-op.

**Subscription order matters.** The toast component must register the `"waiting"` listener BEFORE calling `serwist.register()`, otherwise the very-first install (which fires `waiting` before any UI mounts on the second visit) is missed. The closure pattern above (`addEventListener` then `void serwist.register()`) is correct.

### `next/font/google` + Source Serif 4 + Plus Jakarta Sans

Both are variable fonts on Google Fonts. Variable-font usage with `next/font/google` does NOT take a `weight` array — the entire weight axis is exposed via `--font-*` CSS variable ([source — Next.js fonts docs](https://nextjs.org/docs/app/api-reference/components/font)).

**Pattern (paste into `src/app/layout.tsx`):**

```tsx
import { Source_Serif_4, Plus_Jakarta_Sans } from "next/font/google";

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-source-serif",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // …
  return (
    <html lang={locale} className={`${sourceSerif.variable} ${plusJakarta.variable}`}>
      …
    </html>
  );
}
```

Then in `globals.css` `@theme` block:

```css
@theme {
  --font-serif: var(--font-source-serif), Georgia, serif; /* serif fallback OK in @theme — design system bans it as actual fallback in token definition; document that the @theme line is template-only */
  --font-sans: var(--font-plus-jakarta), system-ui, sans-serif;
}
```

**Watch:** UI-25 / D-32 bans Inter, Times, Georgia, Garamond, Palatino as user-facing fallback. Stylelint must not flag the `@theme` line; carve out the rule scope to `@font-face` declarations and explicit `font-family` values, NOT `@theme` token declarations. Or omit the named fallbacks from `@theme` entirely and let the variable font's built-in fallback chain take over.

**Service-worker font precache:** Next 16 self-hosts Google fonts under `/_next/static/media/`. The Phase 3 SW's StaleWhileRevalidate route for `/_next/static/*` automatically catches them. No special font config needed. `font-display: swap` does NOT cause issues with precache.

### Tailwind v4 dark-mode strategy interaction with `@theme`

Tailwind v4 generates utilities (e.g., `bg-canopy`) from `@theme` token names like `--color-canopy`. If you want light/dark token VALUES to differ, the `@theme` block declares the LIGHT defaults and dark overrides live in plain CSS blocks scoped to the dark variant:

```css
@theme {
  --color-paper: #FBF7EF;
  --color-canopy: #1F4D35;
  --color-forest-ink: #143424;
  /* …all light defaults… */
}

/* Auto dark via system preference (no [data-theme] override) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --color-paper: #1A1613;
    --color-canopy: #6FAE8A;
    --color-forest-ink: #F2EADB;
    /* …all dark counterparts… */
  }
}

/* Manual dark override */
[data-theme="dark"] {
  --color-paper: #1A1613;
  --color-canopy: #6FAE8A;
  --color-forest-ink: #F2EADB;
  /* …same dark values… */
}

/* Manual light override (no media query consultation) */
[data-theme="light"] {
  --color-paper: #FBF7EF;
  --color-canopy: #1F4D35;
  --color-forest-ink: #143424;
  /* explicit re-declaration so OS dark doesn't bleed through */
}
```

**Critical:** the dark values are duplicated between the `@media` block and `[data-theme="dark"]`. Plans should extract them to a CSS custom-property partial OR accept the duplication and add a Stylelint `declaration-property-value-allowed-list` smoke test that asserts the two blocks remain in sync.

### `sonner` + Radix coexistence

Sonner v2 (current `2.0.7`) uses portal mounting and z-index `9999` by default. Radix Dialog uses portal too at z-index `auto` inside its own stacking context. **Stack risk:** if the modal sheet (Dialog) is open and a toast fires, the toast may render BEHIND the modal scrim (50 % opacity). Mitigation: explicitly raise sonner's container above Dialog overlay:

```tsx
import { Toaster } from "sonner";
// In (app)/layout.tsx:
<Toaster position="bottom-center" toastOptions={{ style: { zIndex: 10000 } }} />
```

Dialog default overlay z-index in Radix is unstyled — it inherits from stacking context. Plans should explicitly set Dialog `z-index: 50` (Tailwind `z-50`) on its overlay/content and `z-index: 60` on the sonner Toaster, OR set sonner above 9999 and Dialog content at the default. Either way: pick a deterministic stack order and document it.

### Playwright + `@axe-core/playwright` API

Current API ([source — `@axe-core/playwright` README](https://www.npmjs.com/package/@axe-core/playwright)):

```ts
import AxeBuilder from "@axe-core/playwright";

const results = await new AxeBuilder({ page }).analyze();
const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
expect(blocking).toEqual([]);
```

There is NO built-in severity filter on `AxeBuilder` — filter the `violations` array post-analyze. To assert axe across themes × motion preferences, use Playwright's `page.emulateMedia({ colorScheme: "dark" \| "light", reducedMotion: "reduce" \| "no-preference" })` to toggle, then re-analyze.

### `pwa-asset-generator` invocation

Single SVG → multi-asset generation. Pattern ([source — README](https://github.com/elegantapp/pwa-asset-generator)):

```bash
pnpm dlx pwa-asset-generator public/brand/logo.svg public/icons \
  --manifest public/manifest.webmanifest \
  --index src/app/layout.tsx \
  --background "#FBF7EF" \
  --opaque false \
  --maskable true \
  --favicon \
  --icon-only
```

**WARNING:** `--icon-only` skips splash-screen generation. Phase 3 doesn't need iOS splash screens (browser default is fine), but plans must verify the manifest output includes `apple-touch-icon` references.

**Monochrome icon problem:** `pwa-asset-generator` does NOT have a monochrome flag. CONTEXT.md D-17/manifest spec says "monochrome 192" must ship. See **Open Risks #2** for resolution paths.

## Per-Requirement Pitfalls

### UI-01 — Global design tokens (Paper Cream + Source Serif 4 + Plus Jakarta Sans + Lucide)

- **Tailwind v4 utility names derive from `@theme` keys.** A token `--color-paper-cream` produces utility `bg-paper-cream`. If you want shorter names (`bg-paper`), declare them as `--color-paper`. Plans should pick canonical short names BEFORE writing primitives so refactors don't cascade.
- **Source Serif 4 has `opsz` (optical size) variable axis** in addition to `wght`. By default `next/font/google` only loads `wght`. To unlock optical sizing, plans must add `axes: ['opsz']` to the `Source_Serif_4` config — but PRD §17 doesn't reference optical-size variants, so the default `wght`-only loadout is correct. Document the choice.
- **Lucide icons use `currentColor` + `strokeWidth` props.** `<HomeIcon strokeWidth={1.5} />` matches PRD spec; setting it inline on every usage is verbose. Plans may wrap a `<Icon>` shell that defaults `strokeWidth={1.5}` and accepts override.

### UI-02 — Dark mode (CSS-first auto + manual override via `folhario_theme` cookie)

- **Server Action that writes `folhario_theme` does NOT need `revalidatePath`.** Per Next.js 16 docs ([cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies)): "When cookies are modified in a Server Action, Next.js triggers a server-side re-render of the current page to update the UI." The action only needs `cookieStore.set('folhario_theme', value, opts)`; the same-page server re-render flips `<html data-theme>` automatically. Plans should NOT add `revalidatePath('/')` — it's redundant.
- **Cookie options for SSR roundtrip:** `{ path: '/', sameSite: 'lax', secure: true (in prod), maxAge: 60*60*24*365 }`. `httpOnly: false` is acceptable here because this cookie is a UX preference, not a credential — but document the choice.
- **First-paint flash is impossible to avoid 100 % when `auto`.** With no `data-theme` on `<html>` SSR-side, the CSS media query controls first paint — which means there's no flash IF the media query matches the user's OS. With manual override, SSR reads the cookie BEFORE rendering `<html data-theme="…">`, so still no flash. The only flash window is when: cookie is `auto` AND OS preference changes mid-session. That's an edge case and matches PRD intent.

### UI-03 — Global focus ring + tab order + focus moves to main on route change

- **`outline-offset: 2px` clips inside cards with `overflow: hidden`.** Plans must NOT set `overflow: hidden` on focus-ring-bearing containers. Use `overflow: visible` and clip with mask if needed.
- **`<main tabIndex={-1}>` programmatic focus does NOT scroll.** Plans must call `mainRef.current?.focus({ preventScroll: false })` to allow scroll-into-view, OR accept that long pages return-focus stays at scroll-top. Document the choice.
- **`usePathname` listener fires on hash changes too.** Plans should track previous pathname and only refocus on actual route segment changes, not on `/#anchor` updates within the same page.

### UI-14 — Bottom nav (4 items, 28 px Lucide, 56 px content + safe-area, scroll preservation)

- **`scrollY` save fires on every scroll → debounce is mandatory.** `lodash.debounce` adds a dep; for 150 ms debounce a hand-rolled `setTimeout` is fine. Plans should test cross-tab scroll-restore in a Playwright spec (scroll Home → switch to Catalog → switch back → assert scrollY ~ saved value within 1 px).
- **Safe-area inset on bottom nav uses `env(safe-area-inset-bottom)`.** Tailwind v4 doesn't ship a built-in utility for this. Either add to `@theme`: `--spacing-safe-bottom: env(safe-area-inset-bottom)` and use `pb-safe-bottom`, or add inline `style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}`.
- **Active indicator slide via `transform: translateX()` requires width measurement.** Plans should compute the indicator's `translateX` from the active tab's `getBoundingClientRect()` in a `useLayoutEffect`, debounced on resize. Avoid CSS-only approaches that misalign when label text length differs across translations.

### UI-17 — Skeletal shimmer + 300 ms gate + 120 ms fade + reduced-motion

- **300 ms gate is a JS timer, not a CSS delay.** The `<SkeletonGroup delay={300}>` returns `null` until `setTimeout(300)` resolves. Plans must clear the timer in cleanup (`useEffect` return) to avoid stale renders on fast navigation.
- **Reduced-motion fallback is "static block + 80 ms fade", NOT zero animation.** Plans must implement two paths in the skeleton component, gated by `useReducedMotion()` (client-only hook). The Tailwind `motion-reduce:animate-none` variant alone is insufficient because the shimmer keyframes don't auto-fall-back to a static block.
- **Skeleton width must match the post-load content's intrinsic width.** Otherwise content "jumps" in. Plans should pass the skeleton an explicit `width` prop (px or `ch` unit) per use-site.

### UI-18 — Empty state composer (Sage line-art + serif headline + slate hint + ONE Canopy CTA)

- **Founder-sourced SVGs may be missing on Phase 3 final review** (D-35). Empty-state primitive must ship with a placeholder render path — see Open Risks #3.
- **`aria-hidden="true"` on decorative SVG is mandatory.** axe will flag it as `decorative-img-alt` if missing.
- **Empty-state CTA is exactly ONE button.** Plans must NOT accept `secondaryCta?: ReactNode` props — the API itself enforces D-25 / PRD §17. Add a Vitest snapshot rule that fails if the rendered tree contains more than one `<button>` descendant inside `<EmptyState>`.

### UI-19 — Inline calm error (CAUSE + RECOVERY + retry path)

- **Inline error component MUST require all three slots.** TypeScript `Required<{ cause, recovery, retry }>` props prevent partial compositions. Plans should not provide a "minimal" variant.
- **Color choice is Overdue Rust / Copper, NEVER Urgent Poppy.** PRD §17 reserves Poppy for toxicity + destructive only. Plans must lint-enforce this via Stylelint allowed-color list scoped to the inline-error component file.

### UI-20 — Spring physics + capture bounce + breathing + 60 ms cascade + reduced-motion

- **Capture button breathing loop is a `repeat: Infinity` animation.** Plans must wrap it in `useReducedMotion()` and conditionally drop the `animate` prop entirely (NOT just stop the animation), or the GPU layer stays composited and burns battery.
- **Spring constants from `springs.ts` must be deep-frozen** to prevent accidental mutation by consumers. `Object.freeze({ stiffness: 120, damping: 18, mass: 1 })`.
- **60 ms cascade on list reveal** is Phase 5+ for actual lists — Phase 3 ships only the cascade utility. Plan must export but not consume it.

### UI-21 — Safe areas + `min-h-[100dvh]` + no horizontal scroll

- **`min-h-[100dvh]` is supported in Safari 15.4+.** All target browsers (PWA install on iOS 16+ per CLAUDE.md) support it. No fallback needed.
- **`h-screen` is BANNED** because of the iOS Safari dynamic-viewport jump. ESLint custom rule: ban `className` strings containing the literal `\bh-screen\b`.
- **Horizontal scroll is a critical failure** EXCEPT the Phase 5+ Home "Today's tasks" strip. Plans should add a Playwright assertion that `document.body.scrollWidth <= document.body.clientWidth` for every Phase 3 placeholder page in both themes.

### UI-22 — Color never sole signal + alt text + live regions + modal focus trap + decorative SVG aria-hidden

- **Radix Dialog ships focus-trap by default** and returns focus to the invoker on close. Plans don't need to hand-roll. But: the trap fails if the Dialog mounts BEFORE its trigger (e.g., modal opens via URL parameter on first paint). Plans must verify return-focus with a Playwright spec.
- **Skip-link "Ir para o conteúdo principal" must be the FIRST focusable element in tab order.** Implement as `<a href="#main" class="sr-only focus:not-sr-only">…</a>` placed at the top of `<body>` BEFORE all other content.
- **`aria-live="polite"` regions must be present in DOM at first render** — adding them dynamically when an async event fires can cause AT to miss the announcement. Plans should always render an empty `<div role="status" aria-live="polite">` and update its `textContent` on event.

### UI-23 — next-intl + `<html lang="pt-BR">` + `Intl.*` formatters + no hardcoded strings

- **`next-intl` `useTranslations()` is a client-side hook; `getTranslations()` is server-side.** In Server Components, plans must use `getTranslations()` from `next-intl/server`. Mixing them silently downgrades performance.
- **`Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })` returns `26/04/2026`** (verified). For 24h format use `{ timeStyle: 'short', hour12: false }` returning `14:30`. Currency is straightforward: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` returns `R$ 29,90`.
- **No-hardcoded-strings ESLint rule** can use `eslint-plugin-react/jsx-no-literals` with `noStrings: true`. Plans must scope the rule to `src/app/**/*.tsx` and `src/shared/ui/**/*.tsx`, excluding test files (which use literal copy in assertions). Strings inside `<i lang="la">` (scientific names from data) are also exempt — PRD §17 keeps them as literal data.

### UI-24 — Persistent banners (offline + read-only + discard-summary toast)

- **`useOnlineStatus` heartbeat must back off when offline** to avoid spamming `/api/v1/health/connectivity` while disconnected. Specifics: 30 s when online → 60 s after a successful ping → 5 s when window-`online` event fires (catch reconnection quickly). Plans must implement the backoff with `setTimeout`, NOT `setInterval` (interval can drift under throttling).
- **Heartbeat endpoint MUST be `/api/v1/health/connectivity`, NEVER `/api/v1/diagnostics/ping`.** The diagnostics route is CI/stub-mode-gated and returns 404 in production (Phase 1 D-27). Plans introducing the `useOnlineStatus` hook must add a Vitest test that asserts the URL string matches.
- **Read-only banner ships prop-driven, defaults `active={false}`.** Plans must thread `active` through `(app)/layout.tsx` and Phase 3 sets it `false` everywhere. Phase 10 wires real subscription state.

### UI-25 — Design system guardrails (no emoji / pure black-white / gradient / glass / Inter / etc.)

- **Open Risk #1 — `eslint-plugin-tailwindcss` named in D-32 doesn't fully support Tailwind v4.** Plans must use `eslint-plugin-better-tailwindcss@4.4.1` instead. Or wait for the v3-line plugin's v4-stable release (currently alpha/beta). Recommend `better-tailwindcss` because it ships v4 support today and wires via Tailwind's CSS `entryPoint` instead of a JS config file.
- **Stylelint `declaration-property-value-disallowed-list` forbids pure black/white:** rule config must list both `#000000`, `#000`, `rgb(0, 0, 0)`, `rgb(0,0,0)`, `black`, and the same for white. Plans should add a "valid spelling" allowlist test that catches `#0%` typos.
- **`backdrop-filter` ban** — Stylelint `function-disallowed-list` doesn't catch property bans. Use `declaration-property-value-disallowed-list` with `backdrop-filter: /.*/`.
- **Banned `@font-face` families** require Stylelint `at-rule-disallowed-list` partial — easiest to lint at `font-family` declarations: `declaration-property-value-disallowed-list` with `font-family: /(Inter|Times|Georgia|Garamond|Palatino)/i`. The `@theme` `--font-*` declarations are exempt because they reference variable-font tokens, not the banned families.
- **Emoji ban** — ESLint can detect with regex on JSX text nodes. Quickest custom rule: walk JSX text and string literals, fail on `[\u{1F300}-\u{1FAFF}]` or `[\u{2600}-\u{27BF}]` Unicode ranges.

### OFF-09 — PWA installable + manifest + theme color matches brand + viewport

- **Existing `public/manifest.webmanifest` has `theme_color: "#FFFFFF"` — banned by PRD §17.** Phase 3 rewrites with `#FBF7EF` (Paper Cream).
- **Dual `<meta name="theme-color">` is iOS Safari + Android Chrome compatible** ([source — MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name)). Both must live in `<head>` of root layout, not in manifest.
- **Manifest `icons[]` must include `purpose: "maskable"` for at least one entry** for Android adaptive-icon support. `pwa-asset-generator` with `--maskable true` adds this declaration.
- **Open Risk #2 — `pwa-asset-generator` does not generate monochrome icons.** Either drop the monochrome variant from spec or hand-author. See Open Risks.

### OFF-10 — App-update toast (SW waiting → toast → skipWaiting + reload)

- **Phase 1's SW posture (`skipWaiting: true, clientsClaim: true`) is the OPPOSITE of what OFF-10 needs.** Phase 3 must change all three pieces (next.config, sw.ts, client component) — see Compatibility Landmines §Serwist for full code.
- **The `controlling` event listener must be added INSIDE the `waiting` handler**, not at module scope — the `controlling` event fires only when `messageSkipWaiting()` succeeds, so listening earlier wastes a slot.
- **Reduced-motion fallback** for sonner: pass `motion-reduce` aware `style` props or use sonner's `unstyled: true` and apply Tailwind classes including `motion-reduce:animate-none`.
- **Toast persists across route changes** = sonner's default behavior (it renders in a portal). No special wiring needed beyond mounting the `<Toaster>` once in `(app)/layout.tsx`.

## Validation Architecture

### Test Framework

| Property            | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| Framework (unit)    | Vitest 4.1.4 (project: `unit`)                                                       |
| Framework (e2e)     | Playwright 1.59.1 (Chromium only)                                                    |
| Config file (unit)  | `vitest.config.ts` (root, with `tests/unit/setup-env.ts` setupFile)                  |
| Config file (e2e)   | `playwright.config.ts` (root, `webServer: pnpm start`, port 3000)                    |
| Quick run command   | `pnpm test:unit` (Vitest unit project, ~seconds)                                     |
| Full suite command  | `pnpm test:unit && pnpm test:integration && pnpm test:e2e`                           |
| Lint suite          | `pnpm lint && pnpm lint:styles` (the latter NEW in Phase 3)                          |
| Snapshot baselines  | Stored next to test file in `tests/e2e/__screenshots__/{spec}/{test}-{platform}.png` |

### Phase Requirements → Test Bucket Map

| Bucket                   | Test type                                                | What it covers                                                                                                                                  |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **TDD-eligible (Vitest)** | Unit tests in `tests/unit/`                              | Pure functions + React component contract that doesn't require visual paint                                                                      |
| **Visual snapshot (Playwright)** | `tests/e2e/visual-*.spec.ts` with `toHaveScreenshot()` | Pixel-diff per page × theme × motion preference                                                                                                 |
| **A11y assertion (axe)** | `tests/e2e/axe-*.spec.ts` with `@axe-core/playwright`    | Serious + critical violations only (warn on moderate)                                                                                            |
| **Declarative / not-tested** | Manual review or build-time lint                     | Token CSS blocks, manifest JSON shape, font loader registration, icon-generation script (CI never runs `icons:generate`; outputs committed)     |

### TDD-eligible (Vitest unit project) — concrete files + acceptance criteria

| File to create                                            | Covers Req | Acceptance criteria                                                                                                                                   |
| --------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/use-online-status.test.ts`                    | UI-24      | (a) returns `true` when `navigator.onLine` true and heartbeat 200; (b) returns `false` after heartbeat fails 1 time; (c) backs off to 60 s after success; (d) hits **`/api/v1/health/connectivity`** literally — fails if URL drifted to `/api/v1/diagnostics/ping`. |
| `tests/unit/skeleton-group.test.tsx`                      | UI-17      | (a) renders `null` for first 300 ms after mount; (b) renders children after 300 ms; (c) clears timer in cleanup; (d) under reduced-motion (mock `useReducedMotion → true`) renders static block + 80 ms `opacity` transition (assert by class).                  |
| `tests/unit/format.test.ts`                               | UI-23      | (a) `formatCurrencyBRL(2990)` → `"R$ 29,90"`; (b) `formatDate(new Date('2026-04-26'))` → `"26/04/2026"`; (c) `formatTime` → `"14:30"` (no AM/PM); (d) `formatDateTime` → `"26/04/2026 14:30"`; (e) accepts ISO string OR Date; (f) `formatTime` with `tz` arg respects timeZone. |
| `tests/unit/use-theme.test.ts`                            | UI-02      | (a) returns `'auto'` when no cookie; (b) writes `folhario_theme=dark` via Server Action; (c) Server Action returns void (no explicit `revalidatePath`).                                                                                  |
| `tests/unit/sw-skip-waiting.test.ts`                      | OFF-10     | (a) on `message` event with `data.type === "SKIP_WAITING"`, `self.skipWaiting()` is invoked; (b) other message types are ignored.                                                                                                                                |
| `tests/unit/empty-state.test.tsx`                         | UI-18      | (a) renders illustration (aria-hidden), headline, hint, exactly 1 button; (b) throws/lint-fails when given >1 CTA via children.                                                                                                                                  |
| `tests/unit/inline-error.test.tsx`                        | UI-19      | (a) requires cause, recovery, retry props (TS + runtime); (b) does not use Urgent Poppy color class; (c) `role="alert"` present.                                                                                                                                  |
| `tests/unit/scroll-restore.test.ts`                       | UI-14      | (a) saves `scrollY` to `sessionStorage[pathname]` on scroll (debounced); (b) restores in `useLayoutEffect` on tab change; (c) does NOT restore on hash-only changes.                                                                                              |
| `tests/unit/breathing-loop.test.tsx`                      | UI-20      | (a) without reduced-motion: capture button has `animate={{ scale: [1,1.02,1] }}`; (b) with reduced-motion: `animate` prop is undefined (NOT just stopped — entirely absent).                                                                                     |
| `tests/unit/banned-patterns-snapshot.test.ts`             | UI-25      | Snapshot rule: walks `src/shared/ui/**/*.tsx` source text, asserts no `#000`, `#FFF`, `linear-gradient`, `Inter`, `Times`, `Georgia` literal occurrences. Asserts every spring-driven component imports `useReducedMotion`.                                       |
| `tests/unit/heartbeat-route-contract.test.ts`             | UI-24      | Imports `src/app/api/v1/health/connectivity/route.ts` POST/GET handlers; asserts (a) responds 200 with `{ ok: true, timestamp: <ISO> }`; (b) `Cache-Control: no-store` header set.                                                                              |
| `tests/unit/manifest-shape.test.ts`                       | OFF-09     | Reads `public/manifest.webmanifest`; asserts (a) `name === "Folhário"`; (b) `theme_color === "#FBF7EF"` (NOT `#FFFFFF`); (c) `icons` array contains 192/512/maskable entries; (d) `lang === "pt-BR"`.                                                            |
| `tests/unit/messages-coverage.test.ts`                    | UI-23      | Reads `src/messages/pt-BR.json`; asserts every key listed in CONTEXT.md §Specifics is present and non-empty.                                                                                                                                                       |

### Visual snapshot (Playwright) — concrete files + acceptance criteria

| File to create                                  | Covers Req      | Acceptance criteria                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/visual-snapshots.spec.ts`            | UI-01..UI-25    | For each route in `['/', '/catalog', '/identify', '/profile', '/offline']`, with each `[colorScheme, reducedMotion]` in `[['light','no-preference'],['light','reduce'],['dark','no-preference'],['dark','reduce']]`: `await page.emulateMedia({colorScheme, reducedMotion}); await expect(page).toHaveScreenshot()` with `animations: 'disabled'`. **20 snapshots minimum.** Date/time fields masked via `mask: [page.locator('[data-snapshot-mask="true"]')]`. |
| `tests/e2e/sw-update-toast.spec.ts`             | OFF-10          | Programmatically dispatch a SW `waiting` event (mock `serwist.addEventListener`); assert sonner toast renders with i18n `app.update.label` text + button labelled `app.update.cta`; clicking the button calls `messageSkipWaiting`; `controlling` triggers `location.reload()`.   |
| `tests/e2e/bottom-nav-scroll-restore.spec.ts`   | UI-14           | Navigate to `/`, scroll to y=400, click Catalog tab, scroll to y=200, click Home tab, assert window.scrollY ~ 400 within 1 px.                                                                                                                                                    |
| `tests/e2e/horizontal-scroll-guard.spec.ts`     | UI-21           | For each Phase 3 route, assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth` (tolerate 1 px subpixel).                                                                                                                                            |
| `tests/e2e/offline-fallback.spec.ts`            | OFF-09          | `await context.setOffline(true)`; navigate to an uncached URL; assert `/offline` page renders with empty-state primitive structure (illustration + headline + hint + CTA).                                                                                                         |

### A11y assertion (axe) — concrete files + acceptance criteria

| File to create                          | Covers Req | Acceptance criteria                                                                                                                                                                                                                                                                  |
| --------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/axe-placeholder-pages.spec.ts` | UI-03 + UI-22 + D-33 | For each route × theme × motion-preference combo: `const results = await new AxeBuilder({page}).analyze(); const blocking = results.violations.filter(v => v.impact === 'critical' \|\| v.impact === 'serious'); expect(blocking).toEqual([])`. Warn-log moderate violations to stdout (do not fail). |
| `tests/e2e/axe-modal-focus-trap.spec.ts`  | UI-22      | Open the modal sheet via test fixture; tab through all focusable; assert focus cycles inside Dialog (does not escape); close Dialog; assert focus returns to invoker.                                                                                                                |
| `tests/e2e/axe-route-focus-move.spec.ts`  | UI-03      | Navigate `/` → `/catalog` via bottom-nav; assert `document.activeElement === document.querySelector('main')` after navigation.                                                                                                                                                       |
| `tests/e2e/axe-skip-to-main.spec.ts`      | UI-22      | Press Tab on initial load; assert first focused element is the skip-link with text `focus.skipToMain` translation; clicking it moves focus to `<main>`.                                                                                                                              |

### Declarative / not-tested (manual review or build-time lint)

- `src/app/globals.css` `@theme` block — code review against PRD §17 token table.
- `public/manifest.webmanifest` content beyond shape (icons array correctness, `purpose` flags) — manual verification against installed PWA (manual smoke test on real device + Lighthouse PWA audit).
- Font loader configuration in `src/app/layout.tsx` — code review.
- `next.config.ts` extension wrappers — already established by Phase 1.
- `pnpm icons:generate` script execution — runs locally only; outputs committed; CI never re-runs.
- Stylelint + ESLint custom rule code itself (no meta-tests; the rules' EFFECT is tested by `tests/unit/banned-patterns-snapshot.test.ts`).

### Sampling rate

- **Per task commit:** `pnpm test:unit` + `pnpm lint` + `pnpm lint:styles` (~seconds). TDD-eligible files in green state.
- **Per wave merge:** `pnpm test:unit && pnpm test:integration && pnpm test:e2e` (~minutes; full Playwright matrix).
- **Phase gate (`/gsd-verify-work`):** Full suite green INCLUDING visual snapshots (re-baseline only with explicit human sign-off). axe blocking violations zero. Stylelint + ESLint zero errors. Manual PWA install on iOS Safari + Android Chrome with screenshots in summary.

### Wave 0 gaps (must exist before red→green tasks)

- [ ] `tests/unit/setup-env.ts` extension to mock `window.matchMedia` for SSR-safe `useReducedMotion` testing (current setup-env doesn't include matchMedia mock).
- [ ] `playwright.config.ts` extension: enable per-test `colorScheme` + `reducedMotion` parameterization OR document the `await page.emulateMedia()` pattern in a shared fixture.
- [ ] `stylelint.config.mjs` (NEW) with banned-pattern rules wired into `pnpm lint:styles` script + `lint-staged` CSS entries.
- [ ] `eslint.config.mjs` extension: add custom rule files + `eslint-plugin-better-tailwindcss` (NOT `eslint-plugin-tailwindcss`).
- [ ] `tests/e2e/__screenshots__/` baseline generation: first run with `pnpm test:e2e --update-snapshots` locally; commit as initial baselines (planner must call out this is a one-time human-supervised step).
- [ ] `src/app/api/v1/health/connectivity/route.ts` (NEW route) — required before `useOnlineStatus` heartbeat tests can pass.

## Cross-Cutting Truths

These invariants apply to EVERY plan in Phase 3. The planner should copy them verbatim into `must_haves.truths`:

1. **No `@/*` import alias.** Only `@contexts/*`, `@shared/*`, `@i18n/*`. Phase 3 places UI primitives under `src/shared/ui/`, motion under `src/shared/motion/`, theme under `src/shared/theme/`, online detection under `src/shared/online/`, i18n helpers under `src/shared/i18n/`, typography under `src/shared/typography/`.
2. **No barrel files.** Direct imports only. Do NOT introduce `src/shared/ui/index.ts`.
3. **Webpack build only.** `next build --webpack` is load-bearing for Serwist 9.5.7 (Turbopack incompatible). Do NOT change the build script. Dev still uses default Turbopack.
4. **TypeScript strict + `noUncheckedIndexedAccess`.** Every new file must satisfy both. Use `??` and explicit guards instead of `!` non-null assertions.
5. **Every visible string flows through `useTranslations()` (client) or `getTranslations()` (server).** No hardcoded copy. Add the string to `src/messages/pt-BR.json` first.
6. **Every motion respects `useReducedMotion()`.** Either: (a) condition `animate`/`transition` props on the hook, OR (b) use Tailwind `motion-reduce:` variant. Custom ESLint rule fails on `@keyframes` without paired `motion-reduce` fallback.
7. **Every test file lives in `tests/unit/*.test.ts(x)` (Vitest) or `tests/e2e/*.spec.ts` (Playwright).** No co-located tests. Vitest projects are `unit` + `integration`; Phase 3 lands in `unit`.
8. **Every primitive in `src/shared/ui/` that imports from `motion/react`, uses `next/headers`, `useEffect`, or `useState` MUST start with `"use client"`.** Server-component primitives (e.g., pure layout shells) may omit it.
9. **Every Lucide icon import is per-icon** (`import { HomeIcon } from "lucide-react"`), NEVER `import * as Lucide from "lucide-react"`. Tree-shake correctness.
10. **Bottom nav has exactly 4 items, max 5.** Phase 3 ships 4. Adding a fifth requires PRD §17 review.
11. **`folhario_theme` cookie is the only theme persistence.** No `localStorage` writes.
12. **Heartbeat URL is `/api/v1/health/connectivity`** — never `/api/v1/diagnostics/ping`. Vitest contract test enforces.
13. **Conventional Commits + Husky + lint-staged + commitlint** per Phase 1 D-04. Every commit must pass.
14. **Source maps for Sentry are uploaded post-build in Phase 12 deploy workflow** — Phase 3 does NOT add source-map upload to Phase 1's `ci.yml`.
15. **`/offline` route is plain (not underscore-prefixed).** Next App Router silently excludes underscore-prefixed segments (Phase 1 D-27 lesson).

## Test Convention Discovery

Direct read of repo on 2026-04-26:

| Aspect                | Layout                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Vitest projects       | Two — `unit` (`tests/unit/**/*.test.ts`) + `integration` (`tests/integration/**/*.integration.test.ts`) |
| Vitest config         | `vitest.config.ts` at repo root with `defineConfig({ test: { projects: [...] } })`                    |
| Vitest unit setup     | `tests/unit/setup-env.ts` (loaded only into `unit` project, NOT integration)                           |
| Playwright tests dir  | `tests/e2e/`                                                                                          |
| Playwright config     | `playwright.config.ts` at repo root, Chromium-only, `webServer: pnpm start`, port 3000                 |
| Existing test count   | 8 unit (sentry-scrub, server-env, errors, scaffold, client-env, ci, env-example, setup-env helper); 2 integration (postgres-connection, diagnostics-server-probe); 5 e2e (diagnostics-sentry, security-headers, pwa-smoke, diagnostics-posthog, sentry-local-mode) |
| ESLint config         | `eslint.config.mjs` flat config; consumes `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, `eslint-config-prettier`. Custom rule already wired: `@typescript-eslint/no-unused-vars` warn |
| Stylelint config      | **DOES NOT EXIST.** Phase 3 must create `stylelint.config.mjs`.                                       |
| Tailwind config       | **DOES NOT EXIST.** Phase 3 ships `globals.css` with CSS-first `@theme` block (no `tailwind.config.js`). |
| PostCSS config        | **DOES NOT EXIST.** Phase 3 must create `postcss.config.mjs` for `@tailwindcss/postcss` auto-discovery. |
| `lint-staged` config  | In `package.json`. Currently runs Prettier + ESLint on `*.{ts,tsx,js,jsx,mjs}`. Phase 3 must add `*.css` → `stylelint --fix`. |
| `lint:styles` script  | **DOES NOT EXIST in `package.json` `scripts`.** Phase 3 adds it.                                      |
| Path aliases          | `@contexts/*`, `@shared/*`, `@i18n/*` — declared in `tsconfig.json` `paths` and reused by `vite-tsconfig-paths` for Vitest. NO `@/*`. |
| Test naming           | Unit: `*.test.ts`/`.tsx`. Integration: `*.integration.test.ts`. E2E: `*.spec.ts`.                     |

## Open Risks

These items are NOT covered by CONTEXT.md but the planner needs to surface them for user decision before plans are written.

### Open Risk #1 — D-32 names `eslint-plugin-tailwindcss` but it's not Tailwind v4-ready

**Verified facts (2026-04-26):**

- `eslint-plugin-tailwindcss` stable line is `3.18.3` (last published 2025; supports Tailwind v3 only).
- v4 line is `4.0.0-alpha.0` … `4.0.0-beta.0` only (no stable v4 release).
- The community-recommended replacement is **`eslint-plugin-better-tailwindcss@4.4.1`** ([npm](https://www.npmjs.com/package/eslint-plugin-better-tailwindcss), [GitHub](https://github.com/schoero/eslint-plugin-better-tailwindcss)). It declares peers `eslint ^9 || ^10` and `tailwindcss ^3.3.0 || ^4.1.17` — fully v4-ready. Configures via Tailwind v4's CSS `entryPoint` instead of a JS config file.

**Resolution paths:**

1. **Recommended:** Plan replaces `eslint-plugin-tailwindcss` with `eslint-plugin-better-tailwindcss@4.4.1`. The user's named tool is non-functional for Tailwind v4; this is an empirical correction, not a discretion override.
2. **Alternative:** Wait for `eslint-plugin-tailwindcss@4.0.0` stable release (release window unknown). Phase 3 ships without that lint and re-introduces it in a follow-up phase.
3. **Discard:** Skip Tailwind-specific lint entirely; rely only on Stylelint (covers banned-patterns) + Vitest snapshot rule (covers token presence). This loses the class-order enforcement.

**Recommendation:** Path 1. Note the substitution in the plan summary and update CONTEXT.md D-32 retroactively.

### Open Risk #2 — `pwa-asset-generator` does not generate monochrome icons

**Verified facts (2026-04-26):**

- `pwa-asset-generator@8.1.4` README documents `--maskable`, `--favicon`, `--icon-only`, `--splash-only`. **No monochrome flag exists.** Confirmed via README scan.
- The Web App Manifest spec (W3C) supports `purpose: "monochrome"` for monochrome adaptive icons used in app drawer ([source — MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest/icons)). Browser support varies (Chrome on Android primarily).

**Resolution paths:**

1. **Drop monochrome from spec.** Manifest declares only `purpose: "any maskable"`. Lose the Android adaptive-icon variant. Acceptable for MVP.
2. **Hand-author the monochrome SVG.** Founder ships a single-color brand mark; Phase 3 references it directly in manifest with `purpose: "monochrome"`. Adds a small founder-asset task.
3. **Use a second tool.** `@vite-pwa/assets-generator` ([source](https://vite-pwa-org.netlify.app/assets-generator/)) supports monochrome via preset configuration. Adds a tool dependency outside Vite ecosystem (works as a CLI, no Vite required).

**Recommendation:** Path 1 for Phase 3 ship. Path 2 if founder delivers monochrome SVG before final review (already in D-35 founder asset checklist — add it).

### Open Risk #3 — Brand-asset placeholder spec undefined

CONTEXT.md D-35 says "placeholder SVGs ship if not delivered" but doesn't define the placeholder spec. Plans need a concrete fallback contract.

**Question for the user:** When `public/illustrations/empty-home.svg` is missing on Phase 3 final review, the empty-state primitive should render:

1. **An inline-coded shape primitive.** A simple `<svg viewBox="0 0 64 64" stroke="currentColor" strokeWidth="1.5" fill="none">` with a generic leaf-or-pot outline. Visually placeholder but structurally correct.
2. **Text-only fallback.** Skip the illustration slot; render only headline + hint + CTA. The empty-state contract has 4 parts (illustration + headline + hint + CTA); dropping #1 violates D-25/PRD §17.
3. **A boxed placeholder (`bg-sage` rectangle).** Indicates "asset missing" visually so reviewers know to deliver final art.

**Recommendation:** Path 1 (inline-coded leaf shape). Plans ship the placeholder shape inline; founder asset replaces it with a single-file diff. Confirm with user before plan execution.

### Open Risk #4 — Server Action that writes `folhario_theme` cookie + same-page re-render contract

Per Next.js 16 docs, a Server Action that writes a cookie triggers an automatic same-page server re-render. The planner does NOT need explicit `revalidatePath`. **However**, this only works when the cookie is read in the layout/page tree being re-rendered. If the layout reads the cookie via `cookies()` from `next/headers` and uses it to determine the `<html data-theme="…">` attribute, the re-render flips the attribute correctly.

**Hidden gotcha:** the `<html>` attribute is owned by `src/app/layout.tsx` (root layout). Root layout MUST read the cookie BEFORE rendering. If a child layout reads the cookie, the root re-render won't pick up the change. Plan must place the cookie read in `src/app/layout.tsx`, not `(app)/layout.tsx`.

**No user decision needed**, but the planner should add this as a verification step in the theme-toggle task.

### Open Risk #5 — Visual-snapshot baseline generation in CI

Snapshots are pixel-comparison. Generating baselines locally and committing them is the standard pattern, but font rendering can differ between local macOS and CI Linux. Common mitigations:

1. **Run baselines via Docker** (Playwright's `mcr.microsoft.com/playwright` image) to match CI environment.
2. **Tolerate small diffs** with `toHaveScreenshot({ maxDiffPixels: 100 })`.
3. **Generate baselines IN CI on first run** by pushing a `--update-snapshots` flag manually, then committing the baselines from a CI artifact.

**Recommendation:** Option 1. Plan task that introduces visual snapshots adds a local Docker recipe (`pnpm visual:baseline:docker`) to the package.json and documents it. Avoids CI/local rendering drift.

### Open Risk #6 — Skeleton 300 ms gate during streaming SSR

Next 16 supports streaming SSR. If a slow async Server Component is wrapped in `<Suspense fallback={<SkeletonGroup>…}>`, the 300 ms timer starts on the CLIENT after the SSR fallback renders. By that time, the server may already be streaming the resolved content, and the gate becomes moot. **Implication:** the `delay={300}` gate is semantically a CLIENT loading-indicator contract, not an SSR one. Plans must document that Phase 3's skeleton primitive applies to client-side state transitions (e.g., `<form>` submit, `useTransition`), NOT to Suspense fallbacks.

**No user decision needed.** Document the contract.

### Open Risk #7 — `eslint-plugin-better-tailwindcss` configuration with CSS entrypoint

Better-tailwindcss requires `entryPoint: 'src/app/globals.css'` in its plugin settings (NOT a JS config path like the v3 plugin). Plans must wire this in `eslint.config.mjs`:

```js
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

// inside config array:
{
  plugins: { "better-tailwindcss": betterTailwindcss },
  settings: { "better-tailwindcss": { entryPoint: "src/app/globals.css" } },
  rules: { ...betterTailwindcss.configs["recommended"].rules },
}
```

If `globals.css` is empty / missing the `@import "tailwindcss"`, the plugin throws on load. Plan ordering matters: create `globals.css` with the `@import` BEFORE wiring the ESLint plugin.

## Sources

### Primary (HIGH confidence)

- [Tailwind CSS — Dark mode docs](https://tailwindcss.com/docs/dark-mode) — `@custom-variant` syntax, manual override patterns
- [Tailwind v4 GitHub Discussion #15083 — CSS variables for dark/light mode](https://github.com/tailwindlabs/tailwindcss/discussions/15083) — combined `@custom-variant` with media query fallback
- [schoen.world — Flexible Dark Mode with Tailwind CSS v4 Custom Variants](https://schoen.world/n/tailwind-dark-mode-custom-variant) — canonical hybrid `@custom-variant` pattern
- [Serwist docs — `@serwist/window`](https://serwist.pages.dev/docs/window) — `waiting`, `controlling`, `messageSkipWaiting` API
- [Serwist docs — `@serwist/next/configuring/register`](https://serwist.pages.dev/docs/next/configuring/register) — `register: false` for manual registration
- [Serwist docs — getting started](https://serwist.pages.dev/docs/next/getting-started) — basic SW template + `defaultCache` import
- [Serwist docs — runtime caching navigation route](https://serwist.pages.dev/docs/serwist/runtime-caching/routing/navigation-route) — `NavigationRoute` + `precacheOptions.navigateFallback`
- [Motion docs — react-installation](https://motion.dev/docs/react-installation) — `'use client'` directive requirement
- [Motion docs — react-use-reduced-motion](https://motion.dev/docs/react-use-reduced-motion) — `useReducedMotion` hook patterns
- [Motion docs — react-accessibility](https://motion.dev/docs/react-accessibility) — replace transform animations with opacity transitions
- [Next.js docs — fonts (App Router)](https://nextjs.org/docs/app/api-reference/components/font) — variable font config + multiple Google fonts via CSS variables
- [Next.js docs — cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies) — `cookies.set()` options + Server Action automatic re-render
- [Next.js docs — Server Actions cookies](https://github.com/vercel/next.js/blob/canary/docs/01-app/01-getting-started/07-mutating-data.mdx) — automatic same-page server re-render on cookie write
- [@axe-core/playwright npm](https://www.npmjs.com/package/@axe-core/playwright) — `AxeBuilder.analyze()` API + violation filtering
- [Playwright docs — visual comparisons](https://playwright.dev/docs/test-snapshots) — `toHaveScreenshot()` + `mask` + `animations: 'disabled'`
- [Playwright docs — page.emulateMedia](https://playwright.dev/docs/api/class-page#page-emulate-media) — `colorScheme` + `reducedMotion` toggling
- [eslint-plugin-better-tailwindcss npm](https://www.npmjs.com/package/eslint-plugin-better-tailwindcss) + [GitHub](https://github.com/schoero/eslint-plugin-better-tailwindcss) — Tailwind v4-ready ESLint plugin

### Secondary (MEDIUM confidence)

- [pwa-asset-generator GitHub README](https://github.com/elegantapp/pwa-asset-generator) — CLI flags + manifest update
- [Sonner npm 2.0.7](https://www.npmjs.com/package/sonner) — `Toaster` props + `toastOptions`
- [Source Serif 4 — Google Fonts](https://fonts.google.com/specimen/Source+Serif+4) — variable font axes
- [Plus Jakarta Sans — Google Fonts](https://fonts.google.com/specimen/Plus+Jakarta+Sans) — variable font axes
- [tkdodo.eu — Avoiding Hydration Mismatches with useSyncExternalStore](https://tkdodo.eu/blog/avoiding-hydration-mismatches-with-use-sync-external-store) — pattern for SSR-safe matchMedia hooks

### Tertiary (LOW confidence — used for cross-verification only)

- [DEV.to — Accessible web testing with Playwright and Axe Core](https://dev.to/vitalyskadorva/accessible-web-testing-with-playwright-and-axe-core-2kg1) — example axe + Playwright integration
- [Medium — Theme colors with Tailwind CSS v4.0 and Next Themes](https://medium.com/@kevstrosky/theme-colors-with-tailwind-css-v4-0-and-next-themes-dark-light-custom-mode-36dca1e20419) — alternative approach using `next-themes` (NOT used here; D-12 uses Server Action cookie)

## Metadata

**Confidence breakdown:**

- Standard stack & versions: **HIGH** — every package version verified via `npm view` on 2026-04-26.
- Architecture (Tailwind v4 hybrid + Serwist user-controlled SW + Server Action cookie): **HIGH** — verified via Context7 + official Tailwind/Next/Serwist docs with paste-ready code.
- Pitfalls per requirement: **MEDIUM-HIGH** — Tailwind v4 + Serwist + Motion landmines confirmed; some interaction risks (sonner z-index vs Radix) inferred from API surface, not empirically tested.
- Validation Architecture: **HIGH** — file paths and acceptance criteria are derived directly from existing repo conventions verified via filesystem inspection.

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days for stable stack); re-verify Tailwind v4 + motion v13 status if Phase 3 execution slips beyond that.

## Architectural Responsibility Map

| Capability                                  | Primary Tier              | Secondary Tier      | Rationale                                                                                       |
| ------------------------------------------- | ------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| Design tokens (CSS custom properties)       | Browser / Client          | —                   | Tokens live in `globals.css`, evaluated by browser per `prefers-color-scheme` + `[data-theme]`. |
| JS token mirror (`src/shared/theme/tokens.ts`) | Browser / Client       | Frontend Server     | Imported by motion library + JS consumers; runs both client and server (RSC) safely.            |
| Theme cookie reader (root layout)           | Frontend Server (SSR)     | —                   | `cookies()` from `next/headers` reads cookie SSR-side; flips `<html data-theme>` before paint.  |
| Theme cookie writer (Server Action)         | Frontend Server (SSR)     | —                   | `'use server'` action invoked from Profile placeholder client component.                        |
| Bottom-nav active state + scroll restoration | Browser / Client         | —                   | Reads `usePathname`, manages `sessionStorage`, applies `useLayoutEffect`.                       |
| Service worker (precache + runtime caching) | Browser / Service Worker  | —                   | Registered by client component; runs in SW thread; intercepts fetches.                          |
| Service worker update toast                 | Browser / Client          | Service Worker      | Client subscribes to `waiting` event from SW; shows sonner toast; sends SKIP_WAITING.            |
| `useOnlineStatus` heartbeat                 | Browser / Client          | API / Backend       | Hook on client polls `/api/v1/health/connectivity` server route.                                 |
| `/api/v1/health/connectivity` route         | API / Backend             | —                   | Public, side-effect-free GET; `Cache-Control: no-store`.                                         |
| PWA manifest + icons                        | CDN / Static              | —                   | Static files served from `public/`; Next.js handles delivery.                                    |
| Font loading (next/font/google)             | Frontend Server + Browser | —                   | Server emits `<link>` + CSS variables; browser fetches; SW caches.                               |
| pt-BR translations                          | Frontend Server (SSR)     | Browser / Client    | `getTranslations` server-side; `useTranslations` client-side; same JSON message catalog.         |
| Visual snapshot baselines + axe assertions  | Build / CI (Playwright)   | —                   | Test infrastructure; runs in CI and local dev only.                                              |

## RESEARCH COMPLETE
