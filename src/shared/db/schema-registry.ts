// Migration registry only. DO NOT import from application code or route handlers.
//
// This file exists exclusively so drizzle-kit can read every per-context table
// definition through a single entry point (configured as `schema:` in
// `drizzle.config.ts`). Per Phase-2 D-01:
// - Per-context schema modules under `src/contexts/{ctx}/infrastructure/db/`
//   own their tables.
// - Application code (route handlers, use-cases, repositories that compose
//   into the API surface) imports the per-context modules directly, never
//   from this registry.
// - The accompanying unit guard at `tests/unit/schema-registry.test.ts` fails
//   the build if any module under `src/app`, `src/contexts/*/api`, or
//   `src/contexts/*/application` imports this file.

export {
  consentLogs,
  dataDeletionRequests,
  dataExportRequests,
  legalBasisEnum,
  partnerStores,
  policyVersions,
  users,
} from "@contexts/iam/infrastructure/db/schema";

export {
  photoEntries,
  plants,
} from "@contexts/catalog/infrastructure/db/schema";

export {
  careGuides,
  species,
} from "@contexts/species-care/infrastructure/db/schema";
