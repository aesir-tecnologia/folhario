---
status: issues_found
phase: 02-data-layer
depth: standard
files_reviewed: 72
findings:
  critical: 3
  warning: 10
  info: 8
  total: 21
diff_base: faf8a132638abd54fd1a3776cf3a29aac37fbb6c^
reviewed: 2026-04-26
---

# Phase 02 (Data Layer) — Code Review

**Depth:** standard · **Scope:** 72 source/test files · **Status:** issues_found

## Summary

The phase ships a clean, well-documented data layer with strong test coverage (real-Postgres integration, real-JWKS HTTP path, RLS cross-user denial proof). However, three structural defects compromise load-bearing security and consistency claims, plus several smaller issues. Notably, the dual-tx idempotency bug already flagged in 02-09's SUMMARY is real and unmitigated, the runtime path bypasses RLS entirely (defeating "defense in depth" as stated in `CLAUDE.md`), and the photo upload pipeline has both a defense-in-depth gap on EXIF parsing and an unhandled orphan-storage race.

---

## BLOCKERs

### CR-01: Idempotency wrapper opens an outer transaction; nested `withUnitOfWork` opens a second, unrelated transaction on a different connection

**Files:**
- `src/contexts/iam/api/consent-route.ts:93-134`
- `src/shared/api/idempotency.ts:88` (`return db.transaction(async (tx) => {`)
- `src/contexts/iam/application/record-consent.ts:57` (`return withUnitOfWork(userId, async (tx) => {`)
- `src/shared/db/unit-of-work.ts:66` (`return db.transaction(async (tx) => {`)

**Issue:** The diagnostics consent POST route flow is:
1. `withIdempotency(db, ...)` opens `db.transaction(...)` on connection A — claims the `idempotency_keys` row.
2. The handler calls `recordConsent(...)` which calls `withUnitOfWork(userId, ...)` — this calls `db.transaction(...)` against the **global** `db`, **not** the outer `tx`. Drizzle's pooled `postgres-js` driver acquires connection B for this nested call.
3. Connection B writes the `consent_logs` row, sets the GUC there, and commits — fully independently of connection A.
4. Back on connection A, the wrapper updates `idempotency_keys.responseBody`. If that update fails, or if any post-handler error occurs, connection A rolls back — but connection B has already committed the `consent_logs` row.

**Concrete consequences:**
- Idempotency loses its rollback guarantee (`idempotency.ts:103-106` claims "If the handler throws, the surrounding transaction rolls back and the freshly-inserted row vanishes." That comment is wrong.)
- `SELECT … FOR UPDATE` on conflict (`idempotency.ts:130`) is on connection A only — it can't lock writes happening on connection B.
- The GUC `request.jwt.claim.sub` set inside `withUnitOfWork` (line 69-71) applies only to connection B; the idempotency_keys writes on connection A have no GUC bound.

**Fix:** Restructure so the idempotency machinery accepts an existing tx and `withUnitOfWork` accepts an injected tx, OR move the idempotency-row write inside the unit-of-work, OR drop the outer transaction in `withIdempotency` and treat it as a single atomic claim+update without a handler-spanning envelope.

---

### CR-02: Runtime DB connection bypasses RLS entirely; "defense in depth" claim is currently inert

**Files:**
- `src/shared/db/client.ts:38` (`postgres(serverEnv.DATABASE_POOL_URL, { prepare: false })`)
- `src/shared/db/unit-of-work.ts:66-71` (sets GUC, never `SET LOCAL ROLE authenticated`)
- `tests/integration/rls-real-jwt.integration.test.ts:44-56,329` (test explicitly notes `postgres` role has `rolbypassrls=true` and switches role via `SET LOCAL ROLE authenticated` — production code never does)

**Issue:** `withUnitOfWork` binds `request.jwt.claim.sub` via `set_config(..., true)` so `auth.uid()` resolves to the user. But the runtime connection authenticates as the `postgres` superuser, which has `rolbypassrls = true`. **RLS policies never engage at runtime** — every owner policy is silently skipped. The integration test at `rls-real-jwt.integration.test.ts:329` explicitly does `SET LOCAL ROLE authenticated` to make RLS engage; without that switch, the test would be a false-pass.

The runtime `withUnitOfWork` does **not** issue `SET LOCAL ROLE authenticated`. So:
- The CLAUDE.md project constraint *"RLS as defense in depth"* is not satisfied at runtime.
- The `check-rls.ts` production guard protects against the *CI shim* leaking, but does nothing about the actual runtime role bypass.
- Repository-level `WHERE user_id = $1` filters are the *only* effective ownership control. If a route or use-case ever forgets the explicit filter, the RLS policy that's "supposed to catch it" will not fire.

**Fix options (pick one):**
1. Add `await tx.execute(sql\`set local role authenticated\`)` inside `withUnitOfWork` after the GUC is bound, ensuring RLS engages.
2. Provision a non-superuser DB role in Supavisor connection string and use it for `DATABASE_POOL_URL`.
3. Explicitly document in `CLAUDE.md` and the unit-of-work module that RLS is enabled-but-inert at runtime, repository filters are the primary control.

---

### CR-03: Photo upload writes to two storage buckets BEFORE the DB row insert; failures leave orphan storage objects

**File:** `src/contexts/catalog/application/upload-photo.ts:165-209`

**Issue:** The use-case sequences:
1. Upload original to `plant-photos` bucket (lines 174-181).
2. Upload thumbnail to `plant-thumbnails` bucket (lines 188-195).
3. Open a UoW transaction and insert the `photo_entries` row (lines 201-209).

If step 3 fails, the user has paid for two bucket writes with no DB row referencing them. There is no compensating delete on DB-write failure, no orphan-cleanup sweep, and `deleteAllPlantMediaForUser` (`photo-storage.ts:145`) cannot clean these up because the DB has no record they were ever uploaded.

**Fix:** Either (a) reverse the order — open the UoW, insert the row, then upload to storage with compensating delete on UoW commit failure; (b) add a try/catch around the UoW that issues `deleteObject` for both keys on failure; or (c) move both storage uploads INSIDE the UoW callback.

---

## WARNINGs

### WR-01: GPS rejection silently swallows `exifr.gps()` parser errors — defense-in-depth gap

**File:** `src/shared/images/server-validate.ts:46-51`

When `exifr.gps()` throws (malformed metadata, truncated file), the helper returns `{ ok: true }`. A maliciously crafted JPEG can trigger a parser exception while still containing GPS coordinates. **Fix:** Return `validation_failed` on parser exception with reason "could not verify GPS metadata is absent."

---

### WR-02: `jwtVerify` accepts ANY algorithm advertised in the JWKS — no explicit `algorithms` allowlist, no `issuer`/`audience` pinning

**File:** `src/contexts/iam/infrastructure/auth/auth-adapter.ts:97`

`jwtVerify(token, jwks)` is called with no options. **Fix:** Pass `{ algorithms: ["RS256"], issuer: \`${serverEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1\`, audience: "authenticated" }` to `jwtVerify`.

---

### WR-03: `billing_events` RLS policy denies all reads of unlinked events — but writes also blocked, breaking webhook ingestion path

**File:** `drizzle/migrations/0001_phase_02_rls_policies.sql:307-327`

`FOR ALL` policy with `subscription_id IS NOT NULL` on both `USING` and `WITH CHECK` blocks even system-intent inserts of pre-link events. **Fix:** Restrict to `FOR SELECT` only or document the policy's webhook-ingestion exception path.

---

### WR-04: `users_owner_all` policy permits user self-deletion via `FOR ALL`

**File:** `drizzle/migrations/0001_phase_02_rls_policies.sql:133-140`

LGPD requires deletion via `data_deletion_requests` with 7-day grace; users should NEVER directly DELETE their own row. With CASCADE, a self-DELETE wipes the deletion-grace mechanism itself. **Fix:** Replace `FOR ALL` with `FOR SELECT, UPDATE` plus a separate INSERT policy if needed.

---

### WR-05: `idempotency_keys.user_key_idx` UNIQUE constraint allows TTL drift — expired rows occupy the slot until a sweep deletes them

**Files:**
- `drizzle/migrations/0000_phase_02_initial_schema.sql:278`
- `src/shared/api/idempotency.ts:98`

A user reusing an idempotency key 8+ days later hits `ON CONFLICT DO NOTHING` and either falls through to the replay branch (returning stale stored body) or gets a confusing 409. **Fix:** Add partial unique index `WHERE expires_at > now()`, or filter expired rows in the conflict-read branch.

---

### WR-06: `proxy.ts` matcher excludes `api` in the first entry; future `/api/v2/*` requests bypass the proxy entirely

**File:** `src/proxy.ts:108`

Matcher: `["/((?!api|_next|_vercel|.*\\..*).*)", "/api/v1/:path*"]` — `/api/v2/*` matches NEITHER. **Fix:** Add `/api/:path*` to ensure no API version skips the gate.

---

### WR-07: Test JWKS keygen surface contradiction — `tests/unit/auth-adapter.test.ts:46` calls `generateKeyPair` directly, contradicting T-02-41 single-surface claim

**Files:**
- `tests/e2e/fixtures/test-jwks.ts:1-6` (claims to be the only `generateKeyPair` invocation)
- `tests/unit/auth-adapter.test.ts:46` (still has its own `generateKeyPair("RS256", ...)` call)

**Fix:** Refactor the unit test to import from the shared fixture; add a grep guard against rogue `generateKeyPair` calls in tests.

---

### WR-08: `globalSetup.ts` writes `tests/e2e/.tmp-jwks.json` — confirm gitignore coverage

**File:** `tests/e2e/global-setup.ts:144-160`

Already covered by `.gitignore:25` (`tests/e2e/.tmp-*.json`). **No action needed** — verified.

---

### WR-09: `policy_versions` schema lacks a partial unique index enforcing "only one current per document_type"

**File:** `src/contexts/iam/infrastructure/db/schema.ts:74-90`

`recordConsent` uses `LIMIT 1` with no ordering when looking up the current policy — non-deterministic if invariant violated. **Fix:** `CREATE UNIQUE INDEX policy_versions_one_current_per_type ON policy_versions (document_type) WHERE is_current = true`.

---

### WR-10: `consent-route.ts:32-33` references `consentLogInsertSchema` solely to defeat tree-shaking with a `void` cast — fragile pattern

**File:** `src/contexts/iam/api/consent-route.ts:32-33`

Dead-code preservation is unmaintainable. **Fix:** Either actually use the imported schema (e.g., as `pick` source), or remove the import + ceremonial `void` and document the D-19 root in a comment.

---

## INFOs

### IN-01: `idempotency.ts:98` uses `sql.raw(String(TTL_DAYS))` for a hardcoded 7-day interval
Cleaner: `interval '7 days'` directly. No security risk.

### IN-02: `assertValidUserId` does not validate UUID format
Add `if (!/^[0-9a-f-]{36}$/i.test(userId))` so misuse fails loudly.

### IN-03: `seed.ts` uses `sql.unsafe(seedSql)` — fine for file-sourced SQL, but no path/checksum verification.

### IN-04: `proxy.ts:39-41` `isApiV1Path` exact-match `/api/v1` branch is unreachable given current matcher.

### IN-05: `unit-of-work.ts` uses `select set_config(...)` (a SELECT wrapping a void function) — would benefit from one-line comment explaining "why SELECT not SET LOCAL."

### IN-06: `photo-storage.ts:147-149` `deleteAllPlantMediaForUser` partial-failure semantics — should be documented as Inngest-worker-orchestrated retry.

### IN-07: PostHog `NEXT_PUBLIC_POSTHOG_KEY` set at build only — runtime omission silently disables analytics. Phase 1 scope, but worth tracking.

### IN-08: `recordConsent` uses `new Date().toISOString()` for `grantedAt` — application clock vs DB clock skew. Use `sql\`now()\`` for both timestamps.

---

## File paths cited (absolute)

- `/Users/machado/Projects/folhario/src/shared/api/idempotency.ts:81-168`
- `/Users/machado/Projects/folhario/src/shared/db/unit-of-work.ts:52-75`
- `/Users/machado/Projects/folhario/src/shared/db/client.ts:36-43`
- `/Users/machado/Projects/folhario/src/contexts/iam/api/consent-route.ts:32-33,93-134`
- `/Users/machado/Projects/folhario/src/contexts/iam/application/record-consent.ts:52-89`
- `/Users/machado/Projects/folhario/src/contexts/iam/infrastructure/auth/auth-adapter.ts:62-114`
- `/Users/machado/Projects/folhario/src/contexts/catalog/application/upload-photo.ts:90-212`
- `/Users/machado/Projects/folhario/src/contexts/catalog/infrastructure/photo-storage.ts:145-150`
- `/Users/machado/Projects/folhario/src/shared/images/server-validate.ts:45-66`
- `/Users/machado/Projects/folhario/src/proxy.ts:39-41,107-109`
- `/Users/machado/Projects/folhario/drizzle/migrations/0000_phase_02_initial_schema.sql:278`
- `/Users/machado/Projects/folhario/drizzle/migrations/0001_phase_02_rls_policies.sql:133-140,304-327`
- `/Users/machado/Projects/folhario/tests/unit/auth-adapter.test.ts:45-55`
- `/Users/machado/Projects/folhario/tests/e2e/global-setup.ts:140-160`
