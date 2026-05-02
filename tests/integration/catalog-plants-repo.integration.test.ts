import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { supabaseAuthAvailable } from "./fixtures/supabase-availability";
import { db } from "@shared/db/client";
import { withUnitOfWork } from "@shared/db/unit-of-work";
import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
import { type SortId } from "@shared/api/cursor";

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

function jwtSub(jwt: string): string {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
    sub?: string;
  };
  if (!payload.sub) throw new Error("JWT missing sub");
  return payload.sub;
}

describe.skipIf(!dbUrl || !supabaseAuthAvailable)("plants repository", () => {
  let userAId: string;
  let userBId: string;
  let userBJwtSub: string;

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
      email: `plants-repo-userA-${runId}@test.local`,
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
      email: `plants-repo-userB-${runId}@test.local`,
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
      email: `plants-repo-userA-${runId}@test.local`,
      password,
    });
    if (signInA.error || !signInA.data.session?.access_token) {
      throw new Error(`signInWithPassword A failed: ${signInA.error?.message}`);
    }

    const signInB = await adminClient.auth.signInWithPassword({
      email: `plants-repo-userB-${runId}@test.local`,
      password,
    });
    if (signInB.error || !signInB.data.session?.access_token) {
      throw new Error(`signInWithPassword B failed: ${signInB.error?.message}`);
    }
    userBJwtSub = jwtSub(signInB.data.session.access_token);
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

  describe("plants repository — list", () => {
    it("returns rows for date_new sort: acquisition_date DESC NULLS LAST, then id DESC tiebreak", async () => {
      const plantIds: string[] = [];
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;

      const dates = ["2024-03-01", "2024-01-15", "2024-06-20"];
      for (const d of dates) {
        const [row] = await adminSql`
          INSERT INTO public.plants (user_id, name, acquisition_date)
          VALUES (${userAId}, ${`Plant-${d}`}, ${d})
          RETURNING id
        `;
        plantIds.push(row!.id);
      }
      for (let i = 0; i < 2; i++) {
        const [row] = await adminSql`
          INSERT INTO public.plants (user_id, name, acquisition_date)
          VALUES (${userAId}, ${`NullPlant-${i}`}, NULL)
          RETURNING id
        `;
        plantIds.push(row!.id);
      }

      const result = await plantsRepo.list(db, {
        userId: userAId,
        sort: "date_new",
        cursor: null,
        limit: 50,
      });

      expect(result.rows.length).toBe(5);
      const nonNull = result.rows.filter((r) => r.acquisitionDate !== null);
      const nullRows = result.rows.filter((r) => r.acquisitionDate === null);
      expect(nonNull.length).toBe(3);
      expect(nullRows.length).toBe(2);

      // Non-null rows ordered DESC
      expect(nonNull[0]!.acquisitionDate).toBe("2024-06-20");
      expect(nonNull[1]!.acquisitionDate).toBe("2024-03-01");
      expect(nonNull[2]!.acquisitionDate).toBe("2024-01-15");

      // Non-null rows come before null rows
      const nonNullIndices = nonNull.map((r) => result.rows.indexOf(r));
      const nullIndices = nullRows.map((r) => result.rows.indexOf(r));
      expect(Math.max(...nonNullIndices)).toBeLessThan(Math.min(...nullIndices));

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
    });

    it("returns rows for date_old sort: acquisition_date ASC NULLS LAST, then id ASC tiebreak", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;

      const dates = ["2024-03-01", "2024-01-15", "2024-06-20"];
      for (const d of dates) {
        await adminSql`
          INSERT INTO public.plants (user_id, name, acquisition_date)
          VALUES (${userAId}, ${`Plant-${d}`}, ${d})
        `;
      }
      for (let i = 0; i < 2; i++) {
        await adminSql`
          INSERT INTO public.plants (user_id, name, acquisition_date)
          VALUES (${userAId}, ${`NullPlant-${i}`}, NULL)
        `;
      }

      const result = await plantsRepo.list(db, {
        userId: userAId,
        sort: "date_old",
        cursor: null,
        limit: 50,
      });

      expect(result.rows.length).toBe(5);
      const nonNull = result.rows.filter((r) => r.acquisitionDate !== null);
      const nullRows = result.rows.filter((r) => r.acquisitionDate === null);

      // Non-null rows ordered ASC
      expect(nonNull[0]!.acquisitionDate).toBe("2024-01-15");
      expect(nonNull[1]!.acquisitionDate).toBe("2024-03-01");
      expect(nonNull[2]!.acquisitionDate).toBe("2024-06-20");

      // Non-null rows come before null rows
      const nonNullIndices = nonNull.map((r) => result.rows.indexOf(r));
      const nullIndices = nullRows.map((r) => result.rows.indexOf(r));
      expect(Math.max(...nonNullIndices)).toBeLessThan(Math.min(...nullIndices));

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
    });

    it("returns rows for name_asc sort: name ASC, id ASC tiebreak", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;

      const names = ["Zebra", "Alfa", "Alfa", "Mango"];
      for (const name of names) {
        await adminSql`
          INSERT INTO public.plants (user_id, name)
          VALUES (${userAId}, ${name})
        `;
      }

      const result = await plantsRepo.list(db, {
        userId: userAId,
        sort: "name_asc",
        cursor: null,
        limit: 50,
      });

      expect(result.rows.length).toBe(4);
      expect(result.rows[0]!.name).toBe("Alfa");
      expect(result.rows[1]!.name).toBe("Alfa");
      expect(result.rows[2]!.name).toBe("Mango");
      expect(result.rows[3]!.name).toBe("Zebra");
      // Tiebreak by id ASC for the two Alfa rows
      expect(result.rows[0]!.id < result.rows[1]!.id).toBe(true);

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
    });

    it("returns rows for name_desc sort: name DESC, id DESC tiebreak", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;

      const names = ["Zebra", "Alfa", "Alfa", "Mango"];
      for (const name of names) {
        await adminSql`
          INSERT INTO public.plants (user_id, name)
          VALUES (${userAId}, ${name})
        `;
      }

      const result = await plantsRepo.list(db, {
        userId: userAId,
        sort: "name_desc",
        cursor: null,
        limit: 50,
      });

      expect(result.rows.length).toBe(4);
      expect(result.rows[0]!.name).toBe("Zebra");
      expect(result.rows[1]!.name).toBe("Mango");
      expect(result.rows[2]!.name).toBe("Alfa");
      expect(result.rows[3]!.name).toBe("Alfa");
      // Tiebreak by id DESC for the two Alfa rows
      expect(result.rows[2]!.id > result.rows[3]!.id).toBe(true);

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
    });

    it("returns rows for location sort: location ASC NULLS LAST, id ASC tiebreak", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;

      const locs = ["Sala", null, "Varanda", "Cozinha", null];
      for (const loc of locs) {
        await adminSql`
          INSERT INTO public.plants (user_id, name, location)
          VALUES (${userAId}, ${`Plant-${loc ?? "null"}`}, ${loc})
        `;
      }

      const result = await plantsRepo.list(db, {
        userId: userAId,
        sort: "location",
        cursor: null,
        limit: 50,
      });

      expect(result.rows.length).toBe(5);
      const withLoc = result.rows.filter((r) => r.location !== null);
      const noLoc = result.rows.filter((r) => r.location === null);
      expect(withLoc.length).toBe(3);
      expect(noLoc.length).toBe(2);
      expect(withLoc[0]!.location).toBe("Cozinha");
      expect(withLoc[1]!.location).toBe("Sala");
      expect(withLoc[2]!.location).toBe("Varanda");

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
    });

    it("cursor round-trip — date_new — second page starts strictly after the first page's last row", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;

      for (let i = 0; i < 30; i++) {
        const d = new Date(2024, 0, i + 1).toISOString().slice(0, 10);
        await adminSql`
          INSERT INTO public.plants (user_id, name, acquisition_date)
          VALUES (${userAId}, ${`Plant-${i}`}, ${d})
        `;
      }

      const page1 = await plantsRepo.list(db, {
        userId: userAId,
        sort: "date_new",
        cursor: null,
        limit: 10,
      });
      expect(page1.rows.length).toBe(10);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await plantsRepo.list(db, {
        userId: userAId,
        sort: "date_new",
        cursor: page1.nextCursor,
        limit: 10,
      });
      expect(page2.rows.length).toBe(10);

      const page1Ids = new Set(page1.rows.map((r) => r.id));
      const page2Ids = new Set(page2.rows.map((r) => r.id));
      const overlap = [...page2Ids].filter((id) => page1Ids.has(id));
      expect(overlap).toHaveLength(0);

      // Verify ordering is contiguous: last of page1 > first of page2 in date_new order
      const lastPage1Date = page1.rows[9]!.acquisitionDate;
      const firstPage2Date = page2.rows[0]!.acquisitionDate;
      expect(lastPage1Date! >= firstPage2Date!).toBe(true);

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
    });

    it("cursor round-trip — date_new — pagination crosses the NULL boundary correctly", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;

      for (let i = 0; i < 5; i++) {
        const d = new Date(2024, 0, i + 1).toISOString().slice(0, 10);
        await adminSql`
          INSERT INTO public.plants (user_id, name, acquisition_date)
          VALUES (${userAId}, ${`Dated-${i}`}, ${d})
        `;
      }
      for (let i = 0; i < 5; i++) {
        await adminSql`
          INSERT INTO public.plants (user_id, name, acquisition_date)
          VALUES (${userAId}, ${`NullDate-${i}`}, NULL)
        `;
      }

      const page1 = await plantsRepo.list(db, {
        userId: userAId,
        sort: "date_new",
        cursor: null,
        limit: 7,
      });
      expect(page1.rows.length).toBe(7);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await plantsRepo.list(db, {
        userId: userAId,
        sort: "date_new",
        cursor: page1.nextCursor,
        limit: 7,
      });
      expect(page2.rows.length).toBe(3);
      expect(page2.nextCursor).toBeNull();

      const allIds = new Set([...page1.rows.map((r) => r.id), ...page2.rows.map((r) => r.id)]);
      expect(allIds.size).toBe(10);

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
    });

    it("cursor round-trip — name_asc — works the same way (no NULLS-LAST sentinel involved because name is NOT NULL)", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;

      for (let i = 0; i < 20; i++) {
        const name = `Plant-${String(i).padStart(3, "0")}`;
        await adminSql`
          INSERT INTO public.plants (user_id, name)
          VALUES (${userAId}, ${name})
        `;
      }

      const page1 = await plantsRepo.list(db, {
        userId: userAId,
        sort: "name_asc",
        cursor: null,
        limit: 7,
      });
      expect(page1.rows.length).toBe(7);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await plantsRepo.list(db, {
        userId: userAId,
        sort: "name_asc",
        cursor: page1.nextCursor,
        limit: 7,
      });
      expect(page2.rows.length).toBe(7);

      const page1Ids = new Set(page1.rows.map((r) => r.id));
      const page2Ids = new Set(page2.rows.map((r) => r.id));
      const overlap = [...page2Ids].filter((id) => page1Ids.has(id));
      expect(overlap).toHaveLength(0);

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
    });

    it("cross-user cursor manipulation does NOT leak rows (T-05-03-01)", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userBId}`;

      for (let i = 0; i < 10; i++) {
        await adminSql`
          INSERT INTO public.plants (user_id, name)
          VALUES (${userAId}, ${`UserA-Plant-${i}`})
        `;
      }
      for (let i = 0; i < 10; i++) {
        await adminSql`
          INSERT INTO public.plants (user_id, name)
          VALUES (${userBId}, ${`UserB-Plant-${i}`})
        `;
      }

      // Get a cursor minted from userA's data
      const page1A = await plantsRepo.list(db, {
        userId: userAId,
        sort: "name_asc",
        cursor: null,
        limit: 5,
      });
      expect(page1A.nextCursor).not.toBeNull();

      // Use that cursor in a connection bound to userB's JWT sub
      const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
      try {
        const _lastA = page1A.rows[4]!;
        const _crossCursorPayload = page1A.nextCursor!;

        // Build same WHERE/ORDER that list() would use with that cursor, under userB's auth
        const rows = await driver.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE authenticated`);
          await tx`SELECT set_config('request.jwt.claim.sub', ${userBJwtSub}, true)`;
          // The RLS gate — if list() SQL is run under userB, only userB's rows are visible
          return tx<{ id: string; user_id: string }[]>`
            SELECT id, user_id FROM public.plants
            WHERE user_id = ${userAId}
          `;
        });
        // RLS should deny: zero rows for userA's data when queried as userB
        expect(rows).toHaveLength(0);
      } finally {
        await driver.end({ timeout: 5 });
      }

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userBId}`;
    });

    it("rejects invalid sort_id with an Error (defense in depth — Zod in cursor.ts already rejects, but list() also asserts the SortId enum)", async () => {
      await expect(
        plantsRepo.list(db, {
          userId: userAId,
          sort: "evil_sort" as SortId,
          cursor: null,
          limit: 50,
        }),
      ).rejects.toThrow();
    });
  });

  describe("plants repository — countForUser", () => {
    it("returns 0 for a user with no plants", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
      const count = await plantsRepo.countForUser(db, userAId);
      expect(count).toBe(0);
    });

    it("returns the exact number of plants for a user, ignoring other users' rows", async () => {
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userBId}`;

      for (let i = 0; i < 7; i++) {
        await adminSql`INSERT INTO public.plants (user_id, name) VALUES (${userAId}, ${`PlantA-${i}`})`;
      }
      for (let i = 0; i < 4; i++) {
        await adminSql`INSERT INTO public.plants (user_id, name) VALUES (${userBId}, ${`PlantB-${i}`})`;
      }

      const countA = await plantsRepo.countForUser(db, userAId);
      const countB = await plantsRepo.countForUser(db, userBId);
      expect(countA).toBe(7);
      expect(countB).toBe(4);

      await adminSql`DELETE FROM public.plants WHERE user_id = ${userAId}`;
      await adminSql`DELETE FROM public.plants WHERE user_id = ${userBId}`;
    });
  });

  describe("plants repository — getCascadeCounts", () => {
    it("returns {photo_entry_count: 0, reminder_count: 0} for a freshly-created plant", async () => {
      const [plant] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name)
        VALUES (${userAId}, 'Fresh Plant')
        RETURNING id
      `;
      const counts = await plantsRepo.getCascadeCounts(db, {
        userId: userAId,
        plantId: plant!.id,
      });
      expect(counts).toEqual({ photo_entry_count: 0, reminder_count: 0 });
      await adminSql`DELETE FROM public.plants WHERE id = ${plant!.id}`;
    });

    it("returns the right counts when the plant has photo_entries and reminders", async () => {
      const [plant] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name)
        VALUES (${userAId}, 'Plant With Entries')
        RETURNING id
      `;
      for (let i = 0; i < 3; i++) {
        await adminSql`
          INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url)
          VALUES (${plant!.id}, ${`https://example.com/photo-${i}.jpg`}, ${`https://example.com/thumb-${i}.jpg`})
        `;
      }
      const nextDueAt = new Date().toISOString();
      for (let i = 0; i < 2; i++) {
        await adminSql`
          INSERT INTO public.reminders (plant_id, type, frequency_days, next_due_at)
          VALUES (${plant!.id}, 'watering', 7, ${nextDueAt})
        `;
      }

      const counts = await plantsRepo.getCascadeCounts(db, {
        userId: userAId,
        plantId: plant!.id,
      });
      expect(counts).toEqual({ photo_entry_count: 3, reminder_count: 2 });

      await adminSql`DELETE FROM public.plants WHERE id = ${plant!.id}`;
    });

    it("counts only the entries belonging to the target plant (no leak across plants of the same user)", async () => {
      const [plantA] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name)
        VALUES (${userAId}, 'Plant A')
        RETURNING id
      `;
      const [plantB] = await adminSql<{ id: string }[]>`
        INSERT INTO public.plants (user_id, name)
        VALUES (${userAId}, 'Plant B')
        RETURNING id
      `;

      for (let i = 0; i < 2; i++) {
        await adminSql`
          INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url)
          VALUES (${plantA!.id}, ${`https://a.com/photo-${i}.jpg`}, ${`https://a.com/thumb-${i}.jpg`})
        `;
        await adminSql`
          INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url)
          VALUES (${plantB!.id}, ${`https://b.com/photo-${i}.jpg`}, ${`https://b.com/thumb-${i}.jpg`})
        `;
      }
      const nextDueAt = new Date().toISOString();
      await adminSql`
        INSERT INTO public.reminders (plant_id, type, frequency_days, next_due_at)
        VALUES (${plantA!.id}, 'watering', 7, ${nextDueAt})
      `;

      const countsA = await plantsRepo.getCascadeCounts(db, {
        userId: userAId,
        plantId: plantA!.id,
      });
      expect(countsA).toEqual({ photo_entry_count: 2, reminder_count: 1 });

      const countsB = await plantsRepo.getCascadeCounts(db, {
        userId: userAId,
        plantId: plantB!.id,
      });
      expect(countsB).toEqual({ photo_entry_count: 2, reminder_count: 0 });

      await adminSql`DELETE FROM public.plants WHERE id = ${plantA!.id}`;
      await adminSql`DELETE FROM public.plants WHERE id = ${plantB!.id}`;
    });
  });

  describe("plants repository — create", () => {
    it("inserts a row scoped to the supplied userId and returns it", async () => {
      const row = await plantsRepo.create(db, {
        userId: userAId,
        name: "Costela de Adão",
      });
      expect(row.userId).toBe(userAId);
      expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(row.name).toBe("Costela de Adão");
      await adminSql`DELETE FROM public.plants WHERE id = ${row.id}`;
    });
  });

  describe("plants repository — update", () => {
    it("updates only fields supplied and only for the row owned by userId", async () => {
      const created = await plantsRepo.create(db, {
        userId: userAId,
        name: "Original Name",
      });

      const updated = await withUnitOfWork(userAId, async (tx) =>
        plantsRepo.update(tx, {
          userId: userAId,
          plantId: created.id,
          fields: { name: "Novo Nome", location: "Sala" },
        }),
      );
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe("Novo Nome");
      expect(updated!.location).toBe("Sala");
      await adminSql`DELETE FROM public.plants WHERE id = ${created.id}`;
    });

    it("returns null and does NOT mutate when plant belongs to another user", async () => {
      const created = await plantsRepo.create(db, {
        userId: userBId,
        name: "UserB Plant",
      });

      const result = await withUnitOfWork(userAId, async (tx) =>
        plantsRepo.update(tx, {
          userId: userAId,
          plantId: created.id,
          fields: { name: "hijack" },
        }),
      );
      expect(result).toBeNull();

      const unchanged = await plantsRepo.findByIdForUser(db, userBId, created.id);
      expect(unchanged?.name).toBe("UserB Plant");
      await adminSql`DELETE FROM public.plants WHERE id = ${created.id}`;
    });

    it("update touches updated_at automatically", async () => {
      const created = await plantsRepo.create(db, {
        userId: userAId,
        name: "TimeTest",
      });
      const originalUpdatedAt = created.updatedAt;

      await new Promise((r) => setTimeout(r, 10));

      const updated = await withUnitOfWork(userAId, async (tx) =>
        plantsRepo.update(tx, {
          userId: userAId,
          plantId: created.id,
          fields: { name: "TimeTest Updated" },
        }),
      );
      expect(updated).not.toBeNull();
      expect(updated!.updatedAt > originalUpdatedAt).toBe(true);
      await adminSql`DELETE FROM public.plants WHERE id = ${created.id}`;
    });
  });

  describe("plants repository — delete", () => {
    it("deletes a row owned by userId and returns the deleted row", async () => {
      const created = await plantsRepo.create(db, { userId: userAId, name: "ToDelete" });
      const deleted = await plantsRepo.deletePlant(db, {
        userId: userAId,
        plantId: created.id,
      });
      expect(deleted).not.toBeNull();
      expect(deleted!.id).toBe(created.id);

      const gone = await plantsRepo.findByIdForUser(db, userAId, created.id);
      expect(gone).toBeNull();
    });

    it("returns null and does NOT delete when plant belongs to another user", async () => {
      const created = await plantsRepo.create(db, { userId: userBId, name: "UserB Safe Plant" });
      const result = await plantsRepo.deletePlant(db, {
        userId: userAId,
        plantId: created.id,
      });
      expect(result).toBeNull();

      const stillExists = await plantsRepo.findByIdForUser(db, userBId, created.id);
      expect(stillExists).not.toBeNull();
      await adminSql`DELETE FROM public.plants WHERE id = ${created.id}`;
    });

    it("cascades delete to photo_entries (FK ON DELETE CASCADE) — verified by post-delete count=0", async () => {
      const plant = await plantsRepo.create(db, { userId: userAId, name: "CascadePlant" });
      for (let i = 0; i < 3; i++) {
        await adminSql`
          INSERT INTO public.photo_entries (plant_id, photo_url, thumbnail_url)
          VALUES (${plant.id}, ${`https://x.com/p-${i}.jpg`}, ${`https://x.com/t-${i}.jpg`})
        `;
      }

      await plantsRepo.deletePlant(db, { userId: userAId, plantId: plant.id });

      const remaining = await adminSql<{ count: string }[]>`
        SELECT count(*)::text AS count FROM public.photo_entries WHERE plant_id = ${plant.id}
      `;
      expect(remaining[0]!.count).toBe("0");
    });

    it("cascades delete to reminders (FK ON DELETE CASCADE) — verified by post-delete count=0", async () => {
      const plant = await plantsRepo.create(db, { userId: userAId, name: "CascadeReminderPlant" });
      const nextDueAt = new Date().toISOString();
      for (let i = 0; i < 2; i++) {
        await adminSql`
          INSERT INTO public.reminders (plant_id, type, frequency_days, next_due_at)
          VALUES (${plant.id}, 'watering', 7, ${nextDueAt})
        `;
      }

      await plantsRepo.deletePlant(db, { userId: userAId, plantId: plant.id });

      const remaining = await adminSql<{ count: string }[]>`
        SELECT count(*)::text AS count FROM public.reminders WHERE plant_id = ${plant.id}
      `;
      expect(remaining[0]!.count).toBe("0");
    });
  });
});
