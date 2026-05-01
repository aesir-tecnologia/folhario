import { describe, expect, it } from "vitest";

import { normalizeLocationLabel } from "@contexts/catalog/domain/locations";

describe("normalizeLocationLabel", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeLocationLabel("  Sala  ")).toBe("sala");
  });

  it("lowercases using pt-BR locale rules", () => {
    expect(normalizeLocationLabel("Sala")).toBe("sala");
    expect(normalizeLocationLabel("VARANDA")).toBe("varanda");
  });

  it("folds Portuguese diacritics (NFD + remove diacritic property)", () => {
    expect(normalizeLocationLabel("Cozinha")).toBe(normalizeLocationLabel("cozinhã"));
    expect(normalizeLocationLabel("Varanda dos Fundos")).toBe(
      normalizeLocationLabel("varanda dos fúndos"),
    );
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(normalizeLocationLabel("Quarto   dos  fundos")).toBe("quarto dos fundos");
  });

  it("is idempotent — normalize(normalize(x)) === normalize(x)", () => {
    const samples = [
      "  Sala  ",
      "Varanda dos Fundos",
      "COZINHA",
      "Quarto   dos  fundos",
      "varánda",
      "jardim",
    ];
    for (const s of samples) {
      const once = normalizeLocationLabel(s);
      const twice = normalizeLocationLabel(once);
      expect(twice).toBe(once);
    }
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeLocationLabel("   ")).toBe("");
    expect(normalizeLocationLabel("")).toBe("");
  });
});
