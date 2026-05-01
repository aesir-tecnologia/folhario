import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationCombobox } from "@shared/ui/location-combobox";

// Mock next-intl: useTranslations('catalog.locations') returns a function
// that resolves keys, with .raw() for array values.
// Defaults: ["sala","varanda","quarto","banheiro","cozinha","escritório","jardim","outro"]
const MOCK_DEFAULTS = [
  "sala",
  "varanda",
  "quarto",
  "banheiro",
  "cozinha",
  "escritório",
  "jardim",
  "outro",
];

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    if (namespace === "catalog.locations") {
      const mapping: Record<string, string> = {
        placeholder: "Adicionar local",
        addCustom: "Adicionar '{typed}'",
      };
      const rawMapping: Record<string, unknown> = {
        defaults: MOCK_DEFAULTS,
      };
      const t = (key: string) => mapping[key] ?? key;
      t.raw = (key: string) => rawMapping[key];
      return t;
    }
    // Fallback for other namespaces
    const t = (key: string) => key;
    t.raw = (key: string) => key;
    return t;
  },
}));

describe("LocationCombobox — user suggestions + i18n defaults merge (de-dupe)", () => {
  it("merges user suggestions first, then i18n defaults, de-duped by diacritic-insensitive normalization", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // suggestions: ["Sala da Mãe", "Sala", "Quintal"]
    // defaults: ["sala","varanda","quarto","banheiro","cozinha","escritório","jardim","outro"]
    //
    // Expected merge order (suggestions first, then defaults, dedupe by norm):
    // norm("Sala da Mãe") = "sala da mae" → unique → keep
    // norm("Sala") = "sala" → unique (not same as "sala da mae") → keep
    // norm("Quintal") = "quintal" → unique → keep
    // norm("sala") from defaults → already seen (norm matches "Sala") → DROP
    // norm("varanda") → unique → keep
    // norm("quarto") → unique → keep
    // norm("banheiro") → unique → keep
    // norm("cozinha") → unique → keep
    // norm("escritório") → norm = "escritorio" → unique → keep
    // norm("jardim") → unique → keep
    // norm("outro") → unique → keep
    //
    // Final: ["Sala da Mãe","Sala","Quintal","varanda","quarto","banheiro","cozinha","escritório","jardim","outro"]
    // (10 options; "sala" from defaults deduped against "Sala" from suggestions)

    render(
      <LocationCombobox
        label="Localização"
        suggestions={["Sala da Mãe", "Sala", "Quintal"]}
        value=""
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}");

    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    const labels = options.map((o) => o.textContent);

    // Suggestions first
    expect(labels[0]).toBe("Sala da Mãe");
    expect(labels[1]).toBe("Sala");
    expect(labels[2]).toBe("Quintal");

    // Then defaults (minus "sala" which was deduped against "Sala")
    expect(labels[3]).toBe("varanda");
    expect(labels[4]).toBe("quarto");
    expect(labels[5]).toBe("banheiro");
    expect(labels[6]).toBe("cozinha");
    expect(labels[7]).toBe("escritório");
    expect(labels[8]).toBe("jardim");
    expect(labels[9]).toBe("outro");

    // Total: 10 options (3 suggestions + 7 defaults, "sala" deduped)
    // Ghost row not shown since no typed value yet
    const nonGhostOptions = options.filter((o) => !o.textContent?.startsWith("Adicionar"));
    expect(nonGhostOptions).toHaveLength(10);

    // "sala" from defaults must NOT appear as a duplicate
    const allLabels = options.map((o) => o.textContent);
    const salaCount = allLabels.filter((l) => l?.toLowerCase() === "sala").length;
    expect(salaCount).toBe(1); // Only "Sala" from suggestions (not "sala" from defaults)
  });
});
