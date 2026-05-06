import { describe, it, expect } from "vitest";
import messages from "../../src/messages/pt-BR.json";

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => {
    if (o !== null && o !== undefined && typeof o === "object") {
      return (o as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

function collectLeaves(obj: unknown, prefix = ""): Array<{ path: string; value: unknown }> {
  if (typeof obj !== "object" || obj === null) {
    return [{ path: prefix, value: obj }];
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    collectLeaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

const REQUIRED_KEYS = [
  "identify.captureGuide.leaf",
  "identify.captureGuide.flower",
  "identify.captureGuide.whole",
  "identify.captureGuide.morePhotos",
  "identify.picker.cameraCta",
  "identify.picker.galleryCta",
  "identify.picker.identifyCta",
  "identify.picker.addMore",
  "identify.picker.removePhoto",
  "identify.picker.photoCount",
  "identify.loading.uploading",
  "identify.loading.identifying",
  "identify.results.heading",
  "identify.results.confidenceHigh",
  "identify.results.confidenceMedium",
  "identify.results.confidenceLow",
  "identify.results.tierPrefixMedium",
  "identify.results.tierPrefixLow",
  "identify.results.notNoneOfThese",
  "identify.results.notNoneOfTheseManualLink",
  "identify.results.viewHistoryLink",
  "identify.resultSheet.title",
  "identify.resultSheet.selectedPrefix",
  "identify.resultSheet.fields.name.label",
  "identify.resultSheet.fields.name.placeholder",
  "identify.resultSheet.fields.nickname.label",
  "identify.resultSheet.fields.nickname.placeholder",
  "identify.resultSheet.fields.location.label",
  "identify.resultSheet.fields.acquisitionDate.label",
  "identify.resultSheet.submit",
  "identify.resultSheet.submitting",
  "identify.resultSheet.failure",
  "identify.zeroResults.title",
  "identify.zeroResults.hint",
  "identify.zeroResults.retryCta",
  "identify.zeroResults.manualLink",
  "identify.capHit.title",
  "identify.capHit.resetHint",
  "identify.capHit.chipPrimary",
  "identify.capHit.chipSecondary",
  "identify.capHit.manualLink",
  "identify.providerUnavailable.title",
  "identify.providerUnavailable.hint",
  "identify.providerUnavailable.retryCta",
  "identify.providerUnavailable.manualLink",
  "identify.timeout.title",
  "identify.timeout.hint",
  "identify.timeout.retryCta",
  "identify.timeout.manualLink",
  "identify.offline.title",
  "identify.offline.hint",
  "identify.paywall.title",
  "identify.paywall.body",
  "identify.paywall.primaryCta",
  "identify.paywall.cancelCta",
  "identify.consent.chipLabel",
  "identify.consent.title",
  "identify.consent.body",
  "identify.consent.privacyLink",
  "identify.consent.accept",
  "identify.consent.cancel",
  "identify.header.history",
  "identify.history.title",
  "identify.history.empty.title",
  "identify.history.empty.hint",
  "identify.history.empty.cta",
  "identify.history.status.timeout",
  "identify.history.status.providerUnavailable",
  "identify.history.status.capHit",
  "identify.history.failures.timeout",
  "identify.history.failures.providerUnavailable",
  "identify.history.failures.capHit",
  "identify.history.suggestionPrefix",
  "identify.history.reassociate",
  "identify.history.itemAriaLabel",
  "identify.plantHistory.titleFormat",
  "identify.plantHistory.empty.title",
  "identify.plantHistory.empty.hint",
  "identify.toast.consentRequired",
  "identify.toast.validationFailed",
  "identify.toast.gpsRejected",
  "catalog.profile.sections.idHistory",
  "catalog.profile.idHistory.viewAll",
  "catalog.profile.idHistory.empty",
];

const ICU_PLACEHOLDER_KEYS: Array<{ key: string; placeholder: string }> = [
  { key: "identify.picker.removePhoto", placeholder: "{n}" },
  { key: "identify.picker.photoCount", placeholder: "{n}" },
  { key: "identify.resultSheet.title", placeholder: "{speciesName}" },
  { key: "identify.capHit.resetHint", placeholder: "{resetTime}" },
  { key: "identify.capHit.chipSecondary", placeholder: "{resetTime}" },
  { key: "identify.history.itemAriaLabel", placeholder: "{date}" },
  { key: "identify.plantHistory.titleFormat", placeholder: "{plantName}" },
];

describe("identify i18n contract", () => {
  it("every UI-SPEC key resolves to a string (>= 50 assertions)", () => {
    expect(REQUIRED_KEYS.length).toBeGreaterThanOrEqual(50);
    for (const key of REQUIRED_KEYS) {
      const value = getByPath(messages as Record<string, unknown>, key);
      expect(typeof value, `key "${key}" should be a string`).toBe("string");
    }
  });

  it("ICU placeholders are preserved verbatim (>= 7 assertions)", () => {
    expect(ICU_PLACEHOLDER_KEYS.length).toBeGreaterThanOrEqual(7);
    for (const { key, placeholder } of ICU_PLACEHOLDER_KEYS) {
      const value = getByPath(messages as Record<string, unknown>, key);
      expect(typeof value, `key "${key}" should be a string`).toBe("string");
      expect(String(value), `key "${key}" should contain placeholder "${placeholder}"`).toContain(
        placeholder,
      );
    }
  });

  it("no English fallback strings in identify.* leaves", () => {
    const leaves = collectLeaves((messages as Record<string, unknown>)["identify"]);
    for (const { path, value } of leaves) {
      if (typeof value !== "string") continue;
      expect(value, `identify.${path} must not contain "TODO"`).not.toContain("TODO");
      expect(value, `identify.${path} must not contain "PLACEHOLDER"`).not.toContain("PLACEHOLDER");
      expect(value, `identify.${path} must not contain "[en]"`).not.toContain("[en]");
    }
  });
});
