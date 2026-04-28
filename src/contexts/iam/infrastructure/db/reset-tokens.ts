// Phase 4 plan 08 — password-reset token CRUD (D-09 + AUTH-11).
//
// Mirrors the verification-tokens.ts shape exactly (Codex HIGH #2: write
// helpers accept `dbOrTx` so the request-password-reset use-case can mint
// inside the same db.transaction(...) and the consume-password-reset
// use-case can wrap consume + adminUpdatePassword in one tx).
//
// Raw tokens exist only in URLs (reset email + redirect target); only the
// sha256 hex digest goes to the DB.
//
// Expiry: 1 hour per AUTH-11 / D-09 (verification tokens are 24h; reset
// tokens are 1h).

import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@shared/db/client";
import { passwordResetTokens } from "@contexts/iam/infrastructure/db/schema";
import { mintToken } from "@shared/crypto/tokens";
import { type DbOrTx } from "@contexts/iam/infrastructure/db/types";

export async function revokeUnusedResetTokens(
  userId: string,
  dbOrTx: DbOrTx = db,
): Promise<void> {
  await dbOrTx
    .update(passwordResetTokens)
    .set({ consumedAt: new Date().toISOString() })
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.consumedAt),
      ),
    );
}

export async function mintResetToken(
  opts: { userId: string; sentToEmail: string },
  dbOrTx: DbOrTx = db,
): Promise<{ tokenId: string; rawToken: string }> {
  await revokeUnusedResetTokens(opts.userId, dbOrTx);
  const { raw, hash } = mintToken();
  // D-09: 1-hour expiry (AUTH-11).
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const inserted = await dbOrTx
    .insert(passwordResetTokens)
    .values({
      userId: opts.userId,
      tokenHash: hash,
      expiresAt,
      sentToEmail: opts.sentToEmail,
    })
    .returning({ id: passwordResetTokens.id });
  const row = inserted[0];
  if (!row) {
    throw new Error("mintResetToken: insert returned no row");
  }
  return { tokenId: row.id, rawToken: raw };
}

// Codex HIGH #2: consumeResetToken accepts dbOrTx so consumePasswordReset
// can wrap consume + adminUpdatePassword in one tx (rollback on failure).
export async function consumeResetToken(
  rawToken: string,
  dbOrTx: DbOrTx = db,
): Promise<{ userId: string } | null> {
  const hash = createHash("sha256").update(rawToken).digest("hex");
  const result = await dbOrTx.execute<{ user_id: string }>(
    sql`WITH t AS (
          SELECT id, user_id
            FROM public.password_reset_tokens
           WHERE token_hash = ${hash}
             AND consumed_at IS NULL
             AND expires_at > now()
           FOR UPDATE
        )
        UPDATE public.password_reset_tokens prt
           SET consumed_at = now()
          FROM t
         WHERE prt.id = t.id
        RETURNING prt.user_id`,
  );
  const row = result[0];
  return row ? { userId: row.user_id } : null;
}
