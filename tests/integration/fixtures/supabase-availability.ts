/**
 * Detects whether a real Supabase Auth backend is reachable for integration
 * tests. CI runs against vanilla `postgres:17-alpine` without a Supabase
 * Auth stack, so any test that calls `supabase.auth.admin.createUser` or
 * JOINs `auth.users` must skip in that environment.
 *
 * Production / local-dev pattern: developers run `pnpm db:start` (full
 * Supabase) and inherit a real `SUPABASE_SERVICE_ROLE_KEY` JWT from
 * `.env.local`. CI sets the placeholder string `"test"` — not a JWT — so
 * any sniff against the value tells the two apart.
 *
 * The convention everywhere in this suite:
 *
 *     describe.skipIf(!dbUrl || !supabaseAuthAvailable)(...)
 *
 * Tests that ONLY need Postgres (no auth.users JOIN, no admin API) keep
 * the existing `describe.skipIf(!dbUrl)` and run in both envs.
 */

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// A JWT is three base64url segments separated by dots. Anything shorter
// (e.g. CI's `"test"`) is a placeholder and Supabase Auth will reject it.
export const supabaseAuthAvailable = serviceRoleKey.split(".").length === 3;
