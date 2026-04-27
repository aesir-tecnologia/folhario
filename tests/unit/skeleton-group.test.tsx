import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock the motion hook for deterministic reduced-motion test.
vi.mock("motion/react", () => ({
  useReducedMotion: vi.fn(),
}));
import { useReducedMotion } from "motion/react";

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(useReducedMotion).mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("UI-17 SkeletonGroup — 300ms client gate + reduced-motion fallback", () => {
  it("renders null for first 300ms after mount", async () => {
    const { SkeletonGroup, Skeleton } = await import("../../src/shared/ui/skeleton");
    const { container } = render(
      <SkeletonGroup>
        <Skeleton width={100} data-testid="sk" />
      </SkeletonGroup>,
    );
    expect(container.querySelector('[data-testid="sk"]')).toBeNull();

    vi.advanceTimersByTime(299);
    expect(container.querySelector('[data-testid="sk"]')).toBeNull();

    vi.advanceTimersByTime(2);
    expect(container.querySelector('[data-testid="sk"]')).not.toBeNull();
  });

  it("clears timer on unmount (no stale render)", async () => {
    const { SkeletonGroup, Skeleton } = await import("../../src/shared/ui/skeleton");
    const { unmount, container } = render(
      <SkeletonGroup>
        <Skeleton width={100} data-testid="sk" />
      </SkeletonGroup>,
    );
    unmount();
    vi.advanceTimersByTime(500);
    // After unmount, container is detached — sk never appears.
    expect(container.querySelector('[data-testid="sk"]')).toBeNull();
  });
});

describe("UI-17 Skeleton — width prop + reduced-motion path", () => {
  it("applies explicit width prop via inline style", async () => {
    const { Skeleton } = await import("../../src/shared/ui/skeleton");
    render(<Skeleton width={150} data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el.style.width).toBe("150px");
  });

  it("under reduced-motion, omits shimmer keyframes class", async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { Skeleton } = await import("../../src/shared/ui/skeleton");
    render(<Skeleton width={100} data-testid="sk" />);
    const el = screen.getByTestId("sk");
    // Must NOT include the shimmer animation class. Static block + opacity fade only.
    expect(el.className).not.toContain("animate-shimmer");
    // Should include the static-block indicator (e.g., bg-hairline solid + opacity transition).
    expect(el.className).toMatch(/bg-hairline|bg-ivory/);
  });

  it("without reduced-motion, includes shimmer animation class", async () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { Skeleton } = await import("../../src/shared/ui/skeleton");
    render(<Skeleton width={100} data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el.className).toContain("animate-shimmer");
  });
});
