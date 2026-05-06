/**
 * Phase 6 advisory-lock namespace constant (D-05 / RESEARCH Pitfall 2).
 * Mnemonic: 6_000_000_06 = phase 6, owner 06.
 * Used as the first arg to `pg_try_advisory_xact_lock(namespace, hashtext(user_id))`.
 */
export const IDENT_LOCK_NAMESPACE = 6_000_000_06;
