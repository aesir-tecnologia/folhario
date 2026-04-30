---
phase: 05-catalog-meu-jardim
plan: 18
type: execute
wave: 4
depends_on: [05-03, 05-10, 05-11, 05-15]
files_modified:
  - src/app/(app)/page.tsx
  - src/app/(app)/identify/page.tsx
  - src/app/(app)/app-shell.tsx
  - src/app/sw.ts
  - src/messages/pt-BR.json
  - tests/e2e/axe-placeholder-pages.spec.ts
  - tests/e2e/catalog-offline.spec.ts
  - tests/unit/sw-runtime-cache.test.ts
autonomous: true
requirements: [OFF-08, UI-04, UI-07, UI-08, UI-11]
must_haves:
  truths:
    - "Home empty state renders full-bleed Identifique CTA + 'Adicionar manualmente' text link when the verified user has zero plants"
    - "Home with ≥1 plants renders bridge copy 'Você tem {n} planta(s) no seu catálogo.' + link to /catalog (Phase 8 supersedes)"
    - "Tap on capture button on Home navigates to /identify (Phase 6 placeholder)"
    - "/identify renders a placeholder page (Phase 6 replaces); offline visit shows blocked message 'Identificação requer conexão à internet.'"
    - "ReadOnlyBanner displays across (app) shell when useSubscription().readOnly === true; hides 'Adicionar manualmente' link on Home"
    - "OfflineBanner displays across (app) shell when navigator/heartbeat reports offline; mutating affordances are gated"
    - "Service worker StaleWhileRevalidate runtime cache serves catalog GETs from cache instantly and revalidates in background, registered BEFORE the existing NetworkOnly('/api/*') catch-all"
    - "ExpirationPlugin enforces maxAgeSeconds=7d, maxEntries=200, purgeOnQuotaError=true on the catalog runtime cache"
    - "User who loaded catalog online can go offline and still browse plants from the SW + IDB cache; identify CTA shows offline-blocked message"
  artifacts:
    - path: "src/app/(app)/page.tsx"
      provides: "Home empty + bridge state per UI-04 / UI-SPEC §4.5"
      contains: "CaptureButton"
    - path: "src/app/(app)/identify/page.tsx"
      provides: "/identify placeholder (Phase 6 replaces) with offline-blocked message"
      contains: "useOnlineStatus"
    - path: "src/app/(app)/app-shell.tsx"
      provides: "ReadOnlyBanner wired to useSubscription() + OfflineBanner already mounted"
      contains: "useSubscription"
    - path: "src/app/sw.ts"
      provides: "Serwist StaleWhileRevalidate allowlist for catalog GETs (D-19)"
      contains: "StaleWhileRevalidate"
    - path: "src/messages/pt-BR.json"
      provides: "home.bridge.body ICU plural + identify.placeholder.* + catalog.offline.identifyBlocked keys"
      contains: "home"
    - path: "tests/unit/sw-runtime-cache.test.ts"
      provides: "Vitest unit-dom mock test for SWR allowlist + ExpirationPlugin (Nyquist Signed URL TTL)"
    - path: "tests/e2e/catalog-offline.spec.ts"
      provides: "OFF-08 E2E — online load → offline → catalog browsable + offline banner + identify blocked"
    - path: "tests/e2e/axe-placeholder-pages.spec.ts"
      provides: "Axe ROUTES extended for Phase 5 surfaces (Catalog routes a11y baseline)"
  key_links:
    - from: "src/app/(app)/page.tsx"
      to: "@shared/ui/capture-button"
      via: "CaptureButton component (breathing prop)"
      pattern: "CaptureButton.*breathing"
    - from: "src/app/(app)/page.tsx"
      to: "src/contexts/catalog/infrastructure/db/plants.ts"
      via: "countForUser repository function (from 05-03) called in server component"
      pattern: "countForUser"
    - from: "src/app/(app)/identify/page.tsx"
      to: "@shared/online/use-online-status"
      via: "useOnlineStatus hook for offline-blocked message"
      pattern: "useOnlineStatus"
    - from: "src/app/(app)/app-shell.tsx"
      to: "src/contexts/billing/application/use-subscription"
      via: "useSubscription() hook (from 05-11) drives ReadOnlyBanner active prop"
      pattern: "useSubscription"
    - from: "src/app/sw.ts"
      to: "serwist (StaleWhileRevalidate, ExpirationPlugin)"
      via: "registerCapture before NetworkOnly /api/*"
      pattern: "StaleWhileRevalidate"
---

<objective>
Ship the Home tab empty + bridge surfaces (UI-04 / UI-SPEC §4.5), the /identify placeholder polish (Phase 6 replaces), the Serwist `StaleWhileRevalidate` runtime cache for catalog GETs (D-19/D-20), and the cross-surface read-only + offline banner wiring that satisfies OFF-08 (cached catalog browsable offline; identify blocked when offline).

Purpose: The Home empty state is the user's first surface after email verification — it must drive them to the <2 min core-value moment via the breathing capture button + manual-add escape hatch. The Serwist SWR allowlist closes the read-side offline loop required by ROADMAP SC-5 ("a user who had previously loaded the catalog online can go offline and still browse those cached plants with a clear offline banner visible"). The read-only banner wiring flips Phase 3's hardcoded `active={false}` to the `useSubscription` stub from 05-11 (D-21).

Output:
- Home `(app)/page.tsx` replaced with custom dual-affordance composition (zero-plants) + bridge composition (≥1 plants)
- `(app)/identify/page.tsx` updated to render Phase 6-placeholder copy and an offline-blocked variant
- `(app)/app-shell.tsx` ReadOnlyBanner flipped from hardcoded `active={false}` to `useSubscription().readOnly`
- `src/app/sw.ts` extended with `StaleWhileRevalidate` + `ExpirationPlugin` allowlist for `/api/v1/plants*`, `/api/v1/photo-entries*`, `/api/v1/locations`
- `src/messages/pt-BR.json` extended with `home.bridge.body` (ICU plural), `identify.placeholder.*`, `catalog.offline.identifyBlocked` keys
- `tests/unit/sw-runtime-cache.test.ts` Vitest unit-dom mock spec covering SWR semantics + route precedence + ExpirationPlugin
- `tests/e2e/catalog-offline.spec.ts` Playwright spec covering OFF-08 (online load → setOffline(true) → catalog browsable + offline banner + identify CTA blocked)
- `tests/e2e/axe-placeholder-pages.spec.ts` ROUTES extended for the Phase 5 surfaces that have shipped (`/catalog/add`, `/catalog/[plantId]`, `/catalog/[plantId]/journal`)
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md

@src/app/sw.ts
@src/app/(app)/app-shell.tsx
@src/app/(app)/page.tsx
@src/app/(app)/identify/page.tsx
@src/shared/ui/capture-button.tsx
@src/shared/ui/empty-state.tsx
@src/shared/ui/read-only-banner.tsx
@src/shared/ui/offline-banner.tsx
@src/shared/online/use-online-status.ts
@src/messages/pt-BR.json
@tests/e2e/axe-placeholder-pages.spec.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase + dependent plans. -->
<!-- Use these directly — no codebase exploration needed. -->

From `src/shared/ui/capture-button.tsx`:
```typescript
export interface CaptureButtonProps {
  "aria-label": string;
  breathing?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}
export function CaptureButton(props: CaptureButtonProps): JSX.Element;
```

From `src/shared/ui/read-only-banner.tsx`:
```typescript
export interface ReadOnlyBannerProps {
  active: boolean;
}
export function ReadOnlyBanner({ active }: ReadOnlyBannerProps): JSX.Element | null;
```

From `src/shared/online/use-online-status.ts`:
```typescript
export function useOnlineStatus(): boolean; // true = online, false = offline
```

From `src/contexts/billing/application/use-subscription.ts` (shipped by Plan 05-11; client-only `"use client"` hook):
```typescript
// D-21 stub: returns { active: true, readOnly: false } in Phase 5; Phase 10 wires real Stripe state.
export function useSubscription(): { active: boolean; readOnly: boolean };
```

From `src/contexts/catalog/infrastructure/db/plants.ts` (extended in Plan 05-03):
```typescript
// Used by Home server component to switch between empty / bridge composition.
export async function countForUser(db: PlantsDb, userId: string): Promise<number>;
```

From `serwist` (already in package.json @9.5.7):
```typescript
import { StaleWhileRevalidate, ExpirationPlugin } from "serwist";
// serwist.registerCapture(matcher, strategy, method?) — first-match-wins ordering.
```

Existing `src/app/sw.ts` registration order (DO NOT BREAK):
1. `serwist.registerCapture(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());` — current line 70
2. `serwist.registerCapture(({ request }) => request.mode === "navigate", new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 3 }));` — current line 78–84

The new SWR allowlist MUST be registered BEFORE step (1) because Serwist resolves first-match-wins.

i18n keys already shipped (DO NOT change):
- `home.empty.title`, `home.empty.hint`, `home.empty.cta`, `home.empty.manualLink` (UI-SPEC §4.5 confirmed)
- `offline.banner.label`, `readonly.banner.label`, `nav.tabs.*`

i18n keys to ADD in this plan (under existing root namespaces):
- `home.bridge.body` — ICU plural: `{count, plural, one {Você tem # planta no seu catálogo.} other {Você tem # plantas no seu catálogo.}}`
- `home.bridge.cta` — `Ver catálogo`
- `identify.placeholder.title` — `Em breve`
- `identify.placeholder.hint` — `Esta é a etapa onde a identificação por foto chega. Por enquanto, adicione plantas manualmente pelo catálogo.`
- `identify.placeholder.offlineBlocked` — `Identificação requer conexão à internet.`
- `catalog.offline.identifyBlocked` — `Identificação requer conexão à internet.` (sibling key reused by future surfaces)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend Serwist service worker with StaleWhileRevalidate allowlist for catalog GETs (D-19/D-20)</name>
  <files>src/app/sw.ts, tests/unit/sw-runtime-cache.test.ts</files>
  <behavior>
    - Test: SWR strategy is registered BEFORE the existing NetworkOnly('/api/*') capture (route precedence — first-match-wins)
    - Test: Matcher returns true for `/api/v1/plants`, `/api/v1/plants/123`, `/api/v1/plants?cursor=foo`, `/api/v1/photo-entries`, `/api/v1/photo-entries/abc`, `/api/v1/locations`
    - Test: Matcher returns false for `/api/v1/health/connectivity`, `/api/v1/identifications`, `/api/v1/iam/me`, `/api/v1/auth/login`
    - Test: Matcher returns false for non-GET methods (POST, PATCH, DELETE) — registerCapture('GET') filters method
    - Test: ExpirationPlugin is constructed with `maxAgeSeconds: 7 * 24 * 60 * 60` (604800), `maxEntries: 200`, `purgeOnQuotaError: true` (Pitfall 2)
    - Test: cacheName is `'catalog-api-v1'`
    - Test: Cache key is the full URL including the `?expires=&token=` signed-URL query params (D-20 byte-cache by URL)
  </behavior>
  <action>
    Open `src/app/sw.ts`. After the existing `serwist` instantiation (line 54–68) and BEFORE the existing `serwist.registerCapture(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());` line (current line 70), insert a new `StaleWhileRevalidate` capture per RESEARCH.md Pattern 4 (D-19). Implementation:

    ```typescript
    import { Serwist, NetworkOnly, NetworkFirst, StaleWhileRevalidate, ExpirationPlugin } from "serwist";

    const catalogGetsStrategy = new StaleWhileRevalidate({
      cacheName: "catalog-api-v1",
      plugins: [
        new ExpirationPlugin({
          maxAgeSeconds: 7 * 24 * 60 * 60,
          maxEntries: 200,
          purgeOnQuotaError: true,
        }),
      ],
    });

    serwist.registerCapture(
      ({ url, request }) => {
        if (request.method !== "GET") return false;
        const p = url.pathname;
        return (
          p.startsWith("/api/v1/plants") ||
          p.startsWith("/api/v1/photo-entries") ||
          p === "/api/v1/locations"
        );
      },
      catalogGetsStrategy,
    );

    // Existing NetworkOnly catch-all stays AFTER the SWR allowlist (first-match-wins).
    serwist.registerCapture(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());
    ```

    Why before the NetworkOnly catch-all: Serwist resolves matchers first-match-wins per RESEARCH.md Pattern 4. The SWR matcher is a strict subset of `/api/*` — placing it after would result in NetworkOnly winning every time and the SWR cache would be dead.

    Why `maxEntries: 200` + `purgeOnQuotaError: true`: per Pitfall 2 (signed URL expiry vs cache key collision). Each 24h-TTL refresh mints a new full URL, so each catalog refetch creates new cache entries. The 7d `maxAgeSeconds` naturally evicts dead URLs; `maxEntries` caps concurrent inflight; `purgeOnQuotaError` recovers gracefully under quota pressure.

    Why we DO NOT use `ignoreSearch: true`: Pitfall 2 advises against it. Photo paths are unique per photo (`{userId}/{plantId}/{photoId}.ext`) so no collision risk, but the byte-cache MUST key by full URL (with token) so revoked tokens cannot be served from cache.

    Per CLAUDE.md "no comments unless logic is too complex" — keep inline comments minimal; the bulk of context belongs in the SUMMARY, not the code.

    Create `tests/unit/sw-runtime-cache.test.ts` as a Vitest unit-dom test (Nyquist sampling — VALIDATION.md §Nyquist "Signed URL TTL"). Mock the `serwist` `Serwist`, `StaleWhileRevalidate`, `ExpirationPlugin`, `NetworkOnly`, `NetworkFirst` exports via `vi.mock("serwist", ...)`. Capture the registered captures (call order + matcher functions + strategy instances) by spying on `serwist.registerCapture`. Then assert:
    - `registerCapture` is called with the SWR matcher BEFORE the NetworkOnly `/api/*` matcher
    - The SWR matcher returns true/false for the URL/method test inputs above
    - `ExpirationPlugin` was constructed with `{ maxAgeSeconds: 604800, maxEntries: 200, purgeOnQuotaError: true }`
    - `StaleWhileRevalidate` was constructed with `cacheName: "catalog-api-v1"`

    Use `vi.fn()` constructors to capture instantiation args. Run via `pnpm test:unit` (NEVER watch mode per CLAUDE.md project rule).
  </action>
  <verify>
    <automated>pnpm test:unit -- sw-runtime-cache</automated>
  </verify>
  <done>
    `src/app/sw.ts` has the StaleWhileRevalidate capture registered before the NetworkOnly `/api/*` catch-all; ExpirationPlugin configured with the three required options; `pnpm test:unit -- sw-runtime-cache` passes; no TypeScript errors from `pnpm tsc --noEmit`; the existing NetworkFirst navigate handler and SKIP_WAITING listener remain untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace Home page composition + polish /identify placeholder + extend i18n keys</name>
  <files>src/app/(app)/page.tsx, src/app/(app)/identify/page.tsx, src/messages/pt-BR.json</files>
  <action>
    **Replace** `src/app/(app)/page.tsx` (current implementation uses the single-CTA `<EmptyState>` primitive which CANNOT support the dual-affordance UI-SPEC §4.5 layout — `EmptyState` enforces single-CTA by API). The new Home page is an `async` server component that:

    1. Calls `requireVerifiedUser(...)` from `@shared/api/auth` (mirror Phase 4 D-21 gating used by `(app)/layout.tsx`). If gating already happens at the layout level for all `(app)/*` routes, fetch the userId from the layout-provided context — read `src/app/(app)/layout.tsx` to confirm the auth seam and reuse it. If `(app)/layout.tsx` already injects `userId` via a server-only helper (e.g. `getVerifiedUserId()`), call that here.
    2. Calls `countForUser(defaultDb, userId)` from `@catalog/infrastructure/db/plants` (shipped by Plan 05-03). The import path follows the established convention in the codebase (check `src/contexts/catalog/infrastructure/db/plants.ts` for the actual export name — use it verbatim).
    3. Branches the rendered tree based on the count:
       - `count === 0` → renders the **dual-affordance empty composition** (UI-SPEC §4.5):
         - Outer wrapper: `<div className="flex min-h-[calc(100dvh-64px-80px)] flex-col items-center justify-center gap-6 px-5 py-8 text-center">` (vertically centered above bottom-nav per UI-SPEC §4.5 layout)
         - Headline: `<h1 className="font-serif text-[32px] leading-[38px] font-medium text-forest dark:text-moonpaper">{t('home.empty.title')}</h1>`
         - Hint: `<p className="text-base text-slate dark:text-lantern-slate">{t('home.empty.hint')}</p>`
         - 96px clearance gap (`mt-24` Tailwind = 96px) above the capture button
         - Primary CTA: `<Link href="/identify" aria-label={t('home.empty.cta')}><CaptureButton aria-label={t('home.empty.cta')} breathing /></Link>` — Phase 3 D-08 reduced-motion already drops the breathing animate when `prefers-reduced-motion: reduce`.
         - Secondary text link (HIDDEN when read-only — see Task 3 — for now render unconditionally; D-21 wiring via `useSubscription()` lives in Task 3 / app-shell wiring): tertiary link `<Link href="/catalog/add" className="text-canopy underline-offset-2 hover:underline mt-6">{t('home.empty.manualLink')}</Link>` — 24px gap below capture button per UI-SPEC §4.5.
       - `count >= 1` → renders the **bridge composition** (UI-SPEC §4.5 line 193 — Phase 8 supersedes):
         - Outer wrapper: same vertical-center layout
         - Body: `<p className="text-base text-forest dark:text-moonpaper">{t('home.bridge.body', { count })}</p>` — ICU plural via `next-intl` `t()` interpolation
         - Tertiary CTA: `<Link href="/catalog" className="text-canopy underline-offset-2 hover:underline mt-4">{t('home.bridge.cta')}</Link>`

    Use `getTranslations` from `next-intl/server` for the server-component i18n (mirror existing `src/app/(app)/page.tsx:1` pattern). Do not import `EmptyState` — the dual-affordance + bridge layouts compose `<CaptureButton>` + `<Link>` directly because EmptyState is single-CTA-only by contract.

    The capture button MUST be wrapped in a `<Link href="/identify">` for navigation. `CaptureButton` accepts `onClick` but for server-component-friendliness use the anchor wrapper — the breathing animation still fires (CaptureButton is `"use client"` and renders inside the Link DOM).

    **Update** `src/app/(app)/identify/page.tsx`. Currently imports `EmptyState` and points at `/identify/start` (which does not exist in Phase 5). Phase 6 replaces this page with the actual identification flow; Phase 5 ships an "Em breve" placeholder that ALSO surfaces the offline-blocked message (UI-04 + ROADMAP Phase 6 SC-5 pre-echo: "offline identify shows 'Identificação requer conexão à internet.'").

    Implementation: keep it as a **server-component shell** that renders a thin client child for the offline detection (`useOnlineStatus` is a `"use client"` hook). Create the client child inline if simple, or as a co-located `_identify-placeholder.tsx` client component. The client component:
    - Calls `useOnlineStatus()`
    - Online → renders headline `t('identify.placeholder.title')` + hint `t('identify.placeholder.hint')` (no CTA — Phase 6 wires)
    - Offline → renders headline `t('identify.placeholder.title')` + a sonner-styled inline notice block with `t('identify.placeholder.offlineBlocked')` and a `WifiOffIcon` (lucide-react). Use a `<div role="status" aria-live="polite">` so screen readers announce the offline-blocked state — same accessibility contract as `<OfflineBanner>`.

    Tailwind classes follow Phase 3 conventions (Forest Ink / Moonpaper for headlines, Calm Slate / Lantern Slate for body, Rust for offline notice background `bg-rust/10 text-rust`).

    Do NOT use the `EmptyState` primitive on `/identify` because (a) Phase 6 needs to drop in a different layout anyway, and (b) the offline conditional swap doesn't fit EmptyState's single-CTA contract.

    **Extend** `src/messages/pt-BR.json`:
    - Add to `home` namespace (sibling of `home.empty`):
      ```json
      "bridge": {
        "body": "{count, plural, one {Você tem # planta no seu catálogo.} other {Você tem # plantas no seu catálogo.}}",
        "cta": "Ver catálogo"
      }
      ```
    - Replace `identify.empty` (Phase 3 placeholder) with a new `identify.placeholder` object:
      ```json
      "identify": {
        "placeholder": {
          "title": "Em breve",
          "hint": "Esta é a etapa onde a identificação por foto chega. Por enquanto, adicione plantas manualmente pelo catálogo.",
          "offlineBlocked": "Identificação requer conexão à internet."
        }
      }
      ```
      Note: this REPLACES the existing `identify.empty.*` keys. The current Home page is the only consumer of `identify.empty` (it links there via `ctaHref`). Search the repo with `grep -rn "identify.empty" src/` to confirm no other consumers exist before removing.
    - Add to `catalog` namespace (sibling of `catalog.empty`):
      ```json
      "offline": {
        "identifyBlocked": "Identificação requer conexão à internet."
      }
      ```
      (Sibling key reserved for the catalog-side identify CTA when read-only paywall lands in Phase 6 — populating now keeps the i18n contract stable. UI-SPEC line 756 already mentions `catalog.offline.mutationBlocked`; that key may be added by Plans 05-15/05-16/05-17 — coordinate via `grep -rn "catalog.offline" src/messages/`.)

    Run `pnpm tsc --noEmit` and confirm `next-intl` does not warn about missing keys at build time. Run `pnpm build` (or `pnpm next build` if available) to confirm no SSR errors from the server-component fetch.

    **Per CLAUDE.md project skills** — follow existing import organization (lucide icons grouped with other lucide imports, `@shared/*` aliases preserved). NO comments in code. Use `file_path:line_number` if referencing existing patterns in commit message.
  </action>
  <verify>
    <automated>pnpm tsc --noEmit && pnpm test:run -- pt-br-i18n 2>/dev/null || pnpm test:run</automated>
  </verify>
  <done>
    `src/app/(app)/page.tsx` renders the dual-affordance empty composition for `count === 0` and the bridge composition for `count >= 1`; `src/app/(app)/identify/page.tsx` renders the placeholder + offline-blocked variant; `src/messages/pt-BR.json` contains `home.bridge.*`, `identify.placeholder.*`, `catalog.offline.identifyBlocked` keys; `pnpm tsc --noEmit` passes; no `next-intl` missing-key warnings.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire ReadOnlyBanner via useSubscription + extend axe ROUTES + ship OFF-08 catalog-offline E2E</name>
  <files>src/app/(app)/app-shell.tsx, tests/e2e/axe-placeholder-pages.spec.ts, tests/e2e/catalog-offline.spec.ts</files>
  <behavior>
    - Test (axe spec): `/catalog/add`, `/catalog/[plantId]` (with seeded plant), `/catalog/[plantId]/journal`, `/identify` are added to the ROUTES array; 0 serious/critical violations under all 4 color-scheme × reduced-motion combos
    - Test (offline E2E — OFF-08): `authedUser` fixture seeds a verified trialing user + at least 1 plant via the API; navigate to `/catalog` online → plants render; `context.setOffline(true)` → reload `/catalog` → plants STILL visible (from SW + IDB cache); `<OfflineBanner>` is visible (`role="status"` containing "Você está offline"); navigate to `/identify` → offline-blocked notice visible (`role="status"` containing "Identificação requer conexão"); 0 axe serious/critical violations on the offline catalog view
    - Test (read-only banner wiring): `ReadOnlyBanner` is a client component receiving `active={useSubscription().readOnly}`; under the read-only fixture (Plan 05-11) the banner appears with the locked-state copy
  </behavior>
  <action>
    **Modify** `src/app/(app)/app-shell.tsx`. The current line 146 reads `<ReadOnlyBanner active={false} />` (Phase 3 hardcoded stub). Phase 5 D-21 wires this to the `useSubscription()` hook from Plan 05-11.

    Implementation:
    1. Add `import { useSubscription } from "@billing/application/use-subscription";` (path follows the project's `@*` aliases — confirm in `tsconfig.json` paths section; if the alias is `@/contexts/billing/...` use that). Cross-check via `grep -n '"@billing"' tsconfig.json` and use whatever the actual alias is. If no alias exists, use the relative or `@contexts/billing/...` form already used elsewhere (search via `grep -rn "from \"@" src/app/(app)/app-shell.tsx`).
    2. Inside the component body, call `const { readOnly } = useSubscription();` near the other hooks (above the JSX return).
    3. Replace `<ReadOnlyBanner active={false} />` with `<ReadOnlyBanner active={readOnly} />`.
    4. The `OfflineBanner` already mounts on line 145 — leave it.
    5. The banners are sibling components (Phase 3 wired this already). Banner stacking — when both `offline` and `readOnly` are true, both banners render stacked vertically. UI-SPEC §4.5 says "never stack visually" but the spec does not specifically address this composition. Default behavior: stack vertically because they convey different information (offline = transient, readOnly = persistent subscription state). Surface this in the SUMMARY as an open visual question for founder review; do NOT branch one out conditionally without UI-SPEC sign-off.

    Read `app-shell.tsx` first (the full file, not just the snippet) to understand the existing hook call positions and import organization. Follow the exact patterns. NO comments unless logic is genuinely complex per CLAUDE.md.

    **Extend** `tests/e2e/axe-placeholder-pages.spec.ts`. The current `ROUTES` constant is `["/", "/catalog", "/identify", "/profile", "/offline"]` (line 4). Phase 5 surfaces that have shipped by Wave 4 are `/catalog/add`, `/catalog/[plantId]`, `/catalog/[plantId]/journal`. Routes with dynamic segments require a seeded plant — for those, switch to a `test.beforeAll` that seeds a plant via the `authedUser` fixture (Plan 05-01 ships `tests/e2e/fixtures/authed-user.ts`) and captures the plant id, then iterates dynamic routes with the seeded id.

    Implementation pattern:
    1. Keep the existing static ROUTES + COMBOS loop unchanged.
    2. Add a separate `test.describe('Phase 5 catalog routes axe', ...)` block that uses `authedUser` fixture + a seeded plant + iterates dynamic routes:
       - `/catalog/add`
       - `/catalog/${plantId}` (where `plantId` comes from the seed step)
       - `/catalog/${plantId}/journal`
    3. Each new test runs the same `AxeBuilder({ page }).analyze()` + 0-serious/critical assertion as the existing block.

    The fixture is `import { test, expect } from "../fixtures/authed-user";` (Plan 05-01 ships this fixture; use the exact import the fixture exports). The seeding helper for a plant comes from the existing `seedUser` pattern + a follow-up POST to `/api/v1/plants` from the test (or via direct DB insert via the test seam — choose whichever the Phase 5 test infra exposes). If Plan 05-01 does NOT ship a `seedPlant` helper, gracefully skip the `[plantId]` and `[plantId]/journal` routes with a `test.skip` and a TODO referencing follow-up.

    **Create** `tests/e2e/catalog-offline.spec.ts` for OFF-08 (Nyquist SW offline + IDB persistence per VALIDATION.md). The spec must:

    1. Use the `authedUser` fixture (NOT `test` from `@playwright/test` — the fixture wraps both the page + the authenticated session cookies).
    2. Seed at least 1 plant via the fixture (or via a direct API POST inside `test.beforeEach`). Note: this may require Plan 05-01 to ship a `seedPlant` helper or the test creates the plant via a real POST to `/api/v1/plants` while online.
    3. Test 1 — **Online preload + offline catalog browse**:
       - Navigate to `/catalog` online; `await page.waitForLoadState("networkidle")` so SW + TanStack persister fully hydrate the catalog response into the SWR runtime cache + IDB.
       - Confirm at least 1 plant card is visible (assert via the role/text of the seeded plant — the catalog grid is shipped by Plan 05-15).
       - `await context.setOffline(true)`.
       - `await page.reload()`.
       - `await page.waitForTimeout(500)` (heartbeat ping fail).
       - Assert plants STILL visible (the SW served the cached `/api/v1/plants` GET via the SWR allowlist + the IDB persister rehydrated TQ).
       - Assert OfflineBanner visible: `await expect(page.getByRole("status").filter({ hasText: /Você está offline/i })).toBeVisible();`
       - Assert NO `<ReadOnlyBanner>` visible (default fixture is `readOnly: false`): `await expect(page.getByRole("status").filter({ hasText: /Sua assinatura expirou/i })).not.toBeVisible();`
       - Run AxeBuilder + 0-serious/critical assertion on the offline catalog view (Axe Catalog routes per VALIDATION.md).
    4. Test 2 — **Identify blocked when offline**:
       - Online preload (same setup).
       - `await context.setOffline(true)` + reload `/identify`.
       - Assert `await expect(page.getByRole("status").filter({ hasText: /Identificação requer conexão/i })).toBeVisible();`
       - Assert OfflineBanner also visible at top.
    5. After each test: `await context.setOffline(false);` cleanup (mirror line 77 of `axe-placeholder-pages.spec.ts`).

    The spec MUST run with real Chromium IDB + real Serwist SW (not mocked) — that's the entire point of the OFF-08 stratum per VALIDATION.md line 103. Do NOT add `playwright.config.ts` overrides that disable the SW.

    Per CLAUDE.md "Never start local dev server" — Playwright spec assumes the test command boots its own dev server (typical Playwright config). Verify via `pnpm test:e2e` (NEVER watch-mode flags).

    **Threat-model self-check (T-05-18-01/02/03 from frontmatter):**
    - T-05-18-01 (signed URL leakage): the SW byte-cache `maxAgeSeconds: 7d` is GREATER than the 24h URL TTL, but that's safe because once the URL token expires upstream the cached response becomes useless (server rejects). Still — when the user logs out, the SW runtime cache MUST be flushed. Add an explicit follow-up TODO in the SUMMARY: "Phase 4 logout flow currently does not call `caches.delete('catalog-api-v1')`. Decide whether logout flushes SW cache or relies on per-origin scoping + verified-user gate. Track in next phase."
    - T-05-18-02 (cross-user contamination on shared device): the SW runtime cache is per-origin (browser-enforced). The TanStack persister flush happens via Plan 05-10's logout hook (verify via grep). No additional Phase 5 work — note in SUMMARY that this is verified by Plan 05-10's mitigation, not duplicated here.
    - T-05-18-03 (offline read-only revealing identify CTA): mitigated in Task 2 — `/identify` shows the blocked notice instead of opening the flow. Verified by E2E Test 2.

    Run `pnpm test:e2e -- catalog-offline` and `pnpm test:e2e -- axe-placeholder-pages` to confirm both specs pass. (NEVER watch mode per CLAUDE.md.)
  </action>
  <verify>
    <automated>pnpm test:e2e -- catalog-offline && pnpm test:e2e -- axe-placeholder-pages</automated>
  </verify>
  <done>
    `src/app/(app)/app-shell.tsx` `<ReadOnlyBanner>` is wired to `useSubscription().readOnly`; `tests/e2e/axe-placeholder-pages.spec.ts` ROUTES extended for shipped Phase 5 surfaces (with `test.skip` fallback for routes that need plant seeding helpers not yet available); `tests/e2e/catalog-offline.spec.ts` covers OFF-08 with online-preload + offline catalog + offline /identify; both specs pass under `pnpm test:e2e`; no axe serious/critical regressions on existing static routes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser ↔ Service Worker | SW intercepts and caches catalog API responses; tampering or cache poisoning here affects only the local origin scope |
| SW Cache ↔ Supabase Storage signed URLs | Signed URLs are minted server-side with 24h TTL; cached bytes become useless after upstream token expiry |
| `(app)` shell ↔ subscription state | `useSubscription` stub returns constant `{active: true, readOnly: false}` in Phase 5; flipping to readOnly via the test fixture must not bleed into production sessions |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-18-01 | I (Information disclosure) | SW byte-cache (`catalog-api-v1`) holding signed photo URLs | mitigate | (a) `ExpirationPlugin` `maxAgeSeconds: 7d` > 24h URL TTL — but cached responses become useless after upstream token expiry (server rejects); (b) cache key is the FULL URL including `token` query param so revoked tokens cannot be served from a stale cache entry; (c) `purgeOnQuotaError: true` + `maxEntries: 200` cap growth (Pitfall 2). Follow-up surfaced in SUMMARY: logout flow should call `caches.delete('catalog-api-v1')` to flush across user switches on shared devices. |
| T-05-18-02 | T (Tampering) | SW runtime cache cross-user pollution on shared device | mitigate | SW runtime cache is per-origin (browser-enforced — no cross-origin contamination). User logout flushes the TanStack persister via the existing Plan 05-10 logout hook (T-05-10-01 mitigation — verified there, not duplicated here). Phase 5 D-19 does NOT introduce a new attack surface beyond per-origin scoping. |
| T-05-18-03 | I (Information disclosure) | `/identify` route revealing identification flow when offline (could leak that the feature is gated behind connectivity to a snooping shoulder-surfer) | accept | The placeholder reveals only the existence of the feature, not any user data. Offline-blocked notice + paywall semantics surface the same information any authenticated user could discover by navigating to `/identify`. Confirmed by E2E Test 2 of Task 3. |

</threat_model>

<verification>

**Per-task verification map (Nyquist sampling per VALIDATION.md):**

| Task | Stratum | Spec / Command | Coverage |
|------|---------|----------------|----------|
| 1 | Nyquist Signed URL TTL (Vitest unit-dom mock) | `pnpm test:unit -- sw-runtime-cache` | SWR registration order, allowlist matcher, ExpirationPlugin config (maxAgeSeconds=7d, maxEntries=200, purgeOnQuotaError=true), GET-only filter |
| 2 | i18n contract + TS + structural | `pnpm tsc --noEmit && pnpm test:run` | Server-component compiles, `next-intl` keys resolve, `pnpm build` succeeds |
| 3a | Axe Catalog routes (E2E + AxeBuilder) | `pnpm test:e2e -- axe-placeholder-pages` | 0 serious/critical on `/`, `/catalog`, `/identify`, `/profile`, `/offline` × 4 combos + new Phase 5 routes |
| 3b | OFF-08 + Nyquist SW offline (E2E real Chromium IDB + real SW) | `pnpm test:e2e -- catalog-offline` | Online preload → offline catalog browsable, OfflineBanner visible, identify-blocked notice on /identify, no axe regressions |

**Phase-level acceptance:**

- [ ] `src/app/sw.ts` SWR allowlist registered BEFORE NetworkOnly catch-all
- [ ] Vitest unit test asserts route precedence + ExpirationPlugin args
- [ ] Home empty composition uses `<CaptureButton breathing>` + Adicionar manualmente link (NOT `<EmptyState>`)
- [ ] Home bridge composition renders for `count >= 1` with ICU plural
- [ ] `/identify` placeholder shows "Em breve" online + "Identificação requer conexão" offline
- [ ] `<ReadOnlyBanner active={useSubscription().readOnly} />` in app-shell
- [ ] `tests/e2e/catalog-offline.spec.ts` exists and passes (OFF-08)
- [ ] `tests/e2e/axe-placeholder-pages.spec.ts` ROUTES extended for shipped Phase 5 surfaces (with `test.skip` fallback for surfaces needing future helpers)
- [ ] No watch-mode flags in any pnpm command (CLAUDE.md project rule)
- [ ] `pnpm tsc --noEmit` clean

</verification>

<success_criteria>

**Goal-backward (per CLAUDE.md core value clock):**
- A returning verified user with zero plants opens Home and sees the breathing capture button + "Adicionar manualmente" escape hatch — clear path to <2 min identification or manual cataloging.
- A returning verified user with ≥1 plants opens Home and sees the bridge "Você tem N planta(s) no seu catálogo." copy + "Ver catálogo" link until Phase 8 builds the real reminders surface.
- A user who loaded their catalog online can switch to airplane mode, reload `/catalog`, and STILL see all their plants (ROADMAP SC-5).
- A user offline who taps `/identify` sees the "Identificação requer conexão à internet." notice — no broken provider call attempt.
- When subscription state flips to `readOnly: true` (Phase 10 wires real; Phase 5 fixture flips), `<ReadOnlyBanner>` appears across all (app) surfaces.

**Validation strategy hooks (per VALIDATION.md):**
- OFF-08 (E2E): online → offline → catalog browsable + offline banner + identify blocked → covered by `tests/e2e/catalog-offline.spec.ts` (Task 3)
- Nyquist SW offline + IDB persistence (Playwright): real Chromium IDB + real SW used by `catalog-offline.spec.ts` (Task 3 — no SW mocks in E2E)
- Nyquist Signed URL TTL (Vitest unit-dom mock): `tests/unit/sw-runtime-cache.test.ts` (Task 1) asserts ExpirationPlugin args + URL-keyed cache
- Axe Catalog routes: `axe-placeholder-pages.spec.ts` ROUTES extended (Task 3) covers all shipped Phase 5 surfaces × 4 combos

</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-18-home-identify-serwist-offline-banners-SUMMARY.md` per template. Surface in the Open Questions / Followups section:

1. Logout flow + SW cache flush (T-05-18-01 follow-up): should logout call `caches.delete('catalog-api-v1')`? Track for Phase 4 retro / Phase 9 mutation queue plan.
2. Banner stacking visual (offline + readOnly both true): UI-SPEC §4.5 says "never stack visually" but doesn't address this composition. Default ships stacked; founder review for Phase 6 polish.
3. `tests/e2e/axe-placeholder-pages.spec.ts` dynamic-route coverage: if Plan 05-01 doesn't ship a `seedPlant` helper, dynamic routes (`/catalog/[plantId]`, `/catalog/[plantId]/journal`) use `test.skip` with a TODO. Confirm with Plan 05-01 SUMMARY whether the helper landed.
4. `identify.empty.*` keys removed in favor of `identify.placeholder.*` — verify no Phase 4 / Phase 5 surface still references the old keys via `grep -rn "identify.empty" src/`.
</output>
