# Phase 6: Identification Flow & Cost Controls — Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 40 (24 context files + 16 implied tests / fixtures / shared primitives / i18n)
**Analogs found:** 33 / 40 (7 partial-or-no-analog files documented separately)

> Concrete excerpts with `file_path:line_range` so the planner can copy patterns verbatim. Grouped by the 10 functional domains the orchestrator prompt requested.

> **Planner Decisions Required (load-bearing — surface in plan-level open-questions sections):**
> 1. **`hasActiveConsent` does NOT exist on `iam/infrastructure/db/consent-logs.ts`** — Phase 6 must add it (touches the IAM context, not just identification). See Domain 4 last entry.
> 2. **`iam/api/consent-route.ts` already has a `postHandler`** mounted at `/api/v1/diagnostics/consent`. Phase 6 mounts a second handler at `/api/v1/iam/consents`. Decide: re-export the existing handler, or duplicate with a narrowed purpose enum.
> 3. **`ModalSheet` does NOT expose `dismissOnScrim` / `dismissOnEsc` props** but UI-SPEC §Conflicts Resolved line 52 requires both off for the LGPD consent modal. Recommended (planner-confirm): use Radix Dialog directly for the LGPD modal AND the paywall, matching `_paywall-dialog.tsx`.
> 4. **Circuit-breaker half-open concurrency** (RESEARCH §Open Question 1) — recommended pattern: optimistic UPDATE `SET state='in_flight' WHERE state='half_open'`. Add `'in_flight'` to the state CHECK constraint OR (preferred) a separate `in_flight_at TIMESTAMPTZ` column to avoid migrating the enum.
> 5. **Vercel Pro tier required** for `maxDuration = 60` (RESEARCH §Pitfall 1). Add as a STATE.md prerequisite gate.


---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `drizzle/migrations/0008_phase06_identification.sql` | migration | schema | `drizzle/migrations/0004_add_pending_storage_deletions.sql` | role-match |
| `src/contexts/identification/infrastructure/db/schema.ts` (modify) | schema | schema | itself + `catalog/infrastructure/db/schema.ts` | exact |
| `src/contexts/identification/infrastructure/db/identifications.ts` | repository | CRUD + cursor | `iam/infrastructure/db/consent-logs.ts` + `catalog/infrastructure/db/plants.ts` | exact |
| `src/contexts/identification/infrastructure/db/identification-limits.ts` | repository | read-cached | `consent-logs.ts` (drop cursor; add TTL) | role-match |
| `src/contexts/identification/infrastructure/db/provider-budgets.ts` | repository | read + atomic update | `consent-logs.ts` (no cursor) | role-match |
| `src/contexts/identification/infrastructure/db/provider-usage-counters.ts` | repository | atomic upsert | `consent-logs.ts` (custom `INSERT … ON CONFLICT`) | role-match |
| `src/contexts/identification/infrastructure/db/circuit-breakers.ts` | repository | atomic state machine | none (closest: `provider-usage-counters` UPSERT pattern) | no-analog |
| `src/contexts/identification/domain/provider.ts` | domain (interface) | n/a | `identification/domain/events.ts` (typed-payload style) | role-match |
| `src/contexts/identification/domain/locks.ts` | domain (constants) | n/a | n/a — small constants module | no-analog |
| `src/contexts/identification/infrastructure/providers/plant-id-provider.ts` | provider (HTTP adapter) | request-response | `notifications/infrastructure/resend-adapter.ts` (outbound HTTP) | partial |
| `src/contexts/identification/infrastructure/providers/openai-compat-provider.ts` | provider (HTTP adapter) | request-response | `resend-adapter.ts` | partial |
| `src/contexts/identification/infrastructure/providers/stub-provider.ts` | provider (test/CI adapter) | request-response | `resend-adapter.ts` (dev fallback shape) | partial |
| `src/contexts/identification/infrastructure/providers/index.ts` (factory) | factory | config | `notifications/infrastructure/resend-adapter.ts` (env-gated singleton) | role-match |
| `src/contexts/identification/application/identify.ts` | use-case | TX boundary | `catalog/application/create-plant.ts` | exact |
| `src/contexts/identification/application/confirm-identification.ts` | use-case | TX + post-commit | `catalog/application/create-plant.ts` (outer-tx + postCommit) | exact |
| `src/contexts/identification/application/correct-identification.ts` | use-case | CRUD | `catalog/application/update-plant.ts` (read-then-update) | role-match |
| `src/contexts/identification/application/list-identifications.ts` | use-case | cursor + signed URLs | `catalog/application/list-plants.ts` | exact |
| `src/contexts/identification/application/identification-router.ts` | service (router) | dispatch | none (closest: `create-plant.ts` step-list comment style) | no-analog |
| `src/contexts/identification/application/has-active-consent.ts` (new helper on iam side) | repository helper | read | `iam/infrastructure/db/consent-logs.ts` (`listByUser`) | role-match |
| `src/contexts/identification/inngest/functions.ts` (modify) | inngest | event-driven | `notifications/inngest/functions.ts` (`notifications-send-email`) | exact |
| `src/contexts/identification/api/snake-case.ts` | mapper | transform | `catalog/api/snake-case.ts` | exact |
| `src/contexts/identification/queries/index.ts` | TanStack factory | request-response | `catalog/queries/index.ts` | exact |
| `src/app/api/v1/identifications/route.ts` | route handler | multipart + idempotency | `app/api/v1/plants/route.ts` | exact |
| `src/app/api/v1/identifications/[identificationId]/confirm/route.ts` | route handler | param + JSON | `app/api/v1/plants/[plantId]/route.ts` + `iam/api/consent-route.ts` | exact |
| `src/app/api/v1/identifications/[identificationId]/correct/route.ts` | route handler | param + JSON | same as above | exact |
| `src/app/api/v1/iam/consents/route.ts` | route handler | JSON | `iam/api/consent-route.ts` (already exists for diagnostics) | exact |
| `src/app/(app)/identify/page.tsx` (replace) | page (server) | render | `app/(app)/catalog/[plantId]/page.tsx` (server-component shell) | exact |
| `src/app/(app)/identify/_identify-flow.tsx` | client component | state machine | `app/(app)/catalog/add/add-plant-form.tsx` | exact |
| `src/app/(app)/identify/_identify-placeholder.tsx` (DELETE) | client component | n/a | `_identify-placeholder.tsx` itself | exact |
| `src/app/(app)/identify/_capture-guide.tsx` | client component | static | UI-SPEC + reused primitives | partial |
| `src/app/(app)/identify/_photo-strip.tsx` | client component | static | UI-SPEC + Phase 5 Lightbox | partial |
| `src/app/(app)/identify/_result-card.tsx` | client component | static | Phase 5 plant-card | partial |
| `src/app/(app)/identify/_result-sheet.tsx` | client component | controlled modal | Phase 5 `delete-confirm-sheet.tsx` (ModalSheet consumer) | role-match |
| `src/app/(app)/identify/_consent-modal.tsx` | client component | controlled modal | Phase 5 `delete-confirm-sheet.tsx` | role-match |
| `src/app/(app)/identify/_paywall-dialog.tsx` | client component | Radix Dialog | Phase 5 Lightbox (Radix Dialog direct consumer) | role-match |
| `src/app/(app)/identify/history/page.tsx` | page (server) | list | `catalog/[plantId]/page.tsx` | exact |
| `src/app/(app)/catalog/[plantId]/identifications/page.tsx` | page (server) | list | `catalog/[plantId]/page.tsx` | exact |
| `src/shared/ui/confidence-ladder.tsx` | UI primitive | render | `shared/typography/scientific-name.tsx` (server-renderable primitive) | partial |
| `src/shared/ui/capture-guide.tsx` | UI primitive | render | `scientific-name.tsx` | partial |
| `src/shared/ui/photo-strip.tsx` | UI primitive | render | Phase 5 Lightbox | partial |
| `src/shared/ui/identification-result-card.tsx` | UI primitive | render | Phase 5 plant-card | role-match |
| `src/shared/ui/identification-history-item.tsx` | UI primitive | render | Phase 5 plant-card | role-match |
| `src/shared/ui/cap-hit-chip.tsx` | UI primitive | render | `scientific-name.tsx` | partial |
| `src/shared/ui/ai-provenance-chip.tsx` | UI primitive | render | `scientific-name.tsx` | partial |
| Tests (integration, unit, E2E) | test | various | `tests/integration/create-plant.integration.test.ts`, `tests/unit/catalog-sign-photo-url.test.ts`, `tests/e2e/fixtures/authed-user.ts` | exact |
| `messages/pt-BR.json` (modify) | i18n | static | `messages/pt-BR.json` itself (existing `identify.placeholder` namespace) | exact |

---

## Pattern Assignments

### Domain 1 — Schema migrations

#### `drizzle/migrations/0008_phase06_identification.sql` (migration, schema)

**Analog:** `drizzle/migrations/0004_add_pending_storage_deletions.sql:1-32`

**ALTER + CREATE pattern with breakpoint statements** (lines 1-18):
```sql
CREATE TYPE "public"."pending_deletion_status" AS ENUM('pending', ...);--> statement-breakpoint
CREATE TABLE "pending_storage_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	...
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_storage_deletions" ADD CONSTRAINT "..._fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "psd_status_scheduled_at_idx" ON "pending_storage_deletions" USING btree ("status","scheduled_at");--> statement-breakpoint
```

**RLS posture pattern** (lines 23-32) — apply to user-owned tables; for `provider_circuit_breakers` SKIP RLS (service-role only, matches Phase 2 `provider_usage_counters` posture):
```sql
ALTER TABLE "pending_storage_deletions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pending_storage_deletions_owner_all') THEN
    CREATE POLICY "pending_storage_deletions_owner_all" ON public.pending_storage_deletions
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;--> statement-breakpoint
```

**Phase 6 additions** (per CONTEXT D-06/D-07/D-23):
- `ALTER TABLE provider_budgets ADD COLUMN cost_per_request_cents INT NOT NULL DEFAULT 2;`
- `ALTER TABLE provider_budgets ADD COLUMN last_alerted_at DATE;`
- `CREATE TABLE provider_circuit_breakers (...)` — NO RLS, seed two rows (`plant_id`, `openai_compat`).

#### `src/contexts/identification/infrastructure/db/schema.ts` (modify)

**Analog:** itself (`schema.ts:93-114` for `providerBudgets`) + `schema.ts:116-139` for `providerUsageCounters` (no-RLS pattern).

**Add columns to `providerBudgets`** (extend the existing `pgTable("provider_budgets", { ... })` block):
```typescript
costPerRequestCents: integer("cost_per_request_cents").notNull().default(2),
lastAlertedAt: date("last_alerted_at"),
```

**Add new `providerCircuitBreakers` table** mirroring the no-RLS counter posture (`schema.ts:116-139`):
```typescript
export const providerCircuitBreakers = pgTable("provider_circuit_breakers", {
  provider: varchar("provider", { length: 64 }).primaryKey(),
  state: varchar("state", { length: 16, enum: ["closed","open","half_open"] as const }).notNull().default("closed"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  openedAt: timestamp("opened_at", { withTimezone: true, mode: "string" }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});
```

---

### Domain 2 — Repositories

#### `src/contexts/identification/infrastructure/db/identifications.ts` (NEW repository)

**Analog A — basic insert + ownership filter:** `src/contexts/catalog/infrastructure/db/plants.ts:25-65`

**Imports + type aliases pattern** (`plants.ts:1-28`):
```typescript
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { plants } from "@contexts/catalog/infrastructure/db/schema";

type PlantsDb = DbClient | TransactionalDb;
export type PlantRow = typeof plants.$inferSelect;
export type PlantInsert = typeof plants.$inferInsert;
```

**Owner-scoped read pattern** (`plants.ts:54-65`) — apply to `findByIdForUser(identificationId, userId)`:
```typescript
export async function findByIdForUser(
  db: PlantsDb,
  userId: string,
  plantId: string,
): Promise<PlantRow | null> {
  const rows = await db
    .select()
    .from(plants)
    .where(and(eq(plants.userId, userId), eq(plants.id, plantId)))
    .limit(1);
  return rows[0] ?? null;
}
```

**Analog B — cursor pagination:** `src/contexts/iam/infrastructure/db/consent-logs.ts:32-74`

**Cursor type + listByUser** (`consent-logs.ts:32-74`):
```typescript
export interface ListByUserCursor {
  createdAt: string;
  id: string;
}
export interface ListByUserOptions {
  cursor?: ListByUserCursor;
  limit?: number;
}

export async function listByUser(
  dbHandle: ConsentLogsDb,
  userId: string,
  options: ListByUserOptions = {},
): Promise<ConsentLogRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const baseFilter = eq(consentLogs.userId, userId);
  const cursor = options.cursor;
  const where = cursor
    ? and(
        baseFilter,
        or(
          lt(consentLogs.createdAt, cursor.createdAt),
          and(eq(consentLogs.createdAt, cursor.createdAt), lt(consentLogs.id, cursor.id)),
        ),
      )
    : baseFilter;

  return dbHandle
    .select()
    .from(consentLogs)
    .where(where)
    .orderBy(desc(consentLogs.createdAt), desc(consentLogs.id))
    .limit(limit);
}
```

**Insert helper** (`consent-logs.ts:21-30`) — apply to `create(input)`:
```typescript
export async function create(
  db: ConsentLogsDb,
  input: ConsentLogInsert,
): Promise<ConsentLogRow> {
  const [row] = await db.insert(consentLogs).values(input).returning();
  if (!row) {
    throw new Error("consentLogs.create: insert returned no row");
  }
  return row;
}
```

**`updatePlantId` / `updateSelectedResult` / `updateManualCorrection`** — partial-update pattern from `catalog/infrastructure/db/photo-entries.ts:63-72` (`UPDATE … WHERE id = $1 AND user_id = $2 RETURNING …`).

#### `src/contexts/identification/infrastructure/db/identification-limits.ts` (NEW)

**Analog:** `consent-logs.ts:21-30` (just `create`-like simplicity) + ad-hoc 30s TTL cache. No exact existing TTL-cache analog in repo. Pattern proposal:

```typescript
type Cached = { row: IdentificationLimitRow; expiresAt: number };
const cache = new Map<"trial" | "paid", Cached>();
const TTL_MS = 30_000;

export async function findByTier(db, tier): Promise<IdentificationLimitRow> {
  const now = Date.now();
  const hit = cache.get(tier);
  if (hit && hit.expiresAt > now) return hit.row;
  const [row] = await db.select().from(identificationLimits).where(eq(identificationLimits.tier, tier)).limit(1);
  if (!row) throw new Error(`identification_limits row missing for tier=${tier}`);
  cache.set(tier, { row, expiresAt: now + TTL_MS });
  return row;
}
```

#### `src/contexts/identification/infrastructure/db/provider-budgets.ts` (NEW)

**Analog:** `consent-logs.ts:21-30` (read by composite key) — drop cursor pagination; add a focused `updateLastAlertedAt(provider, purpose, date)` for D-23 debounce.

#### `src/contexts/identification/infrastructure/db/provider-usage-counters.ts` (NEW — atomic UPSERT)

**Analog:** `consent-logs.ts:102-108` for the raw-SQL `db.execute(sql\`INSERT … RETURNING …\`)` shape:
```typescript
const rows = await dbOrTx.execute<{ id: string; policy_version_id: string }>(
  sql`INSERT INTO public.consent_logs (user_id, purpose, legal_basis, source, policy_version_id, granted_at)
        VALUES (${opts.userId}, 'signup_acceptance', 'contract', 'signup', ${opts.tosPolicyVersionId},     now()),
              (${opts.userId}, 'signup_acceptance', 'contract', 'signup', ${opts.privacyPolicyVersionId}, now())
      RETURNING id, policy_version_id`,
);
```

**Phase 6 atomic UPSERT** (per RESEARCH Pattern 5):
```typescript
const rows = await db.execute<{ estimated_cost_cents: number; request_count: number }>(sql`
  INSERT INTO provider_usage_counters (provider, purpose, utc_date, request_count, estimated_cost_cents, last_updated)
  VALUES (${provider}, ${purpose}, ${utcDate}, 1, ${costCents}, NOW())
  ON CONFLICT (provider, purpose, utc_date) DO UPDATE
    SET estimated_cost_cents = provider_usage_counters.estimated_cost_cents + EXCLUDED.estimated_cost_cents,
        request_count = provider_usage_counters.request_count + 1,
        last_updated = NOW()
  RETURNING estimated_cost_cents, request_count
`);
```

#### `src/contexts/identification/infrastructure/db/circuit-breakers.ts` (NEW)

**No exact analog.** Closest reference: the raw-SQL UPSERT shape from `consent-logs.ts:102-108` (above) plus optimistic UPDATE WHERE for state transitions (RESEARCH Open Question 1). Planner should reference RESEARCH §Pattern 5 + §Open Question 1 directly.

---

### Domain 3 — Provider HTTP adapters

**No exact analog for outbound HTTP provider with `AbortController`.** Closest existing pattern is the Resend SDK wrapper at `src/contexts/notifications/infrastructure/resend-adapter.ts`. It's instructive for env-gated singleton + dev-fallback shape, but it does NOT call `fetch()` directly.

#### `src/contexts/identification/infrastructure/providers/plant-id-provider.ts` (NEW)
#### `src/contexts/identification/infrastructure/providers/openai-compat-provider.ts` (NEW)
#### `src/contexts/identification/infrastructure/providers/stub-provider.ts` (NEW)

**Partial analog:** `src/contexts/notifications/infrastructure/resend-adapter.ts:1-65`

**Env-gated singleton + production guard** (`resend-adapter.ts:21-37`):
```typescript
const resend = serverEnv.RESEND_API_KEY ? new Resend(serverEnv.RESEND_API_KEY) : null;

export const resendAdapter = {
  async send(params: { ... }): Promise<{ id: string }> {
    if (!resend) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "resendAdapter.send: RESEND_API_KEY missing in production — refusing to fall through to dev console.log ...",
        );
      }
      console.log("[resend-dev] would send (dev fallback fired — body omitted)", { ... });
      return { id: "dev-mode" };
    }
    ...
  },
};
```

**Throw-on-error pattern** (`resend-adapter.ts:54-63`) — Phase 6 providers must throw `InvalidProviderResponseError` on non-2xx so the router increments breaker:
```typescript
const { data, error } = await resend.emails.send({ ... });
if (error) throw new Error(`resend.send failed: ${error.message}`);
if (!data) throw new Error("resend.send returned no data");
return { id: data.id };
```

**Code shape to copy verbatim:** RESEARCH §Pattern 2 (`PlantIdProvider`, lines 388-436) and §Pattern 3 (`OpenAICompatProvider`, lines 444-526). The planner is the source of truth here — there is no existing `fetch()`-based provider in the codebase.

#### `src/contexts/identification/infrastructure/providers/index.ts` (factory)

**Partial analog:** the `serverEnv` gate at `resend-adapter.ts:21`. Pattern: switch on `process.env.IDENTIFICATION_PROVIDER_MODE` (`stub` vs `real`) and return `[stubProvider]` vs `[plantIdProvider, openAICompatProvider]`. No closer analog exists.

---

### Domain 4 — Use-cases

#### `src/contexts/identification/application/identify.ts` (NEW — main use-case)

**Analog:** `src/contexts/catalog/application/create-plant.ts:171-341`

**Stepped pre-validation pattern** (`create-plant.ts:175-225`):
```typescript
export async function createPlant(
  input: CreatePlantInput,
  deps: CreatePlantDeps = {},
): Promise<CreatePlantResult> {
  // (0) Schema parse — returns validation_failed before any side effect.
  const parsed = createPlantInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: ErrorCode.ValidationFailed, reason: parsed.error.issues[0]?.message ?? "invalid input" };
  }
  const validInput = parsed.data;
  // (1) MIME validation. (2) Size validation. (3) GPS rejection.
  // ...
}
```

**`withUnitOfWork` boundary + outer-tx branching** (`create-plant.ts:295-340`):
```typescript
if (deps.tx) {
  // (7b) Caller owns the transaction — insert using outer tx, do NOT commit.
  let plant: PlantRow;
  let photoEntry: PhotoEntryRow;
  try {
    plant = await plantsRepo.create(deps.tx, plantInsert);
    photoEntry = await photoEntriesRepo.create(deps.tx, photoEntryInsert);
  } catch (err) {
    await deleteSinglePlantPhotoBestEffort({ ... });
    throw err;
  }
  const postCommit: PostCommitCallback = buildTelemetryCallback(validInput, plant);
  return { ok: true, plant, photoEntry, postCommit };
}

// (7a) Use-case owns its own UoW — insert, commit, then run telemetry inline.
({ plant, photoEntry } = await withUnitOfWork(validInput.userId, async (tx) => {
  const createdPlant = await plantsRepo.create(tx, plantInsert);
  const createdPhoto = await photoEntriesRepo.create(tx, photoEntryInsert);
  return { plant: createdPlant, photoEntry: createdPhoto };
}));
await buildTelemetryCallback(validInput, plant)();
```

**Telemetry post-commit pattern** (`create-plant.ts:139-169`) — apply to `identification_started` / `identification_completed`:
```typescript
function buildTelemetryCallback(input: CreatePlantInput, plant: PlantRow): PostCommitCallback {
  return async () => {
    try {
      await inngest.send({ name: "plant.created", data: { ... } });
    } catch (err) {
      Sentry.captureException(err, { tags: { surface: "..." } });
    }
    const ph = getPostHog();
    if (ph) {
      ph.capture({ distinctId: input.userId, event: "plant_added", properties: { ... } });
      await ph.shutdown();
    }
  };
}
```

**Advisory lock + cap check** (RESEARCH Pattern 4, lines 534-552) — no codebase analog; planner uses RESEARCH excerpt verbatim. Reference the `IDENT_LOCK_NAMESPACE = 6_000_000_06` constant in `domain/locks.ts`.

#### `src/contexts/identification/application/confirm-identification.ts` (NEW)

**Analog:** `create-plant.ts:295-315` (outer-tx path with `postCommit`).

**Composition:** open `withUnitOfWork(userId, async (tx) => …)` → call `createPlant({source:"identification", speciesId, …}, {tx})` → use repository `updatePlantId(tx, identificationId, plantId)` → return `postCommit` for `identification.succeeded` event + `plant_added` PostHog (the latter already handled inside `createPlant` per `create-plant.ts:152-167`).

#### `src/contexts/identification/application/correct-identification.ts` (NEW)

**Analog:** `src/contexts/iam/application/record-consent.ts:56-107` (read-then-write inside UoW)

**Read current → conditional write** (`record-consent.ts:66-100`):
```typescript
const work = async (tx: TransactionalDb): Promise<RecordConsentResult> => {
  const currentPolicy = await tx
    .select({ id: policyVersions.id })
    .from(policyVersions)
    .where(and(eq(policyVersions.documentType, "privacy_policy"), eq(policyVersions.isCurrent, true)))
    .orderBy(desc(policyVersions.effectiveAt))
    .limit(1);

  const policy = currentPolicy[0];
  if (!policy) {
    return { ok: false, error: ErrorCode.ValidationFailed, reason: "no_current_policy_version" };
  }
  const row = await createConsentLog(tx, { userId, purpose: input.purpose, ... });
  return { ok: true, row };
};

if (injectedTx) {
  return work(injectedTx);
}
return withUnitOfWork(userId, work);
```

**Phase 6 application:** read species via `SELECT id FROM species WHERE LOWER(name) = LOWER($correction) OR LOWER(scientific_name) = LOWER($correction) LIMIT 1`; if hit → update `plant.species_id`; if miss → leave null + Sentry-log. Same `injectedTx ?? withUnitOfWork(userId, …)` envelope.

#### `src/contexts/identification/application/list-identifications.ts` (NEW)

**Analog:** `src/contexts/catalog/application/list-plants.ts:30-76`

**Cursor decode + repo + signed-URL fan-out** (`list-plants.ts:30-67`):
```typescript
export async function listPlants(input: ListPlantsInput): Promise<ListPlantsResult> {
  const limit = normalizeLimit(input.limit);
  let cursorPayload: SortCursorPayload | null = null;
  if (input.cursor !== null) {
    const decoded = decodeSortCursor(input.cursor);
    if (!decoded.ok) return { ok: false, code: ErrorCode.ValidationFailed, reason: "invalid cursor" };
    cursorPayload = decoded.value;
  }

  const { rows, nextCursor: nextRaw } = await plantsRepo.list(defaultDb, { userId, sort, cursor: cursorPayload, limit });
  const nextCursor = nextRaw === null ? null : encodeSortCursor(nextRaw);

  // batch-sign in parallel
  const signedItems = await Promise.all(
    rows.map(async (row) => {
      if (!row.coverPhotoUrl) return { ...row, coverSignedUrl: null };
      const signed = await signCatalogPhotoUrl({
        storedUrl: row.coverPhotoUrl,
        ttlSeconds: 24 * 3600, // D-20: 24h TTL in caller, NOT baked into helper
      });
      return { ...row, coverSignedUrl: signed.ok ? signed.signedUrl : null };
    }),
  );
  return { ok: true, items: signedItems, nextCursor };
}
```

**Phase 6 mapping:** `photo_urls` is a `text[]` per `identification/infrastructure/db/schema.ts:45`; sign just the FIRST URL for the thumbnail per CONTEXT D-21. TTL stays the literal `24 * 3600` in the caller (not baked into the helper — see `list-plants.ts:63` rationale).

#### `src/contexts/identification/application/identification-router.ts` (NEW)

**No exact analog.** Closest stylistic reference: stepped numbered comments from `create-plant.ts:34-57`. Planner uses RESEARCH §Pattern + lines 807-891 (router with budget threading) verbatim. Time-budget arithmetic comes entirely from RESEARCH §Code Examples.

#### `src/contexts/iam/infrastructure/db/consent-logs.ts` ADD `hasActiveConsent(userId, purpose)` (modify existing)

**No existing helper.** Closest existing function in the same file: `listByUser` (`consent-logs.ts:48-74`). Add a new selective query:
```typescript
export async function hasActiveConsent(
  db: ConsentLogsDb,
  userId: string,
  purpose: "identification_third_party" | ...,
): Promise<boolean> {
  // Latest grant after any revocation (RESEARCH Pitfall 6)
  const [latest] = await db
    .select({ grantedAt: consentLogs.grantedAt, revokedAt: consentLogs.revokedAt })
    .from(consentLogs)
    .where(and(eq(consentLogs.userId, userId), eq(consentLogs.purpose, purpose)))
    .orderBy(desc(consentLogs.grantedAt))
    .limit(1);
  return latest != null && latest.revokedAt == null;
}
```

---

### Domain 5 — Inngest functions

#### `src/contexts/identification/inngest/functions.ts` (REPLACE empty array — line 3)

**Analog:** `src/contexts/notifications/inngest/functions.ts:14-41` (`notifications-send-email`)

**Event-triggered Resend dispatch** (`notifications/inngest/functions.ts:14-41`):
```typescript
const notificationsSendEmail = inngest.createFunction(
  {
    id: "notifications-send-email",
    retries: 3,
    triggers: [{ event: "notifications/email.requested" }],
  },
  async ({ event, step }) => {
    const data = event.data as NotificationsEmailRequestedPayload;
    const rendered = (await step.run("render-email", async () =>
      renderEmail(data.template, data.props),
    )) as { react: ReactElement };
    const result = await step.run("send-resend", async () =>
      resendAdapter.send({
        from: serverEnv.RESEND_FROM_ADDRESS,
        to: data.to,
        subject: data.subject,
        react: rendered.react,
        templateName: data.template,
      }),
    );
    return { messageId: result.id };
  },
);
```

**Module export pattern** (`notifications/inngest/functions.ts:52`):
```typescript
export const notificationsFunctions = [notificationsSendEmail, notificationsSendPush];
```

**Phase 6 application:** create `notifyCeiling` for the `provider.ceiling_reached` event (per RESEARCH §Pattern 6, lines 591-617). Reuse `resendAdapter.send` from the same module — do NOT instantiate Resend directly. Update the existing line `export const identificationFunctions: never[] = [];` (`identification/inngest/functions.ts:3`) to `export const identificationFunctions = [notifyCeiling];`.

---

### Domain 6 — API route handlers

#### `src/app/api/v1/identifications/route.ts` (NEW — POST + GET)

**Analog:** `src/app/api/v1/plants/route.ts:1-224` (multipart POST + cursor GET — exact match)

**POST handler with `requireVerifiedUser` + `Idempotency-Key` + multipart + `withIdempotency`** (`plants/route.ts:28-159`):
```typescript
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) {
    return errorResponse(
      auth.code,
      auth.code === ErrorCode.EmailUnverified
        ? "Verifique seu email para continuar."
        : "Sessão inválida.",
    );
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) {
    return errorResponse(ErrorCode.ValidationFailed, "Cabeçalho Idempotency-Key obrigatório.");
  }
  const hashResult = await computeMultipartRequestHash(request);
  if (!hashResult.ok) return errorResponse(hashResult.code, hashResult.reason);
  const requestHash = hashResult.hash;

  let formData: FormData;
  try { formData = await request.formData(); }
  catch (error) {
    return errorResponse(ErrorCode.ValidationFailed, `multipart parse failed: ${error instanceof Error ? error.message : "..."}`);
  }
  // ... extract fields ...

  let capturedPostCommit: (() => Promise<void>) | undefined;
  const idempotencyResult = await withIdempotency(
    { userId: auth.user.id, key: idempotencyKey, requestHash },
    async (tx) => {
      const usecase = await createPlant({ ... }, { tx });
      if (!usecase.ok) {
        return { status: usecase.code === ErrorCode.ValidationFailed ? 400 : 500, body: { error: { code: usecase.code, message: usecase.reason } } };
      }
      capturedPostCommit = usecase.postCommit;
      return { status: 201, body: { plant: toPlantSnakeCase(usecase.plant), ... } };
    },
  );
  if (!idempotencyResult.replayed && capturedPostCommit) {
    try { await capturedPostCommit(); }
    catch (err) { Sentry.captureException(err); }
  }
  return new Response(JSON.stringify(idempotencyResult.body), {
    status: idempotencyResult.status,
    headers: { "content-type": "application/json" },
  });
}
```

**Phase 6 add:** `export const maxDuration = 60;` after `runtime` declaration (Vercel Pro required — RESEARCH Pitfall 1). Photo loop = `formData.getAll("photos").filter((v): v is File => v instanceof File)`; per-photo `rejectOversizeBuffer` + `rejectGpsMetadata` per RESEARCH lines 768-774.

**GET cursor handler** (`plants/route.ts:167-224`):
```typescript
export async function GET(request: Request): Promise<Response> {
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) { return errorResponse(...); }

  const url = new URL(request.url);
  const cursorRaw = url.searchParams.get("cursor");
  if (cursorRaw) {
    const decoded = decodeSortCursor(cursorRaw);
    if (!decoded.ok) return errorResponse(ErrorCode.ValidationFailed, "Cursor inválido.");
  }
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const result = await listPlants({ userId: auth.user.id, sort, cursor: cursorRaw, limit, includeCount });
  if (!result.ok) return errorResponse(result.code, result.reason);

  const body = {
    items: result.items.map(toPlantWithSignedUrlSnakeCase),
    next_cursor: result.nextCursor ?? null,
  };
  return Response.json(body, { status: 200 });
}
```

#### `src/app/api/v1/identifications/[identificationId]/confirm/route.ts` and `.../correct/route.ts` (NEW)

**Analog:** `src/app/api/v1/plants/[plantId]/route.ts:18-60` (param route shape) + `src/contexts/iam/api/consent-route.ts:57-122` (JSON body + `withIdempotency`).

**Param + UUID validation pattern** (`plants/[plantId]/route.ts:18-46`):
```typescript
const uuidSchema = z.string().uuid();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ plantId: string }> },
): Promise<Response> {
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) { return errorResponse(...); }
  const { plantId } = await params;
  const plantIdParsed = uuidSchema.safeParse(plantId);
  if (!plantIdParsed.success) {
    return errorResponse(ErrorCode.ValidationFailed, "plantId inválido.");
  }
  const result = await getPlant({ userId: auth.user.id, plantId: plantIdParsed.data });
  if (!result.ok) return errorResponse(result.code, result.reason);
  return Response.json({ ... }, { status: 200 });
}
```

**JSON body + Idempotency + use-case pattern** (`iam/api/consent-route.ts:57-122`):
```typescript
export async function postHandler(request: Request): Promise<Response> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return errorResponse(auth.code, "missing or invalid bearer token");
  const userId = auth.user.id;

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.trim() === "") {
    return errorResponse(ErrorCode.ValidationFailed, "Idempotency-Key header is required");
  }

  const parsed = await parseJsonBody(request, consentRoutePostBodySchema);
  if (!parsed.ok) return errorResponse(parsed.error, "invalid consent body");

  const requestHash = createHash("sha256").update(JSON.stringify(parsed.value)).digest("hex");
  const result = await withIdempotency({ userId, key: idempotencyKey, requestHash }, async (tx) => {
    const inner = await recordConsent({ userId, input: { ... } }, tx);
    if (!inner.ok) {
      return { status: 400, body: { error: { code: inner.error, message: "no current policy version" } } };
    }
    return { status: 201, body: { id: row.id, ... } };
  });
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { "content-type": "application/json" } });
}
```

#### `src/app/api/v1/iam/consents/route.ts` (NEW user-facing handler)

**Analog:** `src/contexts/iam/api/consent-route.ts:57-122` (already exists for diagnostics). The Phase 6 user route is a thin re-export with the `purpose='identification_third_party'` allowed via `consentLogInsertSchema.pick({purpose, legalBasis, source})` — the drizzle-zod root automatically permits the enum value declared in the schema. Pattern:
```typescript
export { postHandler as POST } from "@contexts/iam/api/consent-route";
```
(Match the catalog re-export style at `app/api/v1/plants/[plantId]/route.ts:67-68`.)

#### `src/contexts/identification/api/snake-case.ts` (NEW)

**Analog:** `src/contexts/catalog/api/snake-case.ts:1-87`

**Snake-case mapper pattern** (`catalog/api/snake-case.ts:12-53`):
```typescript
export type PlantSnakeCase = {
  id: string;
  user_id: string;
  species_id: string | null;
  ...
  created_at: string;
  updated_at: string;
};

export function toPlantSnakeCase(row: PlantRow): PlantSnakeCase {
  return {
    id: row.id,
    user_id: row.userId,
    species_id: row.speciesId ?? null,
    ...
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export type PlantWithSignedUrlSnakeCase = PlantSnakeCase & { cover_signed_url: string | null };
export function toPlantWithSignedUrlSnakeCase(row: PlantRow & { coverSignedUrl: string | null }): PlantWithSignedUrlSnakeCase {
  return { ...toPlantSnakeCase(row), cover_signed_url: row.coverSignedUrl };
}
```

**Phase 6 application:** export `toIdentificationHistoryItemSnakeCase(row & { thumbnailSignedUrl })`. Shape from CONTEXT D-21: `{id, status, failureReason, provider, model, latencyMs, createdAt, thumbnailUrl, results, selectedResult, plantId, plantName}` rendered snake_case.

---

### Domain 7 — Frontend pages (App Router)

#### `src/app/(app)/identify/page.tsx` (REPLACE placeholder, line 1+)

**Analog:** `src/app/(app)/catalog/[plantId]/page.tsx:1-60` (server component shell with hydration boundary)

**Server-component prefetch + hydration** (`catalog/[plantId]/page.tsx:1-60`):
```typescript
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { getCurrentUserFromSessionReadOnly } from "@contexts/iam/application/current-user";
import { getPlant } from "@contexts/catalog/application/get-plant";
import { toPlantWithSignedUrlSnakeCase, toPhotoEntrySnakeCase } from "@contexts/catalog/api/snake-case";
import { ErrorCode } from "@shared/config/errors";

import { PlantProfile } from "./plant-profile";

export default async function PlantProfilePage({
  params,
}: { params: Promise<{ plantId: string }> }) {
  const { plantId } = await params;
  const auth = await getCurrentUserFromSessionReadOnly();
  if (!auth.ok) notFound();

  const plantResult = await getPlant({ userId: auth.user.id, plantId });
  if (!plantResult.ok) {
    if (plantResult.code === ErrorCode.NotFound) notFound();
    throw new Error(`getPlant failed: ${plantResult.code}`);
  }
  // ... build snake-case data ...

  const queryClient = new QueryClient();
  queryClient.setQueryData(["catalog", "plant", plantId], { plant: plantSnake, _meta: { ... } });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PlantProfile plantId={plantId} />
    </HydrationBoundary>
  );
}
```

**Phase 6 application:** server-component for `/identify/page.tsx` checks consent + read-only flag, prefetches consent state into the query cache, then renders `<IdentifyFlow />` client island. For `/identify/history/page.tsx` and `/catalog/[plantId]/identifications/page.tsx`, prefetch `listIdentifications` and pass to a client `<IdentificationHistory />`.

**Existing placeholder to delete:** `src/app/(app)/identify/_identify-placeholder.tsx:1-43` (preserve `useOnlineStatus()` import; CONTEXT D-24).

#### `src/app/(app)/identify/_identify-flow.tsx` (NEW client component, state machine)

**Analog:** `src/app/(app)/catalog/add/add-plant-form.tsx:1-220` (state-heavy client form with multipart fetch + idempotency-key + compression)

**Client state + idempotency-key + multipart upload** (`add-plant-form.tsx:62-160`):
```typescript
"use client";
import { useState, useRef, useId } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { compressPlantPhoto } from "@shared/images/client-compress";
import { useSubscription } from "@contexts/billing/application/use-subscription";

export function AddPlantForm({ readOnly: readOnlyProp, ... }: AddPlantFormProps) {
  const router = useRouter();
  const { readOnly: subscriptionReadOnly } = useSubscription();
  const readOnly = readOnlyProp || subscriptionReadOnly;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  ...
  const idempotencyKeyRef = useRef<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ...
    if (idempotencyKeyRef.current === null) idempotencyKeyRef.current = crypto.randomUUID();

    try {
      const compressedFile = await compressPlantPhoto(selectedFile!);
      const formData = new FormData();
      formData.append("name", nameValue.trim());
      formData.append("photo", compressedFile);
      ...
      const response = await fetch("/api/v1/plants", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: { "Idempotency-Key": idempotencyKeyRef.current },
      });
      if (response.ok) {
        const body = await response.json() as { plant: { id: string } };
        idempotencyKeyRef.current = null;
        router.push(`/catalog/${body.plant.id}`);
        return;
      }
      // ... map errors ...
    } catch { toast.error(labels.submitFailure, { ... }); ... }
    finally { setSubmitting(false); }
  }
  ...
}
```

**Phase 6 application:** state machine maps to UI-SPEC §State Machine 13 states. Multi-photo `formData.append("photos", file)` (one per photo). Server response branches on `error.code`: `consent_required` → open consent modal, `cap_hit` → cap-hit state, `provider_unavailable` → state 10, `timeout` → state 11. Use `compressPlantPhoto` analog (`shared/images/client-compress.ts`) for per-photo `browser-image-compression` re-encode + EXIF strip.

#### `src/app/(app)/identify/_paywall-dialog.tsx` (NEW)

**Analog:** Phase 5 Lightbox uses Radix Dialog directly (path: `src/shared/ui/lightbox.tsx`). Pattern: `import * as Dialog from "@radix-ui/react-dialog"` + `<Dialog.Root>` + `<Dialog.Overlay>` + `<Dialog.Content>` + `dismissOnScrim={false}` via `onPointerDownOutside={(e) => e.preventDefault()}` per UI-SPEC line 128.

#### `src/app/(app)/identify/_consent-modal.tsx` and `_result-sheet.tsx` (NEW)

**Analog:** Phase 5 `delete-confirm-sheet.tsx` (consumer of `<ModalSheet>`).

**ModalSheet base** (`shared/ui/modal-sheet.tsx:1-58`):
```typescript
"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface ModalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
  onOpenAutoFocus?: (event: Event) => void;
  role?: "dialog" | "alertdialog";
  interactiveDragHandle?: boolean;
}
```

**Phase 6 LGPD modal:** UI-SPEC says `dismissOnScrim={false}, dismissOnEsc={false}` — but `ModalSheet` does NOT currently expose those props. Either (a) extend `ModalSheet` with `dismissOnScrim`/`dismissOnEsc` boolean props OR (b) use Radix Dialog directly. UI-SPEC §Inheritance Map line 52 states "Same override applies to read-only paywall Radix Dialog" so option (b) is consistent with `_paywall-dialog.tsx`. Planner decides — flag this contract gap.

---

### Domain 8 — TanStack Query factory

#### `src/contexts/identification/queries/index.ts` (NEW)

**Analog:** `src/contexts/catalog/queries/index.ts:1-119` (exact)

**Factory shape** (`catalog/queries/index.ts:90-119`):
```typescript
async function fetchPlantsList(params: PlantsListParams): Promise<ListPlantsResponse> {
  const sp = new URLSearchParams();
  sp.set("sort", params.sort);
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.include_count) sp.set("include_count", "1");
  const r = await fetch(`/api/v1/plants?${sp.toString()}`);
  if (!r.ok) throw new Error(`plants list failed: ${r.status}`);
  return r.json() as Promise<ListPlantsResponse>;
}

export const plantsKeys = {
  all: () => ["catalog", "plants"] as const,
  lists: (params: PlantsListParams) => ({
    queryKey: ["catalog", "plants", "list", params] as const,
    queryFn: (() => fetchPlantsList(params)) as QueryFunction<ListPlantsResponse>,
    staleTime: 30_000,
  }) as const,
  detail: (plantId: string) => ({
    queryKey: ["catalog", "plant", plantId] as const,
    queryFn: (() => fetchPlantDetail(plantId)) as QueryFunction<PlantDetailResponse>,
    staleTime: 60_000,
  }) as const,
};
```

**Hooks file** (`catalog/queries/hooks.ts:1-21`):
```typescript
"use client";
import { useQuery } from "@tanstack/react-query";
import { plantsKeys, locationsKeys, type PlantsListParams } from "./index";

export function usePlants(params: PlantsListParams) {
  return useQuery(plantsKeys.lists(params));
}
```

**Phase 6 application:** export `identificationKeys.history({ plantId? })`, `identificationKeys.detail(id)`. Add a hooks file `identification/queries/hooks.ts` mirroring `catalog/queries/hooks.ts:1-21`.

---

### Domain 9 — UI primitives

The seven new primitives (`ConfidenceLadder`, `CaptureGuide`, `PhotoStrip`, `IdentificationResultCard`, `IdentificationHistoryItem`, `CapHitChip`, `AiProvenanceChip`) are new design-system contracts owned by Phase 6. The visual+a11y contract is fully specified in `06-UI-SPEC.md`. The closest existing structural analog is the smallest server-renderable typography primitive:

**Analog:** `src/shared/typography/scientific-name.tsx:1-22`

**Pure server-renderable primitive** (`scientific-name.tsx:1-22`):
```typescript
import type { ReactNode } from "react";

/**
 * Latin scientific name wrapper — UI-23 + PRD §17 typography rules.
 * No "use client" directive — pure server component.
 */
export function ScientificName({ children }: { children: ReactNode }) {
  return (
    <i lang="la" className="font-sans text-sm text-slate italic">
      {children}
    </i>
  );
}
```

**Pattern to copy:**
1. Default export omitted — named export only.
2. JSDoc top-comment cites the UI-SPEC contract (`UI-15 + PRD §17`).
3. Tailwind utility classes pulled from `@theme` tokens declared in `globals.css` (Phase 3 D-04). NO new color hex literals — all tokens declared at theme level.
4. `"use client"` directive ONLY when the primitive owns state (`ConfidenceLadder` if it animates → motion prop; `CaptureGuide`, `CapHitChip`, `AiProvenanceChip` are pure-render so omit).

**For interactive client primitives** (`PhotoStrip`, `IdentificationResultCard` — both have onClick + hover state): match `add-plant-form.tsx:1` directive style:
```typescript
"use client";
```

**Component-test pattern (axe gate):** RESEARCH §Validation Architecture line 1049 lists `tests/unit/confidence-ladder.unit.test.tsx` (3 tiers × 2 themes × 2 motion preferences = 12 axe runs). No exact axe-test analog yet in the repo — this is Phase 6's first axe-on-unit consumer. Planner uses `tests/unit/catalog-sign-photo-url.test.ts:15-37` for the test-file scaffolding (`describe` + `beforeEach` + `vi.mock` shape) but `axe-core` integration must be wired manually.

---

### Domain 10 — Test scaffolds

#### `tests/integration/identify.integration.test.ts` (NEW), and the 4 sibling integration tests listed in RESEARCH §Wave 0 Gaps lines 1038-1043

**Analog:** `tests/integration/create-plant.integration.test.ts:1-100`

**Cloud-Supabase guard + mocks scaffold** (`create-plant.integration.test.ts:30-78`):
```typescript
const dbUrl = process.env.DATABASE_POOL_URL;
if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
    "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

vi.mock("exifr", async () => {
  const actual = await vi.importActual<typeof import("exifr")>("exifr");
  const gps = vi.fn(actual.gps);
  return { ...actual, default: { ...actual, gps }, gps, __esModule: true };
});

const inngestSendMock = vi.fn().mockResolvedValue({ ids: ["test-event-id"] });
vi.mock("@shared/inngest/client", () => ({
  inngest: { send: inngestSendMock },
}));

const mockCapture = vi.fn();
vi.mock("@shared/telemetry/posthog-server", () => ({
  getPostHog: vi.fn(() => ({ capture: mockCapture, shutdown: vi.fn().mockResolvedValue(undefined) })),
}));
```

**Phase 6 application:** add `vi.spyOn(global, "fetch")` to mock provider HTTP responses (RESEARCH line 1057 — project does NOT have MSW). Mock Plant.id v3 + OpenAI vision response shapes per RESEARCH §Pattern 2 + §Pattern 3.

#### `tests/unit/*` for router, breaker, providers

**Analog:** `tests/unit/catalog-sign-photo-url.test.ts:1-60`

**Adapter-fake unit test scaffold** (`catalog-sign-photo-url.test.ts:14-37`):
```typescript
describe("signCatalogPhotoUrl", () => {
  let signCatalogPhotoUrl: typeof import("@contexts/catalog/infrastructure/photo-storage").signCatalogPhotoUrl;
  let __setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;

  const mockCreateSignedUrl = vi.fn();
  const fakeAdapter: import("@shared/adapters/storage").StorageAdapter = {
    uploadObject: vi.fn(),
    createSignedUrl: mockCreateSignedUrl,
    deletePrefix: vi.fn(),
    deleteObject: vi.fn(),
    listBuckets: vi.fn(),
    listObjectsUnderPrefix: vi.fn(),
  };

  beforeEach(async () => {
    ({ signCatalogPhotoUrl, __setStorageAdapterForTests } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    ));
    __setStorageAdapterForTests(fakeAdapter);
    mockCreateSignedUrl.mockReset();
    mockCreateSignedUrl.mockResolvedValue({ signedUrl: "https://signed.test/result" });
  });
  ...
});
```

**Phase 6 application:** for the router unit test, mock `IdentificationProvider` via fake objects with controlled `identify()` resolves/rejects + `vi.useFakeTimers()` for the 50s budget arithmetic (RESEARCH line 1011).

#### `tests/e2e/fixtures/consented-user.ts` (NEW — extends `authedUser`)

**Analog:** `tests/e2e/fixtures/authed-user.ts:21-100`

**Fixture extension pattern** (`authed-user.ts:21-55`):
```typescript
export const test = base.extend<{ authedUser: AuthedUser }>({
  authedUser: async ({ context }, use) => {
    const email = `playwright-authed-${Date.now()}-...@folhario.test`;
    const password = "TestPassword123!";
    const { id: userId } = await seedUser({
      email, password,
      emailVerifiedAt: new Date().toISOString(),
      ageConfirmedAt: new Date().toISOString(),
      trialSource: "organic",
    });
    const policyVersions = await seedCurrentPolicyVersions();

    const sql = postgres(process.env.DATABASE_POOL_URL!, { prepare: false, max: 1, idle_timeout: 5 });
    try {
      await sql`
        INSERT INTO consent_logs (user_id, purpose, legal_basis, source, policy_version_id, granted_at)
        VALUES
          (${userId}, 'signup_acceptance', 'contract', 'signup', ${policyVersions.termsOfService.id}, now()),
          (${userId}, 'signup_acceptance', 'contract', 'signup', ${policyVersions.privacyPolicy.id},  now())
      `;
      await sql`
        INSERT INTO subscriptions (user_id, provider, status, trial_start_date, trial_end_date)
        VALUES (${userId}, 'stripe', 'trialing', NOW(), NOW() + INTERVAL '14 days')
      `;
    } finally {
      await sql.end({ timeout: 5 });
    }
    ...
  },
});
```

**Phase 6 extension:** add a third INSERT to consent_logs:
```sql
INSERT INTO consent_logs (user_id, purpose, legal_basis, source, policy_version_id, granted_at)
VALUES (${userId}, 'identification_third_party', 'consent', 'identify_screen', ${policyVersions.privacyPolicy.id}, now())
```
Fixture name: `consentedUser` (extends `authedUser` per CONTEXT specifics line 227).

---

## Shared Patterns

### Auth gate (every Phase 6 route handler)
**Source:** `src/app/api/v1/plants/route.ts:28-39`
**Apply to:** all `/api/v1/identifications/*` and `/api/v1/iam/consents` route handlers.
```typescript
const auth = await requireVerifiedUser(request);
if (!auth.ok) {
  return errorResponse(
    auth.code,
    auth.code === ErrorCode.EmailUnverified
      ? "Verifique seu email para continuar."
      : "Sessão inválida.",
  );
}
```

### Idempotency (every Phase 6 mutation route)
**Source:** `src/app/api/v1/plants/route.ts:42-52` + `src/contexts/iam/api/consent-route.ts:64-76`
**Apply to:** POST `/api/v1/identifications`, POST `.../confirm`, POST `.../correct`, POST `/api/v1/iam/consents`.
```typescript
const idempotencyKey = request.headers.get("idempotency-key")?.trim();
if (!idempotencyKey) {
  return errorResponse(ErrorCode.ValidationFailed, "Cabeçalho Idempotency-Key obrigatório.");
}
// JSON path: const requestHash = createHash("sha256").update(JSON.stringify(parsed.value)).digest("hex");
// Multipart path:
const hashResult = await computeMultipartRequestHash(request);
if (!hashResult.ok) return errorResponse(hashResult.code, hashResult.reason);
const requestHash = hashResult.hash;

const idempotencyResult = await withIdempotency(
  { userId: auth.user.id, key: idempotencyKey, requestHash },
  async (tx) => { /* ... */ },
);
```

### Error response (closed registry)
**Source:** `src/shared/config/errors.ts:1-81`
**Apply to:** every route handler — never hand-build error response objects. `INTERNAL_ONLY` codes (`cost_ceiling_reached`, `breaker_open`) are auto-mapped to `provider_unavailable` 503 by the helper (`errors.ts:69`).
```typescript
import { ErrorCode, errorResponse } from "@shared/config/errors";
// errorResponse(ErrorCode.CapHit, "Você atingiu o limite de identificações de hoje.")
// errorResponse(ErrorCode.ConsentRequired, "Consentimento de identificação requerido.")
// errorResponse(ErrorCode.CostCeilingReached, "...") → emits provider_unavailable 503 publicly.
```

### TX boundary (every mutating use-case)
**Source:** `src/shared/db/unit-of-work.ts:88-103`
**Apply to:** `identify`, `confirm-identification`, `correct-identification`, `record-consent` (already wraps).
```typescript
return db.transaction(async (tx) => {
  await tx.execute(sql`set local role authenticated`);
  await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);
  return fn(tx);
});
```

### snake_case response mapping
**Source:** `src/contexts/catalog/api/snake-case.ts:26-53`
**Apply to:** every Phase 6 response body — `Identification` row → `IdentificationSnakeCase`, including the `IdentificationHistoryItemSnakeCase` shaper.

### 24h signed URLs in caller, NOT in helper
**Source:** `src/contexts/catalog/application/list-plants.ts:60-66`
**Apply to:** `list-identifications.ts` thumbnail signing — pass `ttlSeconds: 24 * 3600` literal in the use-case caller; never bake into `signCatalogPhotoUrl`.

### Telemetry post-commit (PostHog + Inngest)
**Source:** `src/contexts/catalog/application/create-plant.ts:139-169`
**Apply to:** identification telemetry must fire AFTER the Identification row commits, never before. Use the `postCommit` callback shape on the result type.

### `IDENTIFICATION_PROVIDER_MODE` env-gate
**Source:** `src/contexts/notifications/infrastructure/resend-adapter.ts:21-37` (env-gated singleton + production guard)
**Apply to:** `infrastructure/providers/index.ts` factory — `process.env.IDENTIFICATION_PROVIDER_MODE === 'stub'` returns `[stubProvider]`; production path requires both `PLANT_ID_API_KEY` and `OPENAI_API_KEY` else throw at module load.

### Sentry PII scrubbing (preserve)
**Source:** Phase 1 D-22 + RESEARCH §Pitfall + RESEARCH lines 178: "request bodies dropped on `/api/v1/identifications/*`"
**Apply to:** every Phase 6 route handler MUST preserve the existing scrub-list. No code change unless adding new sub-routes — verify the path-prefix match `/api/v1/identifications/*` covers `…/confirm` and `…/correct`.

### `useOnlineStatus` + `useSubscription` gating (client)
**Source:** `src/app/(app)/identify/_identify-placeholder.tsx:6-9` + `src/app/(app)/catalog/add/add-plant-form.tsx:14-60`
**Apply to:** `_identify-flow.tsx` — preserve existing `useOnlineStatus()` for state 12 offline; consume `useSubscription()` `readOnly` for state 13 paywall.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/contexts/identification/infrastructure/providers/plant-id-provider.ts` | provider HTTP adapter | request-response | No existing `fetch()`-based provider with `AbortController` timeout in codebase. Use RESEARCH §Pattern 2 (lines 388-436) verbatim. |
| `src/contexts/identification/infrastructure/providers/openai-compat-provider.ts` | provider HTTP adapter | request-response | No existing OpenAI structured-output integration. Use RESEARCH §Pattern 3 (lines 444-526). Verify `gpt-4o-2024-08-06` strict-mode availability per RESEARCH §Risk 1. |
| `src/contexts/identification/infrastructure/providers/stub-provider.ts` | provider stub | request-response | First stub adapter; closest reference is `resend-adapter.ts` dev-fallback shape. Hardcoded results per CONTEXT specifics line 226. |
| `src/contexts/identification/infrastructure/db/circuit-breakers.ts` | repository (state machine) | atomic state | No state-machine repo exists. Use RESEARCH §Pattern 5 (atomic UPSERT shape) + Open Question 1 (in-flight half-open semantics — planner must decide). |
| `src/contexts/identification/application/identification-router.ts` | router service | dispatch chain | No existing multi-provider routing. Use RESEARCH §Code Examples lines 807-891 verbatim. |
| `src/contexts/identification/domain/locks.ts` | constants | n/a | Trivial; planner inlines `IDENT_LOCK_NAMESPACE = 6_000_000_06`. |
| Axe-on-unit test for `ConfidenceLadder` | unit test (a11y) | render | No existing axe-on-unit test in repo. Wire `axe-core` via `vitest-axe` or equivalent — first consumer. |

---

## Metadata

**Analog search scope:**
- `src/contexts/{identification,catalog,iam,notifications}/`
- `src/app/api/v1/{plants,iam}/`
- `src/app/(app)/{catalog,identify}/`
- `src/shared/{api,config,db,images,ui,typography}/`
- `drizzle/migrations/`
- `tests/{integration,unit,e2e}/`

**Files scanned (read-only):** 24 source files + 6 prior-phase planning artifacts (CONTEXT/RESEARCH/UI-SPEC).

**Pattern extraction date:** 2026-05-04

**Notes for planner:**
1. Phase 6 has ZERO new infrastructure dependencies — all required libraries (`inngest`, `resend`, `exifr`, `browser-image-compression`, `motion`, `@radix-ui/react-dialog`, `posthog-node`, `@sentry/nextjs`) are pinned in `package.json` per RESEARCH §Standard Stack. Resist adding HTTP clients (use Node 22 native `fetch`).
2. The `iam/api/consent-route.ts` file ALREADY contains `postHandler` for the `consent_logs` POST, currently mounted at `app/api/v1/diagnostics/consent/route.ts`. Phase 6 mounts a second handler at `app/api/v1/iam/consents/route.ts`. Confirm with planner whether to share the implementation (re-export `postHandler`) or duplicate-with-narrowed-purpose enum.
3. UI-SPEC §Conflicts Resolved line 52 specifies `dismissOnScrim={false}` for the LGPD consent modal — but `ModalSheet` does not currently expose this prop. Planner must either extend `ModalSheet` or use Radix Dialog directly (recommended: latter, matching `_paywall-dialog.tsx`).
4. RESEARCH §Pitfall 1 — Vercel Pro tier required for `maxDuration = 60`. Planner should add as STATE.md prerequisite.
5. RESEARCH §Open Question 1 — circuit-breaker half-open concurrency semantics need a planner-time decision. Recommended: optimistic UPDATE `SET state='in_flight' WHERE state='half_open'`. Add `'in_flight'` to the state CHECK constraint OR (preferred) use a separate `in_flight_at TIMESTAMPTZ` column to avoid a state-machine migration.

---

## PATTERN MAPPING COMPLETE

**Phase:** 6 - identification-flow-cost-controls
**Files classified:** 40
**Analogs found:** 33 / 40

### Coverage
- Files with exact analog: 20
- Files with role-match analog: 13
- Files with no analog: 7 (provider adapters ×3, circuit-breaker repo, router, locks constants module, axe-on-unit test)

### Key Patterns Identified
- All Phase 6 mutation routes follow `requireVerifiedUser → Idempotency-Key → withIdempotency(...async (tx) => use-case(input, {tx}))` (analog: `app/api/v1/plants/route.ts:28-159`).
- All repositories are functional modules accepting `DbClient | TransactionalDb` per Phase 2 D-16; cursor pagination uses the `{createdAt, id}` opaque pattern from `consent-logs.ts:32-74`.
- Use-cases use `withUnitOfWork(userId, …)` for own-TX path AND optionally accept `deps.tx` for outer-TX path with `postCommit` callbacks (analog: `create-plant.ts:295-340`).
- Inngest functions are single-event-trigger + `step.run(...)` chains; Phase 6 `notifyCeiling` mirrors `notifications-send-email` (`notifications/inngest/functions.ts:14-41`).
- Snake-case mappers + closed error registry (`errors.ts:64-81`) are the boundary contracts.
- UI primitives are Tailwind-only (no shadcn) per Phase 3 D-01; all tokens declared at `@theme` level — Phase 6 introduces zero new color values.
- Provider HTTP adapters have NO existing analog — planner uses RESEARCH §Pattern 2 / Pattern 3 verbatim.

### File Created
`.planning/phases/06-identification-flow-cost-controls/06-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
