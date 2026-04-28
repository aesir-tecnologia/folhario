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

/**
 * Re-uses the SEEDED policy_versions rows from drizzle/seeds/phase-02.sql
 * (version `2026-04-25.1`, both `terms_of_service` and `privacy_policy`,
 * is_current=true). The partial unique index `policy_versions_one_current_per_doc_type_idx`
 * makes adding a NEW is_current=true row impossible without first
 * unsetting the seeded one — which would in turn break the seed-data
 * integration test. Concurrent test files calling this helper resolve
 * to the same two rows, so isolation comes from per-test unique uuid emails
 * (rows in users/consent_logs/etc), not from policy_versions wipe-and-reinsert.
 *
 * If a row is missing (e.g. `pnpm db:seed` not yet run), this helper
 * inserts `version='1.0'` as a fallback so the test suite still works on
 * a freshly-migrated database without seed.
 */
export async function seedCurrentPolicyVersions(): Promise<SeededPolicyVersions> {
  const sql = postgres(process.env.DATABASE_POOL_URL!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });
  try {
    let tos = await sql<{ id: string; version: string }[]>`
      SELECT id, version FROM policy_versions
       WHERE document_type = 'terms_of_service' AND is_current = true
       LIMIT 1
    `;
    let privacy = await sql<{ id: string; version: string }[]>`
      SELECT id, version FROM policy_versions
       WHERE document_type = 'privacy_policy' AND is_current = true
       LIMIT 1
    `;

    // Fallback: no seeded current row → insert version 1.0 (only when the
    // partial unique index has no conflicting row).
    if (tos.length === 0) {
      tos = await sql<{ id: string; version: string }[]>`
        INSERT INTO policy_versions (version, document_type, effective_at, is_current)
        VALUES ('1.0', 'terms_of_service', now(), true)
        ON CONFLICT (document_type, version) DO UPDATE SET is_current = true
        RETURNING id, version
      `;
    }
    if (privacy.length === 0) {
      privacy = await sql<{ id: string; version: string }[]>`
        INSERT INTO policy_versions (version, document_type, effective_at, is_current)
        VALUES ('1.0', 'privacy_policy', now(), true)
        ON CONFLICT (document_type, version) DO UPDATE SET is_current = true
        RETURNING id, version
      `;
    }

    return {
      termsOfService: tos[0]!,
      privacyPolicy: privacy[0]!,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
