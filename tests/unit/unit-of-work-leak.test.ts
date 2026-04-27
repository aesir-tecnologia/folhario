import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * T-02-33 (Plan 02-05) leak-prevention unit guard.
 *
 * The threat: `set_config('request.jwt.claim.sub', $userId, true)` is
 * `is_local = true` (transaction-scoped). If a developer ever called a
 * repository directly against the singleton `db` (instead of via
 * `withUnitOfWork`), two failure modes were possible:
 *  1. The GUC is unset, so `auth.uid()` returns NULL and any RLS owner
 *     policy comparing `auth.uid() = user_id` either denies everything OR,
 *     worse, lets a `(select auth.uid()) is not null`-less variant through.
 *  2. On a pooled connection, a previous transaction's GUC could
 *     theoretically be carried over (postgres-js pooler).
 *
 * Mitigations proven here without booting Postgres:
 *
 *  A. The `set_config(..., true)` literal is preserved in source so the
 *     binding is transaction-scoped (cannot leak past COMMIT/ROLLBACK).
 *  B. `isTransactionalClient(db)` returns `false` — the singleton client
 *     does NOT present the transactional shape, so a future code path
 *     accidentally feeding `db` into a tx-only helper is caught at runtime.
 *  C. `withUnitOfWork`'s `db.transaction(...)` callback runs the runtime
 *     `isTransactionalClient(tx)` predicate so a stub or `as any` bypass
 *     is rejected with `UnitOfWorkError`.
 *
 * Behavioral verification (real Postgres) of the GUC lifecycle remains in
 * `tests/integration/unit-of-work.integration.test.ts`.
 */

const PROJECT_ROOT = join(__dirname, "..", "..");
const UOW_PATH = join(PROJECT_ROOT, "src", "shared", "db", "unit-of-work.ts");

describe("T-02-33 transaction-scope leakage prevention", () => {
  it("source uses set_config(..., true) so the JWT claim is transaction-scoped", () => {
    const source = readFileSync(UOW_PATH, "utf8");
    expect(source).toMatch(
      /set_config\('request\.jwt\.claim\.sub',\s*\$\{userId\}|set_config\('request\.jwt\.claim\.sub'[^)]*,\s*true\s*\)/,
    );
    expect(source).toMatch(/,\s*true\s*\)/);
  });

  it("source guards the transaction callback with isTransactionalClient(tx)", () => {
    const source = readFileSync(UOW_PATH, "utf8");
    expect(source).toMatch(/isTransactionalClient\s*\(\s*tx\s*\)/);
  });

  it("isTransactionalClient(db) returns false — the singleton has no rollback method", async () => {
    const { db } = await import("@shared/db/client");
    const { isTransactionalClient } = await import("@shared/db/unit-of-work");
    expect(isTransactionalClient(db)).toBe(false);
  });

  it("isTransactionalClient returns true for an object exposing rollback()", async () => {
    const { isTransactionalClient } = await import("@shared/db/unit-of-work");
    expect(isTransactionalClient({ rollback: () => undefined })).toBe(true);
  });

  it("isTransactionalClient returns false for an object that lacks rollback()", async () => {
    const { isTransactionalClient } = await import("@shared/db/unit-of-work");
    expect(isTransactionalClient({ execute: () => undefined })).toBe(false);
    expect(isTransactionalClient({ rollback: "not-a-function" })).toBe(false);
    expect(isTransactionalClient(null)).toBe(false);
    expect(isTransactionalClient(undefined)).toBe(false);
    expect(isTransactionalClient("string")).toBe(false);
  });

  it("withUnitOfWork rejects a non-UUID userId BEFORE opening a transaction (T-02-32)", async () => {
    const { withUnitOfWork, UnitOfWorkError } = await import("@shared/db/unit-of-work");

    let opened = false;
    const callback = async () => {
      opened = true;
      return "ok";
    };

    await expect(withUnitOfWork("not-a-uuid", callback)).rejects.toBeInstanceOf(UnitOfWorkError);
    expect(opened).toBe(false);

    await expect(withUnitOfWork("not-a-uuid", callback)).rejects.toThrow(/validation_failed/);
  });

  it("UnitOfWorkError carries the validation_failed code so callers can map to ErrorCode", async () => {
    const { UnitOfWorkError } = await import("@shared/db/unit-of-work");
    const err = new UnitOfWorkError("test");
    expect(err.code).toBe("validation_failed");
  });
});
