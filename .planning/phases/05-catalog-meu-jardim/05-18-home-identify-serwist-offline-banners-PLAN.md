---
phase: 05-catalog-meu-jardim
plan: 18
type: execute
wave: 8
depends_on:
  - 05-10    # ReactQueryProvider + pt-BR.json
  - 05-11    # useSubscription stub for read-only banner
  # Wave 8 sibling Plan 05-17 has NO file overlap with this plan (different page paths,
  # different sw.ts touch). Both can run in parallel.
files_modified:
  - src/app/(home)/page.tsx
  - src/app/page.tsx              # DELETED — Phase 1 placeholder removed; single `/` route now lives in (home)/page.tsx (Codex review HIGH 05-18)
  - src/app/identify/page.tsx
  - src/app/sw.ts
  - src/app/banners/offline-banner.tsx
  - src/app/banners/read-only-banner.tsx
  - src/app/layout.tsx           # APPEND banners ABOVE main content; this plan's ONE allowed layout.tsx touch outside Plan 05-10
  - tests/unit/app/banners/offline-banner.test.tsx
  - tests/e2e/catalog/offline-browse.spec.ts
  - tests/e2e/catalog/offline-banner.spec.ts
  - tests/e2e/catalog/persister-hydration.spec.ts
  - tests/e2e/home/empty-home.spec.ts
  - tests/e2e/home/identify-placeholder.spec.ts
autonomous: true
requirements:
  - OFF-08   # CLIENT side — Serwist runtime cache + persister-hydration check + offline banner
  - UI-04    # Home empty composition (asymmetric, NOT centered hero)
decisions:
  serwist_no_api_rule: |
    Per CONTEXT D-20 + RESEARCH Pitfall 3 + 05-PATTERNS.md § "Service worker
    extension" — Serwist runtime caching MUST NOT match /api/* paths.
    TanStack Query persister (Plan 05-10) owns JSON in IndexedDB; Serwist
    owns images in Cache Storage. Adding an /api/* rule causes the SW
    to return stale JSON after TQ invalidates. This plan's sw.ts patch is
    grep-verified to contain ZERO /api matchers (acceptance criterion below).
  serwist_image_matcher: |
    Per RESEARCH § Code Examples line 1335:
    `matcher: ({ request, url }) => request.destination === "image" && url.hostname.endsWith(".supabase.co")`
    Caches stale-while-revalidate. Plugins:
    - CacheableResponsePlugin({ statuses: [0, 200] })
    - ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })
    cacheName: "folhario-catalog-images"
  serwist_assumption_supabase_host: |
    Per RESEARCH Assumption A4: assumes signed URL host is *.supabase.co.
    If self-hosted Supabase or a CDN proxy is used, the matcher must shift.
    Verify host pattern at execution time by inspecting Phase 2 D-25
    StorageAdapter configuration. Document outcome in 05-18-SUMMARY.md.
  offline_banner_position: |
    Persistent banner at top of every page when navigator.onLine === false.
    Mounted in layout.tsx ABOVE the main content area but BELOW the
    NextIntlClientProvider so it has access to translations. Banner copy
    from `catalog.offline.banner.body` (Plan 05-10 i18n).
  read_only_banner_stub: |
    Persistent banner stub mounted in layout.tsx (same wrapper as offline
    banner). Reads useSubscription().status; visible when status is
    "expired" or "grace". Copy from catalog.readOnly.banner.{body|cta}.
    Phase 10 swaps useSubscription body — banner becomes live without
    layout changes.
  home_route_group: |
    Per 05-RESEARCH § Recommended Project Structure line 371: Home page
    lives at `src/app/(home)/page.tsx` using a Next.js route group `(home)`
    so it can have its own layout segment without changing the URL. The
    route is `/` (default).

    **LOCKED via Codex review (HIGH 05-18 — load-bearing collision):** This
    plan UNCONDITIONALLY deletes `src/app/page.tsx` (Phase 1 placeholder)
    and creates `src/app/(home)/page.tsx`. There is exactly one `/` route
    after execution. Both files cannot coexist (Next.js will error). The
    deletion + creation happen in the same commit. If Phase 3 has shipped
    real Home chrome at `src/app/page.tsx`, that chrome moves to a
    layout segment of the (home) route group; the page itself is replaced
    by this plan's empty-state Home content.
  identify_placeholder_per_d_25: |
    Per CONTEXT D-25: route at /identify with §17 empty-state composition.
    Sage line-art illustration (aria-hidden) + Source Serif 4 headline
    "Identificação em breve" + Calm Slate hint + single Canopy CTA
    "Voltar ao catálogo". Phase 6 replaces this page wholesale.
  banners_module_location: |
    Banners live at src/app/banners/{offline-banner,read-only-banner}.tsx.
    Could also live under src/shared/ui/ but per project convention
    `src/shared/ui/` is for primitives (BottomSheet, Lightbox etc.) used
    across contexts. Banners are app-scope (mounted once in layout.tsx),
    so src/app/banners/ matches the routing convention. Document in
    SUMMARY if a different path is chosen.
must_haves:
  truths:
    - "src/app/sw.ts extends Phase 1's Serwist setup with runtimeCaching for image-only requests on *.supabase.co (StaleWhileRevalidate, 200 entries, 30 days)"
    - "src/app/sw.ts contains ZERO /api matchers (grep-verified in acceptance criteria — Pitfall 3 mitigation)"
    - "src/app/(home)/page.tsx renders Home empty per UI-04 — asymmetric layout (NOT centered hero), Source Serif 4 headline 'Identifique sua primeira planta', circular 72px Canopy capture button wired to /identify, 'Adicionar manualmente' tertiary text-link to /catalog/new"
    - "src/app/page.tsx does NOT exist after this plan runs — Phase 1 placeholder is deleted in the same commit that creates src/app/(home)/page.tsx (Codex review HIGH 05-18 — load-bearing route collision)"
    - "src/app/identify/page.tsx renders D-25 placeholder: Sage SVG (aria-hidden) + headline 'Identificação em breve' + hint + Canopy CTA 'Voltar ao catálogo' linking to /catalog"
    - "OfflineBanner subscribes to navigator.onLine via useEffect + listeners; renders sticky banner with offline copy when offline; absent when online"
    - "ReadOnlyBanner reads useSubscription().status; renders sticky banner with read-only copy when status is 'expired' or 'grace'; absent when 'trialing' or 'active'"
    - "src/app/layout.tsx mounts both banners INSIDE ReactQueryProvider (so they have TQ access for useSubscription) and ABOVE the main content"
    - "Camera button breathing-loop animation respects prefers-reduced-motion (no animation when reduce)"
    - "Home empty CTA paths: capture button → /identify, manual link → /catalog/new (per CONTEXT D-25 + D-13)"
    - "Persister hydration verified by Playwright: load Catalog online → reload offline → catalog still renders (TQ persister hydrated from IDB)"
  artifacts:
    - path: "src/app/sw.ts"
      provides: "Serwist with image runtimeCaching for *.supabase.co; NO /api/* rule"
      min_lines: 35
      contains: "StaleWhileRevalidate"
    - path: "src/app/(home)/page.tsx"
      provides: "Home empty composition per UI-04 (asymmetric, NOT centered hero)"
      min_lines: 60
      contains: "Identifique sua primeira planta"
    - path: "src/app/identify/page.tsx"
      provides: "D-25 placeholder with Sage SVG + headline + Canopy CTA back to /catalog"
      min_lines: 35
      contains: "Identificação em breve"
    - path: "src/app/banners/offline-banner.tsx"
      provides: "OfflineBanner 'use client' component with navigator.onLine listener"
      min_lines: 35
      contains: "navigator.onLine"
    - path: "src/app/banners/read-only-banner.tsx"
      provides: "ReadOnlyBanner 'use client' component reading useSubscription()"
      min_lines: 30
      contains: "useSubscription"
    - path: "src/app/layout.tsx"
      provides: "Mounts banners INSIDE ReactQueryProvider above main"
      contains: "OfflineBanner"
    - path: "tests/unit/app/banners/offline-banner.test.tsx"
      provides: "Unit: banner hidden when navigator.onLine=true; visible when false; updates on online/offline events"
      min_lines: 50
      contains: "offline"
    - path: "tests/e2e/catalog/offline-browse.spec.ts"
      provides: "Playwright: load catalog online → page.context().setOffline(true) → reload → catalog renders from cache"
      min_lines: 40
      contains: "setOffline"
    - path: "tests/e2e/catalog/offline-banner.spec.ts"
      provides: "Playwright: setOffline(true) → assert banner visible with correct pt-BR copy"
      min_lines: 30
      contains: "Você está offline"
    - path: "tests/e2e/catalog/persister-hydration.spec.ts"
      provides: "Playwright: assert TQ persister wrote to IDB after first catalog load (inspect IDB via page.evaluate)"
      min_lines: 40
      contains: "indexedDB"
    - path: "tests/e2e/home/empty-home.spec.ts"
      provides: "Playwright: zero-plant fixture renders asymmetric Home + camera button + Adicionar manualmente link; axe-core scan passes"
      min_lines: 50
      contains: "Identifique sua primeira planta"
    - path: "tests/e2e/home/identify-placeholder.spec.ts"
      provides: "Playwright: navigate to /identify → renders D-25 placeholder + 'Voltar ao catálogo' CTA → click → navigates to /catalog"
      min_lines: 30
      contains: "Identificação em breve"
  key_links:
    - from: "src/app/sw.ts"
      to: "Supabase Storage signed URL host (*.supabase.co)"
      via: "Serwist matcher: request.destination === 'image' && url.hostname.endsWith('.supabase.co')"
      pattern: "supabase.co"
    - from: "src/app/(home)/page.tsx"
      to: "/identify (Plan 05-18 placeholder route)"
      via: "Link href"
      pattern: "/identify"
    - from: "src/app/(home)/page.tsx"
      to: "/catalog/new (Plan 05-17 manual-add route)"
      via: "Link href"
      pattern: "/catalog/new"
    - from: "src/app/layout.tsx"
      to: "src/app/banners/offline-banner.tsx + read-only-banner.tsx"
      via: "JSX mount inside ReactQueryProvider"
      pattern: "OfflineBanner|ReadOnlyBanner"
user_setup: []
---

<objective>
Wave 8 ships the final 5b surfaces:
1. **Home empty** at `/` (UI-04) — asymmetric composition (NOT centered hero), camera button wired to /identify (D-25), "Adicionar manualmente" text link to /catalog/new
2. **/identify placeholder** (D-25) — calm §17 empty state until Phase 6 replaces wholesale
3. **Serwist runtime cache** for cover/thumbnail images (D-20 + D-21) — image-only matcher; explicit no-/api/* rule (Pitfall 3 mitigation)
4. **Persistent offline banner** subscribed to navigator.onLine
5. **Persistent read-only banner stub** reading useSubscription() (D-24)

Output: 4 page/SW files (~145 lines combined) + 2 banner components (~65 lines) + 1 layout patch + 1 unit test (~50 lines) + 5 E2E specs (~190 lines combined). Covers OFF-08 (client side) + UI-04.

This is the LAST 5b plan; after this all 16 phase requirement IDs (5a + 5b combined) are covered. See README/ROADMAP for the full coverage matrix.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-10-tq-provider-idb-persister-i18n-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-11-use-subscription-stub-PLAN.md

<interfaces>
<!-- Consumed contracts -->

From `src/app/sw.ts` (current Phase 1 skeleton — ~17 lines, only precache):
```ts
import { Serwist } from "serwist";
declare global { interface ServiceWorkerGlobalScope { __SW_MANIFEST: ... } }
declare const self: ServiceWorkerGlobalScope;
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
});
serwist.addEventListeners();
```

This plan EXTENDS by adding `runtimeCaching` array (image-only rule). Per Plan 05-PATTERNS.md line 281-302 the extension is non-breaking.

From serwist@9.5.7:
```ts
import { Serwist, StaleWhileRevalidate, ExpirationPlugin, CacheableResponsePlugin } from "serwist";
```

From `src/contexts/billing/api/use-subscription.ts` (Plan 05-11):
```ts
export function useSubscription(): { status: "trialing" | "active" | "expired" | "grace" };
```

From `src/messages/pt-BR.json` (Plan 05-10) — keys consumed:
- `catalog.home.empty.{headline|secondaryLink|captureAriaLabel}`
- `catalog.identify.placeholder.{headline|hint|backToCatalog}`
- `catalog.offline.banner.body`
- `catalog.readOnly.banner.{body|cta}`
</interfaces>

<related_files>
- src/app/layout.tsx (Plan 05-10) — wraps content in NextIntlClientProvider > PostHogProvider > ReactQueryProvider; this plan ADDS banner mounts INSIDE ReactQueryProvider
- src/app/page.tsx (Phase 1 placeholder) — may be deleted or replaced; see decisions.home_route_group
- src/app/sw.ts (Phase 1 skeleton) — extended (not replaced)
- tests/helpers/playwright-auth-bypass.ts (Plan 05-01)
- tests/helpers/axe-helper.ts (Plan 05-01)
</related_files>
</context>

<!-- TEST-IMPORT NOTE (Phase 1 STATE.md / Plan 01-07 lessons learned):
The project has NO `@/*` tsconfig path alias. Only `@contexts/*`, `@shared/*`,
`@i18n/*` are configured (see tsconfig.json). All test files MUST use RELATIVE
imports for tests/helpers/* and src/* references. The samples below have been
patched accordingly. If you see any `@/...` import in this plan, it's a sample
typo — replace with the correct relative path before committing.
-->

<tasks>

<task type="auto">
  <name>Task 1: Extend Serwist runtime caching (image-only, no /api/* rule per Pitfall 3)</name>
  <files>src/app/sw.ts</files>
  <read_first>
    - src/app/sw.ts (Phase 1 skeleton — verify current contents before editing)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Code Examples lines 1320-1352 (Serwist runtime cache pattern verbatim)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pitfall 3 (lines 1167-1180) — TQ + Serwist double-cache pitfall; explicit no-/api/* requirement
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "Service worker extension" lines 274-302
  </read_first>
  <action>
    Replace `src/app/sw.ts` contents with the extended Serwist setup:

    ```ts
    import {
      Serwist,
      StaleWhileRevalidate,
      ExpirationPlugin,
      CacheableResponsePlugin,
    } from "serwist";

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
      runtimeCaching: [
        {
          // CONTEXT D-20 + RESEARCH Pitfall 3 mitigation:
          // ONLY cover/thumbnail IMAGES from Supabase Storage. Explicitly NOT /api/*.
          // TanStack Query persister (Plan 05-10) owns JSON in IndexedDB.
          matcher: ({ request, url }) =>
            request.destination === "image" && url.hostname.endsWith(".supabase.co"),
          handler: new StaleWhileRevalidate({
            cacheName: "folhario-catalog-images",
            plugins: [
              new CacheableResponsePlugin({ statuses: [0, 200] }),
              new ExpirationPlugin({
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              }),
            ],
          }),
        },
        // DO NOT ADD /api/* matcher — see RESEARCH Pitfall 3 + Plan 05-18 frontmatter decisions.serwist_no_api_rule
      ],
    });

    serwist.addEventListeners();
    ```

    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    **Pitfall 3 acceptance grep gate (load-bearing):**
    Run `grep -E "(matcher|handler).*['\"]\/api" src/app/sw.ts | grep -v '^//' | grep -v '^\s*\*' | grep -c ''`. Result MUST be 0.

    Commit: `git add src/app/sw.ts && git commit -m "feat(05-18): extend Serwist with image-only runtimeCaching (Pitfall 3 — no /api/* rule)"`
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; grep -c "StaleWhileRevalidate" src/app/sw.ts | grep -qE "^[1-9]" &amp;&amp; grep -c "supabase.co" src/app/sw.ts | grep -qE "^[1-9]" &amp;&amp; ! grep -E "['\"]\\/api" src/app/sw.ts | grep -v '^[[:space:]]*//' | grep -v '^[[:space:]]*\*' | grep -q .</automated>
  </verify>
  <done>
    - sw.ts extended with image-only runtimeCaching
    - StaleWhileRevalidate + CacheableResponsePlugin + ExpirationPlugin imports
    - Matcher uses request.destination === "image" + .supabase.co host
    - NO /api/* matcher in actual code (comments allowed)
    - tsc --noEmit exits 0
    - Commit prefix `feat(05-18):`
  </done>
</task>

<task type="auto">
  <name>Task 2: OfflineBanner + ReadOnlyBanner components + layout.tsx mount</name>
  <files>src/app/banners/offline-banner.tsx, src/app/banners/read-only-banner.tsx, src/app/layout.tsx, tests/unit/app/banners/offline-banner.test.tsx</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Read-only mode UI variants" lines 333-345 + offline-banner row line 201
    - src/app/layout.tsx (Plan 05-10 — wrap order to preserve)
    - src/messages/pt-BR.json (Plan 05-10) — catalog.offline.banner.* + catalog.readOnly.banner.*
    - src/contexts/billing/api/use-subscription.ts (Plan 05-11)
  </read_first>
  <action>
    **OfflineBanner** — `src/app/banners/offline-banner.tsx`:
    ```tsx
    "use client";
    import { useEffect, useState } from "react";
    import { useTranslations } from "next-intl";
    import { CloudOff } from "lucide-react";

    export function OfflineBanner() {
      const t = useTranslations("catalog");
      const [online, setOnline] = useState(
        typeof navigator !== "undefined" ? navigator.onLine : true,
      );

      useEffect(() => {
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
          window.removeEventListener("online", onOnline);
          window.removeEventListener("offline", onOffline);
        };
      }, []);

      if (online) return null;

      return (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-30 flex items-center gap-2 bg-[var(--understory-sage,#8AA593)] px-4 py-3 text-sm text-[var(--forest-ink,#143424)]"
          data-testid="offline-banner"
        >
          <CloudOff size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>{t("offline.banner.body")}</span>
        </div>
      );
    }
    ```

    **ReadOnlyBanner** — `src/app/banners/read-only-banner.tsx`:
    ```tsx
    "use client";
    import Link from "next/link";
    import { useTranslations } from "next-intl";
    import { useSubscription } from "@contexts/billing/api/use-subscription";

    export function ReadOnlyBanner() {
      const t = useTranslations("catalog");
      const { status } = useSubscription();
      if (status !== "expired" && status !== "grace") return null;

      return (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-[var(--surface,#FFFDF7)] px-4 py-3 text-sm text-[var(--forest-ink,#143424)]"
          style={{ borderBottom: "1px solid var(--hairline,#D8D2C7)" }}
          data-testid="read-only-banner"
        >
          <span>{t("readOnly.banner.body")}</span>
          <Link
            href="/settings/billing"
            className="font-semibold text-[var(--canopy,#1F4D35)]"
          >
            {t("readOnly.banner.cta")}
          </Link>
        </div>
      );
    }
    ```

    **Mount in layout.tsx** — append the two banner imports + JSX inside `<ReactQueryProvider>` and ABOVE the `{children}`:
    ```tsx
    // ... existing imports
    import { OfflineBanner } from "./banners/offline-banner";
    import { ReadOnlyBanner } from "./banners/read-only-banner";

    // Inside the JSX, MUST stay nested per Plan 05-10 wrap order:
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PostHogProvider>
        <ReactQueryProvider>
          <ReadOnlyBanner />
          <OfflineBanner />
          {children}
        </ReactQueryProvider>
      </PostHogProvider>
    </NextIntlClientProvider>
    ```

    **Unit test** — `tests/unit/app/banners/offline-banner.test.tsx`:
    ```tsx
    import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
    import { render, screen, act } from "@testing-library/react";
    import { NextIntlClientProvider } from "next-intl";
    import messages from "../../../../src/messages/pt-BR.json";
    import { OfflineBanner } from "../../../../src/app/banners/offline-banner";

    function renderWithI18n() {
      return render(
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <OfflineBanner />
        </NextIntlClientProvider>,
      );
    }

    describe("OfflineBanner", () => {
      const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

      function setOnline(online: boolean) {
        Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
      }

      afterEach(() => {
        if (originalOnLine) Object.defineProperty(navigator, "onLine", originalOnLine);
      });

      it("renders nothing when navigator.onLine === true", () => {
        setOnline(true);
        renderWithI18n();
        expect(screen.queryByTestId("offline-banner")).toBeNull();
      });

      it("renders banner with offline copy when navigator.onLine === false", () => {
        setOnline(false);
        renderWithI18n();
        const banner = screen.getByTestId("offline-banner");
        expect(banner).toBeInTheDocument();
        expect(banner.textContent).toContain("Você está offline");
      });

      it("updates state when offline event fires", () => {
        setOnline(true);
        renderWithI18n();
        expect(screen.queryByTestId("offline-banner")).toBeNull();
        act(() => {
          setOnline(false);
          window.dispatchEvent(new Event("offline"));
        });
        expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
      });

      it("hides banner when online event fires after offline", () => {
        setOnline(false);
        renderWithI18n();
        expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
        act(() => {
          setOnline(true);
          window.dispatchEvent(new Event("online"));
        });
        expect(screen.queryByTestId("offline-banner")).toBeNull();
      });
    });
    ```

    Run: `pnpm exec vitest --run --project=unit tests/unit/app/banners/offline-banner.test.tsx` — 4 MUST PASS.
    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit: `git add src/app/banners/offline-banner.tsx src/app/banners/read-only-banner.tsx src/app/layout.tsx tests/unit/app/banners/offline-banner.test.tsx && git commit -m "feat(05-18): OfflineBanner + ReadOnlyBanner + layout mount"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/app/banners/offline-banner.test.tsx &amp;&amp; pnpm exec tsc --noEmit &amp;&amp; grep -c "OfflineBanner" src/app/layout.tsx | grep -qE "^[2-9]|^[1-9][0-9]" &amp;&amp; grep -c "ReadOnlyBanner" src/app/layout.tsx | grep -qE "^[2-9]|^[1-9][0-9]"</automated>
  </verify>
  <done>
    - 2 banner components shipped + 1 layout patch + 1 unit test
    - Banners mounted INSIDE ReactQueryProvider (so useSubscription has TQ access)
    - 4 unit tests pass
    - tsc --noEmit exits 0
    - Commit prefix `feat(05-18):`
  </done>
</task>

<task type="auto">
  <name>Task 3: Home empty page (UI-04 asymmetric composition) + /identify placeholder (D-25)</name>
  <files>src/app/(home)/page.tsx, src/app/identify/page.tsx</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Empty Home" lines 320-330 + § "Capture button breathing loop"
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-13 + D-14 + D-25
    - src/app/page.tsx (current Phase 1 placeholder — may need to delete or replace per decisions.home_route_group)
    - src/messages/pt-BR.json (Plan 05-10) — catalog.home.empty.* + catalog.identify.placeholder.*
  </read_first>
  <action>
    **Step A: Delete `src/app/page.tsx` and create the (home) route group**

    Per Codex review HIGH 05-18 (load-bearing route collision), this plan UNCONDITIONALLY deletes `src/app/page.tsx` and creates `src/app/(home)/page.tsx`. Both files cannot define the `/` route — Next.js will throw a routing error if both exist.

    Execute, in this exact order, in the SAME commit:

    1. `git rm src/app/page.tsx` — removes Phase 1's placeholder from filesystem AND git index.
    2. Create `src/app/(home)/page.tsx` with the Home empty content from Step B below.
    3. Verify: `test ! -f src/app/page.tsx && test -f "src/app/(home)/page.tsx"` exits 0.
    4. Verify: `pnpm exec next build --debug 2>&1 | grep -iE "duplicate|conflict|two parallel" || echo "no route conflict"` (build must NOT report a duplicate `/` route).

    If Phase 3 had previously shipped real Home chrome at `src/app/page.tsx`, that chrome MUST be relocated to a layout segment of the (home) route group (e.g., `src/app/(home)/layout.tsx`) BEFORE running this plan. This plan's scope is the empty-state Home page itself, not the chrome.

    Document the deletion and the post-execution route layout in 05-18-SUMMARY.md.

    **Step B: Home empty page** — `src/app/(home)/page.tsx`:
    ```tsx
    import Link from "next/link";
    import { Camera } from "lucide-react";
    import { useTranslations } from "next-intl";

    /**
     * Phase 5 ships ONLY the EMPTY Home state (UI-04). Default Home (UI-05 with
     * "Today's tasks" strip) lands in Phase 8. If user has ≥1 plant, they should
     * still see this empty version in Phase 5 — the "default" Home content is
     * intentionally out of scope here.
     *
     * Asymmetric layout per UI-SPEC § Empty Home — NEVER centered hero stack.
     */
    export default function HomePage() {
      // RSC component (no "use client") — only static i18n + Link
      const t = useTranslations("catalog");
      return (
        <main className="min-h-[100dvh] bg-[var(--paper-cream,#FBF7EF)] px-5 pt-12 pb-24">
          {/* Asymmetric layout: headline left-aligned ragged-right, button below */}
          <div className="max-w-md">
            <h1 className="text-3xl font-medium font-serif text-[var(--forest-ink,#143424)]">
              {t("home.empty.headline")}
            </h1>
          </div>

          {/* Capture button — circular 72px with breathing loop */}
          <div className="mt-12 flex flex-col items-start gap-6">
            <Link
              href="/identify"
              aria-label={t("home.empty.captureAriaLabel")}
              className="group flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--canopy,#1F4D35)] text-[var(--surface,#FFFDF7)] motion-safe:animate-[breathe_3.2s_ease-in-out_infinite]"
              style={{
                marginBottom: "calc(env(safe-area-inset-bottom) + 24px)",
              }}
            >
              <Camera size={32} strokeWidth={1.5} aria-hidden="true" />
            </Link>

            <Link
              href="/catalog/new"
              className="text-base font-semibold text-[var(--canopy,#1F4D35)] underline-offset-4 hover:underline"
            >
              {t("home.empty.secondaryLink")}
            </Link>
          </div>

          {/* Breathing keyframes — declared inline to avoid Phase 3 dependency */}
          <style>{`
            @keyframes breathe {
              0%, 100% { transform: scale(1); }
              50%      { transform: scale(1.02); }
            }
            @media (prefers-reduced-motion: reduce) {
              .group { animation: none !important; }
            }
          `}</style>
        </main>
      );
    }
    ```

    **Step C: /identify placeholder** — `src/app/identify/page.tsx`:
    ```tsx
    import Link from "next/link";
    import { useTranslations } from "next-intl";

    /**
     * Phase 5 D-25 placeholder. Phase 6 replaces this page wholesale with the
     * real capture flow.
     */
    export default function IdentifyPlaceholderPage() {
      const t = useTranslations("catalog");
      return (
        <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[var(--paper-cream,#FBF7EF)] px-5 pb-24 text-center">
          {/* Sage line-art (decorative — Phase 5 simple geometric stub) */}
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            width={120}
            height={120}
            fill="none"
            stroke="var(--understory-sage,#8AA593)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="60" cy="60" r="40" />
            <path d="M50 55 L55 50 L65 50 L70 55" />
            <circle cx="60" cy="65" r="10" />
          </svg>
          <h1 className="text-3xl font-medium font-serif text-[var(--forest-ink,#143424)]">
            {t("identify.placeholder.headline")}
          </h1>
          <p className="text-base text-[var(--calm-slate,#5A6358)]">
            {t("identify.placeholder.hint")}
          </p>
          <Link
            href="/catalog"
            className="rounded-lg bg-[var(--canopy,#1F4D35)] px-6 py-3 text-base font-semibold text-[var(--surface,#FFFDF7)]"
          >
            {t("identify.placeholder.backToCatalog")}
          </Link>
        </main>
      );
    }
    ```

    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit (single commit, includes the deletion):
    ```bash
    git rm src/app/page.tsx
    git add "src/app/(home)/page.tsx" src/app/identify/page.tsx
    git commit -m "feat(05-18): Home empty at (home)/page.tsx + delete src/app/page.tsx + /identify placeholder (D-25)"
    ```

    Post-commit verify:
    - `test ! -f src/app/page.tsx` exits 0
    - `test -f "src/app/(home)/page.tsx"` exits 0
    - `git log -1 --name-status | grep -E "^D\s+src/app/page.tsx"` matches
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; grep -c "Identifique sua primeira planta" src/messages/pt-BR.json | grep -qE "^[1-9]" &amp;&amp; grep -c "Camera" "src/app/(home)/page.tsx" | grep -qE "^[1-9]" &amp;&amp; grep -c "Identificação em breve" src/messages/pt-BR.json | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - Home empty page exists at the chosen path (documented in SUMMARY)
    - Asymmetric layout (headline + 72px circular capture button + secondary text-link)
    - Capture button has motion-safe:animate-[breathe...] + prefers-reduced-motion fallback
    - /identify placeholder exists with Sage SVG + headline + Canopy CTA back to /catalog
    - tsc --noEmit exits 0
    - Commit prefix `feat(05-18):`
  </done>
</task>

<task type="auto">
  <name>Task 4: 5 Playwright E2E specs (offline browse + offline banner + persister hydration + empty home + identify placeholder)</name>
  <files>tests/e2e/catalog/offline-browse.spec.ts, tests/e2e/catalog/offline-banner.spec.ts, tests/e2e/catalog/persister-hydration.spec.ts, tests/e2e/home/empty-home.spec.ts, tests/e2e/home/identify-placeholder.spec.ts</files>
  <read_first>
    - tests/helpers/playwright-auth-bypass.ts (Plan 05-01)
    - tests/helpers/axe-helper.ts (Plan 05-01)
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md rows OFF-08 e2e (3) + UI-04 e2e (2)
  </read_first>
  <action>
    All 5 specs use `test.skip(!process.env.PHASE_4_AUTH_READY, ...)` for auth-touching tests; the home/identify specs may not need auth (RSC routes that don't gate on user) — verify at execution.

    1. **offline-browse.spec.ts** (~40 lines): Authenticated user → navigate to /catalog (online) → ≥1 plant visible → `await page.context().setOffline(true)` → reload page → assert at least one plant card still visible (TQ persister hydrated from IDB) → assert offline banner visible.

    2. **offline-banner.spec.ts** (~30 lines): Navigate to any page → `setOffline(true)` → assert banner with `data-testid="offline-banner"` visible with text containing "Você está offline" → `setOffline(false)` → assert banner gone.

    3. **persister-hydration.spec.ts** (~40 lines): Navigate to /catalog → wait for plants to load → query IDB via `await page.evaluate(async () => { const db = await indexedDB.open('keyval-store').result; ... })` to confirm 'folhario:tq-cache' key exists with non-empty PersistedClient. (Alternative simpler check: `await page.evaluate(() => indexedDB.databases())` returns 'keyval-store' or similar.)

    4. **empty-home.spec.ts** (~50 lines): Navigate to / (zero-plant fixture if needed) → assert Home renders headline "Identifique sua primeira planta" + capture button (`a[aria-label*="Identificar"]`) + secondary link "Adicionar manualmente" → assert layout is asymmetric (NOT centered hero stack — verify by checking that headline div has `max-w-md` or similar truncation; assert capture button is NOT vertically centered with headline) → axe-core scan passes.

    5. **identify-placeholder.spec.ts** (~30 lines): Navigate to /identify → assert headline "Identificação em breve" → assert "Voltar ao catálogo" CTA → click CTA → assert navigation to /catalog.

    Author all 5 specs with proper structure + auth-fixture-readiness skip. Run `pnpm exec playwright test --list` to verify syntax.

    Commit: `git add tests/e2e/catalog/offline-browse.spec.ts tests/e2e/catalog/offline-banner.spec.ts tests/e2e/catalog/persister-hydration.spec.ts tests/e2e/home/empty-home.spec.ts tests/e2e/home/identify-placeholder.spec.ts && git commit -m "test(05-18): 5 Playwright E2E specs (offline browse + banner + persister + home + identify)"`
  </action>
  <verify>
    <automated>pnpm exec playwright test tests/e2e/catalog/offline-browse.spec.ts tests/e2e/catalog/offline-banner.spec.ts tests/e2e/catalog/persister-hydration.spec.ts tests/e2e/home/empty-home.spec.ts tests/e2e/home/identify-placeholder.spec.ts --list 2>&amp;1 | grep -qE "[0-9]+ tests in [0-9]+ files"</automated>
  </verify>
  <done>
    - 5 spec files exist
    - Each guards with auth-fixture-readiness skip where needed (home/identify may not need auth)
    - Playwright `--list` succeeds
    - Commit prefix `test(05-18):`
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Service Worker → Cache Storage | Caches Supabase Storage signed URLs (images); per-origin sandboxed |
| navigator.onLine → React state | Browser-API; reflects connectivity (no security implication) |
| useSubscription → ReadOnlyBanner | UX gate; server enforces read_only_mode 402 separately |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-5b-18-01 | Information Disclosure | SW caches signed URL responses; cache content readable in DevTools | accept | Same images are already rendered in DOM and cached by browser image cache. Service Worker cache is per-origin sandboxed; LGPD posture is "user owns their device" per PRD §11. |
| T-5b-18-02 | DoS / Staleness | Serwist accidentally caches /api/* responses, shadowing TQ invalidation (Pitfall 3) | mitigate | This plan's sw.ts patch contains ZERO /api matchers; acceptance criterion grep-verifies. RESEARCH Pitfall 3 documented. |
| T-5b-18-03 | Tampering | Cached image URL becomes invalid after Phase 2 D-27 signed-URL expiry; SW serves stale image | accept | Stale-while-revalidate semantics: SW returns cached image immediately AND fetches fresh in background. If signed URL has expired, the background fetch fails silently and the next request will get a fresh URL. Cosmetic risk only (user sees stale thumbnail momentarily). |
| T-5b-18-04 | Spoofing | Read-only banner readable by user; user could try to dismiss via DevTools | accept | UI gate; server enforces read_only_mode 402 on mutations. T-5b-11-01 documented. |
| T-5b-18-05 | Information Disclosure | Sentry breadcrumb leaks navigator.onLine state changes | accept | Boolean state; no PII; Phase 1 LGPD-13 scrub does not need to extend. |
| T-5b-18-06 | DoS | OfflineBanner re-renders excessively on flaky connection (online/offline event storms) | accept | React's useState reconciliation handles this; banner updates are cheap. If real-world traffic shows storms, debounce in a follow-up. |
| T-5b-18-07 | Tampering | Service Worker cache poisoning via DNS spoofing of *.supabase.co | mitigate | CacheableResponsePlugin restricts cached responses to status 200 + 0 (opaque); Supabase signed URLs use HTTPS; browser TLS validates the cert. No additional mitigation needed at SW layer. |

</threat_model>

<verification>
- `pnpm exec tsc --noEmit` exits 0
- `pnpm exec vitest --run --project=unit tests/unit/app/banners/offline-banner.test.tsx` exits 0 (4 tests pass)
- **Pitfall 3 grep gate**: `grep -E "['\"]\\/api" src/app/sw.ts | grep -v '^[[:space:]]*//' | grep -v '^[[:space:]]*\*' | wc -l` returns 0
- **Home route collision gate (Codex HIGH 05-18)**: `test ! -f src/app/page.tsx` exits 0 AND `test -f "src/app/(home)/page.tsx"` exits 0
- `grep -c "supabase.co" src/app/sw.ts` returns ≥ 1
- `grep -c "OfflineBanner" src/app/layout.tsx` returns ≥ 2 (import + JSX)
- `grep -c "ReadOnlyBanner" src/app/layout.tsx` returns ≥ 2
- `grep -c "captureAriaLabel" src/app/(home)/page.tsx` returns ≥ 1 (proxied via t() lookup)
- `grep -c "motion-safe" "src/app/(home)/page.tsx"` returns ≥ 1
- `grep -c "prefers-reduced-motion" "src/app/(home)/page.tsx"` returns ≥ 1
- All 5 Playwright specs collect via `--list`
</verification>

<reviews_addressed>
**Codex review findings resolved by this plan (per `.planning/phases/05-catalog-meu-jardim/05-REVIEWS.md`):**

- **05-18 HIGH — Home route placement collision** (Codex Plan-Specific table): `src/app/page.tsx` and `src/app/(home)/page.tsx` cannot both define `/`. Resolved by unconditionally deleting `src/app/page.tsx` and creating `src/app/(home)/page.tsx` in the same commit. `files_modified` lists `src/app/page.tsx` as deleted; `must_haves.truths` asserts post-execution non-existence; Step A makes the deletion explicit and unconditional; verification block adds the route-collision grep gate.
</reviews_addressed>

<success_criteria>
- Serwist runtimeCaching for image-only on *.supabase.co with NO /api/* rule (Pitfall 3 mitigation grep-verified)
- Home empty page (UI-04) — asymmetric, NOT centered hero, with breathing-loop capture button + manual link
- /identify placeholder (D-25) renders calm §17 empty state
- OfflineBanner subscribes to navigator.onLine + announces in pt-BR
- ReadOnlyBanner reads useSubscription() + shows expired/grace message
- Both banners mounted in layout.tsx INSIDE ReactQueryProvider
- 4 unit tests + 5 E2E specs authored
- 2 requirement IDs covered (OFF-08 client side + UI-04)
- Commits prefixed `feat(05-18):` (sw + banners + pages), `test(05-18):` (unit + E2E)
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-18-SUMMARY.md` summarizing:
- Final Home route placement: `src/app/(home)/page.tsx` route group OR replaced `src/app/page.tsx` directly (per `decisions.home_route_group`)
- Confirmation that sw.ts contains ZERO /api/* matchers (Pitfall 3 grep gate output)
- Supabase host pattern verification (`*.supabase.co` confirmed at execution time, OR alternative host pattern documented per `decisions.serwist_assumption_supabase_host`)
- Whether `src/app/page.tsx` was deleted in favor of the (home) group
- Number of tests landed: 4 unit + 5 E2E = 9
- Confirmation that this is the FINAL 5b plan; all 16 phase requirement IDs (5a + 5b combined) are now covered:
  - 5a: CAT-01, CAT-02 server, CAT-03 server, CAT-04 data, CAT-05 server, CAT-07, CAT-09, OFF-08 server
  - 5b: CAT-02 client, CAT-03 client, CAT-04 UI, CAT-05 UI, CAT-06, CAT-08, CAT-10, CAT-11, OFF-08 client, UI-04, UI-07, UI-08, UI-11
</output>
</content>
</invoke>