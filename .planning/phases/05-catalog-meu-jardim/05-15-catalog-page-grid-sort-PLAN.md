---
phase: 05-catalog-meu-jardim
plan: 15
type: execute
wave: 4
depends_on:
  - "05-08"
  - "05-10"
  - "05-11"
files_modified:
  - src/app/(app)/catalog/page.tsx
  - src/app/(app)/catalog/_components/catalog-grid.tsx
  - src/app/(app)/catalog/_components/catalog-header.tsx
  - src/app/(app)/catalog/_components/catalog-empty.tsx
  - src/app/(app)/catalog/_components/plant-card.tsx
  - src/app/(app)/catalog/_components/use-sort-preference.ts
  - src/app/(app)/catalog/_components/use-sort-preference.unit.test.ts
  - tests/e2e/axe-placeholder-pages.spec.ts
  - tests/e2e/catalog-grid-sort.spec.ts
autonomous: true
requirements:
  - CAT-07
  - CAT-08
  - CAT-10
  - CAT-11
  - UI-04
  - UI-07
tags:
  - catalog
  - ui
  - rsc
  - tanstack-query
  - sort
  - sessionStorage
  - a11y
must_haves:
  truths:
    - "Visiting /catalog with zero plants renders <CatalogEmpty> per UI-SPEC §4 (Sage line-art + Source Serif headline 'Sua estante ainda está esperando a primeira planta.' + Calm Slate hint + ONE Canopy CTA 'Identificar planta' linking to /identify)."
    - "Visiting /catalog with ≥1 plant renders <CatalogHeader> + <CatalogGrid> populated from SSR data — no skeleton flash on first paint (RESEARCH Pattern 1 / D-13)."
    - "<CatalogGrid> renders 2 columns at viewport ≤599px, 3 columns at 600–899px, 4 columns at ≥900px (UI-SPEC §2 / CAT-10)."
    - "<PlantCard> matches UI-SPEC §1 locked geometry: 16px radius, 4:5 photo top, 16px inner padding, name (Plus Jakarta Sans 16/24 w600), optional nickname, location with MapPin icon."
    - "<CatalogHeader> sort <Select> exposes the 5 options (date_new, date_old, name_asc, name_desc, location) with pt-BR labels from messages/pt-BR.json catalog.sort.options.* (provided by 05-10)."
    - "useSortPreference reads sessionStorage key 'folhario.catalog.sort' on mount, returns 'date_new' default when key absent, and writes the new sort_id when the user changes the <Select>."
    - "Selecting a different sort persists across in-app navigation within the same browser tab (e.g., /catalog → /catalog/[plantId] → back returns to the same sort)."
    - "Closing the tab clears the sessionStorage entry — opening a fresh tab reverts to default 'date_new'."
    - "When useSubscription().readOnly is true, the 'Adicionar planta' button in <CatalogHeader> is hidden (D-21)."
    - "tests/e2e/axe-placeholder-pages.spec.ts ROUTES array includes /catalog (filled state via authedUser fixture seeding ≥1 plant) — 0 serious + critical violations across all 4 colorScheme/reducedMotion combos."
    - "tests/e2e/catalog-grid-sort.spec.ts asserts 2/3/4 column counts at 375/600/900 viewports AND sort persists across navigation within the same tab."
  artifacts:
    - path: "src/app/(app)/catalog/page.tsx"
      provides: "Server Component shell — fetchQuery for first page (cursor null + ?include_count=1) → branches CatalogEmpty vs CatalogGrid + HydrationBoundary"
      min_lines: 30
      contains: "fetchQuery"
    - path: "src/app/(app)/catalog/_components/catalog-grid.tsx"
      provides: "Client component — responsive 2/3/4 col grid rendering <PlantCard> per result; consumes hydrated TQ cache"
      exports: ["CatalogGrid"]
      min_lines: 40
    - path: "src/app/(app)/catalog/_components/catalog-header.tsx"
      provides: "Client component — section label + count chip + sort <Select> + Adicionar planta button (gated by useSubscription().readOnly)"
      exports: ["CatalogHeader"]
      min_lines: 30
    - path: "src/app/(app)/catalog/_components/catalog-empty.tsx"
      provides: "Client component — UI-SPEC §4 / CAT-11 empty state (composes Phase 3 <EmptyState> with catalog.empty.* keys)"
      exports: ["CatalogEmpty"]
      min_lines: 10
    - path: "src/app/(app)/catalog/_components/plant-card.tsx"
      provides: "Client component — UI-SPEC §1 plant card geometry (16px radius / 4:5 photo / 16px padding / shadow)"
      exports: ["PlantCard", "type PlantCardProps"]
      min_lines: 30
    - path: "src/app/(app)/catalog/_components/use-sort-preference.ts"
      provides: "Client hook returning [sortId, setSortId] backed by sessionStorage 'folhario.catalog.sort' (SSR-safe; defaults to 'date_new')"
      exports: ["useSortPreference", "type SortId", "SORT_IDS"]
      min_lines: 20
    - path: "src/app/(app)/catalog/_components/use-sort-preference.unit.test.ts"
      provides: "Vitest unit-dom coverage: round-trip read/write, default-when-absent, SSR-safe (no window), invalid value falls back to default"
      min_lines: 30
    - path: "tests/e2e/axe-placeholder-pages.spec.ts"
      provides: "Axe a11y gate — /catalog (filled state) added to ROUTES array; 0 serious/critical violations"
      contains: "/catalog"
    - path: "tests/e2e/catalog-grid-sort.spec.ts"
      provides: "Playwright E2E: responsive viewport assertions (2 cols @375, 3 @600, 4 @900) + sort persistence across navigation in same tab"
      min_lines: 30
  key_links:
    - from: "src/app/(app)/catalog/page.tsx"
      to: "@contexts/catalog/queries"
      via: "fetchQuery(plantsKeys.lists({ sort: 'date_new' }))"
      pattern: "fetchQuery\\(plantsKeys"
    - from: "src/app/(app)/catalog/page.tsx"
      to: "@tanstack/react-query"
      via: "dehydrate + HydrationBoundary"
      pattern: "HydrationBoundary"
    - from: "src/app/(app)/catalog/_components/catalog-header.tsx"
      to: "src/app/(app)/catalog/_components/use-sort-preference.ts"
      via: "useSortPreference() inside the client component"
      pattern: "useSortPreference"
    - from: "src/app/(app)/catalog/_components/catalog-header.tsx"
      to: "@contexts/billing/application/use-subscription"
      via: "useSubscription().readOnly gates Adicionar planta button"
      pattern: "useSubscription"
    - from: "src/app/(app)/catalog/_components/catalog-grid.tsx"
      to: "src/app/(app)/catalog/_components/plant-card.tsx"
      via: "<PlantCard /> mapped over plants array"
      pattern: "<PlantCard"
    - from: "src/app/(app)/catalog/_components/catalog-empty.tsx"
      to: "src/shared/ui/empty-state.tsx"
      via: "Composes <EmptyState> with catalog.empty.* messages"
      pattern: "<EmptyState"
    - from: "tests/e2e/catalog-grid-sort.spec.ts"
      to: "tests/e2e/fixtures/authed-user.ts"
      via: "authedUser fixture seeds plants for the spec"
      pattern: "authedUser"
---

<objective>
Replace the empty-only `src/app/(app)/catalog/page.tsx` with a Server Component that pre-fetches the first catalog page (cursor null + `?include_count=1`) and dehydrates it into the client TanStack Query cache via `<HydrationBoundary>` per RESEARCH Pattern 1 (D-13). Branch on the SSR'd `total_count`: zero rows → `<CatalogEmpty>`; non-zero → `<CatalogHeader>` + `<CatalogGrid>` rendering `<PlantCard>` items at the locked 2/3/4-column responsive ladder. Ship the `useSortPreference` sessionStorage hook (D-11), an axe gate extension covering the filled-state route, and a Playwright spec proving responsive column counts + sort persistence across navigation.

Purpose: this is the first user-facing surface that proves the Phase 5 catalog stack end-to-end — Server Component → use-case (05-07) → route handler (05-08) → TanStack Query (05-10) → read-only-mode gating (05-11). It also locks the visual contract (Plant Card / Grid / Header / Empty) every other Wave 4 plan reuses (05-16 reuses Plant Card geometry; 05-17 reuses card geometry on manual-add; 05-18 wires offline + read-only banners across them).

Output:
- Live `/catalog` route serving SSR'd first 50 plants OR Empty State
- `<CatalogGrid>` + `<CatalogHeader>` + `<CatalogEmpty>` + `<PlantCard>` client components
- `useSortPreference` hook + Vitest unit-dom tests (TDD)
- Axe + Playwright gates for responsive grid + sort persistence
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@CLAUDE.md

<!-- Replace target -->
@src/app/(app)/catalog/page.tsx

<!-- Phase 3 primitives reused -->
@src/shared/ui/empty-state.tsx
@src/shared/ui/select.tsx
@src/shared/ui/skeleton.tsx
@src/shared/ui/read-only-banner.tsx

<!-- Wave 3 dependencies (must exist before this plan executes) -->
@src/contexts/catalog/queries/index.ts
@src/shared/ui/query-provider.tsx
@src/contexts/billing/application/use-subscription.ts

<!-- Existing test fixture + axe spec to extend -->
@tests/e2e/axe-placeholder-pages.spec.ts
@tests/e2e/fixtures/authed-user.ts

<interfaces>
<!-- Contracts the executor receives directly — no codebase exploration needed.
     These are produced by upstream Wave 1–3 plans (05-08 / 05-10 / 05-11). -->

From @contexts/catalog/queries (produced by 05-10 — Tkdodo factory pattern, RESEARCH Pattern 3):
```typescript
export const plantsKeys = {
  all: () => ['catalog', 'plants'] as const,
  lists: (params: { sort: SortId; cursor?: string; include_count?: boolean }) => ({
    queryKey: ['catalog', 'plants', 'list', params] as const,
    queryFn: () => listPlants(params),
    staleTime: 30_000,
  }),
  detail: (id: string) => ({ /* ... */ }),
};
```

From listPlants() response shape (produced by 05-08 GET /api/v1/plants — D-12 cursor + first-page count):
```typescript
type ListPlantsResponse = {
  plants: Array<{
    id: string;
    name: string;
    nickname: string | null;
    location: string | null;
    cover_photo_url: string | null;       // 24h signed URL per D-20
    acquisition_date: string | null;       // ISO yyyy-MM-dd
  }>;
  next_cursor: string | null;              // null = no more pages
  total_count?: number;                    // present only when ?include_count=1
};
```

From `<EmptyState>` (Phase 3 D-25 — locked single-CTA contract — `src/shared/ui/empty-state.tsx`):
```typescript
export interface EmptyStateProps {
  headline: string;
  hint: string;
  ctaLabel: string;
  illustrationSrc?: string;       // omit → renders placeholder leaf SVG
  ctaHref?: string;
  ctaOnClick?: () => void;
}
```

From `<Select>` (Phase 3 — `src/shared/ui/select.tsx`):
```typescript
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: string;
}
```

From useSubscription (produced by 05-11 — `src/contexts/billing/application/use-subscription.ts`):
```typescript
export type SubscriptionState = { active: boolean; readOnly: boolean };
export function useSubscription(): SubscriptionState;
// Phase 5 stub: returns { active: true, readOnly: false } unless SUBSCRIPTION_READ_ONLY=1
```

From RESEARCH Pattern 1 (D-13) — exact Server Component skeleton this plan implements:
```tsx
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { plantsKeys } from '@contexts/catalog/queries';

export default async function CatalogPage() {
  const queryClient = new QueryClient();
  const data = await queryClient.fetchQuery(
    plantsKeys.lists({ sort: 'date_new', include_count: true })
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {data.total_count === 0 ? <CatalogEmpty /> : <><CatalogHeader totalCount={data.total_count} /><CatalogGrid /></>}
    </HydrationBoundary>
  );
}
```
NOTE: use `fetchQuery` (returns the data) — NOT `prefetchQuery` (returns void) — because the SSR result must drive the empty/filled branch.

From `tests/e2e/axe-placeholder-pages.spec.ts:4` — current ROUTES array (this plan extends it):
```typescript
const ROUTES = ["/", "/catalog", "/identify", "/profile", "/offline"] as const;
// /catalog is already in the array but only ever serves the empty placeholder.
// After this plan, /catalog can render either empty OR filled — the spec must
// cover BOTH states. Use the authedUser fixture (05-01) to seed ≥1 plant for
// the filled scan; keep the unauthenticated empty-route scan via existing flow.
```

From `tests/e2e/fixtures/authed-user.ts` (produced by 05-01):
```typescript
export const test = base.extend<{ authedUser: { id: string; email: string } }>({
  authedUser: async ({ context }, use) => { /* seeds verified user + injects cookies */ },
});
```
This plan's E2E spec also seeds a plant via `POST /api/v1/plants` (05-08) using the authedUser session.
</interfaces>

<i18n_keys>
<!-- Keys consumed (DO NOT modify messages/pt-BR.json — owned by 05-10).
     This plan ONLY READS these keys. If 05-10 ships and any key is missing,
     surface as a 05-10 gap, not a fix here. -->

catalog.empty.title             → "Sua estante ainda está esperando a primeira planta."
catalog.empty.hint              → "Identifique sua primeira planta ou adicione manualmente."
catalog.empty.cta               → "Identificar planta"
catalog.header.label            → "MEU JARDIM"
catalog.header.countPlural      → ICU "{n, plural, one {# planta} other {# plantas}}"
catalog.header.addPlant         → "Adicionar planta"
catalog.sort.label              → "Ordenar por"
catalog.sort.options.dateNew    → "Adicionadas recentes"
catalog.sort.options.dateOld    → "Adicionadas antigas"
catalog.sort.options.nameAsc    → "Nome (A → Z)"
catalog.sort.options.nameDesc   → "Nome (Z → A)"
catalog.sort.options.location   → "Por local"
catalog.sort.announce           → ICU "Catálogo reordenado por {label}"
catalog.card.locationPrefix     → (decorative — alt for MapPin icon if needed)
</i18n_keys>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useSortPreference hook + unit tests (TDD)</name>
  <files>
    src/app/(app)/catalog/_components/use-sort-preference.ts,
    src/app/(app)/catalog/_components/use-sort-preference.unit.test.ts
  </files>
  <behavior>
    - Test 1 (default-when-absent): `sessionStorage` empty → hook returns `['date_new', setter]`.
    - Test 2 (round-trip): write 'name_asc' via setter → `sessionStorage.getItem('folhario.catalog.sort')` === 'name_asc'; remount hook → returns 'name_asc'.
    - Test 3 (invalid value rejected): set sessionStorage to 'bogus' before mount → hook returns 'date_new' (whitelist guard) AND clears the bad value.
    - Test 4 (SSR-safe): when `typeof window === 'undefined'` (mock or vitest jsdom toggle), hook still returns `'date_new'` without throwing.
    - Test 5 (whitelist): `SORT_IDS` exported as `['name_asc','name_desc','date_new','date_old','location'] as const`.
  </behavior>
  <action>
    Create `use-sort-preference.ts` exporting:
    ```typescript
    export const SORT_IDS = ['name_asc','name_desc','date_new','date_old','location'] as const;
    export type SortId = typeof SORT_IDS[number];
    const STORAGE_KEY = 'folhario.catalog.sort';
    export function useSortPreference(): [SortId, (next: SortId) => void];
    ```
    Implementation rules (per D-11):
    - Initial state via lazy `useState` initializer that reads `sessionStorage` ONLY when `typeof window !== 'undefined'`.
    - Validate against `SORT_IDS` whitelist (T-05-15-02 mitigation — defensive client-side enum guard); invalid → return default 'date_new' AND `sessionStorage.removeItem(STORAGE_KEY)`.
    - Setter writes to `sessionStorage` synchronously then updates React state (no useEffect race).
    - NO `useEffect`-based hydration (avoids the "first render returns wrong default" flash); the lazy initializer reads sessionStorage on the FIRST render. This is safe because the hook is only used in client components mounted under `<HydrationBoundary>` — the initial paint already comes from the SSR'd HTML, which doesn't call this hook.
    - File header: `"use client";`
    Vitest unit-dom test setup uses real `sessionStorage` (jsdom-provided) and `vi.unstubAllGlobals()` between tests.
  </action>
  <verify>
    <automated>pnpm vitest run src/app/(app)/catalog/_components/use-sort-preference.unit.test.ts</automated>
  </verify>
  <done>
    Hook + tests committed; all 5 tests green; type `SortId` exported as the 5-member union; `SORT_IDS` exported as `readonly` tuple consumable by Zod and `<Select>` options.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: PlantCard + CatalogEmpty + CatalogGrid client components</name>
  <files>
    src/app/(app)/catalog/_components/plant-card.tsx,
    src/app/(app)/catalog/_components/catalog-empty.tsx,
    src/app/(app)/catalog/_components/catalog-grid.tsx
  </files>
  <behavior>
    - PlantCard renders 4:5 next/image cover (signed URL from `cover_photo_url`; alt = `Foto de ${nickname || name}`), name (Plus Jakarta Sans 16/24 w600 truncate), optional nickname (14/20 w400 Calm Slate truncate), optional location prefixed by 14px MapPin icon.
    - PlantCard whole-card is a `<Link href={`/catalog/${plant.id}`}>`; press state class `active:scale-[0.985]` (reduced-motion fallback `motion-reduce:active:opacity-90 motion-reduce:active:scale-100`).
    - CatalogEmpty composes `<EmptyState>` with the i18n keys listed in `<i18n_keys>` above; `ctaHref="/identify"`.
    - CatalogGrid uses `useQuery(plantsKeys.lists({ sort, include_count: true }))` where `sort` comes from `useSortPreference()` (Task 1). Renders responsive grid via Tailwind: `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. To hit the EXACT 375 / 600 / 900 ladder per UI-SPEC §2 / CAT-10 (NOT default Tailwind breakpoints), use a custom inline breakpoint approach: `grid grid-cols-2 [@media(min-width:600px)]:grid-cols-3 [@media(min-width:900px)]:grid-cols-4 gap-4 px-5 [@media(min-width:900px)]:px-8`.
    - CatalogGrid skeleton: when `isLoading` AND data not yet hydrated, render 6 `<Skeleton>` cards inside the same grid layout (no container shift). Apply Phase 3 300ms gate (use existing `<Skeleton>` primitive's `gateMs` prop if present; otherwise wrap in conditional `useDelayedFlag`).
  </behavior>
  <action>
    Create three files. All start with `"use client";`.

    1. `plant-card.tsx`:
    ```typescript
    export interface PlantCardProps {
      plant: { id: string; name: string; nickname: string | null; location: string | null; cover_photo_url: string | null };
    }
    export function PlantCard({ plant }: PlantCardProps): JSX.Element;
    ```
    Use `next/image` with `width={400} height={500}` (4:5), `unoptimized={false}`, `sizes="(min-width:900px) 25vw, (min-width:600px) 33vw, 50vw"`.
    Tailwind classes: container `bg-ivory dark:bg-embered rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(20,52,36,0.06)] dark:shadow-none dark:border dark:border-hairline-umber active:scale-[0.985] motion-reduce:active:scale-100 motion-reduce:active:opacity-90 transition-transform duration-150`.
    Photo wrapper: `aspect-[4/5] w-full bg-hairline dark:bg-hairline-umber relative`.
    Inner padding block: `p-4 flex flex-col gap-2`.
    Name: `<h3 className="font-jakarta text-base/6 font-semibold text-forest dark:text-moonpaper truncate">{plant.name}</h3>`.
    Nickname (optional): `<p className="font-jakarta text-sm/5 font-normal text-slate dark:text-lantern-slate truncate">{plant.nickname}</p>` only when `plant.nickname` truthy.
    Location row (optional): `<p className="font-jakarta text-sm/5 font-normal text-slate dark:text-lantern-slate flex items-center gap-1 truncate"><MapPinIcon size={14} strokeWidth={1.5} aria-hidden /><span className="truncate">{plant.location}</span></p>` when `plant.location` truthy. Import: `import { MapPinIcon } from 'lucide-react'`.
    Wrap entire card in `<Link href={\`/catalog/\${plant.id}\`} className="block">…</Link>` from `next/link`.

    2. `catalog-empty.tsx`:
    ```typescript
    "use client";
    import { useTranslations } from 'next-intl';
    import { EmptyState } from '@shared/ui/empty-state';
    export function CatalogEmpty() {
      const t = useTranslations('catalog.empty');
      return <EmptyState headline={t('title')} hint={t('hint')} ctaLabel={t('cta')} ctaHref="/identify" />;
    }
    ```

    3. `catalog-grid.tsx`:
    ```typescript
    "use client";
    import { useQuery } from '@tanstack/react-query';
    import { plantsKeys } from '@contexts/catalog/queries';
    import { useSortPreference } from './use-sort-preference';
    import { PlantCard } from './plant-card';
    import { Skeleton } from '@shared/ui/skeleton';
    export function CatalogGrid() {
      const [sort] = useSortPreference();
      const { data, isLoading } = useQuery(plantsKeys.lists({ sort, include_count: true }));
      if (isLoading || !data) {
        return <div className="grid grid-cols-2 [@media(min-width:600px)]:grid-cols-3 [@media(min-width:900px)]:grid-cols-4 gap-4 px-5 [@media(min-width:900px)]:px-8">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}</div>;
      }
      return (
        <ul className="grid grid-cols-2 [@media(min-width:600px)]:grid-cols-3 [@media(min-width:900px)]:grid-cols-4 gap-4 px-5 [@media(min-width:900px)]:px-8" data-testid="catalog-grid">
          {data.plants.map(p => <li key={p.id}><PlantCard plant={p} /></li>)}
        </ul>
      );
    }
    ```

    Per D-30: discretion on Tailwind class composition is granted — class strings shown above are starting points; refine to match Phase 3 design tokens already in the repo. DO NOT change the breakpoint values (375/600/900) or column counts (2/3/4) — those are LOCKED by UI-SPEC §2 / CAT-10.

    NO unit test required for these three components — verification is the E2E + axe spec in Task 5 (per VALIDATION.md "Catalog routes" Axe stratum and "Catalog grid + sort" E2E stratum).
  </action>
  <verify>
    <automated>pnpm typecheck && pnpm lint src/app/(app)/catalog/_components/</automated>
  </verify>
  <done>
    Three files exist; `pnpm typecheck` passes; PlantCard exports props interface; CatalogGrid imports plantsKeys + useSortPreference + PlantCard; CatalogEmpty composes <EmptyState> with i18n keys.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: CatalogHeader (label + count + sort + Add Plant button)</name>
  <files>src/app/(app)/catalog/_components/catalog-header.tsx</files>
  <behavior>
    - Renders section label "MEU JARDIM" (uppercase, +4% tracking) + ICU-pluralized count chip + sort `<Select>` + (when not readOnly) "Adicionar planta" link to `/catalog/add`.
    - Sort `<Select>` reads/writes via `useSortPreference()` (Task 1).
    - `aria-live="polite"` region announces "Catálogo reordenado por {label}" via i18n key `catalog.sort.announce` whenever the sort changes.
    - When `useSubscription().readOnly === true`, the "Adicionar planta" button is NOT in the DOM (D-21 — hidden, not disabled).
    - Layout: on viewports ≤599px, label row above sort row (stacked); ≥600px, label + count + sort inline.
  </behavior>
  <action>
    Create `catalog-header.tsx`:
    ```typescript
    "use client";
    import { useTranslations } from 'next-intl';
    import Link from 'next/link';
    import { Select } from '@shared/ui/select';
    import { useSubscription } from '@contexts/billing/application/use-subscription';
    import { useSortPreference, SORT_IDS, type SortId } from './use-sort-preference';

    export interface CatalogHeaderProps { totalCount: number; }

    export function CatalogHeader({ totalCount }: CatalogHeaderProps) {
      const t = useTranslations('catalog');
      const { readOnly } = useSubscription();
      const [sort, setSort] = useSortPreference();

      const sortOptions = SORT_IDS.map((id) => ({
        value: id,
        label: t(`sort.options.${id === 'date_new' ? 'dateNew' : id === 'date_old' ? 'dateOld' : id === 'name_asc' ? 'nameAsc' : id === 'name_desc' ? 'nameDesc' : 'location'}`),
      }));

      const announceLabel = sortOptions.find(o => o.value === sort)?.label ?? '';

      return (
        <header className="flex flex-col [@media(min-width:600px)]:flex-row [@media(min-width:600px)]:items-end gap-3 px-5 [@media(min-width:900px)]:px-8 mb-4">
          <div className="flex items-baseline gap-2 flex-1">
            <h1 className="font-jakarta text-sm/[18px] font-semibold tracking-[0.04em] uppercase text-forest dark:text-moonpaper">{t('header.label')}</h1>
            <span className="font-jakarta text-sm/[18px] font-normal text-slate dark:text-lantern-slate">{t('header.countPlural', { n: totalCount })}</span>
          </div>
          <div className="flex items-center gap-3">
            <Select
              label={t('sort.label')}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
              options={sortOptions}
            />
            {!readOnly && (
              <Link href="/catalog/add" className="inline-flex items-center justify-center rounded-lg bg-canopy px-4 py-3 text-sm font-semibold text-ivory min-h-[48px]">
                {t('header.addPlant')}
              </Link>
            )}
          </div>
          <div role="status" aria-live="polite" className="sr-only" data-testid="catalog-sort-announce">
            {t('sort.announce', { label: announceLabel })}
          </div>
        </header>
      );
    }
    ```
    Notes:
    - The `id`-to-camelCase mapping for sort labels keeps i18n keys aligned with UI-SPEC §3 table (`dateNew`, `dateOld`, `nameAsc`, `nameDesc`, `location`).
    - The `data-testid` hooks anchor the Playwright spec in Task 5.
    - Add Plant button styling matches Phase 3 Canopy primary button geometry — refine class string to match existing primary-button utilities if the repo has them (Claude's discretion).
  </action>
  <verify>
    <automated>pnpm typecheck && pnpm lint src/app/(app)/catalog/_components/catalog-header.tsx</automated>
  </verify>
  <done>
    File exists; `pnpm typecheck` passes; importing `useSubscription` + `useSortPreference` resolves; readOnly branch excludes the Add Plant link from rendered output (verified by Playwright spec in Task 5).
  </done>
</task>

<task type="auto">
  <name>Task 4: Server Component shell — fetchQuery + HydrationBoundary + branch</name>
  <files>src/app/(app)/catalog/page.tsx</files>
  <action>
    REPLACE the entire file (currently 14 lines, empty-only render). Implement RESEARCH Pattern 1 verbatim (per D-13):
    ```typescript
    import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
    import { plantsKeys } from '@contexts/catalog/queries';
    import { CatalogEmpty } from './_components/catalog-empty';
    import { CatalogHeader } from './_components/catalog-header';
    import { CatalogGrid } from './_components/catalog-grid';

    export default async function CatalogPage() {
      const queryClient = new QueryClient();
      const data = await queryClient.fetchQuery(
        plantsKeys.lists({ sort: 'date_new', include_count: true })
      );
      const totalCount = data.total_count ?? data.plants.length;

      return (
        <HydrationBoundary state={dehydrate(queryClient)}>
          {totalCount === 0 ? (
            <CatalogEmpty />
          ) : (
            <>
              <CatalogHeader totalCount={totalCount} />
              <CatalogGrid />
            </>
          )}
        </HydrationBoundary>
      );
    }
    ```

    KEY RULES (do not deviate):
    1. Use `fetchQuery` (returns data) — NOT `prefetchQuery` (returns void). The SSR result drives the empty/filled branch.
    2. The Server Component DOES NOT pass plant data as props to `<CatalogGrid>` — `<CatalogGrid>` consumes the same query via `useQuery` after hydration. This is the canonical TanStack v5 RSC pattern; fighting it means re-fetching on the client.
    3. Default sort at SSR is ALWAYS `'date_new'` per CAT-07 + D-11. The user's session-stored preference is read by `useSortPreference()` on the client; if it differs from `'date_new'`, TanStack will re-fetch with the user's sort on first paint. This is intentional (matches D-13: SSR eliminates skeleton flash on the FIRST-PLANT EMPTY transition; subsequent sort changes are client-state).
    4. T-05-15-01 mitigation: `fetchQuery` runs on the server; the underlying GET `/api/v1/plants` (05-08) MUST gate via `requireVerifiedUser` — that mitigation lives in 05-08. This plan ASSUMES it; if the integration test for cross-user GET fails when 05-08 ships, surface as a 05-08 gap.
    5. T-05-15-02 mitigation: server enum whitelist is owned by 05-08's GET handler. This plan defensively re-validates on the CLIENT (Task 1's `useSortPreference` whitelist guard) so a tampered sessionStorage value never reaches the network. The defense-in-depth chain is: client whitelist (Task 1) → server whitelist (05-08).

    NO i18n changes (messages/pt-BR.json is owned by 05-10).
  </action>
  <verify>
    <automated>pnpm typecheck && pnpm lint src/app/(app)/catalog/page.tsx && pnpm next build --debug 2>&1 | grep -E "catalog|error" | head -20</automated>
  </verify>
  <done>
    `src/app/(app)/catalog/page.tsx` uses `fetchQuery` + `dehydrate` + `<HydrationBoundary>`; renders CatalogEmpty when `total_count === 0`; renders CatalogHeader + CatalogGrid otherwise; build passes; no client-only imports leak (HydrationBoundary import comes from `@tanstack/react-query` which supports RSC in v5).
  </done>
</task>

<task type="auto">
  <name>Task 5: Playwright + Axe gates — responsive grid + sort persistence + a11y</name>
  <files>
    tests/e2e/catalog-grid-sort.spec.ts,
    tests/e2e/axe-placeholder-pages.spec.ts
  </files>
  <action>
    PART A — Create NEW spec `tests/e2e/catalog-grid-sort.spec.ts`:
    Use the `authedUser` fixture (05-01). Seed 3 plants via `POST /api/v1/plants` (multipart) using the authed session BEFORE the visual assertions; teardown lets fixture's transaction rollback handle DB cleanup (Phase 2 D-43; otherwise issue DELETE for each id created).

    Test 1 — responsive viewport columns (3 sub-tests):
    ```typescript
    for (const { width, expectedCols } of [
      { width: 375, expectedCols: 2 },
      { width: 600, expectedCols: 3 },
      { width: 900, expectedCols: 4 },
    ]) {
      test(`grid renders ${expectedCols} columns at ${width}px`, async ({ page, authedUser }) => {
        await page.setViewportSize({ width, height: 800 });
        // seed 3 plants here (or use a fixture-level seedPlants helper)
        await page.goto('/catalog');
        await page.waitForSelector('[data-testid="catalog-grid"]');
        const grid = page.locator('[data-testid="catalog-grid"]');
        // Computed grid-template-columns count is the source of truth — measuring
        // child positions can be flaky with 0-result cards.
        const cols = await grid.evaluate((el) => {
          return getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
        });
        expect(cols).toBe(expectedCols);
      });
    }
    ```

    Test 2 — sort persists across navigation in the same tab:
    ```typescript
    test('sort persists across navigation within session', async ({ page, authedUser }) => {
      await page.goto('/catalog');
      await page.waitForSelector('[data-testid="catalog-grid"]');
      // Default state — Select shows the date_new option.
      const select = page.getByLabel(/Ordenar por/i);
      await expect(select).toHaveValue('date_new');
      // Change to name_asc.
      await select.selectOption('name_asc');
      // sessionStorage write is synchronous in our hook.
      const stored1 = await page.evaluate(() => sessionStorage.getItem('folhario.catalog.sort'));
      expect(stored1).toBe('name_asc');
      // Navigate away and back.
      await page.goto('/profile');
      await page.goto('/catalog');
      await page.waitForSelector('[data-testid="catalog-grid"]');
      await expect(select).toHaveValue('name_asc');
      // Verify aria-live announce region rendered the announcement at least once.
      await expect(page.getByTestId('catalog-sort-announce')).toContainText(/Catálogo reordenado por/);
    });
    ```

    Test 3 — readOnly hides Add Plant button (uses 05-01's read-only fixture):
    ```typescript
    import { test as readOnlyTest, expect } from './fixtures/read-only';
    readOnlyTest('readOnly hides Adicionar planta button', async ({ page }) => {
      await page.goto('/catalog');
      await page.waitForSelector('[data-testid="catalog-grid"], [data-testid="catalog-empty"]');
      await expect(page.getByRole('link', { name: /Adicionar planta/i })).toHaveCount(0);
    });
    ```

    PART B — EXTEND `tests/e2e/axe-placeholder-pages.spec.ts`:
    The ROUTES array already contains `/catalog`. The current test scans the empty-placeholder render. After this plan, `/catalog` can be either empty OR filled. Add a SECOND axe test specifically for the filled state using the authedUser fixture:
    ```typescript
    // Append AFTER the existing ROUTES loop (do NOT remove or rewrite the existing
    // unauthenticated empty-state scans — they cover the zero-plants case).
    import { test as authedTest } from './fixtures/authed-user';
    for (const combo of COMBOS) {
      authedTest(`axe /catalog [filled, ${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical violations`, async ({ page, authedUser }) => {
        // seed ≥1 plant via the API using authed session
        // (helper: createPlantViaApi(page.request, { name: 'Costela-de-adão' }))
        await page.emulateMedia({ colorScheme: combo.colorScheme, reducedMotion: combo.reducedMotion });
        await page.goto('/catalog');
        await page.waitForSelector('[data-testid="catalog-grid"]');
        const results = await new AxeBuilder({ page }).analyze();
        const blocking = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
        expect(blocking, `serious + critical: ${blocking.map(v => v.id).join(', ')}`).toEqual([]);
      });
    }
    ```

    Helper `createPlantViaApi(request, { name })` — define inline at the top of the appended block; reuse the multipart POST contract from 05-08. If 05-17 ships an existing helper at `tests/e2e/helpers/seed-plant.ts`, import that instead (Claude's discretion).

    KEY RULE: Do NOT modify the existing OfflineBanner test loop (lines 58–79) — that's owned by Phase 3 / Plan 04 and remains untouched.
  </action>
  <verify>
    <automated>pnpm test:e2e -- --project=chromium tests/e2e/catalog-grid-sort.spec.ts tests/e2e/axe-placeholder-pages.spec.ts</automated>
  </verify>
  <done>
    Both specs green; column-count assertion passes at 375/600/900; sort persists across in-app navigation; readOnly fixture hides Add Plant button; filled-state /catalog axe scan returns 0 serious/critical violations across all 4 colorScheme × reducedMotion combos.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Next.js Server Component | `CatalogPage` runs `fetchQuery` server-side; cookie session is the only auth signal |
| Browser sessionStorage → Client component | User-tampered sessionStorage value can flow into network query params |
| Browser → API GET `/api/v1/plants` | Authenticated request; sort param attacker-controlled |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-15-01 | I (Information disclosure) | `src/app/(app)/catalog/page.tsx` Server Component `fetchQuery` | mitigate | The server fetch goes through GET `/api/v1/plants` (05-08), which is gated by `requireVerifiedUser` and applies the `WHERE user_id = $1` ownership filter at the repository layer (Phase 2 D-20 / D-22 RLS defense in depth). This plan does NOT bypass that path — it consumes it. Cross-user leakage assertion lives in 05-08's integration test (`Plant create/list integration` — VALIDATION.md "RLS owner-only" stratum); if that test fails, this plan's SSR is unsafe. Block-on: high. |
| T-05-15-02 | T (Tampering) | `useSortPreference` → query params → 05-08 GET handler | mitigate | Defense in depth: (1) Client-side `SORT_IDS` whitelist guard in `useSortPreference` (Task 1) rejects any non-whitelisted value at hook init AND clears the bad sessionStorage entry — prevents tampered values from ever reaching `fetch()`. (2) Server-side: 05-08's GET `/api/v1/plants` MUST validate `?sort=` against the same enum and fall back to `'date_new'` on invalid. If 05-08's test for invalid-sort-param falls through to a SQL injection-shaped error, surface as a 05-08 gap (block-on this plan's E2E). The Vitest test "Test 3 (invalid value rejected)" in Task 1 verifies the client-side half. Block-on: high. |
</threat_model>

<verification>
Run after all tasks complete (in order):

1. `pnpm typecheck` — every file under `src/app/(app)/catalog/` type-checks.
2. `pnpm lint src/app/(app)/catalog/` — no warnings.
3. `pnpm vitest run src/app/(app)/catalog/_components/use-sort-preference.unit.test.ts` — 5/5 green (whitelist + round-trip + default + SSR-safe).
4. `pnpm next build` — Server Component compiles; HydrationBoundary import is RSC-safe; no "use client" leakage from `page.tsx`.
5. `pnpm test:e2e -- --project=chromium tests/e2e/catalog-grid-sort.spec.ts` — column counts pass at 375/600/900; sort persistence test green; read-only Add Plant hidden test green.
6. `pnpm test:e2e -- --project=chromium tests/e2e/axe-placeholder-pages.spec.ts` — empty-state scans + new filled-state scans (4 combos) all 0 serious/critical violations.

Blocking dependencies (must already exist when this plan executes):
- 05-08: GET /api/v1/plants returns `{ plants, next_cursor, total_count? }` and gates `?sort=` with enum whitelist.
- 05-10: `@contexts/catalog/queries` exports `plantsKeys`; `<QueryProvider>` is mounted in `(app)/layout.tsx`; `messages/pt-BR.json` `catalog.*` namespace populated per UI-SPEC §Copywriting Contract.
- 05-11: `useSubscription()` returns `{ active, readOnly }` and respects `SUBSCRIPTION_READ_ONLY=1`.
</verification>

<success_criteria>
- [ ] /catalog with 0 plants (authed user) renders the UI-SPEC §4 empty state — Sage line-art + headline + hint + ONE Canopy CTA → /identify (CAT-11)
- [ ] /catalog with ≥1 plant renders header + grid with no skeleton flash on first paint (D-13)
- [ ] Grid column count is exactly 2 / 3 / 4 at viewport widths 375 / 600 / 900 (CAT-10 / UI-07)
- [ ] PlantCard matches UI-SPEC §1 geometry — 16px radius, 4:5 photo, 16px inner padding, name + nickname + location stack (UI-07)
- [ ] Sort `<Select>` exposes 5 options (date_new default); change persists in sessionStorage `folhario.catalog.sort`; survives in-app navigation; clears on tab close (CAT-07 / CAT-08 / D-11)
- [ ] Server Component uses `fetchQuery` (not `prefetchQuery`) so the empty/filled branch is driven by SSR-fetched `total_count` (D-13 / RESEARCH Pattern 1)
- [ ] readOnly mode hides "Adicionar planta" link in CatalogHeader (D-21)
- [ ] Vitest unit-dom suite for `useSortPreference` covers default, round-trip, invalid-value rejection, SSR-safety
- [ ] Playwright `catalog-grid-sort.spec.ts` is green
- [ ] Axe extension on `/catalog` filled state is 0 serious/critical violations across all 4 colorScheme × reducedMotion combos
- [ ] T-05-15-02 mitigation present: client-side enum whitelist guard in `useSortPreference`
- [ ] No edits to `messages/pt-BR.json` (owned by 05-10)
- [ ] No edits to `/identify/page.tsx` (owned by 05-18) — only an `href="/identify"` reference
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-15-catalog-page-grid-sort-SUMMARY.md` summarizing:
- Components created and their files_modified manifest
- useSortPreference hook contract (exports + sessionStorage key + whitelist)
- T-05-15-01 / T-05-15-02 mitigation status (which test asserts each)
- Verification results (typecheck, lint, vitest, e2e, axe)
- Carryovers / surfaced gaps in 05-08 / 05-10 / 05-11 (if any test failed against expected upstream contracts)
- Patterns established for downstream plans (05-16 Plant Profile reuses PlantCard geometry; 05-17 manual-add reuses card; 05-18 wires read-only / offline banners across these surfaces)
</output>
