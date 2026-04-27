# Phase 5: Catalog (Meu Jardim) — Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** ~30 new/modified files (grouped into 14 pattern buckets)
**Analogs found:** 9 on-disk anchors / 9 expected-from-prior-phase contracts / 6 RESEARCH-only specs

**Critical sequencing context:** Phase 5 is being PLANNED ahead of execution. Per `.planning/STATE.md`, the worktree is on Phase 2 (planned, not executed). Phase 2 / 3 / 4 deliverables (schemas, repositories, photo upload route, design tokens, Inngest infrastructure) DO NOT yet exist on disk. Where this map cites "expected from Phase X", the executor must verify the contract has landed before consuming it. The Phase 2 PATTERNS.md (`.planning/phases/02-data-layer/02-PATTERNS.md`) defines repo + route conventions Phase 5 inherits; reference it rather than restate.

---

## File Classification

Files are grouped by role + data flow because Phase 5 ships many near-identical files (8 catalog API hooks, 9 catalog use-cases, 10 mutating route handlers). Per Phase 2's precedent, plans target a bucket once and apply it across the bucket.

| New/Modified File or Bucket | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/contexts/catalog/infrastructure/db/schema.ts` (extend Phase 2) | model | DB schema (Drizzle) | **Expected** from Phase 2 D-01 (`src/contexts/iam/infrastructure/db/schema.ts` per Plan 02-05) | role-match |
| `src/contexts/catalog/infrastructure/db/{plants,photo-entries,pending-storage-deletions,location-suggestions}.ts` | repository | CRUD + DB transaction | **Expected** from Phase 2 D-16 functional repo (Plan 02-05 ships `plants.ts`); proxy: `src/app/api/v1/diagnostics/ping/route.ts` for layered I/O style | role-match (expected) |
| `src/contexts/catalog/domain/{plant,photo-entry,pending-storage-deletion,events}.ts` | model + Zod schemas | shared types | **Expected** from Phase 2 D-19 drizzle-zod pattern (RESEARCH Pattern 10) | RESEARCH-only |
| `src/contexts/catalog/application/*.ts` (10 use-cases) | service / use-case | DB transaction + event emit | RESEARCH Pattern 5 (delete-plant); no on-disk analog yet | RESEARCH-only |
| `src/app/api/v1/plants/**/route.ts` (10 mutating + read endpoints) | route handler | request-response | `src/app/api/v1/diagnostics/ping/route.ts:1-37` | partial — gate replaced by auth + idempotent + Zod |
| `src/contexts/catalog/api/use-*.ts` (10 client hooks) | hook (client) | request-response (TQ) | RESEARCH Patterns 1, 3, 4 | RESEARCH-only |
| `src/contexts/billing/api/use-subscription.ts` (D-24 stub) | hook (client) | local state | `src/app/posthog-provider.tsx:1-12` (client-only module style) | role-match |
| `src/shared/react-query/{query-client,persist-client-provider,idb-persister}.ts` | shared infra (provider) | TQ + IDB | RESEARCH Pattern 2; provider style: `src/app/posthog-provider.tsx:1-12` | partial |
| `src/shared/ui/{bottom-sheet,combobox,lightbox,inline-edit-field}.tsx` | component (client) | UI primitive | RESEARCH Patterns 6, 7, 8, 9; **no on-disk analog**, depends on Phase 3 design tokens | RESEARCH-only |
| `src/app/catalog/{page,new/page,[plantId]/page,[plantId]/photos/page}.tsx` | page (RSC + client island) | render + hydrate | `src/app/page.tsx:1-7` (skeleton) + `src/app/layout.tsx:1-27` (RSC + provider wrap); RESEARCH Pattern 1 for the prefetch idiom | partial |
| `src/app/identify/page.tsx` (D-25 placeholder) | page (RSC) | static render | `src/app/page.tsx:1-7` | exact role |
| `src/app/(home)/page.tsx` (Home empty/default) | page (RSC + client island) | render | `src/app/page.tsx:1-7` | exact role |
| `src/contexts/catalog/inngest/{cleanup-storage,reconcile-deletions}.ts` | Inngest function | event-driven | **Expected** from Phase 4 (no on-disk analog); RESEARCH Pattern 5 | role-match (expected) |
| `src/app/sw.ts` (extend) — Serwist runtime cache for catalog images | service worker | file-I/O | `src/app/sw.ts:1-17` | exact role (extension) |
| `tests/unit/contexts/catalog/*.test.ts` (use-case unit tests) | unit test | mock-and-verify | `tests/unit/errors.test.ts:1-83` | exact role |
| `tests/integration/catalog/*.integration.test.ts` (DB roundtrip + cascade + idempotency) | integration test | DB roundtrip | `tests/integration/postgres-connection.integration.test.ts:1-34` + `tests/integration/diagnostics-server-probe.integration.test.ts:1-74` | exact role |
| `tests/e2e/catalog/*.spec.ts` (Playwright E2E with axe-core) | E2E test | browser + API | `tests/e2e/diagnostics-posthog.spec.ts:1-36` + `tests/e2e/security-headers.spec.ts:1-21` | exact role |
| `src/messages/pt-BR.json` (extend) — catalog copy | i18n message file | locale data | `src/messages/pt-BR.json` (currently `{}`) | exact role (extension) |

---

## Pattern Assignments

### Route handlers under `src/app/api/v1/plants/**/route.ts` (route handler, request-response)

**Analog:** `src/app/api/v1/diagnostics/ping/route.ts` (lines 1-37)

**Imports + closed error registry pattern** (lines 1-9):
```ts
import { NextResponse } from "next/server";
import { errorResponse, ErrorCode } from "@shared/config/errors";

if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") {
  return errorResponse(ErrorCode.NotFound, "not found");
}
```
Phase 5 replaces the mode gate with: (1) `requireUser(req)` (Phase 2 auth helper, expected), (2) `idempotent(req, async () => ...)` wrapper for mutating endpoints (Phase 2 D-37/D-38), (3) Zod `safeParse` against the domain schema (RESEARCH Pattern 10), (4) call into `application/*.ts` use-case, (5) `httpMapError(...)` mapping thrown domain errors to closed-registry codes.

**Mandatory `validation_failed` shape:** Use `errorResponse(ErrorCode.ValidationFailed, "...", { issues: parsed.error.issues })` so the body matches the closed registry: `{ error: { code, message, details? } }` per `src/shared/config/errors.ts:56-62`.

**Allowed error codes for Phase 5 routes** (per CONTEXT `<code_context>` § Established Patterns):
`validation_failed | not_found | unauthenticated | token_expired | forbidden | read_only_mode` (post-Phase-10) | `conflict` (idempotency replay collisions). NO new codes.

**Reference for full route layering rule:** Phase 2 PATTERNS.md § "Route Handlers under `src/app/api/v1/**/route.ts`" + Phase 2 D-17 ESLint guard "no Drizzle in route handlers".

---

### Repositories under `src/contexts/catalog/infrastructure/db/*.ts` (repository, CRUD)

**Analog (expected):** `src/contexts/iam/infrastructure/db/users.ts` (shipped by Phase 2 Plan 02-05). On-disk proxy: none yet — `src/contexts/catalog/infrastructure/.gitkeep` only.

**Contract (per Phase 2 D-16):** Functional modules, NOT classes. Each repo accepts a `db` (or `tx`) parameter as the first argument; never imports a global client. Phase 2 Plan 02-05 line 102 confirms the shape:
```ts
// Pattern shipped by Phase 2 (verify on disk before Phase 5 wave 1):
// plants.findByIdForUser(db, userId, plantId)
```

**Phase 5 additions to the catalog repo set:**
- `plants.ts` — `findByIdAndUser`, `findByCursor(db, { userId, sort, cursor, limit })`, `create(tx, plant)`, `updatePartial(tx, { id, userId, patch })`, `deleteByIdAndUser(tx, { id, userId })`, `setCoverPhoto(tx, { id, userId, photoUrl })`.
- `photo-entries.ts` — `findByPlant(db, { plantId, userId, cursor, limit })`, `listStoragePathsForPlant(tx, { plantId, userId })`, `create(tx, entry)`, `updateNote(tx, { id, plantId, userId, note })`, `deleteByIdAndPlant(tx, { id, plantId, userId })`.
- `pending-storage-deletions.ts` — `insert(tx, job)`, `findById(db, id)`, `findOlderThan(db, threshold)`, `markComplete(db, id)`. **Phase 5 owns the table** (see "Phase 5 owns" note below).
- `location-suggestions.ts` — `distinctByUser(db, userId)` returning `string[]` for combobox prior values. Lower-case dedupe per CONTEXT D-01.

**Phase 5 owns** the `pending_storage_deletions` schema migration (CONTEXT D-04 fallback path: "If Phase 4 does not provide a generic event outbox/dispatcher, Phase 5 owns a small catalog-local pending storage-deletion table"). Add to `src/contexts/catalog/infrastructure/db/schema.ts` per Phase 2 D-01 per-context schema ownership.

**Test sequencing dependency:** Repository integration tests CANNOT run until Phase 2 ships migration tooling (Plan 02-01) AND Phase 2 ships the catalog `schema.ts` (Plan 02-05). Block Phase 5 wave 1 on these.

---

### Domain Zod schemas under `src/contexts/catalog/domain/*.ts` (model)

**Analog:** RESEARCH Pattern 10 (no on-disk analog; Phase 2 ships the convention via D-19).

**drizzle-zod derivation contract** (RESEARCH lines 1042-1080):
```ts
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { plants } from "@contexts/catalog/infrastructure/db/schema";
import { z } from "zod";

export const PlantSchema = createSelectSchema(plants);
export type Plant = z.infer<typeof PlantSchema>;

export const PlantCreateInputSchema = createInsertSchema(plants, {
  name: (s) => s.min(1, { message: "name_required" }).max(80),
}).extend({
  initial_photos: z.array(z.object({ photo_url: z.string().min(1), thumbnail_url: z.string().min(1) })).min(1, { message: "photo_required" }),
}).omit({ cover_photo_url: true, created_at: true });
```

**Storage-path ownership check:** Domain schema validates SHAPE; the use-case (`createPlantManual`) MUST additionally verify each `photo_url` / `thumbnail_url` prefix matches `{authenticated_user_id}/{submitted_plant_id}/` per RESEARCH Pitfall 1. Phase 2 D-26 storage layout is `{user_id}/{aggregate_id}/{file_id}.{ext}` — single string-prefix compare.

---

### Use-cases under `src/contexts/catalog/application/*.ts` (service, transaction-orchestration)

**Analog:** RESEARCH Pattern 5 (delete-plant.ts, lines 666-714). No on-disk analog yet.

**Mandatory contract per Phase 2 D-18 Unit-of-Work:**
- Use-cases accept a `UnitOfWork` (or repos) parameter; do NOT import the DB client directly.
- Multi-step writes wrap the repo calls in `uow.transaction(async (tx) => ...)` so cascade + outbox land in one transaction.
- Domain errors (e.g., `notFoundError()`, `forbiddenError()`) are thrown; the route handler maps them to `errorResponse(...)`.

**Server-side analytics emission** — `plant_added` event fires from the use-case, NOT the route handler (CONTEXT `<specifics>` line 1). Pattern shaped after `src/app/api/v1/diagnostics/ping/route.ts:13-19`:
```ts
const ph = getPostHog();
if (ph) {
  ph.capture({
    distinctId: userId,
    event: "plant_added",
    properties: { source: "manual" | "from_identification", has_species: boolean },
  });
}
```
Use `getPostHog()` from `src/shared/telemetry/posthog-server.ts:1-23`. RESEARCH Open Question 6 specifies the payload shape `{ source, has_species }`.

**Sentry user scoping** — `Sentry.setUser({ id })` only, never email (CONTEXT § Established Patterns; PRD §17 Privacy). Already enforced by `src/shared/telemetry/sentry-scrub.ts` (Phase 1 Plan 05a).

---

### Client hooks under `src/contexts/catalog/api/use-*.ts` (hook, client)

**Analog:** RESEARCH Patterns 1 (RSC prefetch), 3 (optimistic), 4 (pessimistic). No on-disk hook analog (Phase 1 ships only providers).

**File header convention** — every file starts with `"use client"` (matches `src/app/posthog-provider.tsx:1` and `src/app/diag/page.tsx:1`).

**Pessimistic mutation skeleton** (RESEARCH lines 622-655):
```tsx
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeletePlant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/plants/${id}`, {
        method: "DELETE",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      if (!res.ok) throw new Error(`delete_failed_${res.status}`);
    },
    onSuccess: (_data, id) => { /* setQueriesData removal */ },
  });
}
```

**Optimistic mutation rule** — D-07 hybrid: optimistic for inline edits + sort; **pessimistic for create + delete + photo entry add/delete**. RESEARCH Pattern 3 vs Pattern 4 covers both shapes.

**`Idempotency-Key` is mandatory** on every mutation (CONTEXT D-23B). Use `crypto.randomUUID()` per RESEARCH "Don't Hand-Roll" table.

---

### `src/contexts/billing/api/use-subscription.ts` (hook, client — D-24 stub)

**Analog:** `src/app/posthog-provider.tsx:1-12` (client-only single-export module style).

**Stub contract** (CONTEXT D-24):
```tsx
"use client";

export function useSubscription(): { status: "trialing" } {
  return { status: "trialing" };
}
```

Phase 10 swaps the implementation. Tests must verify hide-when-not-trialing-or-active behavior via test-double (e.g. `vi.mock("@contexts/billing/api/use-subscription", () => ({ useSubscription: () => ({ status: "expired" }) }))`).

**Convention deviation note:** `api/` per Phase 1 D-08 is conventionally route handlers. CONTEXT D-24 explicitly locks the path; treat as a documented deviation. RESEARCH Open Question 3 surfaces the broader convention question for the planner.

---

### TanStack Query providers under `src/shared/react-query/`

**Analog:** `src/app/posthog-provider.tsx:1-12` (client provider wrapping pattern); RESEARCH Pattern 2 for the persister setup.

**Where to wire it** — same pattern as `src/app/layout.tsx:21-23`:
```tsx
<NextIntlClientProvider locale={locale} messages={messages}>
  <PostHogProvider>
    <ReactQueryProvider>{children}</ReactQueryProvider>  {/* Phase 5 adds */}
  </PostHogProvider>
</NextIntlClientProvider>
```
Layout wrap order: i18n outermost (server), PostHog (client), ReactQuery (client). Phase 5 inserts ReactQueryProvider INSIDE PostHogProvider so analytics fires for all queries.

**Persister buster** (RESEARCH Pattern 2): use `buster: "folhario-catalog-v1"` and bump on schema-shape changes. RESEARCH Pitfall 2 covers the hydration race — `PersistQueryClientProvider` ships `useIsRestoring`, which only works if the catalog tree lives INSIDE the provider.

---

### UI primitives under `src/shared/ui/*.tsx` (component, client)

**Analog:** None on-disk — Phase 3 owns most `src/shared/ui/`. Phase 5 OWNS:
- `bottom-sheet.tsx` — RESEARCH Pattern 7 (hand-rolled, Vaul fallback documented).
- `combobox.tsx` — RESEARCH Pattern 6 (WAI-ARIA APG 1.2 list-autocomplete).
- `lightbox.tsx` — RESEARCH Pattern 8 (focus-trap + IntersectionObserver swipe).
- `inline-edit-field.tsx` — RESEARCH Pattern 9 (click-to-edit + save-on-blur).

**Hand-roll constraint** (UI-SPEC § Registry Safety): No third-party shadcn registry blocks; no `react-image-lightbox`; no `react-aria-components`. `focus-trap` 7.1.3 is the only allowed primitive dep. Vaul 1.1.2 is the documented fallback for bottom-sheet only if Wave 0 a11y verification fails axe-core/VoiceOver.

**a11y verification gate** (RESEARCH Pattern 7 checklist): each UI primitive must pass the 8-item axe + manual list before the planner declares it shippable. The Lightbox + BottomSheet share the dialog ARIA contract.

**Design token dependency:** Phase 3 owns `--scrim`, `--surface`, `--hairline`, `--canopy`, `--calm-slate`, `--overdue` CSS custom properties. Phase 5 cannot hand-roll the components without them. Block on Phase 3 landing.

---

### App pages under `src/app/catalog/**/page.tsx` and `src/app/(home)/page.tsx` (page, RSC + client island)

**Analog:** `src/app/page.tsx:1-7` (currently a 7-line skeleton) + `src/app/layout.tsx:1-27` (RSC layout + locale).

**RSC + Hydration pattern** (RESEARCH Pattern 1, lines 446-466):
```tsx
// src/app/catalog/page.tsx (RSC, no "use client")
export default async function CatalogPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: ["plants", { sort: "acquired_desc" }],
    queryFn: async ({ pageParam }) => listPlants({ cursor: pageParam, limit: 50, sort: "acquired_desc" }),
    initialPageParam: null,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CatalogGridClient />
    </HydrationBoundary>
  );
}
```

**Locale + i18n** — pages use `getLocale()` / `useTranslations()` per `src/app/layout.tsx:11-13` pattern. ALL strings via `next-intl` per CONTEXT § Established Patterns. NO hardcoded copy.

**Date rendering** — server-side via `date-fns-tz` with `User.timezone` per CONTEXT § Established Patterns. RESEARCH Pitfall 9 covers the hydration mismatch trap; render the same string on server and client by passing the formatted string as a prop, never re-format on client.

---

### Inngest functions under `src/contexts/catalog/inngest/*.ts` (Inngest function, event-driven)

**Analog (expected):** Phase 4's first Inngest consumer (`iam/send-verification-email`). No on-disk analog yet. RESEARCH Pattern 5 (lines 716-754) is the shape Phase 5 follows.

**Contract (per CONTEXT D-04 + RESEARCH Pattern 5):**
```ts
export const cleanupStorage = inngest.createFunction(
  {
    id: "catalog/cleanup-storage",
    triggers: [{ event: "plant.deleted" }],
    concurrency: { limit: 5, key: "event.data.user_id" },
    retries: 5,
  },
  async ({ event, step }) => { /* load-job → delete-storage → mark-complete */ },
);
```

**Event payload shape** (CONTEXT § Specifics): `name: "plant.deleted"`, data: `{ user_id, plant_id, storage_deletion_job_id, storage_paths[] }`.

**Sequencing dependency:** Phase 4 ships the `inngest` client export at `@shared/events/inngest-client` (RESEARCH Assumption A1). Phase 5 cannot wire the function until the client + `serve()` route handler exist.

**Phase 5 also ships** `reconcile-deletions.ts` cron (every 5 min) per RESEARCH Pattern 5 closing paragraph + Open Question 2 — reads `pending_storage_deletions` rows older than threshold and re-emits `plant.deleted` for each. Belt-and-braces against post-commit dispatch failure.

---

### Service worker extension `src/app/sw.ts` (service worker, file-I/O cache)

**Analog:** `src/app/sw.ts:1-17` (current Phase 1 skeleton — precache only).

**Phase 5 extension** (RESEARCH § Code Examples, lines 1322-1352):
```ts
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [  // Phase 5 ADDS
    {
      matcher: ({ request, url }) =>
        request.destination === "image" && url.hostname.endsWith(".supabase.co"),
      handler: new StaleWhileRevalidate({
        cacheName: "folhario-catalog-images",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },
  ],
});
```

**HARD CONSTRAINT** (RESEARCH Pitfall 3 + Anti-Patterns): NO `runtimeCaching` rule for `/api/v1/*` paths. TanStack Query persister owns JSON in IDB; Serwist owns images in Cache Storage. Double-caching produces stale-after-online-update bugs.

**Host-pattern verification** (RESEARCH Assumption A4): confirm `*.supabase.co` is the actual signed-URL host before shipping. Self-hosted or CDN-proxy setups would shift the matcher.

---

### Unit tests under `tests/unit/contexts/catalog/*.test.ts`

**Analog:** `tests/unit/errors.test.ts:1-83` (closed-registry + parametric `it.each` style).

**Vitest convention** (lines 1-3 of every test file):
```ts
import { describe, it, expect } from "vitest";
import { ... } from "@shared/config/errors";  // path-alias usage
```

**Mocking pattern for use-case unit tests** — see `tests/integration/diagnostics-server-probe.integration.test.ts:11-33`:
```ts
vi.mock("posthog-node", () => ({
  PostHog: function MockPostHog() {
    return { capture: captureMock, shutdown: shutdownMock };
  },
}));
```
Phase 5 mocks the repository layer + `inngest.send()` for use-case unit tests; integration tests use real Postgres.

**Test environment env-vars** — set at top-of-file per `tests/integration/diagnostics-server-probe.integration.test.ts:3-9` pattern (use `??=` so existing values are not overwritten).

---

### Integration tests under `tests/integration/catalog/*.integration.test.ts`

**Analog:** `tests/integration/postgres-connection.integration.test.ts:1-34` + `tests/integration/diagnostics-server-probe.integration.test.ts:1-74`.

**Cloud-DB guard pattern** (lines 4-11 — MANDATORY for any DB-touching test):
```ts
const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase ...",
  );
}

describe.skipIf(!dbUrl)("...", () => { ... });
```
Phase 2 PATTERNS.md § "Integration Tests" says either preserve this guard or extract a shared helper. Phase 5 SHOULD extract a shared helper (`tests/helpers/db-guard.ts`) once it adds 5+ catalog integration tests — but defer to planner.

**Driver options** (lines 14-18) — every test creates its own `postgres()` client with `prepare: false, max: 1, idle_timeout: 5` and tears down via `afterAll(() => sql.end({ timeout: 5 }))`.

**Transaction-rollback test pattern** (Phase 2 D-43 contract; no on-disk example yet) — wrap each `it(...)` body in `await sql.begin(async (tx) => { ...; throw new Rollback(); })` so DB state stays clean across tests. Phase 5 adopts this for cascade verification (CAT-09) and idempotency replay tests (CAT-02 idempotency).

**Route-handler import convention** (lines 41-48 of server-probe test):
```ts
const mod = await import("../../src/app/api/v1/diagnostics/ping/route");
const res = await mod.POST(new Request("http://localhost:3000/api/v1/...", { method: "POST" }));
```
Use this for fast handler-integration tests where Playwright is too heavy.

---

### E2E tests under `tests/e2e/catalog/*.spec.ts`

**Analog:** `tests/e2e/diagnostics-posthog.spec.ts:1-36` (Playwright `page` + `request` fixtures) + `tests/e2e/security-headers.spec.ts:1-21` (request-only smoke).

**Network interception pattern** (lines 9-13 of posthog spec):
```ts
await page.route(/\.i\.posthog\.com\/(e|batch|capture)/, async (route) => {
  const raw = route.request().postData();
  if (raw) posthogEvents.push(raw);
  await route.fulfill({ status: 200, body: "1" });
});
```
Phase 5 uses the same pattern to intercept `/api/v1/photos/upload` for the manual-add E2E (mock the upload to return `photo_url` + `thumbnail_url` deterministically).

**Playwright `request` fixture for API smokes** — pattern from security-headers spec lines 6-19. Use this for the catalog API surface smoke (`GET /api/v1/plants`, `POST /api/v1/plants`, etc.) without spinning a browser.

**axe-core integration** (Wave 0 install per RESEARCH Standard Stack table):
```ts
import AxeBuilder from "@axe-core/playwright";
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```
Apply to every Phase 5 surface: catalog grid, plant profile, manual-add form, photo-journal lightbox, location combobox, delete confirm modal.

---

### i18n message file `src/messages/pt-BR.json` (extend)

**Analog:** `src/messages/pt-BR.json` (currently `{}` — empty object).

**Loader convention** — `src/i18n/request.ts:9` resolves `messages/${locale}.json` relative to `src/i18n/`:
```ts
messages: (await import(`../messages/${locale}.json`)).default,
```
Phase 5 populates this with the full Phase 5 copy block per UI-SPEC § Copywriting Contract. Suggested key shape: nest under `catalog.*` to avoid cross-phase collision.

**Hard rule** — NO hardcoded strings in any Phase 5 source file. Every `useTranslations("catalog")` consumer reads from this file.

---

## Shared Patterns

### Path aliases (Phase 1 D-07; inherited from Phase 2 PATTERNS.md)
- `@shared/*` → `src/shared/*`
- `@contexts/*` → `src/contexts/*`
- `@i18n/*` → `src/i18n/*`
- **NO `@/*` alias.** Use the named aliases.

### No barrel files (Phase 1 D-08)
Do NOT add `index.ts` files that re-export. Each consumer imports the exact module path. Verified by ESLint rule (Phase 2 D-17).

### Closed error registry (Phase 1 D-10/D-11/D-12)
**Source:** `src/shared/config/errors.ts:1-82`. Phase 5 emits ONLY: `validation_failed | not_found | unauthenticated | token_expired | forbidden | conflict | read_only_mode`. NO new codes. The `errorResponse(code, message, details?)` helper auto-redacts `cost_ceiling_reached` and `breaker_open` to `provider_unavailable` (lines 27-30, 69) — Phase 5 does not invoke the redacted codes.

### Server vs client env split (Phase 1 D-29)
**Source:** `src/shared/config/server-env.ts:1-19` + `src/shared/config/client-env.ts:1-21`. Server-only modules import `serverEnv`; client modules import `clientEnv`. NEVER cross. Pattern shapes apply to any new env vars Phase 5 needs (none expected — every Phase 5 env var should already exist from Phase 1/2/4).

### Singleton/factory pattern for shared infra (PostHog, eventually QueryClient)
**Source:** `src/shared/telemetry/posthog-server.ts:1-23` (lazy-init + `_client` private singleton + idempotent `shutdown()`).
Phase 5 query-client factory follows the same shape but uses `useState(() => new QueryClient(...))` per RESEARCH Pattern 2 — per-render (not per-module) to avoid cross-user SSR leaks.

### Client provider wrapping
**Source:** `src/app/posthog-provider.tsx:1-12` + `src/app/layout.tsx:21-23`. Pattern: tiny `"use client"` component that calls init in `useEffect([])` then renders `<>{children}</>`. Phase 5 ReactQueryProvider follows the same shape but wraps in `<PersistQueryClientProvider>` directly (no useEffect needed — TQ owns the lifecycle).

### Sentry user/scrub posture (LGPD-13)
**Source:** `src/shared/telemetry/sentry-scrub.ts` (Plan 05a) + `src/sentry.server.config.ts:7-16`. Phase 5 scopes errors with `Sentry.setUser({ id })` ONLY — never email, never PII. The scrub module already drops `request.cookies` and redacts `request.data` on identification routes; Phase 5 does not need to extend it.

---

## No Analog Found (planner uses RESEARCH.md patterns directly)

| File | Role | Data Flow | Why no analog | RESEARCH reference |
|---|---|---|---|---|
| `src/shared/react-query/idb-persister.ts` | persister | IDB sync | Phase 1 ships no IDB code | Pattern 2 (lines 502-518) |
| `src/shared/react-query/persist-client-provider.tsx` | TQ provider | TQ lifecycle | Phase 1 ships only PostHog provider; TQ's `PersistQueryClientProvider` wraps differently | Pattern 2 (lines 522-560) |
| `src/shared/ui/bottom-sheet.tsx` | dialog primitive | UI | UI-SPEC says hand-rolled; no Phase 3 chrome on disk yet | Pattern 7 (lines 795-862) |
| `src/shared/ui/combobox.tsx` | combobox | UI | Hand-rolled per WAI-ARIA APG 1.2; no precedent in codebase | Pattern 6 (lines 757-783) |
| `src/shared/ui/lightbox.tsx` | dialog primitive | UI | Hand-rolled per CONTEXT D-17 + UI-SPEC | Pattern 8 (lines 884-941) |
| `src/shared/ui/inline-edit-field.tsx` | inline editor | UI | New interaction pattern | Pattern 9 (lines 956-1033) |

For each: planner copies the RESEARCH skeleton verbatim into the plan's action section, then customizes per Phase 5 surface.

---

## Cross-Phase Sequencing Notes

The planner MUST verify these are on disk before writing a wave that touches them:

| Expected Asset | Source Contract | Currently On Disk? | Blocks Phase 5 Wave |
|---|---|---|---|
| `src/contexts/catalog/infrastructure/db/schema.ts` | Phase 2 D-01, Plan 02-05 | NO (`.gitkeep` only) | Wave 1 (repos) |
| `src/contexts/catalog/infrastructure/db/plants.ts` | Phase 2 D-16, Plan 02-05 line 12 | NO | Wave 1 (use-cases) |
| `src/shared/db/client.ts` | Phase 2 D-14/D-15 | NO | Wave 1 (any DB) |
| `src/shared/db/unit-of-work.ts` | Phase 2 D-18 | NO | Wave 1 (use-cases) |
| `src/app/api/v1/photos/upload/route.ts` | Phase 2 D-27 | NO | Wave 2 (manual add E2E) |
| `src/contexts/catalog/infrastructure/photo-storage.ts` | Phase 2 D-25 | NO | Wave 2 (storage cleanup) |
| `src/shared/api/idempotency.ts` (or similar) | Phase 2 D-37/D-38 | NO | Wave 2 (mutating routes) |
| `src/shared/api/cursor.ts` (or helper) | Phase 2 D-36 (+ Phase 5 extension per Open Q1) | NO | Wave 2 (list endpoint) |
| Phase 2 AuthAdapter / `requireUser(req)` helper | Phase 2 D-32-D-35 | NO | Wave 2 (mutating routes) |
| Phase 3 design tokens (CSS vars: `--scrim`, `--surface`, `--canopy`, `--calm-slate`, etc.) | Phase 3 (no plans yet) | NO | Wave 3 (UI primitives + pages) |
| Phase 3 bottom nav + app shell | Phase 3 | NO | Wave 3 (catalog/home pages) |
| Phase 4 `@shared/events/inngest-client` | Phase 4 (no plans yet) | NO | Wave 4 (cleanup-storage function) |

**RECOMMENDATION:** The planner SHOULD reference Phase 2 PATTERNS.md (`.planning/phases/02-data-layer/02-PATTERNS.md`) for the canonical repo + route conventions rather than restate them in Phase 5 plan actions. Phase 5 plans cite "see Phase 2 PATTERNS.md § ..." and add only Phase-5-specific deltas.

---

## Metadata

**Analog search scope:**
- `src/app/**` (all .ts/.tsx — 7 files)
- `src/shared/**` (all .ts — 6 files)
- `src/contexts/**` (only `.gitkeep` placeholders found)
- `tests/unit/**` + `tests/integration/**` + `tests/e2e/**` (15 test files)
- `.planning/phases/02-data-layer/` (PATTERNS.md, CONTEXT.md, plan files for repo/schema contracts)

**Files scanned:** ~30 source files, ~15 test files, 2 prior-phase pattern docs, 4 prior-phase plans.

**Pattern extraction date:** 2026-04-26
