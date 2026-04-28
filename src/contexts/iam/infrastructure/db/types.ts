// Phase 4 plan 06 — Codex HIGH #2 / D-25 fix.
//
// Repositories accept an optional `dbOrTx` so the signup use-case can wrap
// multiple writes in one `db.transaction(...)` block. Re-uses Phase 2's
// `TransactionalDb` type from the shared unit-of-work module so the type
// system rejects passing an arbitrary transaction handle from another
// driver.

import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";

export type DbOrTx = DbClient | TransactionalDb;
