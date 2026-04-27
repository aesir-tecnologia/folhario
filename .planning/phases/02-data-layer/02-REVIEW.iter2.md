---
phase: 02-data-layer
reviewed: 2026-04-26T16:30:00Z
depth: standard
files_reviewed: 79
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - drizzle.config.ts
  - drizzle/migrations/0000_phase_02_initial_schema.sql
  - drizzle/migrations/0001_phase_02_rls_policies.sql
  - drizzle/migrations/meta/0000_snapshot.json
  - drizzle/migrations/meta/0001_snapshot.json
  - drizzle/migrations/meta/_journal.json
  - drizzle/seeds/phase-02.sql
  - eslint.config.mjs
  - package.json
  - playwright.config.ts
  - scripts/check-rls.ts
  - scripts/check-seeds.ts
  - scripts/seed.ts
  - src/app/api/v1/diagnostics/consent/route.ts
  - src/app/api/v1/photos/upload/route.ts
  - src/contexts/billing/domain/events.ts
  - src/contexts/billing/domain/schemas.ts
  - src/contexts/billing/infrastructure/db/schema.ts
  - src/contexts/catalog/application/upload-photo.ts
  - src/contexts/catalog/domain/events.ts
  - src/contexts/catalog/domain/schemas.ts
  - src/contexts/catalog/infrastructure/db/photo-entries.ts
  - src/contexts/catalog/infrastructure/db/plants.ts
  - src/contexts/catalog/infrastructure/db/schema.ts
  - src/contexts/catalog/infrastructure/photo-storage.ts
  - src/contexts/iam/api/consent-route.ts
  - src/contexts/iam/application/current-user.ts
  - src/contexts/iam/application/record-consent.ts
  - src/contexts/iam/application/user-query-service.ts
  - src/contexts/iam/domain/consent-schemas.ts
  - src/contexts/iam/domain/events.ts
  - src/contexts/iam/domain/schemas.ts
  - src/contexts/iam/infrastructure/auth/auth-adapter.ts
  - src/contexts/iam/infrastructure/db/consent-logs.ts
  - src/contexts/iam/infrastructure/db/schema.ts
  - src/contexts/iam/infrastructure/db/users.ts
  - src/contexts/identification/domain/events.ts
  - src/contexts/identification/domain/schemas.ts
  - src/contexts/identification/infrastructure/db/schema.ts
  - src/contexts/notifications/domain/events.ts
  - src/contexts/notifications/domain/schemas.ts
  - src/contexts/notifications/infrastructure/db/schema.ts
  - src/contexts/reminders/domain/events.ts
  - src/contexts/reminders/domain/schemas.ts
  - src/contexts/reminders/infrastructure/db/schema.ts
  - src/contexts/species-care/domain/events.ts
  - src/contexts/species-care/domain/schemas.ts
  - src/contexts/species-care/infrastructure/db/schema.ts
  - src/proxy.ts
  - src/shared/adapters/storage.ts
  - src/shared/adapters/supabase-storage.ts
  - src/shared/api/auth.ts
  - src/shared/api/cursor.ts
  - src/shared/api/idempotency.ts
  - src/shared/api/request.ts
  - src/shared/config/server-env.ts
  - src/shared/db/client.ts
  - src/shared/db/migration-client.ts
  - src/shared/db/schema-registry.ts
  - src/shared/db/unit-of-work.ts
  - src/shared/images/client-compress.ts
  - src/shared/images/limits.ts
  - src/shared/images/server-validate.ts
  - supabase/config.toml
  - tests/e2e/diagnostics-consent.spec.ts
  - tests/e2e/fixtures/test-jwks.ts
  - tests/e2e/global-setup.ts
  - tests/integration/auth-jwt.integration.test.ts
  - tests/integration/diagnostics-consent.integration.test.ts
  - tests/integration/idempotency.integration.test.ts
  - tests/integration/photo-upload.integration.test.ts
  - tests/integration/proxy-auth.integration.test.ts
  - tests/integration/rls-real-jwt.integration.test.ts
  - tests/integration/schema-rls.integration.test.ts
  - tests/integration/seed-data.integration.test.ts
  - tests/integration/sharp-smoke.integration.test.ts
  - tests/integration/storage-adapter.integration.test.ts
  - tests/integration/storage-buckets.integration.test.ts
  - tests/integration/unit-of-work.integration.test.ts
  - tests/unit/api-conventions.test.ts
  - tests/unit/auth-adapter.test.ts
  - tests/unit/db-client.test.ts
  - tests/unit/image-pipeline.test.ts
  - tests/unit/no-drizzle-in-routes.test.ts
  - tests/unit/proxy-body-passthrough.test.ts
  - tests/unit/schema-registry.test.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
prior_review: 2026-04-26 (3 BLOCKERs marked resolved — CR-03 fix introduced new regression flagged below as CR-01)
---

# Phase 02 (Data Layer) — Re-Review

**Reviewed:** 2026-04-26T16:30:00Z
**Depth:** standard
**Files Reviewed:** 79
**Status:** issues_found

## Re-Review Context

The prior review (same file, earlier today) flagged 3 BLOCKERs (CR-01 idempotency dual-tx, CR-02 RLS bypass at runtime, CR-03 photo upload orphan storage) and marked them resolved with three commits (`05acd1b`, `9966d35`, `025146a`). This re-review of the resulting source confirms:

- **CR-01 (idempotency dual-tx) — resolved.** `withIdempotency` now opens `withUnitOfWork` itself and shares the tx; integration test at `tests/integration/idempotency.integration.test.ts:175-212` proves rollback semantics.
- **CR-02 (RLS bypass) — resolved.** `withUnitOfWork` issues `SET LOCAL ROLE authenticated`; integration test at `tests/integration/unit-of-work.integration.test.ts:119-125` asserts `current_user = 'authenticated'`. Cross-user denial proven in `tests/integration/rls-real-jwt.integration.test.ts`.
- **CR-03 (photo upload orphan storage) — partially resolved (NEW REGRESSION).** A compensating-delete path was added but its implementation is a no-op against the real Supabase Storage adapter. See CR-01 below — this is the only BLOCKER in this re-review.

The remaining WARNINGs and INFOs from the prior review are mostly still open and are not re-listed individually unless this re-review surfaced new evidence about them. The new findings below add three items the prior review did not flag (jose error-name leak in upload route, auth.uid() shim activation gating, idempotency RLS coupling).

---

## Summary

The phase ships a careful, well-instrumented data layer: drizzle-zod-rooted schemas, RLS policies on every user-owned table, a Unit-of-Work that switches role and binds the GUC, an idempotency wrapper composing inside the same transaction, JWT verification through real `jose` cryptography, server-side EXIF/GPS rejection backed by client-side strip, and a clean migration boundary (drizzle-kit on direct URL, runtime on Supavisor pooler with `prepare: false`). Test coverage is genuinely behavioural: real-JWT cross-user RLS denial, real-HTTP JWKS verify, replay/conflict idempotency semantics, sharp native-binary smoke — all proven against real Postgres.

That said: this re-review found one BLOCKER (the CR-03 fix introduced a no-op compensating-delete that's worse than no fix at all because it falsely advertises orphan-prevention), six WARNINGs, and four INFO items. Lead with CR-01.

---

## Critical Issues

### CR-01: CR-03 fix regression — `deleteSinglePlantPhotoBestEffort` is a no-op against the real Supabase Storage adapter

**File:** `src/contexts/catalog/infrastructure/photo-storage.ts:155-193`
**Issue:** The CR-03 mitigation in `src/contexts/catalog/application/upload-photo.ts:208-215` rethrows after calling `deleteSinglePlantPhotoBestEffort` on UoW failure. That helper invokes `adapter.deletePrefix({ bucket, prefix: originalKey })` where `originalKey` is the FULL canonical file key (e.g., `"userId/plantId/photoId.jpg"`), not a directory prefix.

The Supabase adapter's `deletePrefix` (`src/shared/adapters/supabase-storage.ts:108-124`) calls `collectObjectsRecursively` → `client.storage.from(bucket).list(normalized, { limit: 1000 })`. Supabase Storage's `list()` API treats its argument as a folder path; passing a file path returns an empty array because the path has no children. `objectKeys.length === 0` → early return at line 115 → no `remove()` call → orphan persists.

The comment at `photo-storage.ts:153` says: *"Uses `deletePrefix` with the full canonical key — UUIDs guarantee no false positives."* This is precisely backwards: UUIDs guarantee zero matches, period.

The integration test at `tests/integration/photo-upload.integration.test.ts:232-286` only asserts that `fake.deletePrefix` was *called* with a particular `prefix`. The fake returns `undefined` regardless. The test exercises the call shape but not the round-trip — a real Supabase adapter would silently no-op, leaving the bytes orphaned in both `plant-photos` and `plant-thumbnails` buckets.

This is functionally worse than no compensating delete because the source code, the integration test, and the resolution commit (`025146a`) all advertise that the orphan issue is fixed. Operations would discover the regression only through storage-quota growth weeks later.

LGPD privacy isn't directly violated here because `deleteAllPlantMediaForUser` (`photo-storage.ts:141-146`) does sweep by `${userId}/` and would catch these orphans on a deletion request. But every individual failed upload silently bloats storage and the bytes are unreachable from application metadata in the meantime.

**Fix:** Use the SDK's `remove([objectKey])` directly for single-file deletion, not the prefix-list path. Add a `deleteObject` method to the adapter contract:

```typescript
// src/shared/adapters/storage.ts — add to interface
export interface DeleteObjectInput {
  bucket: string;
  objectKey: string;
}

export interface StorageAdapter {
  // ... existing methods
  deleteObject(input: DeleteObjectInput): Promise<void>;
}

// src/shared/adapters/supabase-storage.ts — add to factory return
async deleteObject(input: DeleteObjectInput): Promise<void> {
  const { bucket, objectKey } = input;
  const { error } = await client.storage.from(bucket).remove([objectKey]);
  if (error) {
    throw new StorageAdapterError(
      `deleteObject failed for ${bucket}/${objectKey}: ${error.message}`,
      error,
    );
  }
},

// src/contexts/catalog/infrastructure/photo-storage.ts:174-192 — replace deletePrefix calls
try {
  await adapter.deleteObject({ bucket: PLANT_PHOTOS_BUCKET, objectKey: originalKey });
} catch (err) {
  console.warn(
    `[catalog/photo-storage] compensating delete failed for ${PLANT_PHOTOS_BUCKET}/${originalKey}:`,
    err,
  );
}
try {
  await adapter.deleteObject({ bucket: PLANT_THUMBNAILS_BUCKET, objectKey: thumbnailKey });
} catch (err) {
  console.warn(
    `[catalog/photo-storage] compensating delete failed for ${PLANT_THUMBNAILS_BUCKET}/${thumbnailKey}:`,
    err,
  );
}
```

Strengthen the integration test: stand up a real or in-memory storage backend, observe the bucket round-trip, and assert that after a triggered DB-write failure, `listObjectsUnderPrefix({ bucket, prefix: "${userId}/" })` returns an empty array. The current call-shape assertion accepted a no-op; a state-based assertion would have caught this.

---

## Warnings

### WR-01: JWT verification skips `audience` and `issuer` validation

**File:** `src/contexts/iam/infrastructure/auth/auth-adapter.ts:97`
**Issue:** `await jwtVerify(token, jwks)` is called with no options. `jose` does not validate `aud` (audience) or `iss` (issuer) when those options are not supplied. Supabase-issued JWTs carry `aud: "authenticated"` and `iss: <project URL>/auth/v1`. Without these checks, any token signed by a key resolvable through the configured JWKS endpoint is accepted, including tokens minted for other purposes (e.g., service-role JWT, custom-claim hooks, tokens issued for a different `aud` the project supports). The exposure today is bounded by per-Supabase-project key isolation, but the cost of correct validation is two extra options. This is the same finding as the prior review's WR-02 — still open.

**Fix:**

```typescript
// auth-adapter.ts:97
const { payload } = await jwtVerify(token, jwks, {
  audience: "authenticated",
  issuer: `${serverEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1`,
  algorithms: ["RS256", "ES256"],
});
```

Add unit tests that sign tokens with `aud: "wrong-audience"` and the wrong `iss` and assert `verifyBearer` returns `Unauthenticated`. The override hook (`AUTH_JWKS_OVERRIDE_URL`) should compose with this — for E2E, set the issuer to the test JWKS server origin or relax via factory option.

---

### WR-02: Photo upload route leaks jose error names through `errorResponse.message`

**File:** `src/app/api/v1/photos/upload/route.ts:38`
**Issue:** `requireApiUser` returns `{ ok: false, code: Unauthenticated, reason: <string> }` where `reason` for crypto failures is `err.name` — `JWTExpired`, `JWSSignatureVerificationFailed`, `JWTClaimValidationFailed`, etc. (`auth-adapter.ts:108`). The photos upload route forwards this to `errorResponse(auth.code, auth.reason)`, so the client-facing `error.message` becomes a jose internal error type.

This contradicts the closed-error-registry posture (CLAUDE.md, PRD §5): clients should receive the registry code with a stable, non-jose-specific message. The consent route at `src/contexts/iam/api/consent-route.ts:66` and `:138` correctly uses a hardcoded `"missing or invalid bearer token"` message — the photos route should match that pattern. The inconsistency is itself a code-quality issue.

Fix is two characters of behaviour change but has dual benefit: (a) consistent client-facing surface, (b) avoids surfacing jose internals which can aid attacker fingerprinting of the auth library.

**Fix:**

```typescript
// src/app/api/v1/photos/upload/route.ts:36-39
const auth = await requireApiUser(request);
if (!auth.ok) {
  return errorResponse(auth.code, "missing or invalid bearer token");
}
```

Keep `auth.reason` for server-side logging (Sentry breadcrumbs) but never include it in the response body.

---

### WR-03: `policy_versions.is_current = true` has no DB-level uniqueness invariant

**File:** `drizzle/migrations/0000_phase_02_initial_schema.sql:146-153`
**Issue:** The unique index is `(document_type, version)` only. Nothing prevents two `privacy_policy` rows from both having `is_current = true`. `recordConsent` (`src/contexts/iam/application/record-consent.ts:64-77`) does `eq(documentType, "privacy_policy")` and `eq(isCurrent, true)` then `.limit(1)` with no `orderBy` — so when the invariant breaks, it silently picks one nondeterministically (depends on execution plan). Consent rows then reference different policy versions for what should be the same legal grant. Same finding as prior WR-09 — still open.

The integration test at `tests/integration/diagnostics-consent.integration.test.ts:142-145` even sets `is_current = false` for ALL `privacy_policy` rows during teardown and then `is_current = true` only for `version = '2026-04-25.1'` — fine for the seeded singleton case, but if any future code path inserts a second current-flagged row before the restore, both rows would be current.

LGPD record-keeping requires deterministic chain-of-custody between consent and the policy text in force at grant time. A unique partial index makes that invariant a hard DB constraint.

**Fix:** Add a partial unique index in a new migration:

```sql
-- New migration file (0002_unique_current_policy_per_doc_type.sql)
CREATE UNIQUE INDEX IF NOT EXISTS policy_versions_one_current_per_doc_type_idx
  ON public.policy_versions (document_type)
  WHERE is_current = true;
```

Add `.orderBy(desc(policyVersions.effectiveAt))` to the query in `record-consent.ts` as belt-and-braces.

---

### WR-04: Route-boundary schema bypasses the drizzle-zod root it claims to honour

**File:** `src/contexts/iam/api/consent-route.ts:26-38`
**Issue:** Lines 26-27 import `consentLogInsertSchema` from `@contexts/iam/domain/consent-schemas`, assign it to `_ensureSchemaRoot`, then `void _ensureSchemaRoot`. The accompanying comment claims this keeps the route "drizzle-zod-rooted." But the route body uses an inline `consentRoutePostBodySchema` (`z.object({...})`) constructed from raw `z.enum(...)` literals that duplicate the enum lists in the table definition. The `_ensureSchemaRoot` reference does *nothing* at runtime or type level — it just keeps the import alive so a future grep for "uses drizzle-zod" lights up. Same as prior WR-10 — still open.

D-19 mandates routes use the drizzle-zod-derived schemas precisely so changes to the table propagate. The current pattern actively risks drift: extending `consentLogs.purpose.enum` in the schema will not flow to `consentRoutePostBodySchema`.

**Fix:** Use the drizzle-zod schema directly:

```typescript
import { consentLogInsertSchema } from "@contexts/iam/domain/consent-schemas";

const consentRoutePostBodySchema = consentLogInsertSchema.pick({
  purpose: true,
  legalBasis: true,
  source: true,
});

// Delete the dead `_ensureSchemaRoot` lines.
```

Or remove the import + `void` cast and document that this route's body shape is intentionally hand-rolled because the drizzle-zod insert shape is too permissive (id, userId, policyVersionId, granted/revoked timestamps).

---

### WR-05: `auth.uid()` shim activation is keyed on schema presence, not environment

**File:** `drizzle/migrations/0001_phase_02_rls_policies.sql:34-42`
**Issue:** The CI shim that creates `auth.uid()` runs `IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth')`. If a future production environment ever lands without the `auth` schema (a new Supabase project with auth feature disabled, a misconfigured restore, a forked Supabase installation), the shim silently installs and `auth.uid()` returns `NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid`. RLS policies that compare against `auth.uid()` would then trust whatever value PostgREST/the application bound — including the empty string (NULL after the cast) which makes `auth.uid() = id` evaluate to NULL → reject all rows. Or if no GUC is set, `current_setting('request.jwt.claim.sub', true)` returns NULL → `NULLIF(NULL, '')` is NULL → cast to uuid fails noisily on the first authenticated query.

`scripts/check-rls.ts:62-75` partially compensates: when `NODE_ENV=production` AND `auth` schema absent, it aborts. But `check-rls` is a deploy-time script, not a migration step. If `db:migrate` runs but `db:check-rls` is skipped (CI workflow change, manual intervention), the shim installs and the production runtime is exposed.

**Fix:** Combine the existing schema check with an explicit non-production guard inside the migration itself:

```sql
DO $$ BEGIN
  IF current_setting('app.environment', true) IS NOT DISTINCT FROM 'production' THEN
    RAISE EXCEPTION 'auth.uid() shim must not be installed in production';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    -- ... existing function definition
  END IF;
END $$;
```

Or guard at the migration runner: have `db:migrate` set `app.environment` from `process.env.NODE_ENV` via `SET LOCAL` before applying. Either way, the migration itself should refuse to install the shim in production rather than relying on a separate readiness probe.

---

### WR-06: Idempotency-key writes share the user's transaction with no service-role separation

**File:** `src/shared/api/idempotency.ts:101-180`
**Issue:** `withIdempotency` runs everything inside the user's `withUnitOfWork` transaction — meaning the `idempotency_keys` row INSERT, the `SELECT FOR UPDATE` on conflict, and the UPDATE that stores the response all execute under `SET LOCAL ROLE authenticated` with the user's `request.jwt.claim.sub`. The `idempotency_keys_owner_all` RLS policy (`drizzle/migrations/0001_phase_02_rls_policies.sql:184-189`) requires `auth.uid() = user_id`. That works today.

But it couples the idempotency contract to RLS correctness. If the policy is ever changed (e.g., to be FOR SELECT-only, or restricted by a status field), idempotency claims silently start failing the INSERT in unexpected ways. The helper doc claims "RLS is defense in depth" while in practice the helper relies on RLS allowing the operation. The cleaner separation is: idempotency rows are infrastructure, written under service-role bypass-RLS, read filtered by the `userId` parameter.

**Fix:** Two options:

(a) Pre-authenticated infrastructure write — switch the role for just the idempotency-row writes:

```typescript
return withUnitOfWork(userId, async (tx) => {
  // Temporarily restore service-role for idempotency bookkeeping.
  await tx.execute(sql`set local role postgres`);
  const claimed = await tx.insert(idempotencyKeys).values({...}).onConflictDoNothing(...).returning();
  await tx.execute(sql`set local role authenticated`);
  // ... handler runs as authenticated, then idempotency UPDATE under service role again
});
```

(b) Document the dependency explicitly in `0001_phase_02_rls_policies.sql` and add a regression test that breaks `idempotency_keys_owner_all` and asserts `withIdempotency` surfaces a useful error rather than a silent stuck state.

Option (b) is cheaper and matches the current design intent.

---

## Info

### IN-01: `extFromMime` defaults to `"webp"` for any unknown MIME

**File:** `src/contexts/catalog/application/upload-photo.ts:53-57`
**Issue:** `extFromMime` returns `"webp"` for any input that isn't `"image/jpeg"` or `"image/png"`. Currently safe because `AllowedMime` constrains the input to one of three values, but a future addition to `ALLOWED_MIME_TYPES` (e.g., `"image/avif"`) without updating the function would silently produce mislabeled `.webp` files. Pattern smell — exhaustive switch with default-return is a footgun.

**Fix:**

```typescript
function extFromMime(mime: AllowedMime): "jpg" | "png" | "webp" {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png":  return "png";
    case "image/webp": return "webp";
    default: {
      const _exhaustive: never = mime;
      throw new Error(`extFromMime: unhandled MIME ${_exhaustive}`);
    }
  }
}
```

The `_exhaustive: never` line gives a type error at compile time when `AllowedMime` gains a new variant.

---

### IN-02: Compensating-delete failures only reach `console.warn`, not Sentry

**File:** `src/contexts/catalog/infrastructure/photo-storage.ts:175-192`
**Issue:** Both try/catch blocks log to `console.warn` and swallow the error. After fixing CR-01, a real compensating-delete failure leaves the system in a known-orphaned state — that meets the threshold for `Sentry.captureException`. Currently invisible in monitoring; the only signal would be storage-quota growth weeks later.

**Fix:**

```typescript
import * as Sentry from "@sentry/nextjs";

// inside deleteSinglePlantPhotoBestEffort
} catch (err) {
  console.warn(
    `[catalog/photo-storage] compensating delete failed for ${PLANT_PHOTOS_BUCKET}/${originalKey}:`,
    err,
  );
  Sentry.captureException(err, {
    tags: { area: "photo-storage", operation: "compensating-delete" },
    extra: { bucket: PLANT_PHOTOS_BUCKET, objectKey: originalKey, userId: input.userId },
  });
}
```

CLAUDE.md says `Sentry.setUser({ id })` only — this captureException uses `extra.userId`, not `setUser`, so it complies with the no-PII rule.

---

### IN-03: Cursor encoding uses standard base64 (not URL-safe)

**File:** `src/shared/api/cursor.ts:43-45`
**Issue:** Standard base64 includes `+` and `/`, which are not URL-safe. Callers must URL-encode the cursor before placing it in `?cursor=...`. The Playwright test in `tests/e2e/diagnostics-consent.spec.ts:147` doesn't pass it back through a URL boundary so the issue isn't exercised, but a real client would need to URL-encode/decode. `decodeCursor` is lenient on accept (`Buffer.from(encoded, "base64")` handles both forms), but emitting `+` in a query string is brittle when manual URL building isn't routed through `URLSearchParams.set`.

**Fix:** Use `base64url` which is URL-safe by definition and supported natively:

```typescript
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(encoded: string): DecodeResult {
  let json: string;
  try {
    json = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }
  // ... rest unchanged
}
```

`base64url` decode accepts both standard and URL-safe forms.

---

### IN-04: Migration timestamps in `_journal.json` predate the planning artifact dates

**File:** `drizzle/migrations/meta/_journal.json:8,14`
**Issue:** Both migration `when` timestamps (`1777220218174`, `1777220252423`) decode to 2026-04-22 — a few days before today (CLAUDE.md `currentDate: 2026-04-26`). Drizzle uses these timestamps to order migrations; manual edits or replays may produce values that don't match phase chronology. Not a runtime bug, but a hygiene issue: if a future phase-3 migration is generated and accidentally back-dated, drizzle-kit's ordering could silently flip migration order.

**Fix:** Add a CI assertion that `meta/_journal.json` `when` values are monotonically increasing per `idx`. Alternatively, document under CLAUDE.md `Conventions` that drizzle migrations must use the timestamp at the moment of generation and never be hand-edited.

---

_Reviewed: 2026-04-26T16:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
