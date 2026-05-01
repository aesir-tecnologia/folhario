import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Required keys per UI-SPEC.md Copywriting Contract (Phase 3 placeholders + cross-cutting).
const REQUIRED_KEYS = [
  "nav.tabs.home",
  "nav.tabs.catalog",
  "nav.tabs.identify",
  "nav.tabs.profile",
  "home.empty.title",
  "home.empty.hint",
  "home.empty.cta",
  "home.empty.manualLink",
  "catalog.empty.title",
  "catalog.empty.hint",
  "catalog.empty.cta",
  "identify.placeholder.title",
  "identify.placeholder.hint",
  "identify.placeholder.offlineBlocked",
  "profile.empty.title",
  "profile.empty.hint",
  "theme.toggle.label",
  "theme.toggle.options.auto",
  "theme.toggle.options.light",
  "theme.toggle.options.dark",
  "app.update.label",
  "app.update.cta",
  "offline.banner.label",
  "offline.page.title",
  "offline.page.hint",
  "offline.page.cta",
  "readonly.banner.label",
  "sync.discardSummary.label",
  "focus.skipToMain",
  "error.generic.title",
  "error.generic.hint",
  "error.generic.cta",
  "dialog.destructive.cancel",
  "dialog.destructive.confirm",
];

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => {
      if (acc !== null && typeof acc === "object" && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
}

describe("UI-23 src/messages/pt-BR.json — required keys present and non-empty", () => {
  const path = resolve(process.cwd(), "src/messages/pt-BR.json");
  const content = readFileSync(path, "utf-8");
  const messages = JSON.parse(content) as Record<string, unknown>;

  it.each(REQUIRED_KEYS)("contains key %s", (key) => {
    const value = getNested(messages, key);
    expect(value, `Key "${key}" missing or not a string in pt-BR.json`).toBeTypeOf("string");
    expect((value as string).length, `Key "${key}" is empty in pt-BR.json`).toBeGreaterThan(0);
  });

  it("has at least 30 leaf keys total", () => {
    function countLeaves(o: Record<string, unknown>): number {
      let n = 0;
      for (const v of Object.values(o)) {
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          n += countLeaves(v as Record<string, unknown>);
        } else if (typeof v === "string") {
          n++;
        }
      }
      return n;
    }
    expect(countLeaves(messages)).toBeGreaterThanOrEqual(30);
  });
});
