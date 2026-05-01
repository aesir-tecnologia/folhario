---
phase: 05-catalog-meu-jardim
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - package.json
  - vitest.config.ts
  - tests/unit/setup-idb.ts
  - tests/integration/fixtures/in-memory-storage-adapter.ts
  - tests/integration/fixtures/use-in-memory-storage-adapter.ts
  - tests/e2e/fixtures/authed-user.ts
  - tests/e2e/fixtures/read-only.ts
autonomous: true
requirements: []
tags: [test-infra, fixtures, fake-indexeddb, playwright]

must_haves:
  truths:
    - "fake-indexeddb is installed as a dev dep and registered in vitest unit-dom setup"
    - "Catalog integration tests can opt in to a hermetic in-memory StorageAdapter without touching tests that exercise real Supabase Storage"
    - "Catalog Playwright specs can start at a verified, trial-Subscription, ConsentLog-x2 user without driving the signup/login UI"
    - "A read-only fixture variant exists that sets cookie __test_subscription_read_only=1 via page.context().addCookies(); the cookie is honored by the useSubscription stub (05-11) ONLY when ENABLE_TEST_ROUTES=1 is set in the dev-server env (set in playwright.config.ts webServer.env)"
  artifacts:
    - path: "tests/unit/setup-idb.ts"
      provides: "fake-indexeddb auto-registration + per-test IDBFactory reset"
      contains: "fake-indexeddb/auto"
    - path: "vitest.config.ts"
      provides: "unit-dom project includes setup-idb.ts in setupFiles"
      contains: "setup-idb"
    - path: "tests/integration/fixtures/in-memory-storage-adapter.ts"
      provides: "InMemoryStorageAdapter class implementing StorageAdapter via Map<bucket, Map<key, Buffer>>"
      exports: ["InMemoryStorageAdapter"]
    - path: "tests/integration/fixtures/use-in-memory-storage-adapter.ts"
      provides: "Opt-in helper that swaps the adapter via __setStorageAdapterForTests in beforeAll/afterAll"
      exports: ["useInMemoryStorageAdapter"]
    - path: "tests/e2e/fixtures/authed-user.ts"
      provides: "Playwright test fixture seeding a verified user + ConsentLog x2 + trialing Subscription + injected Supabase SSR cookies"
      exports: ["test", "expect"]
    - path: "tests/e2e/fixtures/read-only.ts"
      provides: "Playwright test fixture extending authedUser; sets cookie __test_subscription_read_only=1 via page.context().addCookies() (honored by 05-11 stub only when ENABLE_TEST_ROUTES=1)"
      exports: ["test", "expect"]
    - path: "package.json"
      provides: "fake-indexeddb dev dependency"
      contains: "fake-indexeddb"
  key_links:
    - from: "vitest.config.ts"
      to: "tests/unit/setup-idb.ts"
      via: "unit-dom project setupFiles array"
      pattern: "setup-idb"
    - from: "tests/integration/fixtures/use-in-memory-storage-adapter.ts"
      to: "src/contexts/catalog/infrastructure/photo-storage.ts"
      via: "__setStorageAdapterForTests test seam"
      pattern: "__setStorageAdapterForTests"
    - from: "tests/e2e/fixtures/authed-user.ts"
      to: "tests/integration/fixtures/seed-user.ts (and Phase 4 seed-policy-version.ts)"
      via: "shared seed primitives reused server-side inside the Playwright fixture"
      pattern: "seedUser|seedCurrentPolicyVersions"
    - from: "tests/e2e/fixtures/read-only.ts"
      to: "tests/e2e/fixtures/authed-user.ts"
      via: "Playwright test.extend chaining"
      pattern: "test\\.extend"
---

<objective>
Ship Wave 0 test infrastructure for Phase 5: install `fake-indexeddb` (dev), register it in vitest's `unit-dom` project setup, ship an opt-in `InMemoryStorageAdapter` fixture for catalog integration tests, and ship two Playwright fixtures (`authedUser` + `readOnly`) that let every later Phase 5 plan write automated tests without driving signup/login or hitting real Supabase Storage.

Per D-25, D-26, D-27. TanStack/idb-keyval deps are deferred to plan 05-10 per outline (Wave 0 stays lean).

**Fixture path & auth strategy (deviation note for executor — read first):**

1. **`tests/integration/setup.ts` does NOT exist** in this codebase (`vitest.config.ts:41` points integration's `setupFiles` at `tests/integration/global-setup.ts`, which is a "marker only" file by design — Phase 1 plan 01-04 explicitly removed synthetic env-var injection from the integration project; do NOT regress that). VALIDATION.md and CONTEXT.md say "extend `tests/integration/setup.ts`" but that file does not exist and creating it would force every integration test (including `tests/integration/storage-adapter.integration.test.ts` and `storage-buckets.integration.test.ts`, which exercise the REAL Supabase Storage adapter) to run with the in-memory swap and break. **Therefore: do NOT extend any global setup file. Ship the in-memory adapter as an opt-in fixture (`InMemoryStorageAdapter`) plus a `useInMemoryStorageAdapter()` helper that an individual catalog integration test imports and calls in its own `beforeAll`/`afterAll`.** This matches the existing pattern in `tests/integration/photo-upload.integration.test.ts:155-200` and the literal text of D-27 ("Catalog integration tests focus on use-case behavior without external bucket flakes" — i.e., per-suite opt-in, not global).

2. **`authedUser` fixture must use Supabase SSR cookies, NOT Bearer JWTs.** Phase 5 catalog UI specs are page navigations (`page.goto('/catalog')`) and the cookie-session path (`getCurrentUserFromSession()` in `src/shared/api/auth.ts:44`) is the auth gate they hit. The existing test JWKS / Bearer-token pattern (`tests/e2e/global-setup.ts:91-110`, `tests/e2e/diagnostics-consent.spec.ts`) is BEARER-only and validated against `AUTH_JWKS_OVERRIDE_URL` (port 4567) — that path will NOT mint the `sb-*-auth-token` SSR cookies the (app) layout requires. CONTEXT D-26 specifies `supabase.auth.admin.createUser` server-side + `context.addCookies(...)`. Keep that wording: the fixture calls real local Supabase Auth admin (NOT cloud — same `supabase.co` guard pattern from `tests/integration/setup-supabase-truncate.ts:14-18`), seeds the `public.users` row + ConsentLog x 2 + trialing Subscription via direct `postgres-js`, then performs `signInWithPassword` to mint the SSR session cookies and injects them via `context.addCookies()`. **Reuse `tests/integration/fixtures/seed-user.ts` and `tests/integration/fixtures/seed-policy-version.ts`** server-side from inside the Playwright fixture; do not reimplement.

3. **`tests/integration/db-rollback.ts` extension (VALIDATION.md Wave 0 line 115)** — DEFER. The Phase 5 tables `pending_storage_deletions` and `location_suggestions` do not exist until plan 05-02 ships the schema, and the existing rollback fixture (Phase 2 D-43) does not need pre-emptive parameterization. Plan 05-02's schema task wires the new tables into the rollback list; this plan does NOT touch `tests/integration/db-rollback.ts`. VALIDATION.md line 115 will be checked by 05-02, not 05-01.

Purpose: unblock all of Wave 1+ in Phase 5. Without these fixtures, every catalog integration test would have to drive real Storage, every E2E spec would have to drive the full signup/verify/login flow (~30s per spec instead of ~50ms), and idb-persister unit tests in 05-10 would have no fake IndexedDB.

Output: 6 new files + 2 edits (`package.json` for the dev dep, `vitest.config.ts` for the setup-files entry).
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-PLAN-OUTLINE.md
@CLAUDE.md

# Read-first analog files (PATTERNS.md rows for this plan)
@vitest.config.ts
@playwright.config.ts
@package.json
@tests/integration/global-setup.ts
@tests/integration/fixtures/seed-user.ts
@tests/integration/fixtures/seed-policy-version.ts
@tests/integration/setup-supabase-truncate.ts
@tests/integration/photo-upload.integration.test.ts
@tests/e2e/global-setup.ts
@tests/e2e/auth-login-logout.spec.ts
@src/contexts/catalog/infrastructure/photo-storage.ts
@src/shared/adapters/storage.ts
@src/contexts/iam/infrastructure/db/schema.ts
@src/contexts/billing/infrastructure/db/schema.ts

<interfaces>
<!-- Key contracts the executor needs. Embedded so no codebase exploration is required. -->

From src/shared/adapters/storage.ts (the contract InMemoryStorageAdapter MUST implement):
```typescript
export interface BucketSummary { id?: string; name: string; public?: boolean; }
export interface UploadObjectInput { bucket: string; objectKey: string; buffer: Buffer | Uint8Array; contentType: string; cacheControl?: string; }
export interface UploadObjectResult { bucket: string; objectKey: string; }
export interface CreateSignedUrlInput { bucket: string; objectKey: string; expiresInSeconds: number; }
export interface CreateSignedUrlResult { signedUrl: string; }
export interface DeletePrefixInput { bucket: string; prefix: string; /* "INCLUDING any trailing slash" */ }
export interface DeleteObjectInput { bucket: string; objectKey: string; }
export interface ListObjectsUnderPrefixInput { bucket: string; prefix: string; }

export interface StorageAdapter {
  listBuckets(): Promise<BucketSummary[]>;
  uploadObject(input: UploadObjectInput): Promise<UploadObjectResult>;
  createSignedUrl(input: CreateSignedUrlInput): Promise<CreateSignedUrlResult>;
  deletePrefix(input: DeletePrefixInput): Promise<void>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
  listObjectsUnderPrefix(input: ListObjectsUnderPrefixInput): Promise<string[]>;
}
```

From src/contexts/catalog/infrastructure/photo-storage.ts (the test seam to use):
```typescript
export function __setStorageAdapterForTests(adapter: StorageAdapter | null): void;
// Pass an instance to swap, pass null to restore the real Supabase factory.
```

From tests/integration/fixtures/seed-user.ts (REUSE — do NOT reimplement):
```typescript
export type SeedUserOptions = {
  email: string;
  password: string;
  emailVerifiedAt?: string | null;   // pass an ISO string for verified user
  ageConfirmedAt?: string | null;    // defaults to now()
  timezone?: string;                  // defaults to "America/Sao_Paulo"
  name?: string;
  trialSource?: "organic" | "partner";
  partnerCode?: string | null;
};
export async function seedUser(opts: SeedUserOptions): Promise<{ id: string }>;
```

From tests/integration/fixtures/seed-policy-version.ts (REUSE for ConsentLog policy_version_id lookups):
```typescript
// Re-uses already-seeded policy_versions rows from drizzle/seeds/phase-02.sql
// Returns { tcId: string, privacyId: string } — exact export shape MUST be confirmed
// at write time via Read on the file. The function returns the current T&C and
// Privacy policy version IDs for ConsentLog inserts.
```

From src/contexts/billing/infrastructure/db/schema.ts (subscriptions table — required NOT NULL columns):
```typescript
// status: enum ["trialing", "active", "past_due", "canceled", "expired"] — pick "trialing"
// provider: varchar(32) NOT NULL — set to "stripe" (matches PRD §5)
// trial_start_date: timestamptz NOT NULL — now()
// trial_end_date: timestamptz NOT NULL — now() + 14d (D-26 trial window)
// user_id: uuid NOT NULL FK → users.id
```

From src/contexts/iam/infrastructure/db/schema.ts (consent_logs table — required NOT NULL columns):
```typescript
// purpose: enum incl. "signup_acceptance" — use "signup_acceptance"
// legal_basis: legalBasisEnum NOT NULL — match Phase 4 signup convention
// policy_version_id: uuid NOT NULL FK → policy_versions.id (RESTRICT)
// source: enum ["signup","settings","first_use_prompt"] NOT NULL — use "signup"
// granted_at: timestamptz nullable — set to now() (consent granted)
// One row for T&C policy_version_id, one row for Privacy policy_version_id (× 2 per D-26)
```

From playwright.config.ts (env vars already set on the webServer):
```typescript
// IDENTIFICATION_PROVIDER_MODE: "stub"
// AUTH_JWKS_OVERRIDE_URL, AUTH_AUDIENCE_OVERRIDE, AUTH_ISSUER_OVERRIDE — Bearer-only path
// ENABLE_TEST_ROUTES: "1"  — REQUIRED; gates the read-only cookie path in the useSubscription stub
// INNGEST_DEV: "1"
// SUBSCRIPTION_READ_ONLY: NOT SET and NOT USED — the per-spec read-only state is communicated
//   via cookie __test_subscription_read_only=1, NOT via process.env mutation. Playwright cannot
//   mutate webServer.env per-spec once the dev server is running; the cookie approach is the
//   only per-test mechanism. The stub (05-11) reads the cookie via Next.js cookies() ONLY when
//   ENABLE_TEST_ROUTES=1; in production that env var is unset so the cookie is ignored entirely.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install fake-indexeddb and wire it into vitest unit-dom setup</name>
  <files>package.json, tests/unit/setup-idb.ts, vitest.config.ts</files>
  <action>
    Per D-25 (CONTEXT.md). Three steps in one task because they form a single atomic test-infra unit.

    1. Install dev dep: run `pnpm add -D fake-indexeddb`. The most recent verified version per RESEARCH.md (line 143) is 6.2.5; pnpm will pick latest matching at install time. Confirm `package.json` `devDependencies` now contains `fake-indexeddb`.

    2. Create `tests/unit/setup-idb.ts` with this exact content (the import is side-effect-only and registers IDB globals; the `beforeEach` resets state between tests per RESEARCH Pattern 8 line 584):

       ```typescript
       // Phase 5 D-25: fake-indexeddb registration for Vitest unit-dom project.
       // Imports the side-effect "auto" entry which registers global indexedDB,
       // IDBKeyRange, IDBFactory, etc. Per-test reset via `new IDBFactory()`
       // ensures full isolation between tests (RESEARCH §Pattern 8).
       import "fake-indexeddb/auto";
       import { beforeEach } from "vitest";

       beforeEach(() => {
         // Replace the global indexedDB with a fresh factory per-test.
         // `new IDBFactory()` is exposed by fake-indexeddb's auto registration.
         (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
       });
       ```

       File goes under `tests/unit/` next to `setup-env.ts`. Do NOT add comments beyond what is already shown — they explain WHY (rule from CLAUDE.md global: complex logic only).

    3. Edit `vitest.config.ts` `unit-dom` project's `setupFiles` array (currently `["tests/unit/setup-env.ts"]` at line 25) to ADD (not replace) `setup-idb.ts`. Final shape:

       ```typescript
       setupFiles: ["tests/unit/setup-env.ts", "tests/unit/setup-idb.ts"],
       ```

       The `unit` project (line 15) keeps its existing single-entry `setupFiles` — fake-indexeddb is unit-dom-only because the `node` environment doesn't run IDB-touching tests. The `integration` project also stays untouched (Phase 1 plan 01-04 lock — see `tests/integration/global-setup.ts:6-8`).

    Do NOT delete or modify the existing `setup-env.ts` entry. Do NOT touch the `unit` (Node) project's setupFiles. Do NOT add `fake-indexeddb` as a runtime dep (it's test-only).
  </action>
  <verify>
    <automated>grep -F "fake-indexeddb/auto" tests/unit/setup-idb.ts &amp;&amp; grep -F "setup-idb" vitest.config.ts &amp;&amp; node -e "const p=require('./package.json'); if (!p.devDependencies['fake-indexeddb']) { process.exit(1) }" &amp;&amp; pnpm test:unit 2>&amp;1 | tail -5</automated>
  </verify>
  <done>
    `pnpm test:unit` runs to completion (no IDB-undefined errors). `package.json` lists `fake-indexeddb` under `devDependencies`. `tests/unit/setup-idb.ts` contains the literal `fake-indexeddb/auto` import. `vitest.config.ts` `unit-dom` project's `setupFiles` array includes both `setup-env.ts` and `setup-idb.ts` (literal substring `setup-idb` present). Existing unit tests continue to pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Ship opt-in InMemoryStorageAdapter fixture for catalog integration tests</name>
  <files>tests/integration/fixtures/in-memory-storage-adapter.ts, tests/integration/fixtures/use-in-memory-storage-adapter.ts</files>
  <action>
    Per D-27 (CONTEXT.md). The adapter is OPT-IN — individual catalog integration test files import it; there is NO global swap (which would break `tests/integration/storage-adapter.integration.test.ts` and `storage-buckets.integration.test.ts` that exercise REAL Supabase Storage). Read the analog at `tests/integration/photo-upload.integration.test.ts:73-147` for the existing FakeAdapter shape.

    1. Create `tests/integration/fixtures/in-memory-storage-adapter.ts` exporting a `class InMemoryStorageAdapter implements StorageAdapter` (the contract is in the `<interfaces>` block above; full file at `src/shared/adapters/storage.ts`). Internal store: `Map&lt;string, Map&lt;string, { buffer: Buffer; contentType: string; cacheControl?: string }&gt;&gt;` keyed by `bucket -> objectKey`. Methods:

       - `listBuckets(): Promise&lt;BucketSummary[]&gt;` — return `[...this.store.keys()].map(name => ({ name }))`.
       - `uploadObject({bucket, objectKey, buffer, contentType, cacheControl})` — coerce `Uint8Array` to `Buffer` (`Buffer.from(buffer)`); ensure bucket Map exists; store the entry; return `{bucket, objectKey}`.
       - `createSignedUrl({bucket, objectKey, expiresInSeconds})` — return `{ signedUrl: \`memory://${bucket}/${objectKey}?expires_in=${expiresInSeconds}\` }`. The shape mirrors what callers consume but never hits the network. Throw if the bucket/key isn't stored — the real Supabase adapter throws on missing keys (defense against tests that sign URLs without uploading).
       - `deletePrefix({bucket, prefix})` — mirror the real semantics from `photo-upload.integration.test.ts:93-110`: if prefix does not end with `/` return (no-op — guards against the CR-01 single-file regression). Otherwise delete every key whose value starts with `prefix` from the bucket's inner Map. Tolerate missing buckets silently (idempotent per RESEARCH Pitfall 6).
       - `deleteObject({bucket, objectKey})` — delete the single entry; tolerate missing entries silently.
       - `listObjectsUnderPrefix({bucket, prefix})` — return all keys in the bucket whose value starts with `prefix`. Empty array if bucket missing.

       Add a `clear()` method on the adapter (NOT part of `StorageAdapter` — extra public test API) that wipes the store. The opt-in helper (next file) calls it in `afterAll`.

       Do NOT include a comment header longer than 4 lines. The class name and the file location explain its purpose; the SKILL is in following the StorageAdapter contract precisely.

    2. Create `tests/integration/fixtures/use-in-memory-storage-adapter.ts` exporting a `useInMemoryStorageAdapter()` function. The function uses Vitest's `beforeAll`/`afterAll` (imported from `vitest`) to:

       - In `beforeAll`: instantiate a new `InMemoryStorageAdapter`, call `__setStorageAdapterForTests(adapter)` (imported from `@contexts/catalog/infrastructure/photo-storage`), and stash the adapter on a module-local closure so the consumer can read it.
       - In `afterAll`: call `__setStorageAdapterForTests(null)` to restore the real factory.
       - Return an object `{ getAdapter(): InMemoryStorageAdapter }` so the consuming test can assert on stored bytes.

       Pattern reference: `tests/integration/photo-upload.integration.test.ts:155-200` (reads `__setStorageAdapterForTests` once in `beforeAll`, restores to `null` in the symmetric teardown). Do NOT call `__setStorageAdapterForTests` from a global setup — it MUST be opt-in per file.

       Example call site (do NOT add this anywhere yet — just for executor's mental model):

       ```typescript
       // In a future Phase 5 catalog integration test file:
       import { useInMemoryStorageAdapter } from "../fixtures/use-in-memory-storage-adapter";
       describe("create-plant", () => {
         const storage = useInMemoryStorageAdapter();
         it("compensates on TX rollback", async () => {
           // ... uses storage.getAdapter() to assert stored buffers
         });
       });
       ```

    Do NOT touch `tests/integration/global-setup.ts` (Phase 1 plan 01-04 lock — see file header comment). Do NOT create a `tests/integration/setup.ts` (the wording in CONTEXT.md / VALIDATION.md is aspirational; the project's actual setup file is named `global-setup.ts` per `vitest.config.ts:41`, and it MUST stay a marker per the file's own comment). Do NOT alter `tests/integration/storage-adapter.integration.test.ts` or `storage-buckets.integration.test.ts` — those tests must continue to exercise the REAL Supabase adapter and a global swap would break them.
  </action>
  <verify>
    <automated>test -f tests/integration/fixtures/in-memory-storage-adapter.ts &amp;&amp; test -f tests/integration/fixtures/use-in-memory-storage-adapter.ts &amp;&amp; grep -F "implements StorageAdapter" tests/integration/fixtures/in-memory-storage-adapter.ts &amp;&amp; grep -F "__setStorageAdapterForTests" tests/integration/fixtures/use-in-memory-storage-adapter.ts &amp;&amp; pnpm exec tsc --noEmit 2>&amp;1 | tail -5</automated>
  </verify>
  <done>
    `InMemoryStorageAdapter` class compiles cleanly and implements every method on `StorageAdapter` (no `any`/`unknown` casts). `useInMemoryStorageAdapter()` helper imports `__setStorageAdapterForTests` from the catalog photo-storage seam (literal substring present). `pnpm exec tsc --noEmit` passes. No global setup file is modified. Existing integration tests continue to compile (typecheck-clean).
  </done>
</task>

<task type="auto">
  <name>Task 3: Ship Playwright authedUser + readOnly fixtures for Phase 5 catalog specs</name>
  <files>tests/e2e/fixtures/authed-user.ts, tests/e2e/fixtures/read-only.ts</files>
  <action>
    Per D-26 + D-21 (CONTEXT.md). Both fixtures use Playwright's `test.extend` API to ship a single authenticated browser context that downstream Phase 5 specs (05-15..05-18) consume directly. Read `tests/e2e/auth-login-logout.spec.ts:1-31` for the `sb-{ref}-auth-token` cookie shape, `tests/integration/fixtures/seed-user.ts` for the seed primitive being reused, and `tests/integration/fixtures/seed-policy-version.ts` for the policy-version helper.

    **Cloud-Supabase guard (BLOCKING):** both fixtures MUST throw on startup if `process.env.DATABASE_POOL_URL` matches `/supabase\.co/` (mirror the literal pattern from `tests/integration/setup-supabase-truncate.ts:14-18`). This guard prevents an accidental run against cloud Supabase from creating throwaway accounts in production.

    1. Create `tests/e2e/fixtures/authed-user.ts` exporting Playwright's `test` and `expect` extended with an `authedUser` fixture. The fixture's lifecycle (per spec):

       a) **Generate a unique email** like `playwright-authed-${Date.now()}-${Math.random().toString(16).slice(2)}@folhario.test`. Password literal `TestPassword123!` (matches `tests/e2e/auth-login-logout.spec.ts:68`).

       b) **Seed the user** by importing `seedUser` from `tests/integration/fixtures/seed-user.ts` and calling it with `{ email, password, emailVerifiedAt: new Date().toISOString(), ageConfirmedAt: new Date().toISOString(), trialSource: "organic" }`. This creates `auth.users` (via `supabase.auth.admin.createUser`) AND `public.users` (verified, age-confirmed). Returns `{ id: userId }`.

       c) **Insert ConsentLog × 2** via direct `postgres-js`. First, look up the current T&C and Privacy policy_version IDs by reading them from `policy_versions` where `is_current = true` and `document_type IN ('terms_of_service','privacy_policy')` — confirm the EXACT helper export from `tests/integration/fixtures/seed-policy-version.ts` at write time (Read the file — outline calls it `seedCurrentPolicyVersions` but verify; if there's a `getCurrentPolicyVersionIds()` or similar reuse it, otherwise inline two `SELECT id FROM policy_versions WHERE is_current = true AND document_type = $1` queries). Insert one `consent_logs` row per policy_version_id with: `purpose='signup_acceptance'`, `legal_basis='consent'` (or whatever Phase 4 signup uses — verify via grep on `tests/integration/iam-signup.integration.test.ts:117` at write time), `source='signup'`, `granted_at = now()`, `revoked_at = null`. Two rows total (D-26).

       d) **Insert Subscription** via direct `postgres-js`: `INSERT INTO subscriptions (user_id, provider, status, trial_start_date, trial_end_date) VALUES (${userId}, 'stripe', 'trialing', NOW(), NOW() + INTERVAL '14 days')`. All four NOT NULL columns are set per the schema in `<interfaces>`.

       e) **Mint Supabase SSR cookies** by calling `supabase.auth.signInWithPassword({email, password})` server-side using the Supabase JS client (NOT the admin client — `signInWithPassword` is the standard auth flow that returns `data.session` containing `access_token`, `refresh_token`, `expires_at`, `user`, etc.). Construct the SSR cookie payload by JSON-stringifying the session object and base64url-encoding it with the `base64-` prefix (the chunked-cookie format Supabase SSR uses — see `tests/e2e/auth-login-logout.spec.ts:5-31` for the exact decoding shape; reverse it for encoding). The cookie name is `sb-${projectRef}-auth-token` where `projectRef` is the URL host's first DNS label (e.g. `https://abc.supabase.co/` → `abc`; for local supabase URLs like `http://127.0.0.1:54321` use the literal host or the well-known local ref — confirm via `process.env.NEXT_PUBLIC_SUPABASE_URL` parsing at write time).

       f) **Inject the cookie** via `context.addCookies([{ name, value, domain: '127.0.0.1', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }])` (or `localhost` if that's what `playwright.config.ts:70` sets — `baseURL: "http://localhost:3000"` says `localhost`, use that). The cookie chunking logic (`.0`, `.1`, ...) only matters if the encoded payload exceeds 4096 bytes — for a freshly-minted session this is uncommon; if the encoded blob exceeds 4000 bytes, split into chunks at exactly 3500-char boundaries and inject each as `sb-{ref}-auth-token.${index}`. Otherwise inject as a single `sb-{ref}-auth-token` cookie.

       g) **Cleanup** (in the fixture's teardown after the test): DELETE FROM `public.users` WHERE id = ${userId} — the cascade FKs handle subscriptions, consent_logs, etc. Then DELETE FROM `auth.users` WHERE id = ${userId} (no CASCADE on the auth-schema-owned sequences; mirror the literal pattern from `tests/integration/setup-supabase-truncate.ts:29-37`). Tolerate "row not found" silently.

       Export shape:

       ```typescript
       import { test as base, expect } from "@playwright/test";
       export type AuthedUser = { id: string; email: string };
       export const test = base.extend<{ authedUser: AuthedUser }>({
         authedUser: async ({ context }, use) => {
           // ... seed + cookie injection
           await use(authedUser);
           // ... cleanup
         },
       });
       export { expect };
       ```

       Specs consuming the fixture import `{ test, expect }` from this file instead of `@playwright/test`. The `context` parameter is the Playwright BrowserContext per spec; `addCookies` runs against it.

    2. Create `tests/e2e/fixtures/read-only.ts` per D-21. This fixture extends `authedUser` (NOT a separate seed — the same authed user is in read-only mode) and sets cookie `__test_subscription_read_only=1` via `await page.context().addCookies(...)`. The `useSubscription` stub (plan 05-11) reads this cookie via Next's `cookies()` server-side, but ONLY when `process.env.ENABLE_TEST_ROUTES === '1'` — that env var is already set in `playwright.config.ts` `webServer.env` and is absent in production, so the cookie is ignored entirely outside of E2E runs. **Important: this plan does NOT modify the webServer.env at runtime — Playwright cannot mutate `webServer.env` per-spec.** The cookie is the only per-spec mechanism available.

       Shape:

       ```typescript
       import { test as authedTest, expect } from "./authed-user";
       export const test = authedTest.extend({
         readOnly: [async ({ context }, use) => {
           await context.addCookies([{
             name: "__test_subscription_read_only",
             value: "1",
             domain: "localhost",
             path: "/",
             httpOnly: false,  // stub reads via cookies(); no XSS risk on a test cookie
             secure: false,
             sameSite: "Lax",
           }]);
           await use(true);
         }, { auto: true }],
       });
       export { expect };
       ```

       The `auto: true` Playwright option ensures the cookie is set for every test that imports from this file without requiring the test to explicitly destructure `readOnly`. Specs that want read-only behavior import from `./read-only`; specs that want active-subscription behavior import from `./authed-user`.

    Do NOT modify `playwright.config.ts` `webServer.env` (Playwright cannot apply per-spec env-var changes mid-run; the cookie approach is the only per-test mechanism). Do NOT introduce any second auth pattern — reuse Supabase Auth via `signInWithPassword` and the existing `seedUser` primitive. Do NOT call the test JWKS pattern (`AUTH_JWKS_OVERRIDE_URL`) — that path is Bearer-only and won't mint SSR cookies.

    **Service-role secret hygiene (threat T-05-01 mitigation — see `<threat_model>` below):** the fixture imports `seedUser` which reads `process.env.SUPABASE_SERVICE_ROLE_KEY`. Add a header-comment block to `authed-user.ts` stating: "TEST-ONLY. This file MUST NOT be imported from `src/`. The service-role key is read indirectly via `seedUser`; production builds never load `tests/`." Add a `tests/unit/banned-patterns-snapshot.test.ts`-style assertion entry IF and only if the existing test already enforces `tests/` non-imports from `src/` (verify via grep at write time — read the file briefly; if no such assertion exists, do NOT add one in this plan, just keep the comment).
  </action>
  <verify>
    <automated>test -f tests/e2e/fixtures/authed-user.ts &amp;&amp; test -f tests/e2e/fixtures/read-only.ts &amp;&amp; grep -F "supabase.co" tests/e2e/fixtures/authed-user.ts &amp;&amp; grep -F "trialing" tests/e2e/fixtures/authed-user.ts &amp;&amp; grep -E "sb-[^.]*-auth-token" tests/e2e/fixtures/authed-user.ts &amp;&amp; grep -F "__test_subscription_read_only" tests/e2e/fixtures/read-only.ts &amp;&amp; grep -F "test.extend" tests/e2e/fixtures/read-only.ts &amp;&amp; pnpm exec tsc --noEmit 2>&amp;1 | tail -5</automated>
  </verify>
  <done>
    `tests/e2e/fixtures/authed-user.ts` exports `{ test, expect }` extending `@playwright/test` with an `authedUser` fixture; the file contains the cloud-Supabase guard literal `supabase.co`, the `trialing` subscription status literal, and the `sb-` cookie name pattern. `tests/e2e/fixtures/read-only.ts` extends authedUser and sets the `__test_subscription_read_only` cookie via `context.addCookies`. `pnpm exec tsc --noEmit` passes. The fixtures do not import anything from `src/`. No changes to `playwright.config.ts`. Existing E2E specs continue to typecheck. (E2E green-run is not asserted here — the consumer specs are 05-15..05-18; this plan ships the fixtures as structural artifacts that those plans then exercise.)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test-runtime → service-role secret | `seedUser` (reused by authedUser fixture) reads `SUPABASE_SERVICE_ROLE_KEY`. The test fixture lives under `tests/` and must NEVER be imported from `src/`. |
| Test-runtime → local Supabase only | Both fixtures must refuse to run against cloud Supabase (the project's existing `tests/integration/setup-supabase-truncate.ts:14-18` `supabase.co` guard pattern). |

## STRIDE Threat Register

This plan ships only test infrastructure; the surface is narrow. Block-on-high posture honored per ASVS L1.

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | I (Information Disclosure) | `tests/e2e/fixtures/authed-user.ts` reads `SUPABASE_SERVICE_ROLE_KEY` indirectly via `seedUser`. If the file were ever bundled into a production build, the service-role secret would leak. | mitigate | (a) File path is under `tests/` which Next does not include in `src/`-rooted builds; (b) Comment header on `authed-user.ts` literally states "TEST-ONLY. MUST NOT be imported from src/."; (c) Verify-time grep gate on the verify command does not assert non-import (deferred to a future banned-patterns test if not already enforced). |
| T-05-02 | T (Tampering) | Cloud Supabase database mutated by a misconfigured CI run | mitigate | Both fixtures throw on startup if `DATABASE_POOL_URL` matches `/supabase\.co/`, mirroring the existing pattern from `setup-supabase-truncate.ts:14-18`. |
| T-05-03 | I | The opt-in `InMemoryStorageAdapter` could accidentally be swapped globally and hide a real-Storage regression | mitigate | The adapter is shipped as a fixture + per-file opt-in helper. `tests/integration/global-setup.ts` is NOT modified (Phase 1 plan 01-04 lock). The two real-Storage integration tests (`storage-adapter.*`, `storage-buckets.*`) continue to run against the real adapter. |
| T-05-04 | E (Elevation) | The `readOnly` fixture sets a non-httpOnly cookie | accept | The cookie is local-host only, exists only during E2E runs (Playwright wipes contexts between tests), and the consumer (05-11 stub) will treat its presence as a UI state hint only when ENABLE_TEST_ROUTES=1 (absent in production). The auth check is unaffected. No production code path consumes this cookie name. |
</threat_model>

<verification>
**Per-task `<automated>` commands cover the structural fixtures.** Wave 0 owns no behavior beyond "fixtures exist and compile" — the actual consumers (catalog repository tests in 05-03, manual-add E2E in 05-17, offline browsing in 05-18) verify that the fixtures work end-to-end. This plan's success means the fixtures are PRESENT, TYPECHECK-CLEAN, and FOLLOW the project's existing patterns.

**Suite-level checks:**
- `pnpm test:unit` continues to pass (Task 1 verify).
- `pnpm exec tsc --noEmit` passes for all 6 new/modified files (Tasks 2 + 3 verify).
- No existing test suite is broken (no global setup changes, no real-Storage adapter swap).

**VALIDATION.md Wave 0 checkboxes covered by this plan:**
- [x] `tests/unit/setup-idb.ts` — Task 1
- [DEFER] `tests/integration/setup.ts` — does NOT exist; opt-in fixture pattern used instead (Task 2). Outline note: VALIDATION.md line 114 wording is updated to reflect the opt-in fixture in this plan's SUMMARY.
- [DEFER] `tests/integration/db-rollback.ts` — moved to plan 05-02 per outline guidance (the new tables don't exist yet).
- [x] `tests/e2e/fixtures/authed-user.ts` — Task 3
- [x] `tests/e2e/fixtures/read-only.ts` — Task 3
- [x] `pnpm add -D fake-indexeddb` — Task 1
- [PARTIAL] `pnpm add @tanstack/react-query @tanstack/query-async-storage-persister idb-keyval` — DEFERRED to plan 05-10 per chunked instructions.
- [DEFER] `tests/e2e/axe-placeholder-pages.spec.ts` route extension — UI plans 05-15..05-18 add their routes as they ship.

**Source-audit posture:** this plan owns no Phase 5 REQ ID (foundation — see outline). It unblocks every later plan's automated `<verify>` block. No source items are silently dropped — only the items explicitly deferred to 05-02 (db-rollback) and 05-10 (TanStack/idb-keyval) are out of this plan's scope, and both deferrals are documented in the outline and reaffirmed here.
</verification>

<success_criteria>
- [ ] `fake-indexeddb` is installed as a `devDependency` in `package.json`.
- [ ] `tests/unit/setup-idb.ts` exists and contains `import "fake-indexeddb/auto"` plus a `beforeEach` that calls `new IDBFactory()`.
- [ ] `vitest.config.ts` `unit-dom` project's `setupFiles` array includes `tests/unit/setup-idb.ts` alongside the existing `setup-env.ts`.
- [ ] `pnpm test:unit` continues to run green (existing unit-dom tests don't regress).
- [ ] `tests/integration/fixtures/in-memory-storage-adapter.ts` exports a class implementing every method on `StorageAdapter` from `src/shared/adapters/storage.ts`.
- [ ] `tests/integration/fixtures/use-in-memory-storage-adapter.ts` exports an opt-in helper that calls `__setStorageAdapterForTests(adapter)` in `beforeAll` and `__setStorageAdapterForTests(null)` in `afterAll`.
- [ ] No global integration-test setup file is modified (Phase 1 plan 01-04 lock preserved); existing real-Storage integration tests continue to compile.
- [ ] `tests/e2e/fixtures/authed-user.ts` exports `{ test, expect }` with an `authedUser` fixture that seeds a verified `public.users` row, two `consent_logs` rows (T&C + Privacy), one `subscriptions` row (`status='trialing'`, `provider='stripe'`, 14-day window), and injects Supabase SSR session cookies via `context.addCookies`.
- [ ] `tests/e2e/fixtures/read-only.ts` extends `authed-user.ts` and sets cookie `__test_subscription_read_only=1` via `context.addCookies` (honored by 05-11 stub only when `ENABLE_TEST_ROUTES=1`; the consumer stub is wired in plan 05-11).
- [ ] Both Playwright fixtures throw on startup if `DATABASE_POOL_URL` matches `supabase.co`.
- [ ] `pnpm exec tsc --noEmit` passes after all changes.
- [ ] No file under `src/` imports anything from `tests/`.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-01-SUMMARY.md` documenting:
- Each artifact's exact path and provided contract.
- The fixture-path / auth-strategy decision (opt-in InMemoryStorageAdapter; SSR-cookie-based authedUser via signInWithPassword) and the deviations from CONTEXT.md / VALIDATION.md wording (`tests/integration/setup.ts` does not exist; `tests/integration/db-rollback.ts` deferred to 05-02; TanStack/idb-keyval deps deferred to 05-10).
- Confirmed file path of the policy-version helper that `seed-policy-version.ts` exports (verified at write time during Task 3).
- Any non-obvious adjustments to fixture cookie shape (chunking threshold, project-ref derivation rule).
</output>
