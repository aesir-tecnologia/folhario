"use server";

import { cookies } from "next/headers";

/**
 * Theme value allowlist — exactly three values.
 * "auto" = no [data-theme] attribute (CSS media query controls; flash-free).
 * "light" / "dark" = explicit [data-theme] attribute (always wins over OS).
 *
 * The allowlist mitigates T-03-02-01 cookie injection: any other value sent
 * via Server Action OR found in cookie is rejected.
 */
const ALLOWED_VALUES = ["auto", "light", "dark"] as const;
export type ThemeValue = (typeof ALLOWED_VALUES)[number];

const ALLOWED_SET: ReadonlySet<string> = new Set(ALLOWED_VALUES);

function isThemeValue(value: unknown): value is ThemeValue {
  return typeof value === "string" && ALLOWED_SET.has(value);
}

export async function setTheme(value: ThemeValue): Promise<void> {
  if (!isThemeValue(value)) {
    throw new Error(`Invalid theme value: ${String(value)}`);
  }
  const cookieStore = await cookies();
  cookieStore.set("folhario_theme", value, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  // No revalidatePath — Next 16 auto-triggers same-page server re-render on cookie write.
}

/**
 * Read folhario_theme cookie with allowlist guard. Defaults to "auto".
 * MUST be called from src/app/layout.tsx (root layout) — Open Risk #4.
 * If called from a child layout, the root re-render won't pick up changes.
 */
export async function getTheme(): Promise<ThemeValue> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("folhario_theme")?.value;
  return isThemeValue(raw) ? raw : "auto";
}
