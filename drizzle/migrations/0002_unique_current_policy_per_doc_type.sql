-- WR-03: enforce at most one is_current = true row per document_type so
-- the consent chain-of-custody is deterministic. The application-level
-- query in `src/contexts/iam/application/record-consent.ts` selects
-- `eq(documentType, ...)` AND `eq(isCurrent, true)`, then `.limit(1)`
-- with no orderBy — without this constraint, two current rows would
-- silently make the picked policy non-deterministic and consent rows
-- could reference different policy versions for the same legal grant.
--
-- LGPD record-keeping requires that a consent log row points at exactly
-- the policy text in force at the moment of the grant; this index makes
-- "exactly one current row per document_type" a hard DB invariant.
--
-- Idempotent: `IF NOT EXISTS` ensures double-apply is a no-op.

CREATE UNIQUE INDEX IF NOT EXISTS policy_versions_one_current_per_doc_type_idx
  ON public.policy_versions (document_type)
  WHERE is_current = true;
