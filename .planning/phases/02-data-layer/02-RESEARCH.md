# Phase 2: Data Layer & Bounded Contexts - Research

**Researched:** 2026-04-25
**Domain:** Drizzle/Postgres schema, Supabase RLS/auth/storage adapters, API route conventions, image upload pipeline
**Confidence:** HIGH for official docs and local artifact findings; MEDIUM where a source decision needs execution-time proof against local Supabase.

<user_constraints>
## User Constraints (from CONTEXT.md)

The planner must honor `.planning/phases/02-data-layer/02-CONTEXT.md` decisions D-01 through D-49. The load-bearing constraints are:

- D-01: per-context Drizzle schema ownership plus `src/shared/db/schema-registry.ts` for drizzle-kit only.
- D-02/D-03/D-05: UUID v4 via `gen_random_uuid()`, `timestamptz` defaults, snake_case DB columns with camelCase Drizzle fields.
- D-04/D-06/D-07/D-48: varchar+CHECK for most operational enums, `legal_basis` PG enum, mixed json/jsonb, real FK constraints with explicit delete rules.
- D-08/D-09/D-10/D-11: Drizzle Kit owns migrations in `drizzle/migrations`; checked-in SQL; RLS/custom SQL in the migration stream; `pnpm db:setup`.
- D-12/D-13/D-49: SQL seeds for legal basis, policy versions, limits, and provider budgets.
- D-14/D-15: runtime client uses `DATABASE_POOL_URL` with `postgres-js` `{ prepare: false }`; migration client uses `DATABASE_URL`; lazy module-scope client.
- D-16/D-17/D-18/D-19/D-40: functional repositories, Unit-of-Work, no Drizzle in route handlers, domain Zod schemas derived from drizzle-zod.
- D-20/D-21/D-22/D-23: RLS on all tables, storage via service-role server adapter only, explicit policies and indexes.
- D-24/D-25/D-26/D-27: private buckets in `supabase/config.toml`, shared `StorageAdapter`, context helpers, server proxy upload route.
- D-28/D-29/D-30/D-31: `browser-image-compression`, EXIF stripped client-side, `exifr` GPS detection server-side, `sharp` thumbnails in upload route.
- D-32/D-33/D-34/D-35/D-47: AuthAdapter verifies JWT via `jose` + Supabase JWKS, `src/proxy.ts` composed carefully, DB trigger syncs `auth.users` to `public.users`, smoke route requires real JWT.
- D-36/D-37/D-38/D-39: base64 JSON cursor, 7-day DB-backed idempotency, ConsentLog smoke route.
- D-41/D-42/D-43/D-44/D-45: one cross-context query example, event types without Inngest wiring, real Postgres integration tests, Playwright smoke route coverage.

Deferred ideas from CONTEXT remain out of scope: Inngest handlers, Resend, Stripe, provider calls, full auth flows, and product UI.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-03 | Thin `/api/v1` route handlers; no Drizzle in handlers | Route-handler pattern plus ESLint/Vitest import guards |
| INFRA-04 | Drizzle + postgres-js + `{ prepare: false }` shared DB client | Drizzle Supabase docs explicitly require disabling prepare for Supabase transaction pooling [CITED: https://orm.drizzle.team/docs/get-started/supabase-existing] |
| INFRA-05 | Drizzle schema + migrations for all PRD entities | Drizzle `generate`/`migrate` code-first flow [CITED: https://orm.drizzle.team/docs/drizzle-kit-generate] [CITED: https://orm.drizzle.team/docs/drizzle-kit-migrate] |
| INFRA-06 | Private Supabase Storage buckets + StorageAdapter | Supabase private buckets require RLS/signed URLs [CITED: https://supabase.com/docs/guides/storage/buckets/fundamentals] |
| INFRA-07 | Supabase Auth behind AuthAdapter; JWT verification | Supabase JWT/JWKS docs and jose examples [CITED: https://supabase.com/docs/guides/auth/jwts] |
| INFRA-08 | RLS on all user-owned tables | Supabase RLS docs, policy and performance recommendations [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security] |
| INFRA-09 | Zod validation at route boundaries; drizzle-zod | drizzle-zod can generate insert/select schemas and refine them [CITED: https://orm.drizzle.team/docs/zod] |
| INFRA-19 | Image pipeline compress, strip EXIF/GPS, reject GPS | `browser-image-compression` supports 1MB target and `preserveExif=false`; `exifr.gps()` extracts GPS only [CITED: https://www.npmjs.com/package/browser-image-compression] [CITED: https://www.npmjs.com/package/exifr] |
| INFRA-21 | Cursor pagination default 50/max 200 | Implemented locally per PRD/API convention |
| INFRA-22 | Idempotency-Key on mutating endpoints | Implemented locally via DB table and transaction semantics |
| INFRA-24 | ConsentLog, policy version, legal-basis seed data | Implemented locally via schema + SQL seed |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Follow the GSD workflow before edits; this run is `$gsd-plan-phase 2 --research --chunked`.
- Next.js 16 App Router + React 19 + TS; route handlers live under `/api/v1`.
- Supabase Postgres via Supavisor transaction-mode pooler, Drizzle inside repositories only, `postgres-js` with `{ prepare: false }`.
- RLS is defense in depth; service-role keys stay server-side only.
- pt-BR launch posture and date/time conventions must be preserved.
- Error codes are closed; use `validation_failed`, `unauthenticated`, `conflict`, etc. from `src/shared/config/errors.ts`.
- No Inngest wiring in this phase despite folders existing.
- Real Postgres integration tests; no DB mocking for migration/query behavior.

## Summary

Phase 2 should split into small, dependency-ordered plans. The right foundation is: install Drizzle Kit/drizzle-zod/Supabase/auth/image dependencies; create per-context schema modules and a migration-only registry; generate/apply a checked-in migration that includes RLS, policies, buckets, auth trigger, and seed data; create a pooled runtime DB client plus migration client; add repository/UoW and route-handler helpers; then prove the API conventions with a ConsentLog diagnostics route and tests. The main risk is over-trusting RLS with a direct server-side `postgres-js` connection: Supabase docs describe RLS with `auth.uid()` in the Supabase/PostgREST JWT path, but a plain Postgres connection does not magically carry a bearer token. Plans must keep explicit user filters in repositories/use-cases and verify RLS as defense in depth, not as the only application authorization mechanism. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Drizzle schema and migrations | Database / build tooling | Context infrastructure | The schema is the DB contract; per-context modules keep ownership while registry feeds drizzle-kit |
| Runtime database access | Shared backend infrastructure | Context repositories | `src/shared/db/client.ts` owns connection setup; repositories own queries |
| Auth/JWT verification | Backend proxy + route helper | IAM infrastructure | Proxy can do fast rejection; route helper remains authoritative for route logic |
| RLS policies | Database | Repository explicit filters | Policies are defense in depth; repositories still scope by user for performance and direct SQL correctness |
| Storage uploads | API / backend | Shared adapter + catalog helper | Server must validate GPS and use service role; client never writes Storage directly |
| Client compression/EXIF strip | Browser / client utility | API GPS rejection | Client minimizes data; server rejects GPS as defense in depth |
| Idempotency | API helper + database | Route handlers | Atomic DB insert/replay prevents duplicate mutations across retries |
| Cursor pagination | Shared API helper | Route handlers | Shared helper keeps default 50/max 200 and opaque cursor consistent |
| Consent smoke route | API / backend | IAM repository | It exercises JWT, Zod, idempotency, repository, RLS, and cursor conventions |

## Standard Stack

| Package | Use | Source / Confidence |
|---------|-----|---------------------|
| `drizzle-orm` | Runtime ORM, Postgres schema definitions, relations, transactions | [CITED: https://orm.drizzle.team/docs/get-started/supabase-existing] HIGH |
| `drizzle-kit` | Generate and apply checked-in SQL migrations | [CITED: https://orm.drizzle.team/docs/drizzle-kit-generate] HIGH |
| `drizzle-zod` | Generate Zod schemas from Drizzle tables, then refine in domain modules | [CITED: https://orm.drizzle.team/docs/zod] HIGH |
| `postgres` | Existing runtime driver; must continue using `{ prepare: false }` | [CITED: https://orm.drizzle.team/docs/get-started/supabase-existing] HIGH |
| `@supabase/supabase-js` | Storage and minimal auth/admin adapter boundary only; not direct business logic | [CITED: https://supabase.com/docs/guides/storage/buckets/fundamentals] MEDIUM |
| `jose` | JWT verification against Supabase JWKS | [CITED: https://supabase.com/docs/guides/auth/jwts] HIGH |
| `browser-image-compression` | Client compression to `maxSizeMB: 1`, worker-enabled, `preserveExif: false` | [CITED: https://www.npmjs.com/package/browser-image-compression] MEDIUM |
| `exifr` | Server GPS detection using `gps(file)` or targeted parsing | [CITED: https://www.npmjs.com/package/exifr] MEDIUM |
| `sharp` | Server thumbnail generation | [ASSUMED] Use established Node image library; verify install/build during execution |
| `tsx` | Seed/setup TypeScript scripts | [ASSUMED] Common Node TS runner; local package currently does not include it |

## Architecture Patterns

### Drizzle Schema and Migration Pattern

- Use per-context schema modules, then import them from `src/shared/db/schema-registry.ts`. Drizzle docs allow a config `schema` path; Drizzle Kit reads schema snapshots and emits SQL migration files. [CITED: https://orm.drizzle.team/docs/drizzle-kit-generate]
- Use `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./src/shared/db/schema-registry.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- Add custom SQL in migrations for `CREATE EXTENSION IF NOT EXISTS pgcrypto`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, auth trigger, and static seeds. Drizzle supports custom migrations for hand-authored SQL. [CITED: https://orm.drizzle.team/docs/kit-custom-migrations]
- Avoid `drizzle-kit push` for durable project state. User decision D-09 locks generate+migrate with checked-in SQL.

### Database Client Pattern

- Runtime:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@shared/config/server-env";

const globalForDb = globalThis as typeof globalThis & { folharioSql?: postgres.Sql };

export function getSql() {
  return (globalForDb.folharioSql ??= postgres(getServerEnv().DATABASE_POOL_URL, {
    prepare: false,
  }));
}

export const db = drizzle({ client: getSql() });
```

- Migration scripts use `DATABASE_URL`, not `DATABASE_POOL_URL`, so generated migrations do not run through transaction pooler constraints.
- Do not expose Drizzle from route handlers. Route handlers call use-cases, use-cases call repositories/UoW.

### RLS Pattern

- Supabase requires enabling RLS manually for raw SQL-created tables. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]
- Policies should include `TO authenticated`, `(select auth.uid())`, and indexes on ownership columns. Supabase docs call out performance wins for indexes and function wrapping. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]
- Reference tables still get RLS enabled, with explicit authenticated select policies.
- Service keys bypass RLS and must never be exposed to browser code. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]

### JWT/Auth Pattern

- Supabase exposes JWKS at `/auth/v1/.well-known/jwks.json`; `jose.createRemoteJWKSet` + `jwtVerify` is the direct verification pattern. [CITED: https://supabase.com/docs/guides/auth/jwts]
- Supabase notes the JWKS endpoint may not return keys when a project uses legacy shared-secret signing; include a targeted test/probe so this fails loudly in local setup rather than silently weakening auth. [CITED: https://supabase.com/docs/guides/auth/jwts]
- Next 16 Proxy runs before requests, but Next docs say Proxy should not become a full session-management/authorization solution. Use it for fast rejection and request-header propagation; keep the route helper authoritative. [CITED: https://nextjs.org/docs/app/getting-started/proxy]

### Route Handler Pattern

- Next route handlers are `route.ts` files under `app`, use Web Request/Response APIs, and support HTTP methods directly. [CITED: https://nextjs.org/docs/app/getting-started/route-handlers]
- Project path should be `src/app/api/v1/diagnostics/consent/route.ts` for the smoke route. The original answered-question path used `_diagnostics`, but Phase 1 proved Next App Router silently ignores route segments beginning with `_`, so this plan preserves the ConsentLog diagnostic intent at the routable `/diagnostics/consent` segment.
- Each route task must follow: parse/validate with Zod -> call use-case -> map success/error to `Response` using `src/shared/config/errors.ts`. No Drizzle imports.
- Use `export const runtime = "nodejs"` on routes that need `sharp`, `postgres`, or other Node-only behavior.

### Storage and Image Pattern

- Supabase private buckets require RLS for direct access and can be read via signed URLs. The project decision is stricter: server-only service-role access plus signed URL helpers. [CITED: https://supabase.com/docs/guides/storage/buckets/fundamentals]
- Supabase CLI config supports per-bucket `public`, `file_size_limit`, `allowed_mime_types`, and `objects_path` settings. [CITED: https://supabase.com/docs/guides/cli/config]
- `browser-image-compression` supports `maxSizeMB`, worker compression, and `preserveExif` default false. Explicitly set `preserveExif: false`. [CITED: https://www.npmjs.com/package/browser-image-compression]
- `exifr.gps(file)` extracts only GPS coordinates for efficient server rejection. [CITED: https://www.npmjs.com/package/exifr]
- Server upload route sequence: multipart parse -> MIME/size validate -> `exifr.gps()` reject if coordinates -> `sharp` thumbnail -> upload original/thumbnail via adapter -> insert PhotoEntry in repository transaction.

### Idempotency and Cursor Pattern

- Idempotency must be a transaction wrapper: insert `(user_id, key)` pending row or lock existing row; if completed, return stored status/body; if new, execute handler, store JSON response, commit. Use 7-day `expires_at`.
- Cursor helper encodes `{ id, createdAt }` using base64 JSON, validates with Zod, and returns `validation_failed` on malformed input. The database query must apply deterministic `(created_at, id)` ordering.

## Don't Hand-Roll

- Do not hand-roll JWT crypto. Use `jose`.
- Do not hand-roll image compression or EXIF parsing. Use `browser-image-compression` and `exifr`.
- Do not hand-roll DB schema diffing. Use Drizzle Kit.
- Do not hand-roll Zod schemas for plain insert/select shapes when drizzle-zod can generate them and domain modules can refine them.
- Do not implement raw cron, Inngest, Resend, or Stripe in this phase.

## Common Pitfalls

1. **Prepared statements through Supavisor transaction pooler.** Drizzle docs call out disabling prepare for Supabase transaction pool mode; every app SQL client and test must grep for `prepare: false`. [CITED: https://orm.drizzle.team/docs/get-started/supabase-existing]
2. **Treating schema registry as an app barrel.** This violates D-01 and Phase 1 no-barrel D-08. Add lint/test guard.
3. **Assuming direct Postgres automatically populates `auth.uid()`.** Supabase RLS examples assume the Supabase/PostgREST Auth path. Direct server SQL must still scope by user and test RLS deliberately.
4. **Missing `TO authenticated` or ownership indexes on RLS policies.** Supabase recommends role-specific policies and indexes for performance. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]
5. **Next Proxy overreach.** Use Proxy for fast rejection, not the only auth enforcement.
6. **JWKS local mismatch.** If local Supabase uses legacy signing with no JWKS keys, D-33 needs an explicit failure path or documented local config. Do not silently switch to unverified token decoding.
7. **Idempotency race.** `SELECT then INSERT` is unsafe. Use unique constraints and transactions/locking.
8. **EXIF order.** Server GPS detection must inspect uploaded bytes before storage persistence; client EXIF stripping is not enough.
9. **Sharp runtime.** `sharp` is native and Node-only. Upload route must be `runtime = "nodejs"` and build/test must prove the package loads.
10. **Supabase config changes need restart.** CLI config docs say changes to `config.toml` require stop/start to take effect. [CITED: https://supabase.com/docs/guides/cli/config]

## Code Examples

### RLS Policy Template

```sql
alter table public.plants enable row level security;
create index plants_user_id_idx on public.plants(user_id);
create policy "plants_owner_all"
on public.plants
for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
```

### Cursor Contract

```ts
const cursorPayloadSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
});
```

### Idempotency Table Shape

```sql
create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key text not null,
  response_status integer,
  response_body jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
```

## Validation Architecture

Phase 2 needs layered automated validation because mistakes are easy to miss with TypeScript-only checks.

| Validation Layer | Command | Must Prove |
|------------------|---------|------------|
| Unit | `pnpm test:unit` | cursor encode/decode, idempotency helper branches, Zod schema refinements, import guards |
| Integration | `pnpm db:setup && pnpm test:integration` | migrations apply to real Postgres 17, RLS enabled on all tables, seed rows present, runtime DB client uses `prepare:false`, repositories work |
| Build/type | `pnpm lint && pnpm typecheck && pnpm build` | app route files compile, Next route handlers resolve |
| E2E | `pnpm test:e2e -- tests/e2e/diagnostics-consent.spec.ts` | real HTTP smoke route rejects missing JWT, accepts valid JWT, POST dedupes Idempotency-Key, GET paginates |
| Static guard | `pnpm test:unit -- --run tests/unit/no-drizzle-in-routes.test.ts` | no route handler imports `drizzle-orm`, schema registry, or context DB schema files |

Sampling requirements for plans:

- Every plan task that writes production code must have an `<automated>` verify command.
- Migration plans must include an integration check that introspects `information_schema` or `pg_policies`.
- API convention plans must include both unit tests and a route-handler or Playwright smoke.
- Image pipeline plans must include fixture images: one no-GPS accepted, one GPS rejected as `validation_failed`.

## Open Questions (RESOLVED)

1. **Does Supabase JWKS always exist locally?** RESOLVED for planning: D-33 remains the contract, but plans must include a setup/integration probe that fails loudly if JWKS is unavailable. The executor must not silently decode tokens or switch auth modes.
2. **Can RLS be the only user scoping layer for server repositories?** RESOLVED for planning: no. Treat RLS as defense in depth and include explicit user filters/use-case checks, because direct Postgres access does not inherently carry a bearer token.
3. **Should Supabase CLI or Drizzle own migrations?** RESOLVED by D-08/D-09: Drizzle owns app schema migrations; Supabase CLI remains local stack/bucket config orchestration.

---

## RESEARCH COMPLETE
