import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("UI-18 EmptyState — composition contract (illustration + headline + hint + ONE CTA)", () => {
  it("renders all 4 parts: illustration, headline, hint, CTA", async () => {
    const { EmptyState } = await import("../../src/shared/ui/empty-state");
    render(
      <EmptyState
        headline="Sua estante ainda está esperando a primeira planta."
        hint="As plantas que você adicionar aparecem aqui."
        ctaLabel="Adicionar planta"
        ctaHref="/catalog/add"
      />,
    );
    expect(screen.getByText("Sua estante ainda está esperando a primeira planta.")).toBeTruthy();
    expect(screen.getByText("As plantas que você adicionar aparecem aqui.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Adicionar planta" })).toBeTruthy();
    // Illustration is aria-hidden — query by attribute since role is implicit "img" but hidden.
    const illustration = document.querySelector('[aria-hidden="true"]');
    expect(illustration).not.toBeNull();
  });

  it("renders inline placeholder SVG when no illustrationSrc prop (Open Risk #3 fallback)", async () => {
    const { EmptyState } = await import("../../src/shared/ui/empty-state");
    const { container } = render(
      <EmptyState headline="X" hint="Y" ctaLabel="Z" ctaHref="/" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 64 64");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("stroke-width")).toBe("1.5");
    expect(svg?.getAttribute("fill")).toBe("none");
  });

  it("renders <img> when illustrationSrc prop is passed", async () => {
    const { EmptyState } = await import("../../src/shared/ui/empty-state");
    const { container } = render(
      <EmptyState
        headline="X"
        hint="Y"
        ctaLabel="Z"
        ctaHref="/"
        illustrationSrc="/illustrations/empty-home.svg"
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/illustrations/empty-home.svg");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
    expect(img?.getAttribute("alt")).toBe("");
    // SVG fallback should NOT also render.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("rendered tree contains EXACTLY 1 button or link (UI-18 single-CTA contract)", async () => {
    const { EmptyState } = await import("../../src/shared/ui/empty-state");
    const { container } = render(
      <EmptyState headline="X" hint="Y" ctaLabel="Z" ctaHref="/" />,
    );
    const interactives = container.querySelectorAll("button, a");
    expect(interactives.length).toBe(1);
  });

  it("renders <a> when ctaHref provided; renders <button> when ctaOnClick provided", async () => {
    const { EmptyState } = await import("../../src/shared/ui/empty-state");

    const { container: c1 } = render(
      <EmptyState headline="X" hint="Y" ctaLabel="Z" ctaHref="/somewhere" />,
    );
    expect(c1.querySelector("a")?.getAttribute("href")).toBe("/somewhere");
    expect(c1.querySelector("button")).toBeNull();

    const { container: c2 } = render(
      <EmptyState headline="X" hint="Y" ctaLabel="Z" ctaOnClick={() => {}} />,
    );
    expect(c2.querySelector("button")).not.toBeNull();
    expect(c2.querySelector("a")).toBeNull();
  });
});
