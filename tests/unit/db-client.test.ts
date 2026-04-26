import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * Phase-2 Plan 05 Task 1: pooled runtime DB client guard.
 *
 * Threat T-02-01 mitigation: `src/shared/db/client.ts` MUST connect via
 * `DATABASE_POOL_URL` and disable prepared statements (`prepare: false`).
 * It MUST NOT reference the non-pooled `DATABASE_URL` constant — that URL
 * is reserved for migration-only scripts (`src/shared/db/migration-client.ts`).
 *
 * This is a static text-grep guard so it runs in the unit project and fails
 * fast in CI without booting Postgres.
 */

const PROJECT_ROOT = join(__dirname, "..", "..");
const CLIENT_PATH = join(PROJECT_ROOT, "src", "shared", "db", "client.ts");

describe("D-14/D-15 runtime DB client (T-02-01 prepared-statement drift)", () => {
  const source = readFileSync(CLIENT_PATH, "utf8");

  it("connects via DATABASE_POOL_URL", () => {
    expect(source).toContain("DATABASE_POOL_URL");
  });

  it("disables prepared statements via `prepare: false`", () => {
    expect(source).toContain("prepare: false");
  });

  it("does not reference the non-pooled DATABASE_URL constant", () => {
    // DATABASE_POOL_URL is fine; DATABASE_URL (non-pooled) is forbidden in
    // runtime client code. Search for the bare literal so DATABASE_POOL_URL
    // does not match.
    expect(source).not.toMatch(/\bDATABASE_URL\b/);
  });
});
