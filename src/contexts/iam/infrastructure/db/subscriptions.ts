// Phase 4 plan 06 — D-25 trialing subscription row at signup.
//
// Plan template referenced columns (`trial_source`, `partner_code`) that
// don't exist on `public.subscriptions` (Phase 2 schema). Reality:
//   subscriptions(id, user_id, provider, provider_customer_id,
//                 provider_subscription_id, status, trial_start_date,
//                 trial_end_date, current_period_start, current_period_end,
//                 cancel_at_period_end, created_at, updated_at).
// `trial_source` + `partner_code` live on `public.users` (Phase 2). The
// `trialSource` parameter here is a function input that determines the
// trial duration ONLY (14 days organic / 30 days partner). The persisted
// source-of-truth is `users.trial_source`, set by `insertPublicUser`.
//
// `provider` defaults to 'stripe' per PROJECT.md (Stripe is the launch
// provider; the BillingProvider adapter swaps later).
//
// Codex HIGH #2: accepts `dbOrTx` so the signup use-case can wrap this
// with the user/consent/token writes in one transaction.

import { sql } from "drizzle-orm";

import { db } from "@shared/db/client";
import { type DbOrTx } from "@contexts/iam/infrastructure/db/types";

export interface InsertTrialingSubscriptionResult {
  id: string;
  trial_end_date: string;
  trial_source: "organic" | "partner";
}

export async function insertTrialingSubscription(
  opts: {
    userId: string;
    /** Persisted on `users.partner_code`; passed in here for symmetry with the plan API. */
    partnerCode: string | null;
    /** D-32: caller resolves after partner_store lookup. Drives trial duration. */
    trialSource: "organic" | "partner";
  },
  dbOrTx: DbOrTx = db,
): Promise<InsertTrialingSubscriptionResult> {
  const trialDays = opts.trialSource === "partner" ? 30 : 14;
  const rows = await dbOrTx.execute<{ id: string; trial_end_date: string }>(
    sql`INSERT INTO public.subscriptions
          (user_id, provider, status, trial_start_date, trial_end_date)
        VALUES (
          ${opts.userId},
          'stripe',
          'trialing',
          now(),
          now() + (${trialDays}::int * interval '1 day')
        )
        RETURNING id, trial_end_date`,
  );
  const row = rows[0];
  if (!row) {
    throw new Error("insertTrialingSubscription: insert returned no row");
  }
  return {
    id: row.id,
    trial_end_date: row.trial_end_date,
    trial_source: opts.trialSource,
  };
}
