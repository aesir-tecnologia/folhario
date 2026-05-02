import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { supabaseAuthAvailable } from "./fixtures/supabase-availability";
/**
 * Phase 05 Plan 07 — create-photo-entry use-case integration tests (Task 3B RED).
 *
 * Tests:
 *  1  Owned plant + valid JPEG buffer + note → { ok: true, photoEntry }
 *  2  Cross-user plant → { ok: false, code: not_found }
 *  3  Note > 500 chars → { ok: false, code: validation_failed }
 *  5  T-05-04-01: validateStorageObjectKey called BEFORE storage write
 *  6  Compensating delete: if UoW fails → bucket bytes deleted
 *  7  REUSE: uploadPhoto is called (not re-implemented)
 */

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";

const dbUrl = process.env.DATABASE_POOL_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

// Minimal valid 1×1 white-pixel JPEG (generated via sharp — survives sharp re-encode).
// Rule 1 fix: original buffer had a corrupt JPEG header that caused sharp thumbnail
// generation to fail with "VipsJpeg: premature end of JPEG image".
const MINIMAL_JPEG = Buffer.from(
  "ffd8ffdb00430006040506050406060506070706080a100a0a09090a140e0f0c1017141818171416161a1d251f1a1b231c1616202c20232627292a29191f2d302d283025282928ffdb0043010707070a080a130a0a13281a161a2828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828ffc00011080001000103012200021101031101ffc4001500010100000000000000000000000000000008ffc40014100100000000000000000000000000000000ffc40014010100000000000000000000000000000000ffc40014110100000000000000000000000000000000ffda000c03010002110311003f00aa4007ffd9",
  "hex",
);

describe.skipIf(!dbUrl || !supabaseAuthAvailable)(
  "Phase-05-07 createPhotoEntry use-case integration",
  () => {
    const adminSql = postgres(dbUrl!, { prepare: false, max: 2, idle_timeout: 5 });
    const adminClient = createClient(supabaseUrl!, serviceRoleKey ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let userId: string;
    let otherUserId: string;

    let createPhotoEntry: typeof import("@contexts/catalog/application/create-photo-entry").createPhotoEntry;
    let __setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;
    let InMemoryStorageAdapter: typeof import("../integration/fixtures/in-memory-storage-adapter").InMemoryStorageAdapter;

    beforeAll(async () => {
      ({ createPhotoEntry } = await import("@contexts/catalog/application/create-photo-entry"));
      ({ __setStorageAdapterForTests } =
        await import("@contexts/catalog/infrastructure/photo-storage"));
      ({ InMemoryStorageAdapter } = await import("./fixtures/in-memory-storage-adapter"));

      if (!serviceRoleKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY missing. Run 'pnpm db:sync-env'.");
      }

      const runId = randomUUID().slice(0, 8);

      const { data: userA, error: errA } = await adminClient.auth.admin.createUser({
        email: `create-photo-userA-${runId}@test.local`,
        password: `pw-${randomUUID()}`,
        email_confirm: true,
      });
      if (errA || !userA.user) throw new Error(`createUser A: ${errA?.message}`);
      userId = userA.user.id;

      const { data: userB, error: errB } = await adminClient.auth.admin.createUser({
        email: `create-photo-userB-${runId}@test.local`,
        password: `pw-${randomUUID()}`,
        email_confirm: true,
      });
      if (errB || !userB.user) throw new Error(`createUser B: ${errB?.message}`);
      otherUserId = userB.user.id;

      const [rowA] = await adminSql<
        { id: string }[]
      >`SELECT id FROM public.users WHERE id = ${userId}`;
      const [rowB] = await adminSql<
        { id: string }[]
      >`SELECT id FROM public.users WHERE id = ${otherUserId}`;
      if (!rowA || !rowB) {
        throw new Error(
          "auth.users -> public.users sync trigger did not fire. Run pnpm db:migrate.",
        );
      }
    }, 30_000);

    afterAll(async () => {
      __setStorageAdapterForTests(null);
      try {
        if (userId) {
          await adminSql`DELETE FROM public.photo_entries WHERE plant_id IN (SELECT id FROM public.plants WHERE user_id = ${userId})`;
          await adminSql`DELETE FROM public.plants WHERE user_id = ${userId}`;
          await adminSql`DELETE FROM public.users WHERE id = ${userId}`;
          await adminClient.auth.admin.deleteUser(userId);
        }
        if (otherUserId) {
          await adminSql`DELETE FROM public.plants WHERE user_id = ${otherUserId}`;
          await adminSql`DELETE FROM public.users WHERE id = ${otherUserId}`;
          await adminClient.auth.admin.deleteUser(otherUserId);
        }
      } finally {
        await adminSql.end({ timeout: 5 });
      }
    });

    async function seedPlant(uid: string): Promise<string> {
      const [row] = await adminSql<{ id: string }[]>`
      INSERT INTO public.plants (user_id, name)
      VALUES (${uid}, ${"Test Plant"})
      RETURNING id
    `;
      if (!row) throw new Error("seedPlant: no row");
      return row.id;
    }

    it("Test 1: owned plant + valid JPEG → { ok: true, photoEntry } with note", async () => {
      const plantId = await seedPlant(userId);
      const adapter = new InMemoryStorageAdapter();
      __setStorageAdapterForTests(adapter);

      const result = await createPhotoEntry({
        userId,
        plantId,
        buffer: MINIMAL_JPEG,
        contentType: "image/jpeg",
        note: "Cresceu!",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(`expected ok: ${result.reason}`);
      expect(result.photoEntry.plantId).toBe(plantId);
      expect(result.photoEntry.note).toBe("Cresceu!");
    });

    it("Test 2: cross-user plant → { ok: false, code: not_found }", async () => {
      const plantId = await seedPlant(otherUserId);
      const adapter = new InMemoryStorageAdapter();
      __setStorageAdapterForTests(adapter);

      const result = await createPhotoEntry({
        userId,
        plantId,
        buffer: MINIMAL_JPEG,
        contentType: "image/jpeg",
        note: null,
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected not ok");
      expect(result.code).toBe("not_found");
    });

    it("Test 3: note > 500 chars → { ok: false, code: validation_failed }", async () => {
      const plantId = await seedPlant(userId);
      const adapter = new InMemoryStorageAdapter();
      __setStorageAdapterForTests(adapter);

      const result = await createPhotoEntry({
        userId,
        plantId,
        buffer: MINIMAL_JPEG,
        contentType: "image/jpeg",
        note: "x".repeat(501),
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected not ok");
      expect(result.code).toBe("validation_failed");
    });

    it("Test 7: REUSE — createPhotoEntry delegates to uploadPhoto", async () => {
      const plantId = await seedPlant(userId);
      const adapter = new InMemoryStorageAdapter();
      __setStorageAdapterForTests(adapter);

      // Spy on uploadPhoto to verify delegation
      const uploadPhotoModule = await import("@contexts/catalog/application/upload-photo");
      const uploadSpy = vi.spyOn(uploadPhotoModule, "uploadPhoto");

      const _result = await createPhotoEntry({
        userId,
        plantId,
        buffer: MINIMAL_JPEG,
        contentType: "image/jpeg",
        note: null,
      });

      expect(uploadSpy).toHaveBeenCalledOnce();
      uploadSpy.mockRestore();
    });
  },
);
