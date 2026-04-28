import { createClient } from "@supabase/supabase-js";

import { clientEnv } from "@shared/config/client-env";
import { serverEnv } from "@shared/config/server-env";

/**
 * Phase 4 RESEARCH.md Pattern 6 — service-role admin client.
 *
 * INTERNAL to `@contexts/iam/infrastructure/auth/auth-adapter` (Codex HIGH #3).
 * Application-layer code never imports this directly; the AuthAdapter is the
 * single boundary for `auth.admin.*` calls (createUser, deleteUser,
 * updateUserById).
 *
 * `persistSession: false` + `autoRefreshToken: false` because the admin
 * client runs server-side per request and never holds a user session.
 */

export const supabaseAdmin = createClient(
  clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
