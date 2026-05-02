import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, fireEvent, cleanup } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    function t(key: string, values?: Record<string, unknown>): string {
      if (values && Object.keys(values).length > 0) {
        return `${key}:${JSON.stringify(values)}`;
      }
      return key;
    }
    t.raw = (key: string) => key;
    return t;
  },
}));

import "../../src/app/(app)/catalog/[plantId]/delete-confirm-sheet";

beforeEach(() => {
  cleanup();
});

async function importSheet() {
  const mod = await import("../../src/app/(app)/catalog/[plantId]/delete-confirm-sheet");
  return mod.DeleteConfirmSheet;
}

describe("DeleteConfirmSheet", () => {
  it("Test 1 (bodyBoth): both > 0 → uses bodyBoth key with photoCount + reminderCount", async () => {
    const DeleteConfirmSheet = await importSheet();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={vi.fn()}
        plantNameOrNickname="Samambaia"
        photoEntryCount={3}
        reminderCount={2}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toContain('bodyBoth:{"photoCount":3,"reminderCount":2}');
    });
  });

  it("Test 2 (bodyPhotosOnly): photos > 0, reminders === 0 → uses bodyPhotosOnly key", async () => {
    const DeleteConfirmSheet = await importSheet();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={vi.fn()}
        plantNameOrNickname="Samambaia"
        photoEntryCount={5}
        reminderCount={0}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toContain("bodyPhotosOnly");
      expect(body).not.toContain("reminderCount");
    });
  });

  it("Test 3 (bodyRemindersOnly): photos === 0, reminders > 0 → uses bodyRemindersOnly key", async () => {
    const DeleteConfirmSheet = await importSheet();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={vi.fn()}
        plantNameOrNickname="Samambaia"
        photoEntryCount={0}
        reminderCount={1}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toContain("bodyRemindersOnly");
      expect(body).not.toContain("photoCount");
    });
  });

  it("Test 4 (bodyEmpty): both === 0 → uses bodyEmpty key (no interpolation)", async () => {
    const DeleteConfirmSheet = await importSheet();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={vi.fn()}
        plantNameOrNickname="Samambaia"
        photoEntryCount={0}
        reminderCount={0}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toContain("bodyEmpty");
      expect(body).not.toContain("photoCount");
      expect(body).not.toContain("reminderCount");
    });
  });

  it("Test 5 (alertdialog role): rendered DOM contains role='alertdialog'", async () => {
    const DeleteConfirmSheet = await importSheet();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={vi.fn()}
        plantNameOrNickname="Samambaia"
        photoEntryCount={3}
        reminderCount={2}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      const alertDialog = document.querySelector('[role="alertdialog"]');
      expect(alertDialog).not.toBeNull();
    });
  });

  it("Test 6 (autoFocus on Cancelar): Cancelar button receives initial focus after mount", async () => {
    const DeleteConfirmSheet = await importSheet();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={vi.fn()}
        plantNameOrNickname="Samambaia"
        photoEntryCount={3}
        reminderCount={2}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(
      () => {
        const cancel = document.querySelector('[data-testid="delete-confirm-cancel"]');
        expect(cancel).not.toBeNull();
        expect(document.activeElement).toBe(cancel);
      },
      { timeout: 2000 },
    );
  });

  it("Test 7 (Cancelar onClick closes sheet): clicking Cancelar calls onOpenChange(false) once", async () => {
    const DeleteConfirmSheet = await importSheet();
    const onOpenChange = vi.fn();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={onOpenChange}
        plantNameOrNickname="Samambaia"
        photoEntryCount={0}
        reminderCount={0}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      const cancel = document.querySelector('[data-testid="delete-confirm-cancel"]');
      expect(cancel).not.toBeNull();
    });

    const cancel = document.querySelector('[data-testid="delete-confirm-cancel"]') as HTMLElement;
    fireEvent.click(cancel);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Test 8 (Excluir planta onClick fires onConfirm): clicking confirm invokes onConfirm once", async () => {
    const DeleteConfirmSheet = await importSheet();
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={vi.fn()}
        plantNameOrNickname="Samambaia"
        photoEntryCount={0}
        reminderCount={0}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => {
      const confirm = document.querySelector('[data-testid="delete-confirm-confirm"]');
      expect(confirm).not.toBeNull();
    });

    const confirm = document.querySelector('[data-testid="delete-confirm-confirm"]') as HTMLElement;
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Test 9 (layout-secondary): Cancelar DOM position is BEFORE Excluir planta", async () => {
    const DeleteConfirmSheet = await importSheet();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={vi.fn()}
        plantNameOrNickname="Samambaia"
        photoEntryCount={0}
        reminderCount={0}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      const cancel = document.querySelector('[data-testid="delete-confirm-cancel"]');
      const confirm = document.querySelector('[data-testid="delete-confirm-confirm"]');
      expect(cancel).not.toBeNull();
      expect(confirm).not.toBeNull();

      const position = cancel!.compareDocumentPosition(confirm!);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it("Test 10 (Excluindo state): isDeleting=true disables Excluir button + shows deleting label", async () => {
    const DeleteConfirmSheet = await importSheet();
    render(
      <DeleteConfirmSheet
        open
        onOpenChange={vi.fn()}
        plantNameOrNickname="Samambaia"
        photoEntryCount={0}
        reminderCount={0}
        onConfirm={vi.fn()}
        isDeleting
      />,
    );

    await waitFor(() => {
      const confirm = document.querySelector(
        '[data-testid="delete-confirm-confirm"]',
      ) as HTMLButtonElement | null;
      expect(confirm).not.toBeNull();
      expect(confirm!.disabled).toBe(true);
      expect(confirm!.textContent).toContain("deleting");
    });
  });
});
