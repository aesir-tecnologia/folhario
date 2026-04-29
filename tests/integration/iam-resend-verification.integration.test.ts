// Phase 4 plan 04-13 (UAT gap 2 architectural fix mirror) regression guard.
//
// resendVerification mints a fresh email_verification_tokens row, then
// dispatches a verification email via inngest.send. A transient Inngest
// delivery failure must NOT propagate out of the use-case — the route
// handler used to map any throw to a generic 500 via a bare `catch {}`,
// hiding the operator signal AND making the user retry uselessly. This
// test locks in the contract: a rejected inngest.send keeps the use-case
// returning the new tokenId and routes the error to Sentry.captureException
// with `tags.surface === 'iam.resendVerification.notify'`.

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

import { seedUser } from "./fixtures/seed-user";
import { inngestSendMock, installInngestMock, resetInngestMock } from "./fixtures/mock-inngest";

const captureExceptionMock = vi.fn();

vi.mock("@sentry/nextjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sentry/nextjs")>().catch(
    () => ({}) as Record<string, unknown>,
  );
  return {
    ...actual,
    captureException: captureExceptionMock,
  };
});

installInngestMock();

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}

const cleanupSql = dbUrl ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 }) : null;

describe.skipIf(!dbUrl)("Phase 4 plan 04-13 — resendVerification (UAT gap 2 mirror)", () => {
  let resendModule: typeof import("@contexts/iam/application/resend-verification");

  beforeAll(async () => {
    // Lazy import so installInngestMock + sentry mock win before resend
    // imports inngest/sentry.
    resendModule = await import("@contexts/iam/application/resend-verification");
  });

  beforeEach(() => {
    resetInngestMock();
    captureExceptionMock.mockClear();
  });

  afterAll(async () => {
    if (cleanupSql) await cleanupSql.end({ timeout: 5 });
  });

  const requestUrl = new URL("http://localhost:3000/api/v1/iam/resend-verification");

  it("happy path: mints token + emits verification Inngest event", async () => {
    const email = `resend-${randomUUID()}@test.local`;
    const { id: userId } = await seedUser({
      email,
      password: "SuperSecret123!",
      emailVerifiedAt: null,
    });

    const result = await resendModule.resendVerification({ userId, email, requestUrl });

    expect(result.tokenId).toMatch(/^[0-9a-f-]{36}$/);

    const tokenRows = await cleanupSql!<{ id: string }[]>`
      SELECT id FROM public.email_verification_tokens
       WHERE user_id = ${userId} AND consumed_at IS NULL`;
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0]!.id).toBe(result.tokenId);

    expect(inngestSendMock).toHaveBeenCalledTimes(1);
    const call = inngestSendMock.mock.calls[0]![0] as {
      id: string;
      name: string;
      data: { template: string };
    };
    expect(call.id).toBe(`email-verification/${result.tokenId}`);
    expect(call.name).toBe("notifications/email.requested");
    expect(call.data.template).toBe("verification");

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("inngest.send rejection: still returns tokenId + Sentry.captureException invoked", async () => {
    const email = `resend-fail-${randomUUID()}@test.local`;
    const { id: userId } = await seedUser({
      email,
      password: "SuperSecret123!",
      emailVerifiedAt: null,
    });

    inngestSendMock.mockRejectedValueOnce(new Error("inngest cloud delivery failed"));

    // Must NOT throw.
    const result = await resendModule.resendVerification({ userId, email, requestUrl });

    expect(result.tokenId).toMatch(/^[0-9a-f-]{36}$/);

    // Token row was still persisted by mintVerificationToken before dispatch.
    const tokenRows = await cleanupSql!<{ id: string }[]>`
      SELECT id FROM public.email_verification_tokens
       WHERE user_id = ${userId} AND consumed_at IS NULL`;
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0]!.id).toBe(result.tokenId);

    expect(inngestSendMock).toHaveBeenCalledTimes(1);

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [capturedErr, capturedCtx] = captureExceptionMock.mock.calls[0]! as [
      Error,
      { tags?: Record<string, string>; extra?: Record<string, unknown> },
    ];
    expect(capturedErr).toBeInstanceOf(Error);
    expect((capturedErr as Error).message).toMatch(/inngest cloud delivery failed/);
    expect(capturedCtx.tags?.surface).toBe("iam.resendVerification.notify");
    expect(capturedCtx.extra?.tokenId).toBe(result.tokenId);
  });
});
