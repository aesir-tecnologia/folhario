---
phase: 01
plan: 05a
type: tdd
wave: 3
depends_on: [02, 03]
files_modified:
  - src/shared/telemetry/sentry-scrub.ts
  - tests/unit/sentry-scrub.test.ts
autonomous: true
requirements:
  - LGPD-13
tags:
  - sentry
  - lgpd
  - scrubbing
  - tdd

must_haves:
  truths:
    - "`src/shared/telemetry/sentry-scrub.ts` exports `makeBeforeSend()`, `makeBeforeBreadcrumb()`, `scrubHeaders`, `scrubObject`, `SCRUB_FIELDS`"
    - "Calling `makeBeforeSend()` on an event with `request.url` matching `/api/v1/identifications/*` returns event with `request.data === undefined`"
    - "Calling `makeBeforeSend()` scrubs `authorization`, `cookie`, `email`, `password`, `token`, `photo_url` from `request.headers`, `request.data`, `extra`, `contexts` (case-insensitive, recursive)"
    - "`makeBeforeSend()` deletes `event.user.email`, `event.user.username`, `event.user.ip_address` on any event"
    - "`makeBeforeSend()` sets `request.cookies = undefined`"
    - "`makeBeforeBreadcrumb()` scrubs forbidden fields from `breadcrumb.data`"
    - "`SCRUB_FIELDS` constant exports exactly the 6 required field names from PRD §13.7"
  artifacts:
    - path: "src/shared/telemetry/sentry-scrub.ts"
      provides: "Shared scrub helpers consumed by all three Sentry init files in Plan 05b (SP-3 + LGPD-13 load-bearing single source of truth)"
      exports: ["makeBeforeSend", "makeBeforeBreadcrumb", "scrubHeaders", "scrubObject", "SCRUB_FIELDS"]
      min_lines: 55
    - path: "tests/unit/sentry-scrub.test.ts"
      provides: "Load-bearing LGPD-13 unit test — exhaustively exercises beforeSend on synthetic events (12 behaviors)"
      min_lines: 80
  key_links:
    - from: "tests/unit/sentry-scrub.test.ts"
      to: "src/shared/telemetry/sentry-scrub.ts"
      via: "direct import + hand-called beforeSend with synthetic events"
      pattern: "makeBeforeSend\\(\\)\\("
---

<objective>
Land the LGPD-13 load-bearing Sentry scrubbing module via strict TDD (RED → GREEN → REFACTOR). This plan is dedicated TDD because the scrub contract IS the legal compliance surface — the tests encode PRD §13.7 as runnable assertions; the implementation exists only to pass them.

Purpose: LGPD-13 mandates that `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url` are scrubbed from every Sentry event, that request bodies are dropped on `/api/v1/identifications/*`, and that `Sentry.setUser({ id })` is the only way to identify users. This module is consumed by Plan 05b's three Sentry init files (server/edge/browser). Splitting the TDD helpers (05a) from the execute wiring (05b) keeps frontmatter `type` semantics honest (this plan is truly TDD; 05b is straight execute).

Output: A single `src/shared/telemetry/sentry-scrub.ts` module whose public surface is fully pinned by `tests/unit/sentry-scrub.test.ts` (≥12 behaviors, ≥15 assertions). Two atomic commits minimum: RED → GREEN.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/references/tdd.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/phases/01-foundation/01-CONTEXT.md
@/Users/machado/Projects/folhario/.planning/phases/01-foundation/01-RESEARCH.md
@/Users/machado/Projects/folhario/.planning/phases/01-foundation/01-PATTERNS.md
@/Users/machado/Projects/folhario/CLAUDE.md
@/Users/machado/Projects/folhario/docs/CAVE-PRD.md
@/Users/machado/Projects/folhario/.planning/phases/01-foundation/01-FILE-MATRIX.md

<interfaces>
<!-- Consumed: none (pure module + test). Produces types consumed by Plan 05b. -->

LGPD-13 scrub contract (PRD §13.7):
- `Authorization` (case-insensitive) — header scrub + data scrub
- `Cookie` — header scrub + data scrub + event.request.cookies = undefined
- `email` — delete from event.user, scrub from request.data + extra + contexts
- `password` — scrub everywhere
- `token` — scrub everywhere
- `photo_url` — scrub everywhere
- `/api/v1/identifications/*` — drop `event.request.data` entirely (regex `/\/api\/v1\/identifications(\/|$)/`)

Scrub fields (exact case-insensitive list from PRD §13.7):
```typescript
const SCRUB_FIELDS = ["authorization", "cookie", "email", "password", "token", "photo_url"] as const;
const IDENTIFICATION_PATH = /\/api\/v1\/identifications(\/|$)/;
```

Module public surface (MUST export these verbatim — Plan 05b init files depend on these names):
```typescript
export const SCRUB_FIELDS: readonly string[];
export function scrubHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined;
export function scrubObject(obj: unknown): unknown;
export function makeBeforeSend(): (event: SentryEvent) => SentryEvent;
export function makeBeforeBreadcrumb(): (breadcrumb: SentryBreadcrumb) => SentryBreadcrumb;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED → GREEN for `src/shared/telemetry/sentry-scrub.ts` — load-bearing LGPD-13 unit test</name>
  <files>tests/unit/sentry-scrub.test.ts, src/shared/telemetry/sentry-scrub.ts</files>
  <read_first>
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-PATTERNS.md §SP-3 Sentry scrub helpers (lines 214-280)
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-RESEARCH.md §Pattern 6 Sentry beforeSend scrubbing (lines 675-761)
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-RESEARCH.md §Defense-in-depth layering for LGPD-13 (lines 1505-1512)
    - /Users/machado/Projects/folhario/docs/CAVE-PRD.md §13.7 (authoritative scrub field list)
    - /Users/machado/Projects/folhario/.planning/phases/01-foundation/01-FILE-MATRIX.md (confirms this module is single-sourced here; 05b consumes it)
  </read_first>
  <behavior>
    - Test 1: `makeBeforeSend()` applied to `{ request: { url: "/api/v1/identifications/abc", data: {...} } }` → returned event has `request.data === undefined`
    - Test 2: `makeBeforeSend()` applied to `{ request: { url: "/api/v1/users", data: { email: "x" } } }` → returned event has `request.data.email === "[scrubbed]"` (NOT dropped entirely)
    - Test 3: `makeBeforeSend()` scrubs every SCRUB_FIELD from `request.headers` (case-insensitive)
    - Test 4: `makeBeforeSend()` sets `request.cookies = undefined`
    - Test 5: `makeBeforeSend()` deletes `event.user.email`, `event.user.username`, `event.user.ip_address`
    - Test 6: `makeBeforeSend()` scrubs forbidden fields in nested `extra` objects (recursive)
    - Test 7: `makeBeforeSend()` scrubs forbidden fields inside arrays within `extra`
    - Test 8: `makeBeforeSend()` scrubs `contexts` recursively (password example)
    - Test 9: `makeBeforeBreadcrumb()` scrubs forbidden fields from `breadcrumb.data`
    - Test 10: `scrubHeaders(undefined)` returns undefined without throwing
    - Test 11: `scrubObject(null)` returns null; `scrubObject(42)` returns 42; `scrubObject("foo")` returns "foo"; `scrubObject(true)` returns true
    - Test 12: `SCRUB_FIELDS` constant exports exactly: authorization, cookie, email, password, token, photo_url
  </behavior>
  <action>
RED phase:

Step 1 — Write `tests/unit/sentry-scrub.test.ts`. Exhaustive coverage of all 12 behaviors:

```typescript
// tests/unit/sentry-scrub.test.ts
// LGPD-13 load-bearing: asserts PRD §13.7 scrubbing contract end-to-end on synthetic events.

import { describe, it, expect } from "vitest";
import {
  makeBeforeSend,
  makeBeforeBreadcrumb,
  scrubHeaders,
  scrubObject,
  SCRUB_FIELDS,
} from "@shared/telemetry/sentry-scrub";

describe("LGPD-13 SCRUB_FIELDS contract (PRD §13.7)", () => {
  it("exports exactly the 6 required fields", () => {
    const expected = ["authorization", "cookie", "email", "password", "token", "photo_url"];
    expect([...SCRUB_FIELDS].sort()).toEqual(expected.sort());
  });
});

describe("LGPD-13 makeBeforeSend — request body drop on /api/v1/identifications/*", () => {
  it("drops request.data on /api/v1/identifications/abc", () => {
    const event: any = {
      request: { url: "http://localhost/api/v1/identifications/abc", data: { foo: "bar", email: "x@y" } },
    };
    const out = makeBeforeSend()(event);
    expect(out.request.data).toBeUndefined();
  });

  it("drops request.data on /api/v1/identifications (no trailing slash)", () => {
    const event: any = {
      request: { url: "http://localhost/api/v1/identifications", data: { foo: "bar" } },
    };
    const out = makeBeforeSend()(event);
    expect(out.request.data).toBeUndefined();
  });

  it("does NOT drop request.data on /api/v1/users (scrubs instead)", () => {
    const event: any = {
      request: { url: "http://localhost/api/v1/users", data: { email: "x@y", ok: 1 } },
    };
    const out = makeBeforeSend()(event);
    expect(out.request.data).toBeDefined();
    expect(out.request.data.email).toBe("[scrubbed]");
    expect(out.request.data.ok).toBe(1);
  });
});

describe("LGPD-13 makeBeforeSend — header + cookie scrubbing", () => {
  it("scrubs forbidden headers case-insensitively", () => {
    const event: any = {
      request: {
        url: "http://localhost/api/v1/users",
        headers: {
          Authorization: "Bearer x",
          cookie: "s=abc",
          "X-Other": "keep-me",
          EMAIL: "nope",
        },
      },
    };
    const out = makeBeforeSend()(event);
    expect(out.request.headers.Authorization).toBe("[scrubbed]");
    expect(out.request.headers.cookie).toBe("[scrubbed]");
    expect(out.request.headers.EMAIL).toBe("[scrubbed]");
    expect(out.request.headers["X-Other"]).toBe("keep-me");
  });

  it("sets request.cookies = undefined", () => {
    const event: any = {
      request: { url: "http://localhost/", cookies: { session: "abc" } },
    };
    const out = makeBeforeSend()(event);
    expect(out.request.cookies).toBeUndefined();
  });
});

describe("LGPD-13 makeBeforeSend — user identity hardening (C-24)", () => {
  it("deletes user.email / user.username / user.ip_address", () => {
    const event: any = {
      user: { id: "u1", email: "x@y", username: "x", ip_address: "1.2.3.4" },
    };
    const out = makeBeforeSend()(event);
    expect(out.user.email).toBeUndefined();
    expect(out.user.username).toBeUndefined();
    expect(out.user.ip_address).toBeUndefined();
    expect(out.user.id).toBe("u1"); // id preserved (setUser({ id }) only)
  });
});

describe("LGPD-13 makeBeforeSend — recursive scrubbing in extra + contexts", () => {
  it("scrubs nested objects in extra", () => {
    const event: any = {
      extra: {
        level1: { email: "a@b", safe: 1, level2: { token: "t" } },
      },
    };
    const out = makeBeforeSend()(event);
    expect(out.extra.level1.email).toBe("[scrubbed]");
    expect(out.extra.level1.safe).toBe(1);
    expect(out.extra.level1.level2.token).toBe("[scrubbed]");
  });

  it("scrubs arrays of objects in extra", () => {
    const event: any = {
      extra: { users: [{ email: "a" }, { email: "b", ok: true }] },
    };
    const out = makeBeforeSend()(event);
    expect(out.extra.users[0].email).toBe("[scrubbed]");
    expect(out.extra.users[1].email).toBe("[scrubbed]");
    expect(out.extra.users[1].ok).toBe(true);
  });

  it("scrubs contexts recursively", () => {
    const event: any = {
      contexts: { meta: { password: "hunter2" } },
    };
    const out = makeBeforeSend()(event);
    expect(out.contexts.meta.password).toBe("[scrubbed]");
  });
});

describe("LGPD-13 makeBeforeBreadcrumb", () => {
  it("scrubs forbidden fields in breadcrumb.data", () => {
    const bc: any = { data: { email: "x@y", token: "t", other: 1 } };
    const out = makeBeforeBreadcrumb()(bc);
    expect(out.data.email).toBe("[scrubbed]");
    expect(out.data.token).toBe("[scrubbed]");
    expect(out.data.other).toBe(1);
  });

  it("passes through breadcrumbs with no data", () => {
    const bc: any = { message: "navigation", category: "ui" };
    const out = makeBeforeBreadcrumb()(bc);
    expect(out).toEqual(bc);
  });
});

describe("LGPD-13 helper edge cases", () => {
  it("scrubHeaders(undefined) returns undefined", () => {
    expect(scrubHeaders(undefined)).toBeUndefined();
  });

  it("scrubObject passes through primitives", () => {
    expect(scrubObject(null)).toBeNull();
    expect(scrubObject(42)).toBe(42);
    expect(scrubObject("foo")).toBe("foo");
    expect(scrubObject(true)).toBe(true);
  });

  it("scrubObject handles empty object", () => {
    expect(scrubObject({})).toEqual({});
  });
});
```

Step 2 — RED verification: `pnpm test:unit -- tests/unit/sentry-scrub.test.ts` MUST fail (module does not yet exist — import error).

Commit:
```bash
git add tests/unit/sentry-scrub.test.ts
git commit -m "test(01-05a): LGPD-13 load-bearing test for Sentry scrub helpers (RED)"
```

GREEN phase:

Step 3 — Create `src/shared/telemetry/sentry-scrub.ts` — the minimal implementation that passes all 12 behaviors:

```typescript
// src/shared/telemetry/sentry-scrub.ts
// LGPD-13 load-bearing: scrub helpers consumed by all three Sentry init files in Plan 05b.
// Source: PRD §13.7 + CLAUDE.md C-24 + Sentry Next.js filtering docs.

export const SCRUB_FIELDS = [
  "authorization",
  "cookie",
  "email",
  "password",
  "token",
  "photo_url",
] as const;

const SCRUB_SET: ReadonlySet<string> = new Set(SCRUB_FIELDS);
const IDENTIFICATION_PATH = /\/api\/v1\/identifications(\/|$)/;

function isScrubKey(k: string): boolean {
  return SCRUB_SET.has(k.toLowerCase());
}

export function scrubHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = isScrubKey(k) ? "[scrubbed]" : v;
  }
  return out;
}

export function scrubObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(scrubObject);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = isScrubKey(k) ? "[scrubbed]" : scrubObject(v);
  }
  return out;
}

type SentryEvent = {
  user?: { id?: string; email?: string; username?: string; ip_address?: string };
  request?: {
    url?: string;
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
    method?: string;
  };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
};

type SentryBreadcrumb = {
  data?: Record<string, unknown>;
  message?: string;
  category?: string;
};

export function makeBeforeSend() {
  return (event: SentryEvent): SentryEvent => {
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

    if (event.extra) event.extra = scrubObject(event.extra) as Record<string, unknown>;
    if (event.contexts) event.contexts = scrubObject(event.contexts) as Record<string, unknown>;

    return event;
  };
}

export function makeBeforeBreadcrumb() {
  return (breadcrumb: SentryBreadcrumb): SentryBreadcrumb => {
    if (breadcrumb.data) {
      breadcrumb.data = scrubObject(breadcrumb.data) as Record<string, unknown>;
    }
    return breadcrumb;
  };
}
```

Step 4 — Run `pnpm test:unit -- tests/unit/sentry-scrub.test.ts` — MUST pass.
Step 5 — Run `pnpm typecheck` — MUST pass.

Commit:
```bash
git add src/shared/telemetry/sentry-scrub.ts
git commit -m "feat(01-05a): implement LGPD-13 Sentry scrub helpers (GREEN)"
```

REFACTOR phase — only if the GREEN code has obvious duplication or readability issues. The implementation above is already minimal and direct; if you see nothing to clean, skip REFACTOR and note "no refactor needed — GREEN is minimal" in the 05a SUMMARY.
  </action>
  <verify>
    <automated>pnpm test:unit -- tests/unit/sentry-scrub.test.ts && grep -q "export const SCRUB_FIELDS" src/shared/telemetry/sentry-scrub.ts && grep -q "IDENTIFICATION_PATH" src/shared/telemetry/sentry-scrub.ts && grep -q "export function makeBeforeSend" src/shared/telemetry/sentry-scrub.ts && grep -q "export function makeBeforeBreadcrumb" src/shared/telemetry/sentry-scrub.ts && grep -q "export function scrubHeaders" src/shared/telemetry/sentry-scrub.ts && grep -q "export function scrubObject" src/shared/telemetry/sentry-scrub.ts && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test:unit -- tests/unit/sentry-scrub.test.ts` exits 0 with ≥12 tests passed
    - `grep -c "^export" src/shared/telemetry/sentry-scrub.ts` returns ≥5 (5 named exports)
    - `grep -q "as const" src/shared/telemetry/sentry-scrub.ts` matches (SCRUB_FIELDS is a readonly tuple)
    - Two atomic commits present: one with `test(01-05a)` prefix (RED), one with `feat(01-05a)` prefix (GREEN). Run: `git log --oneline | grep -E "01-05a" | wc -l` returns ≥2.
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    - `tests/unit/sentry-scrub.test.ts` passes with ≥15 assertions across 12 behaviors
    - `src/shared/telemetry/sentry-scrub.ts` exports `SCRUB_FIELDS`, `makeBeforeSend`, `makeBeforeBreadcrumb`, `scrubHeaders`, `scrubObject`
    - Forbidden fields scrubbed in headers, data, extra, contexts (case-insensitive)
    - Identification path drops body entirely
    - User email/username/ip deleted
    - Two atomic commits: RED → GREEN
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| App runtime → Sentry ingest | All user data in events crosses here; scrub rules are the last defense |
| Sentry breadcrumbs | Automatic trail — must not accumulate PII |
| User identity → Sentry context | Only `id` allowed; email/username/ip never leave |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05a-01 (T-1 HIGH) | Information Disclosure | Sentry leaking `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`, or identification request body | mitigate | LGPD-13 load-bearing unit test covers 12 behaviors; 6 forbidden fields scrubbed case-insensitively; path-aware body drop on `/api/v1/identifications/*`; user-identity stripping. The scrub MODULE is verified here; the init-file WIRING that consumes it is verified in Plan 05b. |
| T-05a-02 | Tampering | Regex bypass for identification path (e.g. `/api/v1/identifications_foo`) | mitigate | `IDENTIFICATION_PATH` regex uses `(\/|$)` boundary — matches `/api/v1/identifications`, `/api/v1/identifications/`, `/api/v1/identifications/abc`, does NOT match `/api/v1/identifications_foo`. Test coverage includes both with-slash and no-slash forms. |
| T-05a-03 | Information Disclosure | Case variant bypass (`Email`, `EMAIL`) | mitigate | `isScrubKey` lowercases before Set lookup; Test 3 explicitly exercises `EMAIL` and `Authorization` mixed case. |

Threats deferred to Plan 05b: transport-path empty-DSN posture (D-19), init-file `sendDefaultPii: false` pinning (L-2 / CVE-2025-65944), `src/instrumentation.ts` try/catch removal.
</threat_model>

<verification>
1. `pnpm test:unit -- tests/unit/sentry-scrub.test.ts` passes with ≥15 assertions across ≥12 tests.
2. `pnpm typecheck` exits 0.
3. Module public surface matches the contract in `<interfaces>` — all 5 exports present.
4. Two atomic commits with `01-05a` scope prefix (RED + GREEN).
</verification>

<success_criteria>
- [ ] `src/shared/telemetry/sentry-scrub.ts` exports `SCRUB_FIELDS`, `makeBeforeSend`, `makeBeforeBreadcrumb`, `scrubHeaders`, `scrubObject`
- [ ] Scrubber drops request body on `/api/v1/identifications/*` (LGPD-13)
- [ ] Scrubber removes 6 forbidden fields (authorization, cookie, email, password, token, photo_url) from headers, data, extra, contexts (case-insensitive)
- [ ] Scrubber deletes `event.user.email/.username/.ip_address` (C-24)
- [ ] `tests/unit/sentry-scrub.test.ts` passes (≥15 assertions, ≥12 tests)
- [ ] Two atomic commits: RED (failing test) + GREEN (passing implementation)
- [ ] `pnpm typecheck` exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-05a-SUMMARY.md` documenting:
- LGPD-13 test coverage summary (12 behaviors, all scrub fields exercised)
- Commit SHAs for RED + GREEN (and REFACTOR if taken)
- REFACTOR decision (taken / "no refactor needed — GREEN is minimal")
- Module public surface as shipped (for Plan 05b to consume without re-reading this file)
- Reference to Plan 05b which wires this module into three Sentry init files
</output>
