---
phase: 05-catalog-meu-jardim
plan: 06
type: tdd
wave: 2
depends_on: ["05-03", "05-04"]
files_modified:
  - src/contexts/catalog/application/delete-plant.ts
  - src/contexts/catalog/inngest/functions.ts
  - src/contexts/catalog/domain/events.ts
  - src/shared/inngest/registry.ts
  - tests/integration/delete-plant.integration.test.ts
  - tests/integration/cleanup-storage.integration.test.ts
  - tests/integration/cleanup-storage-reconciler.integration.test.ts
autonomous: true
requirements: ["CAT-09"]
tags: [catalog, delete, inngest, storage-cleanup, reconciler, tdd]

must_haves:
  truths:
    - "DELETE /api/v1/plants/:id transaction cascades PhotoEntry + Reminder rows via FK ON DELETE CASCADE; the application layer does NOT issue separate DELETE statements for those tables."
    - "After DELETE plant, every Identification row that referenced it has plant_id = NULL but the row itself is preserved (Identification.plant_id ON DELETE SET NULL — confirmed at src/contexts/identification/infrastructure/db/schema.ts:44)."
    - "DELETE plant inserts EXACTLY two pending_storage_deletions rows in the same TX: one for bucket=plant-photos prefix={userId}/{plantId}/, one for bucket=plant-thumbnails prefix={userId}/{plantId}/, both with status='pending', attempts=0."
    - "When the UoW transaction rolls back (e.g. cascade fails), neither pending_storage_deletions row exists AND no plant.deleted Inngest event is sent AND no plant_deleted PostHog capture fires."
    - "After successful commit, exactly one plant.deleted Inngest event is dispatched with { plantId, userId, deletedAt, deletionRowIds: [psdId, ptdId] } payload."
    - "After successful commit, exactly one PostHog plant_deleted capture is sent with { photo_count, journal_entry_count, reminder_count } privacy-clean properties (D-29) — no plant id, name, location, or notes."
    - "On plant_deleted mutation success, the SW cache entries /api/v1/plants/{plantId} and /api/v1/plants are purged from folhario-catalog-api-v1 to prevent stale data on subsequent navigations. (HIGH-2)"
    - "The cleanupStorage Inngest function consumes plant.deleted events, calls validateStorageDeletionPrefix (from 05-04's split helpers) before any storage mutation, calls storageAdapter.deletePrefix(bucket, prefix), and updates each pending_storage_deletions row to status='completed'."
    - "cleanupStorage is idempotent: re-running it on a row whose prefix has already been emptied (Supabase Storage returns success for missing keys) succeeds and leaves status='completed' without erroring."
    - "On storage failure inside cleanupStorage, the function calls pendingDeletionsRepo.recordError(rowId, message), bumps attempts, and throws RetryAfterError so Inngest reschedules per its retry policy (retries: 4)."
    - "markInProgress sets started_at = NOW() on the pending_storage_deletions row when transitioning status from 'pending' to 'in_progress' (column added in 05-02's schema patch). (HIGH-4)"
    - "recordError transitions the row back to status='pending' (NOT 'failed') when attempt_count < max_attempts (5). Only when attempt_count reaches 5 does recordError transition to status='failed' (terminal). (HIGH-4)"
    - "cleanup state machine: pending → in_progress (started_at=NOW) → [success: completed] | [error & attempt<5: pending] | [error & attempt=5: failed] | [crash: stale in_progress recovered after 30min by reconciler]. (HIGH-4)"
    - "cleanupStorageReconciler runs hourly (cron 0 * * * *), fetches up to 50 rows via fetchPendingBatch(50, { staleInProgressMinutes: 30 }) — which includes pending rows AND in_progress rows with started_at < NOW() - INTERVAL '30 minutes' (stale crash recovery). (HIGH-4)"
    - "After 5 attempts, the reconciler transitions a row to status='failed' (terminal) — surfaces in OBS-05 Phase 13 alert; no further attempts are made."
    - "The reconciler uses the service-role db client (BYPASSRLS), NOT withUnitOfWork — confirmed by Pitfall 4 (no JWT in cron context; RLS owner-only filter would deny all rows)."
    - "Cross-user prefix mis-scope is impossible: prefix is read ONLY from the pending_storage_deletions row that the function loaded; validateStorageDeletionPrefix({ userId, plantId, prefix }) enforces the exact {userId}/{plantId}/ shape before adapter call. A malformed or cross-user prefix throws validation_failed. (HIGH-5)"
    - "src/shared/inngest/registry.ts imports catalogFunctions and includes it in the registry export; the registry comment block is updated from 9 to 11 functions."
  artifacts:
    - path: "src/contexts/catalog/application/delete-plant.ts"
      provides: "delete-plant use-case: ownership check → withUnitOfWork(cascade + 2 pending_storage_deletions inserts) → after-commit emit plant.deleted + PostHog plant_deleted"
      exports: ["deletePlant", "DeletePlantInput", "DeletePlantResult"]
    - path: "src/contexts/catalog/inngest/functions.ts"
      provides: "cleanupStorage event handler + cleanupStorageReconciler hourly cron + catalogFunctions export array"
      exports: ["catalogFunctions"]
      contains: 'id: "catalog/cleanup-storage"'
    - path: "src/contexts/catalog/domain/events.ts"
      provides: "Extends PlantDeletedPayload with deletionRowIds: [string, string] so cleanupStorage can locate the rows it must process"
      contains: "deletionRowIds"
    - path: "src/shared/inngest/registry.ts"
      provides: "Registry imports catalogFunctions; comment block updated to reflect 11 total functions"
      contains: "catalogFunctions"
    - path: "tests/integration/delete-plant.integration.test.ts"
      provides: "Integration tests covering cascade + identifications.plant_id NULL + 2 pending rows + rollback → no side effects + after-commit telemetry"
      contains: 'describe("delete-plant"'
    - path: "tests/integration/cleanup-storage.integration.test.ts"
      provides: "Inngest event handler tests: deletePrefix called, status transitions, idempotent re-run on completed row, validateStorageDeletionPrefix invoked, RetryAfterError on failure, cross-user prefix throws validation_failed"
      contains: 'describe("cleanupStorage"'
    - path: "tests/integration/cleanup-storage-reconciler.integration.test.ts"
      provides: "Cron tests with vi.useFakeTimers: 5/30/240/1440/4320min backoff windows respected, attempts cap at 5 → status='failed', service-role client used (BYPASSRLS proven by reading rows from multiple users), stale in_progress (started_at < NOW() - 45min) recovered by reconciler"
      contains: 'describe("cleanupStorageReconciler"'
  key_links:
    - from: "src/contexts/catalog/application/delete-plant.ts"
      to: "src/shared/db/unit-of-work.ts withUnitOfWork(userId, fn)"
      via: "TX-atomic cascade + pending_storage_deletions inserts; rollback prevents both side effects"
      pattern: "withUnitOfWork\\("
    - from: "src/contexts/catalog/application/delete-plant.ts"
      to: "src/shared/inngest/client.ts inngest.send"
      via: "After-commit dispatch of plant.deleted event with deletionRowIds payload"
      pattern: 'name: "plant.deleted"'
    - from: "src/contexts/catalog/application/delete-plant.ts"
      to: "src/shared/telemetry/posthog-server.ts getPostHog"
      via: "After-commit capture of plant_deleted with privacy-clean props (D-29)"
      pattern: 'capture\\(\\{[^}]*event: "plant_deleted"'
    - from: "src/contexts/catalog/inngest/functions.ts cleanupStorage"
      to: "src/contexts/catalog/domain/storage-paths.ts validateStorageDeletionPrefix"
      via: "MANDATORY pre-check before storageAdapter.deletePrefix — defends T-05-06-01 prefix-mis-scope; uses split helper from 05-04 (validateStorageDeletionPrefix asserts prefix === `${userId}/${plantId}/`)"
      pattern: "validateStorageDeletionPrefix\\("
    - from: "src/contexts/catalog/inngest/functions.ts cleanupStorageReconciler"
      to: "src/shared/db/client.ts (raw db, BYPASSRLS via postgres connection role)"
      via: "Service-role connection — NOT withUnitOfWork (Pitfall 4: no JWT in cron context)"
      pattern: "import \\{[^}]*db[^}]*\\} from \"@shared/db/client\""
    - from: "src/contexts/catalog/inngest/functions.ts catalogFunctions"
      to: "src/shared/inngest/registry.ts registry array"
      via: "ESM re-export so Inngest worker discovers the two new functions"
      pattern: "\\.\\.\\.catalogFunctions"
---

<objective>
Ship the plant DELETE pipeline (CAT-09): the application use-case that issues an atomic cascade and schedules durable storage cleanup, plus the two Inngest functions that consume that cleanup queue. This plan closes CAT-09.

Purpose: the FK cascade deletes DB rows synchronously, but bytes in object storage cannot be deleted from a Postgres transaction — they live in Supabase Storage. Without durable scheduling, a transient storage failure orphans bytes forever. The pending_storage_deletions table (shipped in 05-02) gives us a transactional handoff: rows insert at TX commit; the Inngest event handler does the happy-path cleanup; the hourly reconciler picks up stuck rows. Cleanup must be idempotent (Supabase Storage `remove([keys])` is idempotent for missing keys per Pitfall 6), and the reconciler must use the service-role db client (no JWT in cron context per Pitfall 4).

Output:
- `src/contexts/catalog/application/delete-plant.ts` — TDD-driven use-case: ownership check → UoW (cascade + 2 pending_storage_deletions inserts) → after-commit emit + PostHog
- `src/contexts/catalog/inngest/functions.ts` — `cleanupStorage` (event handler, retries: 4) + `cleanupStorageReconciler` (hourly cron, retries: 0) + `catalogFunctions` export
- `src/contexts/catalog/domain/events.ts` — extend `PlantDeletedPayload` with `deletionRowIds: [string, string]`
- `src/shared/inngest/registry.ts` — wire up `...catalogFunctions`; update comment block 9 → 11
- Three integration test files (delete-plant, cleanupStorage, reconciler) green under `pnpm test:integration`
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-PLAN-OUTLINE.md
@CLAUDE.md

# Existing artifacts this plan extends or imports
@src/contexts/catalog/domain/events.ts
@src/contexts/catalog/infrastructure/photo-storage.ts
@src/contexts/catalog/application/upload-photo.ts
@src/contexts/notifications/inngest/functions.ts
@src/contexts/billing/inngest/functions.ts
@src/shared/inngest/client.ts
@src/shared/inngest/registry.ts
@src/shared/db/unit-of-work.ts
@src/shared/db/client.ts
@src/shared/telemetry/posthog-server.ts
@src/shared/adapters/storage.ts

<interfaces>
<!-- Contracts pulled from the codebase. Use these directly — no exploration. -->

From `src/contexts/catalog/domain/events.ts` (existing — Phase 2; EXTEND, do NOT rewrite):
```ts
export const CatalogEvents = {
  PlantCreated: "plant.created",
  PlantDeleted: "plant.deleted",
} as const;

export interface PlantDeletedPayload {
  plantId: string;
  userId: string;
  deletedAt: string;
}
```
Phase 5 extends `PlantDeletedPayload` with `deletionRowIds: [string, string]` (one entry per pending_storage_deletions row inserted in the same TX). Tuple typed `[string, string]` not `string[]` — exactly two rows, never zero, never N.

From `src/shared/inngest/client.ts:5-9`:
```ts
export const inngest = new Inngest({
  id: "folhario",
  eventKey: serverEnv.INNGEST_EVENT_KEY,
  signingKey: serverEnv.INNGEST_SIGNING_KEY,
});
```

From `src/contexts/notifications/inngest/functions.ts:14-41` (CANONICAL Inngest v4 function shape — DO NOT follow RESEARCH Pattern 5's two-arg variant; the codebase uses triggers INSIDE the config object):
```ts
const notificationsSendEmail = inngest.createFunction(
  {
    id: "notifications-send-email",
    retries: 3,
    triggers: [{ event: "notifications/email.requested" }],
  },
  async ({ event, step }) => {
    const data = event.data as NotificationsEmailRequestedPayload;
    const rendered = await step.run("render-email", async () => renderEmail(data.template, data.props));
    const result = await step.run("send-resend", async () => resendAdapter.send({ ... }));
    return { messageId: result.id };
  },
);

export const notificationsFunctions = [notificationsSendEmail, notificationsSendPush];
```

From `src/contexts/billing/inngest/functions.ts:11-14` (CANONICAL cron trigger shape):
```ts
const billingTrialEndingNotifier = inngest.createFunction(
  { id: "billing-trial-ending-notifier", triggers: [{ cron: "0 9 * * *" }] },
  async () => ({ status: "not_implemented" }),
);
```

From `src/shared/inngest/registry.ts` (existing — comment block claims "EXACTLY 9 functions" after Plan 05; this plan adds 2 making it 11. Update the comment block.):
```ts
import { iamFunctions } from "@contexts/iam/inngest/functions";
import { notificationsFunctions } from "@contexts/notifications/inngest/functions";
import { billingFunctions } from "@contexts/billing/inngest/functions";
import { remindersFunctions } from "@contexts/reminders/inngest/functions";
import { speciesCareFunctions } from "@contexts/species-care/inngest/functions";
import { identificationFunctions } from "@contexts/identification/inngest/functions";

export const registry = [
  ...iamFunctions,
  ...notificationsFunctions,
  ...billingFunctions,
  ...remindersFunctions,
  ...speciesCareFunctions,
  ...identificationFunctions,
];
```

From `src/contexts/catalog/infrastructure/photo-storage.ts:33-34, 138-148` (existing helpers):
```ts
export const PLANT_PHOTOS_BUCKET = "plant-photos";
export const PLANT_THUMBNAILS_BUCKET = "plant-thumbnails";

export async function deleteAllPlantMediaForUser(userId: string): Promise<void> {
  const adapter = getAdapter();
  const prefix = `${userId}/`;
  await adapter.deletePrefix({ bucket: PLANT_PHOTOS_BUCKET, prefix });
  await adapter.deletePrefix({ bucket: PLANT_THUMBNAILS_BUCKET, prefix });
}
```
This plan does NOT add a per-plant helper to photo-storage.ts. The Inngest function reads bucket+prefix directly from the pending_storage_deletions row and calls `getAdapter().deletePrefix({bucket, prefix})` on values it has just validated via `validateStorageDeletionPrefix` (split helper from 05-04). Single source of truth = the DB row.

From `src/shared/adapters/storage.ts:50-77` (StorageAdapter contract):
```ts
export interface DeletePrefixInput {
  bucket: string;
  /** Prefix INCLUDING any trailing slash, e.g. `${userId}/`. */
  prefix: string;
}
export interface StorageAdapter {
  deletePrefix(input: DeletePrefixInput): Promise<void>;
  /* ... */
}
```
**Pitfall 6 confirmed:** Supabase `remove([keys])` is idempotent for missing keys; `deletePrefix` therefore succeeds when re-run on an already-empty prefix. No re-existence check needed in the handler.

From `src/shared/db/unit-of-work.ts:88-103` (UoW boundary — used by delete-plant):
```ts
export async function withUnitOfWork<T>(userId: string, fn: UnitOfWorkCallback<T>): Promise<T> {
  // SET LOCAL ROLE authenticated + bind request.jwt.claim.sub then run fn
  return db.transaction(async (tx) => {
    if (!isTransactionalClient(tx)) throw new UnitOfWorkError("...");
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);
    return fn(tx);
  });
}
```
Note: there is no `tx.afterCommit` hook in Drizzle. Pattern: call `withUnitOfWork(...)` and capture its return; on resolved promise = commit happened; THEN dispatch event + PostHog. On rejection = rollback; no side effects (this is what makes the rollback test deterministic).

From `src/shared/db/client.ts` (service-role connection used by reconciler — bypasses RLS):
```ts
export const db: DbClient = drizzle(postgres(connectionString, { prepare: false }), { schema });
export type DbClient = typeof db;
```
The bare `db` runs as the connection role (`postgres`) which has BYPASSRLS. Pitfall 4: this is the correct client for cron contexts where there is no JWT.

From `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts` (built in 05-03 — repo functions consumed here):
```ts
export async function create(db: PsdDb, input: PendingStorageDeletionInsert): Promise<PendingStorageDeletionRow>;
export async function findById(db: PsdDb, id: string): Promise<PendingStorageDeletionRow | null>;
export async function markInProgress(db: PsdDb, id: string): Promise<void>; // status pending → in_progress conditional update; ALSO sets started_at = NOW() (HIGH-4 — column added in 05-02)
export async function markCompleted(db: PsdDb, id: string): Promise<void>;   // sets completed_at = NOW()
export async function recordError(db: PsdDb, id: string, errorMessage: string): Promise<void>; // bumps attempts; returns row to status='pending' when attempt_count < 5; transitions to status='failed' only when attempt_count reaches 5 (HIGH-4)
export async function markFailed(db: PsdDb, id: string): Promise<void>;       // status → failed
export async function fetchPendingBatch(db: PsdDb, limit: number): Promise<PendingStorageDeletionRow[]>; // FOR UPDATE SKIP LOCKED
```
The exact signatures come from 05-03 — at executor time, grep `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts` and import the actual exported names. If 05-03 chose different names, adapt this plan's calls accordingly (do not invent new repo functions).

From `src/contexts/catalog/infrastructure/db/plants.ts` (built in 05-03):
```ts
export async function findByIdForUser(db: PlantsDb, userId: string, plantId: string): Promise<PlantRow | null>;
export async function delete_(db: PlantsDb, plantId: string): Promise<void>; // FK cascades photo_entries + reminders
export async function getCascadeCounts(db: PlantsDb, plantId: string): Promise<{ photoEntryCount: number; reminderCount: number }>;
```
Use the cascade counts repo function (built in 05-03) BEFORE the delete to capture the PostHog payload — querying after the delete returns 0 (rows are gone). Counts read inside the same TX that performs the delete (read-then-write semantics) so they are atomic with respect to other concurrent operations.

From `src/contexts/identification/infrastructure/db/schema.ts:44`:
```ts
plantId: uuid("plant_id").references(() => plants.id, { onDelete: "set null" }),
```
**This is the only reason history is preserved.** The DELETE plant cascade fires through this FK and SETs identifications.plant_id to NULL automatically — the use-case does NOT issue an UPDATE. Verify in the integration test: an Identification row that referenced the deleted plant exists with `plantId = null` after the use-case completes.

From `src/contexts/catalog/domain/storage-paths.ts` (built in 05-04 — TWO split helpers per HIGH-5):
```ts
export function validateStorageDeletionPrefix(input: { userId: string; plantId: string; prefix: string }): void;
// Asserts prefix === `${userId}/${plantId}/` exactly. Throws validation_failed on mismatch / cross-user prefix.

export function validateStorageObjectKey(input: { userId: string; plantId: string; key: string }): void;
// Asserts key matches ^${userId}/${plantId}/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$. Throws validation_failed on mismatch.
```
The cleanup function calls `validateStorageDeletionPrefix({ userId: row.userId, plantId, prefix: row.prefix })` BEFORE every `deletePrefix` invocation. Do NOT call the old `validateStoragePathOwnership` — it has been replaced by these two split helpers. A malformed or cross-user prefix throws `validation_failed` (asserted by integration test Cycle 2C Test 2 and a new dedicated prefix-guard test).

From `src/shared/telemetry/posthog-server.ts`:
```ts
export function getPostHog(): PostHog | null;
```
Returns null when PostHog is disabled (e.g. in test env). Use `getPostHog()?.capture({ ... })` so tests where PostHog is null still pass; assert in tests by injecting a spyable PostHog client.

From inngest send pattern (existing in `src/contexts/iam/application/resend-verification.ts:43-52`):
```ts
await inngest.send({
  id: `email-verification/${tokenId}`, // idempotency key — Inngest dedupes events by id
  name: "notifications/email.requested",
  data: { /* payload */ },
});
```
For plant.deleted use `id: `plant-deleted/${plantId}`` — re-running the use-case for the same plantId would not produce duplicate events (defense in depth; the use-case itself returns NotFound when plantId is already deleted).
</interfaces>

<binding_decisions>
<!-- Decisions from 05-CONTEXT.md that constrain this plan -->
- **D-22 (cleanup architecture):** Same-TX `pending_storage_deletions` INSERT + `plant.deleted` Inngest event. The event handler runs the happy path; the reconciler picks up stuck rows. Belt + braces — durable recovery on both event-delivery gaps AND storage failures.
- **D-23 (table schema):** Status ENUM is `pending|in_progress|completed|failed`. attempts INT default 0. `started_at: timestamptz NULL` column (added in 05-02 schema patch) is set to NOW() by `markInProgress`. `(status, scheduled_at)` index drives the reconciler cursor. NO `plant_id` FK. (HIGH-4)
- **D-24 (reconciler):** Hourly cron, batch 50, `FOR UPDATE SKIP LOCKED`, max 5 attempts, backoff `5min → 30min → 4h → 24h → 72h` indexed by attempts (so attempts=0 → 5min wait, attempts=1 → 30min, etc.). After 5 attempts → status='failed'. Reconciler calls `fetchPendingBatch(50, { staleInProgressMinutes: 30 })` to also recover stale in_progress rows (started_at < NOW() - 30min). `recordError` returns row to status='pending' (not 'failed') when attempt_count < 5; only at attempt_count == 5 transitions to 'failed'. (HIGH-4)
- **D-29 (telemetry):** `plant_deleted` PostHog event MUST have `{ photo_count: int, journal_entry_count: int, reminder_count: int }` props. NO plant id, name, location, or notes.
- **PRD §4 cascade rules (closed contract):** PhotoEntry + Reminder cascade via FK ON DELETE CASCADE; Identification.plant_id ON DELETE SET NULL; storage scheduled for delete via pending_storage_deletions. The use-case does NOT issue separate DELETEs for photo_entries / reminders — the FK does that work atomically.
- **Pitfall 4 (canonical):** Reconciler uses the service-role `db` client. Cron context has no JWT; `withUnitOfWork` would deny all rows under owner-RLS.
- **Pitfall 6 (canonical):** `deletePrefix` is idempotent. Re-running cleanup on an already-empty prefix succeeds. Test it.
- **D-04 schema authority (from 05-02):** `pending_deletion_status` pgEnum values + `pending_storage_deletions` table exist in live Postgres after 05-02 ships. This plan does NOT touch schema.ts or migrations.
</binding_decisions>

<source_audit>
| Source        | Item                                                                  | Plan Coverage                                  | Status   |
|---------------|-----------------------------------------------------------------------|------------------------------------------------|----------|
| GOAL          | Catalog "Meu Jardim" — delete with cascade + storage cleanup           | Task 1 (use-case) + Tasks 2-3 (cleanup)        | COVERED  |
| REQ           | CAT-09 (delete cascade + storage scheduling + Identification.plant_id NULL) | Tasks 1-3 (this plan closes CAT-09)        | COVERED  |
| RESEARCH      | Pattern 5 — Inngest cleanup + RetryAfterError                          | Task 2                                         | COVERED  |
| RESEARCH      | Pitfall 4 — service-role client in reconciler                          | Task 3 + interface block                       | COVERED  |
| RESEARCH      | Pitfall 6 — deletePrefix idempotency                                   | Task 2 (idempotent re-run test)                | COVERED  |
| RESEARCH      | Pitfall 5 — Inngest v4 (NOT v3) function shape                         | Task 2/3 (codebase analog cited, not RESEARCH) | COVERED  |
| RESEARCH      | Don't Hand-Roll: RetryAfterError instead of Date.now() arithmetic       | Task 2 (Inngest manages retry timing)          | COVERED  |
| CONTEXT (D-22)| Same-TX inserts + event + handler                                      | Tasks 1-2                                      | COVERED  |
| CONTEXT (D-23)| Schema shape (status enum, attempts, scheduled_at)                     | (lives in 05-02 — this plan consumes)          | UPSTREAM |
| CONTEXT (D-24)| Cron cadence + batch + backoff + max attempts                          | Task 3                                         | COVERED  |
| CONTEXT (D-29)| plant_deleted props (privacy-clean counts)                             | Task 1                                         | COVERED  |
| THREAT        | T-05-06-01 prefix mis-scope                                              | Task 2 (validateStorageDeletionPrefix pre-check, HIGH-5)| COVERED  |
| THREAT        | T-05-06-02 reconciler retries leaking partial state                     | Task 2 (state machine: markInProgress conditional) | COVERED |
| THREAT        | T-05-06-03 hot loop on persistently-failing rows                        | Task 3 (max 5 + backoff; named test asserts cap)| COVERED |
| PATTERNS      | notifications/inngest/functions.ts — canonical v4 shape                | interface block                                | COVERED  |
| PATTERNS      | billing/inngest/functions.ts — canonical cron shape                    | interface block                                | COVERED  |
| VALIDATION    | Plant delete (Integration)                                             | Task 1 integration spec                        | COVERED  |
| VALIDATION    | Inngest cleanup (Integration)                                          | Task 2 integration spec                        | COVERED  |
| VALIDATION    | Nyquist reconciler (vi.useFakeTimers across backoff windows)            | Task 3 integration spec                        | COVERED  |
</source_audit>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: delete-plant use-case (TDD) — UoW cascade + 2 pending_storage_deletions inserts + after-commit event + PostHog</name>
  <files>
    src/contexts/catalog/application/delete-plant.ts
    src/contexts/catalog/domain/events.ts
    tests/integration/delete-plant.integration.test.ts
  </files>
  <behavior>
    RED→GREEN cycles, ONE per behavior assertion. Tests use Vitest integration project with the in-memory StorageAdapter (D-27 from 05-01) and the real Supabase Postgres test DB with transaction rollback (Phase 2 D-43). The Inngest client is mocked via `vi.mock("@shared/inngest/client", () => ({ inngest: { send: vi.fn() } }))`. PostHog is verified via the spy returned from a test-only PostHog factory.

    Cycle 1A — happy path:
    - Test 1: deletePlant({userId, plantId}) returns { ok: true } when the plant exists and the user owns it.
    - Test 2: After deletePlant returns, plants WHERE id = plantId returns 0 rows.
    - Test 3: After deletePlant returns, photo_entries WHERE plant_id = plantId returns 0 rows (FK cascade — the use-case does NOT issue a DELETE for photo_entries).
    - Test 4: After deletePlant returns, reminders WHERE plant_id = plantId returns 0 rows (FK cascade — same).
    - Test 5: After deletePlant returns, identifications WHERE id = identId returns 1 row with plant_id IS NULL (history preserved per src/contexts/identification/infrastructure/db/schema.ts:44; the use-case does NOT issue an UPDATE).
    - Test 6: After deletePlant returns, pending_storage_deletions returns EXACTLY 2 rows for {user_id: userId} with bucket in ('plant-photos', 'plant-thumbnails'), prefix='{userId}/{plantId}/', status='pending', attempts=0.
    - Test 7: After deletePlant returns, inngest.send was called exactly once with {id: `plant-deleted/${plantId}`, name: "plant.deleted", data: {plantId, userId, deletedAt, deletionRowIds: [psdId, ptdId]}} where deletionRowIds is the tuple of ids from the two pending_storage_deletions rows.
    - Test 8: After deletePlant returns, PostHog.capture was called exactly once with {distinctId: userId, event: "plant_deleted", properties: {photo_count: 3, journal_entry_count: 0, reminder_count: 2}} — counts come from the seed fixture (3 photo_entries with plant_id=plantId; 2 reminders) so adjust the seed to make the assertion deterministic. NO plant id, name, location, or notes in properties.

    Cycle 1B — ownership / not-found:
    - Test 1: deletePlant({userId, plantId: <other-users-plant>}) returns { ok: false, code: "not_found" } and does NOT delete the row, does NOT insert pending_storage_deletions, does NOT call inngest.send, does NOT call PostHog.capture (ownership check happens BEFORE the UoW).
    - Test 2: deletePlant({userId, plantId: <nonexistent>}) returns { ok: false, code: "not_found" } with the same no-side-effects guarantees.

    Cycle 1C — rollback determinism:
    - Test 1: Force the inner UoW to throw (e.g., monkey-patch `pendingDeletionsRepo.create` to throw on the second call). Assert: deletePlant rejects/throws, plants WHERE id = plantId returns 1 row (rollback), pending_storage_deletions WHERE prefix LIKE '%{plantId}/' returns 0 rows, inngest.send was NOT called, PostHog.capture was NOT called.

    Cross-cycle invariants asserted by static checks (grep gates in the verify command):
    - delete-plant.ts contains zero `tx.afterCommit` references (it does not exist in Drizzle — pattern is await UoW then dispatch).
    - delete-plant.ts contains zero `delete from photo_entries` or `delete from reminders` patterns (FK cascade only).
  </behavior>
  <action>
    **Step 1 — Extend the event payload (events.ts):**

    1. Open `src/contexts/catalog/domain/events.ts`.
    2. EXTEND the existing `PlantDeletedPayload` interface (do NOT remove the existing fields, do NOT remove the existing `CatalogEvents` const, do NOT remove the `PlantCreatedPayload` interface). Add the `deletionRowIds` field as a tuple-of-two:
       ```ts
       export interface PlantDeletedPayload {
         plantId: string;
         userId: string;
         deletedAt: string;
         /** Phase 5 D-22: ids of the two pending_storage_deletions rows
          *  (one for plant-photos, one for plant-thumbnails) inserted in
          *  the same TX as the plant DELETE. cleanupStorage uses these
          *  to locate the rows it must process. */
         deletionRowIds: [string, string];
       }
       ```
    3. Commit with subject `feat(05-06): extend PlantDeletedPayload with deletionRowIds tuple (D-22)`.

    **Step 2 — Drive the use-case via TDD. Each cycle = one RED commit + one GREEN commit.**

    For Cycle 1A:
    1. Create `tests/integration/delete-plant.integration.test.ts`. Set up the seed: a verified user, a plant the user owns, 3 photo_entries linked to that plant, 2 reminders linked to that plant, 1 identification linked to that plant. Mock `inngest.send` and PostHog `capture` via `vi.fn()`.
    2. Write the 8 listed tests for Cycle 1A. They MUST fail with `delete-plant.ts not found` (RED).
    3. Commit RED with subject `test(05-06): add failing tests for delete-plant happy path`.
    4. Create `src/contexts/catalog/application/delete-plant.ts`. Implementation skeleton:

       ```ts
       import { eq } from "drizzle-orm";
       import { inngest } from "@shared/inngest/client";
       import { withUnitOfWork } from "@shared/db/unit-of-work";
       import { db } from "@shared/db/client";
       import { getPostHog } from "@shared/telemetry/posthog-server";
       import { ErrorCode } from "@shared/config/errors";
       import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
       import * as pendingDeletionsRepo from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
       import {
         PLANT_PHOTOS_BUCKET,
         PLANT_THUMBNAILS_BUCKET,
       } from "@contexts/catalog/infrastructure/photo-storage";
       import type { PlantDeletedPayload } from "@contexts/catalog/domain/events";

       export interface DeletePlantInput {
         userId: string;
         plantId: string;
       }

       export type DeletePlantResult =
         | { ok: true }
         | { ok: false; code: typeof ErrorCode.NotFound; reason: string };

       export async function deletePlant(input: DeletePlantInput): Promise<DeletePlantResult> {
         // Ownership check OUTSIDE UoW (read-only; matches upload-photo pattern).
         const plant = await plantsRepo.findByIdForUser(db, input.userId, input.plantId);
         if (!plant) {
           return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
         }

         const prefix = `${input.userId}/${input.plantId}/`;
         const deletedAt = new Date().toISOString();

         // UoW TX: read cascade counts (BEFORE delete) → DELETE plant (FK cascades) → INSERT 2 pending rows.
         const { photoCount, reminderCount, deletionRowIds } = await withUnitOfWork(
           input.userId,
           async (tx) => {
             const counts = await plantsRepo.getCascadeCounts(tx, input.plantId);
             // Issue the DELETE; FK cascades handle photo_entries + reminders;
             // identifications.plant_id is set NULL by ON DELETE SET NULL.
             await plantsRepo.delete_(tx, input.plantId);
             const psdRow = await pendingDeletionsRepo.create(tx, {
               userId: input.userId,
               bucket: PLANT_PHOTOS_BUCKET,
               prefix,
             });
             const ptdRow = await pendingDeletionsRepo.create(tx, {
               userId: input.userId,
               bucket: PLANT_THUMBNAILS_BUCKET,
               prefix,
             });
             return {
               photoCount: counts.photoEntryCount,
               reminderCount: counts.reminderCount,
               deletionRowIds: [psdRow.id, ptdRow.id] as [string, string],
             };
           },
         );

         // After-commit dispatch. UoW resolved => TX committed => safe to fire side effects.
         const eventPayload: PlantDeletedPayload = {
           plantId: input.plantId,
           userId: input.userId,
           deletedAt,
           deletionRowIds,
         };
         await inngest.send({
           id: `plant-deleted/${input.plantId}`,
           name: "plant.deleted",
           data: eventPayload,
         });

         getPostHog()?.capture({
           distinctId: input.userId,
           event: "plant_deleted",
           properties: {
             photo_count: photoCount,
             journal_entry_count: 0, // Phase 5 has no journal_entries surface — photo_entries IS the journal; D-29 leaves a slot for Phase 7+ if it splits
             reminder_count: reminderCount,
           },
         });

         return { ok: true };
       }
       ```
       Note on `journal_entry_count`: per D-29 the property name is `journal_entry_count`. In Phase 5 the photo journal IS the photo_entries surface, and D-29 also lists `photo_count` separately. The split is intentional (Phase 7+ may add journal entries that are NOT photos). For Phase 5 set `journal_entry_count: 0`. This is the only D-29 property whose value is hard-coded; document this in a comment.
    5. Run `pnpm test:integration -- delete-plant`. Tests 1-7 should pass. Test 8 may fail on PostHog assertion if the test does not inject a spy — adjust the test to use the existing PostHog test harness (grep `tests/integration/` for `posthog` to find the Phase 4 pattern and reuse it).
    6. Commit GREEN with subject `feat(05-06): implement delete-plant happy path (D-22, CAT-09)`.

    For Cycle 1B (ownership / not-found):
    1. Add the 2 listed tests to the same file.
    2. Run — they should already pass (the ownership check is in place from 1A). If not, adjust.
    3. Commit `test(05-06): add ownership tests for delete-plant`.

    For Cycle 1C (rollback):
    1. Add the listed test using `vi.spyOn(pendingDeletionsRepo, "create").mockImplementationOnce(/* first call passes */).mockImplementationOnce(() => { throw new Error("simulated"); })` so the first INSERT succeeds and the second throws — the entire TX rolls back.
    2. Run — should already pass (Drizzle's `db.transaction` propagates rollback). If not, the spy must be reset between tests.
    3. Commit `test(05-06): add rollback test for delete-plant (atomic side effects)`.

    **Step 3 — Refactor (only if needed). Do NOT change behavior; preserve TX boundaries.**

    Final commit: `refactor(05-06): tidy delete-plant call sites` (skip if no refactor needed).
  </action>
  <verify>
    <automated>
      pnpm test:integration -- delete-plant
      &&
      grep -c "tx\\.afterCommit" src/contexts/catalog/application/delete-plant.ts | grep -E "^0$"
      &&
      grep -v '^\s*//' src/contexts/catalog/application/delete-plant.ts | grep -ci "delete from photo_entries\\|delete from reminders" | grep -E "^0$"
      &&
      grep -c 'name: "plant.deleted"' src/contexts/catalog/application/delete-plant.ts | grep -E "^1$"
      &&
      grep -c 'event: "plant_deleted"' src/contexts/catalog/application/delete-plant.ts | grep -E "^1$"
      &&
      grep -c "deletionRowIds" src/contexts/catalog/domain/events.ts | grep -E "^[1-9]"
    </automated>
  </verify>
  <done>
    - tests/integration/delete-plant.integration.test.ts is green under `pnpm test:integration`.
    - delete-plant.ts contains the use-case and exports `deletePlant`, `DeletePlantInput`, `DeletePlantResult`.
    - events.ts extends `PlantDeletedPayload` with `deletionRowIds: [string, string]`; existing exports preserved.
    - No `tx.afterCommit` references (does not exist in Drizzle).
    - No raw `delete from photo_entries` or `delete from reminders` in delete-plant.ts (FK cascade only).
    - inngest.send is called exactly once after the UoW commit; PostHog.capture is called exactly once with privacy-clean props (D-29).
    - Three commits: extend events.ts; RED tests; GREEN implementation. (Plus optional refactor commit and ownership/rollback test commits.)
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: cleanupStorage Inngest event handler (TDD) — RetryAfterError, idempotent prefix-delete, state machine transitions</name>
  <files>
    src/contexts/catalog/inngest/functions.ts
    tests/integration/cleanup-storage.integration.test.ts
  </files>
  <behavior>
    RED→GREEN cycles for the event-handler half of D-22. The reconciler ships in Task 3. Tests use the real Postgres test DB + InMemoryStorageAdapter (D-27). Inngest function execution is invoked directly via the function's exported callable (Inngest v4 functions expose `cleanupStorage.handler` or via the `step.run` proxy — use the project's existing Inngest test pattern; grep `tests/integration/` for `step.run` or `inngest` test utilities and reuse).

    Cycle 2A — happy path:
    - Test 1: Given a pending_storage_deletions row {bucket: 'plant-photos', prefix: 'u1/p1/', status: 'pending', attempts: 0} and the in-memory adapter has 3 objects under that prefix, invoke cleanupStorage with event {data: {plantId: 'p1', userId: 'u1', deletionRowIds: [<this-row-id>, <other-row-id>]}}. Assert: adapter.deletePrefix was called with {bucket: 'plant-photos', prefix: 'u1/p1/'}; row status='completed'; completed_at is non-null.
    - Test 2: Given two pending rows (one per bucket) referenced in deletionRowIds, the handler processes BOTH (calls deletePrefix twice with different bucket arguments) within the same handler invocation; both rows end status='completed'.

    Cycle 2B — idempotency (Pitfall 6):
    - Test 1: Given a row whose prefix has already been emptied (in-memory adapter has 0 objects under prefix), the handler completes successfully and sets status='completed'. No errors thrown.
    - Test 2: Re-running the handler on a row that is ALREADY status='completed' is a no-op: status stays 'completed', adapter.deletePrefix is NOT called a second time, completed_at is unchanged. (Implementation: `markInProgress` is conditional on current status='pending'; for already-'completed' rows it skips processing.)

    Cycle 2C — failure paths:
    - Test 1: Given an adapter that throws on `deletePrefix`, the handler calls `pendingDeletionsRepo.recordError(rowId, message)` AND throws RetryAfterError so Inngest reschedules. Assert: row attempts incremented from 0 to 1; last_error contains the thrown message; error type is RetryAfterError.
    - Test 2: T-05-06-01 prefix mis-scope guard: given a row with a malformed prefix (e.g., `prefix: 'OTHERUSER/p1/'` while userId in event is 'u1'), `validateStorageDeletionPrefix({ userId: row.userId, plantId, prefix: row.prefix })` throws `validation_failed` BEFORE any adapter mutation; row status stays 'pending'; adapter.deletePrefix was NOT called. (HIGH-5)
    - Test 3: T-05-06-02 state machine guard: invoking the handler concurrently for the same row (two parallel handler calls) — only one succeeds in transitioning to 'in_progress'; the other observes a row that is already 'in_progress' or 'completed' and skips. (markInProgress is conditional via SQL UPDATE ... WHERE status='pending' RETURNING; the test uses two awaited promises.)

    Cross-cycle invariants:
    - `inngest.createFunction` config object contains `id: "catalog/cleanup-storage"`, `retries: 4`, `triggers: [{ event: "plant.deleted" }]` — exactly matching the canonical notifications/inngest/functions.ts shape (per Pitfall 5).
    - cleanupStorage MUST call validateStorageDeletionPrefix (from 05-04 split helpers) before deletePrefix — NOT the old validateStoragePathOwnership.
  </behavior>
  <action>
    **Step 1 — RED: write failing tests for Cycles 2A, 2B, 2C in `tests/integration/cleanup-storage.integration.test.ts`.**

    Set up the test harness:
    - Seed users + plants where appropriate.
    - Insert pending_storage_deletions rows directly via the repo (bypassing delete-plant for unit-of-work isolation).
    - Mock or use the in-memory StorageAdapter from D-27.
    - Invoke the cleanupStorage function. The exact invocation pattern depends on the Inngest test utilities — at write time, grep `tests/integration/` and `tests/unit/` for any existing Inngest function tests (e.g., notifications-send-email tests). If none exist, call the handler function directly: extract the second argument from `inngest.createFunction(config, handler)` and call `handler({ event, step: makeFakeStep() })` where `makeFakeStep()` returns `{ run: async (_name, fn) => fn() }`.

    Commit RED tests with subject: `test(05-06): add failing tests for cleanupStorage handler`.

    **Step 2 — GREEN: implement `cleanupStorage` in `src/contexts/catalog/inngest/functions.ts`.**

    Skeleton (file does NOT yet exist; this is its initial creation):

    ```ts
    // Phase 5 D-22 / D-24 — catalog storage cleanup pipeline.
    // Belt + braces: cleanupStorage handles the happy path on plant.deleted
    // events (retries: 4); cleanupStorageReconciler (Task 3) is the
    // recovery layer that picks up rows stuck in 'pending'.
    import { RetryAfterError } from "inngest";
    import { db } from "@shared/db/client";
    import { inngest } from "@shared/inngest/client";
    import * as pendingDeletionsRepo from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
    import { validateStorageDeletionPrefix } from "@contexts/catalog/domain/storage-paths";
    import { __getStorageAdapterForCleanup } from "@contexts/catalog/infrastructure/photo-storage";
    import type { PlantDeletedPayload } from "@contexts/catalog/domain/events";

    const cleanupStorage = inngest.createFunction(
      {
        id: "catalog/cleanup-storage",
        retries: 4,
        triggers: [{ event: "plant.deleted" }],
      },
      async ({ event, step }) => {
        const data = event.data as PlantDeletedPayload;

        for (const rowId of data.deletionRowIds) {
          await step.run(`process-${rowId}`, async () => {
            // 1. Mark in-progress conditionally (guards T-05-06-02).
            //    markInProgress is a conditional UPDATE: WHERE status='pending';
            //    rowsAffected===0 means another worker already grabbed it OR it is already completed.
            const row = await pendingDeletionsRepo.findById(db, rowId);
            if (!row) return; // row was deleted (shouldn't happen, but defensive)
            if (row.status === "completed") return; // idempotent re-run
            if (row.status === "failed") return;    // terminal — cleanup pipeline gives up

            const transitioned = await pendingDeletionsRepo.markInProgress(db, rowId);
            if (!transitioned) return; // another worker won the race; let them finish

            // 2. Defensive ownership check on the prefix shape (T-05-06-01).
            //    Validate against the row's user_id, NOT the event's userId
            //    (so a tampered event cannot redirect the delete to a foreign prefix).
            try {
              validateStorageDeletionPrefix({
                userId: row.userId,
                plantId: data.plantId,
                prefix: row.prefix,
              });
            } catch (err) {
              await pendingDeletionsRepo.recordError(db, rowId, `path validation failed: ${String(err)}`);
              throw err; // halt pipeline; do not retry — this is a programming/security error, not a transient failure
            }

            // 3. Idempotent prefix-delete (Pitfall 6). Supabase returns success for missing keys.
            try {
              await __getStorageAdapterForCleanup().deletePrefix({
                bucket: row.bucket,
                prefix: row.prefix,
              });
            } catch (err) {
              await pendingDeletionsRepo.recordError(db, rowId, String(err));
              // RetryAfterError tells Inngest to wait before retrying.
              // Inngest's per-function retry policy (retries: 4) ultimately gives up if storage is persistently down;
              // the reconciler (Task 3) will pick the row up later.
              throw new RetryAfterError("storage delete failed", "5m");
            }

            // 4. Mark completed.
            await pendingDeletionsRepo.markCompleted(db, rowId);
          });
        }

        return { processed: data.deletionRowIds.length };
      },
    );

    export const catalogFunctions = [cleanupStorage];
    // Task 3 will append cleanupStorageReconciler to this array.
    ```

    Notes:
    - `__getStorageAdapterForCleanup` is the existing test seam from `photo-storage.ts` — re-exported under that name OR inlined as `getAdapter()` already exposed. Confirm at write time and prefer the existing public API.
    - This handler uses the bare `db` (NOT withUnitOfWork). It runs on rows owned by various users — there is no single userId for the JWT GUC binding. The repo functions accept `db` directly and rely on the BYPASSRLS default of the connection role.

    Run `pnpm test:integration -- cleanup-storage`. Iterate until Cycle 2A and 2B pass.

    Commit GREEN with subject: `feat(05-06): implement cleanupStorage Inngest handler (D-22)`.

    **Step 3 — Implement Cycle 2C failure paths.**

    The skeleton already covers them; if tests fail, adjust the order of `recordError` vs `throw` so attempts increment correctly. Commit any iteration as `fix(05-06): adjust cleanupStorage failure path`.

    **Step 4 — Final RED→GREEN for the inngest.createFunction shape invariant:**

    Add a unit test (or extend the integration test file) that imports cleanupStorage and asserts:
    - `cleanupStorage.id === "catalog/cleanup-storage"`
    - `cleanupStorage.opts.retries === 4` (or whatever Inngest exposes; if internals are private, use a regex grep on the file source).

    Commit `test(05-06): pin cleanupStorage config invariants`.
  </action>
  <verify>
    <automated>
      pnpm test:integration -- cleanup-storage
      &&
      grep -c 'id: "catalog/cleanup-storage"' src/contexts/catalog/inngest/functions.ts | grep -E "^1$"
      &&
      grep -c "retries: 4" src/contexts/catalog/inngest/functions.ts | grep -E "^1$"
      &&
      grep -c 'event: "plant.deleted"' src/contexts/catalog/inngest/functions.ts | grep -E "^1$"
      &&
      grep -c "validateStorageDeletionPrefix" src/contexts/catalog/inngest/functions.ts | grep -E "^[1-9]"
      &&
      grep -c "RetryAfterError" src/contexts/catalog/inngest/functions.ts | grep -E "^[1-9]"
      &&
      grep -v '^\s*//' src/contexts/catalog/inngest/functions.ts | grep -c "withUnitOfWork" | grep -E "^0$"
    </automated>
  </verify>
  <done>
    - tests/integration/cleanup-storage.integration.test.ts green under `pnpm test:integration` (all 7+ cases across 2A/2B/2C), including the new prefix-guard test: a row with a malformed/cross-user prefix throws validation_failed before any adapter call.
    - functions.ts exports `catalogFunctions = [cleanupStorage]`.
    - cleanupStorage calls `validateStorageDeletionPrefix({ userId, plantId, prefix })` (from 05-04's split helpers) BEFORE any deletePrefix call — NOT the old `validateStoragePathOwnership`.
    - cleanupStorage throws `RetryAfterError` on transient storage failure.
    - cleanupStorage uses bare `db` (no `withUnitOfWork`) — Pitfall 4.
    - Idempotent: re-running on a 'completed' row is a no-op.
    - HIGH-2 contract documented: the catalog page's delete-plant mutation onSuccess (in 05-16's PlantProfile or the catalog grid) MUST call `if ('caches' in window) { const c = await caches.open('folhario-catalog-api-v1'); await Promise.all([c.delete(\`/api/v1/plants/\${plantId}\`), c.delete('/api/v1/plants')]); }` — grep-verifiable by presence of `folhario-catalog-api-v1` in the relevant client mutation file.
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 3: cleanupStorageReconciler hourly cron (TDD) — backoff state machine, max 5 attempts, registry wiring</name>
  <files>
    src/contexts/catalog/inngest/functions.ts
    src/shared/inngest/registry.ts
    tests/integration/cleanup-storage-reconciler.integration.test.ts
  </files>
  <behavior>
    RED→GREEN cycles for the cron-driven recovery half of D-24. Tests use `vi.useFakeTimers()` to advance the clock past each backoff window deterministically. The reconciler invocation is direct (same pattern as Task 2 — extract handler from `inngest.createFunction(config, handler)`).

    Cycle 3A — happy path under cron:
    - Test 1: Seed 3 rows status='pending', scheduled_at=NOW(), attempts=0. Invoke reconciler. Assert: all 3 rows transition to 'completed'; adapter.deletePrefix called 3 times.
    - Test 2: Batch limit — seed 60 rows, invoke reconciler, assert 50 rows are processed in this invocation (FOR UPDATE SKIP LOCKED limits batch via the repo's fetchPendingBatch(50, { staleInProgressMinutes: 30 })). Remaining 10 are picked up on the next tick.
    - Test 3: Stale in_progress recovery — insert a row with status='in_progress' and started_at = NOW() - INTERVAL '45 minutes'. Invoke reconciler. Assert: the row is picked up (staleInProgressMinutes=30 threshold exceeded), processed, and transitions to 'completed'. (HIGH-4)

    Cycle 3B — backoff schedule:
    - Test 1 (attempts=0 → wait 5min): Seed row attempts=0 with last error injected, scheduled_at = NOW(). Invoke reconciler IMMEDIATELY: nothing happens (waiting on backoff window — but actually, attempts=0 is initial state; backoff applies AFTER an attempt. Re-read D-24: "Backoff: 5min → 30min → 4h → 24h → 72h" indexed by attempts (0-indexed). So attempts=0 means "first attempt — process immediately"; attempts=1 means "second attempt — wait 5min from scheduled_at"; etc.). Adjust the test to seed attempts=1, scheduled_at = NOW(), and assert: invocation BEFORE 5min advance does nothing; invocation AFTER advancing fake clock by 5min processes the row.
    - Test 2 (attempts=2 → wait 30min): seed attempts=2, scheduled_at = NOW(); advance vi clock by 29min — no processing; advance by 1 more min (30min total) — processed.
    - Test 3 (attempts=3 → wait 4h): same shape with 4*60min advance.
    - Test 4 (attempts=4 → wait 24h): same shape with 24*60min advance.
    - Test 5 (attempts=5 → terminal): seed attempts=5, status='pending'. Invoke reconciler. Assert: row transitions to status='failed'; adapter.deletePrefix is NOT called; (T-05-06-03 mitigation) the loop exits without retrying.

    Cycle 3C — service-role / BYPASSRLS proof (Pitfall 4):
    - Test 1: Seed pending rows owned by 2 different users (u1, u2). Invoke reconciler ONCE. Assert: BOTH users' rows are processed in the single invocation. (If the reconciler used withUnitOfWork it could only process one user's rows per invocation. This test is the canonical proof of Pitfall 4 mitigation.)

    Cycle 3D — registry wiring:
    - Test 1: Import `registry` from `@shared/inngest/registry` and `catalogFunctions` from `@contexts/catalog/inngest/functions`. Assert: `registry.length === 11` (was 9 before this plan; +2 from this plan). Assert: every function in `catalogFunctions` appears in `registry`.

    Cross-cycle invariants:
    - cleanupStorageReconciler config: `id: "catalog/cleanup-storage-reconciler"`, `retries: 0`, `triggers: [{ cron: "0 * * * *" }]` (hourly).
    - reconciler uses bare `db` (BYPASSRLS), NOT withUnitOfWork.
    - reconciler calls `pendingDeletionsRepo.fetchPendingBatch(db, 50, { staleInProgressMinutes: 30 })` — signature owned by 05-03. (HIGH-4)
    - `BACKOFF_MINUTES` array contains `[0, 5, 30, 240, 1440, 4320]` (index 0 = first attempt = no wait; index 1 = 5min after first failure; etc.) OR `[5, 30, 240, 1440, 4320]` (one-liner without the leading zero). Lock the convention in the implementation comment.
  </behavior>
  <action>
    **Step 1 — RED for Cycle 3A: write failing tests.**

    Create `tests/integration/cleanup-storage-reconciler.integration.test.ts`. Use the same Inngest handler-invocation pattern as Task 2.

    Use `vi.useFakeTimers()` in `beforeEach` and `vi.useRealTimers()` in `afterEach`. Advance with `vi.advanceTimersByTime(ms)` AND also call `vi.setSystemTime(new Date(Date.now() + ms))` because the SQL `NOW()` does NOT advance with fake timers — instead, control NOW() via the seed's `scheduled_at` field directly: set `scheduled_at = new Date(Date.now() - 5*60*1000)` to simulate "5 min ago" and assert the reconciler DOES process it.

    For each test, seed pending rows directly via the repo, then call the handler.

    Commit RED with subject: `test(05-06): add failing tests for cleanupStorageReconciler`.

    **Step 2 — GREEN for Cycle 3A + 3B + 3C: extend `functions.ts` with the reconciler.**

    Append to the existing `src/contexts/catalog/inngest/functions.ts`:

    ```ts
    // Phase 5 D-24 — recovery cron. Hourly, batch 50, max 5 attempts,
    // backoff 5m → 30m → 4h → 24h → 72h. Service-role db client (Pitfall 4).
    const BACKOFF_MINUTES = [5, 30, 4 * 60, 24 * 60, 72 * 60] as const;
    const MAX_ATTEMPTS = 5;

    const cleanupStorageReconciler = inngest.createFunction(
      {
        id: "catalog/cleanup-storage-reconciler",
        retries: 0, // recovery layer; failure of one tick = next tick handles it
        triggers: [{ cron: "0 * * * *" }],
      },
      async ({ step }) => {
        await step.run("reconcile-batch", async () => {
          // Service-role client (Pitfall 4): cron has no JWT; BYPASSRLS reads all users' rows.
          const rows = await pendingDeletionsRepo.fetchPendingBatch(db, 50, { staleInProgressMinutes: 30 }); // HIGH-4: also recovers stale in_progress rows (started_at < NOW() - 30min)

          for (const row of rows) {
            // Terminal: surface in OBS-05 (Phase 13).
            if (row.attempts >= MAX_ATTEMPTS) {
              await pendingDeletionsRepo.markFailed(db, row.id);
              continue;
            }

            // Backoff window check: from scheduled_at + BACKOFF_MINUTES[attempts-1].
            // attempts=0 is the first attempt — no wait, scheduled_at is creation time.
            // attempts=1 means one failure has occurred; wait BACKOFF_MINUTES[0] = 5min from scheduled_at.
            const waitMin = row.attempts === 0 ? 0 : BACKOFF_MINUTES[row.attempts - 1];
            const readyAt = new Date(row.scheduledAt).getTime() + waitMin * 60 * 1000;
            if (Date.now() < readyAt) continue;

            // markInProgress is conditional (T-05-06-02).
            const transitioned = await pendingDeletionsRepo.markInProgress(db, row.id);
            if (!transitioned) continue;

            try {
              validateStorageDeletionPrefix({
                userId: row.userId,
                plantId: extractPlantIdFromPrefix(row.prefix),
                prefix: row.prefix,
              });
              await __getStorageAdapterForCleanup().deletePrefix({
                bucket: row.bucket,
                prefix: row.prefix,
              });
              await pendingDeletionsRepo.markCompleted(db, row.id);
            } catch (err) {
              await pendingDeletionsRepo.recordError(db, row.id, String(err));
              // No throw — the cron processes the next row. The next tick re-evaluates this row.
            }
          }

          return { processedCount: rows.length };
        });
      },
    );

    function extractPlantIdFromPrefix(prefix: string): string {
      // Prefix shape: `${userId}/${plantId}/`. Split on '/' and take the second segment.
      const parts = prefix.split("/").filter((s) => s.length > 0);
      if (parts.length < 2) {
        throw new Error(`malformed prefix: ${prefix}`);
      }
      return parts[1];
    }

    // Update the export array (was [cleanupStorage] in Task 2):
    export const catalogFunctions = [cleanupStorage, cleanupStorageReconciler];
    ```

    Note: `extractPlantIdFromPrefix` is local to functions.ts because the validator needs a plantId argument but the row only stores the full prefix. The function is small and tested implicitly via the validator's reject-malformed-prefix tests in 05-04. If needed, expose a similar parser from `domain/storage-paths.ts` instead — at write time prefer the route that creates the least new surface.

    Run `pnpm test:integration -- cleanup-storage-reconciler`. Iterate until Cycle 3A, 3B, 3C all green.

    Commit GREEN: `feat(05-06): implement cleanupStorageReconciler hourly cron (D-24)`.

    **Step 3 — Wire up the registry (Cycle 3D).**

    Open `src/shared/inngest/registry.ts`. Replace lines 1-13 (the existing comment block) with the updated count and add the catalog import + spread:

    ```ts
    // Phase 4 D-17: each context exports its array; this file concatenates.
    // After Plan 05 ships, the registry contains EXACTLY 11 functions = 8 PRD §3 MVP +
    // 1 Phase-4 add per D-11 + 2 Phase-5 catalog functions per D-22/D-24:
    //   notifications/send-email (real, Plan 05 — Phase 4)
    //   notifications/send-push (stub)
    //   care-guide/augment (stub)
    //   iam/process-deletion (stub)
    //   iam/generate-export (stub)
    //   iam/password-reset-requested (stub here in Plan 04 → real impl in Plan 08)
    //   billing/process-webhook (stub)
    //   billing/trial-ending-notifier (stub)
    //   reminders/dispatch (stub)
    //   catalog/cleanup-storage (real, Phase 5 Plan 05-06 — D-22)
    //   catalog/cleanup-storage-reconciler (real, Phase 5 Plan 05-06 — D-24)
    import { iamFunctions } from "@contexts/iam/inngest/functions";
    import { notificationsFunctions } from "@contexts/notifications/inngest/functions";
    import { billingFunctions } from "@contexts/billing/inngest/functions";
    import { remindersFunctions } from "@contexts/reminders/inngest/functions";
    import { speciesCareFunctions } from "@contexts/species-care/inngest/functions";
    import { identificationFunctions } from "@contexts/identification/inngest/functions";
    import { catalogFunctions } from "@contexts/catalog/inngest/functions";

    export const registry = [
      ...iamFunctions,
      ...notificationsFunctions,
      ...billingFunctions,
      ...remindersFunctions,
      ...speciesCareFunctions,
      ...identificationFunctions,
      ...catalogFunctions,
    ];
    ```

    Add Cycle 3D registry-wiring tests, run, and commit `feat(05-06): register catalog Inngest functions (registry 9 → 11)`.

    **Step 4 — Optional refactor.** Move `extractPlantIdFromPrefix` to `domain/storage-paths.ts` if it improves clarity. Skip if the local helper is fine.
  </action>
  <verify>
    <automated>
      pnpm test:integration -- cleanup-storage-reconciler
      &&
      grep -c 'id: "catalog/cleanup-storage-reconciler"' src/contexts/catalog/inngest/functions.ts | grep -E "^1$"
      &&
      grep -c 'cron: "0 \* \* \* \*"' src/contexts/catalog/inngest/functions.ts | grep -E "^1$"
      &&
      grep -c "retries: 0" src/contexts/catalog/inngest/functions.ts | grep -E "^1$"
      &&
      grep -c "MAX_ATTEMPTS" src/contexts/catalog/inngest/functions.ts | grep -E "^[1-9]"
      &&
      grep -c "BACKOFF_MINUTES" src/contexts/catalog/inngest/functions.ts | grep -E "^[1-9]"
      &&
      grep -c "fetchPendingBatch" src/contexts/catalog/inngest/functions.ts | grep -E "^1$"
      &&
      grep -c "staleInProgressMinutes" src/contexts/catalog/inngest/functions.ts | grep -E "^[1-9]"
      &&
      grep -v '^\s*//' src/contexts/catalog/inngest/functions.ts | grep -c "withUnitOfWork" | grep -E "^0$"
      &&
      grep -c "catalogFunctions" src/shared/inngest/registry.ts | grep -E "^[2-9]"
      &&
      grep -c "EXACTLY 11 functions" src/shared/inngest/registry.ts | grep -E "^1$"
    </automated>
  </verify>
  <done>
    - tests/integration/cleanup-storage-reconciler.integration.test.ts green under `pnpm test:integration`. Specifically: Cycle 3B test 5 (attempts=5 → status='failed') passes — this is the named test that mitigates T-05-06-03 hot-loop. Cycle 3A Test 3 (stale in_progress with started_at 45min ago is recovered) passes — HIGH-4 reconciler stale recovery.
    - functions.ts now exports `catalogFunctions = [cleanupStorage, cleanupStorageReconciler]`.
    - reconciler uses bare `db` (no `withUnitOfWork`) — Pitfall 4.
    - registry.ts imports catalogFunctions and includes it in the registry; comment block updated to "EXACTLY 11 functions" with the two new catalog entries listed.
    - Phase requirement CAT-09 closes after this task: cascade + storage scheduling + Identification.plant_id NULL all proven by integration tests, and the durable cleanup pipeline (event handler + reconciler) is wired and tested.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → API (DELETE /api/v1/plants/:id) | Authenticated user input crosses into the use-case in plan 05-09 (route handler) — this plan owns the application/Inngest layer downstream of that boundary. |
| Use-case → Inngest event bus | After-commit dispatch carries trusted application-derived payload across the durable boundary; consumers must re-validate. |
| Inngest worker → Storage adapter | Cleanup function reads bucket+prefix from the database row (trusted source) and applies them to a service-role storage adapter. The validator gate sits on this boundary. |
| Cron → Database (BYPASSRLS) | Reconciler bypasses RLS to read across users — must NOT pass user-derived input to mutations. Prefix derived solely from row contents. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-06-01 | E (Elevation) / I (Information Disclosure) | cleanupStorage handler — prefix read from event payload could be spoofed/redirected to a foreign user's prefix | mitigate | Function reads `userId` and `prefix` ONLY from the `pending_storage_deletions` row referenced by `deletionRowIds`, never directly from the event payload. `validateStorageDeletionPrefix({ userId: row.userId, plantId, prefix: row.prefix })` (split helper from 05-04) is called BEFORE every `deletePrefix` invocation. A malformed or cross-user prefix throws `validation_failed`. Asserted by `tests/integration/cleanup-storage.integration.test.ts` Cycle 2C Test 2. (HIGH-5) |
| T-05-06-02 | T (Tampering) / R (Repudiation) | Concurrent reconciler ticks racing the event handler over the same row → double-delete attempts and inconsistent state | mitigate | `pendingDeletionsRepo.markInProgress(db, rowId)` is a conditional UPDATE (`SET status='in_progress' WHERE id=$1 AND status='pending' RETURNING id`); only the worker that wins the conditional update proceeds. Already-`completed` and `failed` rows are no-ops. Asserted by Cycle 2C Test 3 + the `FOR UPDATE SKIP LOCKED` semantics of `fetchPendingBatch`. |
| T-05-06-03 | D (Denial of Service) | Reconciler hot-loop on a persistently-failing row consumes Inngest cron budget | mitigate | `MAX_ATTEMPTS = 5`. After the 5th attempt the reconciler transitions the row to `status='failed'` (terminal). Asserted by `tests/integration/cleanup-storage-reconciler.integration.test.ts` Cycle 3B Test 5. Failed rows surface in OBS-05 alert (Phase 13). |
| T-05-06-04 | I (Information Disclosure) | PostHog `plant_deleted` event leaking plant identifiers/PII | mitigate | Event captures only `{photo_count, journal_entry_count, reminder_count}` per D-29 — no plantId, name, location, notes, or coverPhotoUrl. Asserted by Cycle 1A Test 8 of `delete-plant.integration.test.ts`. |
| T-05-06-05 | T (Tampering) | Inngest event delivery duplication (network retry) → duplicate cleanup attempts | mitigate | Event sent with `id: \`plant-deleted/${plantId}\`` — Inngest dedupes by id. Handler is idempotent (state-machine guards); duplicates are no-ops. |

`block_on_high: true` per ASVS L1. Every threat above is `mitigate` (no `accept`).
</threat_model>

<verification>
After all three tasks complete, run the integrated verification:

```bash
pnpm test:integration -- delete-plant cleanup-storage cleanup-storage-reconciler
```

Sanity-check the full registry:
```bash
node -e "import('./src/shared/inngest/registry.ts').then(m => console.log(m.registry.length))"
# expect: 11
```

If `pnpm test:run` is feasible end-to-end (depends on Phase 5 schema being migrated via 05-02), run it. Otherwise individual test invocations are sufficient.
</verification>

<success_criteria>
- CAT-09 closes: deletion cascade + storage scheduling + Identification.plant_id NULL behaviors are proven by green integration tests.
- `pnpm test:integration` is green for all three new test files.
- `src/shared/inngest/registry.ts` exports a registry of length 11; comment block lists `catalog/cleanup-storage` and `catalog/cleanup-storage-reconciler`.
- No `withUnitOfWork` references inside `src/contexts/catalog/inngest/functions.ts` (Pitfall 4 enforced).
- No raw `delete from photo_entries` or `delete from reminders` inside `delete-plant.ts` (FK cascade only).
- `validateStorageDeletionPrefix` (from 05-04 split helpers) is called before EVERY `deletePrefix` call inside the Inngest functions.
- The delete-plant mutation onSuccess in the client page contains `folhario-catalog-api-v1` to purge the SW cache entries for the deleted plant — grep-verifiable. (HIGH-2)
- All STRIDE threats T-05-06-01..05 have `mitigate` disposition with cited tests.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-06-SUMMARY.md` summarizing:
- The use-case contract (input/output/result shape)
- The Inngest function ids + triggers + retry policy
- Registry size delta (9 → 11) with the two new function ids
- The cascade contract (FK-driven, NOT use-case-issued DELETEs)
- The Pitfall 4 / Pitfall 6 confirmations and where the tests assert them
- Any deviations from this plan (e.g., `extractPlantIdFromPrefix` location)
</output>
