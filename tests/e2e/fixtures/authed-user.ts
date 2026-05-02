// TEST-ONLY. This file MUST NOT be imported from `src/`.
// The service-role key is read indirectly via seedUser;
// production builds never load `tests/`.
/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import postgres from "postgres";

import { seedUser } from "../../integration/fixtures/seed-user";
import { seedCurrentPolicyVersions } from "../../integration/fixtures/seed-policy-version";

const dbUrl = process.env.DATABASE_POOL_URL;
if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to use authedUser fixture against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}

export type AuthedUser = { id: string; email: string; accessToken: string };

export const test = base.extend<{ authedUser: AuthedUser }>({
  authedUser: async ({ context }, use) => {
    const email = `playwright-authed-${Date.now()}-${Math.random().toString(16).slice(2)}@folhario.test`;
    const password = "TestPassword123!";

    const { id: userId } = await seedUser({
      email,
      password,
      emailVerifiedAt: new Date().toISOString(),
      ageConfirmedAt: new Date().toISOString(),
      trialSource: "organic",
    });

    const policyVersions = await seedCurrentPolicyVersions();

    const sql = postgres(process.env.DATABASE_POOL_URL!, {
      prepare: false,
      max: 1,
      idle_timeout: 5,
    });
    try {
      await sql`
        INSERT INTO consent_logs (user_id, purpose, legal_basis, source, policy_version_id, granted_at)
        VALUES
          (${userId}, 'signup_acceptance', 'contract', 'signup', ${policyVersions.termsOfService.id}, now()),
          (${userId}, 'signup_acceptance', 'contract', 'signup', ${policyVersions.privacyPolicy.id},  now())
      `;

      await sql`
        INSERT INTO subscriptions (user_id, provider, status, trial_start_date, trial_end_date)
        VALUES (${userId}, 'stripe', 'trialing', NOW(), NOW() + INTERVAL '14 days')
      `;
    } finally {
      await sql.end({ timeout: 5 });
    }

    const capturedCookies: { name: string; value: string; options?: Record<string, unknown> }[] =
      [];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll(cookiesToSet) {
            capturedCookies.push(...cookiesToSet);
          },
        },
      },
    );

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(`authedUser fixture: signInWithPassword failed: ${error.message}`);
    }
    const accessToken = signInData?.session?.access_token;
    if (!accessToken) {
      throw new Error("authedUser fixture: signInWithPassword returned no access_token");
    }

    await context.addCookies(
      capturedCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      })),
    );

    await use({ id: userId, email, accessToken });

    const cleanupSql = postgres(process.env.DATABASE_POOL_URL!, {
      prepare: false,
      max: 1,
      idle_timeout: 5,
    });
    try {
      await cleanupSql`DELETE FROM public.users WHERE id = ${userId}`;
    } catch {
      // tolerate missing row
    }
    const supabaseAdmin = (await import("@supabase/supabase-js")).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await cleanupSql.end({ timeout: 5 });
  },
});

export { expect };
