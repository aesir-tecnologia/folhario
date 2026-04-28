// Phase 4 D-28 + D-22: seeds a user via Supabase admin.createUser
// (auth.users) AND an IAM public.users row so integration tests can
// authenticate as that user via Supabase SSR cookies.

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

export type SeedUserOptions = {
  email: string;
  password: string;
  /** ISO-8601 timestamp; null = unverified (D-22 product source of truth). */
  emailVerifiedAt?: string | null;
  /** ISO-8601 timestamp; defaults to now() for tests that don't care. */
  ageConfirmedAt?: string | null;
  timezone?: string;
  name?: string;
  trialSource?: "organic" | "partner";
  partnerCode?: string | null;
};

export async function seedUser(opts: SeedUserOptions): Promise<{ id: string }> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true, // D-03: Folhário sends its own verification email
  });
  if (error || !data.user) {
    throw new Error(`seedUser admin.createUser failed: ${error?.message}`);
  }

  const sql = postgres(process.env.DATABASE_POOL_URL!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });
  try {
    const ageConfirmed = opts.ageConfirmedAt ?? new Date().toISOString();
    await sql`
      INSERT INTO users (
        id, email, email_verified_at, age_confirmed_at, timezone, name,
        trial_source, partner_code
      )
      VALUES (
        ${data.user.id},
        ${opts.email},
        ${opts.emailVerifiedAt ?? null},
        ${ageConfirmed},
        ${opts.timezone ?? "America/Sao_Paulo"},
        ${opts.name ?? "Test User"},
        ${opts.trialSource ?? "organic"},
        ${opts.partnerCode ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        email_verified_at = EXCLUDED.email_verified_at,
        age_confirmed_at = EXCLUDED.age_confirmed_at,
        timezone = EXCLUDED.timezone,
        partner_code = EXCLUDED.partner_code
    `;
    return { id: data.user.id };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
