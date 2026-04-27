import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// vi.hoisted ensures this mock factory runs before the vi.mock hoist.
// Without hoisted(), motionButtonMock would be in the temporal dead zone
// when the hoisted vi.mock factory references it (Rule 1 fix).
const { motionButtonMock } = vi.hoisted(() => {
  const motionButtonMock = vi.fn(({ children, ...props }: any) => (
    <button
      data-testid="captured"
      data-animate-prop={JSON.stringify(props.animate ?? null)}
      data-transition-prop={JSON.stringify(props.transition ?? null)}
    >
      {children}
    </button>
  ));
  return { motionButtonMock };
});

vi.mock("motion/react", () => ({
  motion: {
    button: motionButtonMock,
  },
  useReducedMotion: vi.fn(),
}));

import { useReducedMotion } from "motion/react";

beforeEach(() => {
  motionButtonMock.mockClear();
  vi.mocked(useReducedMotion).mockReturnValue(false);
});

describe("UI-20 CaptureButton — breathing loop respects reduced-motion (drop animate prop entirely)", () => {
  it("WITHOUT reduced-motion: animate={ scale: [1, 1.02, 1] } is set on motion.button", async () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { CaptureButton } = await import("../../src/shared/ui/capture-button");
    render(<CaptureButton aria-label="Identificar planta" breathing />);
    expect(motionButtonMock).toHaveBeenCalled();
    const props = motionButtonMock.mock.calls[0]?.[0] ?? {};
    expect(props.animate).toEqual({ scale: [1, 1.02, 1] });
    expect(props.transition).toBeDefined();
  });

  it("WITH reduced-motion: animate prop is ENTIRELY ABSENT (not { scale: 1 } — perpetual loop pitfall)", async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { CaptureButton } = await import("../../src/shared/ui/capture-button");
    render(<CaptureButton aria-label="Identificar planta" breathing />);
    const props = motionButtonMock.mock.calls[0]?.[0] ?? {};
    expect(props.animate).toBeUndefined();
    // No GPU layer should be requested under reduced-motion.
  });

  it("breathing={false}: animate prop is undefined regardless of reduced-motion", async () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { CaptureButton } = await import("../../src/shared/ui/capture-button");
    render(<CaptureButton aria-label="Identificar" />);
    const props = motionButtonMock.mock.calls[0]?.[0] ?? {};
    expect(props.animate).toBeUndefined();
  });

  it("button is circular 72px Canopy fill", async () => {
    const { CaptureButton } = await import("../../src/shared/ui/capture-button");
    render(<CaptureButton aria-label="Identificar planta" breathing />);
    const props = motionButtonMock.mock.calls[0]?.[0] ?? {};
    expect(props.className).toContain("rounded-full");
    expect(props.className).toContain("bg-canopy");
    // Either px utility or arbitrary value; assert the dimension is present.
    expect(props.className).toMatch(/w-\[72px\]|w-18|size-\[72px\]/);
  });

  it("aria-label is forwarded to button", async () => {
    const { CaptureButton } = await import("../../src/shared/ui/capture-button");
    render(<CaptureButton aria-label="Identificar planta" />);
    const props = motionButtonMock.mock.calls[0]?.[0] ?? {};
    expect(props["aria-label"]).toBe("Identificar planta");
  });
});
