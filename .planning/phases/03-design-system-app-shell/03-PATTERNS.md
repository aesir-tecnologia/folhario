# Phase 3: Design System & App Shell - Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 47 (NEW + MODIFY combined; 28 source/route, 13 test, 6 config/asset)
**Analogs found:** 13 / 47 strong-match files; remaining 34 are greenfield with no codebase precedent (planner must derive from RESEARCH.md paste-ready code)

**Critical reading note for planner:** The Phase 1/2 codebase is sparse. Most Phase 3 files (UI primitives, motion, theme, hooks, `globals.css`, `(app)/*`, illustrations) have no analog. **Do not stretch matches.** For greenfield files, RESEARCH.md sections are the source of truth (Tailwind v4 hybrid `@custom-variant`, Serwist user-controlled SW, Motion `useReducedMotion`, Sonner). For files with real analogs, copy the shape but enforce divergences listed inline.

---

## File Classification

### NEW files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/app/(app)/layout.tsx` | layout (server component) | request-response (SSR) | `src/app/diag/layout.tsx` | role-match (different gating logic) |
| `src/app/(app)/page.tsx` | route page | request-response | `src/app/page.tsx` | exact (move target) |
| `src/app/(app)/catalog/page.tsx` | route page (placeholder) | request-response | `src/app/page.tsx` | role-match |
| `src/app/(app)/identify/page.tsx` | route page (placeholder) | request-response | `src/app/page.tsx` | role-match |
| `src/app/(app)/profile/page.tsx` | route page (placeholder w/ Server Action) | request-response | `src/app/page.tsx` + `src/app/diag/page.tsx` | partial |
| `src/app/(app)/app-shell.tsx` | client component (provider/orchestrator) | event-driven (pathname / online / SW) | `src/app/posthog-provider.tsx` | role-match (skeleton only) |
| `src/app/offline/page.tsx` | route page (composed) | request-response | `src/app/not-found.tsx` | role-match (shape only) |
| `src/app/api/v1/health/connectivity/route.ts` | route handler (GET) | request-response | `src/app/api/v1/diagnostics/ping/route.ts` | exact (with divergences — see below) |
| `src/shared/ui/button.tsx` | UI primitive | event-driven | (none) | NO ANALOG |
| `src/shared/ui/text-input.tsx` | UI primitive | event-driven | (none) | NO ANALOG |
| `src/shared/ui/select.tsx` | UI primitive | event-driven | (none) | NO ANALOG |
| `src/shared/ui/toggle.tsx` | UI primitive | event-driven | (none) | NO ANALOG |
| `src/shared/ui/modal-sheet.tsx` | UI primitive (Radix wrapper) | event-driven | (none) | NO ANALOG |
| `src/shared/ui/skeleton.tsx` | UI primitive (timer-gated) | event-driven | (none) | NO ANALOG |
| `src/shared/ui/empty-state.tsx` | UI primitive (composer) | request-response | (none) | NO ANALOG |
| `src/shared/ui/inline-error.tsx` | UI primitive | request-response | (none) | NO ANALOG |
| `src/shared/ui/offline-banner.tsx` | UI primitive (consumes hook) | event-driven | (none) | NO ANALOG |
| `src/shared/ui/app-update-toast.tsx` | UI primitive (subscribes to SW) | event-driven (SW lifecycle) | (none) | NO ANALOG |
| `src/shared/ui/discard-summary-toast.tsx` | UI primitive (helper fn) | function-driven | (none) | NO ANALOG |
| `src/shared/ui/bottom-nav.tsx` | UI primitive (nav) | event-driven (pathname) | (none) | NO ANALOG |
| `src/shared/ui/capture-button.tsx` | UI primitive (motion) | event-driven | (none) | NO ANALOG |
| `src/shared/ui/read-only-banner.tsx` | UI primitive (prop-driven) | request-response | (none) | NO ANALOG |
| `src/shared/theme/tokens.ts` | constants module | static export | `src/shared/config/errors.ts` | partial (constants-only shape) |
| `src/shared/theme/use-theme.ts` | client hook + Server Action | event-driven (cookie roundtrip) | (none) | NO ANALOG |
| `src/shared/motion/springs.ts` | constants module | static export | `src/shared/config/errors.ts` | partial (constants-only shape) |
| `src/shared/motion/use-reduced-motion.ts` | re-export | static export | (none) | NO ANALOG |
| `src/shared/online/use-online-status.ts` | client hook (timer + listener) | event-driven (heartbeat) | (none) | NO ANALOG |
| `src/shared/typography/scientific-name.tsx` | typography wrapper component | request-response | (none) | NO ANALOG |
| `src/shared/i18n/format.ts` | pure-function module | static (Intl helpers) | `src/shared/telemetry/sentry-scrub.ts` | partial (pure-function shape) |
| `stylelint.config.mjs` | tooling config | build-time | `eslint.config.mjs` | role-match (config shape) |
| `postcss.config.mjs` | tooling config | build-time | (none — declarative) | NO ANALOG |

### MODIFY files

| Modified File | Role | Modification | Closest Analog (or current state) | Match Quality |
|---------------|------|--------------|-----------------------------------|---------------|
| `src/app/layout.tsx` | root layout | extend (cookie read, font loader, theme attr) | self (current file) | self-extension |
| `src/app/sw.ts` | service worker | rewrite per RESEARCH.md `Compatibility Landmines §Serwist` | self (current 17-line skeleton) | self-rewrite |
| `src/app/page.tsx` | route page | DELETE (after move to `(app)/page.tsx`) | n/a | n/a |
| `src/app/globals.css` | CSS | populate (currently empty/missing) | (none — first CSS file) | NO ANALOG |
| `public/manifest.webmanifest` | static JSON | rewrite (icons, theme_color) | self (current 9 lines) | self-rewrite |
| `eslint.config.mjs` | tooling config | extend (better-tailwindcss + custom rules) | self | self-extension |
| `next.config.ts` | tooling config | extend (`register: false`) | self | self-extension |
| `playwright.config.ts` | tooling config | extend (axe + emulateMedia matrix) | self | self-extension |
| `package.json` | manifest | extend (deps + scripts + lint-staged) | self | self-extension |
| `src/proxy.ts` | middleware | possibly extend (theme cookie passthrough) | self | self-extension (likely no-op) |
| `src/messages/pt-BR.json` | locale data | populate from `{}` | self | self-rewrite |

### Test files (NEW, all in `tests/unit/` or `tests/e2e/`)

| Test File | Role | Closest Analog | Match Quality |
|-----------|------|----------------|---------------|
| `tests/unit/use-online-status.test.ts` | unit (hook) | (none) | NO ANALOG (use mocked-timer pattern from RESEARCH.md) |
| `tests/unit/skeleton-group.test.tsx` | unit (component, RTL needed) | (none — no React Testing Library yet) | NO ANALOG |
| `tests/unit/format.test.ts` | unit (pure fn) | `tests/unit/errors.test.ts` | exact shape |
| `tests/unit/use-theme.test.ts` | unit (Server Action) | `tests/integration/diagnostics-server-probe.integration.test.ts` | role-match (vi.mock shape) |
| `tests/unit/sw-skip-waiting.test.ts` | unit (event listener) | `tests/unit/errors.test.ts` (it.each) | partial |
| `tests/unit/empty-state.test.tsx` | unit (component) | (none) | NO ANALOG |
| `tests/unit/inline-error.test.tsx` | unit (component) | (none) | NO ANALOG |
| `tests/unit/scroll-restore.test.ts` | unit (DOM hook) | (none) | NO ANALOG |
| `tests/unit/breathing-loop.test.tsx` | unit (motion component) | (none) | NO ANALOG |
| `tests/unit/banned-patterns-snapshot.test.ts` | unit (file-content) | `tests/unit/env-example.test.ts` | exact shape |
| `tests/unit/heartbeat-route-contract.test.ts` | unit (route dynamic-import) | `tests/integration/diagnostics-server-probe.integration.test.ts` | role-match |
| `tests/unit/manifest-shape.test.ts` | unit (JSON file-content) | `tests/unit/env-example.test.ts` | exact shape |
| `tests/unit/messages-coverage.test.ts` | unit (JSON file-content) | `tests/unit/env-example.test.ts` | exact shape |
| `tests/e2e/visual-snapshots.spec.ts` | e2e (snapshot matrix) | `tests/e2e/security-headers.spec.ts` | partial (path loop) |
| `tests/e2e/sw-update-toast.spec.ts` | e2e (event mocking) | `tests/e2e/diagnostics-sentry.spec.ts` | role-match (page.route) |
| `tests/e2e/bottom-nav-scroll-restore.spec.ts` | e2e (interaction) | (none) | NO ANALOG |
| `tests/e2e/horizontal-scroll-guard.spec.ts` | e2e (DOM assertion) | `tests/e2e/security-headers.spec.ts` | exact (path loop) |
| `tests/e2e/offline-fallback.spec.ts` | e2e (network mock) | (none) | NO ANALOG |
| `tests/e2e/axe-placeholder-pages.spec.ts` | e2e (axe matrix) | (none) | NO ANALOG |
| `tests/e2e/axe-modal-focus-trap.spec.ts` | e2e (interaction + axe) | (none) | NO ANALOG |
| `tests/e2e/axe-route-focus-move.spec.ts` | e2e (focus assertion) | (none) | NO ANALOG |
| `tests/e2e/axe-skip-to-main.spec.ts` | e2e (keyboard) | (none) | NO ANALOG |

---

## Pattern Assignments

### `src/app/api/v1/health/connectivity/route.ts` (route handler, GET, **public**)

**Analog:** `src/app/api/v1/diagnostics/ping/route.ts:39-48`

**Imports + GET shape to copy:**

```typescript
import { NextResponse } from "next/server";
// (omit Sentry / posthog-server / serverEnv / errorResponse — connectivity is side-effect-free)

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}
```

**MANDATORY DIVERGENCES from analog:**

1. **DROP** the `if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") return errorResponse(ErrorCode.NotFound, "not found");` gate. The connectivity heartbeat is **public** in production — not stub-gated. (D-30, RESEARCH.md R-7, Cross-Cutting Truth #12.)
2. **ADD** `Cache-Control: no-store` header. The diagnostics route omits this; the connectivity route requires it (D-30 + Open Risk N/A).
3. **DROP** the POST handler entirely. Connectivity is GET-only, side-effect-free.
4. **DROP** Sentry / PostHog imports — no telemetry on heartbeat.
5. **Body shape MUST be exactly** `{ ok: true, timestamp: <ISO> }` (no `env` field; the diagnostics route exposes `env` for CI smoke, irrelevant here).

**Final pattern (paste-ready):**

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: true, timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

---

### `src/app/(app)/layout.tsx` (layout, server component)

**Analog:** `src/app/diag/layout.tsx:1-9` (shape only — different gating semantics)

**Imports pattern:**

```typescript
import type { ReactNode } from "react";
// (NO `notFound` import — `(app)` is the default shell; no gating)
// Mount the client app-shell here so the layout itself stays a server component.
import { AppShell } from "./app-shell";
```

**Layout shape (extend with AppShell wrapping):**

```typescript
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

**Divergence:** No `notFound()` gating (diag layout uses `serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub"`). `(app)` is the default route group; always renders.

---

### `src/app/(app)/app-shell.tsx` (client orchestrator component)

**Analog:** `src/app/posthog-provider.tsx:1-13` (only the `"use client" + useEffect + children passthrough` skeleton transfers; the rest is greenfield).

**Skeleton to copy:**

```typescript
"use client";

import { useEffect, type ReactNode } from "react";
// Add: usePathname, useLayoutEffect, useRef, sonner Toaster, useTranslations,
// bottom-nav, banners, sw-update-toast — see RESEARCH.md "Serwist 9.5.7 user-controlled
// update activation" lines 235-264 for the SW subscription skeleton.

export function AppShell({ children }: { children: ReactNode }) {
  // Compose:
  //   - <main ref={mainRef} tabIndex={-1} aria-label="Conteúdo principal"> wrapping {children}
  //   - <BottomNav />
  //   - <OfflineBanner />
  //   - <ReadOnlyBanner active={false} />
  //   - <SwUpdateToast />
  //   - <Toaster position="bottom-center" /> (sonner)
  //   - usePathname() listener → mainRef.current?.focus()
  //   - useLayoutEffect → sessionStorage scroll save/restore (debounce 150ms)
  //
  // See RESEARCH.md per-requirement pitfalls UI-03 / UI-14 for hash-change guard
  // and `preventScroll` decision.
  return <>{children}</>;
}
```

**Critical:** the analog only contributes `"use client" + provider-shape`. The full implementation is greenfield; planner derives from RESEARCH.md.

---

### `src/app/(app)/page.tsx` (and `/catalog`, `/identify`, `/profile` placeholder pages)

**Analog:** `src/app/page.tsx:1-7` (the file being moved/replaced)

**Current shape (do NOT keep `<main>` — owned by app-shell now):**

```typescript
// Current src/app/page.tsx — DELETE after move
export default function HomePage() {
  return (
    <main>
      <h1>Folhário</h1>
    </main>
  );
}
```

**New shape per page (placeholder using empty-state primitive):**

```typescript
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@shared/ui/empty-state";
// (Note: NO `<main>` wrapper — `(app)/app-shell.tsx` provides it.)

export default async function HomePage() {
  const t = await getTranslations("home.empty");
  return (
    <EmptyState
      headline={t("title")}
      hint={t("hint")}
      ctaLabel={t("cta")}
      ctaHref="/identify"
    />
  );
}
```

**Applies to:** `(app)/page.tsx`, `(app)/catalog/page.tsx`, `(app)/identify/page.tsx`, `(app)/profile/page.tsx` (Profile additionally hosts the Theme Toggle Server Action; see `use-theme.ts` below).

**Divergences from current `page.tsx`:**

- DROP the `<main>` wrapper (now in app-shell).
- ADD `getTranslations` (server-side; client pages would use `useTranslations`).
- Use the `EmptyState` primitive (UI-18 contract: exactly 4 parts; ONE CTA).

---

### `src/app/offline/page.tsx` (route page, composed empty-state)

**Analog:** `src/app/not-found.tsx:1-9` (shape: minimal page, no providers; this lives **outside** `(app)` group so app-shell does NOT wrap it).

**Current `not-found.tsx`:**

```typescript
export default function NotFound() {
  return (
    <main>
      <h1>404</h1>
      <p>Página não encontrada</p>
    </main>
  );
}
```

**New `/offline` shape:**

```typescript
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@shared/ui/empty-state";

export default async function OfflinePage() {
  const t = await getTranslations("offline.page");
  return (
    <main>
      <EmptyState
        headline={t("title")}
        hint={t("hint")}
        ctaLabel={t("cta")}
        ctaOnClick="reload"   // CTA reloads window.location
      />
    </main>
  );
}
```

**Divergences:** keep the `<main>` (this route is OUTSIDE `(app)`, so the app-shell does not provide it). Use the empty-state primitive; CTA reloads current path (D-15).

---

### `src/app/sw.ts` (service worker — REWRITE)

**Current state (Phase 1 skeleton, lines 1-17):**

```typescript
import { Serwist } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (string | { url: string; revision: string | null })[];
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
});

serwist.addEventListeners();
```

**Pattern source:** Not the current file — RESEARCH.md `Compatibility Landmines §Serwist 9.5.7 user-controlled update activation`, code block at lines 195-233. Plan must:

1. Flip `skipWaiting: true` → `skipWaiting: false`.
2. Flip `clientsClaim: true` → `clientsClaim: false`.
3. Add `fallbacks.entries` for `/offline` (request.destination === "document").
4. Add `serwist.registerCapture(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly())`.
5. Add a `message` event listener that calls `self.skipWaiting()` on `event.data?.type === "SKIP_WAITING"`.
6. Switch import from `import { Serwist } from "serwist"` → `import { Serwist, StaleWhileRevalidate, NetworkOnly } from "serwist"` and `import { defaultCache } from "@serwist/next/worker"` for static-asset routing.

**Companion change in `next.config.ts:11` — flip `register: true` → `register: false`** so a React component can subscribe to `waiting` BEFORE registration fires.

---

### `src/app/layout.tsx` (root layout — EXTEND)

**Self-extension. Current shape (lines 1-27):**

```typescript
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { PostHogProvider } from "./posthog-provider";

export const metadata = {
  title: "Folhário",
  description: "Identifique, catalogue e cuide das suas plantas.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PostHogProvider>{children}</PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Extensions (do NOT rewrite — augment in place):**

1. **Add cookie read** at top of function body: `const themeCookie = (await cookies()).get("folhario_theme")?.value as "light" | "dark" | undefined;` (import `cookies` from `next/headers`).
2. **Add font loader** above the function: `import { Source_Serif_4, Plus_Jakarta_Sans } from "next/font/google"` per RESEARCH.md lines 272-285.
3. **Set `<html>` attributes:** `<html lang={locale} {...(themeCookie ? { "data-theme": themeCookie } : {})} className={`${sourceSerif.variable} ${plusJakarta.variable}`}>` — only set `data-theme` for explicit `light`/`dark`; OMIT for `auto` so CSS media query controls (D-12, Open Risk #4 — cookie read MUST be in root layout, not `(app)`).
4. **Add dual `<meta name="theme-color">`** in `<head>` per RESEARCH.md `OFF-09` lines 478-481 + UI-SPEC PWA Contract.
5. **Add `<link rel="icon">` set + `apple-touch-icon`** generated by `pnpm icons:generate`.
6. **Import `globals.css`** at the top of the file: `import "./globals.css";`

**Critical:** Root layout STAYS a server component. Do NOT add `usePathname` / `useLayoutEffect` here — those belong in `(app)/app-shell.tsx`.

---

### `src/shared/i18n/format.ts` (pure-function module)

**Analog:** `src/shared/telemetry/sentry-scrub.ts:1-40` (pure-function module shape; named exports; no internal imports; `as const` typed constants).

**Shape pattern from analog:**

```typescript
// src/shared/telemetry/sentry-scrub.ts:5-12
export const SCRUB_FIELDS = [
  "authorization",
  "cookie",
  "email",
  "password",
  "token",
  "photo_url",
] as const;

const SCRUB_SET: ReadonlySet<string> = new Set(SCRUB_FIELDS);

// Exported pure function with TS-strict-friendly signature
export function scrubHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined { /* ... */ }
```

**Apply to `src/shared/i18n/format.ts`:**

```typescript
const LOCALE = "pt-BR" as const;

export function formatCurrencyBRL(cents: number): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "BRL" })
    .format(cents / 100);
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "short" }).format(date);
}

export function formatTime(d: Date | string, tz?: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(LOCALE, {
    timeStyle: "short",
    hour12: false,
    ...(tz ? { timeZone: tz } : {}),
  }).format(date);
}

export function formatDateTime(d: Date | string, tz?: string): string {
  return `${formatDate(d)} ${formatTime(d, tz)}`;
}
```

**Divergence note:** The analog file uses no path aliases internally (no internal imports). New `format.ts` likewise has no internal imports — but any consumer file must use `@shared/i18n/format`, not relative `../../i18n/format`.

---

### `src/shared/theme/tokens.ts` and `src/shared/motion/springs.ts` (constant-only modules)

**Analog:** `src/shared/config/errors.ts:1-25` (constants module with `as const` + derived types).

**Pattern from analog:**

```typescript
// src/shared/config/errors.ts:1-25
export const ErrorCode = {
  Unauthenticated: "unauthenticated",
  // ...
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

**Apply to `tokens.ts`:**

```typescript
// JS mirror of CSS custom properties — single source of truth lives in globals.css.
// This module re-exports for motion library + JS consumers (e.g., conditional className logic).
export const tokens = Object.freeze({
  colors: Object.freeze({
    paper: "#FBF7EF",
    canopy: "#1F4D35",
    forestInk: "#143424",
    // ... all light defaults; dark counterparts also exported as `darkTokens`
  }),
  spacing: Object.freeze({ /* 8pt grid */ }),
} as const);

export type Tokens = typeof tokens;
```

**Apply to `springs.ts` (per UI-20 pitfall: `Object.freeze` to prevent mutation):**

```typescript
export const springs = Object.freeze({
  primary: Object.freeze({ stiffness: 120, damping: 18, mass: 1 } as const),
  captureBounce: Object.freeze({
    type: "spring",
    stiffness: 400,
    damping: 24,
    mass: 0.8,
  } as const),
  breathing: Object.freeze({
    duration: 3.2,
    repeat: Infinity,
    ease: "easeInOut",
  } as const),
} as const);
```

---

### `stylelint.config.mjs` (NEW tooling config)

**Analog:** `eslint.config.mjs:1-47` (flat-config shape; same `defineConfig` style).

**Shape pattern from analog:**

```javascript
// eslint.config.mjs:7-23
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { /* ... */ }],
    },
  },
  globalIgnores([ /* ... */ ]),
]);

export default eslintConfig;
```

**Apply to `stylelint.config.mjs`** (Stylelint uses object-style config, not array — but the same `.mjs` ESM extension and named-export pattern):

```javascript
/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "declaration-property-value-disallowed-list": {
      "color": [
        "/^#000000$/i", "/^#000$/i", "/^#fff(fff)?$/i", "/^black$/i", "/^white$/i",
      ],
      "/^font-family$/": ["/Inter/i", "/Times/i", "/Georgia/i", "/Garamond/i", "/Palatino/i"],
      "backdrop-filter": ["/.*/"],
    },
    "function-disallowed-list": ["linear-gradient"],   // banned on text-fill contexts
  },
  ignoreFiles: ["public/sw.js", "node_modules/**", ".next/**", ".planning/**"],
};
```

**Companion changes (per Test Convention Discovery row "Stylelint config"):**

- Add to `package.json` `scripts`: `"lint:styles": "stylelint 'src/**/*.css'"`.
- Extend `lint-staged`: `"*.css": ["stylelint --fix"]`.
- Add to CI workflow alongside `pnpm lint`.

**Important:** the `@theme` block in `globals.css` references `--font-source-serif` etc. (variable-font CSS variables); the disallowed-list regex must NOT match those. Scope rules carefully or add inline `/* stylelint-disable */` markers in the `@theme` block.

---

### `eslint.config.mjs` (EXTEND)

**Self-extension. Current shape (lines 7-23):**

```javascript
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { /* ... */ }],
    },
  },
  globalIgnores([ /* ... */ ]),
]);
```

**Extensions (insert before `globalIgnores`):**

1. **Add `eslint-plugin-better-tailwindcss@4.4.1`** (per Open Risk #1 — D-32 named the wrong plugin; corrected by RESEARCH.md):

```javascript
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

// Inside defineConfig array:
{
  plugins: { "better-tailwindcss": betterTailwindcss },
  settings: { "better-tailwindcss": { entryPoint: "src/app/globals.css" } },
  rules: { ...betterTailwindcss.configs.recommended.rules },
},
```

**Critical ordering (Open Risk #7):** `globals.css` MUST exist with `@import "tailwindcss"` BEFORE this plugin loads, or it throws on load.

2. **Add custom emoji-ban rule** (per UI-25 / D-32; ESLint custom rule walking JSX text + string literals for `[\u{1F300}-\u{1FAFF}]` / `[\u{2600}-\u{27BF}]`).

3. **Add custom `@keyframes` reduced-motion warning** rule (per D-08).

4. **Add banned-imports rule** for `next/font/google` family `Inter` (per UI-25).

---

### `next.config.ts` (EXTEND)

**Self-extension. Current shape (lines 6-15, 41-46):**

```typescript
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: true,                                  // CHANGE → false
  scope: "/",
  swUrl: "/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// ...

export default withSentryConfig(withSerwist(withNextIntl(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
```

**One-line modification:** `register: true` → `register: false` (per RESEARCH.md `Compatibility Landmines §Serwist` line 186 — required for user-controlled SW update flow).

**Wrapper composition:** unchanged. `withSentryConfig(withSerwist(withNextIntl(nextConfig)))` order is load-bearing per Phase 1 plan 01-03.

**Headers:** unchanged. The `source: "/(.*)"` block already covers `/api/v1/health/connectivity`. May add a `Cache-Control: no-store` rule scoped to `/api/v1/health/connectivity` instead of inline header (planner choice).

---

### `playwright.config.ts` (EXTEND)

**Self-extension. Current shape (lines 1-28):**

```typescript
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html"], ["github"]] : "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      IDENTIFICATION_PROVIDER_MODE: "stub",
    },
  },
});
```

**Extensions:**

1. **No `@axe-core/playwright` config change required** — it's used directly inside specs (`new AxeBuilder({page}).analyze()`). Just install the dep.
2. **Snapshot config** (per RESEARCH.md Open Risk #5 — Docker baseline recipe). Add `expect.toHaveScreenshot.maxDiffPixels` if needed:

```typescript
expect: {
  toHaveScreenshot: {
    animations: "disabled",
    maxDiffPixels: 100,
  },
},
```

3. **Theme/motion matrix** is per-test via `await page.emulateMedia({ colorScheme, reducedMotion })`, NOT a project-level matrix (per RESEARCH.md `Playwright + @axe-core/playwright API` section 363-376).

---

## Test Pattern Assignments

### Group A: File-content assertion tests (`manifest-shape`, `messages-coverage`, `banned-patterns-snapshot`)

**Analog:** `tests/unit/env-example.test.ts:33-58`

**Shape to copy:**

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_KEYS = [ /* ... */ ];

describe("INFRA-17 .env.example mirrors PRD §20 (19 keys) without leaking secrets", () => {
  const path = resolve(process.cwd(), ".env.example");

  it(".env.example exists", () => {
    expect(existsSync(path)).toBe(true);
  });

  const content = existsSync(path) ? readFileSync(path, "utf-8") : "";

  it.each(REQUIRED_KEYS)("contains key %s", (key) => {
    const re = new RegExp(`^${key}=`, "m");
    expect(content).toMatch(re);
  });
});
```

**Apply per file:**

- **`manifest-shape.test.ts`:** `readFileSync('public/manifest.webmanifest')` → `JSON.parse` → assert `name === "Folhário"`, `theme_color === "#FBF7EF"`, `lang === "pt-BR"`, `icons` array contains 192/512/maskable entries.
- **`messages-coverage.test.ts`:** `readFileSync('src/messages/pt-BR.json')` → `JSON.parse` → for each key in `REQUIRED_KEYS = ['home.empty.title', 'nav.tabs.home', ...]`, assert nested-key exists and is non-empty string. Use a flat-key resolver helper.
- **`banned-patterns-snapshot.test.ts`:** glob over `src/shared/ui/**/*.tsx` source text, assert no `#000`, `#FFF`, `linear-gradient`, `Inter`, `Times`, `Georgia` literal occurrences via regex.

---

### Group B: Pure-function unit tests (`format`)

**Analog:** `tests/unit/errors.test.ts:30-39` (`it.each` over expected values)

**Shape to copy:**

```typescript
import { describe, it, expect } from "vitest";
import { formatCurrencyBRL, formatDate, formatTime, formatDateTime } from "@shared/i18n/format";

describe("UI-23 i18n formatters", () => {
  it.each([
    [2990, "R$ 29,90"],
    [100000, "R$ 1.000,00"],
  ])("formatCurrencyBRL(%i) → %s", (cents, expected) => {
    expect(formatCurrencyBRL(cents)).toBe(expected);
  });

  it("formatDate(Date) → dd/MM/yyyy", () => {
    expect(formatDate(new Date("2026-04-26T00:00:00Z"))).toBe("26/04/2026");
  });

  // ... similar pattern per function
});
```

---

### Group C: Route-handler dynamic-import tests (`heartbeat-route-contract`)

**Analog:** `tests/integration/diagnostics-server-probe.integration.test.ts:11-58` (lives in `integration/` because it mocks heavily; the dynamic-import pattern still works under `tests/unit/` for a no-mock route).

**Shape to copy (simplified for unit project — no `vi.mock` needed):**

```typescript
import { describe, it, expect } from "vitest";

describe("UI-24 connectivity heartbeat contract", () => {
  it("GET responds 200 with { ok: true, timestamp: <ISO> }", async () => {
    const mod = await import("../../src/app/api/v1/health/connectivity/route");
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.timestamp).toBe("string");
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  it("Cache-Control: no-store header set", async () => {
    const mod = await import("../../src/app/api/v1/health/connectivity/route");
    const res = await mod.GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
```

---

### Group D: Server Action tests (`use-theme.test.ts`)

**Analog:** `tests/integration/diagnostics-server-probe.integration.test.ts:11-58` (vi.mock pattern for `next/headers`).

**Shape sketch:**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieSetMock = vi.fn();
const cookieGetMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => ({ set: cookieSetMock, get: cookieGetMock }),
}));

describe("UI-02 useTheme Server Action", () => {
  beforeEach(() => {
    cookieSetMock.mockClear();
    cookieGetMock.mockClear();
  });

  it("setTheme('dark') writes folhario_theme=dark cookie", async () => {
    const { setTheme } = await import("../../src/shared/theme/use-theme");
    await setTheme("dark");
    expect(cookieSetMock).toHaveBeenCalledWith(
      "folhario_theme",
      "dark",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
  });
});
```

---

### Group E: SW message-handler tests (`sw-skip-waiting`)

**Analog:** `tests/unit/errors.test.ts:30-39` (`it.each` shape) — but the SW test mocks `self.skipWaiting`. Pattern is bespoke; use `vi.fn()` to stub.

**Sketch:**

```typescript
import { describe, it, expect, vi } from "vitest";

describe("OFF-10 SW SKIP_WAITING handler", () => {
  it("invokes self.skipWaiting() on { type: 'SKIP_WAITING' } message", async () => {
    const skipWaiting = vi.fn();
    const handlers: Array<(e: MessageEvent) => void> = [];
    // Stub self for the SW environment
    (global as any).self = {
      skipWaiting,
      addEventListener: (type: string, fn: (e: MessageEvent) => void) => {
        if (type === "message") handlers.push(fn);
      },
      __SW_MANIFEST: [],
    };
    // Dynamic import triggers handler registration
    await import("../../src/app/sw");
    handlers.forEach((h) => h({ data: { type: "SKIP_WAITING" } } as MessageEvent));
    expect(skipWaiting).toHaveBeenCalledTimes(1);
  });
});
```

---

### Group F: Playwright path-loop e2e (`horizontal-scroll-guard`, `visual-snapshots`)

**Analog:** `tests/e2e/security-headers.spec.ts:1-21`

**Shape to copy:**

```typescript
import { test, expect } from "@playwright/test";

const URLS = ["/", "/catalog", "/identify", "/profile", "/offline"] as const;

for (const path of URLS) {
  test(`GET ${path} returns ...`, async ({ page }) => {
    await page.goto(path);
    // assertions
  });
}
```

**Apply to:**

- **`horizontal-scroll-guard.spec.ts`:** loop URLs; assert `await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)`.
- **`visual-snapshots.spec.ts`:** loop URLs × `[colorScheme, reducedMotion]` matrix (4 combos); call `await page.emulateMedia({ colorScheme, reducedMotion })` then `await expect(page).toHaveScreenshot({ animations: 'disabled', mask: [page.locator('[data-snapshot-mask="true"]')] })`. **20 snapshots minimum.**

---

### Group G: Playwright network-mock e2e (`sw-update-toast`, `offline-fallback`)

**Analog:** `tests/e2e/diagnostics-sentry.spec.ts:5-28` (`page.route` interception pattern)

**Shape to copy:**

```typescript
import { test, expect } from "@playwright/test";

test("Sentry fires from /diag and client scrubs PII from envelopes", async ({ page }) => {
  const sentryPayloads: string[] = [];

  await page.route(/ingest\.(?:[a-z]+\.)?sentry\.io\/.*\/envelope/, async (route) => {
    const body = route.request().postData() ?? "";
    sentryPayloads.push(body);
    await route.fulfill({ status: 200, body: "ok" });
  });

  await page.goto("/diag");
  await page.waitForTimeout(3000);
  // assertions on sentryPayloads
});
```

**Apply to:**

- **`sw-update-toast.spec.ts`:** mock `serwist.addEventListener` via `page.addInitScript`; trigger synthetic `waiting` event; assert sonner toast text matches `t('app.update.label')`; clicking action button posts `messageSkipWaiting`; `controlling` event triggers `location.reload()`.
- **`offline-fallback.spec.ts`:** `await context.setOffline(true)` (Playwright API, not `page.route`); navigate uncached URL; assert `/offline` page renders with EmptyState structure (illustration + headline + hint + CTA selectors).

---

### Group H: Manifest GET assertion (`pwa-smoke`-style for new manifest)

**Analog:** `tests/e2e/pwa-smoke.spec.ts:1-22`

**Shape:** already covers basic shape. Phase 3 may EXTEND this file (or add new assertions) to verify `theme_color === "#FBF7EF"` (no longer `#FFFFFF`), icons array length, lang.

```typescript
test("GET /manifest.webmanifest returns valid JSON with display:standalone + theme_color", async ({
  request,
}) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.display).toBe("standalone");
  expect(body.theme_color).toBeTruthy();
  expect(body.name).toBeTruthy();
  expect(body.short_name).toBeTruthy();
});
```

**Critical:** This e2e test currently asserts `theme_color is truthy` — passes for `#FFFFFF`. Phase 3 should EXTEND assertions: `expect(body.theme_color).toBe("#FBF7EF")`. Otherwise the unit test `manifest-shape.test.ts` covers the strict assertion.

---

## Shared Patterns

These patterns apply to MULTIPLE Phase 3 files. Copy verbatim into `must_haves.truths` of each affected plan.

### Pattern S1: `"use client"` boundary

**Source:** `src/app/posthog-provider.tsx:1`

```typescript
"use client";

import { useEffect, type ReactNode } from "react";
import { initPostHog } from "@shared/telemetry/posthog-client";
```

**Apply to:** every primitive in `src/shared/ui/` that imports from `motion/react`, uses `useEffect`/`useState`/`useLayoutEffect`/`usePathname`, or subscribes to DOM events. Server-component primitives (`empty-state.tsx` if pure-prop, `scientific-name.tsx`, `read-only-banner.tsx`) MAY omit `"use client"`. Specifically:

- **MUST `"use client"`:** `app-shell.tsx`, `app-update-toast.tsx`, `bottom-nav.tsx`, `capture-button.tsx` (motion), `modal-sheet.tsx` (Radix), `offline-banner.tsx` (hook consumer), `skeleton.tsx` (timer), `toggle.tsx`/`text-input.tsx`/`select.tsx` (state), `discard-summary-toast.tsx` (toast trigger), `use-online-status.ts`, `use-theme.ts` (client side of cookie hook), `use-reduced-motion.ts`.
- **MAY omit `"use client"`:** `button.tsx` (if pure prop-driven), `empty-state.tsx`, `inline-error.tsx`, `read-only-banner.tsx`, `scientific-name.tsx`. Default to omitting unless a hook is required.

---

### Pattern S2: Path aliases — `@shared/*`, `@contexts/*`, `@i18n/*` ONLY (no `@/*`)

**Source:** `src/app/posthog-provider.tsx:4`, `src/instrumentation-client.ts:6`, `src/shared/config/client-env.ts:1`

```typescript
// Existing usage examples
import { initPostHog } from "@shared/telemetry/posthog-client";       // posthog-provider.tsx:4
import { makeBeforeSend, makeBeforeBreadcrumb } from "@shared/telemetry/sentry-scrub";  // instrumentation-client.ts:6
import { z } from "zod";                                              // client-env.ts:1 (external)
```

**Apply to:** EVERY new file. Forbidden: `import X from "@/components/..."` or `import X from "@/lib/..."`. The `@/*` alias is NOT defined in `tsconfig.json:23-27`. Phase 3 places UI primitives under `src/shared/ui/` so consumer imports look like `import { Button } from "@shared/ui/button"`.

**Cross-reference:** Cross-Cutting Truth #1 (RESEARCH.md line 580).

---

### Pattern S3: No barrel files

**Source:** No `src/shared/**/index.ts` exists in the current codebase (verified via `find src/shared -name index.ts` returning empty).

**Apply to:** NEVER introduce `src/shared/ui/index.ts` re-export. Each primitive is imported via its full path: `import { Button } from "@shared/ui/button"`, `import { TextInput } from "@shared/ui/text-input"`. Same rule for `motion/`, `theme/`, `online/`, `i18n/`, `typography/`.

**Cross-reference:** Cross-Cutting Truth #2.

---

### Pattern S4: TypeScript strict + `noUncheckedIndexedAccess`

**Source:** `tsconfig.json:3-4`

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    // ...
  }
}
```

**Apply to:** EVERY new file. Use `??` and explicit guards instead of `!` non-null assertions. Array index access (`arr[0]`) returns `T | undefined` — use `arr[0] ?? defaultValue` or guard.

**Visible compliance in current code:** `src/shared/telemetry/sentry-scrub.ts` uses `?? headers` patterns; `src/shared/config/errors.ts` uses `as const` + derived types instead of enum literals.

---

### Pattern S5: Lucide per-icon imports (tree-shake)

**Source:** None yet (Lucide not installed in current code). Mandated by Cross-Cutting Truth #9 + UI-25 ESLint rule.

**Apply to:** every Phase 3 file using Lucide. Import per-icon:

```typescript
import { HomeIcon, CompassIcon, CameraIcon, UserIcon } from "lucide-react";
// NEVER: import * as Lucide from "lucide-react";
```

`strokeWidth={1.5}` per use; sizes 18/20/24/28px (PRD §17 / D-05).

---

### Pattern S6: i18n via `useTranslations()` (client) / `getTranslations()` (server)

**Source:** No application code uses next-intl yet (current files are `getLocale` / `getMessages` boilerplate in `src/app/layout.tsx:11-13`). Mandated by UI-23.

**Apply to:** EVERY user-facing string. NEVER hardcode pt-BR copy in JSX. Add the key to `src/messages/pt-BR.json` first, then consume:

```typescript
// Server component
import { getTranslations } from "next-intl/server";
const t = await getTranslations("home.empty");
return <h1>{t("title")}</h1>;

// Client component
"use client";
import { useTranslations } from "next-intl";
const t = useTranslations("home.empty");
return <h1>{t("title")}</h1>;
```

**Exempt:** `<i lang="la">` scientific-name children (data, not UI copy).

---

### Pattern S7: Reduced-motion enforcement (three-layer)

**Source:** None yet (motion not installed). Mandated by D-08 + Cross-Cutting Truth #6.

**Apply to:** every file with motion/animation:

1. **Runtime layer:** `import { useReducedMotion } from "motion/react"` (client only); condition `animate`/`transition` props on hook return.
2. **CSS layer:** Tailwind `motion-reduce:` variant for any `@keyframes` or transition.
3. **Lint layer:** custom ESLint rule (Phase 3 adds) warns on bare `@keyframes` without paired `motion-reduce:` fallback.

**Critical pitfall (UI-20):** for perpetual loops (capture-button breathing), DROP the `animate` prop entirely under reduced-motion — do NOT just stop the animation (GPU layer remains composited; battery cost).

---

### Pattern S8: Heartbeat URL contract (`/api/v1/health/connectivity`)

**Source:** D-30 + Cross-Cutting Truth #12.

**Apply to:** `src/shared/online/use-online-status.ts` and `tests/unit/use-online-status.test.ts`. The URL is a literal string:

```typescript
const HEARTBEAT_URL = "/api/v1/health/connectivity" as const;
```

**Forbidden:** `/api/v1/diagnostics/ping` (CI/stub-mode-gated; returns 404 in production). The unit test asserts the URL string exactly.

---

### Pattern S9: Test file location convention

**Source:** `vitest.config.ts:13-14, 22` + `playwright.config.ts:4`

```typescript
// vitest.config.ts:13
include: ["tests/unit/**/*.test.ts"],     // unit project
// vitest.config.ts:22
include: ["tests/integration/**/*.integration.test.ts"],  // integration project
// playwright.config.ts:4
testDir: "./tests/e2e",                   // Playwright
```

**Apply to:** EVERY Phase 3 test file. Unit: `tests/unit/*.test.ts(x)`. Integration: `tests/integration/*.integration.test.ts`. E2E: `tests/e2e/*.spec.ts`. NO co-located tests.

**Phase 3 test files all live in `tests/unit/` or `tests/e2e/`** — none in `integration/` (Phase 3 has no DB/network mocking heavy enough to warrant the separate project; `heartbeat-route-contract.test.ts` runs as unit since the route has no side effects).

---

### Pattern S10: Webpack build (NOT Turbopack)

**Source:** `package.json:12`

```json
"build": "next build --webpack",
```

**Apply to:** NEVER change the `build` script. Serwist 9.5.7 is Turbopack-incompatible (Phase 1 D-13). `dev` may use default Turbopack. Document in plan if any new tooling tries to flip this.

---

### Pattern S11: Conventional Commits + Husky + lint-staged

**Source:** `package.json:25-32`

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx,mjs}": ["prettier --write", "eslint --fix"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
},
```

**Apply to:** Phase 3 must EXTEND `lint-staged` to add:

```json
"*.css": ["stylelint --fix", "prettier --write"]
```

Every commit must pass commitlint + lint-staged. Phase 3's new lint rules (Stylelint, ESLint custom) slot into this chain.

---

## No Analog Found

Files with no close match in the current codebase. Planner must derive from **RESEARCH.md** (paste-ready code blocks) and **UI-SPEC.md** (visual contract). Listed once with consumer notes:

| File | Role | Data Flow | Reason | Planner Source |
|------|------|-----------|--------|----------------|
| `src/app/globals.css` | CSS | declarative | First CSS file in repo | RESEARCH.md `Tailwind v4 dark-mode strategy` lines 310-349 (paste-ready hybrid block) + UI-SPEC.md Color section |
| `postcss.config.mjs` | tooling config | declarative | First PostCSS file | RESEARCH.md lines 161-163 (one-liner) |
| `src/shared/ui/button.tsx` | UI primitive | event-driven | No prior UI component | UI-SPEC.md "Composed Primitives Inventory" + PRD §17 buttons |
| `src/shared/ui/text-input.tsx` | UI primitive | event-driven | No prior input | UI-SPEC.md + PRD §17 inputs/forms (validate-on-blur, autocomplete, three-cue error) |
| `src/shared/ui/select.tsx` | UI primitive | event-driven | No prior input | UI-SPEC.md (TextInput geometry + chevron) |
| `src/shared/ui/toggle.tsx` | UI primitive | event-driven | No prior toggle | UI-SPEC.md + D-13 (theme-toggle consumer in Profile) |
| `src/shared/ui/modal-sheet.tsx` | UI primitive (Radix Dialog wrap) | event-driven | No Radix usage yet | RESEARCH.md `sonner + Radix coexistence` lines 351-361 (z-index ordering) |
| `src/shared/ui/skeleton.tsx` | UI primitive (timer-gated) | event-driven | No animation/skeleton yet | RESEARCH.md `UI-17` lines 422-426 + UI-SPEC.md (300ms gate, 80ms reduced-motion fade) |
| `src/shared/ui/empty-state.tsx` | UI primitive (composer) | request-response | No composer yet | UI-SPEC.md "Empty-state primitive contract" + Open Risk #3 (placeholder SVG fallback) — **consumed by:** all 4 placeholder pages, `/offline` page |
| `src/shared/ui/inline-error.tsx` | UI primitive | request-response | No error component | UI-SPEC.md "Inline error contract" + UI-19 (3 required slots) |
| `src/shared/ui/offline-banner.tsx` | UI primitive | event-driven | No banner yet | UI-SPEC.md "Cross-cutting banners" — **consumed by:** `app-shell.tsx` |
| `src/shared/ui/app-update-toast.tsx` | UI primitive (subscribes to SW) | event-driven | First SW UI integration | RESEARCH.md `Compatibility Landmines §Serwist` lines 235-264 (paste-ready toast component) |
| `src/shared/ui/discard-summary-toast.tsx` | UI primitive (function helper) | function-driven | First toast helper | UI-SPEC.md D-31a (helper-only, prop/function-driven; queue wiring Phase 9) |
| `src/shared/ui/bottom-nav.tsx` | UI primitive (nav) | event-driven (pathname) | First nav component | UI-SPEC.md UI-14 + RESEARCH.md per-req pitfalls (active-indicator slide via getBoundingClientRect, safe-area inset) |
| `src/shared/ui/capture-button.tsx` | UI primitive (motion) | event-driven | First motion component | UI-SPEC.md UI-20 + RESEARCH.md `Motion v12` lines 167-173 (`useReducedMotion` pattern) |
| `src/shared/ui/read-only-banner.tsx` | UI primitive (prop-driven) | request-response | First prop-only banner | UI-SPEC.md D-31 (`active={false}` default; Phase 10 wires) |
| `src/shared/theme/use-theme.ts` | client hook + Server Action | event-driven (cookie) | First Server Action | RESEARCH.md `UI-02` lines 404-408 + Open Risk #4 (cookie read in root layout) |
| `src/shared/motion/use-reduced-motion.ts` | re-export | static export | First motion file | RESEARCH.md lines 169-173 (one-line re-export of `motion/react` hook) |
| `src/shared/online/use-online-status.ts` | client hook | event-driven (heartbeat) | First polling hook | RESEARCH.md `UI-24` lines 463-467 (30s/60s/5s backoff) — **consumed by:** `offline-banner.tsx`, `app-shell.tsx` |
| `src/shared/typography/scientific-name.tsx` | typography wrapper | request-response | First typography primitive | UI-SPEC.md "Latin scientific names" + PRD §17 |
| Test files marked NO ANALOG above | unit/e2e | various | No React Testing Library yet; no Playwright matrix yet | RESEARCH.md "Validation Architecture" lines 491-575 + Wave 0 gaps (need `@testing-library/react` + jsdom env for component tests; Wave 0 gap requires `tests/unit/setup-env.ts` extension to mock `window.matchMedia`) |
| `public/icons/*` | static assets | declarative | No assets yet | RESEARCH.md `pwa-asset-generator invocation` lines 379-394 |
| `public/illustrations/*` | static assets | declarative | No assets yet | UI-SPEC.md "Brand Asset Checklist" + Open Risk #3 (inline-coded leaf shape if missing) |

---

## Cross-Cutting Wave 0 Gaps (planner must address before red→green)

Per RESEARCH.md lines 567-575, these gaps EXIST IN THE REPO and must be filled before any TDD/red→green work begins:

1. **`tests/unit/setup-env.ts` extension** — current file (7 lines, env-vars only) does NOT mock `window.matchMedia`. Required for `useReducedMotion` SSR-safe tests. Add:

```typescript
// tests/unit/setup-env.ts (extend after env-var lines)
if (typeof window !== "undefined") {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}
```

2. **Vitest unit project environment** — current is `environment: "node"` (vitest.config.ts:13). React component tests (`skeleton-group.test.tsx`, `empty-state.test.tsx`, `inline-error.test.tsx`, `breathing-loop.test.tsx`) need `environment: "jsdom"` OR a separate sub-project. Plan must decide: split or switch.

3. **`@testing-library/react`** — not installed. Required for `.test.tsx` component assertions. Add to devDependencies.

4. **`stylelint.config.mjs`** — does not exist. Phase 3 creates per Pattern Assignment above.

5. **`postcss.config.mjs`** — does not exist. Phase 3 creates per RESEARCH.md.

6. **`pnpm lint:styles` script** — not in `package.json`. Phase 3 adds.

7. **`tests/e2e/__screenshots__/` baseline** — does not exist. First run with `pnpm test:e2e --update-snapshots` locally; commit as initial baselines (one-time human-supervised step). Per Open Risk #5, recommend Docker recipe `pnpm visual:baseline:docker` to avoid CI/local font drift.

8. **`src/app/api/v1/health/connectivity/route.ts`** — must exist BEFORE `useOnlineStatus` heartbeat tests can pass.

9. **`src/app/globals.css` + `@import "tailwindcss"`** — must exist BEFORE `eslint-plugin-better-tailwindcss` is wired (Open Risk #7 — plugin throws on load if entrypoint missing).

---

## Metadata

**Analog search scope:**

- `src/app/**/*.{ts,tsx}` — 12 files scanned
- `src/shared/**/*.ts` — 7 files scanned
- `src/i18n/**/*.ts` — 2 files scanned
- `src/messages/*.json` — 1 file scanned
- `tests/unit/*.test.ts` — 8 files scanned
- `tests/integration/*.test.ts` — 2 files scanned
- `tests/e2e/*.spec.ts` — 5 files scanned
- Root config files (`next.config.ts`, `eslint.config.mjs`, `playwright.config.ts`, `vitest.config.ts`, `tsconfig.json`, `package.json`) — all scanned
- `public/*` — 2 files scanned (manifest, robots.txt)

**Total files scanned:** 39

**Pattern extraction date:** 2026-04-26

**Confidence breakdown:**

- Real analogs (route handler, file-content tests, layout shapes): HIGH — concrete excerpts with line numbers
- Greenfield primitives (UI components, motion, hooks): explicitly NO ANALOG — planner derives from RESEARCH.md (paste-ready code) + UI-SPEC.md (visual contract)
- Cross-cutting truths (aliases, no-barrels, strict TS): HIGH — verified against current code
