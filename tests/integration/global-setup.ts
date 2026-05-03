// Phase 4 plan 04-03: integration project global setup placeholder.
//
// CRITICAL: this file MUST NOT import `tests/unit/setup-env.ts`. Phase 1
// plan 01-04 explicitly removed synthetic env var injection from the
// integration project so live-DB tests use real .env.local values; a
// regression here would cause integration tests to attempt connecting to
// a fake DB. Keep this file as a marker only — opt-in helpers
// (`truncateAuthAndIamTables`, etc.) are imported per-test.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  process.loadEnvFile(envLocal);
}

export {};
