import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

describe("UI-19 InlineError — required slots + Overdue Rust color + role=alert", () => {
  it("renders cause + recovery + retry button text", async () => {
    const { InlineError } = await import("../../src/shared/ui/inline-error");
    render(
      <InlineError
        cause="Não foi possível conectar ao servidor."
        recovery="Verifique sua conexão e tente novamente."
        retry={{ label: "Tentar novamente", onClick: () => {} }}
      />,
    );
    expect(screen.getByText("Não foi possível conectar ao servidor.")).toBeTruthy();
    expect(screen.getByText("Verifique sua conexão e tente novamente.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });

  it("container has role=alert", async () => {
    const { InlineError } = await import("../../src/shared/ui/inline-error");
    const { container } = render(
      <InlineError
        cause="A"
        recovery="B"
        retry={{ label: "C", onClick: () => {} }}
      />,
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("className contains Overdue Rust color (text-rust or bg-rust), NOT Urgent Poppy", async () => {
    const { InlineError } = await import("../../src/shared/ui/inline-error");
    const { container } = render(
      <InlineError
        cause="A"
        recovery="B"
        retry={{ label: "C", onClick: () => {} }}
      />,
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/text-poppy|bg-poppy|border-poppy/);
    expect(html).toMatch(/text-rust|bg-rust|border-rust/);
  });

  it("clicking retry button invokes callback exactly once", async () => {
    const { InlineError } = await import("../../src/shared/ui/inline-error");
    const onRetry = vi.fn();
    render(
      <InlineError
        cause="A"
        recovery="B"
        retry={{ label: "Tentar", onClick: onRetry }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
