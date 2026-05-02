// Phase 4 plan 06 — AUTH-09 consent_logs at signup (Wave-1 reconciliation).
//
// Asserts the JOIN pattern documented in the plan acceptance criterion:
//
//   SELECT cl.id, pv.document_type
//     FROM consent_logs cl
//     JOIN policy_versions pv ON pv.id = cl.policy_version_id
//    WHERE cl.user_id = $1
//      AND cl.purpose = 'signup_acceptance'
//      AND cl.source  = 'signup';
//
// Must return exactly 2 rows whose `document_type` set equals
// {terms_of_service, privacy_policy} — both rows write
// `purpose='signup_acceptance'`; the legal-doc identity rides on
// `policy_version_id` (Phase 4 PREREQ-AUDIT amendment).

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { supabaseAuthAvailable } from "./fixtures/supabase-availability";
import postgres from "postgres";

import { seedCurrentPolicyVersions } from "./fixtures/seed-policy-version";
import { installInngestMock, resetInngestMock } from "./fixtures/mock-inngest";

installInngestMock();

const dbUrl = process.env.DATABASE_POOL_URL;
if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}
const cleanupSql = dbUrl ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 }) : null;

describe.skipIf(!dbUrl || !supabaseAuthAvailable)(
  "Phase 4 AUTH-09 — consent_logs at signup (Wave-1 reconciliation)",
  () => {
    let signupModule: typeof import("@contexts/iam/application/signup");
    let seeded: { termsOfService: { id: string }; privacyPolicy: { id: string } };

    beforeAll(async () => {
      seeded = await seedCurrentPolicyVersions();
      signupModule = await import("@contexts/iam/application/signup");
    });

    beforeEach(() => {
      resetInngestMock();
    });

    afterAll(async () => {
      if (cleanupSql) await cleanupSql.end({ timeout: 5 });
    });

    it("writes exactly 2 rows; JOIN to policy_versions resolves to T&C + Privacy doc types", async () => {
      const email = `consent-${randomUUID()}@test.local`;
      const result = await signupModule.signupUser(
        {
          email,
          password: "SuperSecret123!",
          age_confirmed: true,
          terms_accepted: true,
          privacy_accepted: true,
          timezone: "America/Sao_Paulo",
        },
        new URL("http://localhost:3000/api/v1/iam/signup"),
      );
      expect(result.kind).toBe("created");
      if (result.kind !== "created") return;

      // The JOIN query the acceptance criterion documents:
      const rows = await cleanupSql!<
        {
          id: string;
          document_type: "terms_of_service" | "privacy_policy";
          purpose: string;
          source: string;
          legal_basis: string;
          granted_at: string | null;
          policy_version_id: string;
        }[]
      >`
      SELECT cl.id, pv.document_type, cl.purpose, cl.source, cl.legal_basis,
             cl.granted_at, cl.policy_version_id
        FROM public.consent_logs cl
        JOIN public.policy_versions pv ON pv.id = cl.policy_version_id
       WHERE cl.user_id = ${result.userId}
         AND cl.purpose = 'signup_acceptance'
         AND cl.source  = 'signup'
       ORDER BY pv.document_type
    `;

      // Exactly 2 rows
      expect(rows).toHaveLength(2);

      // The 2 document_types map to {terms_of_service, privacy_policy}
      const docTypes = new Set(rows.map((r) => r.document_type));
      expect(docTypes).toEqual(new Set(["terms_of_service", "privacy_policy"]));

      // Each row references a DISTINCT policy_version_id matching the seeded ones
      const seenVersionIds = new Set(rows.map((r) => r.policy_version_id));
      expect(seenVersionIds).toEqual(new Set([seeded.termsOfService.id, seeded.privacyPolicy.id]));

      // Universal row properties
      rows.forEach((r) => {
        expect(r.purpose).toBe("signup_acceptance");
        expect(r.source).toBe("signup");
        expect(r.legal_basis).toBe("contract");
        expect(r.granted_at).not.toBeNull();
      });
    });
  },
);
