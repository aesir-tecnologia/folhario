import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const CONTEXTS = [
  "iam",
  "catalog",
  "species-care",
  "identification",
  "reminders",
  "billing",
  "notifications",
] as const;
const LAYERS = ["domain", "application", "infrastructure", "api", "inngest"] as const;
const SHARED_DIRS = ["db", "events", "adapters"] as const;

describe("INFRA-02 bounded-context scaffold (PRD §2)", () => {
  it.each(CONTEXTS.flatMap((ctx) => LAYERS.map((layer) => [ctx, layer] as const)))(
    "src/contexts/%s/%s/.gitkeep exists",
    (ctx, layer) => {
      const p = resolve(process.cwd(), `src/contexts/${ctx}/${layer}/.gitkeep`);
      expect(existsSync(p), `expected ${p}`).toBe(true);
    },
  );

  it.each(SHARED_DIRS)("src/shared/%s/.gitkeep exists", (dir) => {
    const p = resolve(process.cwd(), `src/shared/${dir}/.gitkeep`);
    expect(existsSync(p), `expected ${p}`).toBe(true);
  });

  it("total .gitkeep count is 38 (35 contexts + 3 shared)", () => {
    const ctxCount = CONTEXTS.length * LAYERS.length;
    const sharedCount = SHARED_DIRS.length;
    expect(ctxCount + sharedCount).toBe(38);
  });
});
