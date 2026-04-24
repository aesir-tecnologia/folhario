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
    ".planning/**",
    ".planning.bak-*/**",
    "docs/**",
    "supabase/**",
    "gsd-review-*.md",
  ]),
]);

export default eslintConfig;
