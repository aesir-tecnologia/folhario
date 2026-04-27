import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieSetMock = vi.fn();
const cookieGetMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSetMock, get: cookieGetMock }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

describe("UI-02 setTheme Server Action — allowlist guard + cookie write", () => {
  beforeEach(() => {
    cookieSetMock.mockClear();
    cookieGetMock.mockClear();
    revalidatePathMock.mockClear();
  });

  it.each(["auto", "light", "dark"] as const)(
    "setTheme(%s) writes folhario_theme cookie with correct options",
    async (value) => {
      const { setTheme } = await import("../../src/shared/theme/use-theme");
      await setTheme(value);
      expect(cookieSetMock).toHaveBeenCalledTimes(1);
      expect(cookieSetMock).toHaveBeenCalledWith(
        "folhario_theme",
        value,
        expect.objectContaining({ path: "/", sameSite: "lax" }),
      );
    },
  );

  it("setTheme rejects values outside allowlist (T-03-02-01 cookie injection guard)", async () => {
    const { setTheme } = await import("../../src/shared/theme/use-theme");
    await expect(setTheme("malicious'; DROP TABLE--" as never)).rejects.toThrow();
    await expect(setTheme(undefined as never)).rejects.toThrow();
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("setTheme does NOT call revalidatePath (Open Risk #4 — Next 16 auto re-renders)", async () => {
    const { setTheme } = await import("../../src/shared/theme/use-theme");
    await setTheme("dark");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("UI-02 getTheme — allowlist-validated read", () => {
  beforeEach(() => {
    cookieGetMock.mockClear();
  });

  it("returns 'auto' when no cookie present", async () => {
    cookieGetMock.mockReturnValue(undefined);
    const { getTheme } = await import("../../src/shared/theme/use-theme");
    expect(await getTheme()).toBe("auto");
  });

  it("returns cookie value when present and valid", async () => {
    cookieGetMock.mockReturnValue({ value: "dark" });
    const { getTheme } = await import("../../src/shared/theme/use-theme");
    expect(await getTheme()).toBe("dark");
  });

  it("returns 'auto' when cookie value is invalid (allowlist guard)", async () => {
    cookieGetMock.mockReturnValue({ value: "<script>alert(1)</script>" });
    const { getTheme } = await import("../../src/shared/theme/use-theme");
    expect(await getTheme()).toBe("auto");
  });
});
