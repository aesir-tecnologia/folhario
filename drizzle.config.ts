import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for drizzle-kit (direct, non-pooled connection)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shared/db/schema-registry.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
