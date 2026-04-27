import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

function walk(dir: string, ext: RegExp): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out = out.concat(walk(full, ext));
    } else if (ext.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const UI_ROOT = resolve(process.cwd(), "src/shared/ui");

// Banned literal patterns per PRD §17 / UI-25.
// Note: this rule walks SOURCE TEXT, so it catches both runtime values and
// string literals used as className tokens. Strict word-boundary matches on
// the banned font names; case-insensitive hex matches.
const BANNED = [
  { pattern: /#000(000)?\b/i, name: "pure black hex (#000 / #000000)" },
  { pattern: /#fff(fff)?\b/i, name: "pure white hex (#FFF / #FFFFFF)" },
  { pattern: /linear-gradient\(/i, name: "linear-gradient (banned for text fills)" },
  { pattern: /\bInter\b/, name: "Inter font (banned by UI-25)" },
  { pattern: /\bTimes\b/, name: "Times font (banned by UI-25)" },
  { pattern: /\bGeorgia\b/, name: "Georgia font (banned by UI-25)" },
  { pattern: /\bGaramond\b/, name: "Garamond font (banned by UI-25)" },
  { pattern: /\bPalatino\b/, name: "Palatino font (banned by UI-25)" },
  { pattern: /backdrop-filter:/i, name: "backdrop-filter (glassmorphism banned)" },
];

describe("UI-25 banned patterns — snapshot guard over src/shared/ui/**/*.tsx", () => {
  const files = walk(UI_ROOT, /\.tsx$/);

  it(`finds 0 or more UI primitive files (currently ${files.length})`, () => {
    // Sanity: directory may or may not exist yet (Plan 01 ships before primitives).
    expect(files.length).toBeGreaterThanOrEqual(0);
  });

  for (const file of files) {
    const rel = file.replace(process.cwd() + "/", "");
    const content = readFileSync(file, "utf-8");

    // Strip line + block comments before applying bans (so token references in
    // doc comments don't trigger a self-invalidating grep gate).
    const stripped = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    for (const { pattern, name } of BANNED) {
      it(`${rel} contains no ${name}`, () => {
        const match = stripped.match(pattern);
        expect(match, `${rel} must not contain ${name}; first match: ${match?.[0]}`).toBeNull();
      });
    }

    // Motion-using primitive guard: any file importing from "motion/react" must
    // also import useReducedMotion (or use the motion-reduce: Tailwind variant).
    if (/from ["']motion\/react["']/.test(stripped)) {
      it(`${rel} imports useReducedMotion (motion primitive must respect reduced-motion)`, () => {
        const hasHook = /useReducedMotion/.test(stripped);
        const hasMotionReduceClass = /motion-reduce:/.test(stripped);
        expect(
          hasHook || hasMotionReduceClass,
          `${rel} imports motion/react but does not use useReducedMotion or motion-reduce: variant`,
        ).toBe(true);
      });
    }
  }
});

describe("UI-25 token-mirror sync — JS tokens.ts matches CSS globals.css", () => {
  const cssPath = resolve(process.cwd(), "src/app/globals.css");
  const tsPath = resolve(process.cwd(), "src/shared/theme/tokens.ts");
  const cssContent = readFileSync(cssPath, "utf-8");
  const tsContent = readFileSync(tsPath, "utf-8");

  // Spot-check — both files declare the same Paper Cream / Night Cream values.
  const PAIRS: [string, string][] = [
    ["#FBF7EF", "paper light"],
    ["#FFFDF7", "ivory light"],
    ["#1F4D35", "canopy light"],
    ["#143424", "forest light"],
    ["#1A1613", "paper dark"],
    ["#6FAE8A", "canopy dark"],
    ["#F2EADB", "forest dark"],
  ];

  for (const [hex, role] of PAIRS) {
    it(`${role} value ${hex} present in BOTH globals.css and tokens.ts`, () => {
      expect(cssContent).toContain(hex);
      expect(tsContent).toContain(hex);
    });
  }
});
