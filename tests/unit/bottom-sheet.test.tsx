import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("BottomSheet — a11y primitive (UI-08, UI-11)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("Test 1 — drag handle is interactive: has role=button, aria-label=Fechar, tabIndex=0, NOT aria-hidden", async () => {
    const { BottomSheet } = await import("../../src/shared/ui/bottom-sheet");
    render(
      <BottomSheet open onOpenChange={() => {}} title="Test" closeLabel="Fechar">
        <p>child</p>
      </BottomSheet>,
    );
    const handle = document.querySelector('[data-testid="bottomsheet-drag-handle"]');
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute("role")).toBe("button");
    expect(handle?.getAttribute("aria-label")).toBe("Fechar");
    expect(handle?.getAttribute("tabindex")).toBe("0");
    expect(handle?.getAttribute("aria-hidden")).toBeNull();
  });

  it("Test 2 — drag handle dismisses on Enter: onOpenChange(false) called exactly once", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { BottomSheet } = await import("../../src/shared/ui/bottom-sheet");
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="Test" closeLabel="Fechar">
        <p>child</p>
      </BottomSheet>,
    );
    const handle = document.querySelector<HTMLElement>('[data-testid="bottomsheet-drag-handle"]');
    expect(handle).not.toBeNull();
    handle!.focus();
    await user.keyboard("{Enter}");
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Test 3 — drag handle dismisses on Space: onOpenChange(false) called exactly once", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { BottomSheet } = await import("../../src/shared/ui/bottom-sheet");
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="Test" closeLabel="Fechar">
        <p>child</p>
      </BottomSheet>,
    );
    const handle = document.querySelector<HTMLElement>('[data-testid="bottomsheet-drag-handle"]');
    expect(handle).not.toBeNull();
    handle!.focus();
    await user.keyboard(" ");
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Test 4 — drag handle ignores other keys: onOpenChange NOT called for key 'a'", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { BottomSheet } = await import("../../src/shared/ui/bottom-sheet");
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="Test" closeLabel="Fechar">
        <p>child</p>
      </BottomSheet>,
    );
    const handle = document.querySelector<HTMLElement>('[data-testid="bottomsheet-drag-handle"]');
    expect(handle).not.toBeNull();
    handle!.focus();
    await user.keyboard("a");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Test 5 — alertdialog variant: Dialog.Content carries role=alertdialog in the DOM", async () => {
    const { BottomSheet } = await import("../../src/shared/ui/bottom-sheet");
    render(
      <BottomSheet open onOpenChange={() => {}} title="Test" closeLabel="Fechar" role="alertdialog">
        <p>child</p>
      </BottomSheet>,
    );
    const alertDialog = document.querySelector('[role="alertdialog"]');
    expect(alertDialog).not.toBeNull();
  });

  it("Test 6 — default role is 'dialog' when no role prop passed (Phase 4 byte-identity guard)", async () => {
    const { BottomSheet } = await import("../../src/shared/ui/bottom-sheet");
    render(
      <BottomSheet open onOpenChange={() => {}} title="Test" closeLabel="Fechar">
        <p>child</p>
      </BottomSheet>,
    );
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const alertDialog = document.querySelector('[role="alertdialog"]');
    expect(alertDialog).toBeNull();
  });

  it("Test 7 — child autoFocus wins initial focus (UI-SPEC §7 Cancel-first contract)", async () => {
    const { BottomSheet } = await import("../../src/shared/ui/bottom-sheet");
    render(
      <BottomSheet open onOpenChange={() => {}} title="Test" closeLabel="Fechar">
        <button type="button">first</button>
        <button type="button" autoFocus data-testid="cancel">
          Cancelar
        </button>
      </BottomSheet>,
    );
    await waitFor(() => {
      const cancel = document.querySelector('[data-testid="cancel"]');
      expect(document.activeElement).toBe(cancel);
    });
  });

  it("Test 8 — ModalSheet defaults to non-interactive drag handle: aria-hidden=true, no role=button", async () => {
    const { ModalSheet } = await import("../../src/shared/ui/modal-sheet");
    const { container } = render(
      <ModalSheet open onOpenChange={() => {}} title="Test" closeLabel="Fechar">
        <p>child</p>
      </ModalSheet>,
    );
    const handle = document.querySelector('[data-testid="bottomsheet-drag-handle"]');
    expect(handle).toBeNull();
    const hiddenDragDiv = document.querySelector('[aria-hidden="true"]');
    expect(hiddenDragDiv).not.toBeNull();
    expect(hiddenDragDiv?.getAttribute("role")).toBeNull();
    void container;
  });

  it("Test 9 — closeLabel forwarded to drag handle aria-label when interactive", async () => {
    const { BottomSheet } = await import("../../src/shared/ui/bottom-sheet");
    render(
      <BottomSheet open onOpenChange={() => {}} title="Test" closeLabel="Cerrar">
        <p>child</p>
      </BottomSheet>,
    );
    const handle = document.querySelector('[data-testid="bottomsheet-drag-handle"]');
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute("aria-label")).toBe("Cerrar");
  });
});
