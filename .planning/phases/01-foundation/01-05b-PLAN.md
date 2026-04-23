---
phase: 01
plan: 05b
type: execute
wave: 4
depends_on: [02, 03, 05a]
files_modified:
  - src/sentry.server.config.ts
  - src/sentry.edge.config.ts
  - src/instrumentation-client.ts
  - src/instrumentation.ts
autonomous: true
requirements:
  - OBS-01
tags:
  - sentry
  - observability
  - init-wiring

must_haves:
  truths:
    - "`src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation-client.ts` all call `Sentry.init` with `sendDefaultPii: false` (L-2 / CVE-2025-65944)"
    - "All three init files consume `makeBeforeSend()` + `makeBeforeBreadcrumb()` from `@shared/telemetry/sentry-scrub`"
    - "All three init files set `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined` + `enabled: Boolean(...)` so empty DSN disables transport (D-19)"
    - "`src/instrumentation.ts` removes the try/catch guards from Plan 03 (sentry server + edge configs now exist)"
    - "`src/sentry.client.config.ts` does NOT exist (legacy v7/v8 name; v10 uses `instrumentation-client.ts`)"
    - "`pnpm typecheck` and `pnpm build` succeed with Sentry config in place"
  artifacts:
    - path: "src/sentry.server.config.ts"
      provides: "Server-side Sentry.init with scrub helpers"
      contains: "sendDefaultPii: false"
    - path: "src/sentry.edge.config.ts"
      provides: "Edge-runtime Sentry.init with scrub helpers"
      contains: "sendDefaultPii: false"
    - path: "src/instrumentation-client.ts"
      provides: "Browser Sentry.init (Next 16 auto-loads this convention — replaces legacy sentry.client.config.ts)"
      contains: "sendDefaultPii: false"
    - path: "src/instrumentation.ts"
      provides: "Next 16 instrumentation hook — CLEAN imports (try/catch from Plan 03 removed)"
      contains: "await import"
  key_links:
    - from: "src/sentry.server.config.ts"
      to: "src/shared/telemetry/sentry-scrub.ts"
      via: "imports makeBeforeSend + makeBeforeBreadcrumb"
      pattern: "from\\s+[\"']@shared/telemetry/sentry-scrub[\"']"
    - from: "src/instrumentation-client.ts"
      to: "src/shared/telemetry/sentry-scrub.ts"
      via: "imports makeBeforeSend + makeBeforeBreadcrumb"
      pattern: "from\\s+[\"']@shared/telemetry/sentry-scrub[\"']"
    - from: "src/instrumentation.ts"
      to: "src/sentry.server.config.ts"
      via: "await import('./sentry.server.config') when NEXT_RUNTIME === nodejs (try/catch removed)"
      pattern: "await import\\([\"']\\./sentry\\.server\\.config[\"']\\)"
---

<objective>
Wire the three Sentry init files (server, edge, browser) to consume the scrub helpers shipped by Plan 05a, and clean up `src/instrumentation.ts` by removing the try/catch guards that Plan 03 added defensively. This plan is `type: execute` (not TDD) because the wiring is glue code against an external SDK contract — the load-bearing logic is tested in Plan 05a.

Purpose: Plan 05a shipped the pure scrub module + its tests. Plan 05b mounts that module into the Sentry SDK callsites. Without this plan, the scrub rules never run at event capture time. Without the try/catch removal, the guarded imports in `src/instrumentation.ts` silently swallow real init errors.

Output: Sentry server/edge/browser init files each load `sendDefaultPii: false` + scrub hooks; empty DSN cleanly disables transport; `pnpm build` succeeds with clean imports in `src/instrumentation.ts`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/01-foundation/01-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/01-foundation/01-RESEARCH.md
@/Users/machado/Projects/folhario/.planning/phases/01-foundation/01-PATTERNS.md
@/Users/machado/Projects/folhario/CLAUDE.md
@/Users/machado/Projects/folhario/.planning/phases/01-foundation/01-FILE-MATRIX.md
@/Users/machado/Projects/folhario/src/shared/telemetry/sentry-scrub.ts
@/Users/machado/Projects/folhario/src/instrumentation.ts

<interfaces>
<!-- Consumed from Plan 05a: src/shared/telemetry/sentry-scrub.ts (5 named exports) -->
<!-- Consumed from Plan 03: src/instrumentation.ts (to be edited — remove try/catch guards) -->
<!-- Consumed from Plan 02: src/shared/config/server-env.ts + client-env.ts (not directly imported here; init files read process.env directly because next.config.ts + Sentry init run before module-load parsing of env.ts) -->

<!-- Sentry 10.48 init file naming — VERIFIED via context7 /getsentry/sentry-docs on 2026-04-23: -->
<!-- Current convention names the browser file `instrumentation-client.ts` NOT `sentry.client.config.ts`. -->
<!-- Server + edge names remain `sentry.server.config.ts` + `sentry.edge.config.ts`. -->
<!-- All three files live in `src/` (project convention). -->

Sentry.init options (pinned via CLAUDE.md @sentry/nextjs@10.48.0):
- `dsn: string | undefined` — empty string must be coerced to undefined (Pitfall 2)
- `enabled: boolean` — belt-and-suspenders with empty DSN
- `sendDefaultPii: false` — current public API in 10.48 (L-2 verified); DO NOT use proposed `dataCollection` API
- `release: string | undefined` — CI sets to `$GITHUB_SHA` (Phase 12 completes the chain)
- `environment: string | undefined` — `VERCEL_ENV ?? NODE_ENV`
- `denyUrls: RegExp[]` — does NOT include `/__diag`
- `beforeSend: (event) => event | null` — our scrub hook from Plan 05a
- `beforeBreadcrumb: (breadcrumb) => breadcrumb | null` — our breadcrumb scrub from Plan 05a
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create src/sentry.server.config.ts, src/sentry.edge.config.ts, src/instrumentation-client.ts</name>
  <files>src/sentry.server.config.ts, src/sentry.edge.config.ts, src/instrumentation-client.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-PATTERNS.md §SP-3 Callsite (lines 280-297), §sentry.client.config.ts R-2 reconciliation (lines 773-795)
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-RESEARCH.md §Pattern 6 Sentry beforeSend (lines 675-761), §Pitfall 2 (lines 940-946)
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-CONTEXT.md D-19, D-22
    - Context7 docs /getsentry/sentry-docs — `instrumentation-client.ts` is the current v10 file convention (supersedes `sentry.client.config.ts` in older Sentry docs)
    - /Users/machado/Projects/folhario/src/shared/telemetry/sentry-scrub.ts (from Plan 05a — authoritative public surface)
  </read_first>
  <action>
Step 1 — Create `src/sentry.server.config.ts`:

```typescript
// src/sentry.server.config.ts
// Sentry 10.48 server-side init. Consumes scrub helpers from @shared/telemetry/sentry-scrub (Plan 05a).
// D-19: empty DSN disables transport; D-22: sendDefaultPii:false + beforeSend defense-in-depth; L-2: sendDefaultPii is the current public API.
import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, makeBeforeBreadcrumb } from "@shared/telemetry/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  release: process.env.SENTRY_RELEASE,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  denyUrls: [/\/_next\/static\//],
  beforeSend: makeBeforeSend(),
  beforeBreadcrumb: makeBeforeBreadcrumb(),
});
```

Step 2 — Create `src/sentry.edge.config.ts`:

```typescript
// src/sentry.edge.config.ts
// Sentry 10.48 edge-runtime init. Kept for completeness even though proxy.ts runs on Node only (L-1).
// Any future edge-runtime callsite will honor the same scrub contract via this init.
import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, makeBeforeBreadcrumb } from "@shared/telemetry/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  release: process.env.SENTRY_RELEASE,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  denyUrls: [/\/_next\/static\//],
  beforeSend: makeBeforeSend(),
  beforeBreadcrumb: makeBeforeBreadcrumb(),
});
```

Step 3 — Create `src/instrumentation-client.ts` (Sentry 10 current convention — NOT `sentry.client.config.ts`, which was the v7/v8 name):

```typescript
// src/instrumentation-client.ts
// Sentry 10.48 browser init. File naming per https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
// (Next 16 auto-loads this file into the client bundle.)
// D-21 posture: replay + profiling disabled by default (Phase 1 is diagnostics-only).
import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, makeBeforeBreadcrumb } from "@shared/telemetry/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: makeBeforeSend(),
  beforeBreadcrumb: makeBeforeBreadcrumb(),
});

// Next 16 App Router navigation instrumentation — safe to export even with Sentry disabled.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

Step 4 — Verify `pnpm typecheck` passes. If Sentry's types complain about `beforeSend` return-type compatibility (`SentryEvent` vs Sentry's internal `ErrorEvent | TransactionEvent`), cast the return only if typecheck errors:

```typescript
beforeSend: makeBeforeSend() as unknown as Sentry.NodeOptions["beforeSend"],
```

Do NOT add the cast preemptively — Sentry 10 type surface has been broadening; keep the code clean if TS infers compatibly.

Step 5 — Belt-and-suspenders grep assertion: the legacy `sentry.client.config.ts` file MUST NOT exist at any time in this plan. If the executor accidentally created it while disambiguating Sentry docs, delete it.
  </action>
  <verify>
    <automated>test -f src/sentry.server.config.ts && test -f src/sentry.edge.config.ts && test -f src/instrumentation-client.ts && grep -q "sendDefaultPii: false" src/sentry.server.config.ts && grep -q "sendDefaultPii: false" src/sentry.edge.config.ts && grep -q "sendDefaultPii: false" src/instrumentation-client.ts && grep -q "makeBeforeSend" src/sentry.server.config.ts && grep -q "makeBeforeSend" src/sentry.edge.config.ts && grep -q "makeBeforeSend" src/instrumentation-client.ts && grep -q "@shared/telemetry/sentry-scrub" src/sentry.server.config.ts && ! test -f src/sentry.client.config.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - All three init files exist: `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation-client.ts`
    - Legacy `src/sentry.client.config.ts` does NOT exist: `! test -f src/sentry.client.config.ts`
    - `grep -c "sendDefaultPii: false" src/sentry.*.config.ts src/instrumentation-client.ts` returns 3
    - `grep -c "makeBeforeSend" src/sentry.*.config.ts src/instrumentation-client.ts` returns 3
    - `grep -c "makeBeforeBreadcrumb" src/sentry.*.config.ts src/instrumentation-client.ts` returns 3
    - `grep -c "NEXT_PUBLIC_SENTRY_DSN || undefined" src/sentry.*.config.ts src/instrumentation-client.ts` returns 3
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    - Three Sentry init files present: `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts`
    - `src/sentry.client.config.ts` does NOT exist (superseded by `instrumentation-client.ts` in Sentry 10)
    - All three call `Sentry.init` with `sendDefaultPii: false` + scrub helpers
    - All three use `NEXT_PUBLIC_SENTRY_DSN || undefined` + `enabled: Boolean(...)` (Pitfall 2)
    - `pnpm typecheck` exits 0
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove try/catch guards from src/instrumentation.ts + verify pnpm build succeeds with Sentry wired</name>
  <files>src/instrumentation.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/src/instrumentation.ts (from Plan 03 Task 2 — has guarded imports)
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-PATTERNS.md §src/instrumentation.ts (lines 753-770)
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-FILE-MATRIX.md (confirms this file is 05b's turn to edit)
  </read_first>
  <action>
Step 1 — Replace the guarded `src/instrumentation.ts` from Plan 03 Task 2 with the clean version. The `sentry.{server,edge}.config.ts` files now exist (Task 1 above):

```typescript
// src/instrumentation.ts — Next 16 instrumentation hook
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors from Server Components, middleware/proxy, and route handlers.
export const onRequestError = Sentry.captureRequestError;
```

Step 2 — Verify clean build succeeds with env stubs (same env set as Plan 03 Task 3):

```bash
DATABASE_URL=postgres://u:p@localhost:5432/db \
DATABASE_POOL_URL=postgres://u:p@localhost:5432/db \
SUPABASE_SERVICE_ROLE_KEY=test \
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
IDENTIFICATION_PROVIDER_MODE=stub \
pnpm build
```

Confirm build logs DO NOT mention "missing sentry.server.config" or "missing sentry.edge.config" errors.

Confirm the Sentry CLI does NOT attempt an upload (no `SENTRY_AUTH_TOKEN` is set in Phase 1 CI either — Plan 08 confirms).
  </action>
  <verify>
    <automated>test -f src/instrumentation.ts && ! grep -q "try {" src/instrumentation.ts && ! grep -q "} catch" src/instrumentation.ts && grep -q "await import.*sentry.server.config" src/instrumentation.ts && grep -q "await import.*sentry.edge.config" src/instrumentation.ts && grep -q "Sentry.captureRequestError" src/instrumentation.ts && DATABASE_URL=postgres://u:p@localhost:5432/db DATABASE_POOL_URL=postgres://u:p@localhost:5432/db SUPABASE_SERVICE_ROLE_KEY=test NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon IDENTIFICATION_PROVIDER_MODE=stub pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "try {" src/instrumentation.ts` returns 0
    - `grep -c "} catch" src/instrumentation.ts` returns 0
    - `grep -c "await import" src/instrumentation.ts` returns 2 (server + edge)
    - `grep -q "Sentry.captureRequestError" src/instrumentation.ts` matches
    - `pnpm build` (with env stubs) exits 0
    - No `SENTRY_AUTH_TOKEN`-related upload output in build logs
  </acceptance_criteria>
  <done>
    - `src/instrumentation.ts` has no try/catch — direct imports
    - `pnpm build` succeeds (with required env stubs)
    - Sentry source-map upload does NOT run (no SENTRY_AUTH_TOKEN)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Sentry SDK init → runtime | `sendDefaultPii: false` prevents CVE-2025-65944-class header leaks |
| Empty DSN → transport disabled | Must be a hard gate (D-19), not best-effort |
| `src/instrumentation.ts` imports | Must not swallow real init errors (guards removed) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05b-01 (T-3 MEDIUM) | Information Disclosure | CVE-2025-65944 (header leak on sendDefaultPii:true) | mitigate | CLAUDE.md pins @sentry/nextjs@10.48.0 (patched in 10.27.0+); all three init files explicitly set `sendDefaultPii: false` (acceptance criteria grep-verified). |
| T-05b-02 | Information Disclosure | Sentry release tag leaking branch/PR names | accept | `SENTRY_RELEASE` set to `$GITHUB_SHA` in Plan 08 CI (Phase 12 completes in deploy-production.yml). Git SHA is public info for public repos. |
| T-05b-03 | Denial of Service | Sentry outage breaks app boot | mitigate | Empty DSN disables transport (D-19). `enabled: Boolean(...)` belt-and-suspenders. Sentry failures are async and non-throwing per SDK contract. |
| T-05b-04 | Tampering | `src/instrumentation.ts` guarded try/catch from Plan 03 silently swallows real init errors | mitigate | Task 2 removes the guards — any real init failure now surfaces as a build / runtime error instead of being hidden. |
| T-05b-05 | Tampering | Forged Sentry envelope bypassing scrub | accept-delegated | Sentry-side auth uses `NEXT_PUBLIC_SENTRY_DSN` (project-scoped). Abuse mitigated by Sentry server-side rate limits — out of scope for our SDK. |

Threats deferred: source-map upload secret management (Phase 12 `deploy-production.yml`); replay + profiling integrations (out of Phase 1 scope per D-21). Alert rules: deferred to Phase 13 per user decision 2026-04-23 (OBS-05 moved out of Phase 1).
</threat_model>

<verification>
1. `pnpm typecheck` exits 0.
2. `pnpm build` (with env stubs) exits 0.
3. All three Sentry init files present at `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation-client.ts`.
4. `src/sentry.client.config.ts` does NOT exist (would indicate v7/v8 pattern leak).
5. `src/instrumentation.ts` has no try/catch (clean direct imports).
6. `grep -c "sendDefaultPii: false" src/sentry.*.config.ts src/instrumentation-client.ts` returns 3.
</verification>

<success_criteria>
- [ ] Three Sentry init files in place — server, edge, instrumentation-client (NOT the legacy sentry.client.config.ts name)
- [ ] All three use `sendDefaultPii: false` + scrub helpers from Plan 05a + empty-DSN disables transport
- [ ] `src/instrumentation.ts` cleaned of try/catch (direct imports)
- [ ] `pnpm build` succeeds with env stubs
- [ ] `pnpm typecheck` exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-05b-SUMMARY.md` documenting:
- Sentry init file naming decision (v10 `instrumentation-client.ts` vs older `sentry.client.config.ts`) + link to context7 source
- Confirmation that `src/instrumentation.ts` guards removed
- Any type-cast needed for `beforeSend` signature against Sentry 10.48 types
- Confirmation that Plan 05a's scrub module was consumed verbatim (no inline re-implementation)
- Reference to Plan 07 (Playwright diagnostics smoke) which validates transport end-to-end
</output>
