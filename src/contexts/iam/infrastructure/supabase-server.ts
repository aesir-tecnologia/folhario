import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { clientEnv } from "@shared/config/client-env";

/**
 * Phase 4 RESEARCH.md Pattern 5 + Pitfall 6.
 *
 * INTERNAL to `@contexts/iam/infrastructure/auth/auth-adapter` and the
 * Phase 4 plan 04-12 named helper `updateSessionInMiddleware` (consumed
 * by `src/proxy.ts`) — no other module may import this file. Codex HIGH
 * #3: application-layer code goes through `authAdapter.X()`, never
 * `@supabase/*` directly.
 *
 * Two Server-Component / Route-Handler clients exist because Server
 * Components in Next 16 cannot mutate cookies (Pitfall 6 —
 * `cookieStore.set()` throws there). The full client is for Route
 * Handlers / Server Actions; the read-only variant is for Server
 * Components, where the no-op `setAll` swallows refresh attempts
 * silently rather than crashing the render.
 *
 * The `updateSessionInMiddleware` export is a third client surface —
 * runs in Next.js middleware where neither the async cookies()/headers()
 * store nor cookie-write restrictions apply. Its cookie adapter reads
 * directly from `request.cookies`; the async-store import on line 1 is
 * NOT used by this helper. It refreshes/clears the Supabase auth cookie
 * BEFORE Server Components run so they never see a stale-cookie +
 * failed-refresh state (debug session
 * `publiclayout-auth-refresh-token-throw`).
 */

const SUPABASE_AUTH_TOKEN_COOKIE = /^sb-[^.]+-auth-token(?:\.\d+)?$/;

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}

/** Pitfall 6: Server Components cannot mutate cookies — no-op `setAll`. */
export async function getReadOnlySupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* read-only: refresh attempts become no-ops (Pitfall 6) */
        },
      },
    },
  );
}

/**
 * `@supabase/ssr` middleware cookie-refresh step (Phase 4 plan 04-12 +
 * debug session `publiclayout-auth-refresh-token-throw`).
 *
 * Implements the canonical `@supabase/ssr` Next.js middleware pattern,
 * consumed by `src/proxy.ts` for every non-API page request:
 *   - Builds a `NextResponse.next({ request })` so per-request headers
 *     and cookies flow through.
 *   - Constructs `createServerClient` with a cookie adapter that reads
 *     from the incoming `request` and writes to BOTH the request (so
 *     downstream handlers see refreshed cookies in the same request) and
 *     the response (so the browser receives the Set-Cookie header).
 *   - Calls `supabase.auth.getUser()` once. This triggers any pending
 *     refresh; valid sessions get refreshed cookies, stale sessions get
 *     cleared cookies.
 *
 * Codex HIGH #3 boundary preserved — this file is the SOLE module that
 * imports `@supabase/ssr.createServerClient`. `src/proxy.ts` imports
 * only this named helper, never `@supabase/ssr` directly.
 *
 * Pitfall 6 STILL applies to Server Components — that is why this helper
 * exists in middleware land, where `setAll` is allowed. The two factories
 * above (`getSupabaseServerClient`, `getReadOnlySupabaseServerClient`)
 * are unchanged; the read-only client's no-op `setAll` is intentional
 * and necessary for Server-Component renders.
 *
 * T-02-37 body discipline preserved — only `request.cookies` is touched,
 * never `request.body`.
 *
 * Defense-in-depth cookie clear: `@supabase/ssr@0.10.2` +
 * `@supabase/auth-js@2.104.1` does NOT propagate a clearing Set-Cookie
 * via the `setAll` adapter when `_recoverAndRefresh` fails (regression
 * spec `tests/e2e/auth-cold-start-stale-cookie.spec.ts` — empirical
 * finding from the second-pass fix in commit `fc820f7`). When `getUser`
 * returns a non-`AuthSessionMissingError` error we therefore clear every
 * `sb-*-auth-token` chunk explicitly. Idempotent — clearing absent
 * cookies is a no-op.
 *
 * Sentry tagging is `iam.updateSessionInMiddleware` (matches helper
 * location). The downstream `AuthAdapter.getUserBySession` does its own
 * tagging with `iam.getUserBySession`; the two surfaces are distinct
 * signals.
 */
export async function updateSessionInMiddleware(
  request: NextRequest,
): Promise<NextResponse> {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.getUser();

  if (error && !isAuthSessionMissingError(error)) {
    Sentry.captureException(error, {
      tags: { surface: "iam.updateSessionInMiddleware" },
    });
    for (const cookie of request.cookies.getAll()) {
      if (SUPABASE_AUTH_TOKEN_COOKIE.test(cookie.name)) {
        response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
      }
    }
  }

  return response;
}
