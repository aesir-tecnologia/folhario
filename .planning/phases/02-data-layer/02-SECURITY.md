---
phase: 02
slug: data-layer
status: blocked
threats_open: 2
asvs_level: 1
created: 2026-04-27
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

> **Status: BLOCKED.** Two threats from PLAN.md remain open against the implementation contract: T-02-32 (plan-05) and T-02-33 (plan-05). Phase advancement gated until mitigations are restored OR risks formally accepted with PLAN.md amendments.

> Reused threat IDs (`T-02-02`, `T-02-03`, `T-02-41`) appear in multiple plans with different meanings — disambiguated by `(plan-NN)`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Vercel runtime → Supavisor pooler → Postgres | App reads/writes through transaction-pooled Postgres; `prepare:false` mandatory | User data, secrets via `DATABASE_POOL_URL` |
| Migration runner → Postgres | DDL applied through direct (non-pooled) `DATABASE_URL` only | Schema mutations |
| Authenticated user → owner-scoped row | `auth.uid()` enforced via RLS on 21 app tables; repositories also filter by `userId` | User-owned records |
| Service role → all tables | Server-only `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS for system operations (storage, counters) | Privileged DB access |
| Browser → Supabase Storage | Photo buckets are all `public = false`; clients access only via signed URLs | Photo bytes (PII potential) |
| Photo upload → server | EXIF GPS rejected server-side via `exifr.gps()` before any storage write | Photo bytes + metadata |
| Public route → API handler | `src/proxy.ts` fast-rejects missing bearer for `/api/v1/*` (allowlist of anchored RegExp); route handler re-verifies via `requireApiUser` | JWT access tokens |
| Supabase Auth (GoTrue) → app server | JWT verified with `jose.jwtVerify` against JWKS; no decode-only path | JWT signature, sub claim |
| Idempotency key → DB | `(user_id, key)` UNIQUE; `request_hash` NOT NULL; helper composes inside `withUnitOfWork` so handler-throw rolls back claim | Replay protection envelope |
| Cursor params → list endpoints | Base64 JSON cursor validated by Zod; UTC `Z` enforced via `datetime({ offset: false })` | Pagination state |
| CI Postgres container → migrations | Conditional `auth.uid()` shim only when Supabase `auth` schema absent; production guard in `scripts/check-rls.ts` | DDL + RLS policies |
| Test JWKS fixture → integration + E2E | Single source of truth at `tests/e2e/fixtures/test-jwks.ts`; no parallel signing surfaces | Test JWTs |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 (plan-01) | Tampering | postgres-js client | mitigate | `src/shared/db/client.ts:39` `prepare: false`; no pooled runtime client introduced in Plan 01 | closed |
| T-02-02 (plan-01) | Information Disclosure | Migration env | mitigate | `src/shared/db/migration-client.ts:14,18` reads only `DATABASE_URL`; `drizzle.config.ts:3-12` reads only `DATABASE_URL` | closed |
| T-02-03 (plan-01) | Tampering | Dependency pinning | mitigate | `package.json` exact-pinned `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `jose@6.2.2`, `sharp@0.34.5`, `exifr@7.1.3`; `pnpm-lock.yaml` committed | closed |
| T-02-02 (plan-02) | Tampering | Schema registry import surface | mitigate | `src/shared/db/schema-registry.ts:1` `Migration registry only` marker; `tests/unit/schema-registry.test.ts:23-107` import-guard scanner over `src/app` + `src/contexts/*/{api,application}` | closed |
| T-02-03 (plan-02) | Tampering | Foreign-key delete rules | mitigate | All FKs in IAM/Catalog/Species-Care schemas declare explicit `onDelete:` | closed |
| T-02-04 (plan-02) | Tampering | Domain Zod schemas | mitigate | All seven `src/contexts/*/domain/schemas.ts` files derive from `drizzle-zod` | closed |
| T-02-05 (plan-03) | Information Disclosure | Default-open tables | mitigate | `drizzle/migrations/0001_phase_02_rls_policies.sql` — 21× `enable row level security`; `scripts/check-rls.ts:90+` queries `pg_class.relrowsecurity` | closed |
| T-02-06 (plan-03) | Spoofing | Null-auth policy bypass | mitigate | `0001_phase_02_rls_policies.sql` — 34× `auth.uid()) is not null` across owner + reference policies | closed |
| T-02-07 (plan-03) | Tampering | Plain-Postgres CI drift | mitigate | `0001_phase_02_rls_policies.sql:19,35` — `IF NOT EXISTS` for `authenticated` role and `auth.uid()` shim, conditional on `pg_namespace nspname='auth'` | closed |
| T-02-29 (plan-03) | Elevation of Privilege | RLS shim leaking to production | mitigate | `scripts/check-rls.ts:63-72` — `NODE_ENV === "production"` AND `pg_namespace nspname='auth'` guard with non-zero exit | closed |
| T-02-30 (plan-03) | Tampering | Lost handwritten SQL | mitigate | Handwritten DDL isolated in `--custom` migration `drizzle/migrations/0001_phase_02_rls_policies.sql`; generated schema migration is `0000_phase_02_initial_schema.sql` | closed |
| T-02-08 (plan-04) | Tampering | Missing legal seed | mitigate | `drizzle/seeds/phase-02.sql` — 4× `ON CONFLICT`; `tests/integration/seed-data.integration.test.ts` asserts via `toEqual` and `pg_enum` | closed |
| T-02-09 (plan-04) | Information Disclosure | Public storage leakage | mitigate | `supabase/config.toml` — 4× `public = false`; `tests/integration/storage-buckets.integration.test.ts:58-89` asserts via `listBuckets()` | closed |
| T-02-10 (plan-04) | Tampering | Stale local Supabase config | mitigate | `tests/integration/storage-buckets.integration.test.ts:44,78,90` carries `supabase stop && supabase start` instruction | closed |
| T-02-31 (plan-04) | Tampering | False-confidence text-parsing tests | mitigate | `tests/integration/storage-buckets.integration.test.ts:58` calls `listBuckets()`; no toml-text parsing | closed |
| T-02-11 (plan-05) | Tampering | Route-layer data bypass | mitigate | `eslint.config.mjs:33-40` `no-restricted-imports`; `tests/unit/no-drizzle-in-routes.test.ts:25` regex scanner | closed |
| T-02-12 (plan-05) | Elevation of Privilege | RLS-only authorization assumption | mitigate | `src/contexts/iam/infrastructure/db/users.ts:19-20` explicit `eq(users.id, userId)`; UnitOfWork sets request context | closed |
| T-02-13 (plan-05) | Denial of Service | Connection storm | mitigate | `src/shared/db/client.ts:30-42` lazy global singleton client | closed |
| **T-02-32 (plan-05)** | **Tampering** | **`withUnitOfWork` userId guard** | **mitigate** | **PLAN named `z.string().uuid()` Zod guard at entrypoint throwing `validation_failed` BEFORE `set_config`. Implementation at `src/shared/db/unit-of-work.ts:44-51` only checks `typeof string` and non-empty `trim()` — no Zod, no UUID regex. Non-UUID strings reach `set_config('request.jwt.claim.sub', ...)` and bind silently.** | **OPEN** |
| **T-02-33 (plan-05)** | **Tampering** | **Transaction-scope leakage** | **mitigate** | **PLAN named (a) runtime assertion the helper is in an active transaction (e.g. `isTransactionalClient(tx)`) and (b) unit test `tests/unit/unit-of-work-leak.test.ts`. Implementation only carries the TS structural type `TransactionalDb` (compile-time, erased at runtime); `isTransactionalClient` runtime predicate does not exist; the named leak test does not exist on disk.** | **OPEN** |
| T-02-34 (plan-05.5) | Spoofing | RLS-policy semantic drift | mitigate | `tests/integration/rls-real-jwt.integration.test.ts` uses `auth.admin.createUser` + `signInWithPassword` for cross-user denial through real Supabase Auth | closed |
| T-02-35 (plan-05.5) | Spoofing | False-pass via misconfigured "deny all" | mitigate | Same file: baseline subtest asserts user A CAN read its own row (anchors against silent deny-all) | closed |
| T-02-14 (plan-06) | Tampering | Cursor tampering | mitigate | `src/shared/api/cursor.ts:29` `z.string().datetime({ offset: false })`; `:35-36` `ValidationFailed` return | closed |
| T-02-15 (plan-06) | Tampering | Idempotency race | mitigate | `src/shared/api/idempotency.ts:127` `onConflictDoNothing`; `:157` `for("update")` lock | closed |
| T-02-16 (plan-06) | Tampering | Replay mismatch | mitigate | `idempotency_keys.request_hash notNull()` in IAM schema; `idempotency.ts:169-176` returns `ErrorCode.Conflict` on hash mismatch | closed |
| T-02-36 (plan-06) | Tampering | Stuck idempotency on handler failure | mitigate | `src/shared/api/idempotency.ts:109-148` composes inside `withUnitOfWork(...)` so handler-throw rolls back claim | closed |
| T-02-17 (plan-07) | Spoofing | Unsigned-token acceptance | mitigate | `src/contexts/iam/infrastructure/auth/auth-adapter.ts:1,134,155` — only `jwtVerify` success path | closed |
| T-02-18 (plan-07) | Spoofing | Proxy overreach | mitigate | `src/proxy.ts:83-87` fast-rejects only; `src/contexts/iam/api/consent-route.ts:58,130` re-verifies via `requireApiUser` | closed |
| T-02-19 (plan-07) | Spoofing | JWKS local mismatch | mitigate | `auth-adapter.ts:146,164,173` fail-closed `Unauthenticated` with non-empty reason | closed |
| T-02-37 (plan-07) | Tampering | Proxy body consumption | mitigate | `src/proxy.ts` reads only path + Authorization header; `tests/unit/proxy-body-passthrough.test.ts:51,66` asserts `bodyUsed === false` post-proxy | closed |
| T-02-38 (plan-07) | Spoofing | Ambiguous public allowlist | mitigate | `src/proxy.ts:29-36` typed `RegExp[]` allowlist with `^…$` anchors | closed |
| T-02-20 (plan-08) | Information Disclosure | EXIF GPS leakage | mitigate | `src/contexts/catalog/application/upload-photo.ts:116` calls `rejectGpsMetadata` BEFORE `storageAdapter.uploadObject` | closed |
| T-02-21 (plan-08) | Information Disclosure | Service-role exposure | mitigate | `SUPABASE_SERVICE_ROLE_KEY` read only by `src/shared/adapters/supabase-storage.ts:40` (server-only); `server-env.ts:10` is schema declaration | closed |
| T-02-22 (plan-08) | Denial of Service | sharp runtime mismatch | mitigate | `src/app/api/v1/photos/upload/route.ts:29` `runtime = "nodejs"`; `tests/integration/sharp-smoke.integration.test.ts` proves binary loads | closed |
| T-02-39 (plan-08) | Tampering | Size-limit drift | mitigate | `src/shared/images/limits.ts:28` `MAX_UPLOAD_BYTES = 1_048_576`; upload-photo + server-validate import the constant (no hardcoded literal) | closed |
| T-02-23 (plan-09) | Spoofing | Diagnostic route exposure | mitigate | `src/contexts/iam/api/consent-route.ts:58,130` `requireApiUser`; proxy fast-rejects | closed |
| T-02-24 (plan-09) | Tampering | Route-discovery regression | mitigate | Path is `src/app/api/v1/diagnostics/consent/route.ts`; no `_diagnostics` directory; Playwright spec hits over real HTTP | closed |
| T-02-25 (plan-09) | Tampering | Duplicate consent writes | mitigate | `consent-route.ts:6,46-47` POST wraps `withIdempotency` | closed |
| T-02-40 (plan-09) | Spoofing | Silent E2E skip on missing JWKS | mitigate | `tests/e2e/global-setup.ts:124,134,169` explicit `throw`; no `test.skip`/`test.fixme` in spec | closed |
| T-02-41 (plan-09) | Spoofing | Divergent test-JWT helpers | mitigate | `tests/e2e/fixtures/test-jwks.ts:10,70` is the single `generateKeyPair` site; `tests/integration/auth-jwt.integration.test.ts:15` imports it | closed |
| T-02-26 (plan-10) | Tampering | False green CI | mitigate | `.github/workflows/ci.yml:88,99` — `pnpm db:setup` precedes `pnpm test:integration` | closed |
| T-02-27 (plan-10) | Repudiation | Planning drift | mitigate | `02-10-SUMMARY.md:65,116-118` — INFRA-19 scoping note in REQUIREMENTS + ROADMAP | closed |
| T-02-28 (plan-10) | Denial of Service | Watch-mode deadlock | mitigate | `package.json` scripts use single-run forms; no forbidden watch flags | closed |
| T-02-41 (plan-10) | Information Disclosure | Unbounded idempotency table growth | accept | See AR-02-01. `idempotency_keys` cleanup deferred to Phase 4+ Inngest cron `cleanup.idempotency_keys` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-41 (plan-10) | `idempotency_keys` rows expire at `now() + 7 days` but Phase 2 ships no cleanup worker. Risk is bounded: table is small, every read is by the `(user_id, key)` UNIQUE index, and `withIdempotency` checks `expires_at > now()` before replay. Phase 4 onboards Inngest and registers the daily `cleanup.idempotency_keys` cron (per `02-10-SUMMARY.md` §4). | Planning | 2026-04-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-27 | 44 | 42 | 2 | gsd-security-auditor |

### Open Threat Resolution Path

Either of the following clears the gate:

1. **Restore the named mitigations** in `src/shared/db/unit-of-work.ts`:
   - Add `z.string().uuid()` validation at `withUnitOfWork(userId, fn)` entry that throws `validation_failed` BEFORE `set_config` runs (T-02-32).
   - Add a runtime predicate (e.g. `isTransactionalClient(tx)`) plus `tests/unit/unit-of-work-leak.test.ts` proving a repository called against `db` directly (not via `withUnitOfWork`) does not carry a leftover JWT claim from a prior UoW call (T-02-33).
2. **Formally accept** both deviations in this file's Accepted Risks Log with a documented rationale (the SUMMARY argues UUID format is enforced upstream by JWT verification and that the structural `TransactionalDb` type is sufficient), AND amend `02-05-PLAN.md`'s `<threat_model>` so the contract matches the implementation.

Re-run `/gsd:secure-phase 2` after either path.

---

## Sign-Off

- [ ] All threats have a disposition (mitigate / accept / transfer)
- [ ] Accepted risks documented in Accepted Risks Log
- [ ] `threats_open: 0` confirmed
- [ ] `status: verified` set in frontmatter

**Approval:** pending — blocked on T-02-32 + T-02-33 resolution.
