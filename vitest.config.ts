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
        },
      },
      {
        extends: true,
        test: {
          name: { label: "integration", color: "green" },
          include: ["tests/integration/**/*.integration.test.ts"],
          environment: "node",
          testTimeout: 30_000,
        },
      },
    ],
  },
});
