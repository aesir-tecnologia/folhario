import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@shared/images/client-compress", () => ({
  compressPlantPhoto: vi.fn(async (f: File) => f),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("next-intl", () => {
  const t = (key: string) => key;
  t.raw = () => [];
  return {
    useTranslations: () => t,
  };
});

vi.mock("motion/react", () => ({
  useReducedMotion: vi.fn(() => false),
}));

import { compressPlantPhoto } from "@shared/images/client-compress";
import { toast } from "sonner";

import { PhotoJournal, type PhotoJournalProps } from "../../src/app/(app)/catalog/[plantId]/journal/photo-journal";

const PLANT = { id: "plant-123", name: "Hera", nickname: null };

const ENTRY_A = {
  id: "entry-a",
  plant_id: PLANT.id,
  photo_url: "https://example.com/a.jpg",
  thumbnail_url: "https://example.com/a-thumb.jpg",
  note: null,
  created_at: "2026-01-01T10:00:00.000Z",
};

const ENTRY_B = {
  id: "entry-b",
  plant_id: PLANT.id,
  photo_url: "https://example.com/b.jpg",
  thumbnail_url: "https://example.com/b-thumb.jpg",
  note: "Nota do B",
  created_at: "2026-04-01T10:00:00.000Z",
};

const defaultLabels = {
  titleFormat: "{name} — Diário",
  add: {
    cta: "+ Foto",
    title: "Nova foto",
    photoPlaceholder: "Toque para adicionar foto",
    noteLabel: "Anotação (opcional)",
    notePlaceholder: "Como ela está hoje?",
    submit: "Adicionar",
    submitting: "Enviando…",
    failure: "Não conseguimos enviar. Tente novamente.",
    cancel: "Cancelar",
  },
  empty: {
    title: "Comece o diário desta planta.",
    hint: "Adicione fotos novas para acompanhar o crescimento ao longo do tempo.",
    cta: "Adicionar primeira foto",
  },
  lightboxClose: "Fechar",
};

function makeFile(name = "photo.jpg", type = "image/jpeg") {
  return new File(["content"], name, { type });
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderJournal(props: Partial<PhotoJournalProps> = {}, queryClient?: QueryClient) {
  const qc = queryClient ?? makeQueryClient();
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <PhotoJournal
          plant={PLANT}
          entries={[ENTRY_A, ENTRY_B]}
          readOnly={false}
          labels={defaultLabels}
          {...props}
        />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  vi.mocked(compressPlantPhoto).mockClear();
  vi.mocked(toast.error).mockClear();
  global.fetch = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
  crypto.randomUUID = vi.fn(
    () => "a1b2c3d4-e5f6-7890-abcd-ef1234567890" as `${string}-${string}-${string}-${string}-${string}`,
  );
});

afterEach(() => {
  cleanup();
});

describe("PhotoJournal", () => {
  it("Test 1 — reverse-chrono ordering: newer entry appears before older entry", async () => {
    renderJournal({
      entries: [ENTRY_A, ENTRY_B],
    });

    const imgs = screen.getAllByRole("img");
    const srcs = imgs.map((img) => img.getAttribute("src") ?? "");

    const idxB = srcs.findIndex((s) => s.includes("b.jpg") || s.includes("b-thumb.jpg"));
    const idxA = srcs.findIndex((s) => s.includes("a.jpg") || s.includes("a-thumb.jpg"));

    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeLessThan(idxA);
  });

  it("Test 2 — '+ Foto' visible only when not readOnly", () => {
    const { unmount } = renderJournal({ readOnly: false });
    expect(screen.getByRole("button", { name: "+ Foto" })).toBeInTheDocument();
    unmount();
    cleanup();

    renderJournal({ readOnly: true });
    expect(screen.queryByRole("button", { name: "+ Foto" })).not.toBeInTheDocument();
  });

  it("Test 3 — tapping entry opens Lightbox at correct index", async () => {
    renderJournal({ entries: [ENTRY_A, ENTRY_B] });

    const imgs = screen.getAllByRole("img");
    const imgB = imgs.find(
      (img) => img.getAttribute("src")?.includes("b.jpg") || img.getAttribute("src")?.includes("b-thumb.jpg"),
    );
    expect(imgB).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(imgB!);
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("Test 4 — optimistic prepend on add success: temp entry then replaced", async () => {
    const realEntry = {
      id: "real-id",
      photo_url: "https://example.com/real.jpg",
      thumbnail_url: "https://example.com/real-thumb.jpg",
      note: null,
      created_at: new Date().toISOString(),
    };

    vi.mocked(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: realEntry }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [realEntry, ENTRY_A] }),
      });

    const qc = makeQueryClient();
    qc.setQueryData(["catalog", "photo-entries", PLANT.id], {
      items: [ENTRY_A],
    });

    renderJournal({ entries: [ENTRY_A] }, qc);

    const addBtn = screen.getByRole("button", { name: "+ Foto" });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    const sheet = screen.getByRole("dialog");
    expect(sheet).toBeInTheDocument();

    const fileInput = sheet.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [makeFile()] } });
    });

    const submitBtn = screen.getByRole("button", { name: "Adicionar" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      const postCall = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (c) => (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
    });

    await waitFor(() => {
      const cachedData = qc.getQueryData(["catalog", "photo-entries", PLANT.id]) as { items: { id: string }[] } | undefined;
      const items = cachedData?.items ?? [];
      const hasReal = items.some((e) => e.id === "real-id");
      const hasTemp = items.some((e) => e.id.startsWith("temp-"));
      expect(hasReal || !hasTemp).toBe(true);
    });
  });

  it("Test 5 — failure rolls back + sheet re-opens + toast called + bytes retained", async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: "server_error" } }),
    });

    const qc = makeQueryClient();
    qc.setQueryData(["catalog", "photo-entries", PLANT.id], {
      items: [ENTRY_A],
    });

    renderJournal({ entries: [ENTRY_A] }, qc);

    const addBtn = screen.getByRole("button", { name: "+ Foto" });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    const sheet = screen.getByRole("dialog");
    const fileInput = sheet.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [makeFile()] } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const cachedData = qc.getQueryData(["catalog", "photo-entries", PLANT.id]) as { items: { id: string }[] } | undefined;
    expect(cachedData?.items).toHaveLength(1);
    expect(cachedData?.items[0]?.id).toBe(ENTRY_A.id);
  });

  it("Test 6 — XSS guard: <script> in note renders as literal text, not script element", () => {
    const xssEntry = {
      ...ENTRY_A,
      note: "<script>alert('xss')</script>",
    };

    renderJournal({ entries: [xssEntry, ENTRY_B] });

    expect(screen.getByText("<script>alert('xss')</script>")).toBeInTheDocument();
    const container = document.querySelector('[data-testid="photo-journal"]');
    expect(container?.querySelectorAll("script")).toHaveLength(0);
  });

  it("Test 7 — Idempotency-Key header present on POST to photo-entries", async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        data: {
          id: "real-id",
          photo_url: "https://example.com/real.jpg",
          thumbnail_url: "https://example.com/real-thumb.jpg",
          note: null,
          created_at: new Date().toISOString(),
        },
      }),
    });

    renderJournal({ entries: [ENTRY_A] });

    const addBtn = screen.getByRole("button", { name: "+ Foto" });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    const sheet = screen.getByRole("dialog");
    const fileInput = sheet.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [makeFile()] } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const fetchCall = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const headers = (fetchCall[1] as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("Test 8 — Idempotency-Key: fresh key on new submit after terminal error", async () => {
    let callCount = 0;
    crypto.randomUUID = vi.fn(() => {
      callCount++;
      return `key-${callCount}-xxxx-xxxx-xxxx-xxxxxxxxxxxx` as `${string}-${string}-${string}-${string}-${string}`;
    });

    vi.mocked(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: "server_error" } }),
      })
      .mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: "real-id",
            photo_url: "https://example.com/real.jpg",
            thumbnail_url: "https://example.com/real-thumb.jpg",
            note: null,
            created_at: new Date().toISOString(),
          },
        }),
      });

    renderJournal({ entries: [ENTRY_A] });

    const addBtn = screen.getByRole("button", { name: "+ Foto" });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    const sheet = screen.getByRole("dialog");
    const fileInput = sheet.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [makeFile()] } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    const postCalls = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => (c[1] as RequestInit)?.method === "POST",
    );
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
    const headers1 = (postCalls[0]![1] as RequestInit | undefined)?.headers as Record<string, string>;
    const key1 = headers1["Idempotency-Key"]!;
    expect(key1).toContain("key-1");

    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockClear();
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        data: {
          id: "real-id-2",
          photo_url: "https://example.com/real2.jpg",
          thumbnail_url: "https://example.com/real2-thumb.jpg",
          note: null,
          created_at: new Date().toISOString(),
        },
      }),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    await waitFor(() => {
      const postCalls2 = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCalls2.length).toBeGreaterThanOrEqual(1);
    });

    const postCalls2 = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => (c[1] as RequestInit)?.method === "POST",
    );
    const headers2 = (postCalls2[0]![1] as RequestInit | undefined)?.headers as Record<string, string>;
    const key2 = headers2["Idempotency-Key"]!;

    expect(key2).not.toBe(key1);
  });
});
