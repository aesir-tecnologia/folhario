import { describe, expect, it } from "vitest";

import {
  createPhotoEntryInputSchema,
  createPlantInputSchema,
  updatePlantInputSchema,
} from "@contexts/catalog/domain/schemas";

const validPhoto = { contentType: "image/jpeg", byteLength: 500_000 };

describe("createPlantInputSchema", () => {
  it("fails with BOTH name and photo issues when payload is empty (D-04 summary trigger)", () => {
    const result = createPlantInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("name");
      expect(paths).toContain("photo");
    }
  });

  it("fails with name issue when name is empty string", () => {
    const result = createPlantInputSchema.safeParse({ name: "", photo: validPhoto });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("name");
    }
  });

  it("fails with photo issue when name present but photo undefined", () => {
    const result = createPlantInputSchema.safeParse({ name: "Costela", photo: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("photo");
    }
  });

  it("succeeds with only name and photo (optional fields absent)", () => {
    const result = createPlantInputSchema.safeParse({ name: "Costela", photo: validPhoto });
    expect(result.success).toBe(true);
  });

  it("succeeds with all optional fields present", () => {
    const result = createPlantInputSchema.safeParse({
      name: "Costela",
      photo: validPhoto,
      nickname: "x",
      location: "sala",
      acquisitionDate: "2026-04-01",
      notes: "n",
    });
    expect(result.success).toBe(true);
  });

  it("fails via .strict() when unknown server-managed key is provided (T-05-04-02)", () => {
    const result = createPlantInputSchema.safeParse({
      name: "x",
      photo: validPhoto,
      id: "some-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("does not pollute Object.prototype when __proto__ is passed in literal", () => {
    const obj = Object.assign(Object.create(null), {
      name: "x",
      photo: validPhoto,
      __proto__: { admin: true },
    });
    createPlantInputSchema.safeParse(obj);
    expect((Object.prototype as Record<string, unknown>)["admin"]).toBeUndefined();
  });
});

describe("updatePlantInputSchema", () => {
  it("fails when payload is empty (must have ≥1 known field)", () => {
    const result = updatePlantInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("succeeds with only name", () => {
    const result = updatePlantInputSchema.safeParse({ name: "Costela" });
    expect(result.success).toBe(true);
  });

  it("succeeds with only nickname", () => {
    const result = updatePlantInputSchema.safeParse({ nickname: "Cris" });
    expect(result.success).toBe(true);
  });

  it("succeeds with multiple fields (D-05: multi-field tolerated server-side)", () => {
    const result = updatePlantInputSchema.safeParse({ name: "x", nickname: "y" });
    expect(result.success).toBe(true);
  });

  it("fails via .strict() when unknown key is provided", () => {
    const result = updatePlantInputSchema.safeParse({ unknownKey: "x" });
    expect(result.success).toBe(false);
  });

  it("fails when server-managed id is provided", () => {
    const result = updatePlantInputSchema.safeParse({ id: "some-uuid" });
    expect(result.success).toBe(false);
  });

  it("fails when name is empty string (min length 1)", () => {
    const result = updatePlantInputSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("fails when acquisitionDate is not a valid date string", () => {
    const result = updatePlantInputSchema.safeParse({ acquisitionDate: "not-a-date" });
    expect(result.success).toBe(false);
  });
});

describe("createPhotoEntryInputSchema", () => {
  it("succeeds with contentType, byteLength, and null note", () => {
    const result = createPhotoEntryInputSchema.safeParse({
      contentType: "image/jpeg",
      byteLength: 500_000,
      note: null,
    });
    expect(result.success).toBe(true);
  });

  it("succeeds without note (optional)", () => {
    const result = createPhotoEntryInputSchema.safeParse({
      contentType: "image/jpeg",
      byteLength: 500_000,
    });
    expect(result.success).toBe(true);
  });

  it("fails when contentType is outside ALLOWED_MIME_TYPES", () => {
    const result = createPhotoEntryInputSchema.safeParse({
      contentType: "image/heic",
      byteLength: 100,
    });
    expect(result.success).toBe(false);
  });

  it("fails when byteLength exceeds MAX_UPLOAD_BYTES (uses imported constant, not literal)", () => {
    const result = createPhotoEntryInputSchema.safeParse({
      contentType: "image/jpeg",
      byteLength: 1_048_577,
    });
    expect(result.success).toBe(false);
  });

  it("succeeds when byteLength equals MAX_UPLOAD_BYTES exactly (boundary case)", () => {
    const result = createPhotoEntryInputSchema.safeParse({
      contentType: "image/jpeg",
      byteLength: 1_048_576,
    });
    expect(result.success).toBe(true);
  });

  it("fails when note exceeds 500 characters", () => {
    const result = createPhotoEntryInputSchema.safeParse({
      contentType: "image/jpeg",
      byteLength: 100,
      note: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("fails via .strict() when unknown key is provided", () => {
    const result = createPhotoEntryInputSchema.safeParse({
      contentType: "image/jpeg",
      byteLength: 100,
      unknownKey: "x",
    });
    expect(result.success).toBe(false);
  });
});
