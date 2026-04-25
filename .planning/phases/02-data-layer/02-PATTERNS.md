# Phase 2: Data Layer & Bounded Contexts - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 12 existing anchors
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `drizzle.config.ts` | config | build-time DB config | `next.config.ts` | role-match |
| `src/shared/db/client.ts` | infrastructure | DB connection | `tests/integration/postgres-connection.integration.test.ts` | data-flow match |
| `src/shared/db/migration-client.ts` | infrastructure | DB connection | `tests/integration/postgres-connection.integration.test.ts` | data-flow match |
| `src/shared/db/schema-registry.ts` | config | schema composition | `src/shared/config/errors.ts` | role-match |
| `src/contexts/*/infrastructure/db/schema.ts` | model | schema definition | `src/shared/config/errors.ts` | partial |
| `src/contexts/*/infrastructure/db/*.ts` | repository | CRUD/request-response | `src/app/api/v1/diagnostics/ping/route.ts` | partial |
| `src/shared/api/cursor.ts` | utility | transform | `src/shared/config/server-env.ts` | role-match |
| `src/shared/api/idempotency.ts` | utility/service | request-response | `src/shared/config/errors.ts` | role-match |
| `src/contexts/iam/infrastructure/auth/auth-adapter.ts` | adapter | request auth | `src/shared/telemetry/posthog-server.ts` | role-match |
| `src/shared/adapters/storage.ts` | adapter | file I/O | `src/shared/telemetry/posthog-server.ts` | role-match |
| `src/app/api/v1/diagnostics/consent/route.ts` | route | request-response | `src/app/api/v1/diagnostics/ping/route.ts` | exact role |
| `tests/integration/*.integration.test.ts` | test | DB integration | `tests/integration/postgres-connection.integration.test.ts` | exact role |

## Pattern Assignments

### `drizzle.config.ts` (config)

**Analog:** `next.config.ts`

**Imports/config wrapper pattern:**

```ts
import type { NextConfig } from "next";
```

Apply the same root-level config style: typed config object, direct export, no dynamic shell work. Use `defineConfig` from `drizzle-kit`.

### `src/shared/db/client.ts` (DB connection)

**Analog:** `tests/integration/postgres-connection.integration.test.ts`

**Postgres driver pattern:**

```ts
const sql = postgres(dbUrl!, {
  prepare: false,
  max: 1,
  idle_timeout: 5,
});
```

Runtime client must include `prepare: false`. It should import `serverEnv` from `@shared/config/server-env`, never read raw `process.env` except inside config modules.

### `src/shared/config/server-env.ts` additions

**Analog:** current `server-env.ts`

**Zod env style:**

```ts
export const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});
```

Phase 2 should extend this module for any new server env fields needed by Supabase/JWKS, keeping client env separate.

### Route Handlers under `src/app/api/v1/**/route.ts`

**Analog:** `src/app/api/v1/diagnostics/ping/route.ts`

**Error and gate pattern:**

```ts
import { errorResponse, ErrorCode } from "@shared/config/errors";

if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") {
  return errorResponse(ErrorCode.NotFound, "not found");
}
```

Use the same closed error registry and `Response` helpers. For Phase 2 smoke route, replace mode-only gate with auth/idempotency/Zod helper calls.

### Integration Tests

**Analog:** `tests/integration/postgres-connection.integration.test.ts`

**Cloud DB guard:**

```ts
if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error("Refusing to run integration tests against cloud Supabase ...");
}
```

Every DB integration test added in Phase 2 must preserve this cloud guard or import a shared helper that applies it before connection.

### Server Probe Test Mocks

**Analog:** `tests/integration/diagnostics-server-probe.integration.test.ts`

**Route import pattern:**

```ts
const mod = await import("../../src/app/api/v1/diagnostics/ping/route");
const res = await mod.POST(new Request("http://localhost:3000/api/v1/diagnostics/ping", {
  method: "POST",
}));
```

Use this direct route-handler import for fast integration tests where Playwright is too heavy.

### E2E API Smoke

**Analog:** `tests/e2e/diagnostics-posthog.spec.ts`

**API request fixture pattern:**

```ts
const pingRes = await request.get("/api/v1/diagnostics/ping");
expect(pingRes.status()).toBe(200);
```

Use Playwright's `request` fixture for the Phase 2 diagnostic consent route. Only use `page` if browser token acquisition is needed.

## Shared Patterns

- **Path aliases:** Use `@shared/*`, `@contexts/*`, and `@i18n/*`; there is no `@/*` alias.
- **No barrels:** Do not add index files to re-export context modules. The schema registry is migration-only and must be guarded.
- **Env parsing:** Server-only code imports `@shared/config/server-env`; client utilities import `@shared/config/client-env`.
- **Errors:** Use `ErrorCode` and `errorResponse`; do not invent codes.
- **DB tests:** Real Postgres only, `prepare:false`, no cloud Supabase hostnames.
- **Route layering:** Route handlers validate and map HTTP; use-cases/repositories do business and DB work.
