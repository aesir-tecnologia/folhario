import { describe, it, expect } from "vitest";
import {
  createIdentificationRequestSchema,
  confirmIdentificationRequestSchema,
  correctIdentificationRequestSchema,
  listIdentificationsQuerySchema,
  recordConsentRequestSchema,
} from "@contexts/identification/domain/schemas";

const validUuid = "00000000-0000-4000-8000-000000000001";

describe("createIdentificationRequestSchema", () => {
  it("accepts valid userId and photos array", () => {
    const input = {
      userId: validUuid,
      photos: [{ buffer: Buffer.from("fake"), contentType: "image/jpeg" }],
    };
    expect(() => createIdentificationRequestSchema.parse(input)).not.toThrow();
  });

  it("rejects extra fields (strict mode)", () => {
    const input = {
      userId: validUuid,
      photos: [{ buffer: Buffer.from("fake"), contentType: "image/jpeg" }],
      extra: "field",
    };
    const result = createIdentificationRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("confirmIdentificationRequestSchema", () => {
  it("accepts valid confirm request with required fields", () => {
    const input = {
      speciesId: validUuid,
      name: "Costela de Adão",
    };
    expect(() => confirmIdentificationRequestSchema.parse(input)).not.toThrow();
  });

  it("accepts optional fields nickname, location, acquisitionDate", () => {
    const input = {
      speciesId: validUuid,
      name: "Costela de Adão",
      nickname: "Minha Monstera",
      location: "sala",
      acquisitionDate: "2026-01-15",
    };
    expect(() => confirmIdentificationRequestSchema.parse(input)).not.toThrow();
  });

  it("rejects extra fields (strict mode)", () => {
    const input = {
      speciesId: validUuid,
      name: "Costela de Adão",
      unexpected: true,
    };
    const result = confirmIdentificationRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("correctIdentificationRequestSchema", () => {
  it("accepts valid manualCorrection string", () => {
    const input = { manualCorrection: "Ficus lyrata" };
    expect(() => correctIdentificationRequestSchema.parse(input)).not.toThrow();
  });

  it("rejects extra fields (strict mode)", () => {
    const input = { manualCorrection: "Ficus lyrata", extra: 42 };
    const result = correctIdentificationRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("listIdentificationsQuerySchema", () => {
  it("accepts empty object with defaults applied", () => {
    const result = listIdentificationsQuerySchema.parse({});
    expect(result.limit).toBe(20);
  });

  it("accepts optional plantId, cursor, and limit", () => {
    const input = { plantId: validUuid, cursor: "opaque-cursor-xyz", limit: "50" };
    const result = listIdentificationsQuerySchema.parse(input);
    expect(result.plantId).toBe(validUuid);
    expect(result.cursor).toBe("opaque-cursor-xyz");
    expect(result.limit).toBe(50);
  });

  it("clamps limit to [1, 200]", () => {
    const tooLarge = listIdentificationsQuerySchema.safeParse({ limit: "999" });
    expect(tooLarge.success).toBe(false);

    const tooSmall = listIdentificationsQuerySchema.safeParse({ limit: "0" });
    expect(tooSmall.success).toBe(false);

    const valid = listIdentificationsQuerySchema.parse({ limit: "200" });
    expect(valid.limit).toBe(200);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = listIdentificationsQuerySchema.safeParse({ unknown: "field" });
    expect(result.success).toBe(false);
  });
});

describe("recordConsentRequestSchema", () => {
  it("accepts purpose=identification_third_party", () => {
    const input = { purpose: "identification_third_party" };
    expect(() => recordConsentRequestSchema.parse(input)).not.toThrow();
  });

  it("rejects any other purpose value", () => {
    const result = recordConsentRequestSchema.safeParse({ purpose: "signup" });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = recordConsentRequestSchema.safeParse({
      purpose: "identification_third_party",
      extra: "value",
    });
    expect(result.success).toBe(false);
  });
});
