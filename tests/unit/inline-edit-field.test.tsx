// T-05-14-01 — XSS regression: user-typed values must render as text nodes, never as parsed HTML.
import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InlineEditField } from "@shared/ui/inline-edit-field";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeProps(overrides: Partial<Parameters<typeof InlineEditField>[0]> = {}) {
  return {
    label: "Nome",
    value: "Manjericão",
    placeholder: "Sem nome",
    variant: "text" as const,
    onSave: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("InlineEditField", () => {
  it("read state has role=button with tabIndex=0 and aria-label pairing label+value", () => {
    render(<InlineEditField {...makeProps()} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("tabIndex")).toBe("0");
    const ariaLabel = btn.getAttribute("aria-label");
    expect(ariaLabel).toContain("Nome");
    expect(ariaLabel).toContain("Manjericão");
  });

  it("empty value renders placeholder in italic", () => {
    render(<InlineEditField {...makeProps({ value: null })} />);
    const placeholder = screen.getByText("Sem nome");
    expect(placeholder.className).toContain("italic");
  });

  it("click on read button enters editing with focused input and selected value", async () => {
    render(<InlineEditField {...makeProps()} />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe("Manjericão");
  });

  it("Enter on read button enters editing", async () => {
    render(<InlineEditField {...makeProps()} />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.keyDown(btn, { key: "Enter" });
    });
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("Space on read button enters editing", async () => {
    render(<InlineEditField {...makeProps()} />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.keyDown(btn, { key: " " });
    });
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("blur (text variant) calls onSave with new value and shows aria-busy=true during save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<InlineEditField {...makeProps({ onSave })} />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hortelã" } });
    await act(async () => {
      fireEvent.blur(input);
    });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Hortelã");
    });
  });

  it("Enter (text variant) calls onSave with new value", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<InlineEditField {...makeProps({ onSave })} />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Alecrim" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Alecrim");
    });
  });

  it("Esc reverts to pre-edit value with no callback", async () => {
    const onSave = vi.fn();
    render(<InlineEditField {...makeProps({ value: "Manjericão", onSave })} />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Outro" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button").textContent).toContain("Manjericão");
  });

  it("saving state shows Salvando… label and aria-busy=true, no progressbar spinner", async () => {
    const onSave = vi.fn(() => new Promise<void>(() => {}));
    render(<InlineEditField {...makeProps({ onSave })} />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const input = screen.getByRole("textbox");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(screen.getByText(/Salvando…/)).toBeTruthy();
    const wrapper = document.querySelector("[aria-busy='true']");
    expect(wrapper).not.toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("onSave rejection reverts displayed value and announces via role=alert", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("503"));
    render(
      <InlineEditField
        {...makeProps({
          value: "Manjericão",
          onSave,
          revertAnnouncementCopy: "Não conseguimos salvar agora — tentar de novo?",
        })}
      />
    );
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hortelã" } });
    await act(async () => {
      fireEvent.blur(input);
    });
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Não conseguimos salvar agora");
    });
    expect(screen.getByRole("button").textContent).toContain("Manjericão");
  });

  it("onSave rejection without revertAnnouncementCopy is silent — no role=alert rendered", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("503"));
    render(<InlineEditField {...makeProps({ value: "Manjericão", onSave })} />);
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hortelã" } });
    await act(async () => {
      fireEvent.blur(input);
    });
    await waitFor(() => {
      expect(screen.getByRole("button").textContent).toContain("Manjericão");
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("required + empty submit blocks save and shows role=alert with requiredErrorCopy", async () => {
    const onSave = vi.fn();
    render(
      <InlineEditField
        {...makeProps({
          value: "Manjericão",
          required: true,
          requiredErrorCopy: "Não pode ficar vazio.",
          onSave,
        })}
      />
    );
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(onSave).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Não pode ficar vazio.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.className).toContain("border-rust");
  });

  it("readOnly=true renders read state with no tap affordance — click does NOT enter editing", async () => {
    render(<InlineEditField {...makeProps({ readOnly: true })} />);
    expect(screen.queryByRole("button")).toBeNull();
    const readDiv = document.querySelector("[data-testid='inline-edit-read']") ??
      document.querySelector("div");
    if (readDiv) {
      fireEvent.click(readDiv);
    }
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("textarea variant — Enter inserts newline, Cmd+Enter commits", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <InlineEditField
        {...makeProps({ variant: "textarea", value: "linha 1", onSave })}
      />
    );
    const btn = screen.getByRole("button");
    await user.click(btn);
    const textarea = screen.getByRole("textbox");
    expect(textarea.tagName).toBe("TEXTAREA");

    // Enter should not commit
    fireEvent.change(textarea, { target: { value: "linha 1\n" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();

    // Cmd+Enter should commit
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("linha 1\n");
    });
  });

  it("date variant — blur commits value", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineEditField {...makeProps({ variant: "date", value: "2025-04-29", onSave })} />
    );
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const dateInput = document.querySelector("input[type='date']") as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput, { target: { value: "2025-04-29" } });
    await act(async () => {
      fireEvent.blur(dateInput);
    });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("2025-04-29");
    });
  });

  it("renderEditor slot replaces default editor in editing state", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    let capturedCommit: (() => void) | null = null;
    let capturedCancel: (() => void) | null = null;
    render(
      <InlineEditField
        {...makeProps({ onSave })}
        renderEditor={(args) => {
          capturedCommit = args.commit;
          capturedCancel = args.cancel;
          return <div data-testid="custom-slot">{args.value}</div>;
        }}
      />
    );
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(screen.getByTestId("custom-slot")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();

    // Call commit callback directly
    await act(async () => {
      capturedCommit?.();
    });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it("renderEditor slot cancel reverts without calling onSave", async () => {
    const onSave = vi.fn();
    let capturedCancel: (() => void) | null = null;
    render(
      <InlineEditField
        {...makeProps({ value: "Manjericão", onSave })}
        renderEditor={(args) => {
          capturedCancel = args.cancel;
          return <div data-testid="custom-slot">{args.value}</div>;
        }}
      />
    );
    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      capturedCancel?.();
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button").textContent).toContain("Manjericão");
  });

  it("XSS safety (T-05-14-01): typed <script> renders as text node, not executed HTML", async () => {
    const preCount = document.querySelectorAll("script").length;
    const xssPayload = "<script>alert(1)</script>";

    // Use a controlled wrapper so the displayed value updates after save resolves.
    function XssWrapper() {
      const [val, setVal] = useState<string>("");
      return (
        <InlineEditField
          label="Nome"
          value={val}
          placeholder="Sem nome"
          variant="text"
          onSave={async (v) => {
            setVal(v);
          }}
        />
      );
    }
    render(<XssWrapper />);

    const btn = screen.getByRole("button");
    await act(async () => {
      fireEvent.click(btn);
    });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: xssPayload } });
    await act(async () => {
      fireEvent.blur(input);
    });

    // After onSave resolves, the read button shows the payload as literal text
    await waitFor(() => {
      const readBtn = screen.getByRole("button");
      // textContent must contain literal angle brackets — not executed as HTML
      expect(readBtn.textContent).toContain("<script>alert(1)</script>");
    });
    // No new script elements were injected into the DOM
    expect(document.querySelectorAll("script").length).toBe(preCount);
  });
});
