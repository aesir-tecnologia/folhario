# Cross-AI Plan Review Request

You are reviewing implementation plans for a software project phase.
Provide structured feedback on plan quality, completeness, and risks.

## Project Context

# Folhário

## What This Is

Folhário is a plant identification, care-guide, and reminder PWA for Brazilian beginners who just bought their first plant and don't want to kill it. Users snap a photo, the app identifies the plant using cloud AI, files it in their personal catalog ("Meu Jardim"), shows a pt-BR care guide, and nudges them when it's time to water. Mobile-first PWA at launch, with every architectural decision kept native-compatible for a future app build.

## Core Value

**A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.**

Reminders are the retention engine; without the <2-min first-value moment there's no retention to engineer.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. Full list lives in REQUIREMENTS.md. -->

- [ ] **Identify → catalog → care guide → remind** core loop working end-to-end on mobile PWA in pt-BR
- [ ] **First-value <2 min** from email verification (verified → photo → identified → in catalog)
- [ ] **Honest AI** — confidence ladder with redundant signals, "Gerado por IA" persistent badge on augmented care guides, no fake precision numbers
- [ ] **Toxicity safety** — icon + colored badge + text + striped border + SR alert + mandatory vet disclaimer
- [ ] **Bounded-context backend** (IAM, Catalog, Species & Care, Identification, Reminders, Billing, Notifications) with Inngest events for async
- [ ] **Cloud-only identification** via Plant ID primary + OpenAI-compatible vision fallback, per-user and per-provider cost caps enforced before dispatch
- [ ] **≥200 curated pt-BR care guides** (founder-owned, launch blocker) + runtime augmentation for missing species
- [ ] **Single-tier monthly subscription** via Stripe (card + Pix), 14-day organic trial / 30-day partner trial, dunning 4×7d
- [ ] **LGPD compliance** — Art. 7 legal basis, Art. 18 rights (export, delete, consent revocation), Art. 33 international transfer consent, 7-day deletion grace via Inngest durable sleep
- [ ] **Single daily nudge** push model (never per-reminder), permission deferred until first reminder creation, self-healing PushSubscription rows on 410/404
- [ ] **Offline queue** — cached catalog browsable, photo/reminder actions queued with client-UUID idempotency, drop-with-summary on server-side plant deletion
- [ ] **WCAG 2.1 AA** ship blocker — every state combines redundant cues, color never sole signal, 3px global focus ring, prefers-reduced-motion honored
- [ ] **Design system** from PRD §17 — Paper Cream / Night Cream palette, Source Serif 4 + Plus Jakarta Sans, Lucide icons, bottom-nav only, asymmetric hero, spring-physics motion
- [ ] **CI/CD pipeline** — Vercel git integration OFF, all deploys from GitHub Actions, Supabase branch DB per PR, Playwright against preview URL, real Postgres for integration tests
- [ ] **Resend transactional email** for verification, reset, trial ending, payment failures, deletion, export-ready, operator cost alerts

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Freemium gating** — single paid tier only; no identify-limit wall on signup
- **Anonymous use** — trial requires an account; identification behind email verification + consent
- **Change-email / logout-all-devices** — deferred post-MVP (password reset and change-password ship; global revocation does not)
- **Travel-aware reminders** — `User.timezone` change does NOT retroactively shift scheduled reminders (assumed: traveling user isn't tending plants)
- **Per-reminder notification time** — all reminders for a user fire at a single `User.notification_time_local`
- **Per-reminder push actions** — push is a single daily nudge; Done/Snooze live in-app only
- **On-device identification model** — cloud-only; no local ML
- **Editor review queue for augmented care guides** — augmented rows go live immediately with a persistent "Gerado por IA" badge
- **Real-time chat / community / social** — not a social app
- **Video posts / video care guides** — images only
- **Native mobile app at launch** — PWA first; native door kept open via adapter boundaries
- **Dark-mode palette via inversion** — veranda-at-dusk palette designed separately; no auto-invert
- **Sidebar navigation** — bottom-nav only, max 5 items, MVP uses 4
- **Hover-dependent interaction** — hover is decorative amplification only
- **Freemium dark patterns** on cancel/delete flows
- **Third-party storage limits per user** in MVP
- **Admin UI for cost caps / tier limits** — runtime tuning via direct DB writes only
- **Confetti / bouncing / emoji / floating chatbot / spinner** — banned by design system
- **Inter / generic serifs / gradient text / glassmorphism / neumorphism** — banned by design system
- **Server sessions** — per-device JWT only
- **Raw cron / BullMQ / Redis queues** — Inngest only for durable scheduling and sleeps
- **Drizzle inside route handlers** — data access lives inside repositories only
- **Pure black `#000000` / pure white** — use Forest Ink / Paper Cream
- **Broad per-endpoint rate limiting** in MVP — only a narrow per-IP throttle on public auth endpoints
- **Vercel git integration** — disabled; all deploys from GitHub Actions

## Context

Greenfield project, single-founder-plus-Claude build. Targeted at a culturally-specific audience (Brazilian pt-BR beginners), so locale, currency formatting, LGPD compliance, and local payment methods (Pix) are first-class, not afterthoughts.

**Architectural north stars:**
- Adapter boundaries at every external dependency (identification providers, care-guide providers, billing provider, auth, storage, push) so any vendor can be swapped without touching business logic. Drizzle inside repositories only; Supabase JS confined to auth/storage adapters.
- Bounded contexts (DDD-lite) per `src/contexts/{iam,catalog,species-care,identification,reminders,billing,notifications}/{domain,application,infrastructure,api,inngest}/`. Cross-context communication is Inngest events for async + thin read-only query services for sync reads.
- Stack is pinned in `CLAUDE.md` Technology Stack section against live npm versions as of 2026-04-14 (Next 16.2.3, React 19.2.5, Drizzle 0.45.2, Inngest 4.2.1, Serwist 9.5.7, Stripe 22.0.1, Resend 6.11.0, Sentry 10.48.0, PostHog 1.368.0, next-intl 4.9.1, Vitest 4.1.4, Playwright 1.59.1). That document also enumerates "what NOT to use" (next-pwa, Prisma, `{ prepare: true }` with Supavisor txn pooler, `pg` driver, `setInterval`, `BullMQ`, `Sentry.setUser({ email })`, `date-fns` without `date-fns-tz`, Vercel Git integration).

**Single source of truth:** `docs/CAVE-PRD.md` — a 1352-line merged doc covering product, bounded contexts, full data model, API rules, identification flow, catalog, care guides, reminders, offline & sync, image handling, auth & subscription, LGPD, multi-device, push, screens, design system, accessibility, testing, environments/CI, security, metrics, acceptance criteria (keyed AC-AUTH/ID/CAT/CARE/REM/OFF/SUB/COST/LGPD), launch blockers, open questions, and glossary. REQUIREMENTS.md derives 1:1 from the PRD's AC groups.

## Phase 2: Data Layer & Bounded Contexts

### Roadmap Section

### Phase 2: Data Layer & Bounded Contexts
**Goal**: Every entity from PRD §4 exists in Postgres with Drizzle migrations applied, auth/storage/inngest adapters are wired behind their interfaces, and route handlers have the conventions (Zod, Idempotency-Key, cursor pagination, RLS) needed for feature phases to write thin use-cases without reinventing plumbing.
**Depends on**: Phase 1
**Requirements**: INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-19, INFRA-21, INFRA-22, INFRA-24
**Success Criteria** (what must be TRUE):
  1. Drizzle schema + migrations for all 19 entities (User, Plant, Species, CareGuide, PhotoEntry, Identification, Reminder, ReminderLog, PartnerStore, ConsentLog, DataExportRequest, DataDeletionRequest, Subscription, BillingEvent, IdentificationLimit, ProviderBudget, ProviderUsageCounter, OfflineSyncFailure, PushSubscription) are applied to a fresh DB from `drizzle-kit`, with RLS enabled on every user-owned table.
  2. A single shared `db/client.ts` exports a Drizzle client built on `postgres-js` with `{ prepare: false }` against the Supavisor txn pooler, and integration tests fail loudly if any route handler imports Drizzle directly (repositories only).
  3. `AuthAdapter` and `StorageAdapter` (with `plant-photos`, `plant-thumbnails`, `data-exports` private buckets + signed-URL helpers) boot without errors and are exercised by integration tests. Inngest is NOT wired here — it lands in Phase 4 alongside the first async consumer (verification email).
  4. A smoke `/api/v1/*` route handler validates body with a `drizzle-zod`-derived Zod schema, enforces JWT verification via Next middleware, returns cursor-paginated responses (`?cursor=&limit=`, default 50 / max 200, opaque `next_cursor`), and dedupes POSTs by `Idempotency-Key` header.
  5. A client-side image pipeline (compression ≤1MB + EXIF/GPS strip) uploads through the storage adapter and the server-side upload endpoint rejects any image carrying GPS EXIF with `validation_failed`; `ConsentLog` + policy-version + legal-basis registry seed data is loaded into every environment.
**Plans**: 10 plans

Plans:
**Wave 1**
- [ ] 02-01-PLAN.md -- Tooling and migration bootstrap

**Wave 2 _(blocked on Wave 1 completion)_**
- [ ] 02-02-PLAN.md -- Core schema modules and migration-only registry

**Wave 3 _(blocked on Wave 2 completion)_**
- [ ] 02-03-PLAN.md -- Operational schema, generated migration, RLS/custom SQL, and domain events

**Wave 4 _(blocked on Wave 3 completion)_**
- [ ] 02-04-PLAN.md -- Seed data, private storage buckets, and `pnpm db:setup`
- [ ] 02-05-PLAN.md -- Runtime DB client, UnitOfWork, repositories, and no-Drizzle route guards

**Wave 5 _(blocked on Wave 4 DB layer completion)_**
- [ ] 02-06-PLAN.md -- API convention helpers: Zod, cursor pagination, and idempotency
- [ ] 02-07-PLAN.md -- AuthAdapter, JWT verification, current-user helper, and API-aware proxy

**Wave 6 _(blocked on Waves 4-5 completion)_**
- [ ] 02-08-PLAN.md -- StorageAdapter, image pipeline, and `/api/v1/photos/upload`
- [ ] 02-09-PLAN.md -- ConsentLog smoke route at `/api/v1/diagnostics/consent`

**Wave 7 _(blocked on Wave 6 completion)_**
- [ ] 02-10-PLAN.md -- CI DB setup, full verification, and planning metadata reconciliation

Cross-cutting constraints:
- Drizzle schema remains per-context; `src/shared/db/schema-registry.ts` is migration-only.
- Runtime DB access uses `DATABASE_POOL_URL` with `postgres-js` `{ prepare: false }`; migrations/setup use `DATABASE_URL`.
- Route handlers validate, call use-cases, and map HTTP; they do not import Drizzle or schema tables.
- RLS is defense in depth; repositories still apply explicit user scoping.
- The diagnostic smoke route is `/api/v1/diagnostics/consent`, not `_diagnostics`, because Next App Router ignores underscore-prefixed route segments.
**UI hint**: no


### Requirements Addressed

- [ ] **INFRA-03**: Route handlers under `/api/v1` are thin: validate → use-case → HTTP map; no Drizzle in handlers (§2)
- [ ] **INFRA-04**: Drizzle ORM + `postgres-js` + `{ prepare: false }` mandatory for Supavisor txn-pooler compatibility; single shared `db/client.ts` (stack)
- [ ] **INFRA-05**: Drizzle schema + migrations for all entities in §4 (User, Plant, Species, CareGuide, PhotoEntry, Identification, Reminder, ReminderLog, PartnerStore, ConsentLog, DataExportRequest, DataDeletionRequest, Subscription, BillingEvent, IdentificationLimit, ProviderBudget, ProviderUsageCounter, OfflineSyncFailure, PushSubscription)
- [ ] **INFRA-06**: Supabase Storage buckets created (private): `plant-photos`, `plant-thumbnails`, `data-exports`; `StorageAdapter` interface with signed URL helpers (§2)
- [ ] **INFRA-07**: Supabase Auth behind `AuthAdapter`; JWT verification in Next middleware on every `/api/v1/*` except public endpoints (§21)
- [ ] **INFRA-08**: RLS enabled on all user-owned tables as defense in depth; service-role key server-only (§21)
- [ ] **INFRA-09**: Zod validation at route-handler body/query boundaries; `drizzle-zod` for DB-schema-derived Zod (stack)
- [ ] **INFRA-19**: Image pipeline — client-side compression to ≤1MB + EXIF/GPS strip → upload → thumbnail generation on upload → originals preserved for ID accuracy (§11)
- [ ] **INFRA-21**: Pagination implemented as opaque cursor `?cursor=&limit=`, default 50 / max 200, `next_cursor` in response; clients never parse cursors (§5)
- [ ] **INFRA-22**: Idempotency-Key support on mutating endpoints; client UUID is the key for offline queue actions (§5, §10)
- [ ] **INFRA-24**: `ConsentLog`, `policy_version`, legal-basis registry seed data (contract, consent, legitimate interest) loaded (§13)

### User Decisions (CONTEXT.md)

# Phase 2: Data Layer & Bounded Contexts - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Source:** Synthesized from answered `.planning/phases/02-data-layer/02-QUESTIONS.json` (49/49 answered)

<domain>
## Phase Boundary

Phase 2 delivers the database and API plumbing that later feature phases depend on:

- Drizzle schema and checked-in migrations for all PRD section 4 entities.
- RLS enabled and policy-covered for all app tables, including reference tables.
- App database client using `postgres-js` with `{ prepare: false }` for Supavisor transaction pooler compatibility.
- Repository-only data access with enforcement that route handlers do not import Drizzle directly.
- Supabase Auth and Storage behind adapters, with private buckets and signed URL helpers.
- Shared API conventions for `/api/v1`: Zod validation, cursor pagination, Idempotency-Key dedupe, JWT verification.
- Image upload pipeline foundation: client compression, client EXIF strip, server GPS rejection, thumbnail creation.
- Seed data for legal basis, policy versions, identification limits, and provider budgets.

**Explicitly not in scope:**

- Inngest wiring. It lands in Phase 4 with verification email as the first async consumer.
- Resend, Stripe, and provider calls.
- Feature UI beyond a technical smoke route/spec required to prove API conventions.
- Full auth signup/login flows. Phase 2 verifies JWT handling and minimal User row access only.

</domain>

<decisions>
## Implementation Decisions

### Schema Foundation

- **D-01:** Drizzle schema layout is per-context ownership: each context owns `src/contexts/{ctx}/infrastructure/db/schema.ts` for its aggregates. The shared file must be `src/shared/db/schema-registry.ts` for drizzle-kit only, not an application import barrel. Add an ESLint/Vitest guard so application code does not import it casually.
- **D-02:** Primary keys use UUID v4 generated by Postgres with `gen_random_uuid()`.
- **D-03:** Timestamp columns use `timestamptz`, snake_case DB names (`created_at`, `updated_at`), and Postgres `now()` defaults. App/API serialization must emit ISO-8601 UTC with `Z`.
- **D-04:** Operational status/type fields use `varchar` plus CHECK constraints and TypeScript literal unions. Exception: `legal_basis` is a Postgres enum because it is a legally closed registry.
- **D-05:** DB columns are snake_case; TypeScript field names are camelCase via Drizzle column mapping.
- **D-06:** JSON columns are mixed: `Identification.results` is `jsonb`; `BillingEvent.payload` and `OfflineSyncFailure.payload` are `json` for audit-faithful opaque storage.
- **D-07:** Use real DB foreign keys everywhere with explicit PRD delete rules: CASCADE for owned children, SET NULL for `Identification.plant_id`, RESTRICT/NO ACTION for reference links.

### Migration Tooling

- **D-08:** Drizzle Kit owns all schema migrations in `drizzle/migrations/`. Supabase CLI remains local-service orchestration, not the schema migration source of truth.
- **D-09:** Use `drizzle-kit generate` plus checked-in SQL plus `drizzle-kit migrate`.
- **D-10:** RLS policies live in the same Drizzle migration stream via raw/custom SQL appended to generated migrations.
- **D-11:** CI and local setup expose one command, `pnpm db:setup`, that applies migrations and seed data before integration tests.

### Seed Data

- **D-12:** Use SQL for static reference/default seed data and TypeScript only for dev/test fixtures.
- **D-13:** Phase 2 seeds legal basis and policy version data plus `IdentificationLimit` rows (`trial` 5/day and 75/period, `paid` 15/day and 200/period) and `ProviderBudget` rows for Plant.id and OpenAI-compatible providers, both `identification` and `care_guide`, USD 5/day, 80 percent alert threshold, `min_confidence=0.30` for identification.

### Database Client

- **D-14:** Create two connection entry points: `src/shared/db/client.ts` for runtime pooled access with `DATABASE_POOL_URL` and `{ prepare: false }`; `src/shared/db/migration-client.ts` for direct migration/script access with `DATABASE_URL`.
- **D-15:** Runtime DB client is global, lazy-initialized at module scope for Next/Vercel warm invocation reuse.

### Repository Pattern

- **D-16:** Repositories are functional modules such as `src/contexts/catalog/infrastructure/db/plants.ts` exporting functions (`findById`, `create`, etc.). Functions take a Drizzle client parameter. No repository classes.
- **D-17:** Enforce "no Drizzle in route handlers" with both ESLint and a Vitest grep-style integration/unit test.
- **D-18:** Use a Unit-of-Work abstraction that hides Drizzle from application and API layers.
- **D-19:** Domain modules export refined Zod schemas derived from `drizzle-zod`; routes import domain schemas, not raw table definitions.

### RLS Strategy

- **D-20:** RLS is exercised through per-request JWT-bearing DB access so `auth.uid()` works in policies where Supabase/PostgREST-compatible execution is used. Because the Next app also uses server-side adapters, repositories must still accept explicit user scoping where RLS is not the only enforcement path.
- **D-21:** Enable RLS on all tables. Reference/config tables get explicit permissive read policies for authenticated users.
- **D-22:** User-owned tables use a single `FOR ALL TO authenticated` ownership policy with `USING ((select auth.uid()) = user_id)` and `WITH CHECK ((select auth.uid()) = user_id)`, plus explicit auth-not-null handling where needed.
- **D-23:** Storage buckets are service-role only. Clients never call Supabase Storage directly; uploads go through server routes/adapters and downloads use signed URLs.

### Storage Adapter & Buckets

- **D-24:** Provision private storage buckets declaratively in `supabase/config.toml` with `[storage.buckets.*]` blocks.
- **D-25:** Use a two-tier storage API: generic `StorageAdapter` in shared adapters and context helpers such as `src/contexts/catalog/infrastructure/photo-storage.ts`.
- **D-26:** Storage paths are `{user_id}/{aggregate_id}/{file_id}.{ext}` inside the bucket, e.g. `plant-photos/{user_id}/{plant_id}/{photo_id}.jpg`, for LGPD prefix deletion and debugging.
- **D-27:** Uploads use a server proxy route: client sends multipart to `/api/v1/photos/upload`, server validates GPS, uploads with service role, and inserts DB metadata.

### Image Pipeline

- **D-28:** Client-side compression uses `browser-image-compression`.
- **D-29:** Client-side EXIF stripping is handled through compression options; `preserveExif` must remain false.
- **D-30:** Server-side GPS detection uses `exifr`.
- **D-31:** Thumbnail generation happens synchronously in the upload route with `sharp`, writing to `plant-thumbnails` in the same request.

### Auth Adapter & Middleware

- **D-32:** Phase 2 `AuthAdapter` scope is JWT verify plus `getUserById(id)` for smoke route and downstream catalog work.
- **D-33:** JWT verification uses `jose` with the Supabase JWKS endpoint `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
- **D-34:** Compose locale and auth behavior in `src/proxy.ts` with a runtime helper. This must preserve existing Next 16 proxy conventions and route matchers.
- **D-35:** Sync `auth.users` to `public.users` with a DB trigger on insert; the app fills richer signup fields in Phase 4.

### API Conventions

- **D-36:** Cursor format is `base64(JSON.stringify({ id, createdAt }))`; invalid/tampered cursors return `validation_failed`.
- **D-37:** Idempotency uses an `idempotency_keys` table with key, user_id, response_status, response_body, and expires_at.
- **D-38:** Idempotency TTL is 7 days.
- **D-39:** The smoke route subject is a ConsentLog write/read surface. The answered-question intent used `POST /api/v1/_diagnostics/consent`, but Phase 1 proved Next App Router ignores route segments beginning with `_`; therefore the executable path is `POST /api/v1/diagnostics/consent`. It records a ConsentLog row, requires JWT and Idempotency-Key, and `GET /api/v1/diagnostics/consent` returns cursor-paginated history.

### Domain Layer & Cross-Context

- **D-40:** Domain entity style is lean: derive TS types from drizzle-zod schemas, no class layer.
- **D-41:** Scaffold one cross-context query-service example as part of the smoke route, e.g. Catalog/API reads a User through IAM query service.
- **D-42:** Define per-context event types in `src/contexts/{ctx}/domain/events.ts`; do not wire Inngest in Phase 2.

### Testing Strategy

- **D-43:** Integration tests use transaction rollback per test. Document the exit ramp: tests requiring real commits may use TRUNCATE for that file.
- **D-44:** Auth tests are hybrid: most tests mock JWT verification, but at least one path verifies real JWKS/verify behavior.
- **D-45:** Phase 2 adds Playwright coverage for the smoke `/api/v1` route to prove JWT, cursor pagination, and idempotency over real HTTP.

### Phase Boundary

- **D-46:** The `users` table has the full PRD section 4 schema in Phase 2; Phase 4 wires signup/update logic.
- **D-47:** The Phase 2 smoke route requires a real JWT and returns 401 when missing.
- **D-48:** `legal_basis` is a PG enum; `policy_versions` is a table with `is_current`; ConsentLog references policy version. Most operational statuses remain varchar plus CHECK constraints for easier evolution.
- **D-49:** Provider config seeds land in Phase 2 so a fresh DB is ready for Phase 6 cost controls.

### the agent's Discretion

- Exact file splits inside a context as long as D-01 ownership and D-08 migration ownership are preserved.
- Exact helper names for Unit-of-Work and cursor/idempotency modules.
- Exact assertion style for grep guards, provided they fail loudly in CI.
- Exact thumbnail dimensions and image quality constants, provided client uploads are <=1MB and thumbnails are written to `plant-thumbnails`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and scope

- `.planning/PROJECT.md` - Core value, constraints, launch blockers, adapter/bounded-context north stars.
- `.planning/ROADMAP.md` - Phase 2 goal and five success criteria.
- `.planning/REQUIREMENTS.md` - INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-19, INFRA-21, INFRA-22, INFRA-24.
- `docs/CAVE-PRD.md` sections 2, 3, 4, 5, 10, 11, 13, 19, and 21.

### Prior phase patterns

- `.planning/phases/01-foundation/01-CONTEXT.md` - D-07 path aliases, D-08 no barrels, D-10/D-11/D-12 error registry, D-25 Postgres 17, D-29 env split.
- `.planning/phases/01-foundation/01-04-PLAN.md` and `01-04-SUMMARY.md` - Supabase local config, `postgres-js` integration posture, `{ prepare: false }` guard.
- `.planning/phases/01-foundation/01-07-PLAN.md` and `01-07-SUMMARY.md` - API diagnostics route/testing patterns.
- `.planning/phases/01-foundation/01-08-SUMMARY.md` - CI pipeline and Postgres 17 parity decisions.

### Current code anchors

- `package.json` - scripts and dependency versions.
- `tsconfig.json` - strict TypeScript config and path aliases.
- `vitest.config.ts` - unit/integration project split.
- `src/shared/config/errors.ts` - closed error registry and error response shape.
- `src/shared/config/server-env.ts` and `src/shared/config/client-env.ts` - env split to preserve.
- `src/proxy.ts` - Next 16 proxy file to extend carefully.
- `next.config.ts` - security headers and wrapper composition.

</canonical_refs>

<specifics>
## Specific Ideas

- Use `drizzle.config.ts` with `schema: "./src/shared/db/schema-registry.ts"` and `out: "./drizzle/migrations"`.
- Add scripts: `db:generate`, `db:migrate`, `db:setup`, `db:seed`, and `db:check-rls` if needed.
- Add dependencies: `drizzle-orm`, `drizzle-zod`, `@supabase/supabase-js`, `jose`, `browser-image-compression`, `exifr`, `sharp`, and `tsx`; add `drizzle-kit` as a dev dependency.
- Keep `postgres` pinned at the existing production dependency and continue using `{ prepare: false }`.
- Use `src/shared/db/schema-registry.ts` only for migration/schema composition and guard it from app-layer imports.
- Make the idempotency replay response body JSON only; if a future route returns non-JSON, it must extend the table contract explicitly.
- Add indexes on every RLS ownership column (`user_id`, `plant_id` ownership joins as needed) because RLS policies will filter by ownership.

</specifics>

<deferred>
## Deferred Ideas

- Inngest function registration and event handlers - Phase 4+.
- Resend email templates and transactional sends - Phase 4+.
- Stripe billing implementation - Phase 10.
- Provider calls, provider router, breakers, and cost alert emails - Phase 6+.
- Full auth signup/login/password flows - Phase 4.
- Product UI beyond smoke-route verification - Phase 3+.

</deferred>

---

_Phase: 02-data-layer_
_Context gathered: 2026-04-25 via answered questions synthesis_

### Research Findings

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

### Plans to Review


#### 02-01-PLAN.md

---
phase: 02
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - drizzle.config.ts
  - src/shared/config/server-env.ts
  - src/shared/db/migration-client.ts
  - scripts/check-rls.ts
  - scripts/check-seeds.ts
autonomous: true
requirements: [INFRA-04, INFRA-05]
tags: [drizzle, tooling, database]
must_haves:
  truths:
    - "D-08/D-09: `drizzle.config.ts` points to `src/shared/db/schema-registry.ts` and writes SQL under `drizzle/migrations`."
    - "D-11/D-14: package scripts expose `db:generate`, `db:migrate`, `db:setup`, `db:seed`, `db:check-rls`, and `db:check-seeds`."
    - "D-14/D-15: runtime DB setup is reserved for Plan 05; this plan creates only migration/setup scaffolding and server env validation."
    - "INFRA-04: every postgres-js connection introduced here uses `{ prepare: false }` unless it is a direct migration-only connection."
  artifacts:
    - path: "drizzle.config.ts"
      provides: "Drizzle Kit code-first migration config"
      contains: "schema: \"./src/shared/db/schema-registry.ts\""
    - path: "src/shared/db/migration-client.ts"
      provides: "Direct migration/setup SQL helper using DATABASE_URL"
      contains: "DATABASE_URL"
---

<objective>
Bootstrap the data-layer tooling that every later Phase 2 plan needs: Drizzle Kit config, exact DB scripts, server env validation, and setup/check script placeholders. This plan must not create application repositories or route behavior yet.

Output: `pnpm lint && pnpm typecheck` pass after adding Drizzle-related packages and config, and the repo has named commands for migration generation, migration apply, seed apply, RLS checks, and seed checks.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-RESEARCH.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-PATTERNS.md
@/Users/machado/Projects/folhario/package.json
@/Users/machado/Projects/folhario/src/shared/config/server-env.ts
@/Users/machado/Projects/folhario/tests/integration/postgres-connection.integration.test.ts
</context>

<threat_model>
T-02-01 prepared-statement drift: Supavisor transaction pooling breaks if runtime postgres-js clients omit `prepare:false`. Mitigation: scripts and tests later grep for `prepare: false`; this plan introduces no pooled runtime client.
T-02-02 migration-env confusion: running migrations through `DATABASE_POOL_URL` can hide transaction-pooler issues. Mitigation: `migration-client.ts` and `drizzle.config.ts` use only `DATABASE_URL`.
T-02-03 dependency range drift: broad semver ranges can pull incompatible ORM/image/native packages. Mitigation: install with exact versions and commit `pnpm-lock.yaml`.
</threat_model>

<tasks>
<task type="auto">
  <name>Task 1: Add data-layer dependencies and DB scripts</name>
  <files>package.json, pnpm-lock.yaml</files>
  <read_first>
    - /Users/machado/Projects/folhario/package.json
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-RESEARCH.md
  </read_first>
  <action>
Install exact runtime dependencies: `drizzle-orm`, `drizzle-zod`, `@supabase/supabase-js`, `jose`, `browser-image-compression`, `exifr`, and `sharp`.

Install exact dev dependencies: `drizzle-kit` and `tsx`.

Add these package scripts:
- `"db:generate": "drizzle-kit generate"`
- `"db:migrate": "drizzle-kit migrate"`
- `"db:seed": "tsx scripts/seed.ts"`
- `"db:setup": "pnpm db:migrate && pnpm db:seed && pnpm db:check-rls && pnpm db:check-seeds"`
- `"db:check-rls": "tsx scripts/check-rls.ts"`
- `"db:check-seeds": "tsx scripts/check-seeds.ts"`

Do not remove existing Phase 1 scripts.
  </action>
  <verify>
    <automated>pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` contains `"drizzle-orm"` under `dependencies`.
    - `package.json` contains `"drizzle-kit"` under `devDependencies`.
    - `package.json` contains exactly the six DB scripts listed in the action.
    - `pnpm-lock.yaml` changes and `pnpm install --frozen-lockfile` exits 0.
  </acceptance_criteria>
  <done>Dependencies and script names are present and static checks pass.</done>
</task>

<task type="auto">
  <name>Task 2: Create Drizzle Kit config and migration client scaffold</name>
  <files>drizzle.config.ts, src/shared/config/server-env.ts, src/shared/db/migration-client.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/shared/config/server-env.ts
    - /Users/machado/Projects/folhario/tests/integration/postgres-connection.integration.test.ts
  </read_first>
  <action>
Create `drizzle.config.ts` using `defineConfig` from `drizzle-kit` with:
- `dialect: "postgresql"`
- `schema: "./src/shared/db/schema-registry.ts"`
- `out: "./drizzle/migrations"`
- `dbCredentials.url` from `process.env.DATABASE_URL`

Extend `src/shared/config/server-env.ts` only if needed so `DATABASE_URL`, `DATABASE_POOL_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are validated server-side.

Create `src/shared/db/migration-client.ts` exporting a direct SQL helper for setup scripts. It must use `DATABASE_URL`, not `DATABASE_POOL_URL`, and must expose a close function so scripts can end connections.
  </action>
  <verify>
    <automated>pnpm lint && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `drizzle.config.ts` contains `schema: "./src/shared/db/schema-registry.ts"`.
    - `drizzle.config.ts` contains `out: "./drizzle/migrations"`.
    - `src/shared/db/migration-client.ts` contains `DATABASE_URL`.
    - `src/shared/db/migration-client.ts` does not contain `DATABASE_POOL_URL`.
  </acceptance_criteria>
  <done>Drizzle Kit can locate the future schema registry and setup scripts have a direct DB connection path.</done>
</task>

<task type="auto">
  <name>Task 3: Add check script placeholders that fail clearly until schema and seeds exist</name>
  <files>scripts/check-rls.ts, scripts/check-seeds.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/shared/db/migration-client.ts
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-VALIDATION.md
  </read_first>
  <action>
Create `scripts/check-rls.ts` and `scripts/check-seeds.ts`. For this plan, each script should:
- Import the migration SQL helper.
- Query a harmless readiness check such as `select 1`.
- Print a clear "schema not ready" message and exit non-zero if expected Phase 2 tables are absent.

Later plans replace the placeholder table lists with the real table and seed checks.
  </action>
  <verify>
    <automated>pnpm lint && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `scripts/check-rls.ts` imports `@shared/db/migration-client` or a relative migration-client path.
    - `scripts/check-seeds.ts` imports `@shared/db/migration-client` or a relative migration-client path.
    - Both files contain the phrase `schema not ready`.
    - `pnpm typecheck` exits 0.
  </acceptance_criteria>
  <done>DB setup scripts are named and type-safe before schema-dependent plans fill in real checks.</done>
</task>
</tasks>

<verification>
<automated>pnpm lint && pnpm typecheck</automated>
</verification>


#### 02-02-PLAN.md

---
phase: 02
plan: "02"
type: execute
wave: 2
depends_on: ["02-01"]
files_modified:
  - src/contexts/iam/infrastructure/db/schema.ts
  - src/contexts/catalog/infrastructure/db/schema.ts
  - src/contexts/species-care/infrastructure/db/schema.ts
  - src/shared/db/schema-registry.ts
  - src/contexts/iam/domain/schemas.ts
  - src/contexts/catalog/domain/schemas.ts
  - src/contexts/species-care/domain/schemas.ts
  - tests/unit/schema-registry.test.ts
autonomous: true
requirements: [INFRA-05, INFRA-08, INFRA-09]
tags: [schema, drizzle, core-models]
must_haves:
  truths:
    - "D-01: each context owns its schema module; `src/shared/db/schema-registry.ts` is migration-only, not an app barrel."
    - "D-02/D-03/D-05: schemas use UUID v4 defaults, `timestamptz` fields, snake_case DB names, and camelCase Drizzle fields."
    - "D-04/D-06/D-07/D-48: operational values use varchar plus CHECK-compatible literals, `legal_basis` uses a PG enum, and FKs declare delete behavior."
    - "D-19/D-40/D-46: domain Zod schemas are derived from drizzle-zod, with full User schema in Phase 2."
  artifacts:
    - path: "src/shared/db/schema-registry.ts"
      provides: "Migration-only composition of per-context tables"
      contains: "DO NOT import from application or route handlers"
---

<objective>
Create the core Drizzle schema surfaces for IAM, Catalog, and Species & Care, plus a migration-only registry and domain Zod schemas derived from drizzle-zod. This plan does not generate migrations yet; Plan 03 owns the first migration after all Phase 2 tables exist.

Output: type-safe schema modules for User, ConsentLog, PartnerStore, DataExportRequest, DataDeletionRequest, policy_versions, Plant, PhotoEntry, Species, and CareGuide.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-RESEARCH.md
@/Users/machado/Projects/folhario/docs/CAVE-PRD.md
@/Users/machado/Projects/folhario/src/shared/config/errors.ts
</context>

<threat_model>
T-02-02 schema ownership erosion: app code can start importing the registry as a barrel. Mitigation: registry comment plus unit guard in this plan; route-handler import guard lands in Plan 05.
T-02-03 referential-integrity gaps: missing FK actions can break LGPD deletion and plant-delete history preservation. Mitigation: every FK in this plan names `onDelete` explicitly.
T-02-04 validation drift: hand-written Zod can diverge from DB columns. Mitigation: domain schemas derive from `drizzle-zod` and refine only where needed.
</threat_model>

<tasks>
<task type="auto">
  <name>Task 1: Create IAM schema and derived domain schemas</name>
  <files>src/contexts/iam/infrastructure/db/schema.ts, src/contexts/iam/domain/schemas.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/docs/CAVE-PRD.md §4 Data Model
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-01 through D-07, D-24, D-46, D-48
  </read_first>
  <action>
Create IAM-owned schema tables:
- `users`: id, email, name, locale default `pt-BR`, timezone, notification_time_local default `09:00`, trial_source, partner_code, age_confirmed_at, toxicity_disclaimer_acknowledged_at, deletion_requested_at, created_at, updated_at.
- `policy_versions`: id, version, document_type, effective_at, is_current, created_at.
- `consent_logs`: id, user_id, purpose, legal_basis, policy_version_id, granted_at, revoked_at, source, created_at.
- `partner_stores`: id, name, code unique, trial_days default 30, is_active, created_at, updated_at.
- `data_export_requests`: id, user_id, status, requested_at, completed_at, download_url.
- `data_deletion_requests`: id, user_id, requested_at, grace_period_ends_at, status, completed_at.

Create a `legal_basis` PG enum with values `consent`, `contract`, and `legitimate_interest`. Use varchar literal unions plus CHECK-friendly lists for purpose, source, export/deletion status, trial_source, and document_type.

Create `src/contexts/iam/domain/schemas.ts` using `createSelectSchema` and `createInsertSchema` from `drizzle-zod` for the public domain shapes needed by later plans.
  </action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/contexts/iam/infrastructure/db/schema.ts` exports `users`, `consentLogs`, `policyVersions`, `partnerStores`, `dataExportRequests`, and `dataDeletionRequests`.
    - `src/contexts/iam/infrastructure/db/schema.ts` contains `pgEnum("legal_basis"`.
    - Every IAM table with `userId` contains `onDelete: "cascade"`.
    - `src/contexts/iam/domain/schemas.ts` imports `createSelectSchema` from `drizzle-zod`.
  </acceptance_criteria>
  <done>IAM core entities and derived domain schemas are type-safe.</done>
</task>

<task type="auto">
  <name>Task 2: Create Catalog and Species & Care schemas</name>
  <files>src/contexts/catalog/infrastructure/db/schema.ts, src/contexts/catalog/domain/schemas.ts, src/contexts/species-care/infrastructure/db/schema.ts, src/contexts/species-care/domain/schemas.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/docs/CAVE-PRD.md §4 Data Model
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-01 through D-07, D-19, D-40
  </read_first>
  <action>
Create Catalog tables:
- `plants`: id, user_id, species_id nullable, name, nickname nullable, location nullable, acquisition_date nullable, notes nullable, cover_photo_url nullable, created_at, updated_at.
- `photo_entries`: id, plant_id, photo_url, thumbnail_url, note nullable, created_at.

Create Species & Care tables:
- `species`: id, common_name, scientific_name, reference_image_url nullable, flag_reason nullable, flag_status nullable, identification_count default 0, resolved_at nullable, resolved_by nullable, created_at, updated_at.
- `care_guides`: id, species_id, locale default `pt-BR`, version, source, watering, light, soil, temperature_min, temperature_max, humidity, toxicity, toxicity_source_url nullable, difficulty, seasonal_tips, compatibility_notes, updated_at.

Apply explicit FKs:
- `plants.user_id -> users.id on delete cascade`.
- `plants.species_id -> species.id on delete set null`.
- `photo_entries.plant_id -> plants.id on delete cascade`.
- `care_guides.species_id -> species.id on delete cascade`.

Create domain schema files using drizzle-zod and literal unions for source/toxicity/difficulty/flag values.
  </action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/contexts/catalog/infrastructure/db/schema.ts` exports `plants` and `photoEntries`.
    - `src/contexts/species-care/infrastructure/db/schema.ts` exports `species` and `careGuides`.
    - `plants.speciesId` has `onDelete: "set null"`.
    - `photoEntries.plantId` has `onDelete: "cascade"`.
    - Both domain schema files import from `drizzle-zod`.
  </acceptance_criteria>
  <done>Catalog and Species & Care schema modules compile and encode PRD delete rules.</done>
</task>

<task type="auto">
  <name>Task 3: Create migration-only schema registry and guard test</name>
  <files>src/shared/db/schema-registry.ts, tests/unit/schema-registry.test.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-01
    - /Users/machado/Projects/folhario/tsconfig.json
  </read_first>
  <action>
Create `src/shared/db/schema-registry.ts` that imports and re-exports only database schema symbols needed by Drizzle Kit. Add a top-of-file comment:

`// Migration registry only. DO NOT import from application code or route handlers.`

Create `tests/unit/schema-registry.test.ts` that recursively scans `src/app`, `src/contexts/*/api`, and `src/contexts/*/application` for imports from `@shared/db/schema-registry` or `src/shared/db/schema-registry` and fails if found.
  </action>
  <verify>
    <automated>pnpm test:unit -- tests/unit/schema-registry.test.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/db/schema-registry.ts` contains `Migration registry only`.
    - `tests/unit/schema-registry.test.ts` contains `schema-registry`.
    - `pnpm test:unit -- tests/unit/schema-registry.test.ts` exits 0.
  </acceptance_criteria>
  <done>The schema registry exists for Drizzle Kit and cannot be imported casually by app layers.</done>
</task>
</tasks>

<verification>
<automated>pnpm test:unit -- tests/unit/schema-registry.test.ts && pnpm typecheck</automated>
</verification>


#### 02-03-PLAN.md

---
phase: 02
plan: "03"
type: execute
wave: 3
depends_on: ["02-02"]
files_modified:
  - src/contexts/identification/infrastructure/db/schema.ts
  - src/contexts/identification/domain/schemas.ts
  - src/contexts/reminders/infrastructure/db/schema.ts
  - src/contexts/reminders/domain/schemas.ts
  - src/contexts/billing/infrastructure/db/schema.ts
  - src/contexts/billing/domain/schemas.ts
  - src/contexts/notifications/infrastructure/db/schema.ts
  - src/contexts/notifications/domain/schemas.ts
  - src/contexts/iam/domain/events.ts
  - src/contexts/catalog/domain/events.ts
  - src/contexts/species-care/domain/events.ts
  - src/contexts/identification/domain/events.ts
  - src/contexts/reminders/domain/events.ts
  - src/contexts/billing/domain/events.ts
  - src/contexts/notifications/domain/events.ts
  - src/contexts/iam/infrastructure/db/schema.ts
  - src/shared/db/schema-registry.ts
  - drizzle/migrations
  - tests/integration/schema-rls.integration.test.ts
autonomous: true
requirements: [INFRA-05, INFRA-08]
tags: [schema, migration, rls]
must_haves:
  truths:
    - "D-06: `identifications.results` is jsonb while `billing_events.payload` and `offline_sync_failures.payload` are json."
    - "D-10/D-20/D-21/D-22/D-23: generated migrations include auth helper SQL, RLS enablement, role-scoped policies, and ownership indexes."
    - "D-35: migration includes a conditional auth.users to public.users insert trigger for minimal user sync when the auth.users table exists."
    - "D-37/D-38: `idempotency_keys` table exists with 7-day `expires_at` contract."
    - "[BLOCKING] `pnpm db:migrate` is run after schema/migration changes and before verification."
  artifacts:
    - path: "drizzle/migrations"
      provides: "Checked-in SQL migration stream with RLS/custom SQL"
      contains: "enable row level security"
---

<objective>
Finish the Phase 2 database model by adding operational contexts and generating the first checked-in migration. This plan is the schema [BLOCKING] point: after all schema modules exist, generate SQL, append custom auth/RLS SQL, and apply the migration locally.

Output: all 19 PRD entities plus `policy_versions` and `idempotency_keys` are in the Drizzle registry, the initial migration applies, and integration tests prove RLS is enabled and ownership indexes exist.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-VALIDATION.md
@/Users/machado/Projects/folhario/docs/CAVE-PRD.md
@/Users/machado/Projects/folhario/drizzle.config.ts
@/Users/machado/Projects/folhario/src/shared/db/schema-registry.ts
</context>

<threat_model>
T-02-05 default-open data: tables created by raw SQL are accessible if RLS is not enabled. Mitigation: migration appends `alter table ... enable row level security` for every app table and a test fails if any table is missing RLS.
T-02-06 policy bypass by null auth: `auth.uid()` returns null for unauthenticated calls. Mitigation: policies include `(select auth.uid()) is not null`.
T-02-07 plain Postgres CI drift: CI service container may lack Supabase `auth` schema and roles. Mitigation: custom SQL creates a minimal `auth.uid()` helper and `authenticated` role only when absent.
</threat_model>

<tasks>
<task type="auto">
  <name>Task 1: Add Identification, Reminders, Billing, Notifications, and support schemas</name>
  <files>src/contexts/identification/infrastructure/db/schema.ts, src/contexts/reminders/infrastructure/db/schema.ts, src/contexts/billing/infrastructure/db/schema.ts, src/contexts/notifications/infrastructure/db/schema.ts, src/contexts/iam/infrastructure/db/schema.ts, src/shared/db/schema-registry.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/docs/CAVE-PRD.md §4 Data Model
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-01 through D-07, D-36 through D-38, D-42, D-49
  </read_first>
  <action>
Create these tables and add them to `src/shared/db/schema-registry.ts`:

Identification context:
- `identifications`: id, user_id, plant_id nullable with `on delete set null`, photo_urls text array, provider, model, results jsonb, selected_result jsonb nullable, manual_correction nullable, latency_ms, consent_version, status, failure_reason nullable, created_at.
- `identification_limits`: id, tier, daily_cap, period_cap, updated_at, updated_by nullable.
- `provider_budgets`: id, provider, purpose, daily_cost_cap_cents, alert_threshold_pct default 80, min_confidence numeric nullable, is_active, updated_at, updated_by nullable, unique(provider,purpose).
- `provider_usage_counters`: id, provider, purpose, utc_date, request_count, estimated_cost_cents, last_updated, unique(provider,purpose,utc_date).

Reminders context:
- `reminders`: id, plant_id, type, frequency_days, advance_rule default `from_scheduled`, next_due_at, is_active, created_at, updated_at.
- `reminder_logs`: id, reminder_id, action, scheduled_date, acted_at, snooze_until nullable.

Billing context:
- `subscriptions`: id, user_id, provider, provider_customer_id nullable, provider_subscription_id nullable, status, trial_start_date, trial_end_date, current_period_start nullable, current_period_end nullable, cancel_at_period_end default false, created_at, updated_at.
- `billing_events`: id, subscription_id nullable, provider, event_id, event_type, payload json, processed_at nullable, created_at, unique(provider,event_id).

Notifications context:
- `push_subscriptions`: id, user_id, device_id, endpoint, keys jsonb, created_at, last_seen_at, unique(user_id,device_id).

IAM support:
- `offline_sync_failures`: id, user_id, action_type, payload json, attempts, last_error, last_attempt_at, created_at.
- `idempotency_keys`: id, user_id, key, request_hash nullable, response_status nullable, response_body jsonb nullable, expires_at, created_at, updated_at, unique(user_id,key).

Create matching domain schema files with drizzle-zod for each context.
  </action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/contexts/identification/infrastructure/db/schema.ts` exports `identifications`, `identificationLimits`, `providerBudgets`, and `providerUsageCounters`.
    - `src/contexts/reminders/infrastructure/db/schema.ts` exports `reminders` and `reminderLogs`.
    - `src/contexts/billing/infrastructure/db/schema.ts` exports `subscriptions` and `billingEvents`.
    - `src/contexts/notifications/infrastructure/db/schema.ts` exports `pushSubscriptions`.
    - `src/contexts/iam/infrastructure/db/schema.ts` exports `offlineSyncFailures` and `idempotencyKeys`.
    - `billingEvents.payload` uses `json`, while `identifications.results` uses `jsonb`.
  </acceptance_criteria>
  <done>All remaining PRD entities and API support tables are in per-context schema modules.</done>
</task>

<task type="auto">
  <name>Task 2: Generate initial migration and append custom auth/RLS SQL</name>
  <files>drizzle/migrations</files>
  <read_first>
    - /Users/machado/Projects/folhario/drizzle.config.ts
    - /Users/machado/Projects/folhario/src/shared/db/schema-registry.ts
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-RESEARCH.md §RLS Pattern
  </read_first>
  <action>
Run `pnpm db:generate -- --name phase_02_initial_schema`.

Append custom SQL to the generated migration for:
- `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
- Conditional `CREATE ROLE authenticated;` when the role is absent.
- Conditional minimal `auth.uid()` helper for plain Postgres/CI when Supabase's auth schema is absent.
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for every app table.
- Reference-table authenticated read policies for `species`, `care_guides`, `identification_limits`, `provider_budgets`, `policy_versions`, and `partner_stores`.
- Owner `FOR ALL TO authenticated` policies for user-owned tables using `(select auth.uid()) is not null and (select auth.uid()) = user_id`.
- Ownership indexes on `user_id`, `plant_id`, `species_id`, and `reminder_id` where policies or FK joins depend on them.
- Conditional `auth.users` insert trigger that runs only when `auth.users` exists and creates a minimal `public.users` row with id, email, locale `pt-BR`, timezone `America/Sao_Paulo`, notification_time_local `09:00`, and created_at now.

Do not seed business reference rows here; Plan 04 owns seed data.
  </action>
  <verify>
    <automated>pnpm db:migrate</automated>
  </verify>
  <acceptance_criteria>
    - A file exists under `drizzle/migrations` whose name or SQL contains `phase_02_initial_schema`.
    - The migration contains `enable row level security`.
    - The migration contains `create policy`.
    - The migration contains `auth.uid`.
    - `pnpm db:migrate` exits 0.
  </acceptance_criteria>
  <done>Initial migration is generated, custom SQL is appended, and the migration applies.</done>
</task>

<task type="auto">
  <name>Task 3: Add schema and RLS integration tests</name>
  <files>tests/integration/schema-rls.integration.test.ts, scripts/check-rls.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/tests/integration/postgres-connection.integration.test.ts
    - /Users/machado/Projects/folhario/scripts/check-rls.ts
  </read_first>
  <action>
Create `tests/integration/schema-rls.integration.test.ts` with the existing cloud-Supabase guard pattern. It must assert:
- All required tables exist in `public`.
- RLS is enabled for every app table.
- Owner-scoped tables have an ownership policy.
- Reference tables have an authenticated select policy.
- Ownership indexes exist on `user_id` columns.

Replace `scripts/check-rls.ts` placeholder logic with the same app table list and fail with a non-zero exit if any table lacks RLS.
  </action>
  <verify>
    <automated>pnpm db:migrate && pnpm test:integration -- tests/integration/schema-rls.integration.test.ts && pnpm db:check-rls</automated>
  </verify>
  <acceptance_criteria>
    - `tests/integration/schema-rls.integration.test.ts` contains `Refusing to run integration tests against cloud Supabase`.
    - `tests/integration/schema-rls.integration.test.ts` names all 19 PRD entity tables.
    - `scripts/check-rls.ts` contains `relrowsecurity`.
    - The automated command exits 0.
  </acceptance_criteria>
  <done>Schema/RLS verification is automated and reusable by `pnpm db:setup`.</done>
</task>

<task type="auto">
  <name>Task 4: Add per-context domain event type files without Inngest wiring</name>
  <files>src/contexts/iam/domain/events.ts, src/contexts/catalog/domain/events.ts, src/contexts/species-care/domain/events.ts, src/contexts/identification/domain/events.ts, src/contexts/reminders/domain/events.ts, src/contexts/billing/domain/events.ts, src/contexts/notifications/domain/events.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/docs/CAVE-PRD.md §3 Bounded Contexts
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-42
  </read_first>
  <action>
Create one `domain/events.ts` file per bounded context with exported string literal event names and TypeScript payload types only. Include the event names from PRD §3:
- IAM: `user.signed_up`, `user.consent_granted`, `user.consent_revoked`, `user.deletion_requested`, `user.deleted`, `data_export.requested`.
- Catalog: `plant.created`, `plant.deleted`.
- Species & Care: `care_guide.augmented`, `care_guide.published`.
- Identification: `identification.succeeded`, `identification.failed`, `provider.ceiling_reached`.
- Reminders: `daily_reminder_summary.due`, `reminder.completed`.
- Billing: `subscription.status_changed`, `payment.failed`, `trial.ending`.
- Notifications: `notification.sent`, `notification.failed`.

Do not import Inngest or register handlers.
  </action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Each bounded context has a `domain/events.ts` file.
    - No `domain/events.ts` file contains `inngest`.
    - `src/contexts/identification/domain/events.ts` contains `identification.succeeded`.
    - `src/contexts/reminders/domain/events.ts` contains `daily_reminder_summary.due`.
  </acceptance_criteria>
  <done>Event contracts exist for downstream phases without async wiring.</done>
</task>
</tasks>

<verification>
<automated>pnpm db:migrate && pnpm test:integration -- tests/integration/schema-rls.integration.test.ts && pnpm db:check-rls</automated>
</verification>


#### 02-04-PLAN.md

---
phase: 02
plan: "04"
type: execute
wave: 4
depends_on: ["02-03"]
files_modified:
  - drizzle/seeds/phase-02.sql
  - scripts/seed.ts
  - scripts/check-seeds.ts
  - supabase/config.toml
  - tests/integration/seed-data.integration.test.ts
  - tests/integration/storage-buckets.integration.test.ts
autonomous: true
requirements: [INFRA-05, INFRA-06, INFRA-24]
tags: [seeds, storage, setup]
must_haves:
  truths:
    - "D-12/D-13/D-48/D-49: static seed data is SQL, `legal_basis` registry values are represented by the PG enum, and policy versions, IdentificationLimit, and ProviderBudget defaults are seeded."
    - "D-24/D-26: `plant-photos`, `plant-thumbnails`, and `data-exports` buckets are private and configured declaratively in `supabase/config.toml`."
    - "D-11: `pnpm db:setup` applies migrations, seed SQL, RLS checks, and seed checks."
    - "INFRA-24: ConsentLog policy version and legal basis references are present in every fresh DB."
  artifacts:
    - path: "drizzle/seeds/phase-02.sql"
      provides: "Idempotent SQL seed data for legal and provider configuration"
      contains: "ON CONFLICT"
---

<objective>
Make a fresh database usable for later feature phases by seeding legal/provider configuration and declaring private Supabase Storage buckets. This plan also turns `pnpm db:setup` into the canonical local/CI setup command.

Output: `pnpm db:setup` applies migrations, seed SQL, RLS checks, and seed checks on a fresh DB; integration tests prove seed rows and bucket config exist.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-RESEARCH.md
@/Users/machado/Projects/folhario/supabase/config.toml
@/Users/machado/Projects/folhario/package.json
</context>

<threat_model>
T-02-08 missing legal seed: identification consent flows can write rows detached from policy/legal-basis references. Mitigation: idempotent SQL seed and seed integration test.
T-02-09 public storage leakage: plant photos and exports are sensitive. Mitigation: all buckets are `public = false`; clients use signed URLs only.
T-02-10 stale local Supabase config: bucket config changes require restart. Mitigation: plan summary must state `supabase stop && supabase start` is required for bucket config refresh.
</threat_model>

<tasks>
<task type="auto">
  <name>Task 1: Add SQL seed file and setup runner</name>
  <files>drizzle/seeds/phase-02.sql, scripts/seed.ts, scripts/check-seeds.ts, package.json</files>
  <read_first>
    - /Users/machado/Projects/folhario/package.json
    - /Users/machado/Projects/folhario/src/shared/db/migration-client.ts
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-12, D-13, D-49
  </read_first>
  <action>
Create `drizzle/seeds/phase-02.sql` with idempotent `INSERT ... ON CONFLICT` statements for:
- policy rows that use the `legal_basis` enum values `consent`, `contract`, and `legitimate_interest`; the legal-basis registry itself is the `legal_basis` PG enum created in the migration, not a separate table.
- policy versions: current `privacy_policy` and `terms_of_service` rows with version `2026-04-25.1`, `is_current=true`, and `effective_at` set to `2026-04-25T00:00:00.000Z`.
- identification limits: `trial` daily 5 / period 75 and `paid` daily 15 / period 200.
- provider budgets: `plant_id` and `openai_compat`, each for `identification` and `care_guide`, `daily_cost_cap_cents=500`, `alert_threshold_pct=80`, `min_confidence=0.30` for identification, null for care_guide, `is_active=true`.

Create `scripts/seed.ts` that reads `drizzle/seeds/phase-02.sql` and executes it through the migration client. Replace `scripts/check-seeds.ts` with checks for all rows above plus a `pg_enum` query proving the `legal_basis` enum has exactly `consent`, `contract`, and `legitimate_interest`.
  </action>
  <verify>
    <automated>pnpm db:migrate && pnpm db:seed && pnpm db:check-seeds</automated>
  </verify>
  <acceptance_criteria>
    - `drizzle/seeds/phase-02.sql` contains `trial` and `paid`.
    - `drizzle/seeds/phase-02.sql` contains `plant_id` and `openai_compat`.
    - `drizzle/seeds/phase-02.sql` contains `2026-04-25.1`.
    - `scripts/check-seeds.ts` contains `pg_enum`.
    - `scripts/seed.ts` reads `drizzle/seeds/phase-02.sql`.
    - The automated command exits 0.
  </acceptance_criteria>
  <done>Fresh DB setup loads legal, policy, cap, and provider configuration idempotently.</done>
</task>

<task type="auto">
  <name>Task 2: Declare private Supabase Storage buckets</name>
  <files>supabase/config.toml</files>
  <read_first>
    - /Users/machado/Projects/folhario/supabase/config.toml
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-24 through D-27
  </read_first>
  <action>
Add these bucket blocks under `[storage]` in `supabase/config.toml`:

```
[storage.buckets.plant-photos]
public = false
file_size_limit = "5MiB"
allowed_mime_types = ["image/jpeg", "image/png", "image/webp"]
objects_path = "./storage/plant-photos"

[storage.buckets.plant-thumbnails]
public = false
file_size_limit = "2MiB"
allowed_mime_types = ["image/jpeg", "image/png", "image/webp"]
objects_path = "./storage/plant-thumbnails"

[storage.buckets.data-exports]
public = false
file_size_limit = "100MiB"
allowed_mime_types = ["application/zip", "application/json"]
objects_path = "./storage/data-exports"
```

Do not enable public buckets.
  </action>
  <verify>
    <automated>pnpm lint</automated>
  </verify>
  <acceptance_criteria>
    - `supabase/config.toml` contains `[storage.buckets.plant-photos]`.
    - `supabase/config.toml` contains `[storage.buckets.plant-thumbnails]`.
    - `supabase/config.toml` contains `[storage.buckets.data-exports]`.
    - Each bucket block contains `public = false`.
  </acceptance_criteria>
  <done>Bucket configuration is declarative and private.</done>
</task>

<task type="auto">
  <name>Task 3: Prove seed and bucket setup</name>
  <files>tests/integration/seed-data.integration.test.ts, tests/integration/storage-buckets.integration.test.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/tests/integration/postgres-connection.integration.test.ts
    - /Users/machado/Projects/folhario/supabase/config.toml
  </read_first>
  <action>
Create `tests/integration/seed-data.integration.test.ts` using the existing cloud DB guard. It must query the migrated DB and assert:
- Current privacy policy row exists.
- Current terms row exists.
- Trial and paid identification limit rows exist with exact caps.
- Four provider budget rows exist with USD 5/day caps.

Create `tests/integration/storage-buckets.integration.test.ts` that parses `supabase/config.toml` as text and asserts the three bucket blocks are present and private. Do not require Docker/Supabase Studio for this automated test.
  </action>
  <verify>
    <automated>pnpm db:setup && pnpm test:integration -- tests/integration/seed-data.integration.test.ts tests/integration/storage-buckets.integration.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `tests/integration/seed-data.integration.test.ts` contains `trial`.
    - `tests/integration/seed-data.integration.test.ts` contains `daily_cap`.
    - `tests/integration/storage-buckets.integration.test.ts` contains `plant-photos`.
    - The automated command exits 0.
  </acceptance_criteria>
  <done>Seed data and bucket declarations are covered by integration checks.</done>
</task>
</tasks>

<verification>
<automated>pnpm db:setup && pnpm test:integration -- tests/integration/seed-data.integration.test.ts tests/integration/storage-buckets.integration.test.ts</automated>
</verification>


#### 02-05-PLAN.md

---
phase: 02
plan: "05"
type: execute
wave: 4
depends_on: ["02-03"]
files_modified:
  - src/shared/db/client.ts
  - src/shared/db/unit-of-work.ts
  - src/contexts/iam/infrastructure/db/users.ts
  - src/contexts/iam/infrastructure/db/consent-logs.ts
  - src/contexts/catalog/infrastructure/db/plants.ts
  - src/contexts/iam/application/user-query-service.ts
  - eslint.config.mjs
  - tests/unit/db-client.test.ts
  - tests/unit/no-drizzle-in-routes.test.ts
  - tests/integration/unit-of-work.integration.test.ts
autonomous: true
requirements: [INFRA-03, INFRA-04]
tags: [db-client, repositories, guardrails]
must_haves:
  truths:
    - "D-14/D-15: `src/shared/db/client.ts` lazy-initializes a postgres-js client using `DATABASE_POOL_URL` and `{ prepare: false }`."
    - "D-16/D-18/D-41: repositories are functional modules accepting a DB/UoW client; use-cases get a UnitOfWork boundary and one IAM query-service example."
    - "D-17: no route handler imports Drizzle, schema tables, or `src/shared/db/schema-registry.ts`."
    - "D-20: UnitOfWork sets request user context for RLS tests but repositories still use explicit user filters."
  artifacts:
    - path: "src/shared/db/client.ts"
      provides: "Pooled runtime Drizzle client"
      contains: "prepare: false"
---

<objective>
Add the runtime database access layer and guardrails that keep Drizzle out of route handlers. This is where Phase 2 turns schema into usable backend infrastructure while preserving explicit user scoping.

Output: a pooled runtime client, UnitOfWork helper, initial repositories/query services, ESLint guard, and tests proving route handlers cannot import DB internals.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-PATTERNS.md
@/Users/machado/Projects/folhario/src/shared/config/server-env.ts
@/Users/machado/Projects/folhario/src/app/api/v1/diagnostics/ping/route.ts
</context>

<threat_model>
T-02-11 route-layer data bypass: importing Drizzle in handlers can skip use-case authorization and idempotency conventions. Mitigation: ESLint no-restricted-imports plus Vitest grep guard.
T-02-12 RLS-only authorization assumption: direct server SQL may not carry Supabase Auth context. Mitigation: repositories always accept `userId` filters and UnitOfWork sets DB request context only as defense in depth.
T-02-13 connection storm: Vercel warm invocations can open too many clients. Mitigation: lazy global singleton client.
</threat_model>

<tasks>
<task type="auto">
  <name>Task 1: Implement pooled runtime DB client</name>
  <files>src/shared/db/client.ts, tests/unit/db-client.test.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/shared/config/server-env.ts
    - /Users/machado/Projects/folhario/tests/integration/postgres-connection.integration.test.ts
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-RESEARCH.md §Database Client Pattern
  </read_first>
  <action>
Create `src/shared/db/client.ts` exporting:
- `getSql()` lazy global singleton using `postgres(getServerEnv().DATABASE_POOL_URL, { prepare: false })`.
- `db` from `drizzle({ client: getSql(), schema })` where schema imports from the registry only inside the DB infrastructure layer.
- `closeDb()` for tests.

Create `tests/unit/db-client.test.ts` that reads the source file and asserts it contains `DATABASE_POOL_URL`, `prepare: false`, and does not contain `DATABASE_URL`.
  </action>
  <verify>
    <automated>pnpm test:unit -- tests/unit/db-client.test.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/db/client.ts` contains `DATABASE_POOL_URL`.
    - `src/shared/db/client.ts` contains `prepare: false`.
    - `tests/unit/db-client.test.ts` fails if `src/shared/db/client.ts` contains `DATABASE_URL`.
  </acceptance_criteria>
  <done>Runtime database access uses the pooled Supavisor-safe path.</done>
</task>

<task type="auto">
  <name>Task 2: Implement UnitOfWork and initial repositories</name>
  <files>src/shared/db/unit-of-work.ts, src/contexts/iam/infrastructure/db/users.ts, src/contexts/iam/infrastructure/db/consent-logs.ts, src/contexts/catalog/infrastructure/db/plants.ts, src/contexts/iam/application/user-query-service.ts, tests/integration/unit-of-work.integration.test.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/shared/db/client.ts
    - /Users/machado/Projects/folhario/src/contexts/iam/infrastructure/db/schema.ts
    - /Users/machado/Projects/folhario/src/contexts/catalog/infrastructure/db/schema.ts
  </read_first>
  <action>
Create `src/shared/db/unit-of-work.ts` with:
- `type DbClient` inferred from Drizzle.
- `withUnitOfWork<T>(userId: string, fn: (tx: DbClient) => Promise<T>): Promise<T>`.
- Inside the transaction, call `select set_config('request.jwt.claim.sub', userId, true)` before invoking `fn`.

Create functional repositories:
- `users.findById(db, userId)` with explicit `where users.id = userId`.
- `consentLogs.create(db, input)` and `consentLogs.listByUser(db, userId, cursorOptions)` with explicit `userId` filters.
- `plants.findByIdForUser(db, userId, plantId)` with explicit joins/filters.

Create `src/contexts/iam/application/user-query-service.ts` as the cross-context read example exposing `getUserSummary(db, userId)`.

Create integration tests proving `withUnitOfWork` sets the request claim and repository functions include explicit user filters in observable behavior.
  </action>
  <verify>
    <automated>pnpm test:integration -- tests/integration/unit-of-work.integration.test.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/db/unit-of-work.ts` contains `set_config`.
    - `src/contexts/iam/infrastructure/db/users.ts` exports `findById`.
    - `src/contexts/iam/infrastructure/db/consent-logs.ts` exports `create` and `listByUser`.
    - `src/contexts/iam/application/user-query-service.ts` exports `getUserSummary`.
    - Integration test exits 0.
  </acceptance_criteria>
  <done>Data access has a repository/UoW shape suitable for thin route handlers.</done>
</task>

<task type="auto">
  <name>Task 3: Enforce no Drizzle in route handlers</name>
  <files>eslint.config.mjs, tests/unit/no-drizzle-in-routes.test.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/eslint.config.mjs
    - /Users/machado/Projects/folhario/src/app/api/v1/diagnostics/ping/route.ts
    - /Users/machado/Projects/folhario/tests/unit/schema-registry.test.ts
  </read_first>
  <action>
Update `eslint.config.mjs` with a no-restricted-imports rule for files matching `src/app/api/**/route.ts` that blocks:
- `drizzle-orm`
- `drizzle-orm/*`
- `@shared/db/client`
- `@shared/db/schema-registry`
- `@contexts/*/infrastructure/db/schema`

Create `tests/unit/no-drizzle-in-routes.test.ts` that recursively scans `src/app/api` route files and fails on those same import patterns.
  </action>
  <verify>
    <automated>pnpm lint && pnpm test:unit -- tests/unit/no-drizzle-in-routes.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `eslint.config.mjs` contains `no-restricted-imports`.
    - `tests/unit/no-drizzle-in-routes.test.ts` contains `drizzle-orm`.
    - `pnpm lint` exits 0.
    - `pnpm test:unit -- tests/unit/no-drizzle-in-routes.test.ts` exits 0.
  </acceptance_criteria>
  <done>Route handlers are mechanically prevented from importing Drizzle or schema internals.</done>
</task>
</tasks>

<verification>
<automated>pnpm test:unit -- tests/unit/db-client.test.ts tests/unit/no-drizzle-in-routes.test.ts && pnpm test:integration -- tests/integration/unit-of-work.integration.test.ts && pnpm lint && pnpm typecheck</automated>
</verification>


#### 02-06-PLAN.md

---
phase: 02
plan: "06"
type: tdd
wave: 5
depends_on: ["02-05"]
files_modified:
  - src/shared/api/cursor.ts
  - src/shared/api/idempotency.ts
  - src/shared/api/request.ts
  - src/contexts/iam/domain/consent-schemas.ts
  - tests/unit/api-conventions.test.ts
  - tests/integration/idempotency.integration.test.ts
autonomous: true
requirements: [INFRA-03, INFRA-09, INFRA-21, INFRA-22]
tags: [api, zod, cursor, idempotency, tdd]
must_haves:
  truths:
    - "D-19: routes import refined domain schemas derived from drizzle-zod, not raw table definitions."
    - "D-36: cursors are base64 JSON `{ id, createdAt }`; malformed cursors return `validation_failed`."
    - "D-37/D-38: idempotency persists responses by `(user_id, key)` for 7 days."
    - "INFRA-21/INFRA-22: default page size is 50, max page size is 200, and mutating endpoints can replay stored JSON responses."
  artifacts:
    - path: "src/shared/api/cursor.ts"
      provides: "Opaque cursor parsing and encoding"
      contains: "DEFAULT_LIMIT"
---

<objective>
Use TDD to add API convention helpers before the diagnostic route exists: Zod boundary parsing, opaque cursor pagination, and database-backed idempotency. These helpers make later route handlers thin and consistent.

Output: tested helpers for request validation, cursor encode/decode, and idempotent mutating endpoint execution.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/references/tdd.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/src/shared/config/errors.ts
@/Users/machado/Projects/folhario/src/contexts/iam/domain/schemas.ts
@/Users/machado/Projects/folhario/src/contexts/iam/infrastructure/db/schema.ts
</context>

<threat_model>
T-02-14 cursor tampering: malformed cursors can cause 500s or data leakage through unbounded queries. Mitigation: Zod-validated base64 JSON and closed `validation_failed` errors.
T-02-15 idempotency race: SELECT-then-INSERT can duplicate mutations. Mitigation: unique `(user_id,key)` row and transactional insert/lock semantics.
T-02-16 replay mismatch: same key with different body can return an unrelated response. Mitigation: optional request hash and `conflict` for mismatches.
</threat_model>

<tasks>
<task type="tdd">
  <name>Task 1: RED/GREEN cursor helper</name>
  <files>tests/unit/api-conventions.test.ts, src/shared/api/cursor.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/shared/config/errors.ts
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-36
  </read_first>
  <action>
RED: create tests asserting:
- `encodeCursor({ id, createdAt })` returns an opaque string.
- `decodeCursor(encoded)` returns the original UUID and ISO datetime.
- malformed base64 returns an `ErrorCode.ValidationFailed` result, not a thrown 500.
- `normalizeLimit(undefined)` returns 50.
- `normalizeLimit("250")` returns 200.

GREEN: implement `src/shared/api/cursor.ts` with constants `DEFAULT_LIMIT = 50` and `MAX_LIMIT = 200`.

REFACTOR: remove duplication in tests only if the green code remains simple.
  </action>
  <verify>
    <automated>pnpm test:unit -- tests/unit/api-conventions.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - RED test fails before `src/shared/api/cursor.ts` exists.
    - `src/shared/api/cursor.ts` contains `DEFAULT_LIMIT = 50`.
    - `src/shared/api/cursor.ts` contains `MAX_LIMIT = 200`.
    - Unit test exits 0 after GREEN.
  </acceptance_criteria>
  <done>Cursor contract is test-first and reusable.</done>
</task>

<task type="tdd">
  <name>Task 2: RED/GREEN request validation helper and ConsentLog domain schema</name>
  <files>tests/unit/api-conventions.test.ts, src/shared/api/request.ts, src/contexts/iam/domain/consent-schemas.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/shared/config/errors.ts
    - /Users/machado/Projects/folhario/src/contexts/iam/domain/schemas.ts
  </read_first>
  <action>
RED: add tests for `parseJsonBody(request, schema)` and `parseQuery(url, schema)`:
- valid input returns parsed data.
- invalid input returns `validation_failed`.
- invalid JSON returns `validation_failed`.

GREEN: implement `src/shared/api/request.ts` with those helpers using Zod.

Create `src/contexts/iam/domain/consent-schemas.ts` derived from `consentLogs` drizzle-zod schema and refined for the diagnostic route body:
- `purpose`
- `legalBasis`
- `policyVersionId`
- `source`
  </action>
  <verify>
    <automated>pnpm test:unit -- tests/unit/api-conventions.test.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/api/request.ts` imports `z` from `zod`.
    - `src/contexts/iam/domain/consent-schemas.ts` imports from `drizzle-zod` or from a drizzle-zod-derived IAM schema.
    - Invalid JSON test expects `ErrorCode.ValidationFailed`.
  </acceptance_criteria>
  <done>Route body/query validation has a shared helper and ConsentLog has a domain schema.</done>
</task>

<task type="tdd">
  <name>Task 3: RED/GREEN idempotency transaction wrapper</name>
  <files>tests/integration/idempotency.integration.test.ts, src/shared/api/idempotency.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/shared/db/unit-of-work.ts
    - /Users/machado/Projects/folhario/src/contexts/iam/infrastructure/db/schema.ts
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-37, D-38
  </read_first>
  <action>
RED: create integration tests asserting:
- first call with `(userId, key)` executes the handler and stores JSON response status/body.
- second call with same `(userId, key)` returns stored status/body without executing handler.
- same key with a different request hash returns `conflict`.
- rows use `expires_at = now + interval '7 days'`.

GREEN: implement `withIdempotency(db, input, handler)` using the `idempotency_keys` table inside a transaction. Use unique constraints and row locking; do not implement SELECT-then-INSERT without conflict handling.
  </action>
  <verify>
    <automated>pnpm db:setup && pnpm test:integration -- tests/integration/idempotency.integration.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/api/idempotency.ts` contains `expiresAt`.
    - `src/shared/api/idempotency.ts` contains `ErrorCode.Conflict`.
    - `tests/integration/idempotency.integration.test.ts` asserts the handler call count is 1 after two same-key calls.
    - The automated command exits 0.
  </acceptance_criteria>
  <done>Mutating endpoints have a DB-backed replay-safe idempotency primitive.</done>
</task>
</tasks>

<verification>
<automated>pnpm test:unit -- tests/unit/api-conventions.test.ts && pnpm db:setup && pnpm test:integration -- tests/integration/idempotency.integration.test.ts && pnpm typecheck</automated>
</verification>


#### 02-07-PLAN.md

---
phase: 02
plan: "07"
type: tdd
wave: 5
depends_on: ["02-05"]
files_modified:
  - src/contexts/iam/infrastructure/auth/auth-adapter.ts
  - src/contexts/iam/application/current-user.ts
  - src/shared/api/auth.ts
  - src/proxy.ts
  - tests/unit/auth-adapter.test.ts
  - tests/integration/auth-jwt.integration.test.ts
autonomous: true
requirements: [INFRA-03, INFRA-07]
tags: [auth, jwt, proxy, tdd]
must_haves:
  truths:
    - "D-32/D-33: AuthAdapter verifies Supabase JWTs with `jose`, derives `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`, and exposes `getUserById(id)` for smoke-route user lookup."
    - "D-34/D-47: `src/proxy.ts` composes API auth fast rejection while route helpers remain authoritative; missing smoke-route JWT returns 401."
    - "D-44: most tests may mock JWT verification, but at least one path exercises real `jose` JWKS verification."
    - "INFRA-07: public endpoints are explicit; `/api/v1/diagnostics/consent` is protected."
  artifacts:
    - path: "src/contexts/iam/infrastructure/auth/auth-adapter.ts"
      provides: "Supabase JWT verification boundary"
      contains: "createRemoteJWKSet"
---

<objective>
Use TDD to put Supabase Auth behind an adapter and wire API auth helpers/proxy behavior without building full signup/login. The route helper remains authoritative; Proxy provides fast rejection and request-header propagation.

Output: JWT verification, `getCurrentUser`, protected API helper, proxy matcher that includes `/api/v1`, and tests for missing/invalid/valid token behavior.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/references/tdd.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-RESEARCH.md
@/Users/machado/Projects/folhario/src/proxy.ts
@/Users/machado/Projects/folhario/src/shared/config/errors.ts
</context>

<threat_model>
T-02-17 unsigned-token acceptance: decoding without verification would let any caller spoof a user id. Mitigation: use `jose.jwtVerify` and never expose a decode-only success path.
T-02-18 proxy overreach: putting all authorization in Proxy can drift from route/use-case checks. Mitigation: Proxy fast rejects only obvious protected API misses; route helper verifies again.
T-02-19 JWKS local mismatch: Supabase JWKS can be empty with legacy signing keys. Mitigation: adapter fails closed with `unauthenticated` and the integration test prints a targeted message.
</threat_model>

<tasks>
<task type="tdd">
  <name>Task 1: RED/GREEN AuthAdapter JWT verification</name>
  <files>tests/unit/auth-adapter.test.ts, src/contexts/iam/infrastructure/auth/auth-adapter.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/shared/config/server-env.ts
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-RESEARCH.md §JWT/Auth Pattern
  </read_first>
  <action>
RED: create unit tests for an `AuthAdapter` with:
- missing bearer returns `ErrorCode.Unauthenticated`.
- malformed bearer returns `ErrorCode.Unauthenticated`.
- a JWT signed by a test key and verified through a local JWKS endpoint returns `{ userId }`.

GREEN: implement `src/contexts/iam/infrastructure/auth/auth-adapter.ts` using `jose.createRemoteJWKSet` and `jwtVerify`. The default JWKS URL must be `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`; tests may inject a local JWKS URL through the adapter factory. The adapter also exposes `getUserById(id)` by delegating to the IAM users repository.
  </action>
  <verify>
    <automated>pnpm test:unit -- tests/unit/auth-adapter.test.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `auth-adapter.ts` contains `createRemoteJWKSet`.
    - `auth-adapter.ts` contains `jwtVerify`.
    - `auth-adapter.ts` contains `getUserById`.
    - Unit test contains `JWKS`.
    - Unit test exits 0.
  </acceptance_criteria>
  <done>JWT verification is cryptographic and adapter-bound.</done>
</task>

<task type="tdd">
  <name>Task 2: RED/GREEN current user and protected API helpers</name>
  <files>src/contexts/iam/application/current-user.ts, src/shared/api/auth.ts, tests/unit/auth-adapter.test.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/contexts/iam/infrastructure/db/users.ts
    - /Users/machado/Projects/folhario/src/shared/config/errors.ts
  </read_first>
  <action>
RED: add tests proving `requireApiUser(request)`:
- returns `unauthenticated` for no `Authorization` header.
- returns `unauthenticated` for invalid JWT.
- returns `{ id }` for a valid JWT whose user row exists.

GREEN: create `src/contexts/iam/application/current-user.ts` using `AuthAdapter.verifyBearer` plus `users.findById`. Create `src/shared/api/auth.ts` exporting `requireApiUser(request)` that maps auth failures with the closed error registry.
  </action>
  <verify>
    <automated>pnpm test:unit -- tests/unit/auth-adapter.test.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/api/auth.ts` exports `requireApiUser`.
    - `src/contexts/iam/application/current-user.ts` imports a users repository, not a route file.
    - Missing auth path maps to `ErrorCode.Unauthenticated`.
  </acceptance_criteria>
  <done>API routes can ask for a current user without knowing Supabase internals.</done>
</task>

<task type="auto">
  <name>Task 3: Compose API-aware Proxy behavior</name>
  <files>src/proxy.ts, tests/integration/auth-jwt.integration.test.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/proxy.ts
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-07-SUMMARY.md
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-34, D-47
  </read_first>
  <action>
Update `src/proxy.ts` so its matcher includes `/api/v1/:path*` and still excludes `_next`, `_vercel`, and static assets. Add a small public-endpoint list for:
- `/api/v1/diagnostics/ping`

For protected `/api/v1/*` requests without `Authorization: Bearer ...`, return `unauthenticated` 401 using the closed error response shape. For all other cases, call `NextResponse.next()`. Do not verify JWT cryptographically inside Proxy; route helpers do that.

Create `tests/integration/auth-jwt.integration.test.ts` that imports Proxy or exercises helper behavior for protected vs public paths and includes one test that uses `AuthAdapter` against a local JWKS endpoint.
  </action>
  <verify>
    <automated>pnpm test:integration -- tests/integration/auth-jwt.integration.test.ts && pnpm lint && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/proxy.ts` matcher no longer excludes all `api` paths.
    - `src/proxy.ts` contains `/api/v1/diagnostics/ping` as public.
    - `src/proxy.ts` returns `unauthenticated` for protected API requests with no bearer.
    - Integration test exits 0.
  </acceptance_criteria>
  <done>Proxy and route helpers share a clear split: fast missing-bearer rejection at the edge, real JWT verification in backend helpers.</done>
</task>
</tasks>

<verification>
<automated>pnpm test:unit -- tests/unit/auth-adapter.test.ts && pnpm test:integration -- tests/integration/auth-jwt.integration.test.ts && pnpm lint && pnpm typecheck</automated>
</verification>


#### 02-08-PLAN.md

---
phase: 02
plan: "08"
type: tdd
wave: 6
depends_on: ["02-04", "02-05", "02-06", "02-07"]
files_modified:
  - src/shared/adapters/storage.ts
  - src/shared/adapters/supabase-storage.ts
  - src/shared/images/client-compress.ts
  - src/shared/images/server-validate.ts
  - src/contexts/catalog/infrastructure/photo-storage.ts
  - src/contexts/catalog/application/upload-photo.ts
  - src/app/api/v1/photos/upload/route.ts
  - tests/unit/image-pipeline.test.ts
  - tests/integration/storage-adapter.integration.test.ts
  - tests/integration/photo-upload.integration.test.ts
autonomous: true
requirements: [INFRA-03, INFRA-06, INFRA-19]
tags: [storage, images, upload, tdd]
must_haves:
  truths:
    - "D-23/D-24/D-25/D-26/D-27: clients never call Storage directly; server routes use a StorageAdapter, private buckets, and `{user_id}/{aggregate_id}/{file_id}.{ext}` paths."
    - "D-28/D-29/D-30/D-31: browser-image-compression strips EXIF, server uses exifr for GPS detection, and sharp creates thumbnails synchronously."
    - "INFRA-19: server rejects GPS-bearing uploads with `validation_failed` before any storage write."
    - "INFRA-03: upload route validates and delegates; no Drizzle import in `route.ts`."
  artifacts:
    - path: "src/app/api/v1/photos/upload/route.ts"
      provides: "Server upload proxy route"
      contains: "runtime = \"nodejs\""
---

<objective>
Use TDD where behavior is testable to implement the storage adapter and image upload foundation. This plan proves private bucket access, signed URL helpers, client compression configuration, server GPS rejection, and thumbnail writing without building product UI.

Output: authenticated users can upload a plant photo through `/api/v1/photos/upload`; GPS metadata is rejected before storage, and successful uploads create original + thumbnail objects and PhotoEntry metadata through application services.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/references/tdd.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-RESEARCH.md
@/Users/machado/Projects/folhario/supabase/config.toml
@/Users/machado/Projects/folhario/src/shared/api/auth.ts
@/Users/machado/Projects/folhario/src/shared/config/errors.ts
</context>

<threat_model>
T-02-20 GPS leakage: EXIF GPS can be stored despite client-side strip. Mitigation: server parses uploaded bytes with exifr and rejects before adapter upload.
T-02-21 service-role exposure: Supabase service role in browser would bypass RLS. Mitigation: storage adapter is server-only and route uses signed URL helpers.
T-02-22 native package runtime mismatch: sharp fails on edge runtime. Mitigation: upload route exports `runtime = "nodejs"` and build verifies import.
</threat_model>

<tasks>
<task type="tdd">
  <name>Task 1: RED/GREEN client compression and server GPS validation helpers</name>
  <files>tests/unit/image-pipeline.test.ts, src/shared/images/client-compress.ts, src/shared/images/server-validate.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-28 through D-31
    - /Users/machado/Projects/folhario/src/shared/config/errors.ts
  </read_first>
  <action>
RED: create unit tests asserting:
- `compressPlantPhoto(file)` calls browser-image-compression with `maxSizeMB: 1`, `useWebWorker: true`, and `preserveExif: false`.
- `rejectGpsMetadata(buffer)` returns `validation_failed` when `exifr.gps()` returns coordinates.
- `rejectGpsMetadata(buffer)` returns ok when no GPS data exists.

GREEN: implement `src/shared/images/client-compress.ts` and `src/shared/images/server-validate.ts`. Keep the client helper browser-safe and the server helper Node-safe.
  </action>
  <verify>
    <automated>pnpm test:unit -- tests/unit/image-pipeline.test.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/images/client-compress.ts` contains `maxSizeMB: 1`.
    - `src/shared/images/client-compress.ts` contains `preserveExif: false`.
    - `src/shared/images/server-validate.ts` imports `exifr`.
    - Unit test exits 0.
  </acceptance_criteria>
  <done>Image helper behavior is defined before upload route work begins.</done>
</task>

<task type="tdd">
  <name>Task 2: RED/GREEN StorageAdapter and catalog photo-storage helper</name>
  <files>tests/integration/storage-adapter.integration.test.ts, src/shared/adapters/storage.ts, src/shared/adapters/supabase-storage.ts, src/contexts/catalog/infrastructure/photo-storage.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/supabase/config.toml
    - /Users/machado/Projects/folhario/src/shared/config/server-env.ts
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md D-23 through D-27
  </read_first>
  <action>
RED: create tests asserting a fake adapter receives object keys in the exact form:
- `plant-photos/{user_id}/{plant_id}/{photo_id}.jpg`
- `plant-thumbnails/{user_id}/{plant_id}/{photo_id}.jpg`

Add an integration test that creates the Supabase storage adapter and verifies bucket names are `plant-photos`, `plant-thumbnails`, and `data-exports`. If local Supabase Storage is unavailable, the test should skip with a clear message; it must not hit cloud Supabase.

GREEN: implement:
- `StorageAdapter` interface with `uploadObject`, `deletePrefix`, and `createSignedUrl`.
- `createSupabaseStorageAdapter()` using `@supabase/supabase-js` and `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- `photo-storage.ts` helpers for original and thumbnail object paths.
  </action>
  <verify>
    <automated>pnpm test:integration -- tests/integration/storage-adapter.integration.test.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/adapters/storage.ts` exports `StorageAdapter`.
    - `src/shared/adapters/supabase-storage.ts` contains `SUPABASE_SERVICE_ROLE_KEY`.
    - `src/contexts/catalog/infrastructure/photo-storage.ts` contains `plant-photos`.
    - Integration test exits 0 or skips only when local Storage is unavailable.
  </acceptance_criteria>
  <done>Storage access is adapterized and path conventions are tested.</done>
</task>

<task type="auto">
  <name>Task 3: Implement photo upload use-case and route</name>
  <files>src/contexts/catalog/application/upload-photo.ts, src/app/api/v1/photos/upload/route.ts, tests/integration/photo-upload.integration.test.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/shared/api/auth.ts
    - /Users/machado/Projects/folhario/src/shared/images/server-validate.ts
    - /Users/machado/Projects/folhario/src/contexts/catalog/infrastructure/db/schema.ts
    - /Users/machado/Projects/folhario/src/app/api/v1/diagnostics/ping/route.ts
  </read_first>
  <action>
Create `src/contexts/catalog/application/upload-photo.ts` that:
- requires a user id and multipart file buffer.
- validates MIME `image/jpeg`, `image/png`, or `image/webp`.
- rejects files over 1 MiB at the application boundary with `validation_failed`.
- calls `rejectGpsMetadata` before any storage write.
- uses `sharp` to generate a thumbnail synchronously.
- uploads original and thumbnail through `StorageAdapter`.
- inserts `PhotoEntry` metadata via repository/UoW.

Create `src/app/api/v1/photos/upload/route.ts` with `export const runtime = "nodejs"`. The route must call `requireApiUser`, parse multipart form data, call the use-case, and map errors with `errorResponse`. It must not import Drizzle.

Create integration tests for GPS rejection before fake adapter upload and successful adapter call order.
  </action>
  <verify>
    <automated>pnpm test:unit -- tests/unit/no-drizzle-in-routes.test.ts && pnpm test:integration -- tests/integration/photo-upload.integration.test.ts && pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/api/v1/photos/upload/route.ts` contains `runtime = "nodejs"`.
    - `src/app/api/v1/photos/upload/route.ts` does not contain `drizzle-orm`.
    - `src/contexts/catalog/application/upload-photo.ts` imports `sharp`.
    - `tests/integration/photo-upload.integration.test.ts` asserts GPS rejection before upload.
    - Automated command exits 0.
  </acceptance_criteria>
  <done>Photo upload exercises auth, validation, storage adapter, GPS defense, thumbnail generation, and repository writes.</done>
</task>
</tasks>

<verification>
<automated>pnpm test:unit -- tests/unit/image-pipeline.test.ts tests/unit/no-drizzle-in-routes.test.ts && pnpm test:integration -- tests/integration/storage-adapter.integration.test.ts tests/integration/photo-upload.integration.test.ts && pnpm build</automated>
</verification>


#### 02-09-PLAN.md

---
phase: 02
plan: "09"
type: tdd
wave: 6
depends_on: ["02-04", "02-05", "02-06", "02-07"]
files_modified:
  - src/contexts/iam/application/record-consent.ts
  - src/contexts/iam/api/consent-route.ts
  - src/app/api/v1/diagnostics/consent/route.ts
  - tests/integration/diagnostics-consent.integration.test.ts
  - tests/e2e/diagnostics-consent.spec.ts
autonomous: true
requirements: [INFRA-03, INFRA-07, INFRA-09, INFRA-21, INFRA-22, INFRA-24]
tags: [api, diagnostics, consent, tdd]
must_haves:
  truths:
    - "D-39: the ConsentLog smoke route is implemented at routable `/api/v1/diagnostics/consent`; `_diagnostics` is intentionally not used because Next ignores underscore route segments."
    - "D-41: the smoke route uses the IAM user query service as the cross-context/query-service example."
    - "D-45/D-47: route requires a real JWT, returns 401 when missing, and has Playwright coverage over real HTTP."
    - "INFRA-03/09/21/22/24: route proves thin handler, drizzle-zod-derived Zod validation, cursor pagination, idempotency, and seeded legal policy data."
  artifacts:
    - path: "src/app/api/v1/diagnostics/consent/route.ts"
      provides: "Phase 2 API conventions smoke route"
      contains: "requireApiUser"
---

<objective>
Use TDD to build the Phase 2 diagnostic route that proves the database/API conventions work together. This is a technical smoke surface, not product UI.

Output: `POST /api/v1/diagnostics/consent` records a ConsentLog row with JWT and Idempotency-Key; `GET /api/v1/diagnostics/consent` returns cursor-paginated history; integration and Playwright tests cover missing auth, validation, idempotent replay, and cursor behavior.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/references/tdd.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-PATTERNS.md
@/Users/machado/Projects/folhario/src/app/api/v1/diagnostics/ping/route.ts
@/Users/machado/Projects/folhario/src/shared/api/auth.ts
@/Users/machado/Projects/folhario/src/shared/api/cursor.ts
@/Users/machado/Projects/folhario/src/shared/api/idempotency.ts
@/Users/machado/Projects/folhario/src/shared/config/errors.ts
</context>

<threat_model>
T-02-23 diagnostic route exposure: a diagnostics route can become an unauthenticated write surface. Mitigation: protected by `requireApiUser`; missing bearer returns 401.
T-02-24 route-discovery regression: using `_diagnostics` would silently 404. Mitigation: implement `/diagnostics/consent` and test real HTTP with Playwright.
T-02-25 duplicate consent writes: retries can create duplicate ConsentLog rows. Mitigation: POST is wrapped in DB-backed Idempotency-Key handling.
</threat_model>

<tasks>
<task type="tdd">
  <name>Task 1: RED/GREEN ConsentLog use-case</name>
  <files>tests/integration/diagnostics-consent.integration.test.ts, src/contexts/iam/application/record-consent.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/contexts/iam/infrastructure/db/consent-logs.ts
    - /Users/machado/Projects/folhario/src/contexts/iam/domain/consent-schemas.ts
    - /Users/machado/Projects/folhario/drizzle/seeds/phase-02.sql
  </read_first>
  <action>
RED: create integration tests for `recordConsent`:
- valid input creates a ConsentLog for the authenticated user.
- missing current policy version returns `validation_failed` or a typed domain error, not an unhandled 500.
- the created row references the current policy version from seed data.

GREEN: implement `src/contexts/iam/application/record-consent.ts` using UnitOfWork, `consentLogs.create`, and the seeded `policy_versions` row.
  </action>
  <verify>
    <automated>pnpm db:setup && pnpm test:integration -- tests/integration/diagnostics-consent.integration.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/contexts/iam/application/record-consent.ts` exports `recordConsent`.
    - Integration test asserts a row exists in `consent_logs`.
    - Integration test exits 0.
  </acceptance_criteria>
  <done>ConsentLog write behavior is covered before the route is built.</done>
</task>

<task type="tdd">
  <name>Task 2: RED/GREEN route module with POST idempotency and GET pagination</name>
  <files>src/contexts/iam/api/consent-route.ts, src/app/api/v1/diagnostics/consent/route.ts, tests/integration/diagnostics-consent.integration.test.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/app/api/v1/diagnostics/ping/route.ts
    - /Users/machado/Projects/folhario/src/shared/api/auth.ts
    - /Users/machado/Projects/folhario/src/shared/api/request.ts
    - /Users/machado/Projects/folhario/src/shared/api/idempotency.ts
    - /Users/machado/Projects/folhario/src/shared/api/cursor.ts
  </read_first>
  <action>
RED: extend integration tests by importing the route module directly and asserting:
- `POST` without bearer returns 401 `unauthenticated`.
- `POST` without `Idempotency-Key` returns 400 `validation_failed`.
- valid `POST` returns 201 and creates one ConsentLog.
- repeated valid `POST` with same key returns the same JSON and creates only one row.
- `GET` returns `items`, `next_cursor`, default limit 50, and max limit 200.
- malformed cursor returns 400 `validation_failed`.

GREEN: create `src/contexts/iam/api/consent-route.ts` as the handler/use-case coordinator. Create `src/app/api/v1/diagnostics/consent/route.ts` that exports `GET` and `POST`, delegates to the IAM API module, and contains no Drizzle imports.
  </action>
  <verify>
    <automated>pnpm db:setup && pnpm test:integration -- tests/integration/diagnostics-consent.integration.test.ts && pnpm test:unit -- tests/unit/no-drizzle-in-routes.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/api/v1/diagnostics/consent/route.ts` exists.
    - No file path under `src/app/api/v1/_diagnostics` exists.
    - Route file contains `POST` and `GET`.
    - Route file does not contain `drizzle-orm`.
    - Integration test exits 0.
  </acceptance_criteria>
  <done>The diagnostic route proves thin handler, auth, Zod, idempotency, and cursor contracts in-process.</done>
</task>

<task type="auto">
  <name>Task 3: Add Playwright HTTP smoke coverage</name>
  <files>tests/e2e/diagnostics-consent.spec.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/playwright.config.ts
    - /Users/machado/Projects/folhario/tests/e2e/diagnostics-posthog.spec.ts
    - /Users/machado/Projects/folhario/tests/integration/auth-jwt.integration.test.ts
  </read_first>
  <action>
Create `tests/e2e/diagnostics-consent.spec.ts` using Playwright's `request` fixture. It must:
- prove `GET /api/v1/diagnostics/consent` without bearer returns 401.
- obtain or construct a valid test JWT using the same test helper pattern from `auth-jwt.integration.test.ts`.
- send two identical `POST /api/v1/diagnostics/consent` requests with the same `Idempotency-Key` and assert the response body is the same.
- call `GET /api/v1/diagnostics/consent?limit=1` and assert `next_cursor` is present or null and never parsed by the test.

If the local Supabase JWKS endpoint lacks keys, skip the valid-token part with a targeted message; do not weaken production code to decode-only tokens.
  </action>
  <verify>
    <automated>pnpm test:e2e -- tests/e2e/diagnostics-consent.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `tests/e2e/diagnostics-consent.spec.ts` contains `/api/v1/diagnostics/consent`.
    - `tests/e2e/diagnostics-consent.spec.ts` does not contain `_diagnostics`.
    - Missing bearer assertion expects status 401.
    - Automated command exits 0 or skips only the valid-token subtest with the JWKS-specific skip message.
  </acceptance_criteria>
  <done>Real HTTP smoke coverage proves the route is discoverable and follows Phase 2 API conventions.</done>
</task>
</tasks>

<verification>
<automated>pnpm db:setup && pnpm test:integration -- tests/integration/diagnostics-consent.integration.test.ts && pnpm test:e2e -- tests/e2e/diagnostics-consent.spec.ts && pnpm test:unit -- tests/unit/no-drizzle-in-routes.test.ts</automated>
</verification>


#### 02-10-PLAN.md

---
phase: 02
plan: "10"
type: execute
wave: 7
depends_on: ["02-08", "02-09"]
files_modified:
  - .github/workflows/ci.yml
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/02-data-layer/02-10-SUMMARY.md
autonomous: false
requirements: [INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-19, INFRA-21, INFRA-22, INFRA-24]
tags: [ci, verification, planning-doc-edits]
must_haves:
  truths:
    - "All Phase 2 requirement IDs appear in at least one completed plan summary before this plan marks them done."
    - "CI runs `pnpm db:setup` before integration tests so migrations and seeds are exercised."
    - "D-43: integration tests use transaction rollback by default, and any test requiring committed rows documents the TRUNCATE cleanup exit ramp."
    - "Final verification includes lint, typecheck, unit tests, db setup, integration tests, build, and the diagnostics consent E2E smoke."
    - "ROADMAP Phase 2 plan list shows 10 plans and marks the diagnostic route as `/api/v1/diagnostics/consent`."
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "Phase 2 DB setup in CI"
      contains: "pnpm db:setup"
---

<objective>
Close Phase 2 by wiring DB setup into CI, running the full verification suite, and reconciling planning metadata. This plan should not add new runtime features; it proves the phase is safe for Phase 3+ to build on.

Output: CI includes migrations/seeds before integration tests, all Phase 2 tests/build pass locally, and REQUIREMENTS/ROADMAP/STATE metadata accurately reflect Phase 2 completion.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.codex/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-VALIDATION.md
@/Users/machado/Projects/folhario/.github/workflows/ci.yml
@/Users/machado/Projects/folhario/.planning/REQUIREMENTS.md
@/Users/machado/Projects/folhario/.planning/ROADMAP.md
</context>

<threat_model>
T-02-26 false green CI: integration tests can pass against an unmigrated DB if setup is skipped. Mitigation: CI runs `pnpm db:setup` before integration tests.
T-02-27 planning drift: requirements can be marked done while implementation gaps remain. Mitigation: reconcile only after full verification and cite plan summaries.
T-02-28 watch-mode deadlock: CI/test commands with watch mode hang. Mitigation: use existing single-run scripts and grep for forbidden watch flags.
</threat_model>

<tasks>
<task type="auto">
  <name>Task 1: Add DB setup to CI integration step</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>
    - /Users/machado/Projects/folhario/.github/workflows/ci.yml
    - /Users/machado/Projects/folhario/package.json
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-08-SUMMARY.md
  </read_first>
  <action>
Update `.github/workflows/ci.yml` so the integration-test job step runs `pnpm db:setup` after dependencies are installed and before `pnpm test:integration`. Preserve the postgres:17-alpine service container and existing Sentry/PostHog E2E env behavior.

Do not add Vercel deploy, Supabase branch DB, Inngest sync, or Sentry source-map upload; those remain Phase 12.
  </action>
  <verify>
    <automated>pnpm lint</automated>
  </verify>
  <acceptance_criteria>
    - `.github/workflows/ci.yml` contains `pnpm db:setup`.
    - `.github/workflows/ci.yml` still contains `postgres:17-alpine`.
    - `.github/workflows/ci.yml` does not contain `vercel deploy`.
  </acceptance_criteria>
  <done>CI exercises migrations and seed data before integration tests.</done>
</task>

<task type="auto">
  <name>Task 2: Run final Phase 2 verification suite</name>
  <files>.planning/phases/02-data-layer/02-10-SUMMARY.md</files>
  <read_first>
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-VALIDATION.md
    - /Users/machado/Projects/folhario/package.json
  </read_first>
  <action>
Run the final suite:

```
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm db:setup
pnpm test:integration
pnpm build
pnpm test:e2e -- tests/e2e/diagnostics-consent.spec.ts
```

Create `02-10-SUMMARY.md` recording command outputs, any skips, and whether local Supabase Storage/JWKS checks required manual follow-up.
  </action>
  <verify>
    <automated>pnpm lint && pnpm typecheck && pnpm test:unit && pnpm db:setup && pnpm test:integration && pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - `02-10-SUMMARY.md` contains `pnpm lint`.
    - `02-10-SUMMARY.md` contains `pnpm db:setup`.
    - `02-10-SUMMARY.md` contains `tests/e2e/diagnostics-consent.spec.ts`.
    - The automated command exits 0.
  </acceptance_criteria>
  <done>Full static, DB, integration, and build verification is recorded.</done>
</task>

<task type="auto">
  <name>Task 3: Reconcile requirements and roadmap metadata</name>
  <files>.planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/phases/02-data-layer/02-10-SUMMARY.md</files>
  <read_first>
    - /Users/machado/Projects/folhario/.planning/REQUIREMENTS.md
    - /Users/machado/Projects/folhario/.planning/ROADMAP.md
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-01-SUMMARY.md
    - /Users/machado/Projects/folhario/.planning/phases/02-data-layer/02-09-SUMMARY.md
  </read_first>
  <action>
After final verification passes, mark Phase 2 requirements complete in `.planning/REQUIREMENTS.md`:
- INFRA-03
- INFRA-04
- INFRA-05
- INFRA-06
- INFRA-07
- INFRA-08
- INFRA-09
- INFRA-19
- INFRA-21
- INFRA-22
- INFRA-24

Update `.planning/ROADMAP.md` Phase 2 plan list to 10 completed plans and preserve the Phase 2 success criteria. Add a Phase 2 summary note that the diagnostic route is `/api/v1/diagnostics/consent` because `_diagnostics` route segments are ignored by Next App Router.
  </action>
  <verify>
    <automated>rg "\\[x\\].*INFRA-(03|04|05|06|07|08|09|19|21|22|24)" .planning/REQUIREMENTS.md && rg "02-10-PLAN.md" .planning/ROADMAP.md</automated>
  </verify>
  <acceptance_criteria>
    - `.planning/REQUIREMENTS.md` marks all eleven Phase 2 requirement IDs with `[x]`.
    - `.planning/ROADMAP.md` Phase 2 section contains `**Plans**: 10 plans`.
    - `.planning/ROADMAP.md` Phase 2 plan list contains `02-10-PLAN.md`.
    - `.planning/ROADMAP.md` contains `/api/v1/diagnostics/consent`.
  </acceptance_criteria>
  <done>Planning metadata matches the implemented and verified Phase 2 state.</done>
</task>
</tasks>

<verification>
<automated>pnpm lint && pnpm typecheck && pnpm test:unit && pnpm db:setup && pnpm test:integration && pnpm build</automated>
</verification>


## Review Instructions

Analyze each plan and provide:
1. Summary — One-paragraph assessment
2. Strengths — bullet points
3. Concerns — bullet points with severity (HIGH/MEDIUM/LOW)
4. Suggestions — specific improvements
5. Risk Assessment — LOW/MEDIUM/HIGH with justification

Focus on missing edge cases, dependency ordering, scope risks, security, performance, and whether plans achieve phase goals.
Output markdown.
