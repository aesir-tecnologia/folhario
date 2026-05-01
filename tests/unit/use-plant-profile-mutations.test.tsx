import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@contexts/billing/application/use-subscription", () => ({
  useSubscription: vi.fn(() => ({ active: true, readOnly: false })),
}));

import { toast } from "sonner";
import { useSubscription } from "@contexts/billing/application/use-subscription";

type PlantDetailCache = {
  plant: Record<string, unknown>;
  _meta: { photoEntryCount: number; reminderCount: number };
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const PLANT_ID = "plant-123";
const PLANT_DETAIL_KEY = ["catalog", "plant", PLANT_ID];

function seedPlantCache(qc: QueryClient, data: PlantDetailCache) {
  qc.setQueryData(PLANT_DETAIL_KEY, data);
}

describe("usePatchPlantField", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQueryClient();
    vi.mocked(useSubscription).mockReturnValue({ active: true, readOnly: false });
    vi.mocked(toast.error).mockClear();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "test-uuid-1234-1234-1234-123456789012"),
    });
  });

  it("Test 1: optimistic apply — updates cache before PATCH resolves", async () => {
    const { usePatchPlantField } = await import(
      "@app/(app)/catalog/[plantId]/use-plant-profile-mutations"
    );

    seedPlantCache(qc, {
      plant: { id: PLANT_ID, nickname: null, name: "Samambaia" },
      _meta: { photoEntryCount: 0, reminderCount: 0 },
    });

    let resolveRequest!: (value: unknown) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as unknown as Promise<Response>,
    );

    const { result } = renderHook(
      () => usePatchPlantField(PLANT_ID, { queryClient: qc }),
      { wrapper: wrapper(qc) },
    );

    result.current.mutate({ field: "nickname", value: "Verdinho" });

    await waitFor(() => {
      const cached = qc.getQueryData<PlantDetailCache>(PLANT_DETAIL_KEY);
      expect(cached?.plant.nickname).toBe("Verdinho");
    });

    resolveRequest({
      ok: true,
      json: () => Promise.resolve({ plant: { id: PLANT_ID, nickname: "Verdinho" } }),
    });
  });

  it("Test 2: server merge on success — LWW: server response replaces optimistic value", async () => {
    const { usePatchPlantField } = await import(
      "@app/(app)/catalog/[plantId]/use-plant-profile-mutations"
    );

    seedPlantCache(qc, {
      plant: { id: PLANT_ID, nickname: "OldNickname", name: "Samambaia" },
      _meta: { photoEntryCount: 0, reminderCount: 0 },
    });

    const serverPlant = {
      id: PLANT_ID,
      nickname: "Verdinho 2",
      name: "Samambaia",
      updated_at: "2026-04-30T12:00:00.000Z",
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plant: serverPlant }),
    } as unknown as Response);

    const { result } = renderHook(
      () => usePatchPlantField(PLANT_ID, { queryClient: qc }),
      { wrapper: wrapper(qc) },
    );

    result.current.mutate({ field: "nickname", value: "Verdinho 2" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const cached = qc.getQueryData<PlantDetailCache>(PLANT_DETAIL_KEY);
    expect(cached?.plant).toEqual(serverPlant);
  });

  it("Test 3: rollback on error — cache reverts to pre-mutation snapshot", async () => {
    const { usePatchPlantField } = await import(
      "@app/(app)/catalog/[plantId]/use-plant-profile-mutations"
    );

    const initialData: PlantDetailCache = {
      plant: { id: PLANT_ID, nickname: "OriginalNick", name: "Samambaia" },
      _meta: { photoEntryCount: 0, reminderCount: 0 },
    };
    seedPlantCache(qc, initialData);

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { code: "validation_failed" } }),
    } as unknown as Response);

    const { result } = renderHook(
      () => usePatchPlantField(PLANT_ID, { queryClient: qc }),
      { wrapper: wrapper(qc) },
    );

    result.current.mutate({ field: "nickname", value: "BadValue" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const cached = qc.getQueryData<PlantDetailCache>(PLANT_DETAIL_KEY);
    expect(cached?.plant.nickname).toBe("OriginalNick");
  });

  it("Test 4: toast on error — emits catalog.profile.saveFailure key", async () => {
    const { usePatchPlantField } = await import(
      "@app/(app)/catalog/[plantId]/use-plant-profile-mutations"
    );

    seedPlantCache(qc, {
      plant: { id: PLANT_ID, nickname: null, name: "Samambaia" },
      _meta: { photoEntryCount: 0, reminderCount: 0 },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { code: "validation_failed" } }),
    } as unknown as Response);

    const toastMock = vi.fn();
    const { result } = renderHook(
      () => usePatchPlantField(PLANT_ID, { queryClient: qc, onErrorToast: toastMock }),
      { wrapper: wrapper(qc) },
    );

    result.current.mutate({ field: "nickname", value: "BadValue" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toastMock).toHaveBeenCalledWith("saveFailure");
  });
});

describe("useDeletePlant", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQueryClient();
    vi.mocked(useSubscription).mockReturnValue({ active: true, readOnly: false });
    vi.mocked(toast.error).mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("Test 5: optimistic removal — removes plant from list cache before DELETE resolves", async () => {
    const { useDeletePlant } = await import(
      "@app/(app)/catalog/[plantId]/use-plant-profile-mutations"
    );

    const listData = {
      items: [
        { id: PLANT_ID, name: "Samambaia" },
        { id: "other-plant", name: "Lírio" },
      ],
      next_cursor: null,
    };
    qc.setQueryData(["catalog", "plants", "list", { sort: "date_new" }], listData);

    let resolveDelete!: (v: unknown) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((r) => { resolveDelete = r; }) as unknown as Promise<Response>,
    );

    const { result } = renderHook(
      () => useDeletePlant(PLANT_ID, { queryClient: qc }),
      { wrapper: wrapper(qc) },
    );

    result.current.mutate();

    await waitFor(() => {
      const cached = qc.getQueryData<{ items: { id: string }[] }>(
        ["catalog", "plants", "list", { sort: "date_new" }],
      );
      expect(cached?.items.find((p) => p.id === PLANT_ID)).toBeUndefined();
    });

    resolveDelete({ ok: true, status: 204, json: () => Promise.resolve(null) });
  });

  it("Test 6: redirect on success — calls onSuccess callback; NO redirect on error", async () => {
    const { useDeletePlant } = await import(
      "@app/(app)/catalog/[plantId]/use-plant-profile-mutations"
    );

    const onSuccess = vi.fn();
    const onErrorToast = vi.fn();

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    } as unknown as Response);

    const { result } = renderHook(
      () => useDeletePlant(PLANT_ID, { queryClient: qc, onSuccess, onErrorToast }),
      { wrapper: wrapper(qc) },
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { code: "internal_error" } }),
    } as unknown as Response);

    const qc2 = makeQueryClient();
    const onSuccess2 = vi.fn();
    const { result: result2 } = renderHook(
      () => useDeletePlant(PLANT_ID, { queryClient: qc2, onSuccess: onSuccess2, onErrorToast }),
      { wrapper: wrapper(qc2) },
    );

    result2.current.mutate();

    await waitFor(() => {
      expect(result2.current.isError).toBe(true);
    });

    expect(onSuccess2).not.toHaveBeenCalled();
  });

  it("Test 7: read-only guard — throws ReadOnlyError before fetch when readOnly=true", async () => {
    const { useDeletePlant } = await import(
      "@app/(app)/catalog/[plantId]/use-plant-profile-mutations"
    );

    vi.mocked(useSubscription).mockReturnValue({ active: true, readOnly: true });

    const { result } = renderHook(
      () => useDeletePlant(PLANT_ID, { queryClient: qc }),
      { wrapper: wrapper(qc) },
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).name).toBe("ReadOnlyError");
  });
});
