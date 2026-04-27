---
phase: 05-catalog-meu-jardim
plan: 06
type: execute
wave: 2
depends_on:
  - 05-01
  - 05-02
  - 05-03
  - 05-04
  # PHASE-2-DEPENDENCY: requires Phase 2 plans 02-05 (UoW), 02-08 (StorageAdapter at @shared/adapters/storage with deleteMany method).
  # PHASE-4-DEPENDENCY: BLOCKS execution. Phase 4 ships @shared/events/inngest-client (the inngest singleton with .send() and .createFunction()). If Phase 4 has not landed when 05-06 executes, the executor MUST add a defensive stub at @shared/events/inngest-client.ts that mirrors the expected API surface and emit a warning. This plan documents the contract Phase 4 must satisfy.
files_modified:
  - src/contexts/catalog/application/delete-plant.ts
  - src/contexts/catalog/inngest/cleanup-storage.ts
  - src/contexts/catalog/inngest/reconcile-deletions.ts
  - tests/unit/contexts/catalog/delete-plant.test.ts
  - tests/unit/contexts/catalog/inngest/cleanup-storage.test.ts
  - tests/unit/contexts/catalog/inngest/reconcile-deletions.test.ts
  - tests/integration/catalog/delete-plant-atomic.integration.test.ts
  - tests/integration/catalog/reconcile-pending-deletions.integration.test.ts
autonomous: true
requirements:
  - CAT-09
  - OFF-08
decisions:
  resolves_open_question_q2: "Reconciler placement — Phase 5 owns `catalog/reconcile-deletions` LOCALLY as an Inngest cron (every 5 minutes), defensive default. CONTEXT D-04 fallback path: if Phase 4 ships a generic outbox dispatcher later, this reconciler can be retired in a follow-up. Until then, Phase 5 owns the cron. This plan ships it."
  cron_schedule: "every 5 minutes — `inngest.createFunction({ id: 'catalog/reconcile-deletions', triggers: [{ cron: '*/5 * * * *' }] }, ...)`. Threshold for `findOlderThan` = 300 seconds (5 minutes); a row created in the last 5 min is presumed still in flight and skipped. **Codex review HIGH 05-06**: the threshold ALSO covers `dispatched_at` — rows where `dispatched_at` is within the last threshold seconds are treated as still-in-flight even if status='pending' (handles the case where the prior reconciler tick claimed the row and is still working)."
  cleanup_concurrency_and_retries: "Per CONTEXT § Claude's Discretion: concurrency: { limit: 5, key: 'event.data.user_id' }, retries: 5 (Inngest default exponential backoff)."
  cleanup_storage_event_triggers: |
    **Codex review HIGH 05-09**: the `catalog/cleanup-storage` Inngest function
    registers TWO event triggers, not one:

    ```ts
    inngest.createFunction(
      {
        id: "catalog/cleanup-storage",
        concurrency: { limit: 5, key: "event.data.user_id" },
        retries: 5,
      },
      [
        { event: "plant.deleted" },
        { event: "photo_entry.deleted" },  // Codex 05-09 — separate event for per-PhotoEntry cleanup
      ],
      handler,
    );
    ```

    Both event types carry `storage_deletion_job_id` (their payload shapes are
    defined in Plan 05-04's `events.ts`). The handler body is identical for
    both — load the pending_storage_deletions row by job id, deleteMany, mark
    complete. The handler does NOT special-case the event name. Plan 05-09's
    `deletePhotoEntryWithStorageCleanup` use case dispatches `photo_entry.deleted`;
    this plan's `deletePlant` use case dispatches `plant.deleted`.
  post_commit_dispatch_strategy: |
    Use case dispatches inngest.send AFTER transaction commits. On dispatch
    failure, the use case logs the error to Sentry but returns 204 successfully
    (the pending row is durable; reconciler will pick up). Pitfall 4 mitigation.

    **Codex review HIGH 05-06**: AFTER `inngest.send(...)` succeeds (or as part
    of the reconciler claim), the use case (or reconciler) calls
    `pendingDeletions.markDispatched(tx, jobId)` — sets `status='dispatching'`,
    `dispatched_at=now()`. This prevents the next reconciler tick from
    re-dispatching a row whose Inngest event is in flight. The cleanup-storage
    function transitions the row to `status='complete'` after a successful
    deleteMany. If the cleanup function fails, the row stays in `dispatching`
    until `dispatched_at` is older than the reconciler threshold, at which
    point the next tick re-dispatches.
  source_of_truth_for_paths: "Inngest cleanup function loads the pending_storage_deletions row by storage_deletion_job_id and uses ITS storagePaths field — NOT event.data.storage_paths — as the authoritative deletion list. Prevents path drift if the row is ever updated."
  identification_plant_id_set_null: "Plant cascade deletion via FK ON DELETE SET NULL on Identification.plant_id (Phase 2 D-07). The use case does NOT manually update Identification.plant_id — the FK action handles it. Integration test asserts identifications row is preserved with plant_id NULL after delete."
  inngest_stub_named_contingency: |
    **Codex Decision 4 — stub policy**: the Phase-4 Inngest dependency is
    BLOCKING. The defensive stub at `@shared/events/inngest-client.ts` is a
    NAMED CONTINGENCY documented in this plan and the SUMMARY artifact —
    NOT a silent fallback. If Phase 4 has not landed at execution time, the
    stub mirrors the EXACT API surface (`inngest.send`, `inngest.createFunction`)
    and emits a Sentry breadcrumb on every call so the absence of real Inngest
    is observable. The integration test for `deletePlant` includes a guard:
    if the stub is in use, the test asserts that `inngest.send` was called
    with the correct payload but does NOT assert the cleanup-storage function
    fired (since it can't run without real Inngest). Plan 05-06 SUMMARY
    records whether the stub or real Inngest was active at execution time.
must_haves:
  truths:
    - "deletePlant({ plantId, userId, uow, storageAdapter, inngest }) opens transaction → reads photo storage paths via photoEntries.listStoragePathsForPlant → inserts pending_storage_deletions row → DELETEs from plants → commits → dispatches plant.deleted event → calls pendingDeletions.markDispatched(tx, jobId) (Codex 05-06)"
    - "All four DB writes (read paths, insert pending, DELETE plant, FK cascade) happen inside ONE transaction (Pitfall 4 mitigation)"
    - "Plant DELETE cascades photo_entries (Phase 2 D-07 CASCADE) and reminders (Phase 2 D-07 CASCADE; reminders table is Phase 2 deliverable) and SETs Identification.plant_id NULL (Phase 2 D-07 SET NULL)"
    - "Empty-photo case (plant with zero PhotoEntries) skips inserting pending row AND skips event dispatch (efficient no-op)"
    - "**Codex review HIGH 05-09 — `catalog/cleanup-storage` Inngest function registers BOTH `plant.deleted` AND `photo_entry.deleted` triggers**. Same handler body processes both event types via the shared `storage_deletion_job_id`. The unit test covers both event-name paths."
    - "catalog/cleanup-storage Inngest function loads pending row by storage_deletion_job_id, calls storageAdapter.deleteMany(job.storagePaths), then markComplete"
    - "If event dispatch fails after commit, the pending row remains visible to the reconciler"
    - "**Codex review HIGH 05-06 — reconciler skips recently-dispatched rows**: catalog/reconcile-deletions cron scans pending_storage_deletions WHERE status='pending' AND (dispatched_at IS NULL OR dispatched_at < now() - 300s), claims rows via `markDispatched`, then re-emits plant.deleted (or photo_entry.deleted) for each. The dispatched_at column prevents repeated re-dispatch on every cron tick."
    - "**Codex Decision 4 — Inngest stub is a NAMED CONTINGENCY** (`decisions.inngest_stub_named_contingency`), NOT a silent fallback. SUMMARY records which path (real Inngest vs stub) was active at execution time."
  artifacts:
    - path: "src/contexts/catalog/application/delete-plant.ts"
      provides: "deletePlant(args) — exported async use case"
      min_lines: 70
    - path: "src/contexts/catalog/inngest/cleanup-storage.ts"
      provides: "cleanupStorage Inngest function (default export or named export)"
      min_lines: 50
    - path: "src/contexts/catalog/inngest/reconcile-deletions.ts"
      provides: "reconcileDeletions Inngest cron function"
      min_lines: 40
    - path: "tests/unit/contexts/catalog/delete-plant.test.ts"
      provides: "Mocked-repo coverage: empty-photo skip, happy path, dispatch failure swallowed and logged"
      min_lines: 80
    - path: "tests/unit/contexts/catalog/inngest/cleanup-storage.test.ts"
      provides: "Mocked-storage coverage: loads job, calls deleteMany with job.storagePaths, marks complete; skipped when row already complete"
      min_lines: 60
    - path: "tests/unit/contexts/catalog/inngest/reconcile-deletions.test.ts"
      provides: "Mocked-repo coverage: only re-emits for rows older than threshold; respects status filter"
      min_lines: 50
    - path: "tests/integration/catalog/delete-plant-atomic.integration.test.ts"
      provides: "Real-DB coverage: pending row + plant DELETE + cascade in one tx; rollback on cascade failure leaves both intact; identification.plant_id set NULL"
      min_lines: 80
    - path: "tests/integration/catalog/reconcile-pending-deletions.integration.test.ts"
      provides: "Real-DB coverage: row created 10 min ago is picked up; row created 1 min ago is skipped"
      min_lines: 40
  key_links:
    - from: "src/contexts/catalog/application/delete-plant.ts"
      to: "src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts (Plan 05-03)"
      via: "calls insert(tx, { userId, plantId, storagePaths }) inside transaction"
      pattern: "pendingStorageDeletions.insert"
    - from: "src/contexts/catalog/inngest/cleanup-storage.ts"
      to: "@shared/adapters/storage (Phase 2 D-25)"
      via: "calls storageAdapter.deleteMany(paths) inside step.run"
      pattern: "deleteMany"
    - from: "src/contexts/catalog/inngest/reconcile-deletions.ts"
      to: "src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts (Plan 05-03)"
      via: "calls findOlderThan + re-emits plant.deleted via inngest.send"
      pattern: "findOlderThan"
---

<objective>
Ship the Plant deletion use case (CAT-09) plus the two Inngest async functions (catalog/cleanup-storage consumer + catalog/reconcile-deletions cron) that complete the durable storage-cleanup outbox pattern. This plan resolves Open Question Q2: Phase 5 owns the reconciler locally as a defensive default.

Purpose: CAT-09 cascades PhotoEntry + Reminder rows, sets Identification.plant_id NULL (FK action), and asynchronously deletes the storage objects via Inngest. Pitfall 4 — post-commit event dispatch failure — is mitigated by the durable pending_storage_deletions row + the reconciler.

Output: 1 use case (~70 lines), 2 Inngest functions (~90 lines), 5 test files (~310 lines). Plan 05-09's DELETE route handler depends on this use case.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/02-data-layer/02-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-03-catalog-repositories-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-04-domain-zod-schemas-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-05-plant-create-use-cases-PLAN.md

<interfaces>
src/contexts/catalog/application/delete-plant.ts (full body):
```ts
import type { UnitOfWork } from "@shared/db/unit-of-work";
import type { StorageAdapter } from "@shared/adapters/storage";
import type { Inngest } from "inngest";
import * as plants from "@contexts/catalog/infrastructure/db/plants";
import * as photoEntries from "@contexts/catalog/infrastructure/db/photo-entries";
import * as pendingDeletions from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
import { notFound } from "./errors";
import { PlantDeletedEventName, type PlantDeletedEvent } from "@contexts/catalog/domain/events";
import * as Sentry from "@sentry/nextjs";

export async function deletePlant(args: {
  plantId: string;
  userId: string;
  uow: UnitOfWork;
  inngest: Pick<Inngest, "send">;
}): Promise<void> {
  const job = await args.uow.transaction(async (tx) => {
    const photoPaths = await photoEntries.listStoragePathsForPlant(tx, {
      plantId: args.plantId,
      userId: args.userId,
    });
    let outboxRow: Awaited<ReturnType<typeof pendingDeletions.insert>> | null = null;
    if (photoPaths.length > 0) {
      outboxRow = await pendingDeletions.insert(tx, {
        userId: args.userId,
        plantId: args.plantId,
        storagePaths: photoPaths,
      });
    }
    const deleted = await plants.deleteByIdAndUser(tx, {
      plantId: args.plantId,
      userId: args.userId,
    });
    if (!deleted) notFound("plant_not_found");
    return outboxRow;
  });

  if (!job) return; // empty-photo plant — no cleanup needed

  // Post-commit dispatch — Pitfall 4 mitigation: reconciler picks up on failure
  try {
    const event: PlantDeletedEvent = {
      name: PlantDeletedEventName,
      data: {
        user_id: args.userId,
        plant_id: args.plantId,
        storage_deletion_job_id: job.id,
        storage_paths: job.storagePaths,
      },
    };
    await args.inngest.send(event);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { plan: "05-06", phase: "post-commit-dispatch" },
      extra: { storage_deletion_job_id: job.id },
    });
    // Do NOT rethrow — pending row is durable; reconciler will retry.
  }
}
```

src/contexts/catalog/inngest/cleanup-storage.ts:
```ts
import { inngest } from "@shared/events/inngest-client"; // Phase 4 ships this
import { storageAdapter } from "@shared/adapters/storage"; // Phase 2 D-25
import * as pendingDeletions from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
import { db } from "@shared/db/client"; // Phase 2 D-14

export const cleanupStorage = inngest.createFunction(
  {
    id: "catalog/cleanup-storage",
    name: "Catalog · cleanup storage after plant deletion",
    concurrency: { limit: 5, key: "event.data.user_id" },
    retries: 5,
  },
  { event: "plant.deleted" },
  async ({ event, step }) => {
    const { storage_deletion_job_id, user_id, plant_id } = event.data;

    const job = await step.run("load-job", async () =>
      pendingDeletions.findById(db, storage_deletion_job_id),
    );

    if (!job || job.status === "complete") {
      return { skipped: true, reason: "already_complete_or_missing", storage_deletion_job_id };
    }

    const paths = job.storagePaths;
    await step.run("delete-storage", async () => {
      await storageAdapter.deleteMany(paths);
    });

    await step.run("mark-complete", async () =>
      pendingDeletions.markComplete(db, storage_deletion_job_id),
    );

    return { user_id, plant_id, deleted_count: paths.length };
  },
);
```

src/contexts/catalog/inngest/reconcile-deletions.ts:
```ts
import { inngest } from "@shared/events/inngest-client";
import * as pendingDeletions from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
import { db } from "@shared/db/client";
import { PlantDeletedEventName } from "@contexts/catalog/domain/events";

export const reconcileDeletions = inngest.createFunction(
  {
    id: "catalog/reconcile-deletions",
    name: "Catalog · reconcile orphaned pending deletions",
    retries: 3,
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const orphans = await step.run("find-orphans", async () =>
      pendingDeletions.findOlderThan(db, {
        thresholdSeconds: 300,
        status: "pending",
        limit: 50,
      }),
    );

    if (orphans.length === 0) return { reconciled: 0 };

    await Promise.all(
      orphans.map((row) =>
        inngest.send({
          name: PlantDeletedEventName,
          data: {
            user_id: row.userId,
            plant_id: row.plantId,
            storage_deletion_job_id: row.id,
            storage_paths: row.storagePaths,
          },
        }),
      ),
    );

    return { reconciled: orphans.length };
  },
);
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship deletePlant use case + unit + integration tests (CAT-09 atomic transaction + cascade)</name>
  <files>src/contexts/catalog/application/delete-plant.ts, tests/unit/contexts/catalog/delete-plant.test.ts, tests/integration/catalog/delete-plant-atomic.integration.test.ts</files>
  <read_first>
    - src/contexts/catalog/infrastructure/db/plants.ts + photo-entries.ts + pending-storage-deletions.ts (Plan 05-03 — repository signatures)
    - src/contexts/catalog/application/errors.ts (Plan 05-05 — DomainError + notFound)
    - src/contexts/catalog/domain/events.ts (Plan 05-04 — PlantDeletedEvent type + name)
    - tests/helpers/inngest-stub.ts (Plan 05-01 — createInngestSendStub)
    - tests/helpers/transaction-rollback.ts (Plan 05-01 — withRollback)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-04 (the 6-step deletion flow + outbox row + post-commit event dispatch)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pattern 5: Atomic plant DELETE" (the reference implementation)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pitfall 4: Post-commit event dispatch failure" (why try/catch around inngest.send + log to Sentry but don't rethrow)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-07 (FK actions: PhotoEntry CASCADE, Reminder CASCADE, Identification SET NULL)
  </read_first>
  <behavior>
    Unit (mocked):
    - Happy path: photoEntries.listStoragePathsForPlant returns ['p1.jpg', 'p2.jpg'] → pendingDeletions.insert called inside tx → plants.deleteByIdAndUser called inside tx returning true → inngest.send called AFTER tx with PlantDeletedEvent shape
    - Empty-photo: listStoragePathsForPlant returns [] → pendingDeletions.insert NOT called → plants.deleteByIdAndUser called → inngest.send NOT called
    - Plant not found: plants.deleteByIdAndUser returns false → throws DomainError code "not_found" → inngest.send NOT called
    - Dispatch failure swallowed: inngest.send rejects → function returns successfully (no throw) → Sentry.captureException called with extras containing storage_deletion_job_id
    - Inngest.send is invoked with EXACT payload shape: { name: "plant.deleted", data: { user_id, plant_id, storage_deletion_job_id, storage_paths } } — match keys + value types

    Integration (real DB):
    - Seed user + plant + 2 photo_entries → call deletePlant with stubbed inngest → plants row gone, photo_entries rows gone (cascade), pending_storage_deletions row inserted with status='pending' AND storage_paths matching the 4 paths (2 photo + 2 thumbnail)
    - Identification preserved with plant_id NULL: seed user + plant + 1 identification linked to plant → call deletePlant → identifications row still exists with plant_id NULL (Phase 2 D-07 FK SET NULL)
  </behavior>
  <action>
    1. Implement src/contexts/catalog/application/delete-plant.ts per the `<interfaces>` block (~70 lines).

    2. Write tests/unit/contexts/catalog/delete-plant.test.ts with the 5 unit behaviors. Use vi.mock for plants/photoEntries/pendingDeletions/Sentry. For inngest, use the createInngestSendStub from tests/helpers/inngest-stub.ts.

    3. Write tests/integration/catalog/delete-plant-atomic.integration.test.ts with the 2 integration behaviors. Use withRollback wrapper. NOTE: cascade tests inside withRollback work because Postgres handles FK CASCADE inside the same transaction. Identification cascade via SET NULL is also intra-transaction.

    4. Run all three test files; tsc clean.
  </action>
  <acceptance_criteria>
    - src/contexts/catalog/application/delete-plant.ts contains literal `args.uow.transaction` AND `pendingDeletions.insert` AND `inngest.send` AND `Sentry.captureException`
    - File contains literal `notFound("plant_not_found")` (the not-found path)
    - File contains literal `PlantDeletedEventName` (uses the canonical event name from Plan 05-04)
    - tests/unit/contexts/catalog/delete-plant.test.ts has at least 5 `it(...)` cases including ones named with "empty" or "no photo" / "dispatch failure" or "captureException" / "not found"
    - tests/integration/catalog/delete-plant-atomic.integration.test.ts has at least 2 `it(...)` cases including a cascade-to-identification test
    - All test files green; tsc clean
  </acceptance_criteria>
  <verify>
    <automated>grep -q "args\.uow\.transaction" src/contexts/catalog/application/delete-plant.ts && grep -q "pendingDeletions\.insert" src/contexts/catalog/application/delete-plant.ts && grep -q "inngest.send\|args.inngest.send" src/contexts/catalog/application/delete-plant.ts && grep -q "Sentry\.captureException" src/contexts/catalog/application/delete-plant.ts && grep -q "PlantDeletedEventName" src/contexts/catalog/application/delete-plant.ts && pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/delete-plant.test.ts && pnpm exec vitest --run --project=integration tests/integration/catalog/delete-plant-atomic.integration.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>deletePlant ships with atomic transaction, outbox row, post-commit dispatch with try/catch + Sentry; cascade to PhotoEntries + SET NULL on Identification verified by integration test.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ship cleanup-storage Inngest consumer + reconcile-deletions cron + their tests (Q2 resolution)</name>
  <files>
    src/contexts/catalog/inngest/cleanup-storage.ts,
    src/contexts/catalog/inngest/reconcile-deletions.ts,
    tests/unit/contexts/catalog/inngest/cleanup-storage.test.ts,
    tests/unit/contexts/catalog/inngest/reconcile-deletions.test.ts,
    tests/integration/catalog/reconcile-pending-deletions.integration.test.ts
  </files>
  <read_first>
    - src/contexts/catalog/application/delete-plant.ts (Task 1 — the producer of plant.deleted events)
    - src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts (Plan 05-03 — findById/findOlderThan/markComplete/markFailed)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-04 (the cleanup contract: load job → delete paths → mark complete; reconciler is the safety net)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pattern 5: Atomic plant DELETE + Inngest event consumer" (cleanupStorage shape)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Open Question 2 (reconciler placement — Phase 5 owns it, defensive)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md § Claude's Discretion ("concurrency=5 per user, max retries=5, exponential backoff")
    - Phase 4's plans (NOT YET WRITTEN) for the inngest client export — if @shared/events/inngest-client doesn't exist on disk at execution time, scaffold a minimal stub matching the contract documented in this plan's `<interfaces>` block
  </read_first>
  <behavior>
    cleanupStorage Inngest function (unit, mocked storage + repos):
    - Load job by storage_deletion_job_id → calls storageAdapter.deleteMany(job.storagePaths) → calls markComplete(jobId) → returns { user_id, plant_id, deleted_count }
    - Job already complete: status='complete' → returns { skipped: true } → deleteMany NOT called
    - Job not found (null): returns { skipped: true, reason: 'already_complete_or_missing' } → deleteMany NOT called
    - Concurrency config object literally matches { limit: 5, key: 'event.data.user_id' }
    - Retries config literally equals 5

    reconcileDeletions Inngest function (unit, mocked repo):
    - findOlderThan returns [] → returns { reconciled: 0 } → inngest.send NOT called
    - findOlderThan returns 3 rows → inngest.send called 3 times with PlantDeletedEvent shape (one per row); returns { reconciled: 3 }
    - Cron schedule literally matches '*/5 * * * *' (5-minute interval)
    - Threshold passed to findOlderThan literally equals 300 (seconds)

    reconcileDeletions integration (real DB):
    - Insert pending row with `created_at = now() - interval '10 minutes'` → call findOlderThan(300) → returns the row
    - Insert pending row with `created_at = now() - interval '1 minute'` → call findOlderThan(300) → does NOT return the row
    - Two pending rows + one complete row → findOlderThan(300, 'pending') returns only the 2 pending rows
  </behavior>
  <action>
    1. Implement src/contexts/catalog/inngest/cleanup-storage.ts per the `<interfaces>` block. Note: Phase 4 ships @shared/events/inngest-client. If absent, create `src/shared/events/inngest-client.ts` as a minimal stub:
       ```ts
       // STUB: Phase 4 will replace this with the real Inngest client + serve handler.
       import { Inngest } from "inngest";
       export const inngest = new Inngest({ id: "folhario", isDev: process.env.NODE_ENV !== "production" });
       ```
       Document this in the file header so Phase 4 knows to replace it.

    2. Implement src/contexts/catalog/inngest/reconcile-deletions.ts per the `<interfaces>` block.

    3. Write the 2 unit test files. Mock the inngest client as needed; for cleanupStorage, use vi.mock on @shared/adapters/storage. The Inngest function's body is the pure orchestration — extract the inner async fn from `inngest.createFunction(..., asyncFn)` if necessary by exposing it as a separate exported `_handler` for direct invocation in tests.

    4. Write the integration test for reconcileDeletions covering threshold semantics. Use raw `tx` SQL to set `created_at` explicitly because the default is `now()`.

    5. Run all 3 test files; tsc clean.
  </action>
  <acceptance_criteria>
    - src/contexts/catalog/inngest/cleanup-storage.ts contains literal `"catalog/cleanup-storage"` (the function id)
    - cleanup-storage.ts contains literal `concurrency: { limit: 5, key: "event.data.user_id" }`
    - cleanup-storage.ts contains literal `retries: 5`
    - cleanup-storage.ts contains literal `storageAdapter.deleteMany`
    - reconcile-deletions.ts contains literal `"catalog/reconcile-deletions"`
    - reconcile-deletions.ts contains literal `cron: "*/5 * * * *"`
    - reconcile-deletions.ts contains literal `thresholdSeconds: 300`
    - All 3 test files green
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q '"catalog/cleanup-storage"' src/contexts/catalog/inngest/cleanup-storage.ts && grep -q 'concurrency: { limit: 5' src/contexts/catalog/inngest/cleanup-storage.ts && grep -q "retries: 5" src/contexts/catalog/inngest/cleanup-storage.ts && grep -q "storageAdapter.deleteMany" src/contexts/catalog/inngest/cleanup-storage.ts && grep -q '"catalog/reconcile-deletions"' src/contexts/catalog/inngest/reconcile-deletions.ts && grep -q 'cron: "\*/5 \* \* \* \*"' src/contexts/catalog/inngest/reconcile-deletions.ts && grep -q "thresholdSeconds: 300" src/contexts/catalog/inngest/reconcile-deletions.ts && pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/inngest/cleanup-storage.test.ts tests/unit/contexts/catalog/inngest/reconcile-deletions.test.ts && pnpm exec vitest --run --project=integration tests/integration/catalog/reconcile-pending-deletions.integration.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>cleanupStorage + reconcileDeletions Inngest functions shipped with the configured concurrency/retries/cron + threshold values; all 3 test files green; the inngest-client stub or real client at @shared/events/inngest-client exists.</done>
</task>

</tasks>

<threat_model>
<threat id="T-5-03" severity="high" stride="R">
  <description>Storage object leak after delete — Pitfall 4. The plant DB row + cascade is committed, but inngest.send fails (network blip, Inngest API down). Without an outbox row + reconciler, the storage objects are orphaned forever.</description>
  <mitigation file="src/contexts/catalog/application/delete-plant.ts">Two-stage outbox: (1) pending_storage_deletions row inserted INSIDE the same DB transaction as the DELETE, so the row's existence is committed atomically with the delete; (2) inngest.send is called AFTER commit inside a try/catch that swallows the error and logs to Sentry — the use case still returns 204 successfully because the pending row is durable. The `catalog/reconcile-deletions` cron (every 5 min) calls pendingDeletions.findOlderThan(300, 'pending') and re-emits plant.deleted for each row older than 5 minutes still in pending state. Integration test in `tests/integration/catalog/reconcile-pending-deletions.integration.test.ts` proves the threshold semantics.</mitigation>
</threat>

<threat id="T-5-14" severity="medium" stride="T">
  <description>Path drift on outbox — if a future bug allowed the pending_storage_deletions row to be UPDATEd between insert and cleanup execution, the event payload's storage_paths could diverge from the row's storagePaths field.</description>
  <mitigation file="src/contexts/catalog/inngest/cleanup-storage.ts">The cleanup Inngest function uses `job.storagePaths` from the loaded row as the AUTHORITATIVE deletion list — NOT `event.data.storage_paths`. This means even if the event payload were tampered with in transit (Inngest signature would prevent that, but defense in depth), the cleanup uses the DB row's paths. The pending_storage_deletions table has no UPDATE path in any Phase 5 code (only INSERT, markComplete, markFailed) so drift is not currently possible — but this is the safer pattern for future evolution.</mitigation>
</threat>

<threat id="T-5-15" severity="low" stride="D">
  <description>Reconciler thundering herd — if Inngest is down for hours and many pending rows accumulate, the reconciler waking up could re-emit thousands of events at once, swamping the cleanup function.</description>
  <mitigation file="src/contexts/catalog/inngest/reconcile-deletions.ts">findOlderThan accepts a `limit` parameter (default 100, plan uses 50). Each cron invocation processes at most 50 orphans. The cleanup function's `concurrency: { limit: 5, key: "event.data.user_id" }` further bounds parallelism per-user. Combined: at most 50 events per 5 minutes from the reconciler, throttled to 5 concurrent per-user by the consumer — gives a sustainable drain rate even with a large backlog. If users routinely accumulate >50 orphans/cron, raise the limit OR switch to a paginated reconciler in a follow-up plan.</mitigation>
</threat>
</threat_model>

<verification>
1. `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/delete-plant.test.ts tests/unit/contexts/catalog/inngest/` exits 0.
2. `pnpm exec vitest --run --project=integration tests/integration/catalog/delete-plant-atomic.integration.test.ts tests/integration/catalog/reconcile-pending-deletions.integration.test.ts` exits 0.
3. `pnpm exec tsc --noEmit` exits 0.
4. Open Question Q2 resolved in this plan's `decisions.resolves_open_question_q2` block.
5. `@shared/events/inngest-client` exists (real Phase 4 client OR Phase 5 stub — captured in 05-06-SUMMARY.md).
6. **Codex 05-06 grep gates**: `grep -E "markDispatched" src/contexts/catalog/application/delete-plant.ts` matches AND `grep -E "markDispatched" src/contexts/catalog/inngest/reconcile-deletions.ts` matches. `grep -E "dispatched_at" src/contexts/catalog/inngest/reconcile-deletions.ts` matches.
7. **Codex 05-09 grep gate**: `grep -E "photo_entry\\.deleted" src/contexts/catalog/inngest/cleanup-storage.ts` matches; the Inngest function registration includes both `plant.deleted` and `photo_entry.deleted` triggers.
</verification>

<reviews_addressed>
**Codex review findings resolved by this plan (per `.planning/phases/05-catalog-meu-jardim/05-REVIEWS.md`):**

- **05-06 HIGH — reconciler references missing `dispatched_at` column / repeated re-dispatch on every cron tick**: Resolved by:
  1. The `dispatched_at timestamptz NULL` column is added in Plan 05-02 + the `markDispatched(tx, id)` repo helper in Plan 05-03.
  2. `deletePlant` calls `pendingDeletions.markDispatched(tx, jobId)` AFTER `inngest.send(...)` succeeds (post-commit, Codex 05-06).
  3. The reconciler claims rows by calling `markDispatched` BEFORE re-emitting the event, and `findOlderThan` skips rows where `dispatched_at` is recent (`OR dispatched_at < now() - threshold`).
  4. The `cleanup-storage` Inngest function transitions the row to `complete` after deleteMany; if it fails, the row stays in `dispatching` until `dispatched_at` is older than the threshold, at which point the next reconciler tick re-claims it.
- **05-09 HIGH — `plant.deleted` reused for single PhotoEntry deletion**: Resolved by `decisions.cleanup_storage_event_triggers` — the `catalog/cleanup-storage` Inngest function registers BOTH `plant.deleted` AND `photo_entry.deleted` as triggers. Plan 05-09 dispatches the new event for per-PhotoEntry cleanup; this plan's `deletePlant` continues to dispatch `plant.deleted`. Same handler body for both event types via the shared `storage_deletion_job_id`.
- **Codex Decision 4 — stub policy**: `decisions.inngest_stub_named_contingency` documents the Phase-4 Inngest dependency as BLOCKING with a NAMED CONTINGENCY stub (mirrors API surface, emits Sentry breadcrumb on every call). The integration test's behavior under-stub is documented; SUMMARY records which path was active.
</reviews_addressed>

<success_criteria>
- deletePlant use case ships atomic transaction (read paths → insert outbox → DELETE → commit → dispatch → markDispatched) per CAT-09 + CONTEXT D-04 + Codex 05-06.
- catalog/cleanup-storage Inngest function consumes BOTH `plant.deleted` AND `photo_entry.deleted` events with concurrency=5 per user, retries=5 (Codex 05-09).
- catalog/reconcile-deletions cron ships at every-5-minute schedule with 300s threshold AND `dispatched_at` skip-if-recent logic (Q2 resolution + Codex 05-06).
- Identification.plant_id set NULL via Phase 2 D-07 FK action (no manual UPDATE in use case).
- Pitfall 4 (post-commit dispatch failure) mitigated by try/catch + Sentry log + reconciler that respects dispatched_at.
- Inngest stub is a NAMED CONTINGENCY documented in SUMMARY (Codex Decision 4).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-06-SUMMARY.md` capturing:
- The exact deletePlant function signature Plan 05-09's DELETE route handler will import
- Confirmation that Q2 was resolved by Phase 5 owning catalog/reconcile-deletions locally; if Phase 4 later adds a generic outbox dispatcher, this cron can be retired in a follow-up phase
- Note for Phase 4 (when Inngest infrastructure plans are written): @shared/events/inngest-client must export the inngest singleton with `.send()` and `.createFunction()` matching the inngest@4.2.4 API; if Phase 4 ships an alternative shape, this plan's two functions need adapter changes
- Note for Phase 11 (LGPD deletion): the same `pending_storage_deletions` table can be reused for account-wide hard deletion; Phase 11 plans should reference this table rather than create their own
- Confirmation that Identification.plant_id cascade is FK-driven (Phase 2 D-07 SET NULL) — no application code touches Identification.plant_id during deletion
</output>
