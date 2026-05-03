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
          include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/unit/setup-env.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "unit-dom", color: "magenta" },
          // src/**/*.unit.test.tsx: colocated React-render tests (e.g. billing
          // subscription provider). Plain *.test.tsx in src/ intentionally
          // excluded — those are picked up by the unit (node) project above.
          include: ["tests/unit/**/*.test.tsx", "src/**/*.unit.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/unit/setup-env.ts", "tests/unit/setup-idb.ts"],
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
          // Integration tests share a single local Postgres; running
          // files in parallel cross-pollutes global-scoped queries
          // (e.g. fetchPendingBatch, list-locations defaults). Force
          // serial file execution.
          fileParallelism: false,
        },
      },
    ],
  },
});
