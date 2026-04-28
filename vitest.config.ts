import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: { label: "unit", color: "cyan" },
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          isolate: false,
          setupFiles: ["tests/unit/setup-env.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "unit-dom", color: "magenta" },
          include: ["tests/unit/**/*.test.tsx"],
          environment: "jsdom",
          isolate: false,
          setupFiles: ["tests/unit/setup-env.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "integration", color: "green" },
          include: ["tests/integration/**/*.integration.test.ts"],
          environment: "node",
          testTimeout: 30_000,
          // Phase 4 D-28: integration project does NOT inherit
          // tests/unit/setup-env.ts (synthetic env). Live local Supabase
          // values come from .env.local. The global-setup.ts file is a
          // marker that exists to anchor future per-suite setup hooks
          // without re-introducing the unit setup-env regression
          // (Phase 1 plan 01-04 fix).
          setupFiles: ["./tests/integration/global-setup.ts"],
        },
      },
    ],
  },
});
