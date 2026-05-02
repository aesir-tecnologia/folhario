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

function getIdempotencyKeysFromPosts(): string[] {
  const calls = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")
    .map((c) => {
      const headers = (c[1] as RequestInit).headers as Record<string, string> | undefined;
      return headers?.["Idempotency-Key"] ?? "";
    });
}

async function attachFileAndSubmit() {
  const sheet = screen.getByRole("dialog");
  const fileInput = sheet.querySelector('input[type="file"]') as HTMLInputElement;
  expect(fileInput).toBeTruthy();

  await act(async () => {
    fireEvent.change(fileInput, { target: { files: [makeFile()] } });
  });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: labels.submit }));
  });
}

beforeEach(() => {
  global.fetch = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();

  // Counter-based UUID so each call returns a unique value.
  // Lets us distinguish "same key reused" vs "fresh key generated".
  let n = 0;
  crypto.randomUUID = vi.fn(() => {
    n += 1;
    const hex = n.toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}` as `${string}-${string}-${string}-${string}-${string}`;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("JournalAddSheet — NEW-CR-05 Idempotency-Key retry behavior (D-37)", () => {
  it("transient 5xx then retry: both POSTs carry the SAME Idempotency-Key", async () => {
    // 1st POST → 503; 2nd POST → 201 success.
    const realEntry = {
      id: "real-id",
      plant_id: PLANT_ID,
      photo_url: "plant-photos/u/p1/real.jpg",
      thumbnail_url: "plant-thumbnails/u/p1/real.jpg",
      note: null,
      created_at: "2026-05-01T00:00:00Z",
    };

    vi.mocked(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: "service_unavailable" }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ photo_entry: realEntry }),
      } as unknown as Response);

    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, { items: [] });

    render(
      <JournalAddSheet open={true} onOpenChange={vi.fn()} plantId={PLANT_ID} labels={labels} />,
      { wrapper: wrap(qc) },
    );

    await attachFileAndSubmit();

    await waitFor(() => {
      expect(getIdempotencyKeysFromPosts()).toHaveLength(1);
    });

    // Sheet stays open on failure (D-15); user clicks submit again with same selected file.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.submit }));
    });

    await waitFor(() => {
      expect(getIdempotencyKeysFromPosts()).toHaveLength(2);
    });

    const keys = getIdempotencyKeysFromPosts();
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it("network error then retry: both POSTs carry the SAME Idempotency-Key", async () => {
    const realEntry = {
      id: "real-id-2",
      plant_id: PLANT_ID,
      photo_url: "plant-photos/u/p1/real-2.jpg",
      thumbnail_url: "plant-thumbnails/u/p1/real-2.jpg",
      note: null,
      created_at: "2026-05-01T00:00:00Z",
    };

    vi.mocked(global.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ photo_entry: realEntry }),
      } as unknown as Response);

    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, { items: [] });

    render(
      <JournalAddSheet open={true} onOpenChange={vi.fn()} plantId={PLANT_ID} labels={labels} />,
      { wrapper: wrap(qc) },
    );

    await attachFileAndSubmit();

    await waitFor(() => {
      expect(getIdempotencyKeysFromPosts()).toHaveLength(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.submit }));
    });

    await waitFor(() => {
      expect(getIdempotencyKeysFromPosts()).toHaveLength(2);
    });

    const keys = getIdempotencyKeysFromPosts();
    expect(keys[1]).toBe(keys[0]);
  });

  it("409 conflict then retry: DIFFERENT Idempotency-Key (negative control — body change requires fresh key)", async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: "idempotency_conflict" }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: "service_unavailable" }),
      } as unknown as Response);

    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, { items: [] });

    render(
      <JournalAddSheet open={true} onOpenChange={vi.fn()} plantId={PLANT_ID} labels={labels} />,
      { wrapper: wrap(qc) },
    );

    await attachFileAndSubmit();

    await waitFor(() => {
      expect(getIdempotencyKeysFromPosts()).toHaveLength(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.submit }));
    });

    await waitFor(() => {
      expect(getIdempotencyKeysFromPosts()).toHaveLength(2);
    });

    const keys = getIdempotencyKeysFromPosts();
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    expect(keys[1]).not.toBe(keys[0]);
  });
});
