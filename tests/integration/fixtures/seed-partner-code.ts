// Phase 4 D-32 PartnerStore validation at signup. Plans 06 + 09 consume.
//
// Schema (per src/contexts/iam/infrastructure/db/schema.ts:131-147):
//   partner_stores(id, name, code, trial_days, is_active, created_at, updated_at)
// Note plural table name — the plan template referenced 'partner_store'
// (singular); the actual table is 'partner_stores'.

import postgres from "postgres";

export async function seedActivePartnerCode(
  code: string = "TEST-PARTNER-30",
  name: string = "Test Partner",
  trialDays: number = 30,
): Promise<{ code: string }> {
  const sql = postgres(process.env.DATABASE_POOL_URL!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });
  try {
    await sql`
      INSERT INTO partner_stores (name, code, trial_days, is_active)
      VALUES (${name}, ${code}, ${trialDays}, true)
      ON CONFLICT (code)
        DO UPDATE SET is_active = true, name = EXCLUDED.name, trial_days = EXCLUDED.trial_days
    `;
    return { code };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function seedInactivePartnerCode(
  code: string = "TEST-PARTNER-INACTIVE",
  name: string = "Inactive Partner",
): Promise<{ code: string }> {
  const sql = postgres(process.env.DATABASE_POOL_URL!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });
  try {
    await sql`
      INSERT INTO partner_stores (name, code, trial_days, is_active)
      VALUES (${name}, ${code}, 30, false)
      ON CONFLICT (code)
        DO UPDATE SET is_active = false
    `;
    return { code };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
