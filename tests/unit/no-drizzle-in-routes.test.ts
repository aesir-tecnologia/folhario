import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * D-17 / T-02-11 guard: route handlers under `src/app/api/**\/route.ts` MUST
 * NOT import Drizzle, the runtime DB client, the schema registry, or any
 * per-context schema module. They call use-cases (which call repositories
 * via `withUnitOfWork`) instead.
 *
 * This is the Vitest companion to the ESLint `no-restricted-imports` rule
 * in `eslint.config.mjs`. ESLint covers IDE / pre-commit; this grep covers
 * `--no-eslint` invocations and CI environments where flat-config plugins
 * could silently drop. Mirrors `tests/unit/schema-registry.test.ts`.
 */

const PROJECT_ROOT = join(__dirname, "..", "..");
const API_ROUTES_ROOT = join(PROJECT_ROOT, "src", "app", "api");

const FORBIDDEN_PATTERNS: { name: string; regex: RegExp }[] = [
  // `drizzle-orm` and any subpath (drizzle-orm/postgres-js, drizzle-orm/sql, …).
  {
    name: "drizzle-orm (and subpaths)",
    regex: /\b(?:from|import)\s*\(?\s*["'](drizzle-orm)(?:\/[^"']*)?["']/g,
  },
  // The runtime DB client.
  {
    name: "@shared/db/client (alias or relative)",
    regex: /\b(?:from|import)\s*\(?\s*["'][^"']*shared\/db\/client(?:["']|\?[^"']*["'])/g,
  },
  // Migration-only schema registry.
  {
    name: "@shared/db/schema-registry (alias or relative)",
    regex: /\b(?:from|import)\s*\(?\s*["'][^"']*shared\/db\/schema-registry["']/g,
  },
  // Any per-context schema module.
  {
    name: "@contexts/*\/infrastructure/db/schema (alias or relative)",
    regex:
      /\b(?:from|import)\s*\(?\s*["'][^"']*contexts\/[^"'/]+\/infrastructure\/db\/schema["']/g,
  },
];

const ROUTE_FILE = /(^|[\\/])route\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;

function collectRouteFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const stat = statSync(root);
  if (!stat.isDirectory()) return [];

  const found: string[] = [];
  const entries = readdirSync(root, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!ROUTE_FILE.test(entry.name)) continue;
    const parentPath =
      (entry as { parentPath?: string; path?: string }).parentPath ??
      (entry as { path?: string }).path ??
      root;
    found.push(join(parentPath, entry.name));
  }
  return found;
}

interface Offense {
  file: string;
  pattern: string;
}

function findOffenders(): Offense[] {
  const offenders: Offense[] = [];
  const files = collectRouteFiles(API_ROUTES_ROOT);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const { name, regex } of FORBIDDEN_PATTERNS) {
      if (regex.test(source)) {
        offenders.push({ file, pattern: name });
      }
      regex.lastIndex = 0;
    }
  }
  return offenders;
}

describe("D-17 no Drizzle / DB internals in /api/v1 route handlers (T-02-11)", () => {
  it("at least one route handler exists in src/app/api (sanity)", () => {
    const files = collectRouteFiles(API_ROUTES_ROOT);
    expect(files.length).toBeGreaterThan(0);
  });

  it("self-test: regex catches alias import of drizzle-orm", () => {
    const sample = 'import { sql } from "drizzle-orm";';
    expect(FORBIDDEN_PATTERNS[0]!.regex.test(sample)).toBe(true);
    FORBIDDEN_PATTERNS[0]!.regex.lastIndex = 0;
  });

  it("self-test: regex catches alias import of drizzle-orm subpath", () => {
    const sample = 'import { drizzle } from "drizzle-orm/postgres-js";';
    expect(FORBIDDEN_PATTERNS[0]!.regex.test(sample)).toBe(true);
    FORBIDDEN_PATTERNS[0]!.regex.lastIndex = 0;
  });

  it("self-test: regex catches alias import of @shared/db/client", () => {
    const sample = 'import { db } from "@shared/db/client";';
    expect(FORBIDDEN_PATTERNS[1]!.regex.test(sample)).toBe(true);
    FORBIDDEN_PATTERNS[1]!.regex.lastIndex = 0;
  });

  it("self-test: regex catches relative import of shared/db/client", () => {
    const sample = "import { db } from \"../../../shared/db/client\";";
    expect(FORBIDDEN_PATTERNS[1]!.regex.test(sample)).toBe(true);
    FORBIDDEN_PATTERNS[1]!.regex.lastIndex = 0;
  });

  it("self-test: regex catches alias import of @shared/db/schema-registry", () => {
    const sample = 'import * as s from "@shared/db/schema-registry";';
    expect(FORBIDDEN_PATTERNS[2]!.regex.test(sample)).toBe(true);
    FORBIDDEN_PATTERNS[2]!.regex.lastIndex = 0;
  });

  it("self-test: regex catches alias import of a per-context schema module", () => {
    const sample = 'import { users } from "@contexts/iam/infrastructure/db/schema";';
    expect(FORBIDDEN_PATTERNS[3]!.regex.test(sample)).toBe(true);
    FORBIDDEN_PATTERNS[3]!.regex.lastIndex = 0;
  });

  it("self-test: regex catches dynamic import() of a forbidden path", () => {
    const sample = 'const m = await import("@shared/db/schema-registry");';
    expect(FORBIDDEN_PATTERNS[2]!.regex.test(sample)).toBe(true);
    FORBIDDEN_PATTERNS[2]!.regex.lastIndex = 0;
  });

  it("self-test: regex does NOT match unrelated `drizzle-orm`-mentioning text", () => {
    // Comments/strings that mention the package but aren't import statements
    // must not trip the guard.
    const sample = "// note: drizzle-orm is reserved for the repository layer";
    expect(FORBIDDEN_PATTERNS[0]!.regex.test(sample)).toBe(false);
    FORBIDDEN_PATTERNS[0]!.regex.lastIndex = 0;
  });

  it("no route handler imports Drizzle, the runtime client, the registry, or per-context schemas", () => {
    const offenders = findOffenders();
    expect(
      offenders,
      `Forbidden imports found in route handlers:\n${offenders
        .map((o) => `  - ${o.file} :: ${o.pattern}`)
        .join("\n")}`,
    ).toEqual([]);
  });
});
