---
phase: 05-catalog-meu-jardim
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - package.json
  - tests/helpers/db-guard.ts
  - tests/helpers/transaction-rollback.ts
  - tests/helpers/axe-helper.ts
  - tests/helpers/playwright-auth-bypass.ts
  - tests/helpers/inngest-stub.ts
  - tests/helpers/idb-test-setup.ts
  - tests/unit/contexts/catalog/.gitkeep
  - tests/unit/contexts/billing/.gitkeep
  - tests/unit/shared/ui/.gitkeep
  - tests/integration/catalog/.gitkeep
  - tests/e2e/catalog/.gitkeep
  - tests/e2e/home/.gitkeep
  - tests/unit/idb-polyfill-smoke.test.ts
  - vitest.config.ts
autonomous: true
requirements: []
decisions:
  rationale: "Wave 0 test infrastructure plan; pure test-harness bootstrap, covers no requirement IDs directly. Required by every Phase 5 plan that ships a test."
  axe_helper_export: "expectNoA11yViolations(page, includeSelector?)"
  fake_indexeddb_setup: "registered globally in vitest unit project setupFiles for jsdom IDB polyfill; integration project intentionally does NOT load it"
  transaction_rollback_pattern: "wraps test body in sql.begin(async (tx) => { ...; throw new Rollback() }) per Phase 2 D-43"
  playwright_auth_bypass_strategy: "contract stub that throws until Phase 4 lands AuthAdapter; Phase 4 plans flip the body without API churn"
must_haves:
  truths:
    - "Catalog unit/integration/E2E test directories exist (empty .gitkeep) so subsequent plans can land tests immediately"
    - "fake-indexeddb is installed and globally polyfilled in the unit Vitest project so the TanStack Query persister (5b) can be tested in jsdom"
    - "@axe-core/playwright is installed and exposed via tests/helpers/axe-helper.ts as expectNoA11yViolations(page) for E2E a11y assertions"
    - "transactional-rollback test fixture exists at tests/helpers/transaction-rollback.ts implementing Phase 2 D-43 contract"
    - "Playwright auth-bypass fixture exists at tests/helpers/playwright-auth-bypass.ts (contract stub returning a verified test-user JWT once Phase 4 lands) so E2E plans can sign requests"
    - "Inngest send-event stub exists at tests/helpers/inngest-stub.ts so use-case unit tests can capture event payloads without booting Inngest"
    - "DB-guard helper exists at tests/helpers/db-guard.ts (replaces inline Supabase URL guard from existing integration tests)"
  artifacts:
    - path: "package.json"
      provides: "@axe-core/playwright + fake-indexeddb installed as devDependencies (exact version pins per Phase 1 D-04 / Plan 01-04 commits)"
      contains: "@axe-core/playwright"
    - path: "tests/helpers/db-guard.ts"
      provides: "assertLocalDb() — throws when DATABASE_POOL_URL points at *.supabase.co"
      min_lines: 10
    - path: "tests/helpers/transaction-rollback.ts"
      provides: "withRollback(sql, fn) helper that wraps integration test body in sql.begin + always-throw Rollback"
      min_lines: 20
    - path: "tests/helpers/axe-helper.ts"
      provides: "expectNoA11yViolations(page, includeSelector?) wrapper around AxeBuilder"
      min_lines: 12
    - path: "tests/helpers/playwright-auth-bypass.ts"
      provides: "createVerifiedUserSession(page) returning Promise<{ jwt, userId }> for E2E use"
      min_lines: 12
    - path: "tests/helpers/inngest-stub.ts"
      provides: "createInngestSendStub() returning { send, captured, reset } so use-case tests can intercept event dispatch"
      min_lines: 15
    - path: "tests/helpers/idb-test-setup.ts"
      provides: "import side-effect that polyfills IndexedDB in jsdom via fake-indexeddb"
      min_lines: 3
    - path: "tests/unit/idb-polyfill-smoke.test.ts"
      provides: "smoke test confirming the IDB polyfill works inside the unit project"
      min_lines: 15
    - path: "vitest.config.ts"
      provides: "unit project setupFiles includes tests/helpers/idb-test-setup.ts so IDB is polyfilled for every unit test"
      contains: "idb-test-setup"
  key_links:
    - from: "vitest.config.ts"
      to: "tests/helpers/idb-test-setup.ts"
      via: "unit project setupFiles array entry"
      pattern: "setupFiles.*idb-test-setup"
    - from: "tests/helpers/playwright-auth-bypass.ts"
      to: "Phase 4 AuthAdapter / Supabase auth"
      via: "contract stub matching the production token shape; Phase 4 swaps the body in"
      pattern: "createVerifiedUserSession"
    - from: "tests/helpers/inngest-stub.ts"
      to: "Phase 4 Inngest client (consumed by 05-06 catalog/cleanup-storage tests)"
      via: "stub matching inngest.send signature"
      pattern: "createInngestSendStub"
---

<objective>
Wave 0 test infrastructure for all of Phase 5 batch 5a (and inherited by 5b later). Installs @axe-core/playwright + fake-indexeddb, creates the catalog test directories, and lands six shared test helpers (db-guard, transaction-rollback, axe, playwright-auth-bypass, inngest-stub, idb-test-setup) so every subsequent plan can write tests without re-bootstrapping infrastructure.

Purpose: Phase 2 D-43 mandates transaction-rollback integration tests; the pattern requires a shared helper rather than inline duplication. Phase 5 RESEARCH § Validation Architecture mandates axe-core for every UI surface and fake-indexeddb for the TanStack Query persister tests. The Playwright auth-bypass + Inngest send-stub helpers eliminate per-plan bootstrap.

Output: package.json updated with two devDependencies, six helper modules under tests/helpers/, six .gitkeep directory placeholders, one IDB-polyfill smoke test, vitest.config.ts patched to load fake-indexeddb in the unit project setupFiles.
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
@.planning/phases/02-data-layer/02-CONTEXT.md

<interfaces>
<!-- Existing test patterns extracted from on-disk files. Executor should follow these exactly. -->

From tests/integration/postgres-connection.integration.test.ts (lines 1-34):
```ts
const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase. Use local Supabase only.",
  );
}

describe.skipIf(!dbUrl)("postgres-connection", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });
});
```

From tests/integration/diagnostics-server-probe.integration.test.ts (lines 11-33):
```ts
vi.mock("posthog-node", () => ({
  PostHog: function MockPostHog() {
    return { capture: captureMock, shutdown: shutdownMock };
  },
}));
```

From package.json scripts (lines 10-13):
```json
"test:unit": "pnpm exec vitest --run --project=unit",
"test:integration": "pnpm exec vitest --run --project=integration",
"test:e2e": "playwright test",
```

From vitest.config.ts (current state — extend existing unit project setupFiles):
- The unit project already has setupFiles: ["tests/unit/setup-env.ts"] (per Plan 01-04 fix)
- Phase 5 ADDS "tests/helpers/idb-test-setup.ts" to the same array, NOT a new project
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install @axe-core/playwright + fake-indexeddb as devDependencies (exact pins)</name>
  <files>package.json, pnpm-lock.yaml</files>
  <read_first>
    - package.json (current devDependencies block, lines 39-58 — verify the exact-pin convention from Phase 1 D-04 / Plan 01-04: `next: "16.2.3"`, `vitest: "4.1.4"`, NOT `"^x.y"`)
    - .planning/STATE.md "Plan 01-04: postgres@3.4.9 pinned exactly (not '3' or '^3.x') as PRODUCTION dependency" — this is the convention
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Standard Stack table (`@axe-core/playwright` 4.10.x, `fake-indexeddb` latest)
  </read_first>
  <action>
    1. Resolve current versions via npm registry:
       - `npm view @axe-core/playwright version` → expect 4.10.x or newer (verify at task time)
       - `npm view fake-indexeddb version` → expect 6.x or newer (verify at task time)
    2. Add to package.json `devDependencies` (alphabetical order, EXACT pin, no `^`):
       - `"@axe-core/playwright": "<resolved-version>"`
       - `"fake-indexeddb": "<resolved-version>"`
    3. Run `pnpm install` to update pnpm-lock.yaml.
    4. Verify the installation: `pnpm exec playwright --version` still works AND `node -e "require('fake-indexeddb/auto')"` exits 0.

    Do NOT install `vaul` here — Phase 5 batch 5b will decide based on Wave 0 a11y outcomes (Open Q5 resolution lives in 5b).
    Do NOT install TanStack Query packages here — those land in 5b plan 05.2-01.
  </action>
  <acceptance_criteria>
    - `package.json` devDependencies contains `@axe-core/playwright` with no `^` or `~` prefix on the version
    - `package.json` devDependencies contains `fake-indexeddb` with no `^` or `~` prefix on the version
    - `node -e "require('@axe-core/playwright')"` exits 0
    - `node -e "require('fake-indexeddb/auto')"` exits 0
    - `pnpm exec playwright --version` exits 0 (existing Playwright install not broken)
  </acceptance_criteria>
  <verify>
    <automated>node -e "const p=require('./package.json'); if(!p.devDependencies['@axe-core/playwright']) process.exit(1); if(!p.devDependencies['fake-indexeddb']) process.exit(2); if(/^[\^~]/.test(p.devDependencies['@axe-core/playwright'])) process.exit(3); if(/^[\^~]/.test(p.devDependencies['fake-indexeddb'])) process.exit(4);"</automated>
  </verify>
  <done>package.json devDependencies contains exact-pinned `@axe-core/playwright` and `fake-indexeddb` (no `^`/`~`), pnpm-lock.yaml updated, both packages resolvable.</done>
</task>

<task type="auto">
  <name>Task 2: Create six shared test helpers under tests/helpers/ + the empty test directories</name>
  <files>
    tests/helpers/db-guard.ts,
    tests/helpers/transaction-rollback.ts,
    tests/helpers/axe-helper.ts,
    tests/helpers/playwright-auth-bypass.ts,
    tests/helpers/inngest-stub.ts,
    tests/helpers/idb-test-setup.ts,
    tests/unit/contexts/catalog/.gitkeep,
    tests/unit/contexts/billing/.gitkeep,
    tests/unit/shared/ui/.gitkeep,
    tests/integration/catalog/.gitkeep,
    tests/e2e/catalog/.gitkeep,
    tests/e2e/home/.gitkeep
  </files>
  <read_first>
    - tests/integration/postgres-connection.integration.test.ts:1-34 (the inline guard + sql.begin pattern this helper extracts)
    - tests/integration/diagnostics-server-probe.integration.test.ts:1-74 (vi.mock convention this helper informs)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-43 (transaction-rollback contract: "Integration tests use transaction rollback per test")
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "Integration tests under tests/integration/catalog/*.integration.test.ts" (Phase 5 SHOULD extract a shared helper once 5+ catalog integration tests land)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Common Pitfalls 4 (post-commit event dispatch failure) — informs the inngest-stub design (must be able to capture and assert event payloads)
  </read_first>
  <action>
    Create six helper modules with the EXACT shapes below. Use Write tool, no heredoc.

    **tests/helpers/db-guard.ts** (~12 lines):
    ```ts
    export function assertLocalDb(): string {
      const dbUrl = process.env.DATABASE_POOL_URL;
      if (!dbUrl) {
        throw new Error("DATABASE_POOL_URL is not set; integration tests require a local Postgres URL.");
      }
      if (/supabase\.co/.test(dbUrl)) {
        throw new Error(
          "Refusing to run integration tests against cloud Supabase. Use local Supabase only.",
        );
      }
      return dbUrl;
    }
    ```

    **tests/helpers/transaction-rollback.ts** (~30 lines): expose `withRollback(sql, fn)` that wraps `fn(tx)` inside `sql.begin(async (tx) => { ...; throw new Rollback() })` and SWALLOWS the Rollback marker so the assertion exception (if any) surfaces:
    ```ts
    import type { Sql } from "postgres";

    class Rollback extends Error {
      constructor() {
        super("__rollback__");
        this.name = "Rollback";
      }
    }

    export async function withRollback<T>(
      sql: Sql,
      fn: (tx: Sql) => Promise<T>,
    ): Promise<T> {
      let result: T | undefined;
      let captured: unknown;
      try {
        await sql.begin(async (tx) => {
          try {
            result = await fn(tx as unknown as Sql);
          } catch (err) {
            captured = err;
          }
          throw new Rollback();
        });
      } catch (err) {
        if (!(err instanceof Rollback) && (!(err instanceof Error) || err.name !== "Rollback")) {
          throw err;
        }
      }
      if (captured) throw captured;
      return result as T;
    }
    ```

    **tests/helpers/axe-helper.ts** (~14 lines):
    ```ts
    import type { Page } from "@playwright/test";
    import { expect } from "@playwright/test";
    import AxeBuilder from "@axe-core/playwright";

    export async function expectNoA11yViolations(
      page: Page,
      includeSelector?: string,
    ): Promise<void> {
      const builder = new AxeBuilder({ page });
      if (includeSelector) builder.include(includeSelector);
      const results = await builder.analyze();
      expect(results.violations).toEqual([]);
    }
    ```

    **tests/helpers/playwright-auth-bypass.ts** (~14 lines): contract-first stub. Phase 4 will swap the body to a real test-only sign-in call or deterministic JWT mint; zero call-site changes required because the API surface is fixed:
    ```ts
    import type { Page } from "@playwright/test";

    export type VerifiedUserSession = { jwt: string; userId: string };

    export async function createVerifiedUserSession(
      _page: Page,
    ): Promise<VerifiedUserSession> {
      throw new Error(
        "createVerifiedUserSession not implemented — Phase 4 AuthAdapter must land first. " +
          "After Phase 4: replace this body with a call to the test-only sign-in endpoint or a deterministic JWT mint.",
      );
    }
    ```

    **tests/helpers/inngest-stub.ts** (~22 lines):
    ```ts
    import { vi } from "vitest";

    export type CapturedInngestEvent = { name: string; data: unknown };

    export function createInngestSendStub(): {
      send: (event: CapturedInngestEvent | CapturedInngestEvent[]) => Promise<void>;
      captured: CapturedInngestEvent[];
      reset: () => void;
    } {
      const captured: CapturedInngestEvent[] = [];
      const send = vi.fn(async (event: CapturedInngestEvent | CapturedInngestEvent[]) => {
        const events = Array.isArray(event) ? event : [event];
        captured.push(...events);
      });
      return {
        send,
        captured,
        reset: () => {
          captured.length = 0;
          send.mockClear();
        },
      };
    }
    ```

    **tests/helpers/idb-test-setup.ts** (~3 lines):
    ```ts
    // Polyfill IndexedDB in jsdom for unit tests that touch idb-keyval / TanStack Query persister.
    // Imported as a setup file in the vitest unit project (see vitest.config.ts).
    import "fake-indexeddb/auto";
    ```

    For each `.gitkeep` file: write a single-line file containing ONLY the comment `# placeholder for Phase 5 catalog tests` so git tracks the directory.
  </action>
  <acceptance_criteria>
    - All 12 listed files exist on disk
    - `tests/helpers/db-guard.ts` exports `assertLocalDb` (grep for `export function assertLocalDb`)
    - `tests/helpers/transaction-rollback.ts` exports `withRollback` (grep for `export async function withRollback`)
    - `tests/helpers/axe-helper.ts` exports `expectNoA11yViolations` (grep for `export async function expectNoA11yViolations`)
    - `tests/helpers/playwright-auth-bypass.ts` exports `createVerifiedUserSession` and `VerifiedUserSession` type
    - `tests/helpers/inngest-stub.ts` exports `createInngestSendStub` and `CapturedInngestEvent` type
    - `tests/helpers/idb-test-setup.ts` contains literal `import "fake-indexeddb/auto"` (1 line of code, not a function)
    - `pnpm exec tsc --noEmit` exits 0 (helpers compile cleanly under project tsconfig)
  </acceptance_criteria>
  <verify>
    <automated>node -e "['tests/helpers/db-guard.ts','tests/helpers/transaction-rollback.ts','tests/helpers/axe-helper.ts','tests/helpers/playwright-auth-bypass.ts','tests/helpers/inngest-stub.ts','tests/helpers/idb-test-setup.ts','tests/unit/contexts/catalog/.gitkeep','tests/unit/contexts/billing/.gitkeep','tests/unit/shared/ui/.gitkeep','tests/integration/catalog/.gitkeep','tests/e2e/catalog/.gitkeep','tests/e2e/home/.gitkeep'].forEach(f => { if(!require('fs').existsSync(f)) { console.error('missing',f); process.exit(1); } });" && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>All six helper modules exist with the exact named exports (assertLocalDb, withRollback, expectNoA11yViolations, createVerifiedUserSession, createInngestSendStub) and all six .gitkeep files exist. tsc --noEmit passes.</done>
</task>

<task type="auto">
  <name>Task 3: Wire fake-indexeddb into vitest unit project setupFiles + smoke-test it</name>
  <files>vitest.config.ts, tests/unit/idb-polyfill-smoke.test.ts</files>
  <read_first>
    - vitest.config.ts (current file — find the `unit` project block; it currently has `setupFiles: ["tests/unit/setup-env.ts"]` per Plan 01-04 fix; the integration project must NOT receive the IDB polyfill)
    - .planning/STATE.md "Plan 01-04: Moved Plan 01-02's root-level vitest.config.ts setupFiles ... INTO the unit project block only" — this proves the unit/integration split is load-bearing
    - tests/unit/setup-env.ts (the existing setup file; understand its shape so the new entry follows convention)
  </read_first>
  <action>
    1. Edit vitest.config.ts: in the `unit` project's `setupFiles` array, ADD `"tests/helpers/idb-test-setup.ts"` AFTER the existing `"tests/unit/setup-env.ts"` entry. Resulting array: `setupFiles: ["tests/unit/setup-env.ts", "tests/helpers/idb-test-setup.ts"]`. Do NOT add to the integration project (integration tests use real Postgres, not IDB).

    2. Create a smoke test at `tests/unit/idb-polyfill-smoke.test.ts` (~18 lines) proving the polyfill works:
    ```ts
    import { describe, it, expect } from "vitest";

    describe("idb-polyfill-smoke", () => {
      it("makes indexedDB available globally in jsdom", () => {
        expect(typeof indexedDB).toBe("object");
        expect(typeof indexedDB.open).toBe("function");
      });

      it("can open a database without throwing", async () => {
        const req = indexedDB.open("test-db", 1);
        await new Promise<void>((resolve, reject) => {
          req.onsuccess = () => {
            req.result.close();
            resolve();
          };
          req.onerror = () => reject(req.error);
        });
      });
    });
    ```

    3. Run `pnpm exec vitest --run --project=unit tests/unit/idb-polyfill-smoke.test.ts` and confirm both tests pass. Then run the full unit suite `pnpm test:unit` to confirm no regression in the existing 7 unit test files.
  </action>
  <acceptance_criteria>
    - `vitest.config.ts` contains literal string `tests/helpers/idb-test-setup.ts` inside the unit project's `setupFiles` array
    - `vitest.config.ts` integration project block does NOT reference `idb-test-setup` (grep -c for `idb-test-setup` within the integration project block returns 0)
    - `pnpm exec vitest --run --project=unit tests/unit/idb-polyfill-smoke.test.ts` exits 0 with 2 passing tests
    - `pnpm test:unit` exits 0 with at least 8 test files collected (the existing 7 + idb-polyfill-smoke)
    - `pnpm test:integration` exits 0 (no regression in existing integration suite)
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/idb-polyfill-smoke.test.ts && pnpm test:unit && pnpm test:integration</automated>
  </verify>
  <done>vitest.config.ts unit project setupFiles includes tests/helpers/idb-test-setup.ts; smoke test passes asserting `typeof indexedDB === "object"` AND opening a test DB succeeds; full unit + integration suites remain green (no regression).</done>
</task>

</tasks>

<threat_model>none</threat_model>
<!-- Rationale: pure test-harness bootstrap. No production code paths, no user data, no mutating endpoints, no storage operations. Helpers run only in test context. The Playwright auth-bypass helper (tests/helpers/playwright-auth-bypass.ts) is a contract stub that throws until Phase 4 lands; it cannot bypass auth in production because it cannot mint JWTs that the production AuthAdapter would accept. Per the planning_context security_threat_model_requirement: "Plans 05-01 (test infra) may declare <threat_model>none</threat_model> with rationale." -->

<verification>
After all three tasks land:
1. `pnpm test:unit` exits 0 (all unit tests including the new idb-polyfill-smoke pass).
2. `pnpm test:integration` exits 0 (no regression — the existing two integration tests still work).
3. `node -e "require('@axe-core/playwright')"` exits 0 (devDep installed).
4. `node -e "require('fake-indexeddb')"` exits 0 (devDep installed).
5. All six tests/helpers/*.ts files exist and export the named functions listed in `must_haves.artifacts`.
6. All six .gitkeep files exist.
7. `pnpm exec tsc --noEmit` exits 0.
</verification>

<success_criteria>
- @axe-core/playwright and fake-indexeddb installed at exact-pinned versions in package.json devDependencies (no `^`/`~`).
- Six helper modules under tests/helpers/ with the named exports specified in this plan.
- Six .gitkeep directory placeholders so subsequent plans drop test files in without git noise.
- vitest.config.ts unit project loads tests/helpers/idb-test-setup.ts as a setupFile.
- Smoke test tests/unit/idb-polyfill-smoke.test.ts passes, proving IDB is polyfilled in jsdom.
- Existing unit + integration test suites remain green (zero regression).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-01-SUMMARY.md` capturing:
- Resolved exact versions of @axe-core/playwright + fake-indexeddb at install time
- Confirmation that vitest unit project picks up fake-indexeddb but integration does NOT
- A note for Phase 4 implementer: tests/helpers/playwright-auth-bypass.ts has a stub body that throws — Phase 4 must replace `createVerifiedUserSession`'s body with a real JWT mint or test-only sign-in call; zero call-site changes required because the API surface is fixed
</output>
