import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * RED — Task 1 behaviors:
 *   Test 2: useSubscription() outside provider returns context default { active: true, readOnly: false }
 *
 * Tests 4-9 (resolver + provider render) are added in Task 2 (GREEN for
 * subscription-provider.tsx). All tests live in this one file per plan.
 *
 * Note: Test 1 (SubscriptionState type) is a compile-time check via tsc --noEmit;
 * it is not a runtime Vitest test.
 */

import { useSubscription } from "./use-subscription";

describe("useSubscription — hook contract (Task 1)", () => {
  it("Test 2: returns { active: true, readOnly: false } when called outside any provider (graceful default)", () => {
    const { result } = renderHook(() => useSubscription());
    expect(result.current).toEqual({ active: true, readOnly: false });
  });
});
