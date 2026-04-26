// verified from create-next-app@16.2.4 output
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Phase-2 D-17 / T-02-11: route handlers under `src/app/api/**/route.ts`
  // MUST NOT import Drizzle, the runtime DB client, the schema registry, or
  // any per-context schema module. They call use-cases (which call
  // repositories via withUnitOfWork) instead. The companion Vitest grep
  // guard at `tests/unit/no-drizzle-in-routes.test.ts` enforces the same
  // boundary so coverage survives an `--no-eslint` invocation.
  {
    files: ["src/app/api/**/route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "drizzle-orm",
            "drizzle-orm/*",
            "@shared/db/client",
            "@shared/db/schema-registry",
            "@contexts/*/infrastructure/db/schema",
          ],
        },
      ],
    },
  },
  globalIgnores([
    "node_modules",
    ".next/**",
    "out/**",
    "build/**",
    "coverage",
    "playwright-report",
    "test-results",
    "public/sw.js",
    "next-env.d.ts",
    ".claude/**",
    ".codex/**",
    ".gemini/**",
    ".kilo/**",
    ".opencode/**",
    ".planning/**",
    ".planning.bak-*/**",
    "docs/**",
    "supabase/**",
    "gsd-review-*.md",
  ]),
]);

export default eslintConfig;
