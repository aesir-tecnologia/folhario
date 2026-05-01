// T-05-12-01 XSS regression: typed input must render as text node, never as HTML
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup, fireEvent } from "@testing-library/react";
import { Combobox } from "@shared/ui/combobox";

const DEFAULT_OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

function renderCombobox(overrides: Partial<Parameters<typeof Combobox>[0]> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <Combobox
      label="Test label"
      value=""
      onChange={onChange}
      options={DEFAULT_OPTIONS}
      ghostRowTemplate="Adicionar '{typed}'"
      {...overrides}
    />,
  );
  const input = screen.getByRole("combobox");
  return { ...utils, onChange, input };
}

afterEach(() => {
  cleanup();
});

// T-05-12-01: XSS safety — must be at the top of the file per plan requirement
describe("T-05-12-01 — XSS safety: typed input renders as text node, not HTML", () => {
  it("renders typed <script>alert(1)</script> as literal text content, script count unchanged", () => {
    vi.useFakeTimers();
    try {
      const { input } = renderCombobox();
      const scriptsBefore = document.querySelectorAll("script").length;

      fireEvent.keyDown(input, { key: "ArrowDown" });
      const xssPayload = "<script>alert(1)</script>";
      fireEvent.change(input, { target: { value: xssPayload } });
      vi.advanceTimersByTime(100);

      expect(document.querySelectorAll("script").length).toBe(scriptsBefore);

      const listbox = screen.queryByRole("listbox");
      if (listbox) {
        const ghostRow = within(listbox).queryByRole("option", {
          name: /Adicionar/,
        });
        if (ghostRow) {
          expect(ghostRow.textContent).toContain("<script>alert(1)</script>");
        }
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Combobox — WAI-ARIA APG 1.2 keyboard contract", () => {
  it("initial render: role=combobox, aria-expanded=false, no aria-activedescendant", () => {
    const { input } = renderCombobox();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("listbox is not visible on initial render (before any interaction)", () => {
    renderCombobox();
    const listbox = screen.queryByRole("listbox");
    if (listbox) {
      expect(listbox).not.toBeVisible();
    } else {
      expect(listbox).toBeNull();
    }
  });

  it("ArrowDown opens listbox and highlights first option (aria-activedescendant matches first option id)", () => {
    const { input } = renderCombobox();
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/^.+-a$/));
  });

  it("ArrowDown moves highlight down with wrap: last option wraps back to first", () => {
    const { input } = renderCombobox();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/^.+-b$/));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/^.+-c$/));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/^.+-a$/));
  });

  it("ArrowUp wraps from first option to last", () => {
    const { input } = renderCombobox();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/^.+-c$/));
  });

  it("Home highlights first option; End highlights last option", () => {
    const { input } = renderCombobox();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Home" });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/^.+-a$/));
    fireEvent.keyDown(input, { key: "End" });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/^.+-c$/));
  });

  it("Enter commits highlighted option (second option) and closes listbox", () => {
    const { input, onChange } = renderCombobox();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("b");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("Esc closes listbox without committing; onChange NOT called; input value unchanged", () => {
    const { input, onChange } = renderCombobox({ value: "alpha-value" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("second Esc clears input value: with listbox closed, Esc calls onChange('')", () => {
    const { input, onChange } = renderCombobox({ value: "foo" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("printable typeahead with 100ms debounce: type 'alp', advance 100ms, only matching options visible", () => {
    vi.useFakeTimers();
    try {
      const { input } = renderCombobox();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.change(input, { target: { value: "alp" } });
      vi.advanceTimersByTime(100);

      const listbox = screen.getByRole("listbox");
      const options = within(listbox).getAllByRole("option");
      const visibleLabels = options.map((o) => o.textContent);
      expect(visibleLabels.some((l) => l?.includes("Alpha"))).toBe(true);
      expect(visibleLabels.some((l) => l?.includes("Beta"))).toBe(false);
      expect(visibleLabels.some((l) => l?.includes("Gamma"))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ghost row appears when typed value is not in options", () => {
    vi.useFakeTimers();
    try {
      const { input } = renderCombobox();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.change(input, { target: { value: "xyz" } });
      vi.advanceTimersByTime(100);

      const listbox = screen.getByRole("listbox");
      const ghostRow = within(listbox).getByText(/Adicionar 'xyz'/);
      expect(ghostRow).toBeTruthy();
      expect(ghostRow.closest('[role="option"]')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Enter on ghost row commits typed value via onChange", () => {
    vi.useFakeTimers();
    try {
      const { input, onChange } = renderCombobox();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.change(input, { target: { value: "varanda nova" } });
      vi.advanceTimersByTime(100);

      fireEvent.keyDown(input, { key: "Home" });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("varanda nova");
    } finally {
      vi.useRealTimers();
    }
  });

  it("T-05-12-01 — XSS: <script>alert(1)</script> renders as literal text, script count unchanged", () => {
    vi.useFakeTimers();
    try {
      const { input } = renderCombobox();
      const scriptsBefore = document.querySelectorAll("script").length;

      fireEvent.keyDown(input, { key: "ArrowDown" });
      const xssPayload = "<script>alert(1)</script>";
      fireEvent.change(input, { target: { value: xssPayload } });
      vi.advanceTimersByTime(100);

      expect(document.querySelectorAll("script").length).toBe(scriptsBefore);

      const listbox = screen.queryByRole("listbox");
      if (listbox) {
        const ghostRow = within(listbox).queryByRole("option", {
          name: /Adicionar/,
        });
        if (ghostRow) {
          expect(ghostRow.textContent).toContain("<script>alert(1)</script>");
        }
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
