// Phase 4 plan 06 (Wave-1 reconciliation per 04-PREREQ-AUDIT amendment).
//
// Resolves the two active `policy_versions` rows the user implicitly
// accepts at signup. Returns null if either documentType is missing an
// `is_current=true` row (deployment misconfig — the
// `seedCurrentPolicyVersions` fixture seeds both rows). Signup
// transaction must throw and rollback in that case so the compensating
// `authAdapter.adminDeleteUser` runs.

import { sql } from "drizzle-orm";

import { db } from "@shared/db/client";
import { type DbOrTx } from "@contexts/iam/infrastructure/db/types";

export interface CurrentPolicyVersions {
  tos: { id: string; version: string };
  privacy: { id: string; version: string };
}

export async function getCurrentPolicyVersions(
  dbOrTx: DbOrTx = db,
): Promise<CurrentPolicyVersions | null> {
  const rows = await dbOrTx.execute<{
    id: string;
    version: string;
    document_type: "terms_of_service" | "privacy_policy";
  }>(
    sql`SELECT id, version, document_type
          FROM public.policy_versions
         WHERE is_current = true
           AND document_type IN ('terms_of_service','privacy_policy')`,
  );
  const tos = rows.find((r) => r.document_type === "terms_of_service");
  const privacy = rows.find((r) => r.document_type === "privacy_policy");
  if (!tos || !privacy) return null;
  return {
    tos: { id: tos.id, version: tos.version },
    privacy: { id: privacy.id, version: privacy.version },
  };
}
