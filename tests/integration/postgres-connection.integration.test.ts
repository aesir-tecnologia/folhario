import { describe, it, expect, afterAll } from "vitest";
import postgres from "postgres";

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

describe.skipIf(!dbUrl)("INFRA-26 local Postgres reachable via DATABASE_POOL_URL", () => {
  const sql = postgres(dbUrl!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("SELECT 1 succeeds", async () => {
    const rows = await sql`SELECT 1 AS one`;
    expect(rows[0]?.one).toBe(1);
  });

  it("Postgres major version is >=15 (any version; Phase 2 tightens to 17)", async () => {
    const rows = await sql<{ server_version_num: string }[]>`SHOW server_version_num`;
    const versionNum = Number(rows[0]?.server_version_num ?? "0");
    expect(versionNum).toBeGreaterThanOrEqual(150000);
  });
});
