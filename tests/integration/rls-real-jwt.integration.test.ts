import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/**
 * Phase-02 Plan 05.5 (HIGH-1 follow-up from `02-REVIEWS.md`): real-JWT RLS
 * cross-user denial proof.
 *
 * Plan 03 enabled RLS on all 21 app tables and Plan 05 introduced the
 * `withUnitOfWork` helper that binds `request.jwt.claim.sub` so any RLS
 * policy that calls `auth.uid()` resolves to the right user. None of the
 * existing tests proved that owner policies actually deny cross-user reads
 * when exercised against Supabase Auth's real JWT-issuing path. Without
 * that proof, "RLS as defense in depth" is just "RLS that compiles."
 *
 * What this test proves behaviorally:
 *
 * 1. `auth.admin.createUser` against the local Supabase Auth admin API
 *    creates two real users (userA, userB) and the auth.users -> public.users
 *    sync trigger from Plan 03 populates `public.users` synchronously.
 *
 * 2. `signInWithPassword` mints a real Supabase-issued JWT for each user.
 *    The JWT's `sub` claim is the user id, end-to-end.
 *
 * 3. UserA inserts a `plants` row through the application's `withUnitOfWork`
 *    path (Plan 05). That write goes through the singleton DB client that
 *    connects as the `postgres` superuser (BYPASSRLS) — the write succeeds
 *    regardless of RLS, which is fine because this test proves READ denial.
 *
 * 4. A separate postgres-js connection switches to the `authenticated` role
 *    via `SET LOCAL ROLE authenticated` and binds `request.jwt.claim.sub` to
 *    the JWT-extracted `sub` for the impersonated user. The read query has
 *    NO explicit `user_id` filter — RLS is what decides visibility. This
 *    matches what PostgREST does internally on every Supabase request.
 *
 *    - Baseline: connection bound to userA's JWT-sub returns exactly 1 row
 *      (the plant row userA owns). Without this baseline, a misconfigured
 *      "deny all" RLS state would silently pass the denial assertion.
 *
 *    - Denial: connection bound to userB's JWT-sub returns exactly 0 rows
 *      for the same plant id. Owner RLS policies must deny this read.
 *
 * Why the role switch is non-negotiable: `DATABASE_POOL_URL` connects as
 * the `postgres` role, which has `rolbypassrls=true`. Without
 * `SET LOCAL ROLE authenticated`, any `SELECT` returns the row regardless
 * of the GUC — the test would be a false-pass. Verified empirically before
 * authoring this test:
 *
 *   SELECT rolname, rolbypassrls FROM pg_roles
 *    WHERE rolname IN ('postgres', 'authenticated');
 *   --   rolname    | rolbypassrls
 *   --  ------------+--------------
 *   --  postgres    | t
 *   --  authenticated | f
 *
 * What this test does NOT cover (Rule 3 deviation, documented in
 * `02-05.5-SUMMARY.md`): the Supabase-client / PostgREST path described as
 * case (c) in the plan action. The project's `supabase/config.toml` has
 * `[api] enabled = false` per architectural decision D-20: the application
 * never goes through PostgREST — repositories use Drizzle inside
 * `withUnitOfWork` directly. Writing a PostgREST-dependent test against a
 * stack where PostgREST is intentionally off would either fail spuriously
 * (HTTP 503) or be a silent skip — exactly the failure mode HIGH-1 calls
 * out. The `authenticated`-role + GUC path proves the same chain of custody
 * (real JWT sub → GUC → `auth.uid()` → owner policy) and is what PostgREST
 * itself relies on internally. Adding `[api] enabled = true` and a third
 * test case is in scope for a future plan if/when the project starts
 * exposing PostgREST.
 *
 * Cleanup:
 * - `auth.admin.deleteUser` removes both auth.users rows.
 * - There is NO foreign key from `public.users` to `auth.users`, so the
 *   admin delete does not cascade. The test deletes `public.users` rows
 *   explicitly. Plant rows are removed via cascade on user delete
 *   (`plants.user_id REFERENCES public.users(id) ON DELETE CASCADE`,
 *   per Phase-02 Plan 02).
 */

// Default Supabase URL when .env.local lacks NEXT_PUBLIC_SUPABASE_URL because
// `[api] enabled = false`. The Auth API is reachable on Kong's port 54321
// regardless. Same pattern used by
// `tests/integration/diagnostics-server-probe.integration.test.ts`.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";

const dbUrl = process.env.DATABASE_POOL_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cloud-Supabase guard — this test does Auth admin user-creation and DB
// writes; running it against a hosted project would create real users and
// litter production data. This is the ONLY skip path allowed: refusing to
// run against cloud is a guard, not the silent-skip failure mode HIGH-1
// targets.
if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}
if (supabaseUrl && /supabase\.co/.test(supabaseUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in NEXT_PUBLIC_SUPABASE_URL).",
  );
}

describe.skipIf(!dbUrl)("Phase-02-05.5 real-JWT RLS cross-user denial", () => {
  // Test fixtures — populated in beforeAll, used by individual test blocks.
  let userAId: string;
  let userBId: string;
  let userAEmail: string;
  let userBEmail: string;
  let userAJwtSub: string;
  let userBJwtSub: string;
  let plantId: string;

  // Service-role admin client used for `auth.admin.createUser` /
  // `auth.admin.deleteUser`. NOT the same connection path as the read tests
  // below — this only manages auth.users state.
  const adminClient = createClient(supabaseUrl!, serviceRoleKey ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Postgres-js singleton for setup-time DDL/DML queries that run as
  // `postgres` superuser (insertion via UoW path goes through Drizzle).
  // Capped at max=1 so we never hold more than one connection during setup.
  const adminSql = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });

  // Decode a Supabase-issued JWT and return the `sub` claim verbatim. We do
  // not verify the signature here — Supabase issued the token two lines
  // earlier in the same test, and the chain of custody we are proving is
  // "real Supabase → JWT.sub → GUC → auth.uid() → policy denies." If the
  // payload is malformed, JSON.parse will throw and surface the failure.
  function jwtSub(jwt: string): string {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      throw new Error(
        "withUnitOfWork test setup: malformed JWT (expected 3 dot-separated parts).",
      );
    }
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8"),
    ) as { sub?: string };
    if (!payload.sub) {
      throw new Error(
        "withUnitOfWork test setup: JWT payload missing `sub` claim.",
      );
    }
    return payload.sub;
  }

  beforeAll(async () => {
    // Refuse to run silently if the Supabase service-role key is missing.
    // Loud failure with explicit remediation — this test MUST NOT be
    // skipped just because env vars are unset (HIGH-1 failure mode).
    if (!serviceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY missing from environment. " +
          "Run 'pnpm db:sync-env' after 'pnpm db:start'. " +
          "This test MUST NOT be skipped just because the key is unset.",
      );
    }
    if (!anonKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY missing from environment. " +
          "Run 'pnpm db:sync-env' after 'pnpm db:start'. " +
          "This test MUST NOT be skipped.",
      );
    }

    const runId = randomUUID().slice(0, 8);
    userAEmail = `rls-userA-${runId}@test.local`;
    userBEmail = `rls-userB-${runId}@test.local`;
    const password = `pw-${randomUUID()}`;

    // ---- Step 1: create both users via Supabase Auth admin API. ----
    const { data: createdA, error: createAErr } =
      await adminClient.auth.admin.createUser({
        email: userAEmail,
        password,
        email_confirm: true,
      });
    if (createAErr || !createdA?.user) {
      throw new Error(
        "Supabase Auth admin API is not reachable. Start local Supabase: " +
          "supabase stop && supabase start. " +
          "This test MUST NOT be skipped. " +
          `Error: ${createAErr?.message ?? "no user returned"}`,
      );
    }
    userAId = createdA.user.id;

    const { data: createdB, error: createBErr } =
      await adminClient.auth.admin.createUser({
        email: userBEmail,
        password,
        email_confirm: true,
      });
    if (createBErr || !createdB?.user) {
      throw new Error(
        "Supabase Auth admin API is not reachable. Start local Supabase: " +
          "supabase stop && supabase start. " +
          "This test MUST NOT be skipped. " +
          `Error: ${createBErr?.message ?? "no user returned"}`,
      );
    }
    userBId = createdB.user.id;

    // ---- Step 2: verify the auth.users -> public.users sync trigger fired. ----
    // Plan 03 installs the trigger; if it didn't fire, the plant insert below
    // would fail with FK violation. Surface the missing-migration case loudly
    // with the exact remediation command rather than letting the FK error mask
    // the real cause.
    const userARows = await adminSql<{ id: string }[]>`
      SELECT id FROM public.users WHERE id = ${userAId}
    `;
    const userBRows = await adminSql<{ id: string }[]>`
      SELECT id FROM public.users WHERE id = ${userBId}
    `;
    if (userARows.length === 0 || userBRows.length === 0) {
      throw new Error(
        "auth.users -> public.users sync trigger did not fire. " +
          "Apply the migration: pnpm db:migrate. " +
          "If the migration is applied but the trigger is missing, the local " +
          "Supabase auth schema may be out of sync — run 'supabase db reset' " +
          "and reapply migrations. " +
          "This test MUST NOT be skipped just because the trigger is missing.",
      );
    }

    // ---- Step 3: sign in BOTH users via Supabase Auth (real JWT minting). ----
    // We use signInWithPassword for both users so the must_haves "user A and
    // user B baseline + denial" path can bind the GUC to JWT-extracted sub
    // claims. This is the load-bearing chain: if signInWithPassword's `sub`
    // ever diverged from createUser's user.id, the test would fail loudly.
    const signInA = await adminClient.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (signInA.error || !signInA.data.session?.access_token) {
      throw new Error(
        "signInWithPassword failed for user A: " +
          (signInA.error?.message ?? "no session returned") +
          ". This test MUST NOT be skipped.",
      );
    }
    userAJwtSub = jwtSub(signInA.data.session.access_token);
    if (userAJwtSub !== userAId) {
      throw new Error(
        `JWT sub mismatch: signInWithPassword issued sub=${userAJwtSub} ` +
          `but admin.createUser returned id=${userAId}. The chain of custody ` +
          `is broken — abort.`,
      );
    }

    const signInB = await adminClient.auth.signInWithPassword({
      email: userBEmail,
      password,
    });
    if (signInB.error || !signInB.data.session?.access_token) {
      throw new Error(
        "signInWithPassword failed for user B: " +
          (signInB.error?.message ?? "no session returned") +
          ". This test MUST NOT be skipped.",
      );
    }
    userBJwtSub = jwtSub(signInB.data.session.access_token);
    if (userBJwtSub !== userBId) {
      throw new Error(
        `JWT sub mismatch: signInWithPassword issued sub=${userBJwtSub} ` +
          `but admin.createUser returned id=${userBId}.`,
      );
    }

    // ---- Step 4: insert userA's plant via the application's UoW path. ----
    // Lazy-import after env is configured so withUnitOfWork's transitive
    // serverEnv evaluation sees DATABASE_POOL_URL.
    const { withUnitOfWork } = await import("@shared/db/unit-of-work");
    const { plants } = await import(
      "@contexts/catalog/infrastructure/db/schema"
    );

    plantId = randomUUID();
    await withUnitOfWork(userAId, async (tx) => {
      await tx.insert(plants).values({
        id: plantId,
        userId: userAId,
        name: "RLS test plant (user A)",
      });
    });
  }, 30_000);

  afterAll(async () => {
    try {
      // The plant row cascades when its owning public.users row is deleted
      // (Phase 02 Plan 02 set plants.user_id ON DELETE CASCADE).
      // Delete public.users rows explicitly because there is no FK from
      // public.users -> auth.users; auth.admin.deleteUser does not cascade.
      if (userAId) {
        await adminSql`DELETE FROM public.users WHERE id = ${userAId}`;
      }
      if (userBId) {
        await adminSql`DELETE FROM public.users WHERE id = ${userBId}`;
      }
      if (userAId) {
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminClient.auth.admin.deleteUser(userBId);
      }
    } finally {
      await adminSql.end({ timeout: 5 });
    }
  });

  test("BASELINE: user A reads their own plant through the RLS-protected query path", async () => {
    // Open a dedicated postgres-js connection so we can switch role and bind
    // the GUC without touching the singleton client. Capped at max=1.
    const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
    try {
      const rows = await driver.begin(async (tx) => {
        // SET LOCAL ROLE authenticated is mandatory: the postgres-js
        // connection authenticates as the `postgres` superuser, which has
        // BYPASSRLS. Without this switch, RLS does not engage and any
        // SELECT returns the row regardless of GUC — the test would be a
        // false-pass. PostgREST does the equivalent on every request.
        await tx.unsafe(`SET LOCAL ROLE authenticated`);
        await tx`SELECT set_config('request.jwt.claim.sub', ${userAJwtSub}, true)`;

        // No explicit user_id filter — let RLS decide. With user A's JWT-sub
        // bound, the owner policy should permit this read.
        return tx<{ id: string; user_id: string }[]>`
          SELECT id, user_id FROM public.plants WHERE id = ${plantId}
        `;
      });

      if (rows.length !== 1) {
        throw new Error(
          "Baseline read failed: user A cannot read their own row. RLS may be " +
            "denying all reads — check policy and auth.uid() wiring. " +
            `Returned ${rows.length} row(s); expected exactly 1. ` +
            `Plant id ${plantId} owned by user A (${userAId}).`,
        );
      }
      expect(rows[0]!.id).toBe(plantId);
      expect(rows[0]!.user_id).toBe(userAId);
    } finally {
      await driver.end({ timeout: 5 });
    }
  }, 30_000);

  test("DENIAL: user B cannot read user A's plant through the RLS-protected query path", async () => {
    const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
    try {
      const rows = await driver.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE authenticated`);
        await tx`SELECT set_config('request.jwt.claim.sub', ${userBJwtSub}, true)`;
        return tx<{ id: string }[]>`
          SELECT id FROM public.plants WHERE id = ${plantId}
        `;
      });

      if (rows.length !== 0) {
        throw new Error(
          `CRITICAL: RLS did not deny cross-user read. plant id ${plantId} ` +
            `owned by user A (${userAId}) was visible to user B (${userBId}). ` +
            `Owner policies are not effective. Returned ${rows.length} row(s).`,
        );
      }
      expect(rows).toHaveLength(0);
    } finally {
      await driver.end({ timeout: 5 });
    }
  }, 30_000);

  test("auth.uid() resolves to the JWT-bound sub inside the authenticated-role transaction", async () => {
    // Independent verification that auth.uid() is what the policies
    // consult — guards against a future regression where the policy is
    // unchanged but auth.uid() starts returning null/wrong value.
    const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
    try {
      const observed = await driver.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE authenticated`);
        await tx`SELECT set_config('request.jwt.claim.sub', ${userBJwtSub}, true)`;
        const rows = await tx<{ uid: string | null }[]>`
          SELECT auth.uid()::text AS uid
        `;
        return rows[0]?.uid ?? null;
      });
      expect(observed).toBe(userBJwtSub);
    } finally {
      await driver.end({ timeout: 5 });
    }
  }, 30_000);
});
