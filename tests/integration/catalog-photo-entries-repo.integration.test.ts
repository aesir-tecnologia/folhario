import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { supabaseAuthAvailable } from "./fixtures/supabase-availability";
import { db } from "@shared/db/client";
import { withUnitOfWork } from "@shared/db/unit-of-work";
import * as photoEntriesRepo from "@contexts/catalog/infrastructure/db/photo-entries";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";

const dbUrl = process.env.DATABASE_POOL_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}
if (supabaseUrl && /supabase\.co/.test(supabaseUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in NEXT_PUBLIC_SUPABASE_URL).",
  );
}

describe.skipIf(!dbUrl || !supabaseAuthAvailable)("photo_entries repository", () => {
  let userAId: string;
  let userBId: string;

  const adminClient = createClient(supabaseUrl!, serviceRoleKey ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminSql = postgres(dbUrl!, { prepare: false, max: 2, idle_timeout: 5 });

  beforeAll(async () => {
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing. Run 'pnpm db:sync-env'.");
    }
    if (!anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing. Run 'pnpm db:sync-env'.");
    }

    const runId = randomUUID().slice(0, 8);
    const password = `pw-${randomUUID()}`;

    const { data: createdA, error: createAErr } = await adminClient.auth.admin.createUser({
      email: `photo-entries-userA-${runId}@test.local`,
      password,
      email_confirm: true,
    });
    if (createAErr || !createdA?.user) {
      throw new Error(
        `Supabase Auth admin createUser failed for A: ${createAErr?.message ?? "no user"}`,
      );
    }
    userAId = createdA.user.id;

    const { data: createdB, error: createBErr } = await adminClient.auth.admin.createUser({
      email: `photo-entries-userB-${runId}@test.local`,
      password,
      email_confirm: true,
    });
    if (createBErr || !createdB?.user) {
      throw new Error(
        `Supabase Auth admin createUser failed for B: ${createBErr?.message ?? "no user"}`,
      );
    }
    userBId = createdB.user.id;

    const [rowA] = await adminSql<
      { id: string }[]
    >`SELECT id FROM public.users WHERE id = ${userAId}`;
    const [rowB] = await adminSql<
      { id: string }[]
    >`SELECT id FROM public.users WHERE id = ${userBId}`;
    if (!rowA || !rowB) {
      throw new Error("auth.users -> public.users sync trigger did not fire. Run pnpm db:migrate.");
    }

    const signInA = await adminClient.auth.signInWithPassword({
      email: `photo-entries-userA-${runId}@test.local`,
      password,
    });
    if (signInA.error || !signInA.data.session?.access_token) {
      throw new Error(`signInWithPassword A failed: ${signInA.error?.message}`);
    }

    const signInB = await adminClient.auth.signInWithPassword({
      email: `photo-entries-userB-${runId}@test.local`,
      password,
    });
    if (signInB.error || !signInB.data.session?.access_token) {
      throw new Error(`signInWithPassword B failed: ${signInB.error?.message}`);
    }
  }, 30_000);

  afterAll(async () => {
    try {
      if (userAId) {
        await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userAId}`;
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminSql`DELETE FROM public.plants WHERE user_id = ${userBId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userBId}`;
        await adminClient.auth.admin.deleteUser(userBId);
      }
    } finally {
      await adminSql.end({ timeout: 5 });
    }
  });

  describe("photo_entries repository — list", () => {
    it("returns rows for the requested plantId ordered by created_at ASC (oldest first — drives D-03 cover ordering and journal reverse-chrono is callers' job)", async () => {
      const [plantA] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name) VALUES (${userAId}, 'PlantA') RETURNING id
      `;
      const [plantB] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name) VALUES (${userAId}, 'PlantB') RETURNING id
      `;

      for (let i = 0; i < 4; i++) {
        await adminSql`
          INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url)
          VALUES (${plantA!.id}, ${`https://a.com/p-${i}.jpg`}, ${`https://a.com/t-${i}.jpg`})
        `;
      }
      for (let i = 0; i < 2; i++) {
        await adminSql`
          INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url)
          VALUES (${plantB!.id}, ${`https://b.com/p-${i}.jpg`}, ${`https://b.com/t-${i}.jpg`})
        `;
      }

      const rowsA = await photoEntriesRepo.list(db, { plantId: plantA!.id });
      expect(rowsA.length).toBe(4);
      for (let i = 1; i < rowsA.length; i++) {
        expect(rowsA[i - 1]!.createdAt <= rowsA[i]!.createdAt).toBe(true);
      }

      const rowsB = await photoEntriesRepo.list(db, { plantId: plantB!.id });
      expect(rowsB.length).toBe(2);

      await adminSql`DELETE FROM public.plants WHERE id IN (${plantA!.id}, ${plantB!.id})`;
    });
  });

  describe("photo_entries repository — delete", () => {
    it("deletes the row by id", async () => {
      const [plant] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name) VALUES (${userAId}, 'DeleteTestPlant') RETURNING id
      `;
      const [entry] = await adminSql<{ id: string }[]>`
        INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url)
        VALUES (${plant!.id}, 'https://x.com/photo.jpg', 'https://x.com/thumb.jpg')
        RETURNING id
      `;

      const deleted = await photoEntriesRepo.deletePhotoEntry(db, { photoEntryId: entry!.id });
      expect(deleted).not.toBeNull();
      expect(deleted!.id).toBe(entry!.id);

      const remaining = await adminSql<{ id: string }[]>`
        SELECT id FROM public.photo_entries WHERE id = ${entry!.id}
      `;
      expect(remaining).toHaveLength(0);

      await adminSql`DELETE FROM public.plants WHERE id = ${plant!.id}`;
    });
  });

  describe("photo_entries repository — bumpCoverFor (D-03 cover auto-promote)", () => {
    it("sets cover_photo_url to the oldest non-deleted photo_entry's photo_url, in the SAME transaction", async () => {
      const [plant] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name, cover_photo_url)
        VALUES (${userAId}, 'CoverPlant', 'https://old.com/cover.jpg')
        RETURNING id
      `;

      // Insert entries at different times (T0, T1, T2)
      const [e0] = await adminSql<{ id: string; photo_url: string }[]>`
        INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url, created_at)
        VALUES (${plant!.id}, 'https://t0.com/photo.jpg', 'https://t0.com/thumb.jpg', NOW() - INTERVAL '2 minutes')
        RETURNING id, photo_url
      `;
      await adminSql`
        INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url, created_at)
        VALUES (${plant!.id}, 'https://t1.com/photo.jpg', 'https://t1.com/thumb.jpg', NOW() - INTERVAL '1 minute')
      `;
      await adminSql`
        INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url, created_at)
        VALUES (${plant!.id}, 'https://t2.com/photo.jpg', 'https://t2.com/thumb.jpg', NOW())
      `;

      await withUnitOfWork(userAId, async (tx) => {
        await photoEntriesRepo.bumpCoverFor(tx, { userId: userAId, plantId: plant!.id });
      });

      const [updated] = await adminSql<{ cover_photo_url: string | null }[]>`
        SELECT cover_photo_url FROM public.plants WHERE id = ${plant!.id}
      `;
      expect(updated!.cover_photo_url).toBe(e0!.photo_url);

      await adminSql`DELETE FROM public.plants WHERE id = ${plant!.id}`;
    });

    it("sets cover_photo_url to NULL when no photo_entries remain", async () => {
      const [plant] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name, cover_photo_url)
        VALUES (${userAId}, 'NoCoverPlant', 'https://was.com/cover.jpg')
        RETURNING id
      `;

      await withUnitOfWork(userAId, async (tx) => {
        await photoEntriesRepo.bumpCoverFor(tx, { userId: userAId, plantId: plant!.id });
      });

      const [updated] = await adminSql<{ cover_photo_url: string | null }[]>`
        SELECT cover_photo_url FROM public.plants WHERE id = ${plant!.id}
      `;
      expect(updated!.cover_photo_url).toBeNull();

      await adminSql`DELETE FROM public.plants WHERE id = ${plant!.id}`;
    });

    it("filters the plants UPDATE by user_id (defense in depth — does NOT touch plants belonging to another user even if plantId passed)", async () => {
      const [plantB] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name, cover_photo_url)
        VALUES (${userBId}, 'UserBPlant', 'https://b.com/original-cover.jpg')
        RETURNING id
      `;
      await adminSql`
        INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url)
        VALUES (${plantB!.id}, 'https://b.com/entry.jpg', 'https://b.com/thumb.jpg')
      `;

      // Call bumpCoverFor with userA's UoW but userB's plantId
      // The WHERE user_id = $userId in the UPDATE will match 0 rows → no change
      await withUnitOfWork(userAId, async (tx) => {
        await photoEntriesRepo.bumpCoverFor(tx, { userId: userAId, plantId: plantB!.id });
      });

      const [unchanged] = await adminSql<{ cover_photo_url: string | null }[]>`
        SELECT cover_photo_url FROM public.plants WHERE id = ${plantB!.id}
      `;
      expect(unchanged!.cover_photo_url).toBe("https://b.com/original-cover.jpg");

      await adminSql`DELETE FROM public.plants WHERE id = ${plantB!.id}`;
    });
  });
});
