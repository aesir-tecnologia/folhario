import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * D-01 guard: `src/shared/db/schema-registry.ts` is migration-only and must
 * NOT be imported by application/route/use-case code. Repositories under
 * `src/contexts/*\/infrastructure` may import per-context schema modules
 * directly (and may legitimately want to import the registry in rare
 * migration-adjacent helpers), so this guard is intentionally narrow:
 * it only checks `src/app`, `src/contexts/*\/api`, and
 * `src/contexts/*\/application`.
 *
 * Threat T-02-02 mitigation. Route-handler import guard (drizzle-orm)
 * lands in plan 02-05 with a similar pattern.
 */

const PROJECT_ROOT = join(__dirname, "..", "..");
const SCAN_DIRS_FIXED = [join(PROJECT_ROOT, "src", "app")];
const CONTEXT_SUBDIRS = ["api", "application"] as const;

// Match any import-from path containing the substring `schema-registry`
// regardless of whether it's an alias (`@shared/db/schema-registry`),
// absolute (`src/shared/db/schema-registry`), or relative
// (`../../../shared/db/schema-registry`). Covers `import ... from "..."`,
// `import "..."`, and dynamic `import("...")` forms.
const IMPORT_PATTERN = /\b(?:from|import)\s*\(?\s*["'][^"']*schema-registry[^"']*["']/g;

const TS_LIKE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

function collectFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const stat = statSync(root);
  if (!stat.isDirectory()) return [];

  const found: string[] = [];
  const entries = readdirSync(root, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!TS_LIKE.test(entry.name)) continue;
    const parentPath = (entry as { parentPath?: string; path?: string }).parentPath
      ?? (entry as { path?: string }).path
      ?? root;
    found.push(join(parentPath, entry.name));
  }
  return found;
}

function collectContextFiles(): string[] {
  const contextsRoot = join(PROJECT_ROOT, "src", "contexts");
  if (!existsSync(contextsRoot)) return [];
  const contexts = readdirSync(contextsRoot, { withFileTypes: true });
  const files: string[] = [];
  for (const ctx of contexts) {
    if (!ctx.isDirectory()) continue;
    for (const sub of CONTEXT_SUBDIRS) {
      files.push(...collectFiles(join(contextsRoot, ctx.name, sub)));
    }
  }
  return files;
}

function findOffenders(): string[] {
  const offenders: string[] = [];
  const files = [...SCAN_DIRS_FIXED.flatMap(collectFiles), ...collectContextFiles()];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (IMPORT_PATTERN.test(source)) {
      offenders.push(file);
    }
    IMPORT_PATTERN.lastIndex = 0;
  }
  return offenders;
}

describe("D-01 schema-registry isolation guard (T-02-02)", () => {
  it("registry exists and carries the migration-only marker", () => {
    const registry = join(PROJECT_ROOT, "src", "shared", "db", "schema-registry.ts");
    expect(existsSync(registry)).toBe(true);
    const source = readFileSync(registry, "utf8");
    expect(source).toContain("Migration registry only");
  });

  it("self-test: regex catches an import of @shared/db/schema-registry", () => {
    const sample = 'import { users } from "@shared/db/schema-registry";';
    expect(IMPORT_PATTERN.test(sample)).toBe(true);
    IMPORT_PATTERN.lastIndex = 0;
  });

  it("self-test: regex catches a relative import of schema-registry", () => {
    const sample = "import * as sr from \"../../../shared/db/schema-registry\";";
    expect(IMPORT_PATTERN.test(sample)).toBe(true);
    IMPORT_PATTERN.lastIndex = 0;
  });

  it("self-test: regex catches dynamic import of schema-registry", () => {
    const sample = "const sr = await import(\"@shared/db/schema-registry\");";
    expect(IMPORT_PATTERN.test(sample)).toBe(true);
    IMPORT_PATTERN.lastIndex = 0;
  });

  it("no application-layer file imports schema-registry", () => {
    const offenders = findOffenders();
    expect(
      offenders,
      `schema-registry must not be imported from src/app or src/contexts/*\/{api,application}. Offenders:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
