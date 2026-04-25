# Phase 02: Data Layer & Bounded Contexts - Chunked Plan Outline

**Created:** 2026-04-25
**Mode:** chunked
**Plan count:** 10

## Plan Manifest

| Plan ID | Objective | Wave | Depends On | Requirements |
|---------|-----------|------|------------|--------------|
| 02-01 | Tooling and migration bootstrap: install data-layer packages, add Drizzle config, DB scripts, env validation, and setup placeholders | 1 | None | INFRA-04, INFRA-05 |
| 02-02 | Core schema modules: IAM, Catalog, Species & Care schema ownership plus migration-only registry and schema guard tests | 2 | 02-01 | INFRA-05, INFRA-08, INFRA-09 |
| 02-03 | Operational schema and RLS migration: Identification, Reminders, Billing, Notifications, remaining IAM support tables, auth helper SQL, policies, and [BLOCKING] migrate | 3 | 02-02 | INFRA-05, INFRA-08 |
| 02-04 | Seed data and storage buckets: legal basis, policy versions, limits, provider budgets, Supabase private buckets, setup/check scripts | 4 | 02-03 | INFRA-05, INFRA-06, INFRA-24 |
| 02-05 | Runtime database layer: pooled client with `prepare:false`, migration client, UnitOfWork, repository import guard, initial repositories/query services | 4 | 02-03 | INFRA-03, INFRA-04 |
| 02-06 | API convention helpers: Zod boundary helpers, opaque cursor, idempotency transaction wrapper, derived domain schemas | 5 | 02-05 | INFRA-03, INFRA-09, INFRA-21, INFRA-22 |
| 02-07 | Auth adapter and proxy composition: Supabase JWT verification with `jose`, user lookup, protected API helper, proxy matcher updates | 5 | 02-05 | INFRA-03, INFRA-07 |
| 02-08 | Storage and image pipeline: StorageAdapter, signed URLs, client compression/EXIF strip, upload route, GPS rejection, thumbnail writes | 6 | 02-04, 02-05, 02-06, 02-07 | INFRA-03, INFRA-06, INFRA-19 |
| 02-09 | ConsentLog diagnostic route: routable `/api/v1/diagnostics/consent` smoke surface proving JWT, Zod, idempotency, cursor pagination, and repositories | 6 | 02-04, 02-05, 02-06, 02-07 | INFRA-03, INFRA-07, INFRA-09, INFRA-21, INFRA-22, INFRA-24 |
| 02-10 | Final integration and CI handoff: workflow migration step, route/schema guards, full-suite verification, requirements/roadmap completion metadata | 7 | 02-08, 02-09 | INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-19, INFRA-21, INFRA-22, INFRA-24 |

## Cross-Cutting Constraints

- Drizzle schema is owned by per-context modules; `src/shared/db/schema-registry.ts` exists for drizzle-kit only.
- Runtime DB access uses `DATABASE_POOL_URL` and `postgres-js` with `{ prepare: false }`; migration/setup access uses `DATABASE_URL`.
- Route handlers stay thin: validate, call use-case, map HTTP. They must not import Drizzle, schema tables, or the schema registry.
- RLS is defense in depth. Repositories/use-cases still scope by authenticated user explicitly.
- The diagnostic ConsentLog route uses `/api/v1/diagnostics/consent`, not `_diagnostics`, because Phase 1 proved underscore-prefixed route segments are ignored by Next App Router.
- Inngest, Resend, Stripe, provider calls, full signup/login UI, and product UI stay out of Phase 2.

## OUTLINE COMPLETE
