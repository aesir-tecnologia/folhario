import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { useSubscription } from "./use-subscription";
import { SubscriptionContextClient } from "./subscription-provider.client";
import { resolveSubscriptionState } from "./subscription-provider";

/**
 * useSubscription + SubscriptionProvider + resolveSubscriptionState
 *
 * Task 1 (Tests 1-2): hook contract and graceful default outside any provider.
 * Task 2 (Tests 3-9): resolver pure helper and client provider render behaviors.
 *
 * Render tests (1-3) use @testing-library/react with jsdom (unit-dom project).
 * Resolver tests (4-9) call resolveSubscriptionState directly — no React, no
 * process.env mutation needed.
 *
 * T-05-11-01 / T-05-11-02 mitigation: gate is strict "1" equality;
 * cookie alone cannot flip readOnly in production.
 */

describe("useSubscription — Task 1: hook contract", () => {
  it("Test 2: returns { active: true, readOnly: false } outside any provider (graceful default)", () => {
    const { result } = renderHook(() => useSubscription());
    expect(result.current).toEqual({ active: true, readOnly: false });
  });
});

describe("SubscriptionContextClient — Task 2: render tests", () => {
  it("Test 1: default state — child gets { active: true, readOnly: false }", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SubscriptionContextClient initialState={{ active: true, readOnly: false }}>
        {children}
      </SubscriptionContextClient>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    expect(result.current).toEqual({ active: true, readOnly: false });
  });

  it("Test 2: read-only flip — child gets { active: true, readOnly: true }", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SubscriptionContextClient initialState={{ active: true, readOnly: true }}>
        {children}
      </SubscriptionContextClient>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    expect(result.current).toEqual({ active: true, readOnly: true });
  });

  it("Test 3: no provider fallback — returns { active: true, readOnly: false } (no throw)", () => {
    const { result } = renderHook(() => useSubscription());
    expect(result.current).toEqual({ active: true, readOnly: false });
  });
});

describe("resolveSubscriptionState — Task 2: resolver pure helper", () => {
  it("Test 4: cookie honored when gate on — returns readOnly: true", () => {
    expect(resolveSubscriptionState({ enableTestRoutes: "1", cookieValue: "1" })).toEqual({
      active: true,
      readOnly: true,
    });
  });

  it("Test 5: gate on, no cookie — returns readOnly: false", () => {
    expect(resolveSubscriptionState({ enableTestRoutes: "1", cookieValue: undefined })).toEqual({
      active: true,
      readOnly: false,
    });
  });

  it("Test 6: gate off, cookie present — cookie ignored, returns readOnly: false", () => {
    expect(resolveSubscriptionState({ enableTestRoutes: undefined, cookieValue: "1" })).toEqual({
      active: true,
      readOnly: false,
    });
  });

  it("Test 7: gate is '0' (not '1'), cookie present — returns readOnly: false", () => {
    expect(resolveSubscriptionState({ enableTestRoutes: "0", cookieValue: "1" })).toEqual({
      active: true,
      readOnly: false,
    });
  });

  it("Test 8: gate is 'true' (truthy but not '1'), cookie present — returns readOnly: false", () => {
    expect(resolveSubscriptionState({ enableTestRoutes: "true", cookieValue: "1" })).toEqual({
      active: true,
      readOnly: false,
    });
  });

  it("Test 9: production path — gate undefined, cookie present — cookie is ignored (dead code path in prod)", () => {
    expect(resolveSubscriptionState({ enableTestRoutes: undefined, cookieValue: "1" })).toEqual({
      active: true,
      readOnly: false,
    });
  });
});
