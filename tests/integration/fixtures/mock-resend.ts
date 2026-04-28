// Phase 4 D-29: mock the Resend SDK in unit/integration tests so the suite
// never hits Resend's real API. The single Playwright E2E that wants real
// delivery imports the actual SDK directly.
//
// Usage:
//   import { installResendMock, resendSendMock, resetResendMock } from "@tests/integration/fixtures/mock-resend";
//   installResendMock();           // before any module import that uses `new Resend(...)`
//   beforeEach(() => resetResendMock());
//   // assert: expect(resendSendMock).toHaveBeenCalledWith(...);

import { vi } from "vitest";

export const resendSendMock = vi.fn().mockResolvedValue({
  data: { id: "test-message-id" },
  error: null,
});

export function installResendMock() {
  vi.mock("resend", () => ({
    Resend: function MockResend() {
      return { emails: { send: resendSendMock } };
    },
  }));
}

export function resetResendMock() {
  resendSendMock.mockClear();
}
