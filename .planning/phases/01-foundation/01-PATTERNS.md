# Phase 1: Foundation — Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 39 (+ 38 `.gitkeep` scaffold placeholders, grouped)
**Analogs found:** 0 / 39 in-repo — **this is the founding phase; every file is NEW**
**Upstream references provided:** 39 / 39

---

## Founding-Phase Notice

The Folhário repo is empty except for:

- `.env` — PRD §20 credentials already provisioned (**DO NOT OVERWRITE** — `scripts/sync-supabase-env.sh` targets `.env.local`)
- `.gitignore` — contains only `.DS_Store` (Phase 1 extends it)
- `.claude/` — tooling config, irrelevant to runtime
- `docs/CAVE-PRD.md` — canonical spec (read-only reference)
- `supabase/{.branches,.temp,snippets}/` — CLI scratch dirs; `supabase/config.toml` does not yet exist

No prior code patterns exist. PATTERNS.md therefore maps each new file to **its single closest upstream reference in the ecosystem** (official docs, pinned SDK, verified npm package). Every entry is marked `NEW`. Concrete code excerpts are transcribed verbatim from `01-RESEARCH.md` (which already verified every pattern against live docs on 2026-04-23) and from pinned-version SDK reference.

---

## LANDMINES — resolve before the planner generates tasks

Three items in CONTEXT.md conflict with the actual SDK behavior pinned in CLAUDE.md. The planner MUST translate per this table.

| ID | CONTEXT.md / wording source | Correct Phase-1 wording | Why | Evidence |
|----|-----------------------------|--------------------------|-----|----------|
| **L-1** | CONTEXT.md §Integration Points + D-24 say "`src/middleware.ts`" | **`src/proxy.ts`** exporting a function named `proxy` (Node runtime only) | Next 16 renamed the `middleware.ts` file convention to `proxy.ts` with function rename `middleware → proxy`. Edge runtime no longer supported in this hook. | https://nextjs.org/docs/messages/middleware-to-proxy • https://nextjs.org/docs/app/api-reference/file-conventions/proxy |
| **L-2** | (none in CONTEXT.md) Forthcoming Sentry `dataCollection` API is NOT yet public | Keep **`sendDefaultPii: false`** in `Sentry.init({...})` (verified current public option in 10.48.0) | `sendDefaultPii` is still the documented option in `@sentry/nextjs` 10.48/10.50. `dataCollection` exists only in `develop-docs/`. Treat as future migration. CVE-2025-65944 already patched in 10.27+. | https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/ |
| **L-3** | (none in CONTEXT.md) Do not use `@posthog/next` | **Hand-roll** `src/shared/telemetry/posthog-client.ts` on raw `posthog-js@1.368.0` + `src/shared/telemetry/posthog-server.ts` on `posthog-node@5.29.7` | `@posthog/next` is `0.1.0` → pre-1.0 API volatility; its default config (`capture_pageview: false, persistence: 'localStorage+cookie', opt_out_persistence_by_default: true`) conflicts with D-21 "autocapture disabled, explicit taxonomy only". | `npm view @posthog/next version` → `0.1.0` (2026-04-23) |

### Pattern-internal inconsistencies to reconcile in PLAN.md

| # | Conflict | Recommended resolution |
|---|----------|------------------------|
| R-1 | RESEARCH Pattern 2 imports `routing` from `@shared/config/i18n-routing`, but RESEARCH §Recommended Project Structure places the file at `src/i18n/routing.ts`. D-07 only defines `@contexts/*` and `@shared/*` aliases — neither reaches `src/i18n/`. | **Ship `src/i18n/routing.ts` + `src/i18n/request.ts`** (conventional next-intl layout). In `src/proxy.ts`, import via a relative path (`import { routing } from "./i18n/routing"`) or add a third alias `@i18n/* → src/i18n/*` to `tsconfig.json` `paths` and the Vite `tsconfig-paths` plugin. Do NOT forward the `@shared/config/i18n-routing` import as-written. |
| R-2 | RESEARCH Pattern 6 comment says the `beforeSend` scrubber should be mirrored across `sentry.server.config.ts`, `sentry.edge.config.ts`, **and `sentry.client.config.ts`**, but the project-structure tree lists only server + edge. Client-side scrubbing is required because `/__diag` page.tsx calls `Sentry.captureException` from the browser (D-27), and the Playwright smoke asserts scrubbing on ALL envelopes. | **Ship all three**: `src/sentry.server.config.ts` + `src/sentry.edge.config.ts` + `src/sentry.client.config.ts`, each calling the same shared scrub helpers from `src/shared/telemetry/sentry-client.ts` (name misleading — it's the **shared** helper module; used by all three init files). |
| R-3 | D-18 `supabase status -o env` does not emit `DATABASE_POOL_URL` natively; locally there is no Supavisor pooler. | `scripts/sync-supabase-env.sh` must compute `DATABASE_POOL_URL` from `DATABASE_URL` (identical locally; adds `?prepare=false`-compatible posture — see RESEARCH §Code Examples). |

---

## File Classification

| New File | Role | Data Flow | Upstream Reference | Match Quality |
|----------|------|-----------|--------------------|---------------|
| `.nvmrc` | config | N/A | Node 22 LTS convention | exact (NEW) |
| `.gitignore` (extend) | config | N/A | Next.js 16 starter `.gitignore` | exact (NEW) |
| `.env.example` | config | N/A | PRD §20 env var table (doc) | exact (NEW) |
| `package.json` | config | N/A | Stack pins (CLAUDE.md) + Corepack/Husky 9 idioms | exact (NEW) |
| `tsconfig.json` | config | N/A | Next 16 default + INFRA-01 minimum (D-06) | exact (NEW) |
| `eslint.config.mjs` | config | N/A | `eslint-config-next@16.2.4` flat-config docs | exact (NEW) |
| `.prettierrc` | config | N/A | Prettier 3 defaults + `eslint-config-prettier` pairing | exact (NEW) |
| `.commitlintrc.json` | config | N/A | `@commitlint/config-conventional` 20.x | exact (NEW) |
| `next.config.ts` | build config | N/A | Serwist `withSerwistInit` + Sentry `withSentryConfig` composed | exact (NEW) |
| `vitest.config.ts` | test config | N/A | Vitest 4 `test.projects` (replaces deprecated `workspace`) | exact (NEW) |
| `playwright.config.ts` | test config | N/A | Playwright 1.59 `webServer` + Chromium-only (D-26) | exact (NEW) |
| `.husky/pre-commit` | git hook | N/A | Husky 9 plain-script idiom (NOT `husky install`) | exact (NEW) |
| `.husky/commit-msg` | git hook | N/A | Husky 9 + commitlint pattern | exact (NEW) |
| `.github/workflows/ci.yml` | CI config | N/A | GH Actions + Playwright CI recipe | exact (NEW) |
| `scripts/sync-supabase-env.sh` | script | file-I/O | Supabase CLI `supabase status -o env --override-name` | exact (NEW) |
| `supabase/config.toml` | config | N/A | `supabase init` output (CLI-generated; pin Postgres 17) | exact (NEW — generated) |
| `public/manifest.webmanifest` | static asset | N/A | W3C Web App Manifest (minimal placeholder per D-14) | exact (NEW) |
| `src/proxy.ts` **[L-1]** | middleware | request-response | Next 16 `proxy.ts` + next-intl 4.9 composed with headers | exact (NEW) |
| `src/instrumentation.ts` | boot hook | event-driven | Next 16 `instrumentation.ts` + `@sentry/nextjs` 10.48 setup | exact (NEW) |
| `src/sentry.server.config.ts` | telemetry config | event-driven | Sentry Next.js manual-setup — server init | exact (NEW) |
| `src/sentry.edge.config.ts` | telemetry config | event-driven | Sentry Next.js manual-setup — edge init | exact (NEW) |
| `src/sentry.client.config.ts` **[R-2]** | telemetry config | event-driven | Sentry Next.js manual-setup — browser init | exact (NEW) |
| `src/i18n/routing.ts` **[R-1]** | config | N/A | `next-intl/routing` `defineRouting` | exact (NEW) |
| `src/i18n/request.ts` | server config | request-response | `next-intl/server` `getRequestConfig` | exact (NEW) |
| `src/messages/pt-BR.json` | content | N/A | next-intl messages JSON (empty skeleton at Phase 1) | exact (NEW) |
| `src/app/layout.tsx` | component | request-response | Next 16 App Router root layout + `NextIntlClientProvider` + Serwist registration | exact (NEW) |
| `src/app/sw.ts` | service worker source | event-driven | Serwist 9.5 `sw.ts` skeleton (no precache per D-13) | exact (NEW) |
| `src/app/__diag/page.tsx` | component (client) | event-driven | D-27 custom diagnostics page | exact (NEW) |
| `src/app/__diag/layout.tsx` | component (server guard) | request-response | `IDENTIFICATION_PROVIDER_MODE` gate + `notFound()` | exact (NEW) |
| `src/app/api/v1/_diagnostics/ping/route.ts` | route handler | request-response | Next 16 `route.ts` + D-27 diagnostics | exact (NEW) |
| `src/shared/config/env.ts` | config | N/A | Zod 4 schema + PRD §20 env table (D-29) | exact (NEW) |
| `src/shared/config/errors.ts` | registry + utility | transform | PRD §5 closed registry (D-10..12) | exact (NEW) |
| `src/shared/telemetry/sentry-client.ts` | helper (shared) | transform | Scrub helpers consumed by all three `sentry.*.config.ts` files | exact (NEW) |
| `src/shared/telemetry/posthog-client.ts` **[L-3]** | telemetry | event-driven | `posthog-js@1.368.0` raw init with all-off defaults | exact (NEW) |
| `src/shared/telemetry/posthog-server.ts` **[L-3]** | telemetry | event-driven | `posthog-node@5.29.7` server singleton | exact (NEW) |
| `src/contexts/*/{domain,application,infrastructure,api,inngest}/.gitkeep` (35 files) | scaffold | N/A | PRD §2 bounded-context tree (empty per D-09) | scaffold (NEW) |
| `src/shared/{db,events,adapters}/.gitkeep` (3 files) | scaffold | N/A | PRD §2 shared tree (empty per D-09) | scaffold (NEW) |
| `tests/unit/*.test.ts` (5 files, Wave 0) | test | transform | Vitest 4 + Wave 0 gap list | exact (NEW) |
| `tests/integration/postgres-connection.integration.test.ts` | test | CRUD | Vitest 4 integration project (D-25) | exact (NEW) |
| `tests/e2e/{diagnostics-sentry,diagnostics-posthog,security-headers}.spec.ts` (3 files) | test | event-driven | Playwright 1.59 + D-27 | exact (NEW) |

---

## Shared Patterns

These patterns apply to multiple files. The planner MUST reference them once per shared consumer rather than re-extracting.

### SP-1 Error registry + HTTP mapper (D-10, D-11, D-12, INFRA-20)

**Source module:** `src/shared/config/errors.ts`
**Reference:** PRD §5 (docs/CAVE-PRD.md) — closed error-code registry; RESEARCH §Pattern 4.
**Apply to:** every future `src/contexts/*/api/*/route.ts`; Phase 1 only `src/app/api/v1/_diagnostics/ping/route.ts` imports it.

```typescript
// src/shared/config/errors.ts
// Closed registry; internal-only codes surface as provider_unavailable (PRD §5 AC-COST-007)
export const ErrorCode = {
  Unauthenticated: "unauthenticated",
  TokenExpired: "token_expired",
  InvalidCredentials: "invalid_credentials",
  Forbidden: "forbidden",
  EmailUnverified: "email_unverified",
  ValidationFailed: "validation_failed",
  InvalidPartnerCode: "invalid_partner_code",
  NotFound: "not_found",
  Conflict: "conflict",
  ConsentRequired: "consent_required",
  DeletionInProgress: "deletion_in_progress",
  SubscriptionRequired: "subscription_required",
  ReadOnlyMode: "read_only_mode",
  CapHit: "cap_hit",
  ProviderUnavailable: "provider_unavailable",
  CostCeilingReached: "cost_ceiling_reached", // INTERNAL
  BreakerOpen: "breaker_open",                // INTERNAL
  Timeout: "timeout",
  WebhookSignatureInvalid: "webhook_signature_invalid",
  RateLimited: "rate_limited",
  InternalError: "internal_error",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const INTERNAL_ONLY: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.CostCeilingReached,
  ErrorCode.BreakerOpen,
]);

const HTTP_STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401, token_expired: 401, invalid_credentials: 401,
  forbidden: 403, email_unverified: 403, validation_failed: 400,
  invalid_partner_code: 400, not_found: 404, conflict: 409,
  consent_required: 403, deletion_in_progress: 403,
  subscription_required: 402, read_only_mode: 402, cap_hit: 429,
  provider_unavailable: 503, cost_ceiling_reached: 503, breaker_open: 503,
  timeout: 504, webhook_signature_invalid: 401, rate_limited: 429,
  internal_error: 500,
};

export type ErrorBody = {
  error: { code: ErrorCode; message: string; details?: Record<string, unknown> };
};

export function errorResponse(code: ErrorCode, message: string, details?: Record<string, unknown>): Response {
  const publicCode: ErrorCode = INTERNAL_ONLY.has(code) ? ErrorCode.ProviderUnavailable : code;
  const body: ErrorBody = { error: { code: publicCode, message, ...(details ? { details } : {}) } };
  return new Response(JSON.stringify(body), {
    status: HTTP_STATUS[publicCode],
    headers: { "content-type": "application/json" },
  });
}
```

**Invariants (must be asserted in `tests/unit/errors.test.ts`):**
- All 21 codes exported (D-10 example + PRD §5).
- `HTTP_STATUS` has an entry for every `ErrorCode` value (exhaustive).
- `errorResponse(CostCeilingReached, ...)` returns body `error.code === "provider_unavailable"` with HTTP 503.
- `errorResponse(BreakerOpen, ...)` returns body `error.code === "provider_unavailable"` with HTTP 503.
- Response body shape is `{ error: { code, message, details? } }` (D-11 nested shape).

### SP-2 Typed env validation (D-29, INFRA-16, INFRA-17)

**Source module:** `src/shared/config/env.ts`
**Reference:** Zod 4 docs + PRD §20 env table; RESEARCH §Pattern 5.
**Apply to:** every server-side module that reads `process.env.*` (boot-time). Client modules import only `clientEnv`.

```typescript
// src/shared/config/env.ts — fail-fast at module load; server/client split by NEXT_PUBLIC_ prefix
import { z } from "zod";

const optional = (schema: z.ZodString) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SENTRY_AUTH_TOKEN: optional(z.string().min(1)),
  SENTRY_ORG: optional(z.string().min(1)),
  SENTRY_PROJECT: optional(z.string().min(1)),
  IDENTIFICATION_PROVIDER_MODE: z.enum(["stub", "real"]).default("stub"),
  // Phase 4+: INNGEST_*, RESEND_*, STRIPE_*, PLANTID_API_KEY, LLM_*, VAPID_* (add schemas when introduced)
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: optional(z.string().url()),
  NEXT_PUBLIC_POSTHOG_KEY: optional(z.string().min(1)),
  NEXT_PUBLIC_POSTHOG_HOST: optional(z.string().url()),
});

export const serverEnv = serverSchema.parse(process.env);
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});
```

**Invariants (`tests/unit/env.test.ts`):**
- `IDENTIFICATION_PROVIDER_MODE` rejects anything other than `stub` / `real` (INFRA-16).
- Empty-string `NEXT_PUBLIC_SENTRY_DSN` parses as `undefined` (D-19 — local posture).
- Missing `DATABASE_URL` throws on module load with a readable error.

### SP-3 Sentry scrub helpers (D-22, LGPD-13, C-24)

**Source module:** `src/shared/telemetry/sentry-client.ts` (misnamed — it's the **shared** scrub helper consumed by all three `sentry.{server,edge,client}.config.ts` init files; planner may rename to `src/shared/telemetry/sentry-scrub.ts` if desired).
**Reference:** Sentry 10.48 `beforeSend`/`beforeBreadcrumb` filter docs + PRD §13.7; RESEARCH §Pattern 6.
**Apply to:** `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/sentry.client.config.ts`.

```typescript
// src/shared/telemetry/sentry-scrub.ts (or sentry-client.ts per RESEARCH tree)
// Shared scrub helpers — imported by sentry.server/edge/client.config.ts
// Source: Sentry Next.js filtering docs + PRD §13.7 + CLAUDE.md C-24

const SCRUB_FIELDS = [
  "authorization", "cookie", "email", "password", "token", "photo_url",
] as const;

const IDENTIFICATION_PATH = /\/api\/v1\/identifications(\/|$)/;

export function scrubHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = (SCRUB_FIELDS as readonly string[]).includes(k.toLowerCase()) ? "[scrubbed]" : v;
  }
  return out;
}

export function scrubObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(scrubObject);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = (SCRUB_FIELDS as readonly string[]).includes(k.toLowerCase()) ? "[scrubbed]" : scrubObject(v);
  }
  return out;
}

export function makeBeforeSend() {
  return (event: any) => {
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    if (event.request) {
      event.request.headers = scrubHeaders(event.request.headers);
      event.request.cookies = undefined;
      if (event.request.url && IDENTIFICATION_PATH.test(event.request.url)) {
        event.request.data = undefined; // LGPD-13 body drop
      } else {
        event.request.data = scrubObject(event.request.data);
      }
    }
    if (event.extra) event.extra = scrubObject(event.extra);
    if (event.contexts) event.contexts = scrubObject(event.contexts);
    return event;
  };
}

export function makeBeforeBreadcrumb() {
  return (breadcrumb: any) => {
    if (breadcrumb.data) breadcrumb.data = scrubObject(breadcrumb.data);
    return breadcrumb;
  };
}
```

**Callsite (each `sentry.*.config.ts` is nearly identical):**

```typescript
// src/sentry.server.config.ts (mirror in edge + client)
import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, makeBeforeBreadcrumb } from "@shared/telemetry/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined, // D-19 — empty string == disabled
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN), // belt + suspenders
  sendDefaultPii: false,                                 // [L-2] current public API in 10.48
  release: process.env.SENTRY_RELEASE,                   // CI sets $GITHUB_SHA in Phase 12
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  denyUrls: [/\/_next\/static\//],
  beforeSend: makeBeforeSend(),
  beforeBreadcrumb: makeBeforeBreadcrumb(),
});
```

**Invariants (`tests/unit/sentry-scrub.test.ts` — LGPD-13 load-bearing):**
- `makeBeforeSend()({ request: { url: '/api/v1/identifications/x', data: { email, token, photo_url } } })` returns an event with `request.data === undefined`.
- All 6 forbidden fields are stripped from `request.headers`, `extra`, and `contexts` on non-identification paths.
- `event.user.email` is always deleted regardless of path.

### SP-4 PostHog hand-rolled providers (D-21, L-3)

**Source modules:** `src/shared/telemetry/posthog-client.ts` + `src/shared/telemetry/posthog-server.ts`
**Reference:** `posthog-js@1.368.0` init docs + `posthog-node@5.29.7` README; RESEARCH §Pattern 7.
**Apply to:** `src/app/layout.tsx` (calls `initPostHog` client-side), `src/app/api/v1/_diagnostics/ping/route.ts` (calls `getPostHog()` server-side).

```typescript
// src/shared/telemetry/posthog-client.ts
import posthog from "posthog-js";
import { clientEnv } from "@shared/config/env";

export function initPostHog() {
  if (!clientEnv.NEXT_PUBLIC_POSTHOG_KEY) return; // D-20: disabled locally by empty key
  posthog.init(clientEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    autocapture: false,                 // D-21
    capture_pageview: false,            // explicit taxonomy only (Phase 13 names events)
    capture_pageleave: false,
    disable_session_recording: true,    // D-21 posture; ANALYTICS-v2-01 lifts later
    persistence: "localStorage+cookie",
    person_profiles: "identified_only", // LGPD posture — no anonymous profiles
  });
}
```

```typescript
// src/shared/telemetry/posthog-server.ts
import { PostHog } from "posthog-node";
import { clientEnv } from "@shared/config/env";

let _client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!clientEnv.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!_client) {
    _client = new PostHog(clientEnv.NEXT_PUBLIC_POSTHOG_KEY, {
      host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,       // flush immediately for diagnostics; Phase 13 tunes
      flushInterval: 0,
    });
  }
  return _client;
}
```

### SP-5 Diagnostics-route guard (D-27)

**Applied to:** `src/app/__diag/layout.tsx` (server guard) AND `src/app/api/v1/_diagnostics/ping/route.ts` (handler guard). Both must refuse rendering/serving when `IDENTIFICATION_PROVIDER_MODE !== "stub"`.

```typescript
// src/app/__diag/layout.tsx — server guard wrapping the client diag page
import { notFound } from "next/navigation";
import { serverEnv } from "@shared/config/env";

export default function DiagLayout({ children }: { children: React.ReactNode }) {
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") notFound();
  return children;
}
```

```typescript
// src/app/api/v1/_diagnostics/ping/route.ts — same gate at the handler entry
export async function POST(request: Request) {
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") {
    return errorResponse(ErrorCode.NotFound, "not found");
  }
  // ...
}
```

---

## Per-File Pattern Assignments

### `.nvmrc` (config)

**Upstream reference:** Node.js LTS convention; `.nvmrc` spec.
**Purpose:** Pin Node 22 LTS (D-01).

**Excerpt:**
```
22
```
(or an exact patch version, e.g. `22.14.0` — lock the latest 22 LTS patch at scaffold time per Claude's Discretion item.)

---

### `.gitignore` (extend existing)

**Upstream reference:** Next.js 16 starter + GitHub default Node `.gitignore`.
**Purpose:** Extend current `.DS_Store`-only file (CONTEXT.md §Code Context).

**Entries to add (minimum set):**
```
# deps
node_modules/

# next
.next/
out/
next-env.d.ts

# test + coverage
coverage/
playwright-report/
test-results/
.vitest-cache/

# env (NEVER commit .env — real creds live there)
.env
.env.local
.env.*.local

# supabase CLI
supabase/.temp/
supabase/.branches/

# OS
.DS_Store
```

---

### `.env.example` (config, D-30, INFRA-17)

**Upstream reference:** PRD §20 env var table.
**Purpose:** Every PRD §20 var listed with DUMMY values; grouped by phase-of-first-use.

**Shape (variable names only — copy verbatim from `.env` key set, use `DUMMY-CHANGE-ME` for values):**
```dotenv
# ──────────────── Phase 1 (infrastructure) ────────────────
DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres
DATABASE_POOL_URL=postgres://postgres:postgres@localhost:54322/postgres
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=DUMMY-CHANGE-ME
SUPABASE_SERVICE_ROLE_KEY=DUMMY-CHANGE-ME
SUPABASE_PROJECT_REF=DUMMY-CHANGE-ME
SUPABASE_ACCESS_TOKEN=DUMMY-CHANGE-ME
IDENTIFICATION_PROVIDER_MODE=stub

# ──────────────── Phase 1 (observability — CI only) ────────────────
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# ──────────────── Phase 4 (async + email) ────────────────
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# ──────────────── Phase 12 (deploy) ────────────────
VERCEL_ORG_ID=
VERCEL_PROJECT_ID=
VERCEL_TOKEN=
```

**Invariants (`tests/unit/env-example.test.ts`):** each key from `.env` appears in `.env.example`; no values matching `^(sk_live_|eyJ|[A-Za-z0-9/+]{40,}=*$)` (Pitfall 8 guard).

---

### `package.json` (config, D-01, D-02, D-05)

**Upstream reference:** Stack install block in RESEARCH §Standard Stack + Husky 9 + lint-staged + Conventional Commits.

**Key fields (verbatim from RESEARCH §Code Examples):**
```json
{
  "name": "folhario",
  "private": true,
  "engines": { "node": ">=22 <23" },
  "packageManager": "pnpm@9.x.y",
  "scripts": {
    "prepare": "husky",
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test:unit": "pnpm exec vitest --run --project=unit",
    "test:integration": "pnpm exec vitest --run --project=integration",
    "test:e2e": "playwright test",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:sync-env": "bash scripts/sync-supabase-env.sh",
    "supabase": "supabase"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs}": ["prettier --write", "eslint --fix"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

**Dependency pins (runtime):** `next@16.2.3` `react@19.2.5` `react-dom@19.2.5` `@serwist/next@9.5.7` `serwist@9.5.7` `@sentry/nextjs@10.48.0` `posthog-js@1.368.0` `posthog-node@5.29.7` `next-intl@4.9.1` `zod@4`.

**Dependency pins (dev):** `typescript@6` `@types/node@22` `@types/react@19` `@types/react-dom@19` `eslint@10` `eslint-config-next@16.2.3` `eslint-config-prettier@10` `prettier@3` `vitest@4.1.4` `@vitest/ui@4` `vite-tsconfig-paths` `@playwright/test@1.59.1` `husky@9` `lint-staged@16` `@commitlint/cli@20` `@commitlint/config-conventional@20` `supabase@2.95.0`.

---

### `tsconfig.json` (config, D-06, D-07, D-08)

**Upstream reference:** Next 16 default `tsconfig.json` + INFRA-01 strict minimum.

**Load-bearing flags:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@contexts/*": ["./src/contexts/*"],
      "@shared/*": ["./src/shared/*"],
      "@i18n/*": ["./src/i18n/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**NOTE on R-1:** the third alias `@i18n/*` resolves the Pattern 2 vs tree-location inconsistency. If the planner prefers to drop this alias, rewrite `src/proxy.ts` imports to use relative paths — **do not leave the `@shared/config/i18n-routing` import from RESEARCH Pattern 2 as-is.**

---

### `eslint.config.mjs` (config, D-03)

**Upstream reference:** `eslint-config-next@16.2.4` flat-config docs + `eslint-config-prettier@10` pairing.

```javascript
// eslint.config.mjs
import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

export default [
  ...next(),
  prettier,
];
```

---

### `.prettierrc` (config, D-03)

**Upstream reference:** Prettier 3 defaults (team may tune; keep minimal at Phase 1).

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

---

### `.commitlintrc.json` (config, D-04)

**Upstream reference:** `@commitlint/config-conventional` 20.x.

```json
{ "extends": ["@commitlint/config-conventional"] }
```

---

### `next.config.ts` (build config)

**Upstream reference:** `@serwist/next@9.5.7` `withSerwistInit` + `@sentry/nextjs@10.48.0` `withSentryConfig`. See RESEARCH §Pattern 1 for the composed wrapper (Serwist OUTER, Sentry INNER).

```typescript
// next.config.ts — Serwist OUTER, Sentry INNER; Phase 1 source maps configured but NOT uploaded (Phase 12)
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: true,
  scope: "/",
  swUrl: "/sw.js",
  disable: process.env.NODE_ENV === "development", // D-13 skeleton only
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSentryConfig(withSerwist(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Turbopack post-build hook is implicit in @sentry/nextjs 10.13+ — no inline upload.
});
```

---

### `vitest.config.ts` (test config, D-25)

**Upstream reference:** Vitest 4 `test.projects` (replaces deprecated `workspace` key).

See RESEARCH §Code Examples verbatim. Key points:
- `plugins: [tsconfigPaths()]` — resolves `@contexts/*`, `@shared/*`, `@i18n/*`.
- Two projects: `unit` (tests/unit/**/*.test.ts) and `integration` (tests/integration/**/*.integration.test.ts, `testTimeout: 30_000`).
- Integration project hits REAL Postgres (PRD §19 — zero DB mocking).

---

### `playwright.config.ts` (test config, D-26, D-27)

**Upstream reference:** Playwright 1.59 `webServer` + Chromium-only.

See RESEARCH §Code Examples verbatim. Key points:
- `webServer.command: "pnpm start"` (production build — not `pnpm dev`).
- `webServer.url: "http://localhost:3000/__diag"` (exists only in `stub` mode; page-guard + handler-guard both hit).
- `webServer.env.IDENTIFICATION_PROVIDER_MODE: "stub"` — diagnostics routes active in webServer only.
- Single project: `chromium` (D-26; WebKit/Firefox deferred).
- `retries: process.env.CI ? 2 : 0`, `forbidOnly: !!process.env.CI`.

---

### `.husky/pre-commit` (git hook, D-04)

**Upstream reference:** Husky 9 plain-script idiom (Pitfall 4 — NOT the legacy `husky install` pattern).

```bash
pnpm lint-staged
```

### `.husky/commit-msg` (git hook, D-04)

```bash
pnpm exec commitlint --edit "$1"
```

Setup is via `pnpm dlx husky init` once, then the `prepare: "husky"` script in `package.json` keeps hooks registered.

---

### `.github/workflows/ci.yml` (CI config, D-25, D-26, D-28, INFRA-12)

**Upstream reference:** GitHub Actions services + Playwright CI recipe.

See RESEARCH §Code Examples verbatim. Key points:
- `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` (D-28).
- `services.postgres.image: postgres:17-alpine` (D-25 — parity with local Supabase).
- pnpm store cache keyed on `pnpm-lock.yaml` (D-28).
- Playwright browser cache keyed on `pnpm-lock.yaml` (D-28).
- Steps: `lint` → `typecheck` → `test:unit` → `test:integration` → `build` → `playwright install chromium` → `test:e2e`.
- Build step does NOT set `SENTRY_AUTH_TOKEN` (Pitfall 7 — source-map upload runs in Phase 12's `deploy-production.yml` only).
- E2E step sets `NEXT_PUBLIC_SENTRY_DSN` + `NEXT_PUBLIC_POSTHOG_KEY` from secrets (CI-only verification per D-19/D-20).
- `pnpm test:unit -- --run` explicit (Pitfall: never run watch mode).
- Single workflow in Phase 1; deploy workflows deferred to Phase 12.

---

### `scripts/sync-supabase-env.sh` (script, D-18)

**Upstream reference:** Supabase CLI `supabase status -o env --override-name`.

See RESEARCH §Code Examples verbatim. Key points:
- Writes `.env.local` (NEVER `.env`).
- Maps CLI output keys → PRD §20 names (`api.url → NEXT_PUBLIC_SUPABASE_URL`, etc.).
- Computes `DATABASE_POOL_URL` from `DATABASE_URL` (R-3 reconciliation — locally identical).
- Precondition: `supabase start` has run; script exits non-zero if Docker/CLI not ready.

---

### `supabase/config.toml` (config, D-16)

**Upstream reference:** `supabase init` CLI output.
**Purpose:** Pin Postgres 17 for local stack (parity with CI `postgres:17-alpine`).

**Planner note:** this file is CLI-generated. Phase 1 task is `pnpm dlx supabase@2.95.0 init` (if not already present) then edit the generated `supabase/config.toml` to lock `[db].major_version = 17`. The repo already has `supabase/.branches/` + `supabase/.temp/` (from prior `supabase init`) but no `config.toml`.

---

### `public/manifest.webmanifest` (static asset, D-14)

**Upstream reference:** W3C Web App Manifest.

```json
{
  "name": "Folhário",
  "short_name": "Folhário",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#FFFFFF",
  "background_color": "#FFFFFF"
}
```

Phase 3 replaces with Paper Cream icon set (icons intentionally absent per D-14).

---

### `src/proxy.ts` **[L-1]** (middleware, request-response)

**Upstream reference:** Next 16 proxy file-convention docs + next-intl 4.9 `proxy.ts` integration. See RESEARCH §Pattern 2.

**Important:** this file is named `proxy.ts` (NOT `middleware.ts`), and the default export is a function named `proxy` (NOT `middleware`). The Next 16 codemod `npx @next/codemod@latest next-16 .` performs this rename if any stray `middleware.ts` is created by accident.

```typescript
// src/proxy.ts — Next 16 file convention
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@i18n/routing"; // or relative './i18n/routing' if no @i18n alias (R-1)

const handleI18n = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = handleI18n(request);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)", // Pitfall 9 — exclude /api
};
```

**Invariants (`tests/e2e/security-headers.spec.ts`):** GET `/` returns all three headers with exact values (HSTS: `max-age=63072000; includeSubDomains; preload`, XFO: `DENY`, XCTO: `nosniff`).

---

### `src/instrumentation.ts` (boot hook)

**Upstream reference:** Next 16 `instrumentation.ts` + `@sentry/nextjs` 10.48 manual setup.

```typescript
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { onRequestError } from "@sentry/nextjs";
```

Browser initialization happens via `src/sentry.client.config.ts` loaded by Next 16 automatically (naming convention) or via an import in `src/app/layout.tsx`.

---

### `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/sentry.client.config.ts` **[R-2]**

All three consume `makeBeforeSend()` / `makeBeforeBreadcrumb()` from `src/shared/telemetry/sentry-scrub.ts` (SP-3). The server + edge use runtime-neutral options; the client additionally sets `replaysSessionSampleRate: 0` (explicit disable) to honor D-21 posture.

Client-specific excerpt:
```typescript
// src/sentry.client.config.ts
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
```

---

### `src/i18n/routing.ts` **[R-1]** (config)

**Upstream reference:** `next-intl/routing` `defineRouting` (as-needed prefix per D-15). See RESEARCH §Pattern 3.

```typescript
// src/i18n/routing.ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt-BR"],
  defaultLocale: "pt-BR",
  localePrefix: "as-needed", // D-15: pt-BR at root, future locales get /en-US/...
});
```

### `src/i18n/request.ts` (server config)

```typescript
// src/i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && routing.locales.includes(requested as any)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

---

### `src/messages/pt-BR.json` (content)

**Upstream reference:** next-intl messages JSON format.

```json
{}
```

Empty at Phase 1 (D-13/D-14 — content-heavy work is Phase 3).

---

### `src/app/layout.tsx` (component, request-response)

**Upstream reference:** Next 16 App Router root layout + `NextIntlClientProvider` + Serwist service worker registration.

**Key elements:**
- `<html lang="pt-BR">` — CLAUDE.md constraint.
- Wrap children in `NextIntlClientProvider` (locale from next-intl server helper).
- Invoke `initPostHog()` (SP-4) from a client effect component.
- Ensure `src/sentry.client.config.ts` is imported (Next 16 auto-loads by convention).

---

### `src/app/sw.ts` (service worker source, D-13)

**Upstream reference:** Serwist 9.5 `sw.ts` skeleton.

```typescript
// src/app/sw.ts — Serwist skeleton (no precache per D-13)
import { Serwist } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope {
    // @serwist/next injects __SW_MANIFEST; unused here since precacheEntries: []
    __SW_MANIFEST: any[];
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
});

serwist.addEventListeners();
```

Phase 3 extends with runtime caching, offline fallback, and the app-update toast.

---

### `src/app/__diag/layout.tsx` + `page.tsx` (components, D-27)

**Upstream reference:** D-27 + SP-5 guard. See RESEARCH §Pattern 8 for `page.tsx` verbatim.

Key excerpt (`page.tsx`):
```typescript
"use client";
import { useEffect } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";

export default function DiagPage() {
  useEffect(() => {
    posthog.capture("$diagnostics_client_ping", { source: "playwright-smoke" });
    Sentry.captureException(
      new Error("Playwright diagnostics client error"),
      { extra: { email: "should-be-scrubbed@example.com", token: "should-be-scrubbed" } },
    );
  }, []);
  return <main>ok</main>;
}
```

---

### `src/app/api/v1/_diagnostics/ping/route.ts` (route handler, D-27)

**Upstream reference:** Next 16 `route.ts` + Sentry `withScope` pattern for synthetic `event.request.url` injection. See RESEARCH §Pattern 8 verbatim.

**Load-bearing excerpt:**
```typescript
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { serverEnv } from "@shared/config/env";
import { getPostHog } from "@shared/telemetry/posthog-server";
import { errorResponse, ErrorCode } from "@shared/config/errors";

export async function POST(request: Request) {
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") {
    return errorResponse(ErrorCode.NotFound, "not found");
  }

  const ph = getPostHog();
  if (ph) {
    ph.capture({
      distinctId: "ci-playwright",
      event: "$diagnostics_server_ping",
      properties: { runtime: process.env.NEXT_RUNTIME ?? "nodejs" },
    });
    await ph.shutdown();
  }

  const bodyText = await request.text().catch(() => "");
  Sentry.withScope((scope) => {
    scope.addEventProcessor((event) => {
      event.request = {
        ...event.request,
        url: "http://localhost:3000/api/v1/identifications/_diag-synth",
        data: bodyText || { email: "scrub-me@example.com", token: "scrub-me" },
        method: "POST",
      };
      return event;
    });
    Sentry.captureException(new Error("Playwright diagnostics server error"));
  });

  return NextResponse.json({ ok: true });
}
```

---

### `src/shared/config/env.ts` — see SP-2

### `src/shared/config/errors.ts` — see SP-1

### `src/shared/telemetry/sentry-scrub.ts` — see SP-3

### `src/shared/telemetry/posthog-client.ts` + `posthog-server.ts` — see SP-4

---

### `.gitkeep` scaffold files (38 total)

**Upstream reference:** PRD §2 bounded-context tree; CONTEXT.md D-09.

**Layout:**
- 35 under `src/contexts/<7 contexts>/<5 layers>/.gitkeep`:
  - Contexts: `iam`, `catalog`, `species-care`, `identification`, `reminders`, `billing`, `notifications`
  - Layers: `domain`, `application`, `infrastructure`, `api`, `inngest`
- 3 under `src/shared/{db,events,adapters}/.gitkeep` (note: `config/` and `telemetry/` get real files immediately, so their `.gitkeep` may be omitted after real files land)

**One-shot scaffold (lift verbatim from RESEARCH):**
```bash
mkdir -p src/shared/{db,events,adapters,config,telemetry}
for ctx in iam catalog species-care identification reminders billing notifications; do
  for layer in domain application infrastructure api inngest; do
    mkdir -p "src/contexts/$ctx/$layer"
    touch "src/contexts/$ctx/$layer/.gitkeep"
  done
done
for dir in db events adapters; do touch "src/shared/$dir/.gitkeep"; done
```

**Invariant (`tests/unit/scaffold.test.ts`):** all 38 paths exist on disk (INFRA-02 — the RESEARCH spec says 40 but the real count after stripping `config/`/`telemetry/` `.gitkeep`s once real files land is 38; the scaffold script creates 40 initially, real files overwrite 2).

---

### Wave 0 Test Files

Same RESEARCH §Wave 0 gap list — planner must land these BEFORE implementation tasks. Pattern for each:

| Test file | Reference / role | Asserts |
|-----------|-------------------|---------|
| `tests/unit/scaffold.test.ts` | Vitest `describe`/`test`, `fs.existsSync` | All 38 `.gitkeep` paths exist |
| `tests/unit/env.test.ts` | Vitest + Zod's `safeParse` | Rejects invalid `IDENTIFICATION_PROVIDER_MODE`; empty DSN treated as undefined |
| `tests/unit/env-example.test.ts` | Vitest + fs.readFileSync | Every `.env` key appears in `.env.example`; no secret-like values |
| `tests/unit/errors.test.ts` | Vitest + exhaustiveness check | All 21 codes + HTTP map + `cost_ceiling_reached/breaker_open → provider_unavailable` |
| `tests/unit/sentry-scrub.test.ts` | Vitest calling `makeBeforeSend()` directly | **Load-bearing LGPD-13:** `request.data === undefined` on identification paths; all 6 forbidden fields scrubbed elsewhere |
| `tests/integration/postgres-connection.integration.test.ts` | Vitest + `postgres-js` | `SELECT 1` over `DATABASE_POOL_URL` (placeholder for Phase 2) |
| `tests/e2e/security-headers.spec.ts` | Playwright `request.get('/')` | HSTS/XFO/XCTO present with exact values |
| `tests/e2e/diagnostics-sentry.spec.ts` | Playwright `page.route(/sentry\.io/)` interceptor | ≥2 envelopes (client + server); no forbidden-field values in raw body |
| `tests/e2e/diagnostics-posthog.spec.ts` | Playwright `page.route(/posthog\.com/)` interceptor | Events include `$diagnostics_client_ping` + `$diagnostics_server_ping` |

See RESEARCH §Code Examples for verbatim Sentry + PostHog E2E specs.

---

## No Analog Found (within this repo)

Every file listed above is NEW — there is no in-repo analog because this is the founding phase. Upstream references substitute:

| Upstream ecosystem | Version pinned | Use for |
|---------------------|----------------|---------|
| Next.js 16 docs | 16.2.3 | `proxy.ts`, `instrumentation.ts`, `route.ts`, `layout.tsx`, `next.config.ts`, `sw.ts` integration |
| `@sentry/nextjs` 10.48 docs | 10.48.0 | `sentry.{server,edge,client}.config.ts`, `withSentryConfig` in `next.config.ts` |
| `posthog-js` / `posthog-node` docs | 1.368.0 / 5.29.7 | `posthog-client.ts`, `posthog-server.ts` |
| `next-intl` 4.9 docs | 4.9.1 | `src/i18n/routing.ts`, `request.ts`, `proxy.ts` integration |
| `@serwist/next` docs | 9.5.7 | `next.config.ts` wrapper + `src/app/sw.ts` |
| Vitest 4 docs | 4.1.4 | `vitest.config.ts` (`projects` key) |
| Playwright 1.59 docs | 1.59.1 | `playwright.config.ts`, E2E specs |
| Husky 9 docs | 9.1.7 | `.husky/*` |
| Supabase CLI docs | 2.95.0 | `scripts/sync-supabase-env.sh`, `supabase/config.toml` |
| PRD §5 + §13.7 + §20 | docs/CAVE-PRD.md | Errors, scrubbing fields, env table |

---

## Metadata

**Analog search scope:** whole repo (`/Users/machado/Projects/folhario/`); only `.env`, `.gitignore`, `docs/`, `.claude/` (tooling), `supabase/.branches` + `supabase/.temp` (CLI scratch) exist.
**Files scanned:** ~30 (all extra-repo dirs excluded; none contain source code).
**Pattern extraction date:** 2026-04-23
**Consumed upstream doc snapshots:** via `01-RESEARCH.md` (verified 2026-04-23, live docs + Context7) — no re-fetch required for PLAN.md generation.
