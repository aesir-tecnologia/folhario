import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@shared/images/client-compress", () => ({
  compressPlantPhoto: vi.fn(async (f: File) => f),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { JournalAddSheet } from "../../src/app/(app)/catalog/[plantId]/journal/journal-add-sheet";
import { plantsKeys } from "@contexts/catalog/queries";

const PLANT_ID = "plant-1";
const QUERY_KEY = plantsKeys.photoEntries(PLANT_ID).queryKey;

const labels = {
  cta: "+ Foto",
  title: "Adicionar ao diário",
  photoPlaceholder: "Toque para adicionar foto",
  photoRequired: "Adicione uma foto",
  noteLabel: "Nota",
  notePlaceholder: "(opcional)",
  submit: "Salvar",
  submitting: "Salvando…",
  failure: "Falhou",
  cancel: "Cancelar",
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
}

function wrap(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function makeFile(name = "photo.jpg", type = "image/jpeg") {
  return new File(["content"], name, { type });
}

beforeEach(() => {
  global.fetch = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
  crypto.randomUUID = vi.fn(
    () =>
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890" as `${string}-${string}-${string}-${string}-${string}`,
  );
});

afterEach(() => {
  cleanup();
});

describe("JournalAddSheet — WR-05 response shape", () => {
  it("WR-05: success path replaces optimistic temp entry with body.photo_entry, never undefined", async () => {
    const realEntry = {
      id: "real-id",
      plant_id: PLANT_ID,
      photo_url: "plant-photos/u/p1/real.jpg",
      thumbnail_url: "plant-thumbnails/u/p1/real.jpg",
      note: null,
      created_at: "2026-05-01T00:00:00Z",
    };

    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ photo_entry: realEntry }),
    });

    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, { items: [] });

    render(
      <JournalAddSheet open={true} onOpenChange={vi.fn()} plantId={PLANT_ID} labels={labels} />,
      { wrapper: wrap(qc) },
    );

    const sheet = screen.getByRole("dialog");
    const fileInput = sheet.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [makeFile()] } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.submit }));
    });

    await waitFor(() => {
      const postCall = vi
        .mocked(global.fetch as ReturnType<typeof vi.fn>)
        .mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
      expect(postCall).toBeTruthy();
    });

    await waitFor(() => {
      const cached = qc.getQueryData<{ items: Array<typeof realEntry | undefined> }>(QUERY_KEY);
      const items = cached?.items ?? [];
      const undefinedRows = items.filter((e) => e === undefined);
      expect(undefinedRows).toEqual([]);
      const hasReal = items.some((e) => e !== undefined && e.id === "real-id");
      expect(hasReal).toBe(true);
    });
  });
});
