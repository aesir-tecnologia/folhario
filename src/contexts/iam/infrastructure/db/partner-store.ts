// Phase 4 D-32 — PartnerStore validation at signup.
//
// Plan 06 reads against `partner_stores` (plural — actual Phase 2 schema).
// Returns true iff a row exists with the given code AND `is_active = true`.

import { sql } from "drizzle-orm";

import { db } from "@shared/db/client";
import { type DbOrTx } from "@contexts/iam/infrastructure/db/types";

export async function isPartnerCodeActive(code: string, dbOrTx: DbOrTx = db): Promise<boolean> {
  const rows = await dbOrTx.execute<{ exists: number }>(
    sql`SELECT 1 AS exists
          FROM public.partner_stores
         WHERE code = ${code} AND is_active = true
         LIMIT 1`,
  );
  return rows.length > 0;
}
