import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { clientEnv } from "@shared/config/client-env";

/**
 * Phase 4 RESEARCH.md Pattern 5 + Pitfall 6.
 *
 * INTERNAL to `@contexts/iam/infrastructure/auth/auth-adapter` — no other
 * module may import this file. Codex HIGH #3: application-layer code goes
 * through `authAdapter.X()`, never `@supabase/*` directly.
 *
 * Two clients exist because Server Components in Next 16 cannot mutate
 * cookies (Pitfall 6 — `cookieStore.set()` throws there). The full client
 * is for Route Handlers / Server Actions; the read-only variant is for
 * Server Components, where the no-op `setAll` swallows refresh attempts
 * silently rather than crashing the render.
 */

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
