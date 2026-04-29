---
phase: 04-iam-auth-verification-consent
reviewed: 2026-04-29T23:45:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - src/contexts/iam/infrastructure/supabase-server.ts
  - src/proxy.ts
  - src/contexts/iam/infrastructure/auth/auth-adapter.ts
  - tests/unit/supabase-middleware-update-session.test.ts
  - tests/unit/auth-adapter-phase4.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 04-12: Code Review Report

**Reviewed:** 2026-04-29T23:45:00Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Plan 04-12 closes UAT Gap 1 (cold-start `AuthApiError` surfaced by `@supabase/auth-js@2.104.1` + `@supabase/ssr@0.10.2`) by introducing a named `updateSessionInMiddleware` helper at the IAM infrastructure boundary and routing all non-API page requests through it from `src/proxy.ts`. The four invariants the plan promised to preserve all hold:

1. **Codex HIGH #3 boundary intact.** `src/proxy.ts` imports only the named helper — `grep "@supabase/ssr" src/proxy.ts` returns 0; `grep "@supabase/supabase-js" src/proxy.ts` returns 0. The IAM infrastructure file is the sole owner of `createServerClient` and `isAuthSessionMissingError`.
2. **AUTH-12 invariant intact.** `getUserBySession` does not call `signOut` on probe failure (`src/contexts/iam/infrastructure/auth/auth-adapter.ts:217-247`); existing JWTs are not invalidated. File-wide `signOut` count is pinned at 5 references — only `signOutLocal` (line 270-276) and the AUTH-12 reminder comment (line 279) reach the symbol.
3. **T-02-37 body discipline intact.** The middleware helper touches only `request.cookies` and `response.cookies`; the proxy's `/api/v1/*` branch is byte-equivalent to the previous logic. Test 3 in `tests/unit/supabase-middleware-update-session.test.ts:148-161` directly proves `request.bodyUsed === false` after the helper runs.
4. **Cookie-clear regex sound.** The anchored `/^sb-[^.]+-auth-token(?:\.\d+)?$/` correctly matches both single-cookie (`sb-127-auth-token`) and chunked (`sb-127-auth-token.0`, `.1`) forms while rejecting the `unrelated` cookie in the test fixture.

Two warnings and two info items remain. None are blockers — the empirical proof (`tests/e2e/auth-cold-start-stale-cookie.spec.ts` and the UAT.md Test 1 record) shows the structural fix closes the bug end-to-end.

## Warnings

### WR-01: Asymmetric cookie clear writes only to `response.cookies`, not `request.cookies`

**File:** `src/contexts/iam/infrastructure/supabase-server.ts:143-147`
**Issue:** The `setAll` adapter immediately above (lines 127-132) writes to BOTH `request.cookies` and `response.cookies` — that dual-write is what lets a same-request Server Component see middleware-refreshed state. The defense-in-depth fallback loop, however, writes only to `response.cookies`. If `_recoverAndRefresh` fails AND auth-js does not fire its own `setAll` (the documented version-pair bug that motivates this loop), `request.cookies` retains the stale value. Any same-request Server Component that obtains its supabase client via the async `cookies()` store could re-enter `_recoverAndRefresh` against the same stale blob and re-emit the `console.error` the fix is meant to suppress.

Empirical evidence (`tests/e2e/auth-cold-start-stale-cookie.spec.ts` first-navigation assertions + UAT.md Test 1 manual dev-overlay check) shows current behavior is clean — so this is belt-and-braces, not a current bug. But the asymmetry is fragile to a future Next.js / auth-js / `@supabase/ssr` version change in how the cookie surfaces interact, and the visible symptom (a recurring SSR `console.error` flagged by the dev overlay) is exactly what motivated the original fix. Mirroring the dual-write pattern is one extra line and removes the version-pair coupling.

**Fix:**
```typescript
for (const cookie of request.cookies.getAll()) {
  if (SUPABASE_AUTH_TOKEN_COOKIE.test(cookie.name)) {
    request.cookies.set(cookie.name, "");
    response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
  }
}
```
Add a unit-test assertion in `tests/unit/supabase-middleware-update-session.test.ts` that `request.cookies.get("sb-...-auth-token")?.value === ""` after the AuthApiError path runs, alongside the existing response-side assertions at lines 181-184.

### WR-02: Sentry tag-key convention is inconsistent within the IAM module

**File:** `src/contexts/iam/infrastructure/supabase-server.ts:141` and `src/contexts/iam/infrastructure/auth/auth-adapter.ts:238`, `src/contexts/iam/infrastructure/auth/auth-adapter.ts:297`
**Issue:** Three tag-key conventions coexist in the IAM context:
- `tags.context` — `auth-adapter.ts:238` (`iam.getUserBySession`), `auth-adapter.ts:297` (`iam.compensating_delete`)
- `tags.surface` — `supabase-server.ts:141` (`iam.updateSessionInMiddleware`), `iam/application/resend-verification.ts:55`, `iam/application/signup.ts:162` and `:189`, `app/api/v1/iam/oauth/complete/route.ts:62`, `app/api/v1/iam/resend-verification/route.ts:53`, `app/api/v1/iam/signup/route.ts:118`
- `tags.area` + `tags.operation` — `catalog/infrastructure/photo-storage.ts:187`, `:205`

The 04-12 plan changed `auth-adapter.ts` from `surface:` to `context:` to match the in-file `adminDeleteUser` precedent — but the two precedents in the same file are both the minority pattern in the IAM module. Sentry filters keyed on `surface:` (e.g. all IAM application + route surfaces) will not surface `getUserBySession` errors; filters keyed on `context:` will not surface the middleware helper or any of the IAM application / route signals. The plan summary calls out this split as intentional ("distinguish call surfaces") but the rationale is not in the source — anyone reading `auth-adapter.ts` alongside `signup.ts` will assume one of them is wrong.

There is also a self-contradiction: the plan summary justifies the split by "call surface" (middleware vs. server-component-time auth probe), yet `auth-adapter.ts` (which uses `context:`) and `supabase-server.ts` (which uses `surface:`) are BOTH IAM infrastructure-layer modules.

**Fix:** Either (a) standardize on a single tag key — `surface:` already has the most call sites and the values follow the same `iam.{module}.{operation}` pattern; or (b) add a doc-comment block above the IAM Sentry call sites explaining the tag-key split convention. If keeping the split, document at minimum that `context:` is reserved for IAM infrastructure layer and `surface:` is reserved for IAM application + route layers — but note that under that rule the `supabase-server.ts:141` `surface:` tag would need to flip to `context:` to be consistent.

## Info

### IN-01: Cookie clear assumes default `Path=/` and no `Domain` attribute

**File:** `src/contexts/iam/infrastructure/supabase-server.ts:145`
**Issue:** The clearing `response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" })` does not propagate the original cookie's `Domain` attribute. RFC 6265 requires the clearing cookie to match `Path` and `Domain` of the cookie being cleared — otherwise the browser treats it as a different cookie and the stale one persists. Today this is fine: Supabase's default cookie write does not set `Domain` and uses `Path=/` on the project default. If the project ever moves to a subdomain configuration (`*.folhario.com.br`) or a different `Path`, the clearing path will silently fail to evict the stale cookie.

**Fix:** Either (a) read the original cookie's `domain` and `path` from `request.cookies` and pass them through, or (b) add a comment at line 145 documenting the default-config assumption and pin a regression check that the Supabase auth cookie issuance path is unchanged.

### IN-02: `Sentry.captureException(error, ...)` passes full `error.message` — depends on LGPD-13 scrub

**File:** `src/contexts/iam/infrastructure/supabase-server.ts:140` and `src/contexts/iam/infrastructure/auth/auth-adapter.ts:237-240`
**Issue:** Both call sites pass the raw Supabase auth error as the first argument to `Sentry.captureException`. The error message can carry Supabase-side detail (refresh-token IDs, tenant identifiers, occasionally email-like strings inside server messages). The CLAUDE.md hard rule "Sentry: setUser({ id }) only — never email" is honored at the `extra` payload level (only `errorName` + `readOnly` are forwarded), and the project's Phase 1 LGPD-13 scrub at `src/shared/telemetry/sentry-scrub.ts` further drops authentication tokens, cookies, and the `email` field. So today the contract holds. But the dependency is implicit — a future refactor that disables or relocates the scrub module would silently regress this hard rule.

**Fix:** Add an inline comment at each `Sentry.captureException(error, ...)` call site referencing the LGPD-13 scrub module by path: `// LGPD-13: error.message scrubbed by src/shared/telemetry/sentry-scrub.ts beforeSend.` This makes the scrub dependency local and auditable instead of buried in plan documentation.

---

_Reviewed: 2026-04-29T23:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
