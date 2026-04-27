import { describe, it, expect } from "vitest";
import {
  formatCurrencyBRL,
  formatDate,
  formatTime,
  formatDateTime,
} from "@shared/i18n/format";

describe("UI-23 formatCurrencyBRL", () => {
  it.each([
    [2990, "R$ 29,90"],
    [100000, "R$ 1.000,00"],
    [0, "R$ 0,00"],
  ])("formatCurrencyBRL(%i) returns %s", (cents, expected) => {
    // Note: Intl may use NBSP (U+00A0) between R$ and digits; normalize.
    expect(formatCurrencyBRL(cents).replace(/ /g, " ")).toBe(expected);
  });
});

describe("UI-23 formatDate", () => {
  it("formats Date to dd/MM/yyyy", () => {
    expect(formatDate(new Date("2026-04-26T00:00:00Z"))).toBe("26/04/2026");
  });

  it("accepts ISO string and formats to dd/MM/yyyy", () => {
    expect(formatDate("2026-04-26")).toBe("26/04/2026");
  });
});

describe("UI-23 formatTime — 24h, no AM/PM", () => {
  it("formats UTC time as HH:mm (24h)", () => {
    // Pin tz to UTC for deterministic assertion in CI.
    expect(formatTime(new Date("2026-04-26T14:30:00Z"), "UTC")).toBe("14:30");
  });

  it("respects timeZone arg — BRT (UTC-3) shifts 14:30 UTC to 11:30 local", () => {
    expect(formatTime(new Date("2026-04-26T14:30:00Z"), "America/Sao_Paulo")).toBe("11:30");
  });
});

describe("UI-23 formatDateTime composite", () => {
  it("returns dd/MM/yyyy HH:mm", () => {
    expect(formatDateTime(new Date("2026-04-26T14:30:00Z"), "UTC")).toBe("26/04/2026 14:30");
  });
});
