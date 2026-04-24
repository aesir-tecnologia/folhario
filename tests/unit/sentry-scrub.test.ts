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

type TestEvent = {
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

type TestBreadcrumb = {
  data?: Record<string, unknown>;
  message?: string;
  category?: string;
};

function asRec(v: unknown): Record<string, unknown> {
  return v as Record<string, unknown>;
}

describe("LGPD-13 SCRUB_FIELDS contract (PRD §13.7)", () => {
  it("exports exactly the 6 required fields", () => {
    const expected = ["authorization", "cookie", "email", "password", "token", "photo_url"];
    expect([...SCRUB_FIELDS].sort()).toEqual(expected.sort());
  });
});

describe("LGPD-13 makeBeforeSend — request body drop on /api/v1/identifications/*", () => {
  it("drops request.data on /api/v1/identifications/abc", () => {
    const event: TestEvent = {
      request: {
        url: "http://localhost/api/v1/identifications/abc",
        data: { foo: "bar", email: "x@y" },
      },
    };
    const out = makeBeforeSend()(event) as TestEvent;
    expect(out.request?.data).toBeUndefined();
  });

  it("drops request.data on /api/v1/identifications (no trailing slash)", () => {
    const event: TestEvent = {
      request: { url: "http://localhost/api/v1/identifications", data: { foo: "bar" } },
    };
    const out = makeBeforeSend()(event) as TestEvent;
    expect(out.request?.data).toBeUndefined();
  });

  it("does NOT drop request.data on /api/v1/users (scrubs instead)", () => {
    const event: TestEvent = {
      request: { url: "http://localhost/api/v1/users", data: { email: "x@y", ok: 1 } },
    };
    const out = makeBeforeSend()(event) as TestEvent;
    expect(out.request?.data).toBeDefined();
    const data = asRec(out.request?.data);
    expect(data.email).toBe("[scrubbed]");
    expect(data.ok).toBe(1);
  });
});

describe("LGPD-13 makeBeforeSend — header + cookie scrubbing", () => {
  it("scrubs forbidden headers case-insensitively", () => {
    const event: TestEvent = {
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
    const out = makeBeforeSend()(event) as TestEvent;
    const headers = out.request?.headers ?? {};
    expect(headers.Authorization).toBe("[scrubbed]");
    expect(headers.cookie).toBe("[scrubbed]");
    expect(headers.EMAIL).toBe("[scrubbed]");
    expect(headers["X-Other"]).toBe("keep-me");
  });

  it("sets request.cookies = undefined", () => {
    const event: TestEvent = {
      request: { url: "http://localhost/", cookies: { session: "abc" } },
    };
    const out = makeBeforeSend()(event) as TestEvent;
    expect(out.request?.cookies).toBeUndefined();
  });
});

describe("LGPD-13 makeBeforeSend — user identity hardening (C-24)", () => {
  it("deletes user.email / user.username / user.ip_address", () => {
    const event: TestEvent = {
      user: { id: "u1", email: "x@y", username: "x", ip_address: "1.2.3.4" },
    };
    const out = makeBeforeSend()(event) as TestEvent;
    expect(out.user?.email).toBeUndefined();
    expect(out.user?.username).toBeUndefined();
    expect(out.user?.ip_address).toBeUndefined();
    expect(out.user?.id).toBe("u1");
  });
});

describe("LGPD-13 makeBeforeSend — recursive scrubbing in extra + contexts", () => {
  it("scrubs nested objects in extra", () => {
    const event: TestEvent = {
      extra: {
        level1: { email: "a@b", safe: 1, level2: { token: "t" } },
      },
    };
    const out = makeBeforeSend()(event) as TestEvent;
    const level1 = asRec(out.extra?.level1);
    expect(level1.email).toBe("[scrubbed]");
    expect(level1.safe).toBe(1);
    const level2 = asRec(level1.level2);
    expect(level2.token).toBe("[scrubbed]");
  });

  it("scrubs arrays of objects in extra", () => {
    const event: TestEvent = {
      extra: { users: [{ email: "a" }, { email: "b", ok: true }] },
    };
    const out = makeBeforeSend()(event) as TestEvent;
    const users = out.extra?.users as Array<Record<string, unknown>>;
    expect(users[0]?.email).toBe("[scrubbed]");
    expect(users[1]?.email).toBe("[scrubbed]");
    expect(users[1]?.ok).toBe(true);
  });

  it("scrubs contexts recursively", () => {
    const event: TestEvent = {
      contexts: { meta: { password: "hunter2" } },
    };
    const out = makeBeforeSend()(event) as TestEvent;
    const meta = asRec(out.contexts?.meta);
    expect(meta.password).toBe("[scrubbed]");
  });
});

describe("LGPD-13 makeBeforeBreadcrumb", () => {
  it("scrubs forbidden fields in breadcrumb.data", () => {
    const bc: TestBreadcrumb = { data: { email: "x@y", token: "t", other: 1 } };
    const out = makeBeforeBreadcrumb()(bc) as TestBreadcrumb;
    expect(out.data?.email).toBe("[scrubbed]");
    expect(out.data?.token).toBe("[scrubbed]");
    expect(out.data?.other).toBe(1);
  });

  it("passes through breadcrumbs with no data", () => {
    const bc: TestBreadcrumb = { message: "navigation", category: "ui" };
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
