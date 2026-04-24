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
        event.request.data = undefined;
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
