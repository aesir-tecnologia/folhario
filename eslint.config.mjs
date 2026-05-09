// verified from create-next-app@16.2.4 output
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

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
  // Phase-3 D-32 — better-tailwindcss (substitutes eslint-plugin-tailwindcss which lacks v4 support)
  // Open Risk #1 substitution: eslint-plugin-tailwindcss → eslint-plugin-better-tailwindcss@4.4.1
  // Open Risk #7: globals.css with @import "tailwindcss" MUST exist before this loads (Task 1 gate)
  //
  // HIGH 1d (codex review) — Tailwind v4 arbitrary utilities used across Plans 03-04
  //   (e.g., min-h-[48px], min-h-[44px], min-h-[56px], h-[4px], w-[36px],
  //    max-w-[480px], pb-[80px], min-h-[100dvh], translate-x via [transform:...],
  //    duration-[240ms], ease-[cubic-bezier(.2,.8,.2,1)], focus:z-[100], z-[60])
  //   MUST be recognized by eslint-plugin-better-tailwindcss@4.4.1. Two knobs:
  //     1. entryPoint (set below) — points the plugin at globals.css so it can
  //        derive utility names from the @theme block at lint time.
  //     2. callees / tailwindAttributes — only needed if class strings flow
  //        through helper wrappers (e.g., cn(...), clsx(...)). Phase 3 ships
  //        NO cn() wrapper; className strings live directly on JSX className=
  //        attributes which the plugin recognizes via built-in JSXAttribute handling.
  //        If a future plan introduces cn() or a similar helper, ADD it to
  //        callees: ["cn", "clsx"] here.
  {
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/app/globals.css",
        // callees: ["cn", "clsx"], // uncomment when a helper wrapper is added
      },
    },
    rules: {
      ...betterTailwindcss.configs.recommended.rules,
    },
  },
  // Phase-3 PRD §17 custom rules (UI-25 banned patterns)
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/[\\u{1F300}-\\u{1FAFF}]|[\\u{2600}-\\u{27BF}]/u]",
          message:
            "Emojis are banned in UI copy/labels/buttons (PRD §17 / UI-25). Use Lucide icons instead.",
        },
        {
          selector: "JSXText[value=/[\\u{1F300}-\\u{1FAFF}]|[\\u{2600}-\\u{27BF}]/u]",
          message:
            "Emojis are banned in UI copy/labels/buttons (PRD §17 / UI-25). Use Lucide icons instead.",
        },
        {
          selector:
            "ImportSpecifier[imported.name='Inter'][parent.source.value='next/font/google']",
          message:
            "Inter font is banned (PRD §17 / UI-25). Use Source Serif 4 + Plus Jakarta Sans only.",
        },
      ],
    },
  },
  globalIgnores([
    "node_modules",
    ".next/**",
    ".vercel/**",
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
    // CJS plugin uses require() by design — not subject to ESLint TS rules
    "tools/stylelint-plugins/**",
  ]),
]);

export default eslintConfig;
