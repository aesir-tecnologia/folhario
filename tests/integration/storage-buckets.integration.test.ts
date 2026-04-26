import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/**
 * Phase-2 Plan 04 Task 3: behavioural storage-buckets integration test.
 *
 * Calls `supabase.storage.listBuckets()` against the local Storage API and
 * asserts that `plant-photos`, `plant-thumbnails`, and `data-exports` exist
 * with `public === false`. This is intentionally a behavioural API check —
 * it never reads the supabase config file as text, because:
 *
 *   - Supabase requires `supabase stop && supabase start` (or
 *     `supabase seed buckets`) to materialise edits to bucket config.
 *   - Reading the config file as text passes silently when the local stack
 *     still holds the previous config (T-02-31 false-confidence).
 *   - Asserting on the API response forces the test to fail loudly when
 *     buckets are stale, missing, or accidentally `public = true`.
 *
 * Cloud-Supabase guard: if `DATABASE_POOL_URL` points at supabase.co, throw
 * (matches the existing pattern in `tests/integration/postgres-connection.integration.test.ts`
 * and `tests/integration/seed-data.integration.test.ts`).
 *
 * Local-stack reachability: if the Storage API is unreachable (Kong gateway
 * not running, Storage container down, etc.), skip the suite with the exact
 * restart instruction so developers know what to do — but never silently
 * skip cloud Supabase.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DATABASE_POOL_URL;

if (DB_URL && /supabase\.co/.test(DB_URL)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

const REQUIRED_BUCKETS = ["plant-photos", "plant-thumbnails", "data-exports"] as const;

const SKIP_MESSAGE =
  "Storage buckets test requires local Supabase running with refreshed config; " +
  "run 'supabase stop && supabase start' after editing config.toml " +
  "(and 'supabase seed buckets --local' if buckets did not materialise).";

interface BucketSnapshot {
  name: string;
  public: boolean;
}

async function fetchBuckets(): Promise<BucketSnapshot[] | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.storage.listBuckets();
    if (error) return null;
    if (!data) return [];
    return data.map((bucket) => ({ name: bucket.name, public: bucket.public }));
  } catch {
    return null;
  }
}

const buckets = await fetchBuckets();
const reachable = buckets !== null;

describe.skipIf(!reachable)("Phase-02-04 storage buckets integration", () => {
  it("exposes plant-photos, plant-thumbnails, and data-exports via the Storage API", () => {
    expect(buckets).not.toBeNull();
    const names = new Set((buckets ?? []).map((bucket) => bucket.name));
    const missing = REQUIRED_BUCKETS.filter((name) => !names.has(name));
    expect(
      missing,
      `Storage API missing buckets: ${missing.join(", ")}. ` +
        "Run 'supabase stop && supabase start' after editing config.toml (and " +
        "'supabase seed buckets --local' if buckets still don't appear).",
    ).toEqual([]);
  });

  it.each(REQUIRED_BUCKETS)("bucket %s has public=false", (bucketName) => {
    const bucket = (buckets ?? []).find((b) => b.name === bucketName);
    expect(bucket, `Bucket ${bucketName} missing from Storage API response`).toBeDefined();
    if (bucket && bucket.public !== false) {
      throw new Error(
        `Bucket ${bucketName} has public=${bucket.public}; expected false. ` +
          "Edit supabase/config.toml to set public=false and run " +
          "'supabase stop && supabase start' to refresh local Storage. " +
          "Public buckets leak plant photos and exports (T-02-09).",
      );
    }
    expect(bucket?.public).toBe(false);
  });
});

if (!reachable) {
  // Surface skip reason in the test runner output so CI logs make the
  // remediation step obvious instead of leaving developers to guess.
  console.warn(`[storage-buckets.integration] SKIP — ${SKIP_MESSAGE}`);
}
