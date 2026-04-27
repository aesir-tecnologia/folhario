# Phase 4: IAM — Auth, Verification, Consent — Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** ~70 net-new + 4 modified Phase 1 files
**Analogs found:** 9 in-repo direct analogs / ~70 (most files are first-of-kind in this codebase)

---

## TL;DR for the planner

Phase 4 is a **greenfield IAM phase landing on a near-empty repo**. Phase 1 has shipped (errors registry, env, telemetry, i18n, ONE diagnostics route, vitest projects, playwright). Phase 2 has NOT shipped. Phase 3 has NOT shipped. As a result:

1. **9 of ~70 files have a real in-repo analog** — every API route handler shares shape with `src/app/api/v1/diagnostics/ping/route.ts`; the env additions extend `src/shared/config/server-env.ts`; tests follow `tests/unit/errors.test.ts` and `tests/integration/diagnostics-server-probe.integration.test.ts` shapes.
2. **The other ~60 files are first-of-kind for this repo.** Their pattern source is **the verified excerpts in `04-RESEARCH.md` §"Architecture Patterns" (Patterns 1–12)**, not in-repo analogs. The planner cites RESEARCH.md line numbers explicitly.
3. **Two hard prerequisite gates exist** (CONTEXT.md and UI-SPEC.md both call them out):
   - **Phase 2 prerequisite gate** — Phase 4 depends on AuthAdapter (D-32), `users` schema, `consent_logs`, `policy_versions.is_current`, `subscriptions`, `idempotency_keys`, RLS posture, `auth.users → public.users` insert trigger, API-aware proxy. Phase 2 is `0/10` complete (RESEARCH.md `## Phase 2 Inheritance Audit`). Plan-phase MUST add a "Wave 0" gate task.
   - **Phase 3 prerequisite gate** — UI-SPEC.md:38 explicitly flags Phase 3 (Design System & App Shell) hasn't run. No design tokens, no typography setup, no focus-ring, no bottom-nav primitives, no `(auth)` or `(app)` route group conventions exist yet. Every Phase 4 UI file (`src/app/auth/*`, `src/app/settings/*`, the `<UnverifiedBlocker />` server component) has NO in-repo UI primitive analog. The planner must either gate Phase 4 on Phase 3, hand-roll primitives within UI-SPEC §17 tokens, or surface this to the orchestrator.

The single largest risk to silently mis-plan: treating diagnostics route as a sufficient analog for all API routes. It is the right shape only for "verb + return JSON" — it lacks Zod body validation, auth checks, DB transactions, idempotency, and Supabase admin orchestration.

---

## File Classification

Format: `path` (role, data-flow) → analog status

### API route handlers (`src/app/api/v1/iam/**` and `src/app/auth/**`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/v1/iam/signup/route.ts` | route handler | request-response (POST) | `src/app/api/v1/diagnostics/ping/route.ts` | shape-only |
| `src/app/api/v1/iam/login/route.ts` | route handler | request-response | `src/app/api/v1/diagnostics/ping/route.ts` | shape-only |
| `src/app/api/v1/iam/logout/route.ts` | route handler | request-response | `src/app/api/v1/diagnostics/ping/route.ts` | shape-only |
| `src/app/api/v1/iam/resend-verification/route.ts` | route handler | request-response + Inngest emit | `src/app/api/v1/diagnostics/ping/route.ts` | shape-only |
| `src/app/api/v1/iam/password/reset-request/route.ts` | route handler | request-response + Inngest emit (always-200) | `src/app/api/v1/diagnostics/ping/route.ts` | shape-only |
| `src/app/api/v1/iam/password/reset/route.ts` | route handler | request-response | `src/app/api/v1/diagnostics/ping/route.ts` | shape-only |
| `src/app/api/v1/iam/me/route.ts` | route handler | CRUD (GET/PATCH) | `src/app/api/v1/diagnostics/ping/route.ts` | shape-only |
| `src/app/api/v1/iam/me/password/route.ts` | route handler | request-response (PATCH) | `src/app/api/v1/diagnostics/ping/route.ts` | shape-only |
| `src/app/auth/verify/route.ts` | route handler | request-response (GET → redirect) | `src/app/api/v1/diagnostics/ping/route.ts` | partial (redirect not JSON) |
| `src/app/auth/callback/route.ts` | route handler | request-response (GET → redirect) | NONE — first OAuth callback in repo | RESEARCH.md Pattern 12 |
| `src/app/api/inngest/route.ts` | route handler / Inngest serve | request-response + multi-method | NONE — first Inngest serve handler | RESEARCH.md Pattern 1 |

### Frontend pages (`src/app/auth/*`, `src/app/settings/*`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/auth/signup/page.tsx` | server component (form page) | server-rendered + client interactivity | `src/app/page.tsx` | none-meaningful (Phase 1 placeholder) |
| `src/app/auth/login/page.tsx` | server component | same | `src/app/page.tsx` | none-meaningful |
| `src/app/auth/forgot-password/page.tsx` | server component | same | `src/app/page.tsx` | none-meaningful |
| `src/app/auth/reset/page.tsx` | server component | same | `src/app/page.tsx` | none-meaningful |
| `src/app/auth/oauth-complete/page.tsx` | server component | same | `src/app/page.tsx` | none-meaningful |
| `src/app/settings/layout.tsx` | server component (layout) | server-rendered shell | `src/app/layout.tsx` | shape-only |
| `src/app/settings/page.tsx` | server component (redirect) | redirect to `/settings/account` | NONE | first redirect-only page |
| `src/app/settings/[section]/page.tsx` | server component | dynamic segment | NONE | first dynamic segment |
| `src/contexts/iam/api/components/unverified-blocker.tsx` | server component | static | NONE — first UI server component | UI-SPEC §5 + Pattern 11 |

### Layout / proxy (modified Phase 1 files)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/layout.tsx` (MODIFY) | server component | server-rendered + auth gate | `src/app/layout.tsx` (current) | exact (extend it) |
| `src/proxy.ts` (MODIFY) | middleware | request-pre-handler | `src/proxy.ts` (current) | exact (extend) — but Phase 2 D-34 was supposed to make this API-aware first |

### IAM domain layer (`src/contexts/iam/domain/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/contexts/iam/domain/schemas.ts` | Zod schemas (drizzle-zod-derived) | schema-only | NONE | first Drizzle schema |
| `src/contexts/iam/domain/events.ts` | event constants/types | constants | NONE | first domain events |

### IAM application use-cases (`src/contexts/iam/application/`)

All ~10 use-cases (`signup.ts`, `login.ts`, `logout.ts`, `verify-email.ts`, `resend-verification.ts`, `request-password-reset.ts`, `consume-password-reset.ts`, `change-password.ts`, `oauth-complete.ts`, `current-user.ts`, `require-verified.ts`):

| Role | Data Flow | Analog | Match Quality |
|------|-----------|--------|---------------|
| application service / use-case | orchestration (Supabase Auth → DB tx → Inngest) | NONE — `src/contexts/*/application/` are all empty `.gitkeep` | RESEARCH.md Patterns 5–7, 11; Phase 2 D-32 AuthAdapter is the natural integration but hasn't shipped |

### IAM infrastructure (`src/contexts/iam/infrastructure/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/contexts/iam/infrastructure/db/schema.ts` | Drizzle schema | schema-only | NONE | first Drizzle file |
| `src/contexts/iam/infrastructure/db/users.ts` | repository | CRUD | NONE | first repository |
| `src/contexts/iam/infrastructure/db/consent-logs.ts` | repository | insert-only | NONE | first repository |
| `src/contexts/iam/infrastructure/db/policy-versions.ts` | repository | read-only | NONE | first repository |
| `src/contexts/iam/infrastructure/db/verification-tokens.ts` | repository | CRUD (mint/consume/revoke) | NONE | first repository |
| `src/contexts/iam/infrastructure/db/reset-tokens.ts` | repository | CRUD | NONE | first repository |
| `src/contexts/iam/infrastructure/db/auth-throttle.ts` | repository | UPSERT-RETURNING | NONE | RESEARCH.md Pattern 8 |
| `src/contexts/iam/infrastructure/db/subscriptions.ts` | repository | insert-only | NONE | first repository |
| `src/contexts/iam/infrastructure/supabase-server.ts` | Supabase SSR client wrapper | adapter | NONE | RESEARCH.md Pattern 5 |
| `src/contexts/iam/infrastructure/supabase-admin.ts` | Supabase admin client wrapper | adapter | NONE | RESEARCH.md Pattern 6 |
| `src/contexts/iam/infrastructure/supabase-auth-adapter.ts` | extends Phase 2 AuthAdapter | adapter | NONE — Phase 2 D-32 hasn't shipped | RESEARCH.md Pattern 5+6 fold-in |
| `src/contexts/iam/infrastructure/posthog-bridge.ts` | telemetry bridge | event-emit | `src/shared/telemetry/posthog-server.ts` (consumer pattern in `src/app/api/v1/diagnostics/ping/route.ts:12-20`) | role-match |

### Inngest infrastructure

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/shared/inngest/client.ts` | SDK singleton | client init | NONE | RESEARCH.md Pattern 1 |
| `src/shared/inngest/registry.ts` | barrel-style registry | constants | NONE | RESEARCH.md Pattern 1 |
| `src/contexts/iam/inngest/functions.ts` | Inngest function exports | array | NONE | RESEARCH.md Pattern 2 + 4 |
| `src/contexts/notifications/inngest/functions.ts` | Inngest function (REAL impl) | event-driven | NONE | RESEARCH.md Pattern 3 |
| `src/contexts/care-guide/inngest/functions.ts` (STUB) | Inngest function (stub) | event-driven (no-op) | NONE | RESEARCH.md Pattern 2 |
| `src/contexts/reminders/inngest/functions.ts` (STUB) | Inngest function (stub) | event-driven (no-op) | NONE | RESEARCH.md Pattern 2 |
| `src/contexts/billing/inngest/functions.ts` (STUB×2) | Inngest function (stub) | event-driven (no-op) | NONE | RESEARCH.md Pattern 2 |
| `src/contexts/identification/inngest/functions.ts` (none in P4) | (empty array export) | n/a | NONE | RESEARCH.md Pattern 1 |
| `src/contexts/species-care/inngest/functions.ts` (STUB) | Inngest function (stub) | n/a | NONE | RESEARCH.md Pattern 2 |

### Email pipeline (`src/contexts/notifications/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/contexts/notifications/domain/events.ts` | event types | constants | NONE | first |
| `src/contexts/notifications/application/send-email.ts` | use-case (template registry → render) | transform | NONE | RESEARCH.md Pattern 3 |
| `src/contexts/notifications/infrastructure/resend-adapter.ts` | adapter | external-API send | NONE | RESEARCH.md Pattern 10 |
| `src/contexts/notifications/infrastructure/email-templates/verification.tsx` | React component (email) | render-only | NONE | RESEARCH.md Pattern 9 + UI-SPEC §7 |
| `src/contexts/notifications/infrastructure/email-templates/password-reset.tsx` | React component (email) | render-only | NONE | RESEARCH.md Pattern 9 + UI-SPEC §7 |

### Shared utilities

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/shared/config/server-env.ts` (MODIFY) | env config | constants | `src/shared/config/server-env.ts` (current) | exact (extend Zod schema) |
| `src/shared/config/errors.ts` (NO CHANGE) | error registry | constants | n/a — already complete (Phase 1 closed registry) | n/a |
| `src/shared/api/auth.ts` | helper (`requireApiUser`, `requireVerifiedUser`) | request-pre-check | NONE — Phase 2 D-32 hasn't shipped a base `requireApiUser` | RESEARCH.md Pattern 11 |
| `src/shared/api/throttle.ts` | helper (per-IP throttle middleware) | request-pre-check | NONE | RESEARCH.md Pattern 8 + D-12-15 |
| `src/shared/crypto/tokens.ts` | helper (mint/verify token) | pure | NONE | RESEARCH.md Pattern 7 |

### i18n strings

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/messages/pt-BR.json` (MODIFY: currently `{}`) | locale strings | constants | `src/messages/pt-BR.json` (current — empty) | exact (fill it) |

### Tests

All tests are NEW. RESEARCH.md `## Wave 0 Gaps` enumerates 17+ test files. Most have a Phase 1 analog by SHAPE only:

| Test type | Analog | Match Quality |
|-----------|--------|---------------|
| Unit (`tests/unit/iam-signup-schema.test.ts`, `tests/unit/tokens.test.ts`, `tests/unit/email-templates.test.ts`, `tests/unit/auth-throttle-math.test.ts`) | `tests/unit/errors.test.ts` (vitest `describe/it.each/expect` shape) | shape-only |
| Integration (every `tests/integration/iam-*.integration.test.ts`) | `tests/integration/diagnostics-server-probe.integration.test.ts` (vi.mock + dynamic import + Request constructor) AND `tests/integration/postgres-connection.integration.test.ts` (live Postgres pattern) | shape-only |
| E2E (`tests/e2e/iam-unverified-blocker.spec.ts`, `tests/e2e/settings-account.spec.ts`, `tests/e2e/iam-google-oauth.spec.ts`) | `tests/e2e/diagnostics-posthog.spec.ts` (Playwright `test`/`page.route`/`request.get` shape) | shape-only |
| Test fixture helpers (`tests/integration/fixtures/seed-policy-version.ts`, `tests/integration/fixtures/seed-user.ts`, `tests/integration/fixtures/mock-resend.ts`, `tests/integration/fixtures/mock-inngest.ts`, `tests/integration/setup-supabase-truncate.ts`) | NONE — first fixture helpers in repo | RESEARCH.md `## Wave 0 Gaps` |

### Drizzle migration

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `drizzle/migrations/XXXX_phase04_iam.sql` | migration | DDL | NONE — Phase 2 hasn't shipped any migrations | first migration in repo (assuming Phase 2 prereq drops first) |

---

## Pattern Assignments

For each file group, I cite (a) the closest in-repo analog with concrete excerpts, and (b) the authoritative RESEARCH.md pattern when the in-repo analog is shape-only or absent.

### Group 1: Every `/api/v1/iam/**/route.ts` and `/auth/verify/route.ts`

**Analog (shape only):** `src/app/api/v1/diagnostics/ping/route.ts:1-48`

**What you copy from the analog:**

`src/app/api/v1/diagnostics/ping/route.ts:1-6` (imports + path-alias convention; Phase 1 D-07 locks `@shared/*`):
```typescript
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { serverEnv } from "@shared/config/server-env";
import { getPostHog } from "@shared/telemetry/posthog-server";
import { errorResponse, ErrorCode } from "@shared/config/errors";
```

`src/app/api/v1/diagnostics/ping/route.ts:7-10` (handler signature + early-return error pattern):
```typescript
export async function POST(request: Request) {
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") {
    return errorResponse(ErrorCode.NotFound, "not found");
  }
```

`src/app/api/v1/diagnostics/ping/route.ts:12-20` (PostHog server-side capture pattern Phase 4 will reuse for `signup_completed`/`consent_granted`):
```typescript
const ph = getPostHog();
if (ph) {
  ph.capture({
    distinctId: "ci-playwright",
    event: "$diagnostics_server_ping",
    properties: { runtime: process.env.NEXT_RUNTIME ?? "nodejs" },
  });
  await ph.shutdown();
}
```

`src/app/api/v1/diagnostics/ping/route.ts:36` (success response shape):
```typescript
return NextResponse.json({ ok: true });
```

`src/app/api/v1/diagnostics/ping/route.ts:42-47` (GET handler + ISO timestamp pattern matching CLAUDE.md "ISO-8601 UTC with `Z`"):
```typescript
return NextResponse.json({
  ok: true,
  env: process.env.NODE_ENV === "production" ? "production" : "development",
  timestamp: new Date().toISOString(),
});
```

**What is NEW in Phase 4 (no in-repo analog — cite RESEARCH.md):**

- **Zod request body validation** — RESEARCH.md `## User Constraints > Claude's Discretion` allows free reign over body schemas; the planner should follow Phase 1 D-10 (errors registry returns `validation_failed`) + Phase 2 D-19 (drizzle-zod-derived schemas in `src/contexts/iam/domain/schemas.ts`).
- **Auth gate (`requireVerifiedUser` / `requireApiUser`)** — RESEARCH.md Pattern 11 (lines 724–737) defines the helper signature.
- **Supabase admin orchestration** — RESEARCH.md Pattern 6 (`src/contexts/iam/infrastructure/supabase-admin.ts:1-9` excerpt at RESEARCH.md:594-604).
- **Supabase SSR session reads** — RESEARCH.md Pattern 5 (RESEARCH.md:566-585).
- **Inngest event emit (`inngest.send`)** — RESEARCH.md Pattern 4 (RESEARCH.md:551-555); use the `id:` field for 24h producer-side idempotency.
- **DB transaction wrapping** — Phase 2 D-43 transaction-rollback test pattern; planner cites `02-CONTEXT.md` D-43.
- **Idempotency-Key header** — Phase 2 D-37/D-38 ship `idempotency_keys` table; Phase 4 mutating routes accept the header.
- **Per-IP throttle pre-handler** — RESEARCH.md Pattern 8 (RESEARCH.md:642-658) + D-12-D-15.

**Error response patterns (every handler):** `src/shared/config/errors.ts:64-81`. Codes Phase 4 emits (already in registry, line 1-23): `unauthenticated`, `token_expired`, `invalid_credentials`, `forbidden`, `email_unverified`, `validation_failed`, `invalid_partner_code`, `consent_required`, `rate_limited`. Body shape `{error: {code, message, details?}}` is locked by Phase 1 D-11.

---

### Group 2: `src/app/api/inngest/route.ts` (first Inngest serve handler)

**Analog:** NONE in this repo.

**Authoritative pattern source:** RESEARCH.md `### Pattern 1: Inngest serve() registration (INFRA-10)` (lines 462–504). The planner should copy verbatim:

```typescript
// RESEARCH.md:464-473
import { serve } from "inngest/next";
import { inngest } from "@/shared/inngest/client";
import { registry } from "@/shared/inngest/registry";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: registry,
});
```

The companion files `src/shared/inngest/client.ts` (RESEARCH.md:476-485) and `src/shared/inngest/registry.ts` (RESEARCH.md:488-503) are also no-analog in this repo and should be copied from RESEARCH.md.

**Path-alias note:** RESEARCH.md uses `@/...`; this repo uses `@shared/*`, `@contexts/*`, `@i18n/*` per `tsconfig.json:23-27`. The planner must rewrite the alias when copying. Example:

| RESEARCH.md alias | This repo's actual alias |
|-------------------|--------------------------|
| `@/shared/inngest/client` | `@shared/inngest/client` |
| `@/contexts/iam/...` | `@contexts/iam/...` |
| `@/shared/config/server-env` | `@shared/config/server-env` |

---

### Group 3: Inngest stub functions (D-16: 7 stubs across 5 contexts)

**Analog:** NONE.

**Authoritative pattern source:** RESEARCH.md `### Pattern 2: Stub Inngest function` (lines 510–518). Copy verbatim:

```typescript
import { inngest } from "@shared/inngest/client";

export const careGuideAugment = inngest.createFunction(
  { id: "care-guide-augment" },
  { event: "identification.succeeded" },
  async () => ({ status: "not_implemented" }),
);
```

**Stub inventory (D-16):**

| Context | Function `id` | Trigger event |
|---------|---------------|---------------|
| `care-guide` | `care-guide-augment` | `identification.succeeded` |
| `iam` | `iam-process-deletion` | (defer to Phase 11 — stub trigger TBD; planner can leave generic) |
| `iam` | `iam-generate-export` | (defer to Phase 11 — stub trigger TBD) |
| `billing` | `billing-process-webhook` | `billing.webhook.received` |
| `billing` | `billing-trial-ending-notifier` | (cron — see RESEARCH.md `## Specifics`) |
| `reminders` | `reminders-dispatch` | `reminder.fire` |
| `notifications` | `notifications-send-push` | `notifications/push.requested` |

The 1 REAL implementation in Phase 4 is `notifications/send-email`; see Group 4.

The 1 REAL cron is `auth-throttle-cleanup` per UI-SPEC §"Discretion" + CONTEXT D-12: `cron: '17 * * * *'`, deletes rows older than 2h. Live in `src/contexts/iam/inngest/functions.ts`.

---

### Group 4: `notifications/send-email` Inngest function (NOTIF-01)

**Analog:** NONE.

**Authoritative pattern source:** RESEARCH.md `### Pattern 3: Send email Inngest function` (lines 522–543). Copy verbatim, adjusting the alias:

```typescript
// RESEARCH.md:524-543
import { inngest } from "@shared/inngest/client";
import { renderEmail } from "@contexts/notifications/application/send-email";
import { resendAdapter } from "@contexts/notifications/infrastructure/resend-adapter";

export const notificationsSendEmail = inngest.createFunction(
  { id: "notifications-send-email", retries: 3 },
  { event: "notifications/email.requested" },
  async ({ event, step }) => {
    const { template, props, to, subject } = event.data;
    const rendered = await step.run("render-email", async () =>
      renderEmail(template, props),
    );
    const result = await step.run("send-resend", async () =>
      resendAdapter.send({ from: serverEnv.RESEND_FROM_ADDRESS, to, subject, react: rendered.react }),
    );
    return { messageId: result.id };
  },
);
```

**Anti-pattern reminder** (RESEARCH.md:806): Inside Inngest functions, use `step.sendEvent()` for event chaining — never `inngest.send()` directly inside a function (loses memoization on retry).

---

### Group 5: React Email templates (NOTIF-02)

**Analog:** NONE.

**Authoritative pattern source:**
- RESEARCH.md `### Pattern 9: React Email pt-BR template` (lines 663–697) — full sample for verification.tsx
- UI-SPEC §7 `## Phase 4-Specific Interaction Contracts > Email template visual contract` — lists exact hex values, font fallbacks, layout

**Locked details from UI-SPEC §7:**

```
Headline font-family: 'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif
Body font-family:     'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif

Body bg:                    #FBF7EF (Paper Cream)
Content card bg:            #FFFDF7 (Warm Ivory Surface)
Headline color:             #143424 (Forest Ink)
Body color:                 #5A6358 (Calm Slate)
CTA button bg:              #1F4D35 (Canopy Green)
CTA button label color:     #FFFDF7 (Warm Ivory)
Footer LGPD strip text:     #2B6F7A (Trust Teal)
```

**Locked subjects + bodies:** UI-SPEC §"Email templates (locked from CONTEXT.md §specifics)" table + body copy. Both verification + password-reset templates are spec-complete in pt-BR.

**Dark-mode meta tags** required per UI-SPEC §7:
```html
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
```

**Plain-text URL fallback below CTA** required per UI-SPEC §7 accessibility (e.g. "Se o botão não funcionar, copie e cole este link no navegador: …").

---

### Group 6: Resend adapter

**Analog:** NONE.

**Authoritative pattern source:** RESEARCH.md `### Pattern 10: Resend SDK send + dev fallback` (lines 700–722). Copy verbatim, adjusting alias:

```typescript
// RESEARCH.md:702-722
import { Resend } from "resend";
import { serverEnv } from "@shared/config/server-env";

const resend = serverEnv.RESEND_API_KEY ? new Resend(serverEnv.RESEND_API_KEY) : null;

export const resendAdapter = {
  async send(params: { from: string; to: string; subject: string; react: React.ReactElement }) {
    if (!resend) {
      // D-20: dev fallback — log payload, never network
      console.log("[resend-dev] would send", { ...params, html: "<rendered>" });
      return { id: "dev-mode" };
    }
    const { data, error } = await resend.emails.send(params);
    if (error) throw new Error(`resend.send failed: ${error.message}`);
    return data!;
  },
};
```

**Anti-pattern reminder** (RESEARCH.md:807): The Resend SDK returns `{data, error}` — do NOT wrap `.send()` in try/catch except for network-level failures.

---

### Group 7: `@supabase/ssr` server client wrapper

**Analog:** NONE.

**Authoritative pattern source:** RESEARCH.md `### Pattern 5: @supabase/ssr server client in Route Handlers` (lines 562–585). Copy verbatim, adjusting alias.

**Critical:** RESEARCH.md `### Pitfall 6` (lines 866–871) warns that `setAll` cannot run from a Server Component (Next 16 throws). For the ROOT LAYOUT verification gate (Pattern 11), use a read-only variant that omits `setAll`. Plan-phase must implement two variants:
- `getSupabaseServerClient()` — full client with `setAll` for Route Handlers + Server Actions
- `getReadOnlySupabaseServerClient()` — for Server Components reading `auth.getUser()`

---

### Group 8: Supabase admin client wrapper

**Analog:** NONE.

**Authoritative pattern source:** RESEARCH.md `### Pattern 6: Supabase admin client (service role)` (lines 588–604). Copy verbatim, adjusting alias.

**Security note:** RESEARCH.md `## Don't Hand-Roll` (line 814) — `admin.*` namespace requires `SUPABASE_SERVICE_ROLE_KEY` (already in `src/shared/config/server-env.ts:9`). Never expose to client; never re-export through any client-runtime module.

---

### Group 9: Per-IP throttle (D-12-D-15)

**Analog:** NONE — first repository in repo.

**Authoritative pattern source:** RESEARCH.md `### Pattern 8: Per-IP throttle UPSERT-RETURNING` (lines 636–658). Copy verbatim, adjusting alias.

```typescript
// RESEARCH.md:639-658
import { sql } from "drizzle-orm";
import { authThrottle } from "./schema";

export async function bumpThrottle(
  db: DrizzleClient,
  ip: string,
  endpoint: string,
): Promise<{ count: number; locked: boolean }> {
  const windowStart = Math.floor(Date.now() / 1000 / 60); // minute bucket
  const [row] = await db
    .insert(authThrottle)
    .values({ ip, endpoint, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [authThrottle.ip, authThrottle.endpoint, authThrottle.windowStart],
      set: { count: sql`${authThrottle.count} + 1` },
    })
    .returning({ count: authThrottle.count });

  return { count: row.count, locked: row.count > 5 };
}
```

**IP extraction pattern:** `request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()` — RESEARCH.md `## Don't Hand-Roll` line 825.

**Pitfall reminder:** RESEARCH.md `### Pitfall 7` (lines 873–877) — atomic UPSERT-RETURNING is required. Any naive INSERT-then-SELECT is racy.

---

### Group 10: Token mint + verify (`src/shared/crypto/tokens.ts`)

**Analog:** NONE.

**Authoritative pattern source:** RESEARCH.md `### Pattern 7: Token mint + verify` (lines 610–630). Copy verbatim:

```typescript
// RESEARCH.md:613-630
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/** Returns { raw, hash } — store hash, send raw in URL. */
export function mintToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/** Constant-time comparison — prevents timing attacks. */
export function verifyToken(raw: string, hash: string): boolean {
  const candidateHash = createHash("sha256").update(raw).digest("hex");
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

---

### Group 11: Verification gate helper + root-layout server component

**Analog (helper):** NONE — Phase 2 D-32 was supposed to ship `requireApiUser`; it hasn't. Plan-phase must add an explicit Phase 2 gate task.

**Analog (root layout):** `src/app/layout.tsx:1-27` (current Phase 1 layout) — extend with the gate.

**What you copy from the current layout** (`src/app/layout.tsx:11-27`):

```typescript
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PostHogProvider>{children}</PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**What you ADD per RESEARCH.md Pattern 11** (lines 724–755) AND open question #4 (lines 1187-1190):

The root layout gains a server-side check (using `getReadOnlySupabaseServerClient()` from Group 7 to avoid the Pitfall 6 cookie-set crash). Order of checks:

1. Authenticated check (no JWT → fall through to children — login pages handle their own redirect)
2. `age_confirmed_at IS NULL` → render OAuth-completion redirect (per RESEARCH.md Open Q4 / D-04)
3. `email_verified_at IS NULL` → render `<UnverifiedBlocker />` (per AUTH-15 / UI-SPEC §5)
4. Else → children (the existing flow)

**Do NOT touch:** `NextIntlClientProvider` and `PostHogProvider` wrap children — preserve them.

**Helper pattern (`src/shared/api/auth.ts`):** RESEARCH.md Pattern 11 helper signature (lines 727-737):

```typescript
// RESEARCH.md:727-737 (rewritten alias)
import { errorResponse, ErrorCode } from "@shared/config/errors";
import { getCurrentUser } from "@contexts/iam/application/current-user";

export async function requireVerifiedUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return { error: errorResponse(ErrorCode.Unauthenticated, "Not authenticated") };
  if (!user.emailVerifiedAt) return { error: errorResponse(ErrorCode.EmailUnverified, "Verifique seu e-mail.") };
  return { user };
}
```

---

### Group 12: OAuth callback (`src/app/auth/callback/route.ts`)

**Analog:** NONE — first OAuth callback in repo.

**Authoritative pattern source:** RESEARCH.md `### Pattern 12: OAuth callback - code-for-session exchange` (lines 760–795). Copy verbatim, adjusting alias.

**Critical detail:** Per D-04 + RESEARCH.md Open Q4, after `exchangeCodeForSession` succeeds, route by `age_confirmed_at`:
- `IS NULL` → `/auth/oauth-complete`
- `NOT NULL` → `/`

This requires a repository read against `public.users` after Supabase session creation.

---

### Group 13: Drizzle schema additions (NEW Phase 4 tables + ALTER)

**Analog:** NONE — Phase 2 hasn't shipped any Drizzle file. The planner must establish the convention.

**Authoritative pattern sources:**
- Drizzle docs cited via Context7 (`/drizzle-team/drizzle-orm-docs`) for `pgTable`, `primaryKey`, `index`, `onConflictDoUpdate`
- CLAUDE.md project lock: `postgres` driver with `{ prepare: false }` mandatory (Supavisor txn pooler)
- Phase 2 D-01 per-context schema ownership → IAM tables live in `src/contexts/iam/infrastructure/db/schema.ts`
- Phase 2 D-14 runtime DB client `{ prepare: false }`
- Phase 2 D-19 drizzle-zod refined schemas
- Phase 2 D-20-D-22 RLS posture (`auth.uid()` ownership)
- CLAUDE.md "Data: Timestamps ISO-8601 UTC with `Z`" → use `timestamp('...', { withTimezone: true, mode: 'date' })` everywhere

**New tables Phase 4 introduces (CONTEXT D-06, D-09, D-12; RESEARCH.md ## Architecture > Recommended Project Structure):**

| Table | Source | Columns (high-level) |
|-------|--------|----------------------|
| `email_verification_tokens` | D-06 | `id`, `user_id` FK, `token_hash` (sha256), `expires_at` (24h), `consumed_at`, `created_at`, `sent_to_email` |
| `password_reset_tokens` | D-09 | same shape, `expires_at` 1h |
| `auth_throttle` | D-12 | `ip` text, `endpoint` text, `window_start` int8 (minute bucket), `count` int. PK `(ip, endpoint, window_start)` |

**ALTER TABLE Phase 4 introduces:**
- `users.email_verified_at TIMESTAMPTZ NULL` (CONTEXT §reusable + RESEARCH.md Open Q3 lines 1182-1185 — flagged as a doc-fix to PRD §4)

**RLS posture:** All three new tables follow Phase 2 D-20/D-21/D-22. Token tables are owner-only via `auth.uid() = user_id`; `auth_throttle` is service-role-only (no user JWT can read or write it — only the throttle middleware via service role).

---

### Group 14: pt-BR locale strings (`src/messages/pt-BR.json`)

**Analog:** `src/messages/pt-BR.json:1` — currently `{}`.

**What's there now:** Empty object.

**What to ADD:** UI-SPEC §"i18n key namespaces (Phase 4 introduces)" enumerates 11 namespaces:

```
auth.signup.*
auth.login.*
auth.verify.*
auth.reset.*
auth.forgotPassword.*
auth.oauthComplete.*
auth.unverifiedBlocker.*
settings.account.*
settings.placeholder.*
email.verification.*
email.passwordReset.*
```

UI-SPEC §"Copywriting Contract" provides every string in pt-BR. CONTEXT D-30 says these are initial drafts; founder reviews during plan execution.

**Loading pattern (do not touch):** `src/i18n/request.ts:1-11` already wires `messages/${locale}.json` for `pt-BR`. Phase 4 only fills the JSON.

---

### Group 15: Server-env additions

**Analog:** `src/shared/config/server-env.ts:1-19`.

**What you copy** (the Zod-schema convention with `optional` preprocess for empty-string handling):

```typescript
// src/shared/config/server-env.ts:1-19
import { z } from "zod";

const optional = (schema: z.ZodString) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

export const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_PROJECT_REF: optional(z.string().min(1)),
  SUPABASE_ACCESS_TOKEN: optional(z.string().min(1)),
  SENTRY_AUTH_TOKEN: optional(z.string().min(1)),
  SENTRY_ORG: optional(z.string().min(1)),
  SENTRY_PROJECT: optional(z.string().min(1)),
  IDENTIFICATION_PROVIDER_MODE: z.enum(["stub", "real"]).default("stub"),
});

export const serverEnv = serverSchema.parse(process.env);
```

**What to ADD (CONTEXT §canonical_refs + RESEARCH.md `## Runtime State Inventory`):**

```typescript
INNGEST_EVENT_KEY: optional(z.string().min(1)),         // already in .env.example:23 as placeholder
INNGEST_SIGNING_KEY: optional(z.string().min(1)),       // already in .env.example:24 as placeholder
RESEND_API_KEY: optional(z.string().min(1)),            // empty in dev → dev fallback per D-20
RESEND_FROM_ADDRESS: z.string().email().default("onboarding@resend.dev"),
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: optional(z.string().min(1)),
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
```

**Why optional:** RESEARCH.md `## Common Pitfalls > Pitfall 5` (Inngest dev mode auto-detects empty signing key) + `## Common Pitfalls > Pitfall 4 + 10` (Resend dev fallback when key empty) + D-19 sandbox fallback for `from`.

**Update `.env.example` accordingly.** Phase 1 D-29 split server-env vs client-env is already implemented; do not move any new var to `client-env.ts`.

---

### Group 16: Tests

**Unit-test analog:** `tests/unit/errors.test.ts:1-83`. Excerpt for the core test shape (`describe / it.each / expect`):

```typescript
// tests/unit/errors.test.ts:28-43
describe("INFRA-20 error registry (PRD §5)", () => {
  it("ErrorCode exports all 21 expected codes", () => {
    expect(Object.entries(ErrorCode)).toHaveLength(21);
  });

  it.each(Object.entries(EXPECTED_HTTP))(
    "errorResponse(%s) returns HTTP %i",
    async (code, expectedStatus) => {
      const res = errorResponse(code as never, "test msg");
      expect(res.status).toBe(expectedStatus);
    },
  );
```

**Integration-test analog (vi.mock + dynamic-import + Request):** `tests/integration/diagnostics-server-probe.integration.test.ts:1-75`. Excerpt:

```typescript
// tests/integration/diagnostics-server-probe.integration.test.ts:1-19
import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.IDENTIFICATION_PROVIDER_MODE = "stub";
process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/db";
process.env.DATABASE_POOL_URL ??= "postgres://u:p@localhost:5432/db";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon";
process.env.NEXT_PUBLIC_POSTHOG_KEY ??= "ph_test_key";

const captureMock = vi.fn();
const shutdownMock = vi.fn().mockResolvedValue(undefined);

vi.mock("posthog-node", () => ({
  PostHog: function MockPostHog() {
    return { capture: captureMock, shutdown: shutdownMock };
  },
}));
```

```typescript
// tests/integration/diagnostics-server-probe.integration.test.ts:42-58
const mod = await import("../../src/app/api/v1/diagnostics/ping/route");
const res = await mod.POST(
  new Request("http://localhost:3000/api/v1/diagnostics/ping", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
  }),
);

expect(res.status).toBe(200);
const body = await res.json();
expect(body.ok).toBe(true);
```

**Live-Postgres analog:** `tests/integration/postgres-connection.integration.test.ts:1-34`. Excerpt:

```typescript
// tests/integration/postgres-connection.integration.test.ts:1-21
import { describe, it, expect, afterAll } from "vitest";
import postgres from "postgres";

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

describe.skipIf(!dbUrl)("INFRA-26 local Postgres reachable via DATABASE_POOL_URL", () => {
  const sql = postgres(dbUrl!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });
```

**Note the cloud-DB safeguard** (lines 6-11). Every Phase 4 integration test that talks to Postgres must include the same safeguard.

**E2E analog:** `tests/e2e/diagnostics-posthog.spec.ts:1-36`. Excerpt for Playwright shape + `page.route` interception + `request.get` API call:

```typescript
// tests/e2e/diagnostics-posthog.spec.ts:1-22
import { test, expect } from "@playwright/test";

test("PostHog $diagnostics_client_ping fires + GET /api/v1/diagnostics/ping returns {ok,env,timestamp}", async ({
  page,
  request,
}) => {
  const posthogEvents: string[] = [];

  await page.route(/\.i\.posthog\.com\/(e|batch|capture)/, async (route) => {
    const raw = route.request().postData();
    if (raw) posthogEvents.push(raw);
    await route.fulfill({ status: 200, body: "1" });
  });

  await page.goto("/diag");
  await page.waitForTimeout(1500);

  const pingRes = await request.get("/api/v1/diagnostics/ping");
  expect(pingRes.status()).toBe(200);
```

**Vitest config note:** `vitest.config.ts:1-29` already defines unit + integration projects. Phase 4 must NOT re-add `setupFiles` to integration (RESEARCH.md `## Wave 0 Gaps` line 986 explicitly warns 01-04 SUMMARY moved synthetic env off integration). Phase 4 adds a dedicated `tests/integration/setup-supabase-truncate.ts` that ONLY truncates auth-bearing tables — it does not set synthetic env.

**Setup-env analog (unit-only):** `tests/unit/setup-env.ts:1-7` — minimal `process.env.X ??= "..."` defaults.

---

## Shared Patterns

These are cross-cutting concerns that apply to multiple plans.

### Authentication (`requireApiUser` + `requireVerifiedUser`)

**Source:** RESEARCH.md Pattern 11 (lines 724–737) + Phase 2 D-32 (not shipped — gate task required).

**Apply to:** Every `/api/v1/iam/**/route.ts` handler (except the public ones: `/signup`, `/login`, `/password/reset-request`, `/password/reset`).

**Two helpers:**
- `requireApiUser(request)` — returns `{ user }` if authenticated, `{ error: errorResponse(Unauthenticated) }` otherwise.
- `requireVerifiedUser(request)` — returns `{ user }` only if authenticated AND `email_verified_at IS NOT NULL`. Otherwise `email_unverified` 403 (UNVERIFIED_ALLOWED_PATHS allowlist gates per D-23).

```typescript
import { errorResponse, ErrorCode } from "@shared/config/errors";

export async function requireVerifiedUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return { error: errorResponse(ErrorCode.Unauthenticated, "Not authenticated") };
  if (!user.emailVerifiedAt) return { error: errorResponse(ErrorCode.EmailUnverified, "Verifique seu e-mail.") };
  return { user };
}
```

### Error Handling (closed registry)

**Source:** `src/shared/config/errors.ts:1-81` (Phase 1 D-10/D-11/D-12).

**Apply to:** Every `/api/v1/iam/**/route.ts` handler, every Inngest function that fails non-retriably, every server route that needs to redirect-with-error.

**Body shape (locked):** `{error: {code, message, details?}}`.

**Codes Phase 4 may emit (already in registry):** `unauthenticated`, `token_expired`, `invalid_credentials`, `forbidden`, `email_unverified`, `validation_failed`, `invalid_partner_code`, `consent_required`, `rate_limited`. NO new codes — RESEARCH.md `## Anti-Patterns to Avoid` line 809 forbids it.

**Internal-only redaction (lines 27-30, 69):** `cost_ceiling_reached` and `breaker_open` map to `provider_unavailable` in the body. Phase 4 doesn't emit these directly but downstream Inngest functions may.

### Validation (Zod request bodies)

**Source:** Phase 1 D-10 + Phase 2 D-19 (not shipped). Drizzle-zod-derived schemas live in `src/contexts/iam/domain/schemas.ts`.

**Apply to:** Every mutating handler (POST/PATCH/PUT). Validation failure → `errorResponse(ErrorCode.ValidationFailed, message, { field })`.

**Convention from Phase 1 env files** (`src/shared/config/server-env.ts:1-19` + `client-env.ts:1-21`):
- Use `z.preprocess((v) => (v === "" ? undefined : v), schema.optional())` for optional fields
- Use `z.string().email()` for emails (don't add custom regex)
- Use `z.string().url()` for URLs
- Use `z.string().min(N)` for min-length

### Telemetry: PostHog server-side `signup_completed` + `consent_granted`

**Source:** `src/shared/telemetry/posthog-server.ts:1-23` + `src/app/api/v1/diagnostics/ping/route.ts:12-20` (consumer pattern).

**Apply to:** `/auth/verify` route handler (fire `signup_completed` per D-07 — clock starts here, NOT at signup form submit per RESEARCH.md Pitfall 8 lines 880–885) AND `/auth/oauth-complete` page submit (also fires `signup_completed` because OAuth users skip the verification step).

**Apply to:** Inside the signup DB transaction, fire `consent_granted` once per ConsentLog row (D-24 → 2 ConsentLog rows → 2 events).

**Pattern (from existing diagnostics route):**
```typescript
const ph = getPostHog();
if (ph) {
  ph.capture({
    distinctId: userId,
    event: "signup_completed",
    properties: { /* no email per LGPD-13 */ },
  });
  await ph.shutdown();
}
```

**LGPD constraint (CLAUDE.md):** "`Sentry.setUser({ id })` only — never email." Apply same posture to PostHog: never include email or other PII in `properties`.

### Sentry PII scrubbing

**Source:** `src/shared/telemetry/sentry-scrub.ts:5-12` — already scrubs `email`, `password`, `token`, `Authorization`, `Cookie` by default.

**Apply to:** All Phase 4 auth flows are auto-protected by the existing scrub. No additional Phase 4 work required EXCEPT:
- Anti-pattern reminder (RESEARCH.md:805): Do not add new log statements that include any of those fields uncovered.
- `Sentry.setUser({ id })` only — never `{ email, ... }`.

### i18n (next-intl pt-BR)

**Source:** `src/i18n/request.ts:1-11` + `src/i18n/routing.ts:1-7` + `src/messages/pt-BR.json:1`.

**Apply to:** Every Phase 4 UI page, the `<UnverifiedBlocker />` server component, every error helper-text path. Server-side handlers that return error messages can stay in pt-BR raw strings; client-rendered copy must read from `useTranslations()` / `getTranslations()` per next-intl.

### Path aliases

**Source:** `tsconfig.json:23-27`. The repo uses `@shared/*`, `@contexts/*`, `@i18n/*`. RESEARCH.md uses `@/...` — translate per the table in Group 2 above.

### Module conventions

**Phase 1 D-08: NO barrels.** Import directly from the file:
- ✅ `import { errorResponse } from "@shared/config/errors"`
- ❌ `import { errorResponse } from "@shared/config"` (no `index.ts`)

The existing repo has zero `index.ts` files in `src/`. Phase 4 must NOT add any.

---

## Phase 1 Files That Are Already Final (do not touch)

These files are complete and should not be modified by Phase 4:

| File | Why |
|------|-----|
| `src/shared/config/errors.ts` | Closed registry — all 21 codes Phase 4 needs are present (Phase 1 D-10) |
| `src/shared/config/client-env.ts` | NEXT_PUBLIC_SUPABASE_URL/ANON_KEY already there; Phase 4's new vars are server-only |
| `src/shared/telemetry/sentry-scrub.ts` | LGPD-13 scrubs `email`, `password`, `token` — Phase 4 gets it for free |
| `src/shared/telemetry/posthog-server.ts` | Phase 4 calls `getPostHog()` directly |
| `src/shared/telemetry/posthog-client.ts` | Client-side autocapture is off; pageview tracking lands later |
| `src/i18n/routing.ts` | pt-BR locale config |
| `src/i18n/request.ts` | next-intl request config |
| `src/instrumentation.ts` | Sentry register hook |
| `src/sentry.{server,edge,client}.config.ts` | Already wired with scrub |
| `next.config.ts` | Security headers + Sentry config + Serwist already present |
| `vitest.config.ts` | Unit + integration projects (Phase 4 may add a single integration setupFile per RESEARCH.md Wave 0 Gaps line 986) |
| `playwright.config.ts` | Phase 4 uses the existing webServer config |

---

## Files Modified (not created) by Phase 4

| File | What Changes |
|------|--------------|
| `src/app/layout.tsx` | Add server-side auth gate (RESEARCH.md Pattern 11 + Open Q4) — keep `NextIntlClientProvider`/`PostHogProvider` wraps |
| `src/proxy.ts` | If Phase 2 D-34 hasn't shipped: extend matcher OR add API-aware fast bearer rejection. Currently `src/proxy.ts:8-10` excludes `/api/*`. Plan-phase MUST verify Phase 2 status before deciding scope. |
| `src/shared/config/server-env.ts` | Add 4-6 new vars (Group 15) to the Zod schema |
| `src/messages/pt-BR.json` | Fill currently-empty `{}` with 11 namespaces (Group 14) |
| `.env.example` | Already lists `INNGEST_*` placeholders (lines 21-24); Phase 4 adds `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` |
| `package.json` | `pnpm add inngest@^4.2.4 resend@^6.12.2 @react-email/components@^1.0.12 @supabase/ssr@^0.10.2 @supabase/supabase-js@^2.104.1` (RESEARCH.md:223-227) and any drizzle deps if Phase 2 hasn't installed them |
| `supabase/config.toml` | Verify `[auth.email] enable_confirmations = false` (already line 219); add `[auth.external.google] enabled = true` and the related env-substitution fields |
| `package.json` (scripts) | Add `"inngest:dev": "npx inngest-cli@latest dev -u http://localhost:3000/api/inngest"` (RESEARCH.md `## Common Pitfalls > Pitfall 5` line 863) |

---

## No Analog Found (use external pattern source)

These files have NO close in-repo match. The planner must reference RESEARCH.md (verified against Context7 docs) as the authoritative pattern source.

| File | Role | External Pattern Source |
|------|------|-------------------------|
| `src/app/api/inngest/route.ts` | Inngest serve handler | RESEARCH.md Pattern 1 (lines 462-484) — `/inngest/inngest-js` Context7 |
| `src/shared/inngest/client.ts` | Inngest SDK singleton | RESEARCH.md Pattern 1 (lines 476-485) |
| `src/shared/inngest/registry.ts` | Inngest function registry | RESEARCH.md Pattern 1 (lines 488-503) |
| All `src/contexts/*/inngest/functions.ts` (5 files, 1 real + 7 stubs) | Inngest function exports | RESEARCH.md Patterns 2 + 3 |
| `src/contexts/notifications/infrastructure/email-templates/*.tsx` | React Email templates | RESEARCH.md Pattern 9 + UI-SPEC §7 |
| `src/contexts/notifications/infrastructure/resend-adapter.ts` | Resend adapter + dev fallback | RESEARCH.md Pattern 10 |
| `src/contexts/notifications/application/send-email.ts` | Template registry + render orchestration | RESEARCH.md Pattern 3 |
| `src/contexts/iam/infrastructure/supabase-server.ts` | `@supabase/ssr` server client | RESEARCH.md Pattern 5 |
| `src/contexts/iam/infrastructure/supabase-admin.ts` | Supabase admin client | RESEARCH.md Pattern 6 |
| `src/contexts/iam/infrastructure/db/auth-throttle.ts` | UPSERT-RETURNING repository | RESEARCH.md Pattern 8 |
| `src/contexts/iam/infrastructure/db/{verification,reset}-tokens.ts` | Token repositories | Drizzle docs (Context7 `/drizzle-team/drizzle-orm-docs`) + Pattern 7 for hashing |
| `src/contexts/iam/infrastructure/db/{users,consent-logs,policy-versions,subscriptions}.ts` | Repositories | Drizzle docs; Phase 2 D-16 functional repository pattern (not shipped) |
| `src/contexts/iam/infrastructure/db/schema.ts` | Drizzle schema | Drizzle docs `pgTable` + Phase 2 D-19 drizzle-zod (not shipped) |
| `src/shared/crypto/tokens.ts` | Token mint/verify helpers | RESEARCH.md Pattern 7 (Node `crypto` stdlib) |
| `src/shared/api/auth.ts` | `requireApiUser` / `requireVerifiedUser` | RESEARCH.md Pattern 11; Phase 2 D-32 prerequisite |
| `src/shared/api/throttle.ts` | Per-IP throttle middleware wrapper | RESEARCH.md Pattern 8 + D-12-D-15 |
| `src/app/auth/callback/route.ts` | OAuth callback | RESEARCH.md Pattern 12 |
| All `src/contexts/iam/application/*.ts` use-cases | Orchestration | RESEARCH.md Patterns 5, 6, 11 + D-03/D-25 transactional ordering |
| `src/contexts/iam/api/components/unverified-blocker.tsx` | Server component | UI-SPEC §5 + Pattern 11 invocation site |
| All `src/app/auth/*` pages | Form pages | NO ANALOG — UI-SPEC §"Copywriting Contract" + Phase 3 (not shipped) primitives |
| All `src/app/settings/**` pages | Settings shell | NO ANALOG — UI-SPEC §6 + §8 |
| All `tests/integration/iam-*.integration.test.ts` | New integration tests | `tests/integration/diagnostics-server-probe.integration.test.ts` (shape only) + Phase 2 D-43 transaction-rollback (not shipped) + D-44 hybrid auth-test posture (not shipped) + D-28 TRUNCATE for auth.users |
| All `tests/integration/fixtures/*.ts` | Test fixtures | NONE — first fixture helpers in repo |

---

## Hard Prerequisites the Planner MUST Surface

These are NOT bugs in this PATTERNS.md — they are gates RESEARCH.md and CONTEXT.md already flag. The planner must add them as Wave 0 tasks BEFORE any Phase 4-specific work runs.

### Phase 2 prerequisite gate (RESEARCH.md `## Phase 2 Inheritance Audit`, lines 1086-1107)

Phase 2 must ship the following deliverables before Phase 4 can begin. Phase 2 is `0/10` complete in STATE.md. Phase 4's plan-00 or plan-01 task should verify each:

| Phase 2 Deliverable | Where It's Required by Phase 4 |
|---------------------|---------------------------------|
| AuthAdapter (`verifyJWT`, `getUserById`) — Plan 02-07 | Phase 4 extends with `getCurrentUser`, `requireVerifiedUser` |
| `users` table (full PRD §4 schema) — Plan 02-02 | Phase 4 ALTER adds `email_verified_at TIMESTAMPTZ NULL` |
| `consent_logs` table with `purpose` literal union including `terms_of_service` AND `privacy_policy`, `source` literal union including `signup` AND `settings` — Plan 02-02 | D-24 inserts these values |
| `policy_versions.is_current` — D-13 / D-48 / Plan 02-02 | Read at signup time to bind ConsentLog rows |
| `subscriptions` table — Plan 02-03 | Phase 4 inserts initial `status=trialing` row |
| `idempotency_keys` table — D-37 / D-38 / Plan 02-06 | Mutating routes accept `Idempotency-Key` header |
| RLS posture (D-20-D-22) — Plan 02-03 | Phase 4 NEW tables follow same posture |
| Runtime DB client `db/client.ts` with `{ prepare: false }` — D-14 / Plan 02-05 | Phase 4 imports for all repo queries |
| `auth.users → public.users` insert trigger — D-35 / Plan 02-03 | D-03 explicitly relies on this as safety net |
| API-aware `src/proxy.ts` (fast missing-bearer rejection) — D-34 / Plan 02-07 | Phase 4 D-21 preserves this; current `src/proxy.ts:8-10` excludes `/api/*` |

If any item above is missing when Phase 4 starts: plan-phase adds a Phase 2 dependency-resolution task as plan 04-00 / 04-01 BEFORE Phase 4-specific work.

### Phase 3 prerequisite gate (UI-SPEC.md:38)

UI-SPEC explicitly flags: "Phase 3 has not yet executed in this worktree. The planner must surface a hard prerequisite that Phase 4 cannot start until Phase 3 ships the design tokens, typography, focus ring, and bottom-nav primitives this contract assumes."

Every Phase 4 UI file (`src/app/auth/*` pages, `src/app/settings/**` pages, `<UnverifiedBlocker />` server component) inherits Phase 3 design tokens. If Phase 3 hasn't shipped, the planner must:
- Option A: Gate Phase 4 on Phase 3 (the safe path).
- Option B: Hand-roll minimal primitives within UI-SPEC §17 token values, deferring the primitive library to Phase 3.
- Option C: Surface the conflict to the orchestrator.

This is a planning-level decision. PATTERNS.md cannot resolve it — the planner can.

---

## Open Question for the Planner (RESEARCH.md surfaces 6; one specifically affects the pattern map)

**RESEARCH.md Open Q3 (lines 1182-1185):** Where does `email_verified_at` live? PRD §4 doesn't mention it; Phase 2 plan-02-02 schema task (line 65) doesn't include it. The Phase 4 plan must decide:
- (A) Add the column via Phase 4 migration `drizzle/migrations/XXXX_phase04_add_email_verified.sql` AND update `src/contexts/iam/infrastructure/db/schema.ts`. Note as intentional Phase 4 addition.
- (B) Block Phase 4 on a PRD §4 doc-fix + Phase 2 schema amendment.

RESEARCH.md recommends (A). The pattern map assumes (A).

---

## Metadata

**Analog search scope:**
- `/src/**` (every existing file)
- `/tests/**` (Phase 1 unit + integration + e2e)
- `/.planning/phases/04-iam-auth-verification-consent/04-CONTEXT.md`
- `/.planning/phases/04-iam-auth-verification-consent/04-RESEARCH.md`
- `/.planning/phases/04-iam-auth-verification-consent/04-UI-SPEC.md`
- `/CLAUDE.md`
- `/package.json`, `/tsconfig.json`, `/vitest.config.ts`, `/playwright.config.ts`, `/next.config.ts`, `/.env.example`
- `/supabase/config.toml`

**Files scanned:** ~25 source files (covering 100% of the existing `src/` tree at this commit).

**Pattern extraction date:** 2026-04-26

**Confidence:** HIGH for the 9 in-repo analogs (Phase 1 files, all read directly). HIGH for the 12 RESEARCH.md patterns (already verified against Context7 in RESEARCH.md). MEDIUM for any pattern that depends on Phase 2 deliverables (AuthAdapter, runtime DB client, idempotency_keys) — flagged as prerequisites.
