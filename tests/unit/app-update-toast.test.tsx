import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import type { AppUpdateSource } from "../../src/shared/ui/app-update-toast";

const messages = {
  app: {
    update: {
      label: "Nova versão disponível",
      cta: "Atualizar",
    },
  },
};

const toastMock = vi.fn();
vi.mock("sonner", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

beforeEach(() => {
  toastMock.mockReset();
  // Stub navigator.serviceWorker so the production guard doesn't early-return
  // under jsdom (jsdom navigator has no serviceWorker by default).
  if (!("serviceWorker" in navigator)) {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
  }
});

afterEach(() => {
  cleanup();
});

interface FakeSource {
  addEventListener: ReturnType<typeof vi.fn>;
  messageSkipWaiting: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  triggerWaiting: () => void;
  triggerControlling: () => void;
}

function makeFakeSource(): FakeSource {
  const handlers = new Map<string, () => void>();
  const addEventListener = vi.fn((type: string, handler: () => void) => {
    handlers.set(type, handler);
  });
  return {
    addEventListener,
    messageSkipWaiting: vi.fn(),
    register: vi.fn().mockResolvedValue(undefined),
    triggerWaiting: () => handlers.get("waiting")?.(),
    triggerControlling: () => handlers.get("controlling")?.(),
  };
}

describe("OFF-10 AppUpdateToast — Serwist waiting -> toast -> SKIP_WAITING -> reload", () => {
  it("attaches `waiting` listener BEFORE calling source.register() (per RESEARCH.md subscription order)", async () => {
    const source = makeFakeSource();
    const { AppUpdateToast } = await import("../../src/shared/ui/app-update-toast");
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AppUpdateToast createSource={() => source as unknown as AppUpdateSource} reload={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(source.addEventListener).toHaveBeenCalled();
    expect(source.addEventListener.mock.calls[0]?.[0]).toBe("waiting");
    expect(source.register).toHaveBeenCalled();
    const waitingCallOrder = source.addEventListener.mock.invocationCallOrder[0] ?? 0;
    const registerCallOrder = source.register.mock.invocationCallOrder[0] ?? 0;
    expect(waitingCallOrder).toBeLessThan(registerCallOrder);
  });

  it("on `waiting` event: shows sonner toast with translated label + cta", async () => {
    const source = makeFakeSource();
    const { AppUpdateToast } = await import("../../src/shared/ui/app-update-toast");
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AppUpdateToast createSource={() => source as unknown as AppUpdateSource} reload={vi.fn()} />
      </NextIntlClientProvider>,
    );
    source.triggerWaiting();
    expect(toastMock).toHaveBeenCalledTimes(1);
    const [label, options] = toastMock.mock.calls[0] ?? [];
    expect(label).toBe("Nova versão disponível");
    expect(options).toMatchObject({
      action: { label: "Atualizar" },
      duration: Infinity,
    });
  });

  it("clicking the toast action calls source.messageSkipWaiting()", async () => {
    const source = makeFakeSource();
    const { AppUpdateToast } = await import("../../src/shared/ui/app-update-toast");
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AppUpdateToast createSource={() => source as unknown as AppUpdateSource} reload={vi.fn()} />
      </NextIntlClientProvider>,
    );
    source.triggerWaiting();
    const options = toastMock.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    options.action.onClick();
    expect(source.messageSkipWaiting).toHaveBeenCalledTimes(1);
  });

  it("on `controlling` event: invokes the injected reload callback", async () => {
    const source = makeFakeSource();
    const reload = vi.fn();
    const { AppUpdateToast } = await import("../../src/shared/ui/app-update-toast");
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AppUpdateToast createSource={() => source as unknown as AppUpdateSource} reload={reload} />
      </NextIntlClientProvider>,
    );
    source.triggerWaiting();
    source.triggerControlling();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
