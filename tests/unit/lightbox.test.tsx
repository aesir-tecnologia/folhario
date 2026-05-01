import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("motion/react", () => ({
  useReducedMotion: vi.fn(),
}));
import { useReducedMotion } from "motion/react";

import { Lightbox, type LightboxPhoto } from "@shared/ui/lightbox";

const PHOTOS: LightboxPhoto[] = [
  { id: "p1", src: "https://example.com/1.jpg" },
  { id: "p2", src: "https://example.com/2.jpg", caption: "Uma flor" },
  { id: "p3", src: "https://example.com/3.jpg" },
];

function makeProps(overrides: Partial<Parameters<typeof Lightbox>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    photos: PHOTOS,
    index: 0,
    onIndexChange: vi.fn(),
    plantName: "Manjericão",
    closeLabel: "Fechar",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(useReducedMotion).mockReturnValue(false);
});

describe("Lightbox", () => {
  it("renders Radix Dialog with role=dialog and aria-label containing plant name", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(<Lightbox {...makeProps()} />);
    expect(screen.getByRole("dialog", { name: /Galeria — Manjericão/ })).toBeTruthy();
  });

  it("renders visible Fechar button when open", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(<Lightbox {...makeProps()} />);
    expect(screen.getByRole("button", { name: "Fechar" })).toBeTruthy();
  });

  it("renders aria-live=polite index indicator for >=2 photos", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(<Lightbox {...makeProps({ index: 0 })} />);
    const indicator = document.querySelector("[aria-live='polite']");
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toContain("1");
    expect(indicator?.textContent).toContain("3");
  });

  it("does NOT render index indicator for single photo", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <Lightbox
        {...makeProps({
          photos: [{ id: "p1", src: "https://example.com/1.jpg" }],
          index: 0,
        })}
      />
    );
    expect(screen.queryByText("1 / 1")).toBeNull();
  });

  it("ArrowRight calls onIndexChange with next index (no wrap at end)", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onIndexChange = vi.fn();
    render(<Lightbox {...makeProps({ index: 0, onIndexChange })} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("ArrowRight clamps at last photo — does NOT wrap", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onIndexChange = vi.fn();
    render(<Lightbox {...makeProps({ index: 2, onIndexChange })} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("ArrowLeft calls onIndexChange with prev index (no wrap at start)", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onIndexChange = vi.fn();
    render(<Lightbox {...makeProps({ index: 1, onIndexChange })} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("ArrowLeft clamps at index 0 — does NOT wrap to last", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onIndexChange = vi.fn();
    render(<Lightbox {...makeProps({ index: 0, onIndexChange })} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("touch swipe LEFT (dx < 0, >=80px, velocity >=0.3) calls onIndexChange(index+1)", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onIndexChange = vi.fn();
    render(<Lightbox {...makeProps({ index: 0, onIndexChange })} />);
    const dialog = screen.getByRole("dialog");

    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(100);

    fireEvent.touchStart(dialog, {
      touches: [{ clientX: 200 }],
      changedTouches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(dialog, {
      changedTouches: [{ clientX: 90, clientY: 100 }],
    });
    // dx = 90-200 = -110 (< 0 → advance next), dt=100ms, velocity=1.1 >=0.3
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("touch swipe RIGHT (dx > 0, >=80px, velocity >=0.3) calls onIndexChange(index-1)", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onIndexChange = vi.fn();
    render(<Lightbox {...makeProps({ index: 1, onIndexChange })} />);
    const dialog = screen.getByRole("dialog");

    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(100);

    fireEvent.touchStart(dialog, {
      touches: [{ clientX: 90 }],
      changedTouches: [{ clientX: 90, clientY: 100 }],
    });
    fireEvent.touchEnd(dialog, {
      changedTouches: [{ clientX: 200, clientY: 100 }],
    });
    // dx = 200-90 = 110 (> 0 → advance prev), dt=100ms, velocity=1.1 >=0.3
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("touch swipe under distance threshold is no-op", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onIndexChange = vi.fn();
    render(<Lightbox {...makeProps({ index: 0, onIndexChange })} />);
    const dialog = screen.getByRole("dialog");

    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(100);

    fireEvent.touchStart(dialog, {
      touches: [{ clientX: 200 }],
      changedTouches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(dialog, {
      changedTouches: [{ clientX: 160, clientY: 100 }],
    });
    // |dx|=40 < 80 — under threshold
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("touch swipe under velocity threshold is no-op", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onIndexChange = vi.fn();
    render(<Lightbox {...makeProps({ index: 0, onIndexChange })} />);
    const dialog = screen.getByRole("dialog");

    const nowSpy = vi.spyOn(performance, "now");
    // dt=400ms so velocity = 100/400 = 0.25 < 0.3
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(400);

    fireEvent.touchStart(dialog, {
      touches: [{ clientX: 200 }],
      changedTouches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(dialog, {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    // |dx|=100 >=80 but velocity=0.25 < 0.3 — still no-op
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("multi-touch touchStart does NOT prevent default (pinch-zoom non-interference)", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(<Lightbox {...makeProps()} />);
    const dialog = screen.getByRole("dialog");

    const result = fireEvent.touchStart(dialog, {
      touches: [{ clientX: 100 }, { clientX: 200 }],
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    // fireEvent returns !defaultPrevented, so true means defaultPrevented===false
    expect(result).toBe(true);
  });

  it("reduced-motion: content className has opacity transition, NO scale tokens", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<Lightbox {...makeProps()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).not.toMatch(/scale-/);
    expect(dialog.className).toMatch(/transition-opacity|duration-\[80ms\]/);
  });

  it("no-reduced-motion: content className contains scale token", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(<Lightbox {...makeProps()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/scale-/);
  });

  it("no touch-action:none on dialog content (pinch-zoom regression sentinel)", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { container } = render(<Lightbox {...makeProps()} />);
    expect(container.innerHTML).not.toMatch(/touch-action:\s*none/);
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).not.toContain("touch-none");
  });
});
