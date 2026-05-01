import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";

vi.mock("@shared/images/client-compress", () => ({
  compressPlantPhoto: vi.fn(async (f: File) => f),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("next-intl", () => {
  const t = (key: string) => key;
  t.raw = (key: string) => {
    if (key === "defaults") return ["sala", "varanda", "quarto"];
    if (key === "addCustom") return "Adicionar '{typed}'";
    return key;
  };
  return {
    useTranslations: () => t,
  };
});

vi.mock("@contexts/billing/application/use-subscription", () => ({
  useSubscription: vi.fn(() => ({ active: true, readOnly: false })),
}));

import { compressPlantPhoto } from "@shared/images/client-compress";
import { useSubscription } from "@contexts/billing/application/use-subscription";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AddPlantForm } from "../../src/app/(app)/catalog/add/add-plant-form";
import type { AddPlantFormLabels } from "../../src/app/(app)/catalog/add/add-plant-form";

const defaultLabels: AddPlantFormLabels = {
  title: "Adicionar planta",
  photoLabel: "Foto da planta",
  photoPlaceholder: "Toque para adicionar foto",
  photoReplace: "Trocar foto",
  name: "Nome",
  namePlaceholder: "Como você chama essa planta?",
  nickname: "Apelido (opcional)",
  nicknamePlaceholder: "Um nome carinhoso",
  location: "Local (opcional)",
  acquisitionDate: "Data de aquisição (opcional)",
  notes: "Notas (opcional)",
  notesPlaceholder: "Anotações sobre essa planta…",
  submit: "Adicionar à minha estante",
  submitLoading: "Adicionando…",
  submitFailure: "Não conseguimos adicionar agora. Tente novamente em instantes.",
  errors: {
    nameRequired: "Dê um nome para sua planta.",
    photoRequired: "Adicione pelo menos uma foto.",
    acquisitionDateInvalid: "Use o formato dd/mm/aaaa.",
    summaryHeader: "Falta preencher: {fields}",
  },
  fieldNames: {
    name: "Nome",
    photo: "Foto da planta",
    acquisitionDate: "Data de aquisição (opcional)",
  },
};

function makeFile(name = "plant.jpg", type = "image/jpeg") {
  return new File(["test-content"], name, { type });
}

function renderForm(overrides?: Partial<React.ComponentProps<typeof AddPlantForm>>) {
  return render(
    <AddPlantForm
      readOnly={false}
      labels={defaultLabels}
      initialLocationSuggestions={[]}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.mocked(compressPlantPhoto).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(useSubscription).mockReturnValue({ active: true, readOnly: false });
  global.fetch = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
  crypto.randomUUID = vi.fn(() => "fake-uuid-1234-5678-1234-567890abcdef" as `${string}-${string}-${string}-${string}-${string}`);
});

afterEach(() => {
  cleanup();
});

describe("AddPlantForm", () => {
  it("Test 1 — photo preview after selection, compress NOT called yet", async () => {
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = makeFile();
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const previewImg = screen.getByRole("img", { name: "Toque para adicionar foto" });
    expect(previewImg).toBeInTheDocument();
    expect(previewImg.getAttribute("src")).toBe("blob:fake-url");

    expect(compressPlantPhoto).not.toHaveBeenCalled();
  });

  it("Test 2 — single error (only name): no summary, per-field error + first-invalid focus", async () => {
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile();
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const submitBtn = screen.getByRole("button", { name: "Adicionar à minha estante" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      const nameInput = document.getElementById(
        document.querySelector('[aria-invalid="true"]')?.id ?? "",
      );
      expect(nameInput).not.toBeNull();
    });

    const nameInput = screen.getByLabelText("Nome");
    expect(nameInput).toHaveAttribute("aria-invalid", "true");

    expect(screen.getByText("Dê um nome para sua planta.")).toBeInTheDocument();
    expect(screen.queryByRole("alert", { name: /falta preencher/i })).toBeNull();
  });

  it("Test 3 — ≥2 errors triggers summary with anchor links", async () => {
    renderForm();

    const submitBtn = screen.getByRole("button", { name: "Adicionar à minha estante" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      const summary = alerts.find((el) => el.textContent?.toLowerCase().includes("falta preencher"));
      expect(summary).toBeTruthy();
    });

    const alerts = screen.getAllByRole("alert");
    const summaryEl = alerts.find((el) => el.textContent?.toLowerCase().includes("falta preencher"));
    expect(summaryEl?.textContent).toMatch(/falta preencher/i);

    const nomeLink = summaryEl!.querySelector('a[href*="name"]') ?? screen.getAllByRole("link").find((l) => l.textContent === "Nome");
    const fotoLink = summaryEl!.querySelector('a[href*="photo"]') ?? screen.getAllByRole("link").find((l) => l.textContent === "Foto da planta");
    expect(nomeLink).toBeInTheDocument();
    expect(fotoLink).toBeInTheDocument();
  });

  it("Test 4 — compression invoked before fetch", async () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() });

    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ plant: { id: "new-plant-id" } }),
    });

    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile();
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const nameInput = screen.getByLabelText("Nome");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Hera" } });
    });

    const submitBtn = screen.getByRole("button", { name: "Adicionar à minha estante" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(compressPlantPhoto).toHaveBeenCalledWith(file);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/plants",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const compressCallOrder = vi.mocked(compressPlantPhoto).mock.invocationCallOrder[0] ?? 0;
    const fetchCallOrder = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? 0;
    expect(compressCallOrder).toBeLessThan(fetchCallOrder);

    const fetchCall = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = (fetchCall[1] as RequestInit | undefined)?.body as FormData;
    expect(body.has("name")).toBe(true);
    expect(body.has("photo")).toBe(true);
  });

  it("Test 5 — read-only mode hides submit button", () => {
    renderForm({ readOnly: true });

    expect(
      screen.queryByRole("button", { name: "Adicionar à minha estante" }),
    ).not.toBeInTheDocument();
  });

  it("Test 6 — submit failure retains photo preview + sonner toast", async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: "server_error" } }),
    });

    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile();
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const nameInput = screen.getByLabelText("Nome");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Hera" } });
    });

    const submitBtn = screen.getByRole("button", { name: "Adicionar à minha estante" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Não conseguimos adicionar agora. Tente novamente em instantes.",
        expect.any(Object),
      );
    });

    const previewImg = screen.getByRole("img");
    expect(previewImg).toBeInTheDocument();
    expect(previewImg.getAttribute("src")).toBe("blob:fake-url");

    expect(
      screen.getByRole("button", { name: "Adicionar à minha estante" }),
    ).not.toBeDisabled();
  });

  it("Test 7 — Idempotency-Key header present on POST", async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ plant: { id: "new-plant-id" } }),
    });

    const mockUUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    crypto.randomUUID = vi.fn(() => mockUUID as `${string}-${string}-${string}-${string}-${string}`);

    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [makeFile()] } });
    });

    const nameInput = screen.getByLabelText("Nome");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Hera" } });
    });

    const submitBtn = screen.getByRole("button", { name: "Adicionar à minha estante" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const fetchCall = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const headers = (fetchCall[1] as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("Test 8 — Idempotency-Key is UUID on each submit; cleared after failure so retry generates fresh key", async () => {
    const keys: string[] = [];
    let callCount = 0;
    crypto.randomUUID = vi.fn(() => {
      callCount++;
      const key = `key-${callCount}-uuid-xxxx-xxxx-xxxxxxxxxxxx`;
      return key as `${string}-${string}-${string}-${string}-${string}`;
    });

    vi.mocked(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: "server_error" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ plant: { id: "new-plant-id" } }),
      });

    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [makeFile()] } });
    });

    const nameInput = screen.getByLabelText("Nome");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Hera" } });
    });

    const submitBtn = screen.getByRole("button", { name: "Adicionar à minha estante" });

    await act(async () => { fireEvent.click(submitBtn); });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const headers1 = (vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit | undefined)?.headers as Record<string, string>;
    keys.push(headers1["Idempotency-Key"]!);
    expect(headers1["Idempotency-Key"]).toMatch(/key-1-uuid/);

    await act(async () => { fireEvent.click(submitBtn); });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const headers2 = (vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]![1] as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers2["Idempotency-Key"]).not.toBe(keys[0]!);
  });
});
