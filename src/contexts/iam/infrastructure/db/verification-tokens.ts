// Phase 4 plan 06 — email verification token CRUD (D-06).
//
// Raw tokens exist only in URLs (verification email + redirect target);
// only the sha256 hex digest goes to the DB. Codex HIGH #2: write helpers
// accept `dbOrTx` so the signup use-case can mint inside the same
// `db.transaction(...)` as the user/consent/subscription rows AND the
// verify-email use-case can wrap consume + setEmailVerifiedAt.

import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@shared/db/client";
import { emailVerificationTokens } from "@contexts/iam/infrastructure/db/schema";
import { mintToken } from "@shared/crypto/tokens";
import { type DbOrTx } from "@contexts/iam/infrastructure/db/types";

export async function revokeUnusedVerificationTokens(
  userId: string,
  dbOrTx: DbOrTx = db,
): Promise<void> {
  await dbOrTx
    .update(emailVerificationTokens)
    .set({ consumedAt: new Date().toISOString() })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.consumedAt),
      ),
    );
}

export async function mintVerificationToken(
  opts: { userId: string; sentToEmail: string },
  dbOrTx: DbOrTx = db,
): Promise<{ tokenId: string; rawToken: string }> {
  await revokeUnusedVerificationTokens(opts.userId, dbOrTx);
  const { raw, hash } = mintToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const inserted = await dbOrTx
    .insert(emailVerificationTokens)
    .values({
      userId: opts.userId,
      tokenHash: hash,
      expiresAt,
      sentToEmail: opts.sentToEmail,
    })
    .returning({ id: emailVerificationTokens.id });
  const row = inserted[0];
  if (!row) {
    throw new Error("mintVerificationToken: insert returned no row");
  }
  return { tokenId: row.id, rawToken: raw };
}

// Codex HIGH #2: consumeVerificationToken accepts dbOrTx so verify-email can wrap consume + setEmailVerifiedAt in one tx.
export async function consumeVerificationToken(
  rawToken: string,
  dbOrTx: DbOrTx = db,
): Promise<{ userId: string } | null> {
  const hash = createHash("sha256").update(rawToken).digest("hex");
  const result = await dbOrTx.execute<{ user_id: string }>(
    sql`WITH t AS (
          SELECT id, user_id
            FROM public.email_verification_tokens
           WHERE token_hash = ${hash}
             AND consumed_at IS NULL
             AND expires_at > now()
           FOR UPDATE
        )
        UPDATE public.email_verification_tokens evt
           SET consumed_at = now()
          FROM t
         WHERE evt.id = t.id
        RETURNING evt.user_id`,
  );
  const row = result[0];
  return row ? { userId: row.user_id } : null;
}
