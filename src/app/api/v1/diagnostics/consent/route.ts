import {
  postHandler,
  getHandler,
} from "@contexts/iam/api/consent-route";

/**
 * Phase-2 Plan 09 — diagnostic ConsentLog smoke route.
 *
 * D-39: the executable path is "/api/v1/diagnostics/consent". Next App
 * Router silently ignores route segments beginning with an underscore,
 * so the naïve "_diagnostics" path used in CONTEXT would 404. The plan
 * explicitly forbids "_diagnostics" directories.
 *
 * D-17 / T-02-11: this file MUST NOT import Drizzle, the runtime DB
 * client, the schema registry, or per-context schema modules. Both an
 * ESLint rule (no-restricted-imports on src/app/api route.ts) and a
 * Vitest grep guard (tests/unit/no-drizzle-in-routes.test.ts) enforce
 * this. All real work lives in @contexts/iam/api/consent-route.
 */

export const POST = postHandler;
export const GET = getHandler;
