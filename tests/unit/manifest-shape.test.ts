import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("OFF-09 public/manifest.webmanifest — Phase 3 PWA contract", () => {
  const path = resolve(process.cwd(), "public/manifest.webmanifest");
  const content = readFileSync(path, "utf-8");
  const manifest = JSON.parse(content) as Record<string, unknown>;

  it("is valid JSON", () => {
    expect(manifest).toBeTypeOf("object");
  });

  it("name === 'Folhário' and short_name === 'Folhário'", () => {
    expect(manifest.name).toBe("Folhário");
    expect(manifest.short_name).toBe("Folhário");
  });

  it("display === 'standalone'", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("theme_color === '#FBF7EF' (NOT '#FFFFFF' Phase 1 placeholder)", () => {
    expect(manifest.theme_color).toBe("#FBF7EF");
    expect(manifest.theme_color).not.toBe("#FFFFFF");
  });

  it("background_color === '#FBF7EF'", () => {
    expect(manifest.background_color).toBe("#FBF7EF");
  });

  it("lang === 'pt-BR'", () => {
    expect(manifest.lang).toBe("pt-BR");
  });

  it("start_url === '/' and scope === '/'", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("icons array contains 192, 512, AND maskable entries", () => {
    const icons = manifest.icons as Array<{ sizes: string; purpose?: string }>;
    expect(Array.isArray(icons)).toBe(true);

    const has192 = icons.some((i) => i.sizes?.includes("192"));
    const has512 = icons.some((i) => i.sizes?.includes("512"));
    const hasMaskable = icons.some((i) => i.purpose?.includes("maskable"));

    expect(has192, "icons[] must include a 192x192 entry").toBe(true);
    expect(has512, "icons[] must include a 512x512 entry").toBe(true);
    expect(hasMaskable, "icons[] must include at least one maskable entry").toBe(true);
  });

  it("NO monochrome icon entry required (Open Risk #2 — pwa-asset-generator can't produce one)", () => {
    const icons = manifest.icons as Array<{ purpose?: string }>;
    const hasMonochrome = icons.some((i) => i.purpose?.includes("monochrome"));
    // Either branch passes; this test exists purely to record the contract.
    expect(typeof hasMonochrome).toBe("boolean");
  });
});
