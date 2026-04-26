---
phase: 05-catalog-meu-jardim
plan: 05
type: execute
wave: 2
depends_on:
  - 05-01
  - 05-02
  - 05-03
  - 05-04
  # PHASE-2-DEPENDENCY: requires Phase 2 plans 02-05 (UnitOfWork at src/shared/db/unit-of-work.ts), 02-08 (StorageAdapter — though create use cases call repos, not storage directly), and the Identification table from Phase 2 wave 2 (createPlantFromIdentification updates Identification.plant_id cross-context).
  # PHASE-1-DEPENDENCY: posthog-server.ts (Phase 1 Plan 01-06) shipped — getPostHog() singleton consumed for plant_added events.
files_modified:
  - src/contexts/catalog/application/create-plant-manual.ts
  - src/contexts/catalog/application/create-plant-from-identification.ts
  - src/contexts/catalog/application/errors.ts
  - tests/unit/contexts/catalog/create-plant-manual.test.ts
  - tests/unit/contexts/catalog/create-plant-from-identification.test.ts
  - tests/integration/catalog/create-plant-manual.integration.test.ts
  - tests/integration/catalog/create-plant-from-identification.integration.test.ts
autonomous: true
requirements:
  - CAT-01
  - CAT-02
decisions:
  resolves_open_question_q6: "PostHog plant_added event payload shape: { source: 'manual' | 'from_identification', has_species: boolean }. Server-side capture via posthog-node (Phase 1 Plan 01-06 ships getPostHog()) per CONTEXT D-21 client posture (server-side capture is the production path; client-side identified_only person_profiles)."
  cross_context_identification_update: "createPlantFromIdentification UPDATEs Identification.plant_id within the same UoW transaction as the Plant INSERT. Re-checks Identification.user_id === authenticated user_id BEFORE updating (T-5-02 IDOR mitigation per RESEARCH § Security Domain row 'Cross-context Identification.plant_id link'). Re-checks Identification.plant_id IS NULL before updating (rejects 'already linked' with conflict)."
  storage_path_ownership_call_site: "Both use cases call validateStoragePathOwnership BEFORE the SQL transaction opens. Failure throws a domain error mapped to validation_failed by the route handler (Plans 05-08/09)."
  application_errors_module: "src/contexts/catalog/application/errors.ts exports typed throwable functions: validationFailed(message, details?), notFound(message), forbidden(message), conflict(message). Route handler (Plans 05-08/09) catches and maps to closed-registry ErrorCode codes via httpMapError."
must_haves:
  truths:
    - "createPlantManual({ userId, input }) inserts Plant with species_id=null + N initial PhotoEntry rows in one transaction; cover_photo_url set to input.initial_photos[0].photo_url"
    - "createPlantManual rejects with validation_failed when any submitted photo path doesn't begin with `{userId}/{plantId}/` (T-5-01 mitigation — calls validateStoragePathOwnership)"
    - "createPlantManual emits plant_added PostHog event with payload { source: 'manual', has_species: false } via getPostHog() server-side"
    - "createPlantFromIdentification({ userId, input }) verifies Identification.user_id === userId, verifies Identification.plant_id IS NULL, creates Plant with species_id from selected_result_id, sets Identification.plant_id atomically — all in one transaction"
    - "createPlantFromIdentification emits plant_added PostHog event with payload { source: 'from_identification', has_species: true }"
    - "Both use cases use UoW.transaction(...) (Phase 2 D-18); zero direct Drizzle imports in application layer (Phase 2 D-17)"
    - "Both use cases throw `notFound`/`forbidden`/`conflict`/`validationFailed` domain errors; route handlers catch and map"
  artifacts:
    - path: "src/contexts/catalog/application/create-plant-manual.ts"
      provides: "createPlantManual(args) — exported async function"
      min_lines: 80
    - path: "src/contexts/catalog/application/create-plant-from-identification.ts"
      provides: "createPlantFromIdentification(args) — exported async function"
      min_lines: 90
    - path: "src/contexts/catalog/application/errors.ts"
      provides: "validationFailed, notFound, forbidden, conflict, alreadyLinked typed throw helpers + DomainError class"
      min_lines: 35
    - path: "tests/unit/contexts/catalog/create-plant-manual.test.ts"
      provides: "Mocked-repo unit tests covering: happy path, validation_failed on bad path, PostHog event emitted, transaction wrapping"
      min_lines: 80
    - path: "tests/unit/contexts/catalog/create-plant-from-identification.test.ts"
      provides: "Mocked-repo unit tests covering: happy path, IDOR rejection (different user), already-linked conflict, PostHog event emitted"
      min_lines: 90
    - path: "tests/integration/catalog/create-plant-manual.integration.test.ts"
      provides: "Real-DB roundtrip — insert + read back; cover_photo_url set; both PhotoEntry rows present; idempotent replay returns same row"
      min_lines: 80
    - path: "tests/integration/catalog/create-plant-from-identification.integration.test.ts"
      provides: "Real-DB roundtrip — Identification.plant_id updated; cross-user identification_id rejected"
      min_lines: 80
  key_links:
    - from: "src/contexts/catalog/application/create-plant-manual.ts"
      to: "src/contexts/catalog/domain/storage-path.ts (Plan 05-04)"
      via: "calls validateStoragePathOwnership before transaction"
      pattern: "validateStoragePathOwnership"
    - from: "src/contexts/catalog/application/create-plant-from-identification.ts"
      to: "Identification table (Phase 2 wave 2 — src/contexts/identification/infrastructure/db/schema.ts)"
      via: "cross-context UPDATE inside UoW transaction"
      pattern: "Identification.plant_id"
    - from: "src/contexts/catalog/application/*.ts"
      to: "src/shared/telemetry/posthog-server.ts (Phase 1 Plan 01-06)"
      via: "getPostHog().capture({ event: 'plant_added', properties: { source, has_species } })"
      pattern: "plant_added"
---

<objective>
Ship the two Plant-creation use cases (createPlantManual for CAT-02, createPlantFromIdentification for CAT-01). Both call the shared storage-path validator (Plan 05-04 — T-5-01 mitigation), both use Phase 2 D-18 UnitOfWork to wrap multi-row inserts in a transaction, and both emit a server-side `plant_added` PostHog event with the payload shape resolved in this plan (Open Q6: `{ source, has_species }`).

Purpose: Plan 05-08 (route handlers — read + Plant create) wires `POST /api/v1/plants` and `POST /api/v1/plants/from-identification` to these use cases. Without them, neither endpoint can be implemented.

Output: 2 use-case modules + 1 application-errors module (~205 lines), 4 test files (~330 lines: 2 mocked unit + 2 real-DB integration).
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

<interfaces>
src/contexts/catalog/application/create-plant-manual.ts:
```ts
import type { UnitOfWork } from "@shared/db/unit-of-work";
import * as plants from "@contexts/catalog/infrastructure/db/plants";
import * as photoEntries from "@contexts/catalog/infrastructure/db/photo-entries";
import { validateStoragePathOwnership } from "@contexts/catalog/domain/storage-path";
import type { PlantCreateInput } from "@contexts/catalog/domain/plant";
import type { Plant } from "@contexts/catalog/domain/plant";
import { validationFailed } from "./errors";
import { getPostHog } from "@shared/telemetry/posthog-server";

export async function createPlantManual(args: {
  userId: string;
  input: PlantCreateInput & { id?: string };
  uow: UnitOfWork;
}): Promise<Plant> {
  const plantId = args.input.id ?? crypto.randomUUID();

  // T-5-01 mitigation: validate storage paths BEFORE opening transaction
  const allPaths = args.input.initial_photos.flatMap((p) => [p.photo_url, p.thumbnail_url]);
  const ownership = validateStoragePathOwnership({
    paths: allPaths,
    userId: args.userId,
    plantId,
  });
  if (!ownership.ok) {
    throw validationFailed("storage_path_ownership_failed", { badPaths: ownership.badPaths });
  }

  const plant = await args.uow.transaction(async (tx) => {
    const created = await plants.create(tx, {
      id: plantId,
      userId: args.userId,
      speciesId: null,
      name: args.input.name,
      nickname: args.input.nickname ?? null,
      location: args.input.location ?? null,
      acquisitionDate: args.input.acquisition_date ?? null,
      notes: args.input.notes ?? null,
      coverPhotoUrl: args.input.initial_photos[0]!.photo_url,
    });
    for (const p of args.input.initial_photos) {
      await photoEntries.create(tx, {
        plantId: created.id,
        userId: args.userId,
        photoUrl: p.photo_url,
        thumbnailUrl: p.thumbnail_url,
        note: null,
      });
    }
    return created;
  });

  // PostHog server-side analytics — fire AFTER commit
  const ph = getPostHog();
  if (ph) {
    ph.capture({
      distinctId: args.userId,
      event: "plant_added",
      properties: { source: "manual", has_species: false },
    });
  }

  return plant;
}
```

src/contexts/catalog/application/create-plant-from-identification.ts (skeleton — full implementation in Task 2):
```ts
export async function createPlantFromIdentification(args: {
  userId: string;
  input: {
    identification_id: string;
    selected_result_id: string;
    name?: string;
    nickname?: string | null;
    location?: string | null;
    acquisition_date?: string | null;
    notes?: string | null;
  };
  uow: UnitOfWork;
}): Promise<Plant>;
```

src/contexts/catalog/application/errors.ts:
```ts
export class DomainError extends Error {
  constructor(
    public readonly code: "validation_failed" | "not_found" | "forbidden" | "conflict",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function validationFailed(message: string, details?: Record<string, unknown>): never {
  throw new DomainError("validation_failed", message, details);
}
export function notFound(message: string): never {
  throw new DomainError("not_found", message);
}
export function forbidden(message: string): never {
  throw new DomainError("forbidden", message);
}
export function conflict(message: string, details?: Record<string, unknown>): never {
  throw new DomainError("conflict", message, details);
}
```

UoW expected from Phase 2 D-18 (verify Phase 2 wave-5 plan signature before implementation):
```ts
export type UnitOfWork = {
  transaction: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>;
};
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship application/errors.ts + createPlantManual + its unit + integration tests (CAT-02)</name>
  <files>
    src/contexts/catalog/application/errors.ts,
    src/contexts/catalog/application/create-plant-manual.ts,
    tests/unit/contexts/catalog/create-plant-manual.test.ts,
    tests/integration/catalog/create-plant-manual.integration.test.ts
  </files>
  <read_first>
    - src/contexts/catalog/infrastructure/db/plants.ts + photo-entries.ts (Plan 05-03 — repository signatures)
    - src/contexts/catalog/domain/plant.ts (Plan 05-04 — PlantCreateInputSchema, PlantCreateInput type)
    - src/contexts/catalog/domain/storage-path.ts (Plan 05-04 — validateStoragePathOwnership)
    - src/shared/telemetry/posthog-server.ts (Phase 1 Plan 01-06 — getPostHog signature)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-18 (UnitOfWork at @shared/db/unit-of-work)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pitfall 1: Storage path ownership spoofing" (T-5-01 mitigation pattern)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Open Question 6 (PostHog payload — { source, has_species })
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "Use-cases under src/contexts/catalog/application/" (server-side analytics emission pattern from posthog-server.ts)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-22 (two-step Plant create flow + Idempotency-Key)
  </read_first>
  <behavior>
    Unit (mocked repos):
    - Happy path: validateStoragePathOwnership returns ok → uow.transaction is called → plants.create + photoEntries.create called inside the tx → returned Plant has cover_photo_url == input.initial_photos[0].photo_url
    - Bad path (cross-user): validateStoragePathOwnership returns { ok: false, badPaths } → throws DomainError with code "validation_failed" → uow.transaction NEVER called
    - PostHog event: getPostHog().capture called with event="plant_added" + properties.source="manual" + properties.has_species=false (use a vi.mock'd getPostHog returning a stub recorder)
    - PostHog null-safety: when getPostHog() returns null (env-disabled), function still completes successfully without throwing
    - Multiple initial_photos: 3 photos → 3 PhotoEntry rows inserted

    Integration (real DB):
    - Inserts 1 plant + 1 photo_entry; SELECT confirms cover_photo_url matches the submitted photo_url
    - Inserts 1 plant + 2 photo_entries; SELECT count(*) FROM photo_entries WHERE plant_id = $1 returns 2
    - DB error rolls back (use a forced FK violation by passing a non-existent userId, then assert no plants row was inserted)
    - Re-using the same Idempotency-Key requires Plan 05-08's route handler to dedupe; the use case itself is NOT idempotent (idempotency lives at the route layer per Phase 2 D-37). This test file does NOT cover idempotency replay; it covers the use-case happy path + transactional rollback.
  </behavior>
  <action>
    1. Implement src/contexts/catalog/application/errors.ts per the `<interfaces>` block (~35 lines).

    2. Implement src/contexts/catalog/application/create-plant-manual.ts per the `<interfaces>` block (~80 lines). Wrap the inserts in `args.uow.transaction(async (tx) => ...)`. Fire `getPostHog()?.capture(...)` AFTER the transaction commits.

    3. Write tests/unit/contexts/catalog/create-plant-manual.test.ts using vi.mock for plants, photoEntries, and getPostHog. Mock UoW.transaction to call the callback synchronously. Cover the 5 unit behaviors above.

    4. Write tests/integration/catalog/create-plant-manual.integration.test.ts using `withRollback(sql, async (tx) => ...)`. Construct a real UoW that yields the rollback tx. Insert a real users row inside the rollback for FK satisfaction (created in Task 1 of Plan 05-02 schema test, same approach). Cover the 3 integration behaviors above.

    5. Run both test files; all pass. `pnpm exec tsc --noEmit` clean.
  </action>
  <acceptance_criteria>
    - src/contexts/catalog/application/errors.ts exports `DomainError`, `validationFailed`, `notFound`, `forbidden`, `conflict`
    - src/contexts/catalog/application/create-plant-manual.ts contains literal `validateStoragePathOwnership` (T-5-01 wired)
    - create-plant-manual.ts contains literal `"plant_added"` and `"manual"` and `has_species: false` (Q6 payload shape)
    - create-plant-manual.ts contains literal `args.uow.transaction` (D-18 UoW used)
    - tests/unit/contexts/catalog/create-plant-manual.test.ts has at least 5 `it(...)` cases including one named with "spoof" or "validation_failed" or "bad path"
    - tests/integration/catalog/create-plant-manual.integration.test.ts has at least 3 `it(...)` cases
    - `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/create-plant-manual.test.ts` exits 0
    - `pnpm exec vitest --run --project=integration tests/integration/catalog/create-plant-manual.integration.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "validateStoragePathOwnership" src/contexts/catalog/application/create-plant-manual.ts && grep -q "\"plant_added\"" src/contexts/catalog/application/create-plant-manual.ts && grep -q "\"manual\"" src/contexts/catalog/application/create-plant-manual.ts && grep -q "has_species: false" src/contexts/catalog/application/create-plant-manual.ts && pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/create-plant-manual.test.ts && pnpm exec vitest --run --project=integration tests/integration/catalog/create-plant-manual.integration.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>createPlantManual ships with T-5-01 wired, Q6 PostHog payload emitted, transaction wrapping correct; both unit + integration tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ship createPlantFromIdentification + its unit + integration tests (CAT-01)</name>
  <files>
    src/contexts/catalog/application/create-plant-from-identification.ts,
    tests/unit/contexts/catalog/create-plant-from-identification.test.ts,
    tests/integration/catalog/create-plant-from-identification.integration.test.ts
  </files>
  <read_first>
    - src/contexts/catalog/application/create-plant-manual.ts (Task 1 — same UoW + PostHog patterns; this use case is structurally similar)
    - src/contexts/catalog/application/errors.ts (Task 1 — typed throw helpers)
    - src/contexts/catalog/infrastructure/db/plants.ts (Plan 05-03 — plants.create signature)
    - src/contexts/catalog/domain/plant.ts (Plan 05-04 — Plant type)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-23A (the create-from-identification contract — verifies user owns Identification, verifies plant_id is null, sets species_id from selected_result_id, sets cover_photo_url from identification upload, updates Identification.plant_id)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Security Domain row "Cross-context Identification.plant_id link (CAT-01)" (T-5-02 mitigation)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Open Question 6 (PostHog payload for from_identification source)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-46 (Phase 2 ships full PRD §4 entity set including Identification table)
  </read_first>
  <behavior>
    Unit (mocked repos):
    - Happy path: identificationRepo.findById returns row owned by userId with plant_id=null and selected_result with species_id='S-1' and photo_url='USER/IDENT-AGGR/x.jpg' → uow.transaction wraps plants.create + identificationRepo.linkToPlant in one tx → returned Plant.species_id == 'S-1' AND Plant.cover_photo_url == 'USER/IDENT-AGGR/x.jpg'
    - IDOR: identificationRepo.findById returns row with userId='OTHER-USER' → throws DomainError code "forbidden" → uow.transaction NEVER called
    - Already linked: identificationRepo.findById returns row with plant_id='EXISTING' → throws DomainError code "conflict" with details.alreadyLinkedToPlantId='EXISTING'
    - Identification not found: findById returns null → throws DomainError code "not_found"
    - Selected result not in results: identification.results doesn't contain selected_result_id → throws DomainError code "validation_failed"
    - PostHog event emitted with { source: "from_identification", has_species: true }

    Integration (real DB):
    - Seed user + identification (with results JSON containing 1 entry with species_id) → call use case → SELECT plants WHERE id = X returns row with species_id matching results[0].species_id; SELECT identifications WHERE id = Y returns row with plant_id = X
    - Cross-user: seed identification owned by USER-A; call with userId=USER-B → throws forbidden; SELECT identifications WHERE id = Y still has plant_id NULL
  </behavior>
  <action>
    1. Implement src/contexts/catalog/application/create-plant-from-identification.ts (~90 lines). Need a thin reference to the identification repository — Phase 2 wave 2 ships `src/contexts/identification/infrastructure/db/identifications.ts` (or equivalent). Verify the path before importing; if Phase 2 hasn't shipped it yet, the executor must add a minimal repo file `src/contexts/catalog/application/_identification-cross-context.ts` that wraps the SQL `SELECT id, user_id, plant_id, results FROM identifications WHERE id = $1` and `UPDATE identifications SET plant_id = $1 WHERE id = $2 AND plant_id IS NULL`. Document the Phase 2 dependency in the file header comment.

       Use case body shape:
       ```ts
       export async function createPlantFromIdentification(args) {
         const plantId = args.input.id ?? crypto.randomUUID();
         const plant = await args.uow.transaction(async (tx) => {
           const ident = await identificationRepo.findById(tx, args.input.identification_id);
           if (!ident) notFound("identification_not_found");
           if (ident.userId !== args.userId) forbidden("identification_not_owned");
           if (ident.plantId !== null) conflict("identification_already_linked", { alreadyLinkedToPlantId: ident.plantId });

           const selected = (ident.results as { id: string; species_id: string; photo_url: string; name: string }[])
             .find((r) => r.id === args.input.selected_result_id);
           if (!selected) validationFailed("selected_result_not_in_identification");

           const created = await plants.create(tx, {
             id: plantId,
             userId: args.userId,
             speciesId: selected.species_id,
             name: args.input.name ?? selected.name,
             nickname: args.input.nickname ?? null,
             location: args.input.location ?? null,
             acquisitionDate: args.input.acquisition_date ?? null,
             notes: args.input.notes ?? null,
             coverPhotoUrl: selected.photo_url,
           });
           await identificationRepo.linkToPlant(tx, { identificationId: ident.id, plantId: created.id });
           return created;
         });

         const ph = getPostHog();
         if (ph) {
           ph.capture({
             distinctId: args.userId,
             event: "plant_added",
             properties: { source: "from_identification", has_species: true },
           });
         }
         return plant;
       }
       ```

    2. Write tests/unit/contexts/catalog/create-plant-from-identification.test.ts covering all 6 unit behaviors with vi.mock.

    3. Write tests/integration/catalog/create-plant-from-identification.integration.test.ts covering both integration behaviors. Seed user + identification rows inside `withRollback`.

    4. Run both test files; tsc clean.
  </action>
  <acceptance_criteria>
    - src/contexts/catalog/application/create-plant-from-identification.ts contains literal `forbidden` and `conflict` and `validationFailed` and `notFound` (all 4 error helpers used)
    - File contains literal `"from_identification"` and `has_species: true` (Q6 payload)
    - File contains literal `args.uow.transaction` (D-18 UoW)
    - File contains a check on `ident.userId !== args.userId` (T-5-02 mitigation, IDOR check)
    - tests/unit/contexts/catalog/create-plant-from-identification.test.ts has at least 6 `it(...)` cases including ones named "IDOR" or "different user" / "already linked"
    - tests/integration/catalog/create-plant-from-identification.integration.test.ts has at least 2 `it(...)` cases including the cross-user rejection
    - All test files green; tsc clean
  </acceptance_criteria>
  <verify>
    <automated>grep -q "forbidden" src/contexts/catalog/application/create-plant-from-identification.ts && grep -q "conflict" src/contexts/catalog/application/create-plant-from-identification.ts && grep -q "\"from_identification\"" src/contexts/catalog/application/create-plant-from-identification.ts && grep -q "has_species: true" src/contexts/catalog/application/create-plant-from-identification.ts && grep -q "ident\.userId !== args\.userId" src/contexts/catalog/application/create-plant-from-identification.ts && pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/create-plant-from-identification.test.ts && pnpm exec vitest --run --project=integration tests/integration/catalog/create-plant-from-identification.integration.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>createPlantFromIdentification ships with T-5-02 IDOR check, Q6 PostHog payload, conflict + forbidden + not_found + validation_failed paths covered; both unit + integration tests green.</done>
</task>

</tasks>

<threat_model>
<threat id="T-5-01" severity="high" stride="T">
  <description>Photo URL spoofing on POST /api/v1/plants — covered in createPlantManual via Plan 05-04's validateStoragePathOwnership.</description>
  <mitigation file="src/contexts/catalog/application/create-plant-manual.ts">Use case calls validateStoragePathOwnership({ paths: allFlattened, userId: args.userId, plantId }) BEFORE opening the transaction. Failure throws DomainError("validation_failed", "storage_path_ownership_failed", { badPaths }); route handler maps to 422 ValidationFailed with the badPaths in details. No DB row is inserted on failure.</mitigation>
</threat>

<threat id="T-5-02" severity="high" stride="I">
  <description>Cross-context Identification.plant_id link tampering on POST /api/v1/plants/from-identification (CAT-01). Client submits identification_id belonging to another user.</description>
  <mitigation file="src/contexts/catalog/application/create-plant-from-identification.ts">Use case fetches the Identification row inside the UoW transaction, then enforces THREE invariants: (1) ident.userId === args.userId else `forbidden`; (2) ident.plantId === null else `conflict`; (3) selected_result_id ∈ ident.results else `validation_failed`. All three checks happen BEFORE the cross-context UPDATE on Identification.plant_id. The use-case unit test asserts each rejection path; the integration test asserts cross-user identification_id leaves the original Identification.plant_id unchanged.</mitigation>
</threat>

<threat id="T-5-13" severity="low" stride="I">
  <description>Sentry breadcrumb leak on the use-case path — if an exception is thrown after PostHog captures, the request body could be auto-attached to the Sentry event including PII like plant nicknames.</description>
  <mitigation file="src/contexts/catalog/application/create-plant-manual.ts">Sentry user scoping is `Sentry.setUser({ id })` only (Phase 1 LGPD-13). The use case does not call Sentry directly; any Sentry capture happens at the route handler boundary (Plans 05-08/09) which uses `Sentry.withScope` to drop request bodies on identification routes per Phase 1 D-22. Plant routes are NOT on the explicit body-drop list — name/nickname/notes are user-supplied content with low PII risk (no email/auth/payment data) but this is captured as a known consideration. If the user wants plant routes added to the body-drop list, that's a Phase 1 LGPD-13 amendment. Surfaced here for awareness; no Phase 5 mitigation required.</mitigation>
</threat>
</threat_model>

<verification>
1. `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/create-plant-manual.test.ts tests/unit/contexts/catalog/create-plant-from-identification.test.ts` exits 0.
2. `pnpm exec vitest --run --project=integration tests/integration/catalog/create-plant-manual.integration.test.ts tests/integration/catalog/create-plant-from-identification.integration.test.ts` exits 0.
3. `pnpm exec tsc --noEmit` exits 0.
4. Open Question Q6 resolved in this plan's `decisions.resolves_open_question_q6` block.
</verification>

<success_criteria>
- createPlantManual + createPlantFromIdentification + application/errors.ts shipped.
- T-5-01 storage-path validation wired in createPlantManual (Pitfall 1 mitigation).
- T-5-02 cross-context Identification ownership re-check wired in createPlantFromIdentification (RESEARCH § Security Domain row).
- PostHog `plant_added` event emitted server-side with the Q6-resolved payload `{ source, has_species }`.
- Both use cases use UnitOfWork.transaction (Phase 2 D-18) for multi-row writes.
- All 4 test files green (2 unit with mocked repos + 2 integration with real DB).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-05-SUMMARY.md` capturing:
- The exact use-case function signatures Plan 05-08's route handlers will import
- Confirmation that Q6 was resolved as `{ source: "manual" | "from_identification", has_species: boolean }`
- Note for Plan 05-06 (delete-plant): use the same DomainError class + typed throw helpers from `src/contexts/catalog/application/errors.ts`
- Note for Plan 05-08 (route handlers): catch DomainError instances and map `error.code` → `ErrorCode.{ValidationFailed,NotFound,Forbidden,Conflict}` via httpMapError; pass `error.details` through
- A note for any Phase 6 plan that will create Identifications: this plan introduces a cross-context dependency on `Identification.plant_id`; Phase 6 must NOT remove that column or break the read-side query path
</output>
