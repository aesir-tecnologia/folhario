"use client";

import { useRef } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useSubscription } from "@contexts/billing/application/use-subscription";

export type PatchableField = "name" | "nickname" | "location" | "acquisitionDate" | "notes";

export class ReadOnlyError extends Error {
  constructor() {
    super("read_only_mode");
    this.name = "ReadOnlyError";
  }
}

class PatchFailedError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "PatchFailedError";
  }
}

export type PlantDetailDto = {
  plant: Record<string, unknown>;
  _meta: { photoEntryCount: number; reminderCount: number };
};

export function usePatchPlantField(
  plantId: string,
  opts?: {
    queryClient?: QueryClient;
    onErrorToast?: (key: string) => void;
  },
) {
  const qc = opts?.queryClient ?? useQueryClient();
  const t = useTranslations("catalog.profile");
  const subscription = useSubscription();
  const idempotencyKeyRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: async ({ field, value }: { field: PatchableField; value: string }) => {
      if (subscription.readOnly) throw new ReadOnlyError();

      const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
      idempotencyKeyRef.current = idempotencyKey;

      const res = await fetch(`/api/v1/plants/${plantId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ [field]: value === "" ? null : value }),
      });

      idempotencyKeyRef.current = null;

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new PatchFailedError(body?.error?.code ?? "unknown");
      }

      return (await res.json()) as { plant: Record<string, unknown> };
    },
    onMutate: async ({ field, value }) => {
      await qc.cancelQueries({ queryKey: ["catalog", "plant", plantId] });
      const previous = qc.getQueryData<PlantDetailDto>(["catalog", "plant", plantId]);
      if (previous) {
        qc.setQueryData<PlantDetailDto>(["catalog", "plant", plantId], {
          ...previous,
          plant: { ...previous.plant, [field]: value === "" ? null : value },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      idempotencyKeyRef.current = null;
      if (ctx?.previous) {
        qc.setQueryData(["catalog", "plant", plantId], ctx.previous);
      }
      const emit = opts?.onErrorToast ?? ((k: string) => toast.error(k));
      emit(t("saveFailure"));
    },
    onSuccess: (data) => {
      qc.setQueryData<PlantDetailDto>(
        ["catalog", "plant", plantId],
        (prev) => (prev ? { ...prev, plant: data.plant } : prev),
      );
    },
  });
}

export function useDeletePlant(
  plantId: string,
  opts?: {
    queryClient?: QueryClient;
    onSuccess?: () => void;
    onErrorToast?: (key: string) => void;
  },
) {
  const qc = opts?.queryClient ?? useQueryClient();
  const t = useTranslations("catalog.profile.delete");
  const subscription = useSubscription();
  const idempotencyKeyRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: async () => {
      if (subscription.readOnly) throw new ReadOnlyError();

      const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
      idempotencyKeyRef.current = idempotencyKey;

      const res = await fetch(`/api/v1/plants/${plantId}`, {
        method: "DELETE",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      });

      idempotencyKeyRef.current = null;

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.code ?? "delete_failed");
      }
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["catalog", "plants"] });

      const snapshots: Array<{ queryKey: readonly unknown[]; data: unknown }> = [];
      qc.getQueriesData<{ items: Array<{ id: string }> }>({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "catalog" &&
          q.queryKey[1] === "plants",
      }).forEach(([queryKey, data]) => {
        snapshots.push({ queryKey, data });
        if (data?.items) {
          qc.setQueryData(queryKey, {
            ...data,
            items: data.items.filter((p) => p.id !== plantId),
          });
        }
      });

      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      idempotencyKeyRef.current = null;
      if (ctx?.snapshots) {
        for (const { queryKey, data } of ctx.snapshots) {
          qc.setQueryData(queryKey, data);
        }
      }
      const emit = opts?.onErrorToast ?? ((k: string) => toast.error(k));
      emit(t("failure"));
    },
    onSuccess: () => {
      opts?.onSuccess?.();
    },
  });
}
