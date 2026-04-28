// Phase 4 plan 08 — TEST-ONLY repository helpers used by Playwright
// diagnostics endpoints (gated by NODE_ENV !== "production" AND
// IDENTIFICATION_PROVIDER_MODE === "stub" at the route layer).
//
// Lives in infrastructure/db so the D-17 / T-02-11 guard
// (tests/unit/no-drizzle-in-routes.test.ts) keeps route handlers free of
// raw Drizzle / @shared/db/client imports. The route calls this helper
// (an exported function), not Drizzle directly.

import { sql } from "drizzle-orm";

import { db } from "@shared/db/client";

export async function upsertVerifiedTestUser(input: {
  id: string;
  email: string;
  timezone: string;
}): Promise<void> {
  await db.execute(
    sql`INSERT INTO public.users (id, email, age_confirmed_at, timezone, trial_source, name, email_verified_at)
        VALUES (
          ${input.id},
          ${input.email},
          now(),
          ${input.timezone},
          'organic',
          COALESCE(split_part(${input.email}::text, '@', 1), 'user'),
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          age_confirmed_at = EXCLUDED.age_confirmed_at,
          timezone = EXCLUDED.timezone,
          email_verified_at = EXCLUDED.email_verified_at,
          updated_at = now()`,
  );
}
