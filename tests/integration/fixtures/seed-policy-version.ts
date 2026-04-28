// Phase 4 Wave-1 reconciliation: seeds the active T&C and Privacy
// policy_versions rows so signup flows can record consent against a
// real policy_version_id.
//
// Schema (per src/contexts/iam/infrastructure/db/schema.ts):
//   policy_versions(id, version, document_type, effective_at, is_current, created_at)
//   document_type enum: 'privacy_policy' | 'terms_of_service'
//
// Plan 06's signup writes 2 consent_logs rows with purpose='signup_acceptance'
// distinguished by policy_version_id → policy_versions.documentType. The
// helper returns both ids so tests can assert the JOIN cleanly.

import postgres from "postgres";

export type SeededPolicyVersions = {
  termsOfService: { id: string; version: string };
  privacyPolicy: { id: string; version: string };
};

export async function seedCurrentPolicyVersions(
  version: string = "1.0",
): Promise<SeededPolicyVersions> {
  const sql = postgres(process.env.DATABASE_POOL_URL!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });
  try {
    // Stamp prior current versions as superseded.
    await sql`UPDATE policy_versions SET is_current = false WHERE is_current = true`;

    const tos = await sql<{ id: string; version: string }[]>`
      INSERT INTO policy_versions (version, document_type, effective_at, is_current)
      VALUES (${version}, 'terms_of_service', now(), true)
      RETURNING id, version
    `;
    const privacy = await sql<{ id: string; version: string }[]>`
      INSERT INTO policy_versions (version, document_type, effective_at, is_current)
      VALUES (${version}, 'privacy_policy', now(), true)
      RETURNING id, version
    `;

    return {
      termsOfService: tos[0]!,
      privacyPolicy: privacy[0]!,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
